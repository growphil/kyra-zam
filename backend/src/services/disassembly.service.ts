import { prisma } from "../prisma";

export interface ReclaimedMaterialInput {
  materialId: string;
  quantity: number;
}

export async function disassemblePaxPack(
  tx: any,
  paxSerial: string,
  reclaimedMaterials: ReclaimedMaterialInput[],
  actorId: string,
  reason: string
) {
  // 1. Lock the PaxPack row
  await tx.$executeRawUnsafe(
    `SELECT * FROM "PaxPack" WHERE "paxSerial" = $1 FOR UPDATE`,
    paxSerial
  );

  const pax = await tx.paxPack.findUnique({
    where: { paxSerial },
    include: { workOrder: true, bom: { include: { items: true } } }
  });
  if (!pax) throw new Error(`Pax Pack ${paxSerial} not found`);

  // State checks
  if (pax.status === "SCRAPPED") {
    throw new Error("PACK_ALREADY_DISASSEMBLED");
  }
  if (pax.status === "SOLD_TO_CUSTOMER" || pax.status === "SOLD_TO_VENDOR") {
    throw new Error("Cannot disassemble a sold battery pack.");
  }

  // Get current cells in the pack
  const paxCells = await tx.paxCell.findMany({ where: { paxSerial } });
  const cellSerials = paxCells.map((pc: any) => pc.cellSerial);

  // 2. Return cells to CELL_TESTED status
  if (cellSerials.length > 0) {
    await tx.cell.updateMany({
      where: { serialNumber: { in: cellSerials } },
      data: { status: "CELL_TESTED" }
    });
  }

  // 3. Reclaimed materials handling (BMS, cases, wiring)
  if (reclaimedMaterials && reclaimedMaterials.length > 0) {
    const sortedMaterialIds = [...new Set(reclaimedMaterials.map(m => m.materialId))].sort();

    // Concurrency lock: alphabetical resource locks
    for (const matId of sortedMaterialIds) {
      await tx.$executeRawUnsafe(
        'SELECT * FROM "Material" WHERE id = $1 FOR UPDATE',
        matId
      );
    }

    // Update quantities and create StockMovement logs
    for (const item of reclaimedMaterials) {
      const material = await tx.material.findUnique({ where: { id: item.materialId } });
      if (!material) {
        throw new Error(`Material ${item.materialId} not found.`);
      }

      // Validate salvage quantity against BOM or default
      let maxAllowed = 0;
      if (pax.bom) {
        const bomItem = pax.bom.items.find((bi: any) => bi.materialId === item.materialId);
        maxAllowed = bomItem ? bomItem.quantity : 0;
      } else {
        const paxType = await tx.paxType.findUnique({ where: { id: pax.paxTypeId } });
        if (paxType) {
          const defaultBom = await tx.bOM.findFirst({
            where: { name: { contains: paxType.name, mode: "insensitive" } },
            include: { items: true }
          });
          const bomItem = defaultBom?.items.find((bi: any) => bi.materialId === item.materialId);
          maxAllowed = bomItem ? bomItem.quantity : 0;
        }
      }

      if (item.quantity <= 0) {
        throw new Error("Salvage quantity must be greater than zero.");
      }
      if (item.quantity > maxAllowed) {
        throw new Error("INVALID_SALVAGE_QUANTITY");
      }

      await tx.material.update({
        where: { id: item.materialId },
        data: { quantity: { increment: item.quantity } }
      });

      await tx.stockMovement.create({
        data: {
          materialId: item.materialId,
          quantity: item.quantity,
          movementType: "RETURN",
          source: "SCRAP_RECLAMATION",
          referenceId: paxSerial,
          userId: actorId,
          reason: `Reclaimed from disassembled/scrapped Pax Pack ${paxSerial}. Reason: ${reason || ""}`
        }
      });
    }
  }

  // 4. Delete composite bindings
  await tx.paxCell.deleteMany({ where: { paxSerial } });

  // 5. Mark PaxPack as SCRAPPED
  await tx.paxPack.update({
    where: { paxSerial },
    data: { status: "SCRAPPED" }
  });

  // 6. Update Work Order quantities if linked
  if (pax.workOrderId) {
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

  // 7. Audit logs
  await tx.auditLog.create({
    data: {
      entityType: "pax",
      entityId: paxSerial,
      actorId: actorId,
      action: "rejected_and_disassembled",
      prevStatus: pax.status,
      newStatus: "SCRAPPED",
      metadata: { reason, reclaimedMaterials }
    }
  });

  for (const serial of cellSerials) {
    await tx.auditLog.create({
      data: {
        entityType: "cell",
        entityId: serial,
        actorId: actorId,
        action: "returned_from_disassembled_pax",
        prevStatus: "in_pax",
        newStatus: "CELL_TESTED"
      }
    });
  }

  return { success: true };
}
