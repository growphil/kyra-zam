import { prisma } from "../prisma";
import { ScrapType, ScrapSource, ScrapStatus } from "../generated/client";

export const PROFITABLE_TRANSITIONS: Record<string, ScrapStatus[]> = {
  REPORTED: [ScrapStatus.UNDER_REVIEW],
  UNDER_REVIEW: [ScrapStatus.STORED, ScrapStatus.REJECTED],
  STORED: [ScrapStatus.SOLD, ScrapStatus.RECYCLED],
  SOLD: [],
  RECYCLED: [],
  REJECTED: [],
};

export const LOSS_TRANSITIONS: Record<string, ScrapStatus[]> = {
  REPORTED: [ScrapStatus.UNDER_REVIEW],
  SCRAP_PENDING_REVIEW: [ScrapStatus.UNDER_REVIEW],
  UNDER_REVIEW: [ScrapStatus.SCRAPPED, ScrapStatus.REJECTED],
  SCRAPPED: [ScrapStatus.DISPOSED],
  DISPOSED: [],
  REJECTED: [],
};

export class ScrapWorkflowEngine {
  /**
   * Validates a status transition based on the state machine and user roles.
   * Throws an error if invalid.
   */
  static validateTransition(
    currentStatus: ScrapStatus,
    targetStatus: ScrapStatus,
    scrapType: ScrapType,
    userRoles: string[]
  ) {
    const isSuperAdmin = userRoles.includes("SUPERADMIN");
    const isAdmin = userRoles.includes("ADMIN");

    // 1. Superadmin bypass
    if (isSuperAdmin) {
      return;
    }

    // Only Admin or Superadmin can change scrap status
    if (!isAdmin) {
      throw new Error("Access denied: only Administrators can update scrap status");
    }

    // 2. Terminal states check
    if (scrapType === ScrapType.PROFITABLE) {
      if (currentStatus === ScrapStatus.SOLD || currentStatus === ScrapStatus.RECYCLED || currentStatus === ScrapStatus.REJECTED) {
        throw new Error(`Cannot transition from terminal status ${currentStatus}`);
      }
      const allowed = PROFITABLE_TRANSITIONS[currentStatus];
      if (!allowed || !allowed.includes(targetStatus)) {
        throw new Error(`Invalid transition path from ${currentStatus} to ${targetStatus} for profitable scrap`);
      }
    } else {
      if (currentStatus === ScrapStatus.DISPOSED || currentStatus === ScrapStatus.REJECTED) {
        throw new Error(`Cannot transition from terminal status ${currentStatus}`);
      }
      const allowed = LOSS_TRANSITIONS[currentStatus];
      if (!allowed || !allowed.includes(targetStatus)) {
        throw new Error(`Invalid transition path from ${currentStatus} to ${targetStatus} for loss scrap`);
      }
    }
  }

  /**
   * Performs the transition state and executes database changes in a transaction.
   */
  static async transition(
    tx: any,
    scrapId: string,
    targetStatus: ScrapStatus,
    actorId: string,
    additionalData?: {
      notes?: string;
      location?: string;
      buyerName?: string;
      salePrice?: number;
      quantitySold?: number;
      saleDate?: string;
      remarks?: string;
    },
    userRoles: string[] = ["ADMIN"]
  ) {
    // 1. Fetch scrap entry
    const scrap = await tx.scrapEntry.findUnique({
      where: { id: scrapId },
      include: { material: true }
    });
    if (!scrap) {
      throw new Error("Scrap entry not found");
    }

    const currentStatus = scrap.status;
    const isSuperAdmin = userRoles.includes("SUPERADMIN");

    // 2. Validate transition
    this.validateTransition(currentStatus, targetStatus, scrap.scrapType, userRoles);

    // 3. Side effects based on targetStatus
    if (targetStatus === ScrapStatus.SCRAPPED && scrap.scrapType === ScrapType.LOSS) {
      // Loss Scrap: lock the material row first to prevent concurrency issues
      await tx.$executeRawUnsafe(
        'SELECT * FROM "Material" WHERE id = $1 FOR UPDATE',
        scrap.materialId
      );

      const material = await tx.material.findUnique({ where: { id: scrap.materialId } });
      if (!material) {
        throw new Error("Material not found");
      }

      const newQuantity = material.quantity - scrap.quantity;
      if (newQuantity < 0) {
        throw new Error("Insufficient inventory.");
      }

      await tx.material.update({
        where: { id: scrap.materialId },
        data: { quantity: newQuantity }
      });

      await tx.stockMovement.create({
        data: {
          materialId: scrap.materialId,
          quantity: -scrap.quantity,
          movementType: "ISSUE",
          source: "SCRAP_DISPOSAL",
          referenceId: scrap.id,
          userId: actorId,
          reason: `Scrapped material deduction: ${scrap.scrapId}`
        }
      });

      // Audit Log for stock deduction
      await tx.auditLog.create({
        data: {
          entityType: "material",
          entityId: scrap.materialId,
          actorId,
          action: "scrapped",
          prevStatus: material.quantity.toString(),
          newStatus: newQuantity.toString(),
          metadata: { scrapId: scrap.id, quantity: scrap.quantity }
        }
      });
    }

    if (targetStatus === ScrapStatus.STORED && scrap.scrapType === ScrapType.PROFITABLE) {
      // Profitable Scrap: Store in ScrapInventory
      await tx.scrapInventory.upsert({
        where: { scrapEntryId: scrap.id },
        update: {
          quantity: scrap.quantity,
          location: additionalData?.location || "Warehouse A",
          estimatedValue: scrap.estimatedRecoveryValue,
          currentStatus: ScrapStatus.STORED
        },
        create: {
          scrapEntryId: scrap.id,
          quantity: scrap.quantity,
          location: additionalData?.location || "Warehouse A",
          estimatedValue: scrap.estimatedRecoveryValue,
          currentStatus: ScrapStatus.STORED
        }
      });
    }

    if (targetStatus === ScrapStatus.SOLD && scrap.scrapType === ScrapType.PROFITABLE) {
      // Profitable Scrap: Record Sale
      const buyerName = additionalData?.buyerName || "Unknown Buyer";
      const quantitySold = Number(additionalData?.quantitySold || scrap.quantity);
      const salePrice = Number(additionalData?.salePrice || 0);
      const remarks = additionalData?.notes || additionalData?.remarks || "";
      const saleDate = additionalData?.saleDate ? new Date(additionalData.saleDate) : new Date();

      // Check ScrapInventory
      const inv = await tx.scrapInventory.findUnique({
        where: { scrapEntryId: scrap.id }
      });
      if (!inv) {
        throw new Error("Scrap inventory record not found for this profitable entry");
      }

      const newQty = inv.quantity - quantitySold;
      if (newQty < 0) {
        throw new Error(`Insufficient scrap inventory. Available: ${inv.quantity}, Requested: ${quantitySold}`);
      }

      // Update ScrapInventory
      await tx.scrapInventory.update({
        where: { scrapEntryId: scrap.id },
        data: {
          quantity: newQty,
          currentStatus: newQty === 0 ? ScrapStatus.SOLD : ScrapStatus.STORED
        }
      });

      // Create ScrapSale
      await tx.scrapSale.create({
        data: {
          scrapEntryId: scrap.id,
          buyerName,
          quantitySold,
          salePrice,
          remarks,
          saleDate
        }
      });

      // Update actual sale value in ScrapEntry
      const addedSaleValue = quantitySold * salePrice;
      await tx.scrapEntry.update({
        where: { id: scrap.id },
        data: {
          actualSaleValue: scrap.actualSaleValue + addedSaleValue
        }
      });
    }

    // 4. Mistake Reversals (Superadmin Only)
    if (isSuperAdmin) {
      // Reversing loss scrap (from SCRAPPED or DISPOSED back to prior status)
      if (
        (currentStatus === ScrapStatus.SCRAPPED || currentStatus === ScrapStatus.DISPOSED) &&
        !(targetStatus === ScrapStatus.SCRAPPED || targetStatus === ScrapStatus.DISPOSED) &&
        scrap.scrapType === ScrapType.LOSS
      ) {
        const material = await tx.material.findUnique({ where: { id: scrap.materialId } });
        if (material) {
          const restoredQty = material.quantity + scrap.quantity;
          await tx.material.update({
            where: { id: scrap.materialId },
            data: { quantity: restoredQty }
          });

          await tx.stockMovement.create({
            data: {
              materialId: scrap.materialId,
              quantity: scrap.quantity,
              movementType: "RETURN",
              source: "SCRAP_REVERSAL",
              referenceId: scrap.id,
              userId: actorId,
              reason: `Scrapped material reversal/restoration: ${scrap.scrapId}`
            }
          });
          
          await tx.auditLog.create({
            data: {
              entityType: "material",
              entityId: scrap.materialId,
              actorId,
              action: "scrapped_reversed",
              prevStatus: material.quantity.toString(),
              newStatus: restoredQty.toString(),
              metadata: { scrapId: scrap.id, reason: "Superadmin reversal" }
            }
          });
        }
      }

      // Reversing profitable scrap (from STORED or SOLD back to prior status)
      if (
        (currentStatus === ScrapStatus.STORED || currentStatus === ScrapStatus.SOLD || currentStatus === ScrapStatus.RECYCLED) &&
        !(targetStatus === ScrapStatus.STORED || targetStatus === ScrapStatus.SOLD || targetStatus === ScrapStatus.RECYCLED) &&
        scrap.scrapType === ScrapType.PROFITABLE
      ) {
        if (targetStatus === ScrapStatus.REJECTED || targetStatus === ScrapStatus.UNDER_REVIEW || targetStatus === ScrapStatus.REPORTED) {
          await tx.scrapInventory.deleteMany({ where: { scrapEntryId: scrap.id } });
          await tx.scrapSale.deleteMany({ where: { scrapEntryId: scrap.id } });
          await tx.scrapEntry.update({
            where: { id: scrap.id },
            data: { actualSaleValue: 0 }
          });
        }
      }
    }

    // 5. Update ScrapEntry Status
    const updated = await tx.scrapEntry.update({
      where: { id: scrap.id },
      data: {
        status: targetStatus,
        approvedBy: actorId
      },
      include: {
        material: { select: { name: true, sku: true, unit: true, category: true } },
        creator: { select: { name: true } },
        approver: { select: { name: true } },
        scrapInventory: true,
        scrapSales: true
      }
    });

    // 6. Create status updated AuditLog
    await tx.auditLog.create({
      data: {
        entityType: "scrap",
        entityId: scrap.id,
        actorId,
        action: "status_updated",
        prevStatus: currentStatus,
        newStatus: targetStatus,
        metadata: {
          remarks: additionalData?.notes || "Status updated",
          additionalData,
          timestamp: new Date().toISOString()
        }
      }
    });

    return updated;
  }
}
