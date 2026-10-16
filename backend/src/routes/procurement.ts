import { FastifyInstance } from "fastify";
import { prisma } from "../prisma";
import { requireRoles } from "../middleware/rbac";
import { wsManager } from "../websocket/manager";
import { 
  PurchaseRequestCreateSchema,
  PurchaseOrderCreateSchema,
  GoodsReceiptCreateSchema
} from "../schemas/zod.schemas";

// Notification helper
async function triggerProcurementNotification(targetUserId: string | null, targetRole: string | null, message: string) {
  const channels = ["IN_APP", "EMAIL", "WHATSAPP"];
  for (const channel of channels) {
    try {
      await prisma.notification.create({
        data: {
          userId: targetUserId,
          role: targetRole as any,
          message,
          channel,
          status: "SENT"
        }
      });
    } catch (err) {
      console.error("Failed to save notification:", err);
    }
  }
  try {
    if (targetRole) {
      await wsManager.broadcastToRoles([targetRole as any], "notification", { message });
    } else if (targetUserId) {
      await wsManager.sendToUser(targetUserId, "notification", { message });
    }
    // Real-time procurement sync broadcast
    wsManager.broadcastProcurement("procurement:update", { message, targetRole, targetUserId });
  } catch (e) {
    console.warn("WebSocket notification broadcast failed:", e);
  }
}

// Sequential generators
async function generatePRNumber(): Promise<string> {
  const last = await prisma.purchaseRequest.findFirst({ orderBy: { prNumber: 'desc' } });
  let nextNum = 1;
  if (last) {
    const match = last.prNumber.match(/\d+/);
    if (match) nextNum = parseInt(match[0], 10) + 1;
  }
  return `PR-${String(nextNum).padStart(6, '0')}`;
}

async function generatePONumber(): Promise<string> {
  const last = await prisma.purchaseOrder.findFirst({ orderBy: { poNumber: 'desc' } });
  let nextNum = 1;
  if (last) {
    const match = last.poNumber.match(/\d+/);
    if (match) nextNum = parseInt(match[0], 10) + 1;
  }
  return `PO-${String(nextNum).padStart(6, '0')}`;
}

async function generateGRNNumber(): Promise<string> {
  const last = await prisma.goodsReceipt.findFirst({ orderBy: { grnNumber: 'desc' } });
  let nextNum = 1;
  if (last) {
    const match = last.grnNumber.match(/\d+/);
    if (match) nextNum = parseInt(match[0], 10) + 1;
  }
  return `GRN-${String(nextNum).padStart(6, '0')}`;
}

export async function procurementRoutes(fastify: FastifyInstance) {
  const purchasePreHandler = { preHandler: [requireRoles("PURCHASE_MANAGER", "INVENTORY_MANAGER", "ADMIN", "SUPERADMIN")] };

  // GET /crm/procurement/dashboard
  fastify.get("/dashboard", purchasePreHandler, async (request, reply) => {
    const [
      totalPR,
      draftPR,
      pendingPR,
      approvedPR,
      totalPO,
      sentPO,
      totalGRN,
      pendingQCGRN
    ] = await Promise.all([
      prisma.purchaseRequest.count(),
      prisma.purchaseRequest.count({ where: { status: "DRAFT" } }),
      prisma.purchaseRequest.count({ where: { status: "PENDING_APPROVAL" } }),
      prisma.purchaseRequest.count({ where: { status: "APPROVED" } }),
      prisma.purchaseOrder.count(),
      prisma.purchaseOrder.count({ where: { status: "SENT" } }),
      prisma.goodsReceipt.count(),
      prisma.goodsReceipt.count({ where: { status: "QC_PENDING" } })
    ]);

    return {
      stats: {
        totalPR,
        draftPR,
        pendingPR,
        approvedPR,
        totalPO,
        sentPO,
        totalGRN,
        pendingQCGRN
      }
    };
  });

  // --- PURCHASE REQUEST ENDPOINTS ---
  
  // GET /crm/procurement/purchase-requests
  fastify.get("/purchase-requests", purchasePreHandler, async (request, reply) => {
    const { search, status, priority, page = "1", limit = "20" } = request.query as any;
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const take = parseInt(limit, 10);

    const where: any = {};
    if (search) {
      where.OR = [
        { prNumber: { contains: search, mode: "insensitive" } },
        { reason: { contains: search, mode: "insensitive" } }
      ];
    }
    if (status) where.status = status;
    if (priority) where.priority = priority;

    const [requests, total] = await Promise.all([
      prisma.purchaseRequest.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take,
        include: {
          requestedBy: { select: { name: true } },
          items: { include: { material: true } }
        }
      }),
      prisma.purchaseRequest.count({ where })
    ]);

    return { requests, total, page: parseInt(page, 10), limit: take };
  });

  // GET /crm/procurement/purchase-requests/:id
  fastify.get("/purchase-requests/:id", purchasePreHandler, async (request, reply) => {
    const { id } = request.params as { id: string };
    const pr = await prisma.purchaseRequest.findUnique({
      where: { id },
      include: {
        requestedBy: { select: { name: true, email: true } },
        items: { include: { material: true } },
        approvals: {
          include: {
            requestedBy: { select: { name: true } },
            decidedBy: { select: { name: true } }
          }
        }
      }
    });
    if (!pr) return reply.status(404).send({ error: "Purchase Request not found" });
    return pr;
  });

  // POST /crm/procurement/purchase-requests
  fastify.post("/purchase-requests", purchasePreHandler, async (request, reply) => {
    const data = PurchaseRequestCreateSchema.parse(request.body);
    const actor = request.user as { id: string };

    const prNumber = await generatePRNumber();

    const pr = await prisma.$transaction(async (tx) => {
      const doc = await tx.purchaseRequest.create({
        data: {
          prNumber,
          requestedById: actor.id,
          source: data.source,
          sourceReferenceId: data.sourceReferenceId,
          priority: data.priority,
          requiredDate: new Date(data.requiredDate),
          reason: data.reason,
          notes: data.notes,
          status: "DRAFT"
        }
      });

      for (const item of data.items) {
        await tx.purchaseRequestItem.create({
          data: {
            purchaseRequestId: doc.id,
            materialId: item.materialId,
            requestedQuantity: item.requestedQuantity,
            requiredDate: new Date(item.requiredDate),
            specification: item.specification,
            notes: item.notes
          }
        });
      }

      await tx.auditLog.create({
        data: {
          entityType: "purchase-request",
          entityId: doc.id,
          actorId: actor.id,
          action: "PURCHASE_REQUEST_CREATED",
          newStatus: "DRAFT",
          metadata: { prNumber }
        }
      });

      return doc;
    });

    return pr;
  });

  // PUT /crm/procurement/purchase-requests/:id/submit
  fastify.put("/purchase-requests/:id/submit", purchasePreHandler, async (request, reply) => {
    const { id } = request.params as { id: string };
    const actor = request.user as { id: string };

    const pr = await prisma.purchaseRequest.findUnique({ where: { id } });
    if (!pr) return reply.status(404).send({ error: "Purchase Request not found" });

    if (pr.status !== "DRAFT" && pr.status !== "REJECTED") {
      return reply.status(400).send({ error: `Cannot submit PR in status ${pr.status}` });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const doc = await tx.purchaseRequest.update({
        where: { id },
        data: { status: "PENDING_APPROVAL" }
      });

      await tx.purchaseRequestApproval.create({
        data: {
          purchaseRequestId: id,
          requestedById: actor.id,
          status: "PENDING"
        }
      });

      await tx.auditLog.create({
        data: {
          entityType: "purchase-request",
          entityId: id,
          actorId: actor.id,
          action: "PURCHASE_REQUEST_SUBMITTED",
          prevStatus: pr.status,
          newStatus: "PENDING_APPROVAL"
        }
      });

      return doc;
    });

    await triggerProcurementNotification(null, "ADMIN", `Purchase Request ${pr.prNumber} submitted for approval.`);
    return updated;
  });

  // PUT /crm/procurement/purchase-requests/:id/approve
  fastify.put("/purchase-requests/:id/approve", purchasePreHandler, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { comments } = request.body as { comments?: string };
    const actor = request.user as { id: string };

    const pr = await prisma.purchaseRequest.findUnique({ where: { id } });
    if (!pr) return reply.status(404).send({ error: "Purchase Request not found" });

    const userRoles = (request.user as any)?.roles || [];
    if (pr.requestedById === actor.id && !userRoles.includes("ADMIN") && !userRoles.includes("SUPERADMIN")) {
      return reply.status(403).send({ error: "Access denied: cannot approve your own Purchase Request" });
    }

    if (pr.status !== "PENDING_APPROVAL") {
      return reply.status(400).send({ error: "PR is not pending approval" });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const doc = await tx.purchaseRequest.update({
        where: { id },
        data: { status: "APPROVED" }
      });

      const pending = await tx.purchaseRequestApproval.findFirst({
        where: { purchaseRequestId: id, status: "PENDING" }
      });
      if (pending) {
        await tx.purchaseRequestApproval.update({
          where: { id: pending.id },
          data: {
            status: "APPROVED",
            decidedById: actor.id,
            comments
          }
        });
      }

      await tx.auditLog.create({
        data: {
          entityType: "purchase-request",
          entityId: id,
          actorId: actor.id,
          action: "PURCHASE_REQUEST_APPROVED",
          prevStatus: "PENDING_APPROVAL",
          newStatus: "APPROVED"
        }
      });

      return doc;
    });

    await triggerProcurementNotification(pr.requestedById, null, `Your PR ${pr.prNumber} has been approved.`);
    return updated;
  });

  // PUT /crm/procurement/purchase-requests/:id/reject
  fastify.put("/purchase-requests/:id/reject", purchasePreHandler, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { comments, reason } = request.body as { comments?: string; reason: string };
    const actor = request.user as { id: string };

    if (!reason) return reply.status(400).send({ error: "Rejection reason is required" });

    const pr = await prisma.purchaseRequest.findUnique({ where: { id } });
    if (!pr) return reply.status(404).send({ error: "Purchase Request not found" });

    const userRoles = (request.user as any)?.roles || [];
    if (pr.requestedById === actor.id && !userRoles.includes("ADMIN") && !userRoles.includes("SUPERADMIN")) {
      return reply.status(403).send({ error: "Access denied: cannot reject your own Purchase Request" });
    }

    if (pr.status !== "PENDING_APPROVAL") {
      return reply.status(400).send({ error: "PR is not pending approval" });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const doc = await tx.purchaseRequest.update({
        where: { id },
        data: { status: "REJECTED" }
      });

      const pending = await tx.purchaseRequestApproval.findFirst({
        where: { purchaseRequestId: id, status: "PENDING" }
      });
      if (pending) {
        await tx.purchaseRequestApproval.update({
          where: { id: pending.id },
          data: {
            status: "REJECTED",
            decidedById: actor.id,
            comments,
            reason
          }
        });
      }

      await tx.auditLog.create({
        data: {
          entityType: "purchase-request",
          entityId: id,
          actorId: actor.id,
          action: "PURCHASE_REQUEST_REJECTED",
          prevStatus: "PENDING_APPROVAL",
          newStatus: "REJECTED"
        }
      });

      return doc;
    });

    await triggerProcurementNotification(pr.requestedById, null, `Your PR ${pr.prNumber} has been REJECTED. Reason: ${reason}`);
    return updated;
  });

  // PUT /crm/procurement/purchase-requests/:id/cancel
  fastify.put("/purchase-requests/:id/cancel", purchasePreHandler, async (request, reply) => {
    const { id } = request.params as { id: string };
    const actor = request.user as { id: string };

    const pr = await prisma.purchaseRequest.findUnique({ where: { id } });
    if (!pr) return reply.status(404).send({ error: "Purchase Request not found" });

    if (["COMPLETED", "CANCELLED", "ORDERED"].includes(pr.status)) {
      return reply.status(400).send({ error: `Cannot cancel request in status ${pr.status}` });
    }

    const updated = await prisma.purchaseRequest.update({
      where: { id },
      data: { status: "CANCELLED" }
    });

    await prisma.auditLog.create({
      data: {
        entityType: "purchase-request",
        entityId: id,
        actorId: actor.id,
        action: "PURCHASE_REQUEST_CANCELLED",
        prevStatus: pr.status,
        newStatus: "CANCELLED"
      }
    });

    return updated;
  });


  // --- PURCHASE ORDER ENDPOINTS ---

  // GET /crm/procurement/purchase-orders
  fastify.get("/purchase-orders", purchasePreHandler, async (request, reply) => {
    const { search, status, vendorId, page = "1", limit = "20" } = request.query as any;
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const take = parseInt(limit, 10);

    const where: any = {};
    if (search) {
      where.OR = [
        { poNumber: { contains: search, mode: "insensitive" } },
        { notes: { contains: search, mode: "insensitive" } }
      ];
    }
    if (status) where.status = status;
    if (vendorId) where.vendorId = vendorId;

    const [orders, total] = await Promise.all([
      prisma.purchaseOrder.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take,
        include: {
          vendor: { select: { name: true } },
          createdBy: { select: { name: true } }
        }
      }),
      prisma.purchaseOrder.count({ where })
    ]);

    return { orders, total, page: parseInt(page, 10), limit: take };
  });

  // GET /crm/procurement/purchase-orders/:id
  fastify.get("/purchase-orders/:id", purchasePreHandler, async (request, reply) => {
    const { id } = request.params as { id: string };
    const po = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        vendor: true,
        createdBy: { select: { name: true, email: true } },
        purchaseRequest: true,
        items: { include: { material: true } },
        goodsReceipts: true
      }
    });
    if (!po) return reply.status(404).send({ error: "Purchase Order not found" });
    return po;
  });

  // POST /crm/procurement/purchase-orders
  fastify.post("/purchase-orders", purchasePreHandler, async (request, reply) => {
    const data = PurchaseOrderCreateSchema.parse(request.body);
    const actor = request.user as { id: string };

    const poNumber = await generatePONumber();

    // Verify vendor
    const vendor = await prisma.vendor.findUnique({ where: { id: data.vendorId } });
    if (!vendor) return reply.status(400).send({ error: "Vendor not found" });

    // Calculate totals
    let subtotal = 0;
    let discountTotal = 0;
    let taxTotal = 0;

    const items = data.items.map(item => {
      const lineSub = item.quantityOrdered * item.unitPrice;
      const taxable = Math.max(0, lineSub - item.discount);
      const taxAmount = taxable * (item.taxRate / 100);
      const lineTotal = taxable + taxAmount;

      subtotal += lineSub;
      discountTotal += item.discount;
      taxTotal += taxAmount;

      return {
        materialId: item.materialId,
        description: item.description,
        quantityOrdered: item.quantityOrdered,
        quantityPending: item.quantityOrdered, // initially fully pending
        unitPrice: item.unitPrice,
        discount: item.discount,
        taxRate: item.taxRate,
        taxAmount,
        lineSubtotal: lineSub,
        lineTotal,
        specification: item.specification
      };
    });

    const grandTotal = subtotal - discountTotal + taxTotal + data.additionalCharges;

    const po = await prisma.$transaction(async (tx) => {
      const doc = await tx.purchaseOrder.create({
        data: {
          poNumber,
          vendorId: data.vendorId,
          purchaseRequestId: data.purchaseRequestId,
          createdById: actor.id,
          expectedDeliveryDate: new Date(data.expectedDeliveryDate),
          status: "DRAFT",
          currency: data.currency,
          subtotal,
          discount: discountTotal,
          tax: taxTotal,
          additionalCharges: data.additionalCharges,
          grandTotal,
          paymentTerms: data.paymentTerms,
          deliveryTerms: data.deliveryTerms,
          billingAddress: data.billingAddress,
          deliveryAddress: data.deliveryAddress,
          notes: data.notes
        }
      });

      for (const item of items) {
        await tx.purchaseOrderItem.create({
          data: {
            purchaseOrderId: doc.id,
            materialId: item.materialId,
            description: item.description,
            quantityOrdered: item.quantityOrdered,
            quantityPending: item.quantityPending,
            unitPrice: item.unitPrice,
            discount: item.discount,
            taxRate: item.taxRate,
            taxAmount: item.taxAmount,
            lineSubtotal: item.lineSubtotal,
            lineTotal: item.lineTotal,
            specification: item.specification
          }
        });
      }

      // Mark PR status as ORDERED if linked
      if (data.purchaseRequestId) {
        await tx.purchaseRequest.update({
          where: { id: data.purchaseRequestId },
          data: { status: "ORDERED" }
        });
      }

      await tx.auditLog.create({
        data: {
          entityType: "purchase-order",
          entityId: doc.id,
          actorId: actor.id,
          action: "PURCHASE_ORDER_CREATED",
          newStatus: "DRAFT",
          metadata: { poNumber }
        }
      });

      return doc;
    });

    return po;
  });

  // PUT /crm/procurement/purchase-orders/:id/status (Transitions workflow)
  fastify.put("/purchase-orders/:id/status", purchasePreHandler, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { status } = request.body as { status: any };
    const actor = request.user as { id: string };

    const po = await prisma.purchaseOrder.findUnique({ where: { id } });
    if (!po) return reply.status(404).send({ error: "Purchase Order not found" });

    // Validate workflow moves
    const from = po.status;
    const to = status;

    let valid = false;
    if (from === "DRAFT" && ["PENDING_APPROVAL", "CANCELLED"].includes(to)) valid = true;
    if (from === "PENDING_APPROVAL" && ["APPROVED", "REJECTED"].includes(to)) valid = true;
    if (from === "APPROVED" && ["SENT", "CANCELLED"].includes(to)) valid = true;
    if (from === "SENT" && ["CANCELLED"].includes(to)) valid = true;

    if (!valid && from !== to) {
      return reply.status(400).send({ error: `Invalid PO status move from ${from} to ${to}` });
    }

    const updated = await prisma.purchaseOrder.update({
      where: { id },
      data: { status }
    });

    await prisma.auditLog.create({
      data: {
        entityType: "purchase-order",
        entityId: id,
        actorId: actor.id,
        action: "PURCHASE_ORDER_STATUS_CHANGED",
        prevStatus: from,
        newStatus: to
      }
    });

    return updated;
  });


  // --- GOODS RECEIPT ENDPOINTS ---

  // GET /crm/procurement/goods-receipts
  fastify.get("/goods-receipts", purchasePreHandler, async (request, reply) => {
    const { search, status, vendorId, page = "1", limit = "20" } = request.query as any;
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const take = parseInt(limit, 10);

    const where: any = {};
    if (search) {
      where.grnNumber = { contains: search, mode: "insensitive" };
    }
    if (status) where.status = status;
    if (vendorId) where.vendorId = vendorId;

    const [receipts, total] = await Promise.all([
      prisma.goodsReceipt.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take,
        include: {
          vendor: { select: { name: true } },
          receivedBy: { select: { name: true } },
          purchaseOrder: { select: { poNumber: true } }
        }
      }),
      prisma.goodsReceipt.count({ where })
    ]);

    return { receipts, total, page: parseInt(page, 10), limit: take };
  });

  // GET /crm/procurement/goods-receipts/:id
  fastify.get("/goods-receipts/:id", purchasePreHandler, async (request, reply) => {
    const { id } = request.params as { id: string };
    const grn = await prisma.goodsReceipt.findUnique({
      where: { id },
      include: {
        vendor: true,
        receivedBy: { select: { name: true, email: true } },
        purchaseOrder: true,
        warehouse: true,
        items: { include: { material: true } }
      }
    });
    if (!grn) return reply.status(404).send({ error: "Goods Receipt not found" });
    return grn;
  });

  // POST /crm/procurement/goods-receipts (EXPECTED status)
  fastify.post("/goods-receipts", purchasePreHandler, async (request, reply) => {
    const data = GoodsReceiptCreateSchema.parse(request.body);
    const actor = request.user as { id: string };

    const po = await prisma.purchaseOrder.findUnique({ where: { id: data.purchaseOrderId } });
    if (!po) return reply.status(400).send({ error: "Purchase Order not found" });

    if (po.status !== "SENT" && po.status !== "PARTIALLY_RECEIVED") {
      return reply.status(400).send({ error: "PO must be under status SENT or PARTIALLY_RECEIVED to spawn GRN" });
    }

    const grnNumber = await generateGRNNumber();

    const grn = await prisma.$transaction(async (tx) => {
      const doc = await tx.goodsReceipt.create({
        data: {
          grnNumber,
          purchaseOrderId: data.purchaseOrderId,
          vendorId: data.vendorId,
          warehouseId: data.warehouseId,
          receivedById: actor.id,
          status: "EXPECTED",
          notes: data.notes
        }
      });

      for (const item of data.items) {
        await tx.goodsReceiptItem.create({
          data: {
            goodsReceiptId: doc.id,
            materialId: item.materialId,
            quantityOrdered: item.quantityOrdered,
            quantityReceived: item.quantityReceived,
            batchNumber: item.batchNumber,
            serialNumber: item.serialNumber,
            notes: item.notes
          }
        });
      }

      await tx.auditLog.create({
        data: {
          entityType: "goods-receipt",
          entityId: doc.id,
          actorId: actor.id,
          action: "GOODS_RECEIPT_EXPECTED_CREATED",
          newStatus: "EXPECTED",
          metadata: { grnNumber }
        }
      });

      return doc;
    });

    return grn;
  });

  // PUT /crm/procurement/goods-receipts/:id/receive (Moves to RECEIVING / QC_PENDING)
  fastify.put("/goods-receipts/:id/receive", purchasePreHandler, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { items } = request.body as { items: Array<{ itemId: string; quantityReceived: number }> };
    const actor = request.user as { id: string };

    const grn = await prisma.goodsReceipt.findUnique({ where: { id } });
    if (!grn) return reply.status(404).send({ error: "Goods Receipt not found" });

    if (grn.status !== "EXPECTED") {
      return reply.status(400).send({ error: "Goods Receipt has already been received/processed" });
    }

    const updated = await prisma.$transaction(async (tx) => {
      for (const item of items) {
        await tx.goodsReceiptItem.update({
          where: { id: item.itemId },
          data: { 
            quantityReceived: item.quantityReceived,
            inspectionStatus: "PENDING"
          }
        });
      }

      const doc = await tx.goodsReceipt.update({
        where: { id },
        data: { status: "QC_PENDING" }
      });

      await tx.auditLog.create({
        data: {
          entityType: "goods-receipt",
          entityId: id,
          actorId: actor.id,
          action: "GOODS_RECEIPT_RECEIVED_QC_PENDING",
          prevStatus: "EXPECTED",
          newStatus: "QC_PENDING"
        }
      });

      return doc;
    });

    return updated;
  });

  // PUT /crm/procurement/goods-receipts/:id/inspect (Record accepted/rejected quantities)
  fastify.put("/goods-receipts/:id/inspect", purchasePreHandler, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { items } = request.body as { items: Array<{ itemId: string; acceptedQty: number; rejectedQty: number; damagedQty?: number }> };
    const actor = request.user as { id: string };

    const grn = await prisma.goodsReceipt.findUnique({ where: { id } });
    if (!grn) return reply.status(404).send({ error: "Goods Receipt not found" });

    if (grn.status !== "QC_PENDING") {
      return reply.status(400).send({ error: "Goods Receipt is not pending QC inspection" });
    }

    const updated = await prisma.$transaction(async (tx) => {
      for (const item of items) {
        const row = await tx.goodsReceiptItem.findUnique({ where: { id: item.itemId } });
        if (!row) throw new Error("GRN Item not found");

        if (item.acceptedQty + item.rejectedQty > row.quantityReceived) {
          throw new Error(`QC sums exceed received quantity bounds. Received: ${row.quantityReceived}`);
        }

        await tx.goodsReceiptItem.update({
          where: { id: item.itemId },
          data: {
            quantityAccepted: item.acceptedQty,
            quantityRejected: item.rejectedQty,
            quantityDamaged: item.damagedQty || 0,
            inspectionStatus: item.acceptedQty > 0 ? "PASSED" : "FAILED"
          }
        });
      }

      const allItems = await tx.goodsReceiptItem.findMany({ where: { goodsReceiptId: id } });
      const totalAcc = allItems.reduce((acc, x) => acc + x.quantityAccepted, 0);
      const totalRej = allItems.reduce((acc, x) => acc + x.quantityRejected, 0);

      let nextStatus = "ACCEPTED";
      if (totalAcc > 0 && totalRej > 0) nextStatus = "PARTIALLY_ACCEPTED";
      else if (totalAcc === 0 && totalRej > 0) nextStatus = "REJECTED";

      const doc = await tx.goodsReceipt.update({
        where: { id },
        data: { status: nextStatus as any }
      });

      await tx.auditLog.create({
        data: {
          entityType: "goods-receipt",
          entityId: id,
          actorId: actor.id,
          action: "GOODS_RECEIPT_INSPECTED",
          prevStatus: "QC_PENDING",
          newStatus: nextStatus as any
        }
      });

      return doc;
    });

    return updated;
  });

  // PUT /crm/procurement/goods-receipts/:id/stock (STOCKED: Increases inventory & movement logs)
  fastify.put("/goods-receipts/:id/stock", purchasePreHandler, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { warehouseId, locationId } = request.body as { warehouseId: string; locationId?: string };
    const actor = request.user as { id: string };

    const grn = await prisma.goodsReceipt.findUnique({ 
      where: { id },
      include: { items: true }
    });
    if (!grn) return reply.status(404).send({ error: "Goods Receipt not found" });

    if (!["ACCEPTED", "PARTIALLY_ACCEPTED"].includes(grn.status)) {
      return reply.status(400).send({ error: `Only accepted/partially accepted goods can be stocked. Current status: ${grn.status}` });
    }

    try {
      const result = await prisma.$transaction(async (tx) => {
        // Sort items by materialId deterministically to prevent deadlocks
        const sortedItems = [...grn.items].sort((a, b) => a.materialId.localeCompare(b.materialId));

        // 1. Finalize stock movements
        for (const item of sortedItems) {
          const acceptedQty = item.quantityAccepted;
          if (acceptedQty <= 0) continue;

          // Lock the Material row first
          await tx.$executeRawUnsafe(
            `SELECT * FROM "Material" WHERE id = $1 FOR UPDATE`,
            item.materialId
          );

          // Increase raw material stock
          const material = await tx.material.findUnique({ where: { id: item.materialId } });
          if (!material) throw new Error(`Material SKU not found: ${item.materialId}`);

          const beforeQty = material.quantity;
          const afterQty = beforeQty + acceptedQty;

          await tx.material.update({
            where: { id: item.materialId },
            data: { quantity: afterQty }
          });

          // Stock location balances if location provided
          if (warehouseId && locationId) {
            const balance = await tx.materialLocationBalance.findUnique({
              where: {
                materialId_warehouseId_locationId: {
                  materialId: item.materialId,
                  warehouseId,
                  locationId
                }
              }
            });

            if (balance) {
              await tx.materialLocationBalance.update({
                where: { id: balance.id },
                data: { quantity: balance.quantity + acceptedQty }
              });
            } else {
              await tx.materialLocationBalance.create({
                data: {
                  materialId: item.materialId,
                  warehouseId,
                  locationId,
                  quantity: acceptedQty
                }
              });
            }
          }

          // Create stock movement record
          await tx.stockMovement.create({
            data: {
              materialId: item.materialId,
              quantity: acceptedQty,
              movementType: "RECEIPT",
              source: "GOODS_RECEIPT",
              referenceId: id,
              warehouseId,
              locationId,
              userId: actor.id,
              reason: `GRN: ${grn.grnNumber} Stocking`
            }
          });

          // Update Purchase Order Items pending totals
          const poItem = await tx.purchaseOrderItem.findFirst({
            where: {
              purchaseOrderId: grn.purchaseOrderId,
              materialId: item.materialId
            }
          });

          if (poItem) {
            const processed = poItem.quantityReceived + acceptedQty;
            const pending = Math.max(0, poItem.quantityOrdered - processed - poItem.quantityCancelled);
            await tx.purchaseOrderItem.update({
              where: { id: poItem.id },
              data: {
                quantityReceived: processed,
                quantityPending: pending
              }
            });
          }
        }

        // 2. Adjust Purchase Order status
        const allPOItems = await tx.purchaseOrderItem.findMany({
          where: { purchaseOrderId: grn.purchaseOrderId }
        });
        const poAllPending = allPOItems.reduce((acc, x) => acc + x.quantityPending, 0);
        const poAllReceived = allPOItems.reduce((acc, x) => acc + x.quantityReceived, 0);

        let poStatus = "PARTIALLY_RECEIVED";
        if (poAllPending === 0) poStatus = "RECEIVED";

        await tx.purchaseOrder.update({
          where: { id: grn.purchaseOrderId },
          data: { status: poStatus as any }
        });

        // 3. Mark GRN as STOCKED
        const finalizedGRN = await tx.goodsReceipt.update({
          where: { id },
          data: { 
            status: "STOCKED",
            warehouseId 
          }
        });

        await tx.auditLog.create({
          data: {
            entityType: "goods-receipt",
            entityId: id,
            actorId: actor.id,
            action: "GOODS_RECEIPT_STOCKED_INVENTORY",
            prevStatus: grn.status,
            newStatus: "STOCKED"
          }
        });

        // 4. Auto-recheck open shortage requirements affected by incoming GRN materials
        const receivedMaterialIds = grn.items
          .map(item => item.materialId)
          .filter(Boolean);

        if (receivedMaterialIds.length > 0) {
          const bomsWithIncoming = await tx.bOM.findMany({
            where: {
              items: {
                some: {
                  materialId: { in: receivedMaterialIds }
                }
              }
            },
            select: { name: true }
          });
          const bomNames = bomsWithIncoming.map(b => b.name);

          const allShortageReqs = await tx.productionRequirement.findMany({
            where: {
              status: "MATERIAL_SHORTAGE"
            }
          });
          
          const shortageReqs = allShortageReqs.filter(req => {
            return req.productRef && bomNames.some(bomName => bomName.toLowerCase().includes(req.productRef!.toLowerCase()));
          });

          for (const req of shortageReqs) {
            if (!req.productRef) continue;
            // Strict BOM match by name (No findFirst fallback!)
            const bom = await tx.bOM.findFirst({
              where: { name: { contains: req.productRef, mode: "insensitive" } },
              include: { items: { include: { material: true } } }
            });
            if (bom) {
              let hasShortage = false;
              for (const item of bom.items) {
                const neededQty = item.quantity * req.requiredQuantity;
                const activeRes = await tx.inventoryReservation.findMany({
                  where: { materialId: item.materialId, status: "RESERVED" }
                });
                const reservedQty = activeRes.reduce((acc, x) => acc + x.quantity, 0);

                const freshMat = await tx.material.findUnique({ where: { id: item.materialId } });
                const physicalStock = freshMat ? freshMat.quantity : 0;
                const availableQty = Math.max(0, physicalStock - reservedQty);

                if (neededQty > availableQty) {
                  hasShortage = true;
                  break;
                }
              }
              if (!hasShortage) {
                await tx.productionRequirement.update({
                  where: { id: req.id },
                  data: { status: "READY" }
                });
                await tx.auditLog.create({
                  data: {
                    entityType: "production-requirement",
                    entityId: req.id,
                    actorId: actor.id,
                    action: "STATUS_CHANGED",
                    prevStatus: "MATERIAL_SHORTAGE",
                    newStatus: "READY",
                    metadata: { remarks: "Auto-transitioned via GRN stock replenishment" }
                  }
                });
              }
            }
          }
        }

        return finalizedGRN;
      });

      return result;
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || "Failed to stock goods receipt items" });
    }
  });
}
