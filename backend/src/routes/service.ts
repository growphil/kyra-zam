import { FastifyInstance } from "fastify";
import { prisma } from "../prisma";
import { requireRoles } from "../middleware/rbac";
import { ServiceStatus, MaterialRequestStatus, TestStatus, ApprovalMethod, ReservationStatus } from "../generated/client";
import { ServiceWorkflowEngine } from "../services/serviceWorkflowEngine";

export async function serviceRoutes(fastify: FastifyInstance) {
  // POST /service/battery - Create service entry
  fastify.post(
    "/battery",
    { preHandler: [requireRoles("INVENTORY_MANAGER", "ADMIN", "SUPERADMIN")] },
    async (request, reply) => {
      const { customerName, customerMobile, batteryModel, originalBatterySerial, issueDescription, warrantyStatus, images, warrantyId } = request.body as any;
      const user = request.user as { id: string; roles: string[] };

      const date = new Date();
      const yearMonth = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}`;

      let attempts = 0;
      const maxAttempts = 3;

      while (attempts < maxAttempts) {
        try {
          const result = await prisma.$transaction(async (tx) => {
            // Acquire exclusive lock on ServiceBattery table to serialize ID generation
            await tx.$executeRawUnsafe('LOCK TABLE "ServiceBattery" IN EXCLUSIVE MODE');

            // Generate Service ID and Serial Number inside the locked transaction
            const count = await tx.serviceBattery.count();
            const serviceId = `SRV-${yearMonth}-${String(count + 1).padStart(4, "0")}`;
            const serialNumber = `SRV-SER-${yearMonth}-${String(count + 1).padStart(4, "0")}`;

            // Re-check uniqueness in the database to prevent duplicate writes
            const duplicate = await tx.serviceBattery.findFirst({
              where: {
                OR: [
                  { serviceId },
                  { serialNumber }
                ]
              }
            });
            if (duplicate) {
              throw new Error("Duplicate Service ID generated");
            }

            // M-2 Warranty Verification
            let finalWarrantyStatus = "NON_WARRANTY";
            if (warrantyId) {
              // Lock the warranty row for update
              await tx.$executeRawUnsafe(
                `SELECT * FROM "Warranty" WHERE id = $1 FOR UPDATE`,
                warrantyId
              );

              const warranty = await tx.warranty.findUnique({
                where: { id: warrantyId },
                include: { customer: true }
              });

              if (!warranty) {
                const err = new Error(`Warranty not found: ${warrantyId}`);
                (err as any).statusCode = 404;
                throw err;
              }

              if (warranty.status !== "ACTIVE") {
                const err = new Error(`Warranty status is ${warranty.status}, expected ACTIVE`);
                (err as any).statusCode = 400;
                throw err;
              }

              const now = new Date();
              if (now > new Date(warranty.warrantyEndDate)) {
                const err = new Error("Warranty has expired");
                (err as any).statusCode = 400;
                throw err;
              }

              // Verify customer name match (case-insensitive, trimmed)
              const nameMatch = warranty.customer.name.toLowerCase().trim() === customerName.toLowerCase().trim();
              if (!nameMatch) {
                const err = new Error("Warranty customer mismatch");
                (err as any).statusCode = 400;
                throw err;
              }

              // originalBatterySerial MUST be provided when warrantyId is supplied
              if (!originalBatterySerial) {
                const err = new Error("originalBatterySerial is required when warrantyId is provided");
                (err as any).statusCode = 400;
                throw err;
              }

              // Verify serial number match
              if (warranty.paxSerial) {
                if (originalBatterySerial.trim() !== warranty.paxSerial.trim()) {
                  const err = new Error("Warranty serial number mismatch");
                  (err as any).statusCode = 400;
                  throw err;
                }
              }

              finalWarrantyStatus = "IN_WARRANTY";
            }

            const serviceBattery = await tx.serviceBattery.create({
              data: {
                serviceId,
                serialNumber,
                customerName,
                customerMobile,
                batteryModel,
                originalBatterySerial,
                issueDescription,
                warrantyStatus: finalWarrantyStatus,
                warrantyId: warrantyId || null,
                images: images || [],
                createdBy: user.id,
                status: "RECEIVED",
                version: 1
              }
            });

            await ServiceWorkflowEngine.logRepairAction(
              tx,
              serviceBattery.id,
              null,
              "RECEIVED",
              "SERVICE_CREATED",
              "Service battery entry created",
              user.id
            );

            return serviceBattery;
          });

          return result;
        } catch (err: any) {
          if (err.message.includes("Unique constraint") || err.message.includes("Duplicate Service ID")) {
            attempts++;
            if (attempts >= maxAttempts) {
              return reply.status(409).send({ error: "Failed to allocate unique Service ID after multiple attempts due to concurrency." });
            }
            await new Promise((resolve) => setTimeout(resolve, 50 * attempts));
            continue;
          }
          const code = err.statusCode || 400;
          return reply.status(code).send({ error: err.message || "Service battery creation failed" });
        }
      }
    }
  );

  // GET /service/battery - List all service batteries
  fastify.get(
    "/battery",
    { preHandler: [fastify.authenticate] },
    async (request) => {
      const batteries = await prisma.serviceBattery.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          delivery: true,
          serviceCost: true,
          estimate: true,
          scrapApproval: true,
          reopenHistory: true
        }
      });
      return batteries;
    }
  );

  // GET /service/analytics - Service cost analytics
  fastify.get(
    "/analytics",
    { preHandler: [requireRoles("ADMIN", "SUPERADMIN", "ACCOUNTANT")] },
    async (request) => {
      const { startDate, endDate, status } = request.query as any;

      const where: any = {};
      if (status) {
        where.status = status;
      }
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = new Date(startDate);
        if (endDate) where.createdAt.lte = new Date(endDate);
      }

      const batteries = await prisma.serviceBattery.findMany({
        where,
        include: {
          serviceCost: true
        }
      });

      let totalServiceRevenue = 0;
      let totalLabourRevenue = 0;
      let totalMaterialCost = 0;
      let grossMargin = 0;
      let warrantyCost = 0;
      let paidServiceRevenue = 0;
      let outstandingPayments = 0;
      let countWithCost = 0;

      for (const bat of batteries) {
        if (bat.serviceCost) {
          const total = Number(bat.serviceCost.totalCost);
          const labour = Number(bat.serviceCost.labourCost);
          const material = Number(bat.serviceCost.materialCost);
          const paid = Number(bat.serviceCost.amountPaid);
          const margin = Number(bat.serviceCost.marginAmount);
          const due = total - paid;
          
          const isWarranty = bat.warrantyStatus && ["true", "warranty", "in_warranty"].includes(bat.warrantyStatus.toLowerCase());

          totalServiceRevenue += total;
          totalLabourRevenue += labour;
          totalMaterialCost += material;
          grossMargin += margin;
          countWithCost++;

          if (isWarranty) {
            warrantyCost += total;
          } else {
            paidServiceRevenue += paid;
            if (due > 0) {
              outstandingPayments += due;
            }
          }
        }
      }

      const averageRepairCost = countWithCost > 0 ? (totalServiceRevenue / countWithCost) : 0;

      // Top Service Types
      const typeGroups = await prisma.serviceCost.groupBy({
        by: ["serviceType"],
        _sum: {
          totalCost: true
        },
        _count: {
          id: true
        }
      });
      const topServiceTypes = typeGroups.map(g => ({
        serviceType: g.serviceType,
        count: g._count.id,
        revenue: Number(g._sum.totalCost || 0)
      })).sort((a,b) => b.revenue - a.revenue);

      // Top Consumed Materials
      const materialItems = await prisma.serviceMaterialItem.findMany({
        where: {
          request: {
            status: "ISSUED"
          }
        },
        include: {
          material: true
        }
      });
      const matSummaryMap: Record<string, { name: string, quantity: number, cost: number }> = {};
      for (const item of materialItems) {
        if (!matSummaryMap[item.materialId]) {
          matSummaryMap[item.materialId] = { name: item.material.name, quantity: 0, cost: 0 };
        }
        matSummaryMap[item.materialId].quantity += item.quantity;
        matSummaryMap[item.materialId].cost += item.quantity * Number(item.issuedUnitCost);
      }
      const topConsumedMaterials = Object.values(matSummaryMap)
        .sort((a, b) => b.cost - a.cost)
        .slice(0, 5);

      return {
        totalServiceRevenue,
        totalMaterialCost,
        totalLabourRevenue,
        grossMargin,
        warrantyCost,
        paidServiceRevenue,
        outstandingPayments,
        averageRepairCost,
        topServiceTypes,
        topConsumedMaterials,
        count: batteries.length,
        countWithCost
      };
    }
  );

  // GET /service/battery/:id - Get details
  fastify.get(
    "/battery/:id",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const battery = await prisma.serviceBattery.findUnique({
        where: { id },
        include: {
          repairLogs: true,
          materialRequests: {
            include: {
              items: {
                include: {
                  material: true
                }
              }
            }
          },
          testReports: true,
          delivery: true,
          serviceCost: true,
          estimate: true,
          scrapApproval: true,
          reopenHistory: true
        }
      });

      if (!battery) return reply.status(404).send({ error: "Service battery not found" });
      return battery;
    }
  );

  // PATCH /service/battery/:id/status - Update status
  fastify.patch(
    "/service/battery/:id/status",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { status, notes, serviceType, version, holdReason } = request.body as { status: string, notes?: string, serviceType?: string, version?: number, holdReason?: string };
      const user = request.user as { id: string; roles: string[] };

      try {
        const result = await prisma.$transaction(async (tx) => {
          // 1. Pessimistic row locking
          await tx.$executeRawUnsafe(
            `SELECT * FROM "ServiceBattery" WHERE id = $1 FOR UPDATE`,
            id
          );

          // 2. Re-read the battery after lock
          const battery = await tx.serviceBattery.findUnique({ where: { id } });
          if (!battery) {
            throw new Error("Service battery not found");
          }

          // 3. Make version parameter mandatory
          if (version === undefined || version === null) {
            const err = new Error("Version is required for status updates");
            (err as any).statusCode = 400;
            throw err;
          }

          // 4. Stale-version concurrency protection
          if (battery.version !== version) {
            const err = new Error("Stale database record. Concurrent modification detected.");
            (err as any).statusCode = 409;
            throw err;
          }

          let targetStatus = status;

          // Resume action logic
          if (status === "RESUME") {
            if (!battery.previousStatus) {
              throw new Error("No previous status found to resume to");
            }
            targetStatus = battery.previousStatus;
          }

          // 5. Central validation (passing previousStatus)
          ServiceWorkflowEngine.validateTransition(battery.status, targetStatus, user.roles, battery.previousStatus);

          const updateData: any = { 
            status: targetStatus,
            version: battery.version + 1
          };

          if (serviceType) {
            updateData.serviceType = serviceType.trim();
          }

          // If transitioning to hold
          if (targetStatus === "ON_HOLD") {
            updateData.holdReason = holdReason || "Standard hold";
            updateData.holdBy = user.id;
            updateData.holdDate = new Date();
            updateData.previousStatus = battery.status;
          } else if (battery.status === "ON_HOLD") {
            // If resuming from hold
            updateData.holdReason = null;
            updateData.holdBy = null;
            updateData.holdDate = null;
            updateData.resumeDate = new Date();
            updateData.previousStatus = null;
          }

          // 6. Release active RESERVED reservations to RELEASED on cancellation
          if (targetStatus === "CANCELLED") {
            const activeReservations = await tx.inventoryReservation.findMany({
              where: {
                serviceBatteryId: id,
                status: "RESERVED"
              }
            });

            if (activeReservations.length > 0) {
              await tx.inventoryReservation.updateMany({
                where: {
                  serviceBatteryId: id,
                  status: "RESERVED"
                },
                data: {
                  status: "RELEASED",
                  releasedAt: new Date()
                }
              });

              for (const res of activeReservations) {
                await tx.auditLog.create({
                  data: {
                    entityType: "InventoryReservation",
                    entityId: res.id,
                    actorId: user.id,
                    action: "RELEASED_ON_CANCELLATION",
                    prevStatus: "RESERVED",
                    newStatus: "RELEASED",
                    metadata: { serviceBatteryId: id, materialId: res.materialId, quantity: res.quantity }
                  }
                });
              }
            }
          }

          const updated = await tx.serviceBattery.update({
            where: { id },
            data: updateData
          });

          // Trigger cost calculation when status becomes READY_FOR_DELIVERY
          if (targetStatus === "READY_FOR_DELIVERY") {
            await ServiceWorkflowEngine.calculateServiceCost(tx, id);
            
            // Check for notifications
            await ServiceWorkflowEngine.triggerNotification(tx, "INVENTORY_MANAGER", null, `Battery ${battery.serviceId} is ready for delivery`);
          }

          // Unified logging using the actual previous status from database
          const actionText = targetStatus === "SCRAP" ? "SCRAP_DECLARATION" : targetStatus === "CANCELLED" ? "CANCELLATION" : `STATUS_UPDATE_${targetStatus}`;
          await ServiceWorkflowEngine.logRepairAction(
            tx,
            id,
            battery.status,
            targetStatus,
            actionText,
            notes || `Status transitioned to ${targetStatus}`,
            user.id
          );

          return updated;
        });

        return result;
      } catch (err: any) {
        const code = err.statusCode || 400;
        return reply.status(code).send({ error: err.message });
      }
    }
  );

  // POST /service/estimate - Create customer estimate
  fastify.post(
    "/estimate",
    { preHandler: [requireRoles("ADMIN", "SUPERADMIN")] },
    async (request, reply) => {
      const { serviceBatteryId, materialCost, labourCost, marginAmount, totalEstimate, remarks } = request.body as any;
      const user = request.user as { id: string };

      try {
        const result = await prisma.$transaction(async (tx) => {
          const battery = await tx.serviceBattery.findUnique({ where: { id: serviceBatteryId } });
          if (!battery) throw new Error("Service battery not found");

          ServiceWorkflowEngine.validateTransition(battery.status, "ESTIMATE_GENERATED", ["ADMIN"], battery.previousStatus);

          const estimate = await tx.serviceEstimate.create({
            data: {
              serviceBatteryId,
              materialCost: Number(materialCost),
              labourCost: Number(labourCost),
              marginAmount: Number(marginAmount),
              totalEstimate: Number(totalEstimate),
              remarks
            }
          });

          await tx.serviceBattery.update({
            where: { id: serviceBatteryId },
            data: { 
              status: "ESTIMATE_GENERATED",
              version: battery.version + 1
            }
          });

          await ServiceWorkflowEngine.logRepairAction(
            tx,
            serviceBatteryId,
            battery.status,
            "ESTIMATE_GENERATED",
            "ESTIMATE_GENERATED",
            `Estimate generated: Total ₹${totalEstimate}`,
            user.id
          );

          return estimate;
        });

        return result;
      } catch (err: any) {
        return reply.status(400).send({ error: err.message });
      }
    }
  );

  // POST /service/estimate/approve - Approve customer estimate
  fastify.post(
    "/estimate/approve",
    { preHandler: [requireRoles("ADMIN", "SUPERADMIN")] },
    async (request, reply) => {
      const { serviceBatteryId, approvalMethod, remarks } = request.body as { serviceBatteryId: string, approvalMethod: ApprovalMethod, remarks?: string };
      const user = request.user as { id: string };

      try {
        const result = await prisma.$transaction(async (tx) => {
          const battery = await tx.serviceBattery.findUnique({ where: { id: serviceBatteryId }, include: { estimate: true } });
          if (!battery) throw new Error("Service battery not found");
          if (!battery.estimate) throw new Error("No estimate found to approve");

          ServiceWorkflowEngine.validateTransition(battery.status, "MATERIAL_REQUESTED", ["ADMIN"], battery.previousStatus);

          await tx.serviceEstimate.update({
            where: { serviceBatteryId },
            data: {
              approvedByCustomer: true,
              approvedDate: new Date(),
              approvalMethod,
              remarks: remarks || battery.estimate.remarks
            }
          });

          await tx.serviceBattery.update({
            where: { id: serviceBatteryId },
            data: {
              status: "MATERIAL_REQUESTED",
              version: battery.version + 1
            }
          });

          await ServiceWorkflowEngine.logRepairAction(
            tx,
            serviceBatteryId,
            battery.status,
            "MATERIAL_REQUESTED",
            "ESTIMATE_APPROVED",
            `Estimate approved by customer via ${approvalMethod}`,
            user.id
          );

          // Notify Inventory Manager that material request is pending
          await ServiceWorkflowEngine.triggerNotification(tx, "INVENTORY_MANAGER", null, `Material request pending for battery ${battery.serviceId}`);

          return { success: true };
        });

        return result;
      } catch (err: any) {
        return reply.status(400).send({ error: err.message });
      }
    }
  );

  // POST /service/scrap-recommend - Recommend scrap
  fastify.post(
    "/scrap-recommend",
    { preHandler: [requireRoles("ASSEMBLY_TECHNICIAN", "ADMIN", "SUPERADMIN")] },
    async (request, reply) => {
      const { serviceBatteryId, reason, remarks } = request.body as { serviceBatteryId: string, reason: string, remarks?: string };
      const user = request.user as { id: string };

      try {
        const result = await prisma.$transaction(async (tx) => {
          const battery = await tx.serviceBattery.findUnique({ where: { id: serviceBatteryId } });
          if (!battery) throw new Error("Service battery not found");

          ServiceWorkflowEngine.validateTransition(battery.status, "SCRAP_RECOMMENDED", ["ASSEMBLY_TECHNICIAN"], battery.previousStatus);

          const scrapApproval = await tx.scrapApproval.create({
            data: {
              serviceBatteryId,
              recommendedBy: user.id,
              reason,
              remarks
            }
          });

          await tx.serviceBattery.update({
            where: { id: serviceBatteryId },
            data: {
              status: "SCRAP_RECOMMENDED",
              version: battery.version + 1
            }
          });

          await ServiceWorkflowEngine.logRepairAction(
            tx,
            serviceBatteryId,
            battery.status,
            "SCRAP_RECOMMENDED",
            "SCRAP_RECOMMENDED",
            `Recommended for scrap. Reason: ${reason}`,
            user.id
          );

          return scrapApproval;
        });

        return result;
      } catch (err: any) {
        return reply.status(400).send({ error: err.message });
      }
    }
  );

  // POST /service/scrap-approve - Finalize/Reject scrap approval
  fastify.post(
    "/scrap-approve",
    { preHandler: [requireRoles("ADMIN", "SUPERADMIN")] },
    async (request, reply) => {
      const { serviceBatteryId, approved, remarks } = request.body as { serviceBatteryId: string, approved: boolean, remarks?: string };
      const user = request.user as { id: string };

      try {
        const result = await prisma.$transaction(async (tx) => {
          // Lock ServiceBattery
          await tx.$executeRawUnsafe(
            `SELECT * FROM "ServiceBattery" WHERE id = $1 FOR UPDATE`,
            serviceBatteryId
          );

          const battery = await tx.serviceBattery.findUnique({ where: { id: serviceBatteryId } });
          if (!battery) throw new Error("Service battery not found");

          // Load ScrapApproval record inside transaction
          const scrapApproval = await tx.scrapApproval.findUnique({
            where: { serviceBatteryId }
          });
          if (!scrapApproval) {
            throw new Error("No scrap recommendation found for this battery");
          }

          // M-5: Separation of duties check
          if (scrapApproval.recommendedBy === user.id) {
            const err = new Error("Separation of duties violation: Recommender cannot approve their own scrap recommendation.");
            (err as any).statusCode = 403;
            throw err;
          }

          const targetStatus = approved ? "SCRAP" : "DIAGNOSIS_PENDING";
          ServiceWorkflowEngine.validateTransition(battery.status, targetStatus, ["ADMIN"], battery.previousStatus);

          await tx.scrapApproval.update({
            where: { serviceBatteryId },
            data: {
              approvedBy: user.id,
              approvedDate: new Date(),
              remarks: remarks || "Processed"
            }
          });

          await tx.serviceBattery.update({
            where: { id: serviceBatteryId },
            data: {
              status: targetStatus,
              version: battery.version + 1
            }
          });

          await ServiceWorkflowEngine.logRepairAction(
            tx,
            serviceBatteryId,
            battery.status,
            targetStatus,
            approved ? "SCRAP_APPROVED" : "SCRAP_REJECTED",
            `Scrap request ${approved ? 'approved' : 'rejected'}. Remarks: ${remarks || ''}`,
            user.id
          );

          return { success: true };
        });

        return result;
      } catch (err: any) {
        const code = err.statusCode || 400;
        return reply.status(code).send({ error: err.message });
      }
    }
  );

  // POST /service/reopen - Reopen a delivered service battery
  fastify.post(
    "/reopen",
    { preHandler: [requireRoles("INVENTORY_MANAGER", "ADMIN", "SUPERADMIN")] },
    async (request, reply) => {
      const { serviceBatteryId, reason, warrantyCovered } = request.body as { serviceBatteryId: string, reason: string, warrantyCovered: boolean };
      const user = request.user as { id: string };

      try {
        const result = await prisma.$transaction(async (tx) => {
          const battery = await tx.serviceBattery.findUnique({ where: { id: serviceBatteryId } });
          if (!battery) throw new Error("Service battery not found");

          ServiceWorkflowEngine.validateTransition(battery.status, "REOPENED", ["INVENTORY_MANAGER"], battery.previousStatus);

          await tx.serviceReopenHistory.create({
            data: {
              serviceBatteryId,
              originalServiceId: battery.serviceId,
              reopenedBy: user.id,
              reason,
              warrantyCovered
            }
          });

          // Reset status to DIAGNOSIS_PENDING
          await tx.serviceBattery.update({
            where: { id: serviceBatteryId },
            data: {
              status: "DIAGNOSIS_PENDING",
              version: battery.version + 1
            }
          });

          await ServiceWorkflowEngine.logRepairAction(
            tx,
            serviceBatteryId,
            battery.status,
            "DIAGNOSIS_PENDING",
            "REOPENED",
            `Service reopened. Reason: ${reason}. Warranty covered: ${warrantyCovered}`,
            user.id
          );

          // Notify service team (technicians)
          await ServiceWorkflowEngine.triggerNotification(tx, "ASSEMBLY_TECHNICIAN", null, `Service reopened for battery ${battery.serviceId}`);

          return { success: true };
        });

        return result;
      } catch (err: any) {
        return reply.status(400).send({ error: err.message });
      }
    }
  );

  // POST /service/material-request - Create material request
  fastify.post(
    "/material-request",
    { preHandler: [requireRoles("ASSEMBLY_TECHNICIAN", "ADMIN", "SUPERADMIN")] },
    async (request, reply) => {
      const { serviceBatteryId, items } = request.body as { serviceBatteryId: string, items: { materialId: string, quantity: number }[] };
      const user = request.user as { id: string; roles: string[] };

      try {
        const result = await prisma.$transaction(async (tx) => {
          const battery = await tx.serviceBattery.findUnique({ where: { id: serviceBatteryId } });
          if (!battery) {
            throw new Error("Service battery not found");
          }

          // Validate transition from currentStatus to MATERIAL_REQUESTED
          ServiceWorkflowEngine.validateTransition(battery.status, "MATERIAL_REQUESTED", user.roles, battery.previousStatus);

          const req = await tx.serviceMaterialRequest.create({
            data: {
              serviceBatteryId,
              requestedBy: user.id,
              status: "PENDING",
              items: {
                create: items.map(item => ({
                  materialId: item.materialId,
                  quantity: item.quantity
                }))
              }
            }
          });

          // Update battery status to MATERIAL_REQUESTED
          await tx.serviceBattery.update({
            where: { id: serviceBatteryId },
            data: { 
              status: "MATERIAL_REQUESTED",
              version: battery.version + 1
            }
          });

          // Audit log & repair log
          await ServiceWorkflowEngine.logRepairAction(
            tx,
            serviceBatteryId,
            battery.status,
            "MATERIAL_REQUESTED",
            "MATERIAL_REQUESTED",
            `Requested materials: ${items.map(i => `${i.materialId} (Qty: ${i.quantity})`).join(", ")}`,
            user.id
          );

          // Notify Inventory Manager
          await ServiceWorkflowEngine.triggerNotification(tx, "INVENTORY_MANAGER", null, `Material requested for battery ${battery.serviceId}`);

          return req;
        });

        return result;
      } catch (err: any) {
        return reply.status(400).send({ error: err.message });
      }
    }
  );

  // GET /service/material-request - List requests
  fastify.get(
    "/material-request",
    { preHandler: [requireRoles("INVENTORY_MANAGER", "ADMIN", "SUPERADMIN")] },
    async (request) => {
      const requests = await prisma.serviceMaterialRequest.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          items: {
            include: {
              material: true
            }
          },
          serviceBattery: true
        }
      });
      return requests;
    }
  );

  // PATCH /service/material-request/:id - Approve/Reject/Issue
  fastify.patch(
    "/material-request/:id",
    { preHandler: [requireRoles("INVENTORY_MANAGER", "ADMIN", "SUPERADMIN")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { status } = request.body as { status: MaterialRequestStatus };
      const user = request.user as { id: string; roles: string[] };

      try {
        const result = await prisma.$transaction(async (tx) => {
          const req = await tx.serviceMaterialRequest.findUnique({
            where: { id },
            include: { items: true }
          });
          if (!req) {
            throw new Error("Material request not found");
          }

          // Lock parent ServiceBattery row first
          await tx.$executeRawUnsafe(
            `SELECT * FROM "ServiceBattery" WHERE id = $1 FOR UPDATE`,
            req.serviceBatteryId
          );

          const freshBattery = await tx.serviceBattery.findUnique({ where: { id: req.serviceBatteryId } });
          if (!freshBattery) {
            throw new Error("Service battery not found");
          }

          let batteryStatus = freshBattery.status;

          // Sort items by materialId deterministically to prevent deadlocks
          const sortedItems = [...req.items].sort((a, b) => a.materialId.localeCompare(b.materialId));

          if (status === "APPROVED") {
            // Validate transition to MATERIAL_APPROVED
            ServiceWorkflowEngine.validateTransition(batteryStatus, "MATERIAL_APPROVED", user.roles, freshBattery.previousStatus);

            // Reserve stock and verify availability
            for (const item of sortedItems) {
              // Lock the Material row
              await tx.$executeRawUnsafe(
                `SELECT * FROM "Material" WHERE id = $1 FOR UPDATE`,
                item.materialId
              );

              const material = await tx.material.findUnique({ where: { id: item.materialId } });
              if (!material) throw new Error(`Material not found: ${item.materialId}`);

              // Available stock = physical quantity - sum of other reservations in RESERVED status
              const reservedObj = await tx.inventoryReservation.aggregate({
                where: { materialId: item.materialId, status: "RESERVED" },
                _sum: { quantity: true }
              });
              const activeReserved = Number(reservedObj._sum.quantity || 0);
              const available = material.quantity - activeReserved;

              if (available < item.quantity) {
                throw new Error(`Insufficient available stock for ${material.name}. Available: ${available}, Requested: ${item.quantity}`);
              }

              // Create InventoryReservation record
              await tx.inventoryReservation.create({
                data: {
                  materialId: item.materialId,
                  quantity: item.quantity,
                  serviceBatteryId: req.serviceBatteryId,
                  status: "RESERVED"
                }
              });
            }

            // Update battery status
            await tx.serviceBattery.update({
              where: { id: req.serviceBatteryId },
              data: {
                status: "MATERIAL_APPROVED",
                version: freshBattery.version + 1
              }
            });

            await ServiceWorkflowEngine.logRepairAction(
              tx,
              req.serviceBatteryId,
              batteryStatus,
              "MATERIAL_APPROVED",
              "MATERIAL_APPROVED",
              "Material request approved. Inventory reserved.",
              user.id
            );

            // Notify Technician
            await ServiceWorkflowEngine.triggerNotification(tx, "ASSEMBLY_TECHNICIAN", null, `Materials approved for battery ${freshBattery.serviceId}`);

          } else if (status === "ISSUED") {
            // L-1 Guard: ISSUED is allowed only from APPROVED
            if (req.status !== "APPROVED") {
              throw new Error(`Material request must be APPROVED before it can be ISSUED (Current status: ${req.status})`);
            }

            // Validate transition to MATERIAL_ISSUED
            ServiceWorkflowEngine.validateTransition(batteryStatus, "MATERIAL_ISSUED", user.roles, freshBattery.previousStatus);

            // Move reservations to ISSUED and deduct physical inventory
            for (const item of sortedItems) {
              // Lock the Material row
              await tx.$executeRawUnsafe(
                `SELECT * FROM "Material" WHERE id = $1 FOR UPDATE`,
                item.materialId
              );

              const material = await tx.material.findUnique({ where: { id: item.materialId } });
              if (!material) throw new Error(`Material not found: ${item.materialId}`);
              
              if (material.quantity < item.quantity) {
                throw new Error(`Insufficient physical stock to issue ${material.name}`);
              }

              // Update Material physical stock
              await tx.material.update({
                where: { id: item.materialId },
                data: { quantity: material.quantity - item.quantity }
              });

              await tx.stockMovement.create({
                data: {
                  materialId: item.materialId,
                  quantity: -item.quantity,
                  movementType: "ISSUE",
                  source: "SERVICE_BATTERY_REPAIR",
                  referenceId: req.serviceBatteryId,
                  userId: user.id,
                  reason: `Issued materials for service battery repair: ${req.serviceBatteryId}`
                }
              });

              // Update InventoryReservation
              await tx.inventoryReservation.updateMany({
                where: {
                  serviceBatteryId: req.serviceBatteryId,
                  materialId: item.materialId,
                  status: "RESERVED"
                },
                data: {
                  status: "ISSUED",
                  issuedAt: new Date()
                }
              });

              // Save issued unit cost
              await tx.serviceMaterialItem.update({
                where: { id: item.id },
                data: { issuedUnitCost: material.unitPrice || 0 }
              });
            }

            // Update battery status to MATERIAL_ISSUED
            await tx.serviceBattery.update({
              where: { id: req.serviceBatteryId },
              data: {
                status: "MATERIAL_ISSUED",
                version: freshBattery.version + 1
              }
            });

            await ServiceWorkflowEngine.logRepairAction(
              tx,
              req.serviceBatteryId,
              batteryStatus,
              "MATERIAL_ISSUED",
              "MATERIAL_ISSUED",
              "Materials issued successfully.",
              user.id
            );

            // Auto-advance to REPAIR_IN_PROGRESS
            await tx.serviceBattery.update({
              where: { id: req.serviceBatteryId },
              data: {
                status: "REPAIR_IN_PROGRESS",
                version: freshBattery.version + 2
              }
            });

            await ServiceWorkflowEngine.logRepairAction(
              tx,
              req.serviceBatteryId,
              "MATERIAL_ISSUED",
              "REPAIR_IN_PROGRESS",
              "REPAIR_IN_PROGRESS",
              "Repair started automatically after material issue.",
              user.id
            );

          } else if (status === "REJECTED") {
            // Releasing active RESERVED reservations to RELEASED on rejection
            const activeReservations = await tx.inventoryReservation.findMany({
              where: {
                serviceBatteryId: req.serviceBatteryId,
                status: "RESERVED"
              }
            });

            if (activeReservations.length > 0) {
              await tx.inventoryReservation.updateMany({
                where: {
                  serviceBatteryId: req.serviceBatteryId,
                  status: "RESERVED"
                },
                data: {
                  status: "RELEASED",
                  releasedAt: new Date()
                }
              });

              for (const res of activeReservations) {
                await tx.auditLog.create({
                  data: {
                    entityType: "InventoryReservation",
                    entityId: res.id,
                    actorId: user.id,
                    action: "RELEASED_ON_REJECTION",
                    prevStatus: "RESERVED",
                    newStatus: "RELEASED",
                    metadata: { materialId: res.materialId, quantity: res.quantity }
                  }
                });
              }
            }

            await ServiceWorkflowEngine.logRepairAction(
              tx,
              req.serviceBatteryId,
              batteryStatus,
              batteryStatus,
              "MATERIAL_REQUEST_REJECTED",
              "Material request was rejected. Reserved inventory released.",
              user.id
            );
          }

          const updated = await tx.serviceMaterialRequest.update({
            where: { id },
            data: { status }
          });

          return updated;
        });

        return result;
      } catch (err: any) {
        return reply.status(400).send({ error: err.message });
      }
    }
  );

  // POST /service/test-report - Upload test report
  fastify.post(
    "/test-report",
    { preHandler: [requireRoles("PAX_TEST_ENGINEER", "ADMIN", "SUPERADMIN")] },
    async (request, reply) => {
      const { serviceBatteryId, voltageTest, loadTest, thermalTest, chargingTest, dischargeTest, finalObservation, status, reportUrl, images } = request.body as any;
      const user = request.user as { id: string; roles: string[] };

      try {
        const result = await prisma.$transaction(async (tx) => {
          const battery = await tx.serviceBattery.findUnique({ where: { id: serviceBatteryId } });
          if (!battery) {
            throw new Error("Service battery not found");
          }

          // Determine target status
          const targetStatus = status === "PASSED" ? "READY_FOR_DELIVERY" : "TEST_FAILED";

          // Validate transition
          ServiceWorkflowEngine.validateTransition(battery.status, targetStatus, user.roles, battery.previousStatus);

          const report = await tx.serviceTestReport.create({
            data: {
              serviceBatteryId,
              voltageTest,
              loadTest,
              thermalTest,
              chargingTest,
              dischargeTest,
              finalObservation,
              status,
              reportUrl,
              images: images || [],
              testedBy: user.id
            }
          });

          // Update battery status
          await tx.serviceBattery.update({
            where: { id: serviceBatteryId },
            data: { 
              status: targetStatus,
              version: battery.version + 1
            }
          });

          // Trigger cost calculation if status becomes READY_FOR_DELIVERY
          if (targetStatus === "READY_FOR_DELIVERY") {
            await ServiceWorkflowEngine.calculateServiceCost(tx, serviceBatteryId);
            
            // Notify Inventory Manager
            await ServiceWorkflowEngine.triggerNotification(tx, "INVENTORY_MANAGER", null, `Battery ${battery.serviceId} is ready for delivery`);
          }

          // Unified logging
          await ServiceWorkflowEngine.logRepairAction(
            tx,
            serviceBatteryId,
            battery.status,
            targetStatus,
            `TEST_${status}`,
            `QC Test result: ${status}. Remarks: ${finalObservation || ""}`,
            user.id
          );

          if (targetStatus === "TEST_FAILED") {
            // Notify Technician
            await ServiceWorkflowEngine.triggerNotification(tx, "ASSEMBLY_TECHNICIAN", null, `QC Test failed for battery ${battery.serviceId}`);
          }

          return report;
        });

        return result;
      } catch (err: any) {
        return reply.status(400).send({ error: err.message });
      }
    }
  );

  // POST /service/delivery - Mark as delivered
  fastify.post(
    "/delivery",
    { preHandler: [requireRoles("INVENTORY_MANAGER", "ADMIN", "SUPERADMIN")] },
    async (request, reply) => {
      const { serviceBatteryId, customerSignature, paymentStatus, warrantyUpdate, overrideReason } = request.body as any;
      const user = request.user as { id: string; roles: string[] };

      try {
        const result = await prisma.$transaction(async (tx) => {
          const battery = await tx.serviceBattery.findUnique({ where: { id: serviceBatteryId } });
          if (!battery) {
            throw new Error("Service battery not found");
          }

          // Validate transition (unless already delivered for idempotency)
          if (battery.status !== "DELIVERED") {
            ServiceWorkflowEngine.validateTransition(battery.status, "DELIVERED", user.roles, battery.previousStatus);
          }

          const isWarranty = battery.warrantyStatus && ["true", "warranty", "in_warranty"].includes(battery.warrantyStatus.toLowerCase());
          const isSuperAdmin = user.roles.includes("SUPERADMIN");

          // Check for outstanding service cost dues
          const cost = await tx.serviceCost.findUnique({
            where: { serviceBatteryId }
          });

          let finalOverrideBy: string | null = null;
          let finalOverrideReason: string | null = null;
          let finalOverrideDate: Date | null = null;

          if (cost && !isWarranty) {
            const total = Number(cost.totalCost);
            let paid = Number(cost.amountPaid);
            
            if (paymentStatus?.toUpperCase() === "PAID") {
              await tx.serviceCost.update({
                where: { serviceBatteryId },
                data: { amountPaid: total }
              });
              paid = total;
            }

            const due = total - paid;
            if (due > 0) {
              if (!isSuperAdmin) {
                // Trigger warning notification to Admin
                await ServiceWorkflowEngine.triggerNotification(tx, "ADMIN", null, `Delivery block: battery ${battery.serviceId} has unpaid dues of ₹${due}`);
                throw new Error(`Cannot complete delivery. Outstanding amount of ₹${due.toFixed(2)} is due.`);
              }

              // Superadmin override
              finalOverrideBy = user.id;
              finalOverrideReason = overrideReason || "Unjustified dues override";
              finalOverrideDate = new Date();

              await ServiceWorkflowEngine.logRepairAction(
                tx,
                serviceBatteryId,
                battery.status,
                "DELIVERED",
                "DELIVERY_OVERRIDE",
                `Superadmin override: Delivered with dues of ₹${due.toFixed(2)}. Reason: ${finalOverrideReason}`,
                user.id
              );
            }
          }

          const delivery = await tx.serviceDelivery.upsert({
            where: { serviceBatteryId },
            update: {
              customerSignature,
              paymentStatus,
              warrantyUpdate,
              deliveredBy: user.id,
              overrideBy: finalOverrideBy,
              overrideReason: finalOverrideReason,
              overrideDate: finalOverrideDate,
              deliveryDate: new Date()
            },
            create: {
              serviceBatteryId,
              customerSignature,
              paymentStatus,
              warrantyUpdate,
              deliveredBy: user.id,
              overrideBy: finalOverrideBy,
              overrideReason: finalOverrideReason,
              overrideDate: finalOverrideDate
            }
          });

          await tx.serviceBattery.update({
            where: { id: serviceBatteryId },
            data: { 
              status: "DELIVERED",
              version: battery.version + 1
            }
          });

          await ServiceWorkflowEngine.logRepairAction(
            tx,
            serviceBatteryId,
            battery.status,
            "DELIVERED",
            "DELIVERY_DELIVERED",
            "Battery delivered to customer",
            user.id
          );

          return delivery;
        });

        return result;
      } catch (err: any) {
        return reply.status(400).send({ error: err.message });
      }
    }
  );

  // POST /service/cost - Create service cost (restricted to SUPERADMIN)
  fastify.post(
    "/cost",
    { preHandler: [requireRoles("SUPERADMIN")] },
    async (request, reply) => {
      const { serviceBatteryId, serviceType, materialCost, labourCost, marginPercentage, marginAmount, totalCost, amountPaid, notes } = request.body as any;
      const user = request.user as { id: string };

      try {
        const result = await prisma.$transaction(async (tx) => {
          // Lock ServiceBattery
          await tx.$executeRawUnsafe(
            `SELECT * FROM "ServiceBattery" WHERE id = $1 FOR UPDATE`,
            serviceBatteryId
          );

          const battery = await tx.serviceBattery.findUnique({ where: { id: serviceBatteryId } });
          if (!battery) {
            const err = new Error("Service battery not found");
            (err as any).statusCode = 404;
            throw err;
          }

          const matC = Number(materialCost || 0);
          const labC = Number(labourCost || 0);
          const margP = Number(marginPercentage || 0);
          const margA = Number(marginAmount || 0);
          const paid = Number(amountPaid || 0);
          const total = Number(totalCost || (matC + labC + margA));

          const existing = await tx.serviceCost.findUnique({ where: { serviceBatteryId } });
          if (existing) {
            const err = new Error("Service cost already exists for this battery");
            (err as any).statusCode = 400;
            throw err;
          }

          const cost = await tx.serviceCost.create({
            data: {
              serviceBatteryId,
              serviceType: serviceType?.trim() || "Custom Repair",
              materialCost: matC,
              labourCost: labC,
              marginPercentage: margP,
              marginAmount: margA,
              totalCost: total,
              amountPaid: paid,
              notes,
              generatedBySystem: false
            }
          });

          // Audit log and ServiceRepairLog inside transaction
          await tx.serviceRepairLog.create({
            data: {
              serviceBatteryId,
              action: "COST_CREATED",
              notes: `Created manually: ₹${total}`,
              technicianId: user.id
            }
          });

          await tx.auditLog.create({
            data: {
              entityType: "ServiceCost",
              entityId: cost.id,
              actorId: user.id,
              action: "COST_CREATED",
              prevStatus: "NONE",
              newStatus: `Total: ₹${total}`,
              metadata: { totalCost: total, serviceType }
            }
          });

          return cost;
        });

        return result;
      } catch (err: any) {
        const code = err.statusCode || 400;
        return reply.status(code).send({ error: err.message || "Cost creation failed" });
      }
    }
  );

  // GET /service/cost/:serviceBatteryId - Get service cost
  fastify.get(
    "/cost/:serviceBatteryId",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { serviceBatteryId } = request.params as { serviceBatteryId: string };
      const cost = await prisma.serviceCost.findUnique({
        where: { serviceBatteryId }
      });
      if (!cost) return reply.status(404).send({ error: "Service cost not found" });
      return cost;
    }
  );

  // PATCH /service/cost/:id - Override service cost (SUPERADMIN only)
  fastify.patch(
    "/cost/:id",
    { preHandler: [requireRoles("SUPERADMIN")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { materialCost, labourCost, marginPercentage, marginAmount, totalCost, amountPaid, notes, overrideReason } = request.body as any;
      const user = request.user as { id: string };

      try {
        const result = await prisma.$transaction(async (tx) => {
          // Lock ServiceCost row
          await tx.$executeRawUnsafe(
            `SELECT * FROM "ServiceCost" WHERE id = $1 FOR UPDATE`,
            id
          );

          const existing = await tx.serviceCost.findUnique({ where: { id } });
          if (!existing) {
            const err = new Error("Service cost not found");
            (err as any).statusCode = 404;
            throw err;
          }

          const matC = materialCost !== undefined ? Number(materialCost) : Number(existing.materialCost);
          const labC = labourCost !== undefined ? Number(labourCost) : Number(existing.labourCost);
          const margP = marginPercentage !== undefined ? Number(marginPercentage) : Number(existing.marginPercentage);
          const margA = marginAmount !== undefined ? Number(marginAmount) : Number(existing.marginAmount);
          const paid = amountPaid !== undefined ? Number(amountPaid) : Number(existing.amountPaid);
          const total = totalCost !== undefined ? Number(totalCost) : (matC + labC + margA);

          const updated = await tx.serviceCost.update({
            where: { id },
            data: {
              materialCost: matC,
              labourCost: labC,
              marginPercentage: margP,
              marginAmount: margA,
              totalCost: total,
              amountPaid: paid,
              notes,
              generatedBySystem: false,
              overrideReason,
              overrideById: user.id,
              overrideAt: new Date(),
              overrideBy: user.id,
              overrideDate: new Date(),
              oldMaterialCost: existing.materialCost,
              oldLabourCost: existing.labourCost,
              oldMargin: existing.marginPercentage,
              oldInvoiceAmount: existing.totalCost,
              newInvoiceAmount: total
            }
          });

          // Audit log and ServiceRepairLog
          await tx.serviceRepairLog.create({
            data: {
              serviceBatteryId: existing.serviceBatteryId,
              action: "COST_OVERRIDDEN",
              notes: `Override Applied - Reason: ${overrideReason || "N/A"}. Material: ₹${matC}, Labour: ₹${labC}, Margin: ${margP}%, Total: ₹${total}`,
              technicianId: user.id
            }
          });

          await tx.auditLog.create({
            data: {
              entityType: "ServiceCost",
              entityId: id,
              actorId: user.id,
              action: "Override Applied",
              prevStatus: `Total: ₹${existing.totalCost}`,
              newStatus: `Total: ₹${total}`,
              metadata: { overrideReason, totalCost: total }
            }
          });

          return updated;
        });

        return result;
      } catch (err: any) {
        const code = err.statusCode || 400;
        return reply.status(code).send({ error: err.message || "Cost override failed" });
      }
    }
  );

  // POST /service/pricing-master - Create pricing master rule
  fastify.post(
    "/pricing-master",
    { preHandler: [requireRoles("ADMIN", "SUPERADMIN")] },
    async (request, reply) => {
      const { serviceType, labourCost, marginPercentage, description } = request.body as any;
      const user = request.user as { id: string };

      const trimmedServiceType = serviceType?.trim();
      if (!trimmedServiceType) {
        return reply.status(400).send({ error: "Service type is required" });
      }

      const existing = await prisma.servicePricingMaster.findUnique({
        where: { serviceType: trimmedServiceType }
      });
      if (existing) {
        return reply.status(400).send({ error: "Pricing rule for this service type already exists" });
      }

      const rule = await prisma.servicePricingMaster.create({
        data: {
          serviceType: trimmedServiceType,
          labourCost: Number(labourCost || 0),
          marginPercentage: Number(marginPercentage || 0),
          description: description?.trim() || null
        }
      });

      await prisma.auditLog.create({
        data: {
          entityType: "ServicePricingMaster",
          entityId: rule.id,
          actorId: user.id,
          action: "Pricing Rule Created",
          newStatus: "ACTIVE",
          metadata: { serviceType: trimmedServiceType, labourCost, marginPercentage }
        }
      });

      return rule;
    }
  );

  // GET /service/pricing-master - Get all pricing master rules
  fastify.get(
    "/pricing-master",
    { preHandler: [fastify.authenticate] },
    async (request) => {
      const rules = await prisma.servicePricingMaster.findMany({
        orderBy: { serviceType: "asc" }
      });
      return rules;
    }
  );

  // PATCH /service/pricing-master/:id - Update pricing master rule
  fastify.patch(
    "/pricing-master/:id",
    { preHandler: [requireRoles("ADMIN", "SUPERADMIN")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { labourCost, marginPercentage, description, isActive } = request.body as any;
      const user = request.user as { id: string };

      const existing = await prisma.servicePricingMaster.findUnique({
        where: { id }
      });
      if (!existing) {
        return reply.status(404).send({ error: "Pricing rule not found" });
      }

      const rule = await prisma.servicePricingMaster.update({
        where: { id },
        data: {
          labourCost: labourCost !== undefined ? Number(labourCost) : undefined,
          marginPercentage: marginPercentage !== undefined ? Number(marginPercentage) : undefined,
          description,
          isActive: isActive !== undefined ? isActive : undefined
        }
      });

      await prisma.auditLog.create({
        data: {
          entityType: "ServicePricingMaster",
          entityId: id,
          actorId: user.id,
          action: "Pricing Rule Updated",
          prevStatus: `Labour: ₹${existing.labourCost}, Margin: ${existing.marginPercentage}%`,
          newStatus: `Labour: ₹${rule.labourCost}, Margin: ${rule.marginPercentage}%`,
          metadata: { labourCost, marginPercentage, isActive }
        }
      });

      return rule;
    }
  );

  // GET /service/notifications - Get all user/role notifications
  fastify.get(
    "/notifications",
    { preHandler: [fastify.authenticate] },
    async (request) => {
      const user = request.user as { id: string; roles: string[] };
      const notifications = await prisma.notification.findMany({
        where: {
          OR: [
            { userId: user.id },
            { role: { in: user.roles as any } }
          ]
        },
        orderBy: { createdAt: "desc" }
      });
      return notifications;
    }
  );

  // GET /service/battery/:id/timeline - Chronological audit timeline
  fastify.get(
    "/battery/:id/timeline",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      
      const battery = await prisma.serviceBattery.findUnique({
        where: { id },
        include: {
          repairLogs: true
        }
      });

      if (!battery) {
        return reply.status(404).send({ error: "Service battery not found" });
      }

      const repairLogs = battery.repairLogs;
      
      const auditLogs = await prisma.auditLog.findMany({
        where: {
          entityType: "ServiceBattery",
          entityId: id
        }
      });

      // Fetch user mappings for names
      const users = await prisma.user.findMany({
        select: { id: true, name: true }
      });
      const userMap = new Map(users.map(u => [u.id, u.name]));

      const timeline: any[] = [];

      // Process repairLogs
      for (const log of repairLogs) {
        let oldStatus: string | null = null;
        let newStatus: string | null = null;
        let remarks: string | null = null;
        let performedBy: string = log.technicianId;

        try {
          const parsed = JSON.parse(log.notes || "{}");
          oldStatus = parsed.oldStatus;
          newStatus = parsed.newStatus;
          remarks = parsed.remarks;
          if (parsed.performedBy) performedBy = parsed.performedBy;
        } catch {
          remarks = log.notes;
        }

        timeline.push({
          id: log.id,
          timestamp: log.timestamp,
          action: log.action,
          userName: userMap.get(performedBy) || performedBy,
          remarks: remarks || "",
          prevStatus: oldStatus || "",
          newStatus: newStatus || ""
        });
      }

      // Process auditLogs
      for (const log of auditLogs) {
        // Skip duplicate records of status changes already in repairLogs
        if (timeline.some(t => t.action === log.action && Math.abs(new Date(t.timestamp).getTime() - new Date(log.timestamp).getTime()) < 1000)) {
          continue;
        }

        let remarks = "";
        try {
          remarks = (log.metadata as any)?.remarks || "";
        } catch {}

        timeline.push({
          id: log.id,
          timestamp: log.timestamp,
          action: log.action,
          userName: userMap.get(log.actorId) || log.actorId,
          remarks: remarks,
          prevStatus: log.prevStatus || "",
          newStatus: log.newStatus || ""
        });
      }

      // Sort chronological ascending
      timeline.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      return timeline;
    }
  );
}
