import { FastifyInstance } from "fastify";
import { prisma } from "../prisma";
import { CellStatus } from "../generated/client";
import { CellInwardSchema } from "../schemas/zod.schemas";
import { writeAudit } from "../services/audit.service";
import { requireRoles } from "../middleware/rbac";
import { normalizeSerial } from "../utils/serial";
import { calculateGrade } from "../domain/qc/qcRules";

export async function cellRoutes(fastify: FastifyInstance) {
  // GET /cells/pax-types - List battery product models (compatibility alias)
  fastify.get(
    "/pax-types",
    { preHandler: [fastify.authenticate] },
    async () => {
      return prisma.paxType.findMany({
        orderBy: { name: "asc" }
      });
    }
  );

  // ── 1. QUANTITY-BASED INWARD BATCH ROUTES (NEW ERP FLOW) ──────────────────

  // POST /cells/inward-batches - Create a single Part Number + Quantity Inward
  fastify.post(
    "/inward-batches",
    { preHandler: [requireRoles("INVENTORY_MANAGER", "ADMIN", "SUPERADMIN")] },
    async (request, reply) => {
      const user = request.user as { id: string };
      const { CellService } = require("../services/cell.service");
      try {
        const result = await CellService.createInwardBatch(request.body, user.id);
        return result;
      } catch (err: any) {
        return reply.status(400).send({ error: err.message || "Failed to create inward batch" });
      }
    }
  );

  // GET /cells/inward-batches - List recent inward batches with pagination and search
  fastify.get(
    "/inward-batches",
    { preHandler: [fastify.authenticate] },
    async (request) => {
      const { search, partNumber, batchNumber, status, page = 1, limit = 20 } = request.query as any;
      const skip = (Number(page) - 1) * Number(limit);

      const where: any = {};
      if (status) where.status = status;
      if (partNumber) where.partNumber = { contains: partNumber, mode: "insensitive" };
      if (batchNumber) where.batchNumber = { contains: batchNumber, mode: "insensitive" };
      if (search) {
        where.OR = [
          { inwardNumber: { contains: search, mode: "insensitive" } },
          { partNumber: { contains: search, mode: "insensitive" } },
          { batchNumber: { contains: search, mode: "insensitive" } },
          { category: { contains: search, mode: "insensitive" } },
        ];
      }

      const [batches, total] = await Promise.all([
        prisma.cellInwardBatch.findMany({
          where,
          skip,
          take: Number(limit),
          orderBy: { createdAt: "desc" },
          include: {
            receivedBy: { select: { id: true, name: true, email: true } },
            material: { select: { id: true, name: true, sku: true, quantity: true } }
          }
        }),
        prisma.cellInwardBatch.count({ where })
      ]);

      return {
        batches,
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit))
      };
    }
  );

  // GET /cells/inward-batches/summary - Live KPIs for Inward Dashboard
  fastify.get(
    "/inward-batches/summary",
    { preHandler: [fastify.authenticate] },
    async () => {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      const [allBatches, todayBatches] = await Promise.all([
        prisma.cellInwardBatch.findMany({
          select: {
            quantity: true,
            availableQty: true,
            testedQty: true,
            rejectedQty: true,
            consumedQty: true
          }
        }),
        prisma.cellInwardBatch.findMany({
          where: { createdAt: { gte: startOfDay } },
          select: { quantity: true }
        })
      ]);

      const todayInwardCount = todayBatches.reduce((sum, b) => sum + b.quantity, 0);
      const totalAvailable = allBatches.reduce((sum, b) => sum + b.availableQty, 0);
      const totalTested = allBatches.reduce((sum, b) => sum + b.testedQty, 0);
      const totalRejected = allBatches.reduce((sum, b) => sum + b.rejectedQty, 0);
      const totalReceived = allBatches.reduce((sum, b) => sum + b.quantity, 0);

      return {
        todayInwardCount,
        totalAvailableForTesting: totalAvailable,
        totalTestedCount: totalTested,
        totalRejectedCount: totalRejected,
        totalReceivedCount: totalReceived,
        totalBatches: allBatches.length
      };
    }
  );

  // POST /cells/inward-batches/bulk-preview - Preview bulk quantity CSV/XLSX
  fastify.post(
    "/inward-batches/bulk-preview",
    { preHandler: [requireRoles("INVENTORY_MANAGER", "ADMIN", "SUPERADMIN")] },
    async (request, reply) => {
      const file = await (request as any).file();
      if (!file) return reply.status(400).send({ error: "No file uploaded" });

      const buffer = await file.toBuffer();
      const ext = file.filename.split(".").pop()?.toLowerCase() || "";

      const { CellService } = require("../services/cell.service");
      try {
        const results = await CellService.previewBulkInwardBatches(buffer, ext);
        return results;
      } catch (err: any) {
        return reply.status(400).send({ error: err.message || "Failed to parse bulk file" });
      }
    }
  );

  // POST /cells/inward-batches/bulk-commit - Commit bulk quantity batches atomically
  fastify.post(
    "/inward-batches/bulk-commit",
    { preHandler: [requireRoles("INVENTORY_MANAGER", "ADMIN", "SUPERADMIN")] },
    async (request, reply) => {
      const { batches } = request.body as { batches: any[] };
      const user = request.user as { id: string };

      if (!batches || !Array.isArray(batches) || batches.length === 0) {
        return reply.status(400).send({ error: "Batches array cannot be empty" });
      }

      const { CellService } = require("../services/cell.service");
      try {
        const results = await CellService.commitBulkInwardBatches(batches, user.id);
        return results;
      } catch (err: any) {
        return reply.status(400).send({ error: err.message || "Failed to commit bulk batches" });
      }
    }
  );

  // ── 2. PHYSICAL CELL SERIALIZATION (TEST ENGINEER WORKFLOW) ───────────────
  // POST /cells/serialize - Test Engineer serializes 1 physical cell against PCTR
  fastify.post(
    "/serialize",
    { preHandler: [requireRoles("TEST_ENGINEER", "ADMIN", "SUPERADMIN")] },
    async (request, reply) => {
      const user = request.user as { id: string };
      const { serialNumber, requirementId, batchId } = request.body as {
        serialNumber: string;
        requirementId: string;
        batchId?: string;
      };

      if (!serialNumber || typeof serialNumber !== "string" || !serialNumber.trim()) {
        return reply.status(400).send({ error: "Serial number is required" });
      }

      if (!requirementId || typeof requirementId !== "string" || !requirementId.trim()) {
        return reply.status(400).send({ error: "Production requirement ID is required" });
      }

      const normalizedSerial = normalizeSerial(serialNumber.trim());
      if (!normalizedSerial || normalizedSerial.length < 2) {
        return reply.status(400).send({ error: "Invalid serial number format" });
      }

      // Check if serial already exists in database
      const existingCell = await prisma.cell.findUnique({
        where: { serialNumber: normalizedSerial }
      });
      if (existingCell) {
        return reply.status(409).send({ error: `Cell '${normalizedSerial}' is already serialized in inventory` });
      }

      // Concurrency-safe atomic transaction
      try {
        const result = await prisma.$transaction(async (tx) => {
          // Double check cell uniqueness inside transaction
          const duplicateInTx = await tx.cell.findUnique({
            where: { serialNumber: normalizedSerial }
          });
          if (duplicateInTx) {
            throw new Error(`Cell '${normalizedSerial}' is already serialized`);
          }

          // 1. Fetch and validate production requirement (PCTR)
          const prodReq = await tx.productionCellTestingRequirement.findUnique({
            where: { id: requirementId },
            include: {
              workOrder: {
                select: { id: true, workOrderNumber: true, productRef: true, status: true }
              },
              material: true
            }
          });

          if (!prodReq) {
            throw new Error("Production cell requirement not found");
          }

          if (prodReq.status !== "IN_PROGRESS") {
            throw new Error(`Production requirement ${prodReq.requirementNumber} is ${prodReq.status} and not accepting new cells`);
          }

          // Count already serialized cells for this requirement
          const currentSerializedCount = await tx.cell.count({
            where: { testingRequirementId: prodReq.id }
          });

          if (currentSerializedCount >= prodReq.requiredQuantity) {
            throw new Error(`Production requirement ${prodReq.requirementNumber} already reached total required serialization count (${currentSerializedCount}/${prodReq.requiredQuantity})`);
          }

          // 2. Locate available bulk stock (CellInwardBatch)
          let targetBatch: any = null;

          if (batchId) {
            targetBatch = await tx.cellInwardBatch.findUnique({
              where: { id: batchId }
            });
            if (!targetBatch || targetBatch.availableQty <= 0) {
              throw new Error("Selected inward batch has no available stock");
            }
            const bSku = (targetBatch.partNumber || "").toUpperCase();
            const rSku = (prodReq.cellSku || "").toUpperCase();
            if (bSku !== rSku && !bSku.includes(rSku) && !rSku.includes(bSku)) {
              throw new Error(`Batch SKU (${targetBatch.partNumber}) does not match required cell SKU (${prodReq.cellSku})`);
            }
          } else {
            // Find oldest batch with available stock for this SKU
            targetBatch = await tx.cellInwardBatch.findFirst({
              where: {
                availableQty: { gt: 0 },
                OR: [
                  { partNumber: { equals: prodReq.cellSku, mode: "insensitive" } },
                  { partNumber: { contains: prodReq.cellSku, mode: "insensitive" } },
                  ...(prodReq.materialId ? [{ materialId: prodReq.materialId }] : [])
                ]
              },
              orderBy: { createdAt: "asc" }
            });

            if (!targetBatch) {
              const allAvail = await tx.cellInwardBatch.findMany({
                where: { availableQty: { gt: 0 } },
                orderBy: { createdAt: "asc" }
              });
              targetBatch = allAvail.find(b => 
                (b.partNumber || "").toUpperCase().replace(/[\s-_]/g, "") === (prodReq.cellSku || "").toUpperCase().replace(/[\s-_]/g, "") ||
                (b.partNumber || "").toUpperCase().includes((prodReq.cellSku || "").toUpperCase()) ||
                (prodReq.cellSku || "").toUpperCase().includes((b.partNumber || "").toUpperCase())
              );
            }
          }

          if (!targetBatch) {
            throw new Error(`No available bulk stock found for cell SKU '${prodReq.cellSku}'. Inventory Manager must receive bulk cell stock first.`);
          }

          // 3. Decrement availableQty from CellInwardBatch
          const newAvailable = Math.max(0, targetBatch.availableQty - 1);
          await tx.cellInwardBatch.update({
            where: { id: targetBatch.id },
            data: {
              availableQty: newAvailable,
              status: newAvailable === 0 ? "COMPLETED" : "IN_TESTING"
            }
          });

          // 4. Create serialized physical Cell in RAW status
          const createdCell = await tx.cell.create({
            data: {
              serialNumber: normalizedSerial,
              inwardBatchId: targetBatch.id,
              partNumber: prodReq.cellSku,
              batchNumber: targetBatch.batchNumber,
              voltage: targetBatch.voltage || 3.2,
              category: targetBatch.category || "LFP 3.2V",
              cycles: targetBatch.cycles || 0,
              status: CellStatus.RAW,
              testingRequirementId: prodReq.id
            },
            include: {
              inwardBatch: {
                select: { id: true, inwardNumber: true, batchNumber: true, partNumber: true }
              }
            }
          });

          // 5. Audit Log
          await tx.auditLog.create({
            data: {
              entityType: "cell",
              entityId: normalizedSerial,
              actorId: user.id,
              action: "SERIALIZED",
              prevStatus: null,
              newStatus: "RAW",
              metadata: {
                requirementId: prodReq.id,
                requirementNumber: prodReq.requirementNumber,
                workOrderNumber: prodReq.workOrder?.workOrderNumber,
                cellSku: prodReq.cellSku,
                batchNumber: targetBatch.batchNumber,
                inwardNumber: targetBatch.inwardNumber
              }
            }
          });

          return {
            cell: createdCell,
            serializedCount: currentSerializedCount + 1,
            batchAvailableQty: newAvailable
          };
        });

        return reply.send({
          success: true,
          message: "Cell serialized successfully",
          cell: result.cell,
          serializedCount: result.serializedCount,
          batchAvailableQty: result.batchAvailableQty
        });
      } catch (err: any) {
        return reply.status(400).send({ error: err.message || "Failed to serialize cell" });
      }
    }
  );

  // ── 3. LEGACY / CELL-SPECIFIC ROUTES ──────────────────────────────────────

  fastify.post("/inward", { preHandler: [requireRoles("INVENTORY_MANAGER", "ADMIN", "SUPERADMIN")] }, async (request, reply) => {
    const user = request.user as { id: string };
    const body = request.body as any;

    // Support both new PartNumber quantity format and single serial fallback
    if (body.partNumber && body.quantity) {
      const { CellService } = require("../services/cell.service");
      return await CellService.createInwardBatch(body, user.id);
    }

    const data = CellInwardSchema.parse(request.body);
    const normalizedSerialNum = normalizeSerial(data.serialNumber);

    const existing = await prisma.cell.findUnique({ where: { serialNumber: normalizedSerialNum } });
    if (existing) {
      return reply.status(409).send({ error: `Cell ${normalizedSerialNum} already exists in inventory` });
    }

    const cell = await prisma.cell.create({
      data: {
        ...data,
        serialNumber: normalizedSerialNum,
        status: CellStatus.RAW,
      },
    });

    await writeAudit({
      entityType: "cell",
      entityId: cell.serialNumber,
      actorId: user.id,
      action: "INWARD",
      newStatus: "RAW",
    });

    return cell;
  });

  fastify.get("/", { preHandler: [fastify.authenticate] }, async (request) => {
    const { 
      search,
      status, 
      category, 
      grade,
      reservedForPaxTypeId, 
      compatibleWithPaxTypeId, 
      testingRequirementId,
      qcApprovedOnly,
      qcStatus,
      includeAssigned = "true",
      page = 1, 
      limit = 20 
    } = request.query as any;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = {};
    
    // If includeAssigned is explicitly false, filter only unassigned cells
    if (includeAssigned === "false") {
      where.paxCell = null;
    }

    if (status) where.status = status;
    if (category) where.category = category;
    if (grade) where.grade = grade;
    if (reservedForPaxTypeId) where.reservedForPaxTypeId = reservedForPaxTypeId;
    if (testingRequirementId) where.testingRequirementId = testingRequirementId;

    if (qcApprovedOnly === "true" || !!compatibleWithPaxTypeId) {
      where.qcDecisionHistory = { has: "QC_APPROVED" };
    }

    if (qcStatus === "PENDING") {
      where.status = "CELL_TESTED";
      where.NOT = { qcDecisionHistory: { has: "QC_APPROVED" } };
    } else if (qcStatus === "APPROVED") {
      where.status = "CELL_TESTED";
      where.qcDecisionHistory = { has: "QC_APPROVED" };
    }

    if (search) {
      where.OR = [
        { serialNumber: { contains: search, mode: "insensitive" } },
        { partNumber: { contains: search, mode: "insensitive" } },
        { batchNumber: { contains: search, mode: "insensitive" } },
      ];
    }

    if (compatibleWithPaxTypeId) {
      const paxType = await prisma.paxType.findUnique({ where: { id: compatibleWithPaxTypeId } });
      if (paxType) {
        where.ahValue = { gte: paxType.ahMin, lte: paxType.ahMax };
        where.irValue = { gte: paxType.irMin, lte: paxType.irMax };
        if (paxType.allowedGrades && paxType.allowedGrades.length > 0) {
          where.grade = { in: paxType.allowedGrades };
        }
      }
    }

    const [cells, total, totalAll, rawCount, testedCount, rejectedCount, holdCount, pendingBatches] = await Promise.all([
      prisma.cell.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: "desc" },
        include: { 
          paxCell: {
            include: {
              pax: {
                select: {
                  paxSerial: true,
                  status: true,
                  paxType: {
                    select: { name: true }
                  }
                }
              }
            }
          },
          inwardBatch: {
            select: {
              id: true,
              inwardNumber: true,
              batchNumber: true,
              createdAt: true
            }
          }
        }
      }),
      prisma.cell.count({ where }),
      prisma.cell.count(),
      prisma.cell.count({ where: { status: "RAW" } }),
      prisma.cell.count({ where: { status: "CELL_TESTED" } }),
      prisma.cell.count({ where: { status: "REJECTED" } }),
      prisma.cell.count({ where: { status: "HOLD" } }),
      prisma.cellInwardBatch.findMany({
        where: { availableQty: { gt: 0 } },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          inwardNumber: true,
          partNumber: true,
          batchNumber: true,
          quantity: true,
          availableQty: true,
          testedQty: true,
          rejectedQty: true,
          category: true,
          voltage: true,
          createdAt: true
        }
      })
    ]);

    const totalBulkAvailable = pendingBatches.reduce((acc, b) => acc + b.availableQty, 0);

    return { 
      cells, 
      total, 
      page: Number(page), 
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)),
      summary: {
        totalSerialized: totalAll,
        raw: rawCount,
        tested: testedCount,
        rejected: rejectedCount,
        hold: holdCount,
        bulkAvailableForTesting: totalBulkAvailable,
        pendingBatches
      }
    };
  });

  // GET /cells/export - Export all inventory cells matching filters without pagination
  fastify.get("/export", { preHandler: [fastify.authenticate] }, async (request) => {
    const { status, category, grade, search } = request.query as any;

    const where: any = {};
    if (status) where.status = status;
    if (category) where.category = category;
    if (grade) where.grade = grade;
    if (search) {
      where.OR = [
        { serialNumber: { contains: search, mode: "insensitive" } },
        { partNumber: { contains: search, mode: "insensitive" } },
        { batchNumber: { contains: search, mode: "insensitive" } },
      ];
    }

    const cells = await prisma.cell.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        paxCell: {
          include: {
            pax: {
              select: {
                paxSerial: true,
                status: true
              }
            }
          }
        },
        inwardBatch: {
          select: {
            inwardNumber: true
          }
        }
      }
    });

    return { cells };
  });

  fastify.get("/:serial", { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { serial } = request.params as { serial: string };
    const cell = await prisma.cell.findUnique({
      where: { serialNumber: serial },
      include: { 
        paxCell: {
          include: {
            pax: {
              select: {
                paxSerial: true,
                status: true,
                paxType: {
                  select: { name: true }
                },
                assembledAt: true
              }
            }
          }
        },
        paxType: true,
        inwardBatch: {
          include: {
            receivedBy: {
              select: { id: true, name: true, email: true }
            },
            material: {
              select: { id: true, name: true, sku: true }
            }
          }
        }
      },
    });

    if (!cell) return reply.status(404).send({ error: "Cell not found" });

    // Fetch audit logs manually since relation was removed for polymorphic FK fix
    const history = await prisma.auditLog.findMany({
      where: { entityId: serial, entityType: "cell" },
      orderBy: { timestamp: "desc" }
    });

    return { cell, history };
  });

  // PATCH /cells/:serial - Admin Only
  fastify.patch(
    "/:serial",
    { preHandler: [requireRoles("ADMIN", "SUPERADMIN")] },
    async (request, reply) => {
      const { serial } = request.params as { serial: string };
      const data = request.body as any;

      const cell = await prisma.cell.update({
        where: { serialNumber: serial },
        data: {
          voltage: data.voltage,
          category: data.category,
          status: data.status,
          ahValue: data.ahValue,
          irValue: data.irValue,
          batchNumber: data.batchNumber
        }
      });

      return cell;
    }
  );

  // DELETE /cells/:serial - Delete/Un-serialize cell and return stock to inward batch
  fastify.delete(
    "/:serial",
    { preHandler: [requireRoles("TEST_ENGINEER", "ADMIN", "SUPERADMIN")] },
    async (request, reply) => {
      const { serial } = request.params as { serial: string };
      const user = request.user as { id: string; roles?: string[] };
      const isTestEngineerOnly = !user.roles?.some((r: string) => ["ADMIN", "SUPERADMIN"].includes(r));

      const cell = await prisma.cell.findUnique({
        where: { serialNumber: serial },
        include: { paxCell: true, inwardBatch: true }
      });

      if (!cell) {
        return reply.status(404).send({ error: "Cell not found" });
      }

      // Check if used in PAX
      if (cell.paxCell) {
        return reply.status(400).send({ error: "Cannot delete cell already assigned to a PAX Pack" });
      }

      // If test engineer, only un-tested RAW cells can be un-serialized
      if (isTestEngineerOnly && cell.status !== "RAW") {
        return reply.status(403).send({ error: `Cannot un-serialize cell with status ${cell.status}. Only un-tested RAW cells can be removed by Test Engineer.` });
      }

      await prisma.$transaction(async (tx) => {
        // Return stock to inward batch if linked and cell was in RAW status
        if (cell.inwardBatchId && cell.status === "RAW") {
          const batch = await tx.cellInwardBatch.findUnique({ where: { id: cell.inwardBatchId } });
          if (batch) {
            const restoredQty = batch.availableQty + 1;
            await tx.cellInwardBatch.update({
              where: { id: batch.id },
              data: {
                availableQty: restoredQty,
                status: restoredQty >= batch.quantity ? "RECEIVED" : "IN_TESTING"
              }
            });
          }
        }

        // Delete Cell
        await tx.cell.delete({ where: { serialNumber: serial } });

        // Audit Log
        await tx.auditLog.create({
          data: {
            entityType: "cell",
            entityId: serial,
            actorId: user.id,
            action: "UNSERIALIZED_DELETED",
            prevStatus: cell.status,
            newStatus: null,
            metadata: {
              testingRequirementId: cell.testingRequirementId,
              inwardBatchId: cell.inwardBatchId,
              partNumber: cell.partNumber,
              batchNumber: cell.batchNumber
            }
          }
        });
      });

      return { success: true, message: "Cell un-serialized and stock returned to bulk inventory" };
    }
  );

  // POST /cells/bulk-delete - Admin Only
  fastify.post(
    "/bulk-delete",
    { preHandler: [requireRoles("ADMIN", "SUPERADMIN")] },
    async (request, reply) => {
      const { cellSerials } = request.body as { cellSerials: string[] };
      
      // Check for PAX usage
      const inPax = await prisma.paxCell.findMany({
        where: { cellSerial: { in: cellSerials } }
      });
      
      if (inPax.length > 0) {
        const serials = inPax.map(p => p.cellSerial).join(", ");
        return reply.status(400).send({ 
          error: `Cannot delete cells already in PAX: ${serials}` 
        });
      }

      const { count } = await prisma.cell.deleteMany({
        where: { serialNumber: { in: cellSerials } }
      });

      return { success: true, count };
    }
  );

  // POST /cells/separation/assign - "Assign to PAX Type"
  fastify.post(
    "/separation/assign",
    { preHandler: [requireRoles("INVENTORY_MANAGER", "ADMIN", "SUPERADMIN")] },
    async (request, reply) => {
      const { cellSerials, paxTypeId } = request.body as { cellSerials: string[], paxTypeId: string };
      
      const paxType = await prisma.paxType.findUnique({ where: { id: paxTypeId } });
      if (!paxType) return reply.status(404).send({ error: "PaxType not found" });

      const cells = await prisma.cell.findMany({
        where: { serialNumber: { in: cellSerials } },
        include: { paxCell: true }
      });

      const validSerials: string[] = [];
      const skipped: string[] = [];

      for (const serial of cellSerials) {
        const cell = cells.find(c => c.serialNumber === serial);
        if (cell && cell.status === "CELL_TESTED" && !cell.paxCell) {
          validSerials.push(serial);
        } else {
          skipped.push(serial);
        }
      }

      await prisma.cell.updateMany({
        where: { serialNumber: { in: validSerials } },
        data: { reservedForPaxTypeId: paxTypeId }
      });

      return { reserved: validSerials.length, skipped };
    }
  );

  // DELETE /cells/separation/assign - Clear reservation
  fastify.delete(
    "/separation/assign",
    { preHandler: [requireRoles("INVENTORY_MANAGER", "ADMIN", "SUPERADMIN")] },
    async (request, reply) => {
      const { cellSerials } = request.body as { cellSerials: string[] };

      await prisma.cell.updateMany({
        where: { serialNumber: { in: cellSerials } },
        data: { reservedForPaxTypeId: null }
      });

      return { success: true };
    }
  );

  // POST /cells/bulk-inward/preview - Parse CSV/Excel and return rows for review
  fastify.post(
    "/bulk-inward/preview",
    { preHandler: [requireRoles("INVENTORY_MANAGER", "ADMIN", "SUPERADMIN")] },
    async (request, reply) => {
      const file = await (request as any).file();
      if (!file) return reply.status(400).send({ error: "No file uploaded" });

      const buffer = await file.toBuffer();
      const ext = file.filename.split(".").pop()?.toLowerCase() || "";
      
      const { CellService } = require("../services/cell.service");
      const results = await CellService.previewBulkInward(buffer, ext);
      return results;
    }
  );

  // POST /cells/:serial/override - Supervisor Cell Override
  fastify.post(
    "/:serial/override",
    { preHandler: [requireRoles("SUPERVISOR", "ADMIN", "SUPERADMIN")] },
    async (request, reply) => {
      const { serial } = request.params as { serial: string };
      const { action, reason, ahValue, irValue } = request.body as { 
        action: "PASS" | "FAIL"; 
        reason: string; 
        ahValue?: number;
        irValue?: number;
      };
      const actor = (request.user as any).id;

      const cell = await prisma.cell.findUnique({ where: { serialNumber: serial } });
      if (!cell) return reply.status(404).send({ error: "Cell not found" });

      if (cell.status !== CellStatus.HOLD) {
        return reply.status(400).send({ error: "Can only override cells currently on HOLD" });
      }

      const updatedAh = ahValue !== undefined ? ahValue : cell.ahValue;
      const updatedIr = irValue !== undefined ? irValue : cell.irValue;
      const updatedGrade = (updatedAh !== null && updatedIr !== null) ? calculateGrade(updatedAh, updatedIr) : cell.grade;

      const newStatus = action === "PASS" ? CellStatus.CELL_TESTED : CellStatus.REJECTED;

      const txActions: any[] = [
        prisma.cell.update({
          where: { serialNumber: serial },
          data: {
            status: newStatus,
            ahValue: updatedAh !== undefined ? updatedAh : undefined,
            irValue: updatedIr !== undefined ? updatedIr : undefined,
            grade: updatedGrade !== undefined ? updatedGrade : undefined,
            qcDecisionHistory: {
              push: `SUPERVISOR_OVERRIDE_${action}`
            },
            updatedAt: new Date()
          }
        }),
        prisma.auditLog.create({
          data: {
            entityType: "cell",
            entityId: serial,
            actorId: actor,
            action: `supervisor_override_${action.toLowerCase()}`,
            prevStatus: cell.status,
            newStatus,
            metadata: {
              reason,
              overrideAction: action,
              operatorId: actor,
              timestamp: new Date().toISOString(),
              editedAhValue: ahValue !== undefined ? ahValue : undefined,
              editedIrValue: irValue !== undefined ? irValue : undefined
            }
          }
        })
      ];

      // If rejected by supervisor, move to Scrap Management too!
      if (newStatus === CellStatus.REJECTED) {
        let cellMaterial = await prisma.material.findUnique({ where: { sku: "SKU-REJ-CELL" } });
        if (!cellMaterial) {
          cellMaterial = await prisma.material.create({
            data: {
              name: "Rejected Lithium-Ion Cells",
              category: "CELLS",
              sku: "SKU-REJ-CELL",
              quantity: 0,
              unit: "pcs",
              minStock: 0,
              unitPrice: 15.0,
              totalValue: 0.0,
              isPriceVerified: true,
              materialType: "CELL_REJECT"
            }
          });
        }

        txActions.push(
          prisma.scrapEntry.create({
            data: {
              scrapId: `SCRAP-${serial}-${Date.now().toString().slice(-4)}`,
              scrapType: "LOSS",
              sourceType: "ASSEMBLY",
              status: "SCRAP_PENDING_REVIEW",
              materialId: cellMaterial.id,
              materialName: cellMaterial.name,
              sku: cellMaterial.sku,
              quantity: 1,
              unitCost: cellMaterial.unitPrice,
              totalCost: cellMaterial.unitPrice,
              defectType: `SUPERVISOR_REJECT: ${reason}`,
              severity: "CRITICAL",
              description: `Supervisor rejected cell from Hold Queue. Reason: ${reason}`,
              cellSerial: serial,
              createdBy: actor,
            }
          })
        );
      }

      await prisma.$transaction(txActions);

      return { success: true, newStatus };
    }
  );
  // POST /cells/bulk-inward - Final commit
  fastify.post(
    "/bulk-inward",
    { preHandler: [requireRoles("INVENTORY_MANAGER", "ADMIN", "SUPERADMIN")] },
    async (request, reply) => {
      const { rows } = request.body as { rows: any[] };
      const user = request.user as { id: string };
      
      const { CellService } = require("../services/cell.service");
      const results = await CellService.commitBulkInward(rows, user.id);
      return results;
    }
  );
}
