import { FastifyInstance } from "fastify";
import { prisma } from "../prisma";
import { requireRoles } from "../middleware/rbac";
import { wsManager } from "../websocket/manager";
import { SupervisorApproveSchema, PaxCreateSchema } from "../schemas/zod.schemas";
import fs from "fs";
import { disassemblePaxPack } from "../services/disassembly.service";
import { StorageService } from "../services/storage.service";
import path from "path";
import { pipeline } from "stream";
import { promisify } from "util";

const pump = promisify(pipeline);

export async function paxRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/recommendations",
    { preHandler: [requireRoles("ASSEMBLY_TECHNICIAN", "ADMIN", "SUPERADMIN")] },
    async (request) => {
      const { paxTypeId, ahVariation, irVariation } = request.query as any;
      if (!paxTypeId) return { error: "paxTypeId is required" };

      const paxType = await prisma.paxType.findUnique({ where: { id: paxTypeId } });
      if (!paxType) return { error: "PaxType not found" };

      // Use values from config if not provided in query
      const finalAhVar = ahVariation ? parseFloat(ahVariation) : paxType.maxAhDifference;
      const finalIrVar = irVariation ? parseFloat(irVariation) : paxType.maxIrDifference;

      const cells = await prisma.cell.findMany({
        where: { 
          status: "CELL_TESTED",
          qcDecisionHistory: { has: "QC_APPROVED" },
          grade: { in: paxType.allowedGrades },
          paxCell: null,
          OR: [
            { reservedForPaxTypeId: null },
            { reservedForPaxTypeId: paxTypeId }
          ]
        },
        select: {
          serialNumber: true,
          ahValue: true,
          irValue: true,
          grade: true,
          voltage: true,
          category: true,
          batchNumber: true
        }
      });

      const { recommendPaxGroups } = require("../services/sidecar.service");
      const recommendations = await recommendPaxGroups(
        cells, 
        paxType.cellCount, 
        finalAhVar, 
        finalIrVar
      );

      return recommendations;
    }
  );

  // GET /pax/assembly-dashboard - Assembly Technician dedicated workspace KPIs and assigned jobs
  fastify.get(
    "/assembly-dashboard",
    { preHandler: [requireRoles("ASSEMBLY_TECHNICIAN", "SUPERVISOR", "ADMIN", "SUPERADMIN")] },
    async (request) => {
      const user = request.user as { id: string };

      // 1. Fetch Work Orders assigned to the user or available for assembly (status: READY, IN_PROGRESS, QC_PENDING)
      const assignedWorkOrders = await prisma.workOrder.findMany({
        where: {
          status: { in: ["READY", "IN_PROGRESS", "QC_PENDING", "COMPLETED"] },
          OR: [
            { operators: { some: { userId: user.id, status: "ACTIVE" } } },
            { operators: { none: {} } }
          ]
        },
        include: {
          bom: true,
          operators: { include: { user: { select: { id: true, name: true } } } },
          scheduling: true,
          packs: {
            include: {
              paxType: true,
              cells: true
            }
          }
        },
        orderBy: { createdAt: "desc" },
        take: 30
      });

      // Fetch user's current station assignment
      const activeStation = await prisma.stationOperatorAssignment.findFirst({
        where: { operatorId: user.id, releasedAt: null },
        include: { station: true }
      });

      // Today's date range
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      // Counts
      const [totalAssignedPacks, readyForAssembly, inAssembly, awaitingQc, completedToday] = await Promise.all([
        prisma.paxPack.count(),
        prisma.workOrder.count({ where: { status: "READY" } }),
        prisma.workOrder.count({ where: { status: "IN_PROGRESS" } }),
        prisma.paxPack.count({ where: { status: { in: ["PAX_ASSEMBLED", "READY_FOR_PAX_TEST"] } } }),
        prisma.paxPack.count({ 
          where: { 
            status: { in: ["PAX_ASSEMBLED", "READY_FOR_PAX_TEST", "PAX_TESTED", "READY_FOR_SALE"] },
            assembledAt: { gte: todayStart }
          }
        })
      ]);

      // Map assigned jobs
      const paxTypes = await prisma.paxType.findMany({ where: { isProductionActive: true } });

      const queue = assignedWorkOrders.map(wo => {
        const productRefStr = wo.productRef || "";
        const matchingPaxType = paxTypes.find(pt => pt.name.toLowerCase().includes(productRefStr.toLowerCase())) || paxTypes[0];
        const reqCells = matchingPaxType ? matchingPaxType.cellCount : 16;
        const progressPct = wo.plannedQuantity > 0 ? Math.round((wo.completedQuantity / wo.plannedQuantity) * 100) : 0;

        return {
          id: wo.id,
          workOrderNumber: wo.workOrderNumber,
          productRef: productRefStr || "Standard Battery Pack",
          paxTypeName: matchingPaxType?.name || "Standard LFP 16S",
          paxTypeId: matchingPaxType?.id || null,
          requiredCellCount: reqCells,
          cellsMatched: reqCells,
          cellsBound: Math.min(reqCells, wo.completedQuantity * reqCells),
          plannedQuantity: wo.plannedQuantity,
          completedQuantity: wo.completedQuantity,
          status: wo.status === "READY" ? "READY FOR ASSEMBLY" : wo.status === "IN_PROGRESS" ? "IN ASSEMBLY" : wo.status === "QC_PENDING" ? "AWAITING QC" : wo.status,
          rawStatus: wo.status,
          station: activeStation?.station?.name || "STN-ASY-01",
          stationCode: activeStation?.station?.code || "ASY-01",
          priority: "NORMAL",
          dueDate: wo.dueDate,
          progressPct
        };
      });

      return {
        kpis: {
          assignedPacks: assignedWorkOrders.reduce((acc, wo) => acc + wo.plannedQuantity, 0),
          readyForAssembly,
          inAssembly: assignedWorkOrders.filter(wo => wo.status === "IN_PROGRESS").length,
          awaitingQc,
          completedToday
        },
        currentStation: activeStation?.station || null,
        queue
      };
    }
  );

  // GET /pax - List PAX Packs
  fastify.get(
    "/",
    { preHandler: [fastify.authenticate] },
    async (request) => {
      const { status, page = 1, limit = 50, search } = request.query as any;
      const skip = (Number(page) - 1) * Number(limit);

      const where: any = {};
      if (status && status !== "" && status !== "ALL") {
        if (typeof status === "string" && status.includes(",")) {
          where.status = { in: status.split(",").map((s: string) => s.trim()) };
        } else if (Array.isArray(status)) {
          where.status = { in: status };
        } else {
          where.status = status;
        }
      }

      if (search && typeof search === "string" && search.trim() !== "") {
        const cleanSearch = search.trim();
        where.OR = [
          { paxSerial: { contains: cleanSearch, mode: "insensitive" } },
          { paxType: { name: { contains: cleanSearch, mode: "insensitive" } } },
          { workOrder: { workOrderNumber: { contains: cleanSearch, mode: "insensitive" } } },
          { cells: { some: { cellSerial: { contains: cleanSearch, mode: "insensitive" } } } }
        ];
      }

      const [packs, total] = await Promise.all([
        prisma.paxPack.findMany({
          where,
          skip,
          take: Number(limit),
          orderBy: { assembledAt: "desc" },
          include: { 
            paxType: true,
            bom: { include: { items: { include: { material: true } } } },
            cells: {
              include: { cell: true },
              orderBy: { position: "asc" }
            },
            workOrder: true,
            assembledAtStation: true
          }
        }),
        prisma.paxPack.count({ where }),
      ]);

      return { packs, total, page: Number(page), limit: Number(limit) };
    }
  );

  // GET /pax/:serial - Get single PAX Pack with cells, BOM, workOrder, inspections, defects, and audit timeline
  fastify.get(
    "/:serial",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { serial } = request.params as { serial: string };

      const [pack, auditLogs] = await Promise.all([
        prisma.paxPack.findUnique({
          where: { paxSerial: serial },
          include: {
            paxType: {
              include: {
                bom: { include: { items: { include: { material: true } } } }
              }
            },
            bom: { include: { items: { include: { material: true } } } },
            cells: {
              include: { cell: true },
              orderBy: { position: "asc" }
            },
            workOrder: {
              include: {
                scheduling: true,
                bom: { include: { items: { include: { material: true } } } }
              }
            },
            defects: true,
            inspections: {
              include: {
                inspector: {
                  select: { id: true, name: true, email: true }
                }
              },
              orderBy: { createdAt: "desc" }
            },
            repairs: true,
            assembledAtStation: true
          }
        }),
        prisma.auditLog.findMany({
          where: { entityType: "pax", entityId: serial },
          include: {
            actor: { select: { id: true, name: true, email: true } }
          },
          orderBy: { timestamp: "desc" }
        })
      ]);

      if (!pack) {
        return reply.status(404).send({ error: `PAX Pack ${serial} not found` });
      }

      return { ...pack, auditLogs };
    }
  );

  // POST /pax/:serial/reprint-audit - Record label reprint event
  fastify.post(
    "/:serial/reprint-audit",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { serial: paxSerial } = request.params as { serial: string };
      const user = request.user as { id: string };

      const pack = await prisma.paxPack.findUnique({ where: { paxSerial } });
      if (!pack) {
        return reply.status(404).send({ error: `PAX Pack ${paxSerial} not found` });
      }

      await prisma.auditLog.create({
        data: {
          entityType: "pax",
          entityId: paxSerial,
          actorId: user.id,
          action: "LABEL_REPRINTED",
          prevStatus: pack.status,
          newStatus: pack.status,
          metadata: {
            source: "BATTERY_PACK_REGISTER",
            timestamp: new Date().toISOString()
          }
        }
      });

      return { success: true, message: "Reprint audit logged" };
    }
  );

  // POST /pax - Create PAX
  fastify.post(
    "/",
    { preHandler: [requireRoles("ASSEMBLY_TECHNICIAN", "ADMIN", "SUPERADMIN")] },
    async (request, reply) => {
      const { paxTypeId, cellSerials, workOrderId } = PaxCreateSchema.parse(request.body);
      const user = request.user as { id: string };

      const paxType = await prisma.paxType.findUnique({ where: { id: paxTypeId } });
      if (!paxType) return reply.status(404).send({ error: "PaxType not found" });

      if (cellSerials.length !== paxType.cellCount) {
        return reply.status(400).send({ error: `Requires exactly ${paxType.cellCount} cells` });
      }

      // Check cell validity
      const cells = await prisma.cell.findMany({
        where: { serialNumber: { in: cellSerials } },
        include: { paxCell: true }
      });

      if (cells.length !== cellSerials.length) {
        return reply.status(400).send({ error: "One or more cells not found" });
      }

      // Check if any cell is already in a paxCell
      const alreadyAssigned = cells.filter(c => c.paxCell);
      if (alreadyAssigned.length > 0) {
        return reply.status(400).send({
          error: `Cell(s) already assembled into a pack: ${alreadyAssigned.map(c => c.serialNumber).join(", ")}`
        });
      }

      const ahValues: number[] = [];
      const irValues: number[] = [];
      const grades: string[] = [];
      const batches: string[] = [];

      for (const cell of cells) {
        if (cell.status !== "CELL_TESTED") {
          return reply.status(400).send({ error: `Cell ${cell.serialNumber} is not TESTED (Status: ${cell.status})` });
        }
        if (!cell.qcDecisionHistory || !cell.qcDecisionHistory.includes("QC_APPROVED")) {
          return reply.status(400).send({ 
            error: `QC Approval Required: Cell ${cell.serialNumber} is pending QC approval. Cells cannot be assembled into a PAX pack without QC approval.` 
          });
        }
        if (cell.reservedForPaxTypeId && cell.reservedForPaxTypeId !== paxTypeId) {
          return reply.status(400).send({ error: `Cell ${cell.serialNumber} is reserved for a different PAX Type` });
        }

        if (cell.ahValue !== null && cell.ahValue !== undefined) ahValues.push(cell.ahValue);
        if (cell.irValue !== null && cell.irValue !== undefined) irValues.push(cell.irValue);
        if (cell.grade) grades.push(cell.grade);
        if (cell.batchNumber) batches.push(cell.batchNumber);
      }

      // 8. AUTO-PACK SAFETY CONSTRAINTS & MANUAL VALIDATION
      
      // A. Enforce Same Grade Grouping
      const uniqueGrades = Array.from(new Set(grades));
      if (uniqueGrades.length > 1) {
        return reply.status(400).send({ 
          error: `Grade Mix Detected: All cells must belong to the same quality grade. Found: ${uniqueGrades.join(", ")}` 
        });
      }

      // B. Enforce Allowed Grades for Model
      if (grades.length > 0 && !paxType.allowedGrades.includes(grades[0])) {
        return reply.status(400).send({ 
          error: `Grade Violation: Grade "${grades[0]}" is not authorized for PAX Model ${paxType.name}` 
        });
      }

      // C. Enforce Same Production Batch
      const uniqueBatches = Array.from(new Set(batches));
      if (uniqueBatches.length > 1) {
        return reply.status(400).send({ 
          error: `Batch Mix Detected: Cells must belong to the exact same production batch to prevent chemical impedance unbalances.` 
        });
      }

      // D. Enforce Capacity (AH) Delta limits
      if (ahValues.length > 0) {
        const maxAh = Math.max(...ahValues);
        const minAh = Math.min(...ahValues);
        const ahDelta = maxAh - minAh;
        if (ahDelta > paxType.maxAhDifference) {
          return reply.status(400).send({ 
            error: `Safety Fail: Capacity delta (ΔAH = ${ahDelta.toFixed(3)}) exceeds max permitted variation (${paxType.maxAhDifference})` 
          });
        }
      }

      // E. Enforce Internal Resistance (IR) Delta limits
      if (irValues.length > 0) {
        const maxIr = Math.max(...irValues);
        const minIr = Math.min(...irValues);
        const irDelta = maxIr - minIr;
        if (irDelta > paxType.maxIrDifference) {
          return reply.status(400).send({ 
            error: `Safety Fail: Resistance delta (ΔIR = ${irDelta.toFixed(1)} mΩ) exceeds max permitted variation (${paxType.maxIrDifference} mΩ)` 
          });
        }
      }

      // Verify work order if linked
      let targetWO: any = null;
      const cleanWorkOrderId = workOrderId?.trim() || null;
      if (cleanWorkOrderId) {
        targetWO = await prisma.workOrder.findUnique({ where: { id: cleanWorkOrderId } });
        if (!targetWO) {
          return reply.status(400).send({ error: "Linked Work Order not found" });
        }
        if (!["READY", "IN_PROGRESS"].includes(targetWO.status)) {
          return reply.status(400).send({ error: "Cannot start production for Work Order. Status must be READY or IN_PROGRESS." });
        }
      }

      const paxSerial = `PAX-${Date.now()}`;

      await prisma.$transaction(async (tx) => {
        // Query operator's active station check-in
        const activeAssignment = await tx.stationOperatorAssignment.findFirst({
          where: { operatorId: user.id, releasedAt: null }
        });
        const assembledAtStationId = activeAssignment?.stationId || null;

        const pax = await tx.paxPack.create({
          data: {
            paxSerial,
            paxTypeId,
            status: "READY_FOR_PAX_TEST",
            workOrderId: cleanWorkOrderId,
            assembledAtStationId
          }
        });

        await tx.paxCell.createMany({
          data: cellSerials.map((s, i) => ({
            paxSerial,
            cellSerial: s,
            position: i + 1
          }))
        });

        // Update cells to show they are in a PAX (status isn't explicitly changed in model, 
        // but PaxCell presence defines it. However, we should clear reservation)
        await tx.cell.updateMany({
          where: { serialNumber: { in: cellSerials } },
          data: { reservedForPaxTypeId: null }
        });

        // Update Work Order progress if linked
        if (cleanWorkOrderId && targetWO) {
          const updatedCompleted = targetWO.completedQuantity + 1;
          const remaining = Math.max(0, targetWO.plannedQuantity - updatedCompleted - targetWO.rejectedQuantity);
          const nextWOStatus = remaining === 0 ? "QC_PENDING" : "IN_PROGRESS";

          await tx.workOrder.update({
            where: { id: cleanWorkOrderId },
            data: {
              completedQuantity: updatedCompleted,
              remainingQuantity: remaining,
              status: nextWOStatus
            }
          });
        }

        await tx.auditLog.create({
          data: {
            entityType: "pax",
            entityId: paxSerial,
            actorId: user.id,
            action: "assembled",
            newStatus: "READY_FOR_PAX_TEST",
            metadata: cleanWorkOrderId ? { workOrderId: cleanWorkOrderId } : { notes: "Assembled manually without work order" }
          }
        });
      });

      await wsManager.broadcast("pax:status_change", { paxSerial, status: "READY_FOR_PAX_TEST" });
      return { paxSerial, status: "READY_FOR_PAX_TEST" };
    }
  );

  // POST /pax/:serial/approve
  fastify.post(
    "/:serial/approve",
    { preHandler: [requireRoles("SUPERVISOR", "ADMIN", "SUPERADMIN")] },
    async (request, reply) => {
      const { serial: paxSerial } = request.params as { serial: string };
      const { action, reason, reclaimedMaterials } = SupervisorApproveSchema.parse(request.body);
      const user = request.user as { id: string };

      try {
        const result = await prisma.$transaction(async (tx) => {
          // Lock the PaxPack row
          await tx.$executeRawUnsafe(
            `SELECT * FROM "PaxPack" WHERE "paxSerial" = $1 FOR UPDATE`,
            paxSerial
          );

          const pax = await tx.paxPack.findUnique({ where: { paxSerial } });
          if (!pax) throw new Error("PAX not found");

          if (pax.status !== "PAX_TESTED") {
            throw new Error(`Cannot ${action} Pax Pack. Status must be PAX_TESTED (Current: ${pax.status})`);
          }

          if (action === "approve") {
            await tx.paxPack.update({
              where: { paxSerial },
              data: {
                status: "READY_FOR_SALE",
                approvedBy: user.id,
                approvedAt: new Date(),
              }
            });

            await tx.auditLog.create({
              data: {
                entityType: "pax",
                entityId: paxSerial,
                actorId: user.id,
                action: "pax_approved",
                prevStatus: pax.status,
                newStatus: "READY_FOR_SALE",
                metadata: { reason }
              }
            });

            return { success: true, status: "READY_FOR_SALE" };
          } else {
            await disassemblePaxPack(tx, paxSerial, reclaimedMaterials || [], user.id, reason || "");
            return { success: true, status: "SCRAPPED" };
          }
        });

        if (action === "approve") {
          await wsManager.broadcast("pax:status_change", { paxSerial, status: "READY_FOR_SALE" });
        } else {
          await wsManager.broadcast("pax:disassembled", { paxSerial, cellsReturned: "all" });
        }

        return result;
      } catch (err: any) {
        return reply.status(400).send({ error: err.message || "Failed to approve or reject Pax Pack" });
      }
    }
  );

  // POST /pax/:serial/test-result - PAX Test Engineer uploads local report
  fastify.post(
    "/:serial/test-result",
    { preHandler: [requireRoles("PAX_TEST_ENGINEER", "ADMIN", "SUPERADMIN")] },
    async (request, reply) => {
      const { serial: paxSerial } = request.params as { serial: string };
      const user = request.user as { id: string };

      const data = await (request as any).file();
      if (!data) return reply.status(400).send({ error: "No report file selected" });

      // Upload report using StorageService (stores in uploads folder, extensible to S3)
      const uploadResult = await StorageService.uploadTestReport(
        data.file,
        data.filename,
        paxSerial,
        data.mimetype
      );

      // Get fields from multipart
      const statusField = (data.fields.status as any)?.value;
      const status = (statusField === "UNDER_REPAIR") ? "UNDER_REPAIR" : "PAX_TESTED";
      const testReportUrl = uploadResult.url;

      try {
        const pax = await prisma.$transaction(async (tx) => {
          // Lock PaxPack FOR UPDATE
          await tx.$executeRawUnsafe(
            `SELECT * FROM "PaxPack" WHERE "paxSerial" = $1 FOR UPDATE`,
            paxSerial
          );

          const currentPax = await tx.paxPack.findUnique({ where: { paxSerial } });
          if (!currentPax) throw new Error("PAX not found");

          // Reject if SOLD_TO_CUSTOMER, SOLD_TO_VENDOR, or SCRAPPED
          if (["SOLD_TO_CUSTOMER", "SOLD_TO_VENDOR", "SCRAPPED"].includes(currentPax.status)) {
            throw new Error(`Cannot upload test result for a pack that is ${currentPax.status}.`);
          }

          const updatedPax = await tx.paxPack.update({
            where: { paxSerial },
            data: {
              status,
              testReportUrl,
            }
          });

          await tx.auditLog.create({
            data: {
              entityType: "pax",
              entityId: paxSerial,
              actorId: user.id,
              action: uploadResult.storageDriver === "s3" ? "TEST_REPORT_UPLOADED_S3" : "TEST_REPORT_UPLOADED_LOCAL",
              prevStatus: currentPax.status,
              newStatus: status,
              metadata: {
                fileName: uploadResult.fileName,
                originalName: data.filename,
                storageDriver: uploadResult.storageDriver,
                url: testReportUrl
              }
            }
          });

          return updatedPax;
        });

        await wsManager.broadcast("pax:status_change", { paxSerial, status });
        return pax;
      } catch (err: any) {
        return reply.status(400).send({ error: err.message || "Failed to save test report" });
      }
    }
  );
  // POST /pax/:serial/label - Assign BOM and move to READY_FOR_PAX_TEST
  fastify.post(
    "/:serial/label",
    { preHandler: [requireRoles("ASSEMBLY_TECHNICIAN", "ADMIN", "SUPERADMIN")] },
    async (request, reply) => {
      const { serial: paxSerial } = request.params as { serial: string };
      const { bomId } = request.body as { bomId: string };
      const user = request.user as { id: string };

      // Fetch BOM items
      const bomItems = await prisma.bOMItem.findMany({
        where: { bomId },
        include: { material: true }
      });

      if (bomItems.length === 0) {
        return reply.status(400).send({ error: "No materials configured for the selected BOM" });
      }

      try {
        const result = await prisma.$transaction(async (tx) => {
          // Lock PaxPack row first (deterministic order!)
          await tx.$executeRawUnsafe(
            `SELECT * FROM "PaxPack" WHERE "paxSerial" = $1 FOR UPDATE`,
            paxSerial
          );

          const pax = await tx.paxPack.findUnique({ 
            where: { paxSerial },
            include: { paxType: true, workOrder: true }
          });

          if (!pax) throw new Error("PAX not found");

          // Require exactly PAX_ASSEMBLED
          if (pax.status !== "PAX_ASSEMBLED") {
            throw new Error(`Cannot label Pax Pack. Status must be PAX_ASSEMBLED (Current: ${pax.status})`);
          }

          // Generate structured QR
          const qrData = `KYRA ZAM | SERIAL: ${paxSerial} | MODEL: ${pax.paxType.name} | DATE: ${pax.assembledAt.toLocaleDateString()}`;
          const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrData)}`;

          // Sort items by materialId deterministically to prevent deadlocks under concurrent transactions
          const sortedItems = [...bomItems].sort((a, b) => a.materialId.localeCompare(b.materialId));

          for (const item of sortedItems) {
            // Lock the material row for update
            await tx.$executeRawUnsafe(
              `SELECT * FROM "Material" WHERE id = $1 FOR UPDATE`,
              item.materialId
            );

            const needed = item.quantity; // 1 PAX pack consumes 1 unit of BOM item multiplier
            
            // Get fresh stock count inside transaction
            const freshMat = await tx.material.findUnique({ where: { id: item.materialId } });
            if (!freshMat) throw new Error("Material not found");
            const currentStock = freshMat.quantity;

            // Reserve check
            const activeRes = await tx.inventoryReservation.findMany({
              where: { materialId: item.materialId, status: "RESERVED" }
            });
            const reserved = activeRes.reduce((acc, x) => acc + x.quantity, 0);
            const available = Math.max(0, currentStock - reserved);

            if (available < needed) {
              throw new Error(`Insufficient stock for material ${item.material.sku}. Needed: ${needed}, Available: ${available}`);
            }

            // Consume Work Order reservations if linked
            if (pax.workOrderId && pax.workOrder) {
              const reservation = await tx.inventoryReservation.findFirst({
                where: {
                  materialId: item.materialId,
                  salesOrderId: pax.workOrder.salesOrderId || undefined,
                  status: "RESERVED"
                },
                orderBy: { reservedAt: "asc" }
              });

              if (!reservation) {
                throw new Error(`Mandatory reservation not found for material ${item.material.sku} linked to Sales Order.`);
              }
              if (reservation.quantity < needed) {
                throw new Error(`Active reservation quantity (${reservation.quantity}) is insufficient for material ${item.material.sku}. Needed: ${needed}`);
              }

              // Update the reservation (ISSUED status tracks consumption)
              if (reservation.quantity > needed) {
                await tx.inventoryReservation.update({
                  where: { id: reservation.id },
                  data: { quantity: reservation.quantity - needed }
                });

                await tx.inventoryReservation.create({
                  data: {
                    materialId: item.materialId,
                    quantity: needed,
                    status: "ISSUED",
                    salesOrderId: pax.workOrder.salesOrderId || undefined,
                    paxSerial: pax.paxSerial,
                    issuedAt: new Date()
                  }
                });
              } else {
                await tx.inventoryReservation.update({
                  where: { id: reservation.id },
                  data: {
                    status: "ISSUED",
                    paxSerial: pax.paxSerial,
                    issuedAt: new Date()
                  }
                });
              }
            }

            // Deduct inventory
            await tx.material.update({
              where: { id: item.materialId },
              data: { quantity: currentStock - needed }
            });

            // Stock movement log
            await tx.stockMovement.create({
              data: {
                materialId: item.materialId,
                quantity: -needed,
                movementType: "ISSUE",
                source: "PAX_PRODUCTION",
                referenceId: paxSerial,
                userId: user.id,
                reason: `BOM consumption for PAX: ${paxSerial}`
              }
            });
          }

          const doc = await tx.paxPack.update({
            where: { paxSerial },
            data: {
              status: "READY_FOR_PAX_TEST",
              bomId,
              qrUrl
            }
          });

          await tx.auditLog.create({
            data: {
              entityType: "pax",
              entityId: paxSerial,
              actorId: user.id,
              action: "LABEL_GENERATED_AND_BOM_CONSUMED",
              prevStatus: pax.status,
              newStatus: "READY_FOR_PAX_TEST",
              metadata: { bomId, qrUrl }
            }
          });

          return doc;
        });

        await wsManager.broadcast("pax:status_change", { paxSerial, status: "READY_FOR_PAX_TEST" });
        return result;
      } catch (err: any) {
        return reply.status(400).send({ error: err.message || "BOM material deduction transaction failed" });
      }
    }
  );

  // DELETE /pax/:serial - Hard delete PAX and return cells to pool
  fastify.delete(
    "/:serial",
    { preHandler: [requireRoles("ADMIN", "SUPERADMIN")] },
    async (request, reply) => {
      const { serial: paxSerial } = request.params as { serial: string };
      const user = request.user as { id: string };

      const pax = await prisma.paxPack.findUnique({
        where: { paxSerial },
        include: { cells: true }
      });

      if (!pax) return reply.status(404).send({ error: "PAX not found" });

      await prisma.$transaction(async (tx) => {
        const cellSerials = pax.cells.map(pc => pc.cellSerial);

        // 1. Return cells to CELL_TESTED status
        await tx.cell.updateMany({
          where: { serialNumber: { in: cellSerials } },
          data: { status: "CELL_TESTED" }
        });

        // 2. Delete junction rows
        await tx.paxCell.deleteMany({ where: { paxSerial } });

        // 3. Delete associated sales/repairs if any
        await tx.sale.deleteMany({ where: { paxSerial } });
        await tx.repair.deleteMany({ where: { paxSerial } });

        // 4. Delete PAX Pack
        await tx.paxPack.delete({ where: { paxSerial } });

        // 5. Update Work Order quantities if linked and not already scrapped
        if (pax.workOrderId && pax.status !== "SCRAPPED") {
          const wo = await tx.workOrder.findUnique({ where: { id: pax.workOrderId } });
          if (wo) {
            const updatedCompleted = Math.max(0, wo.completedQuantity - 1);
            const remaining = wo.remainingQuantity + 1;
            await tx.workOrder.update({
              where: { id: pax.workOrderId },
              data: {
                completedQuantity: updatedCompleted,
                remainingQuantity: remaining,
                status: "IN_PROGRESS"
              }
            });
          }
        }

        // 6. Audit
        await tx.auditLog.create({
          data: {
            entityType: "pax",
            entityId: paxSerial,
            actorId: user.id,
            action: "deleted",
            prevStatus: pax.status,
            metadata: { 
              reason: "Admin manual deletion",
              cellsReturned: cellSerials
            }
          }
        });
      });

      await wsManager.broadcast("pax:deleted", { paxSerial });
      return { success: true };
    }
  );
}
