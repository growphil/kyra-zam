import { FastifyInstance } from "fastify";
import { prisma } from "../prisma";
import { requireRoles } from "../middleware/rbac";
import { RepairSchema, CellSwapSchema } from "../schemas/zod.schemas";
import { z } from "zod";

const RepairCreateSchema = RepairSchema.extend({
  defectId: z.string().uuid().optional().nullable()
});

export async function repairRoutes(fastify: FastifyInstance) {
  const writePreHandler = { preHandler: [requireRoles("ASSEMBLY_TECHNICIAN", "PAX_TEST_ENGINEER", "SUPERVISOR", "ADMIN", "SUPERADMIN")] };
  const readPreHandler = { preHandler: [requireRoles("SUPERVISOR", "PAX_TEST_ENGINEER", "ASSEMBLY_TECHNICIAN", "ADMIN", "SUPERADMIN")] };

  // POST /repair - Log a repair action
  fastify.post("/", writePreHandler, async (request, reply) => {
    const data = RepairCreateSchema.parse(request.body);
    const actor = request.user as { id: string };

    try {
      const result = await prisma.$transaction(async (tx) => {
        // Lock PaxPack first
        await tx.$executeRawUnsafe(
          `SELECT * FROM "PaxPack" WHERE "paxSerial" = $1 FOR UPDATE`,
          data.paxSerial
        );

        const pax = await tx.paxPack.findUnique({ where: { paxSerial: data.paxSerial } });
        if (!pax) {
          const err = new Error("Pax Pack not found");
          (err as any).statusCode = 404;
          throw err;
        }

        if (pax.status === "SOLD_TO_CUSTOMER" || pax.status === "SOLD_TO_VENDOR") {
          const err = new Error("Cannot repair a customer-owned battery pack.");
          (err as any).statusCode = 400;
          throw err;
        }

        // Lock Defect if provided
        if (data.defectId) {
          await tx.$executeRawUnsafe(
            `SELECT * FROM "Defect" WHERE id = $1 FOR UPDATE`,
            data.defectId
          );

          const defect = await tx.defect.findUnique({ where: { id: data.defectId } });
          if (!defect) {
            const err = new Error("Defect not found");
            (err as any).statusCode = 404;
            throw err;
          }

          if (defect.status === "RESOLVED" || defect.status === "CLOSED") {
            const err = new Error("Defect is already resolved.");
            (err as any).statusCode = 400;
            throw err;
          }

          if (defect.paxSerial !== data.paxSerial) {
            const err = new Error("Defect pack serial mismatch.");
            (err as any).statusCode = 400;
            throw err;
          }

          // Resolve defect as part of repair
          await tx.defect.update({
            where: { id: data.defectId },
            data: {
              status: "RESOLVED",
              disposition: "REPAIR",
              rootCause: data.diagnosisNotes,
              resolvedById: actor.id
            }
          });

          await tx.auditLog.create({
            data: {
              entityType: "defect",
              entityId: data.defectId,
              actorId: actor.id,
              action: "DEFECT_RESOLVED",
              prevStatus: defect.status,
              newStatus: "RESOLVED"
            }
          });
        }

        const prevPaxStatus = pax.status;

        // Create the repair record
        const repair = await tx.repair.create({
          data: {
            paxSerial: data.paxSerial,
            fixType: data.fixType,
            diagnosisNotes: data.diagnosisNotes,
            repairedBy: actor.id,
            defectId: data.defectId
          }
        });

        // Update PaxPack status back to PAX_ASSEMBLED for re-testing
        await tx.paxPack.update({
          where: { paxSerial: data.paxSerial },
          data: { status: "PAX_ASSEMBLED" }
        });

        // Audit PaxPack status change
        await tx.auditLog.create({
          data: {
            entityType: "PaxPack",
            entityId: data.paxSerial,
            actorId: actor.id,
            action: "PAX_REPAIRED",
            prevStatus: prevPaxStatus,
            newStatus: "PAX_ASSEMBLED"
          }
        });

        return repair;
      });

      return result;
    } catch (err: any) {
      const code = err.statusCode || 400;
      return reply.status(code).send({ error: err.message || "Repair logging failed" });
    }
  });

  // GET /repair - List all repairs
  fastify.get("/", readPreHandler, async (request, reply) => {
    return prisma.repair.findMany({
      orderBy: { repairedAt: "desc" },
      include: {
        pax: true,
        defect: true
      }
    });
  });

  // GET /repair/:id - Get repair details
  fastify.get("/:id", readPreHandler, async (request, reply) => {
    const { id } = request.params as { id: string };
    const repair = await prisma.repair.findUnique({
      where: { repairId: id },
      include: {
        pax: true,
        defect: true
      }
    });
    if (!repair) return reply.status(404).send({ error: "Repair log not found" });
    return repair;
  });

  // POST /cell-swap - Swap a faulty cell in an UNDER_REPAIR pack
  fastify.post("/cell-swap", writePreHandler, async (request, reply) => {
    const data = CellSwapSchema.parse(request.body);
    const actor = request.user as { id: string };

    try {
      const result = await prisma.$transaction(async (tx) => {
        // 1. Lock the PaxPack row first (deterministic ordering!)
        await tx.$executeRawUnsafe(
          `SELECT * FROM "PaxPack" WHERE "paxSerial" = $1 FOR UPDATE`,
          data.paxSerial
        );

        const pax = await tx.paxPack.findUnique({
          where: { paxSerial: data.paxSerial },
          include: { paxType: true }
        });
        if (!pax) {
          const err = new Error("Pax Pack not found");
          (err as any).statusCode = 404;
          throw err;
        }

        if (pax.status !== "UNDER_REPAIR") {
          const err = new Error(`Cannot swap cells for a pack that is in status ${pax.status}. Pack must be UNDER_REPAIR.`);
          (err as any).statusCode = 400;
          throw err;
        }

        // 2. Lock both cells in deterministic alphabetical order
        const sortedSerials = [data.oldCellSerial, data.newCellSerial].sort();
        for (const s of sortedSerials) {
          await tx.$executeRawUnsafe(
            `SELECT * FROM "Cell" WHERE "serialNumber" = $1 FOR UPDATE`,
            s
          );
        }

        const oldCell = await tx.cell.findUnique({ where: { serialNumber: data.oldCellSerial } });
        const newCell = await tx.cell.findUnique({ where: { serialNumber: data.newCellSerial } });

        if (!oldCell) {
          const err = new Error(`Old cell ${data.oldCellSerial} not found`);
          (err as any).statusCode = 404;
          throw err;
        }
        if (!newCell) {
          const err = new Error(`New cell ${data.newCellSerial} not found`);
          (err as any).statusCode = 404;
          throw err;
        }

        // Check if oldCell is part of this pack
        const targetPaxCell = await tx.paxCell.findUnique({
          where: { cellSerial: data.oldCellSerial }
        });
        if (!targetPaxCell || targetPaxCell.paxSerial !== data.paxSerial) {
          const err = new Error(`Old cell ${data.oldCellSerial} is not currently mapped to pack ${data.paxSerial}`);
          (err as any).statusCode = 400;
          throw err;
        }

        // Check if newCell is already assigned to a pack
        const existingJunction = await tx.paxCell.findUnique({
          where: { cellSerial: data.newCellSerial }
        });
        if (existingJunction) {
          const err = new Error(`New cell ${data.newCellSerial} is already assigned to pack ${existingJunction.paxSerial}`);
          (err as any).statusCode = 400;
          throw err;
        }

        if (newCell.status !== "CELL_TESTED") {
          const err = new Error(`New cell ${data.newCellSerial} status must be CELL_TESTED (Current: ${newCell.status})`);
          (err as any).statusCode = 400;
          throw err;
        }

        // Retrieve other cells currently in the pack
        const paxCells = await tx.paxCell.findMany({
          where: { paxSerial: data.paxSerial },
          include: { cell: true }
        });

        const otherCells = paxCells
          .filter(pc => pc.cellSerial !== data.oldCellSerial)
          .map(pc => pc.cell);

        const packCellsWithReplacement = [...otherCells, newCell];

        // 3. GRADE & SAFETY DELTA CONSTRAINTS
        const paxType = pax.paxType;

        // A. Same Grade Grouping
        const grades = packCellsWithReplacement.map(c => c.grade).filter(Boolean) as string[];
        const uniqueGrades = Array.from(new Set(grades));
        if (uniqueGrades.length > 1) {
          const err = new Error(`Grade Mix Detected: All cells must belong to the same quality grade. Found: ${uniqueGrades.join(", ")}`);
          (err as any).statusCode = 400;
          throw err;
        }

        // B. Allowed Grades for Model
        if (grades.length > 0 && !paxType.allowedGrades.includes(grades[0])) {
          const err = new Error(`Grade Violation: Grade "${grades[0]}" is not authorized for PAX Model ${paxType.name}`);
          (err as any).statusCode = 400;
          throw err;
        }

        // C. Same Production Batch
        const batches = packCellsWithReplacement.map(c => c.batchNumber).filter(Boolean) as string[];
        const uniqueBatches = Array.from(new Set(batches));
        if (uniqueBatches.length > 1) {
          const err = new Error(`Batch Mix Detected: Cells must belong to the exact same production batch to prevent chemical impedance unbalances.`);
          (err as any).statusCode = 400;
          throw err;
        }

        // D. Capacity (AH) Delta limits
        const ahValues = packCellsWithReplacement.map(c => c.ahValue).filter(v => v !== null && v !== undefined) as number[];
        if (ahValues.length > 0) {
          const maxAh = Math.max(...ahValues);
          const minAh = Math.min(...ahValues);
          const ahDelta = maxAh - minAh;
          if (ahDelta > paxType.maxAhDifference) {
            const err = new Error(`Safety Fail: Capacity delta (ΔAH = ${ahDelta.toFixed(3)}) exceeds max permitted variation (${paxType.maxAhDifference})`);
            (err as any).statusCode = 400;
            throw err;
          }
        }

        // E. Internal Resistance (IR) Delta limits
        const irValues = packCellsWithReplacement.map(c => c.irValue).filter(v => v !== null && v !== undefined) as number[];
        if (irValues.length > 0) {
          const maxIr = Math.max(...irValues);
          const minIr = Math.min(...irValues);
          const irDelta = maxIr - minIr;
          if (irDelta > paxType.maxIrDifference) {
            const err = new Error(`Safety Fail: Internal resistance delta (ΔIR = ${irDelta.toFixed(3)}) exceeds max permitted variation (${paxType.maxIrDifference})`);
            (err as any).statusCode = 400;
            throw err;
          }
        }

        // Lock Defect if defectId is provided
        if (data.defectId) {
          await tx.$executeRawUnsafe(
            `SELECT * FROM "Defect" WHERE id = $1 FOR UPDATE`,
            data.defectId
          );
          const defect = await tx.defect.findUnique({ where: { id: data.defectId } });
          if (!defect) {
            const err = new Error("Defect not found");
            (err as any).statusCode = 404;
            throw err;
          }
          if (defect.status === "RESOLVED" || defect.status === "CLOSED") {
            const err = new Error("Defect is already resolved.");
            (err as any).statusCode = 400;
            throw err;
          }
          if (defect.paxSerial !== data.paxSerial) {
            const err = new Error("Defect pack serial mismatch.");
            (err as any).statusCode = 400;
            throw err;
          }

          // Resolve defect
          await tx.defect.update({
            where: { id: data.defectId },
            data: {
              status: "RESOLVED",
              disposition: "REPAIR",
              rootCause: data.diagnosisNotes,
              resolvedById: actor.id
            }
          });

          await tx.auditLog.create({
            data: {
              entityType: "defect",
              entityId: data.defectId,
              actorId: actor.id,
              action: "DEFECT_RESOLVED",
              prevStatus: defect.status,
              newStatus: "RESOLVED"
            }
          });
        }

        // 4. PERFORM CELL SWAP
        // Delete old junction
        await tx.paxCell.delete({
          where: { cellSerial: data.oldCellSerial }
        });

        // Create new junction in the same position
        await tx.paxCell.create({
          data: {
            paxSerial: data.paxSerial,
            cellSerial: data.newCellSerial,
            position: targetPaxCell.position
          }
        });

        // Update old cell status based on disposition
        await tx.cell.update({
          where: { serialNumber: data.oldCellSerial },
          data: {
            status: data.oldCellDisposition || "REJECTED"
          }
        });

        // Create Repair record
        const repair = await tx.repair.create({
          data: {
            paxSerial: data.paxSerial,
            fixType: data.fixType,
            diagnosisNotes: data.diagnosisNotes,
            repairedBy: actor.id,
            defectId: data.defectId || null
          }
        });

        // Log AuditLog entry for cell swap
        await tx.auditLog.create({
          data: {
            entityType: "pax",
            entityId: data.paxSerial,
            actorId: actor.id,
            action: "CELL_SWAP",
            prevStatus: "UNDER_REPAIR",
            newStatus: "UNDER_REPAIR",
            metadata: {
              oldCellSerial: data.oldCellSerial,
              newCellSerial: data.newCellSerial,
              position: targetPaxCell.position,
              oldCellDisposition: data.oldCellDisposition
            }
          }
        });

        return repair;
      });

      return reply.send({ success: true, repairId: result.repairId });
    } catch (err: any) {
      const code = err.statusCode || 400;
      return reply.status(code).send({ error: err.message || "Cell swap failed" });
    }
  });
}
