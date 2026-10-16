import { prisma } from "../prisma";
import { Role } from "../generated/client";

export const VALID_TRANSITIONS: Record<string, string[]> = {
  RECEIVED: ["DIAGNOSIS_PENDING"],
  DIAGNOSIS_PENDING: ["DIAGNOSIS_COMPLETED", "SCRAP_RECOMMENDED", "CANCELLED"],
  DIAGNOSIS_COMPLETED: ["ESTIMATE_GENERATED", "CANCELLED"],
  ESTIMATE_GENERATED: ["WAITING_FOR_CUSTOMER_APPROVAL"],
  WAITING_FOR_CUSTOMER_APPROVAL: ["MATERIAL_REQUESTED", "CANCELLED"],
  MATERIAL_REQUESTED: ["MATERIAL_APPROVED", "CANCELLED"],
  MATERIAL_APPROVED: ["MATERIAL_ISSUED", "CANCELLED"],
  MATERIAL_ISSUED: ["REPAIR_IN_PROGRESS", "CANCELLED"],
  REPAIR_IN_PROGRESS: ["REPAIR_COMPLETED", "CANCELLED"],
  REPAIR_COMPLETED: ["QC_PENDING", "CANCELLED"],
  QC_PENDING: ["QC_IN_PROGRESS", "CANCELLED"],
  QC_IN_PROGRESS: ["READY_FOR_DELIVERY", "TEST_FAILED", "CANCELLED"],
  TEST_FAILED: ["REPAIR_IN_PROGRESS", "SCRAP_RECOMMENDED", "CANCELLED"],
  READY_FOR_DELIVERY: ["PAYMENT_PENDING", "DELIVERED", "CANCELLED"],
  PAYMENT_PENDING: ["DELIVERED", "CANCELLED"],
  DELIVERED: ["REOPENED"],
  REOPENED: ["DIAGNOSIS_PENDING", "CANCELLED"],
  SCRAP_RECOMMENDED: ["SCRAP", "CANCELLED"],
  SCRAP: [],
  CANCELLED: []
};

export class ServiceWorkflowEngine {
  /**
   * Validates a status transition based on the state machine and user roles.
   * Throws an error if invalid.
   */
  static validateTransition(
    currentStatus: string,
    targetStatus: string,
    userRoles: string[],
    previousStatus?: string | null
  ) {
    const isSuperAdmin = userRoles.includes("SUPERADMIN");
    const isAdmin = userRoles.includes("ADMIN");
    const isInventoryManager = userRoles.includes("INVENTORY_MANAGER");
    const isTechnician = userRoles.includes("ASSEMBLY_TECHNICIAN");
    const isTestEngineer = userRoles.includes("PAX_TEST_ENGINEER");

    // 1. Terminal states check (DELIVERED is removed to support reopening)
    if (["SCRAP", "CANCELLED"].includes(currentStatus)) {
      throw new Error(`Cannot transition from terminal status ${currentStatus}`);
    }

    // 2. Global hold state handling
    if (targetStatus === "ON_HOLD") {
      return;
    }

    if (currentStatus === "ON_HOLD") {
      if (!previousStatus) {
        throw new Error("Cannot validate transition from ON_HOLD: previousStatus is missing");
      }
      // If resuming to the previous state, it is always allowed
      if (targetStatus === previousStatus) {
        return;
      }
      // Otherwise, verify targetStatus is a valid transition path from previousStatus
      const allowed = VALID_TRANSITIONS[previousStatus];
      if (!allowed || !allowed.includes(targetStatus)) {
        throw new Error(`Invalid transition path from ON_HOLD (previousStatus: ${previousStatus}) to ${targetStatus}`);
      }
      // Reassign currentStatus to previousStatus to let subsequent role checks run
      currentStatus = previousStatus;
    }

    // 3. Validate transition path
    const allowed = VALID_TRANSITIONS[currentStatus];
    if (!allowed || !allowed.includes(targetStatus)) {
      throw new Error(`Invalid transition path from ${currentStatus} to ${targetStatus}`);
    }

    // 4. Superadmin bypass
    if (isSuperAdmin) {
      return;
    }

    // 5. Validate permissions per transition
    if (targetStatus === "DIAGNOSIS_PENDING") {
      if (!isTechnician && !isAdmin) {
        throw new Error("Only Assembly Technicians or Admins can start diagnosis");
      }
    } else if (targetStatus === "DIAGNOSIS_COMPLETED") {
      if (!isTechnician && !isAdmin) {
        throw new Error("Only Assembly Technicians or Admins can complete diagnosis");
      }
    } else if (targetStatus === "ESTIMATE_GENERATED") {
      if (!isAdmin) {
        throw new Error("Only Admins can generate estimates");
      }
    } else if (targetStatus === "WAITING_FOR_CUSTOMER_APPROVAL") {
      if (!isAdmin) {
        throw new Error("Only Admins can set status to waiting for customer approval");
      }
    } else if (targetStatus === "MATERIAL_REQUESTED") {
      if (!isTechnician && !isAdmin) {
        throw new Error("Only Assembly Technicians or Admins can request materials");
      }
    } else if (targetStatus === "MATERIAL_APPROVED") {
      if (!isInventoryManager && !isAdmin) {
        throw new Error("Only Inventory Managers or Admins can approve materials");
      }
    } else if (targetStatus === "MATERIAL_ISSUED") {
      if (!isInventoryManager && !isAdmin) {
        throw new Error("Only Inventory Managers or Admins can issue materials");
      }
    } else if (targetStatus === "REPAIR_IN_PROGRESS") {
      if (!isTechnician && !isInventoryManager && !isAdmin) {
        throw new Error("Only Technicians, Inventory Managers, or Admins can start repairs");
      }
    } else if (targetStatus === "REPAIR_COMPLETED") {
      if (!isTechnician && !isAdmin) {
        throw new Error("Only Assembly Technicians or Admins can complete repairs");
      }
    } else if (targetStatus === "QC_PENDING") {
      if (!isTechnician && !isAdmin) {
        throw new Error("Only Assembly Technicians or Admins can request QC");
      }
    } else if (targetStatus === "QC_IN_PROGRESS") {
      if (!isTestEngineer && !isAdmin) {
        throw new Error("Only PAX Test Engineers or Admins can start QC");
      }
    } else if (["READY_FOR_DELIVERY", "TEST_FAILED"].includes(targetStatus)) {
      if (!isTestEngineer && !isAdmin) {
        throw new Error("Only PAX Test Engineers or Admins can submit QC reports");
      }
    } else if (targetStatus === "PAYMENT_PENDING") {
      if (!isInventoryManager && !isAdmin) {
        throw new Error("Only Inventory Managers or Admins can advance status to PAYMENT_PENDING");
      }
    } else if (targetStatus === "DELIVERED") {
      if (!isInventoryManager && !isAdmin) {
        throw new Error("Only Inventory Managers or Admins can deliver the battery");
      }
    } else if (targetStatus === "SCRAP_RECOMMENDED") {
      if (!isTechnician && !isAdmin) {
        throw new Error("Only Technicians or Admins can recommend scrap");
      }
    } else if (targetStatus === "SCRAP") {
      if (!isAdmin) {
        throw new Error("Only Admins can approve scrap");
      }
    } else if (targetStatus === "CANCELLED") {
      if (!isInventoryManager && !isAdmin) {
        throw new Error("Only Inventory Managers or Admins can cancel the service");
      }
    } else if (targetStatus === "REOPENED") {
      if (!isInventoryManager && !isAdmin) {
        throw new Error("Only Inventory Managers or Admins can reopen a service");
      }
    }
  }

  /**
   * Automated cost calculation triggered when a battery is set to READY_FOR_DELIVERY.
   */
  static async calculateServiceCost(tx: any, serviceBatteryId: string) {
    const battery = await tx.serviceBattery.findUnique({
      where: { id: serviceBatteryId },
      include: { serviceCost: true }
    });

    if (!battery) {
      throw new Error("Service battery not found");
    }

    // If cost is overridden manually, or snapshots already exist, preserve them.
    if (battery.serviceCost && (!battery.serviceCost.generatedBySystem || battery.serviceCost.invoiceAmountSnapshot !== null)) {
      return battery.serviceCost;
    }

    const sType = battery.serviceType;
    if (!sType) {
      // Skip if serviceType is not selected yet
      return null;
    }

    const rule = await tx.servicePricingMaster.findUnique({
      where: { serviceType: sType.trim() }
    });
    if (!rule) {
      throw new Error(`No pricing master rule configured for service type: ${sType}`);
    }

    const labourCost = Number(rule.labourCost);
    const marginPercentage = Number(rule.marginPercentage);

    // Sum all ISSUED material items
    const issuedRequests = await tx.serviceMaterialRequest.findMany({
      where: { serviceBatteryId, status: "ISSUED" },
      include: { items: true }
    });

    let materialCost = 0;
    for (const req of issuedRequests) {
      for (const item of req.items) {
        materialCost += item.quantity * Number(item.issuedUnitCost || 0);
      }
    }

    const marginAmount = (materialCost + labourCost) * marginPercentage / 100;
    const totalCost = materialCost + labourCost + marginAmount;

    return await tx.serviceCost.upsert({
      where: { serviceBatteryId },
      create: {
        serviceBatteryId,
        serviceType: sType,
        materialCost,
        labourCost,
        marginPercentage,
        marginAmount,
        totalCost,
        generatedBySystem: true,
        materialCostSnapshot: materialCost,
        labourCostSnapshot: labourCost,
        marginPercentSnapshot: marginPercentage,
        marginAmountSnapshot: marginAmount,
        invoiceAmountSnapshot: totalCost
      },
      update: {
        serviceType: sType,
        materialCost,
        labourCost,
        marginPercentage,
        marginAmount,
        totalCost,
        generatedBySystem: true,
        materialCostSnapshot: materialCost,
        labourCostSnapshot: labourCost,
        marginPercentSnapshot: marginPercentage,
        marginAmountSnapshot: marginAmount,
        invoiceAmountSnapshot: totalCost
      }
    });
  }

  /**
   * Optimistic lock verification
   */
  static verifyVersion(dbVersion: number, incomingVersion: number) {
    if (dbVersion !== incomingVersion) {
      const err = new Error("Stale database record. Concurrent modification detected.");
      (err as any).statusCode = 409;
      throw err;
    }
  }

  /**
   * Helper function to trigger notifications
   */
  static async triggerNotification(
    tx: any,
    targetRole: string | null,
    targetUserId: string | null,
    message: string
  ) {
    const channels = ["IN_APP", "EMAIL", "WHATSAPP"];
    for (const channel of channels) {
      await tx.notification.create({
        data: {
          userId: targetUserId,
          role: targetRole as any,
          message,
          channel,
          status: "SENT"
        }
      });
    }

    console.log(`[Notification Simulator] [EMAIL] [Role: ${targetRole || 'N/A'}, User: ${targetUserId || 'N/A'}] Message: ${message}`);
    console.log(`[Notification Simulator] [WHATSAPP] [Role: ${targetRole || 'N/A'}, User: ${targetUserId || 'N/A'}] Message: ${message}`);

    try {
      const { wsManager } = require("../websocket/manager");
      if (targetRole) {
        await wsManager.broadcastToRoles([targetRole], "notification", { message });
      } else if (targetUserId) {
        await wsManager.sendToUser(targetUserId, "notification", { message });
      } else {
        await wsManager.broadcast("notification", { message });
      }
    } catch (e) {
      console.warn("WebSocket notification broadcast failed:", e);
    }
  }

  /**
   * Creates entries in both ServiceRepairLog and AuditLog.
   */
  static async logRepairAction(
    tx: any,
    serviceBatteryId: string,
    oldStatus: string | null,
    newStatus: string | null,
    action: string,
    remarks: string,
    performedBy: string
  ) {
    const notesContent = JSON.stringify({
      oldStatus,
      newStatus,
      remarks,
      performedBy,
      timestamp: new Date().toISOString()
    });

    await tx.serviceRepairLog.create({
      data: {
        serviceBatteryId,
        action,
        notes: notesContent,
        technicianId: performedBy
      }
    });

    await tx.auditLog.create({
      data: {
        entityType: "ServiceBattery",
        entityId: serviceBatteryId,
        actorId: performedBy,
        action,
        prevStatus: oldStatus,
        newStatus,
        metadata: { remarks }
      }
    });
  }
}
