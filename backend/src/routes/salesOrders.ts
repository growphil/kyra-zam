import { FastifyInstance } from "fastify";
import { prisma } from "../prisma";
import { requireRoles } from "../middleware/rbac";
import { wsManager } from "../websocket/manager";
import { 
  SalesOrderConvertSchema, 
  SalesOrderUpdateSchema 
} from "../schemas/zod.schemas";

// Notification helper
async function triggerSalesOrderNotification(targetUserId: string | null, targetRole: string | null, message: string) {
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
    // Real-time sales order sync broadcast
    wsManager.broadcastSales("sales:update", { message, targetRole, targetUserId });
  } catch (e) {
    console.warn("WebSocket notification broadcast failed:", e);
  }
}

// Generate SO-000001 sequential number
async function generateSalesOrderNumber(): Promise<string> {
  let attempts = 0;
  while (attempts < 10) {
    const lastSO = await prisma.salesOrder.findFirst({
      orderBy: { salesOrderNumber: 'desc' }
    });
    let nextNum = 1;
    if (lastSO) {
      const match = lastSO.salesOrderNumber.match(/\d+/);
      if (match) {
        nextNum = parseInt(match[0], 10) + 1;
      }
    }
    const numStr = `SO-${String(nextNum).padStart(6, '0')}`;
    const exists = await prisma.salesOrder.findUnique({ where: { salesOrderNumber: numStr } });
    if (!exists) return numStr;
    attempts++;
  }
  return `SO-${Math.floor(100000 + Math.random() * 900000)}`;
}

export async function salesOrderRoutes(fastify: FastifyInstance) {
  const crmPreHandler = { preHandler: [requireRoles("SALES_EXECUTIVE", "ACCOUNTANT", "MARKETING_MANAGER", "ADMIN", "SUPERADMIN", "SELLER")] };
  const crmWritePreHandler = { preHandler: [requireRoles("SALES_EXECUTIVE", "ACCOUNTANT", "MARKETING_MANAGER", "ADMIN", "SUPERADMIN")] };

  // GET /crm/sales-orders/dashboard
  fastify.get("/dashboard", crmPreHandler, async (request, reply) => {
    const today = new Date();

    const [
      total,
      draft,
      confirmed,
      paymentPending,
      readyFulfillment,
      inFulfillment,
      partiallyFulfilled,
      fulfilled,
      cancelled,
      onHold,
      overdueCount,
      totalValueSum
    ] = await Promise.all([
      prisma.salesOrder.count(),
      prisma.salesOrder.count({ where: { status: "DRAFT" } }),
      prisma.salesOrder.count({ where: { status: "CONFIRMED" } }),
      prisma.salesOrder.count({ where: { status: "PAYMENT_PENDING" } }),
      prisma.salesOrder.count({ where: { status: "READY_FOR_FULFILLMENT" } }),
      prisma.salesOrder.count({ where: { status: "IN_FULFILLMENT" } }),
      prisma.salesOrder.count({ where: { status: "PARTIALLY_FULFILLED" } }),
      prisma.salesOrder.count({ where: { status: "FULFILLED" } }),
      prisma.salesOrder.count({ where: { status: "CANCELLED" } }),
      prisma.salesOrder.count({ where: { status: "ON_HOLD" } }),
      prisma.salesOrder.count({
        where: {
          requiredDeliveryDate: { lt: today },
          status: { notIn: ["FULFILLED", "CANCELLED"] }
        }
      }),
      prisma.salesOrder.aggregate({
        where: { status: { not: "CANCELLED" } },
        _sum: { grandTotal: true }
      })
    ]);

    return {
      stats: {
        total,
        draft,
        confirmed,
        paymentPending,
        readyFulfillment,
        inFulfillment,
        partiallyFulfilled,
        fulfilled,
        cancelled,
        onHold,
        overdueCount,
        totalOrderValue: parseFloat((totalValueSum._sum.grandTotal || 0).toString())
      }
    };
  });

  // GET /crm/sales-orders
  fastify.get("/", crmPreHandler, async (request, reply) => {
    const {
      search,
      status,
      paymentStatus,
      priority,
      customerId,
      assignedSalesUserId,
      sortBy = "createdAt",
      sortOrder = "desc",
      page = "1",
      limit = "20"
    } = request.query as any;

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const take = parseInt(limit, 10);

    const where: any = {};

    if (search) {
      where.OR = [
        { salesOrderNumber: { contains: search, mode: "insensitive" } },
        { customerNotes: { contains: search, mode: "insensitive" } },
        { customer: { name: { contains: search, mode: "insensitive" } } },
        { customer: { customerCode: { contains: search, mode: "insensitive" } } },
        { customer: { phone: { contains: search, mode: "insensitive" } } },
        { customer: { email: { contains: search, mode: "insensitive" } } }
      ];
    }

    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (paymentStatus) where.paymentStatus = paymentStatus;
    if (customerId) where.customerId = customerId;
    if (assignedSalesUserId) where.assignedSalesUserId = assignedSalesUserId;

    const [orders, totalCount] = await Promise.all([
      prisma.salesOrder.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip,
        take,
        include: {
          customer: { select: { id: true, name: true, customerCode: true, email: true, phone: true, billingAddress: true, city: true, state: true } },
          createdBy: { select: { id: true, name: true, email: true } },
          assignedSalesUser: { select: { id: true, name: true, email: true } },
          quotation: { select: { id: true, quotationNumber: true, paymentTerms: true, deliveryTerms: true, grandTotal: true } },
          items: true,
          payments: {
            include: {
              recordedBy: { select: { id: true, name: true, email: true } },
              verifiedBy: { select: { id: true, name: true, email: true } }
            },
            orderBy: { createdAt: "desc" }
          }
        }
      }),
      prisma.salesOrder.count({ where })
    ]);

    return {
      orders,
      total: totalCount,
      page: parseInt(page, 10),
      limit: take
    };
  });

  // GET /crm/sales-orders/:id
  fastify.get("/:id", crmPreHandler, async (request, reply) => {
    const { id } = request.params as { id: string };
    const order = await prisma.salesOrder.findUnique({
      where: { id },
      include: {
        customer: true,
        quotation: true,
        lead: true,
        createdBy: { select: { name: true, email: true } },
        assignedSalesUser: { select: { name: true, email: true } },
        financialClearedBy: { select: { name: true, email: true } },
        items: true,
        reservations: {
          include: { material: true }
        },
        payments: {
          include: {
            recordedBy: { select: { name: true, email: true } },
            verifiedBy: { select: { name: true, email: true } }
          },
          orderBy: { createdAt: "desc" }
        }
      }
    });

    if (!order) return reply.status(404).send({ error: "Sales Order not found" });
    return order;
  });

  // POST /crm/sales-orders/convert/:quotationId
  fastify.post("/convert/:quotationId", crmWritePreHandler, async (request, reply) => {
    const { quotationId } = request.params as { quotationId: string };
    const { requiredDeliveryDate, priority } = SalesOrderConvertSchema.parse(request.body);
    const actor = request.user as { id: string };

    // 1. Duplicate check
    const existing = await prisma.salesOrder.findUnique({ where: { quotationId } });
    if (existing) {
      return reply.status(409).send({ 
        error: "Quotation already converted to Sales Order", 
        salesOrderId: existing.id 
      });
    }

    // 2. Fetch quotation
    const quotation = await prisma.quotation.findUnique({
      where: { id: quotationId },
      include: { items: true }
    });
    if (!quotation) return reply.status(404).send({ error: "Quotation not found" });

    // Validate eligibility
    if (quotation.status !== "ACCEPTED") {
      return reply.status(400).send({ 
        error: `Quotation is in ${quotation.status} status. Only ACCEPTED quotations can be converted.` 
      });
    }

    // Check validity
    if (new Date() > new Date(quotation.validUntil)) {
      return reply.status(400).send({ error: "Quotation validity has expired and cannot be converted" });
    }

    const salesOrderNumber = await generateSalesOrderNumber();

    const order = await prisma.$transaction(async (tx) => {
      // 3. Create Sales Order
      const so = await tx.salesOrder.create({
        data: {
          salesOrderNumber,
          customerId: quotation.customerId,
          quotationId: quotation.id,
          leadId: quotation.leadId,
          createdById: actor.id,
          assignedSalesUserId: quotation.assignedSalesUserId,
          requiredDeliveryDate: new Date(requiredDeliveryDate),
          status: "CONFIRMED",
          paymentStatus: "PENDING",
          currency: quotation.currency,
          subtotal: quotation.subtotal,
          discount: quotation.discount,
          tax: quotation.tax,
          additionalCharges: quotation.additionalCharges,
          grandTotal: quotation.grandTotal,
          paymentTerms: quotation.paymentTerms,
          deliveryTerms: quotation.deliveryTerms,
          billingAddressSnapshot: quotation.billingAddressSnapshot,
          shippingAddressSnapshot: quotation.shippingAddressSnapshot,
          customerNotes: quotation.customerNotes,
          internalNotes: quotation.internalNotes,
          priority
        }
      });

      // 4. Create items
      for (const item of quotation.items) {
        await tx.salesOrderItem.create({
          data: {
            salesOrderId: so.id,
            productRef: item.productRef,
            description: item.description,
            quantityOrdered: item.quantity,
            quantityPending: item.quantity, // starts fully pending
            unitPrice: item.unitPrice,
            discount: item.discount,
            taxRate: item.taxRate,
            taxAmount: item.taxAmount,
            lineSubtotal: item.lineSubtotal,
            lineTotal: item.lineTotal,
            specification: item.specification,
            sourceQuotationItemId: item.id,
            fulfillmentType: item.productRef?.startsWith("PAX") ? "PRODUCTION_REQUIRED" : "FROM_STOCK"
          }
        });
      }

      // 5. Audit Log
      await tx.auditLog.create({
        data: {
          entityType: "sales-order",
          entityId: so.id,
          actorId: actor.id,
          action: "SALES_ORDER_CONVERTED_FROM_QUOTATION",
          newStatus: "DRAFT",
          metadata: { quotationNumber: quotation.quotationNumber, salesOrderNumber }
        }
      });

      return so;
    });

    await triggerSalesOrderNotification(
      order.assignedSalesUserId,
      null,
      `Sales Order ${order.salesOrderNumber} has been created from Quotation ${quotation.quotationNumber}.`
    );

    return order;
  });

  // PUT /crm/sales-orders/:id
  fastify.put("/:id", crmWritePreHandler, async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = SalesOrderUpdateSchema.parse(request.body);
    const actor = request.user as { id: string };

    const order = await prisma.salesOrder.findUnique({ where: { id } });
    if (!order) return reply.status(404).send({ error: "Sales Order not found" });

    if (order.status !== "DRAFT") {
      return reply.status(400).send({ error: "Only DRAFT orders can be updated" });
    }

    const updated = await prisma.salesOrder.update({
      where: { id },
      data: {
        requiredDeliveryDate: data.requiredDeliveryDate ? new Date(data.requiredDeliveryDate) : undefined,
        priority: data.priority,
        assignedSalesUserId: data.assignedSalesUserId !== undefined ? data.assignedSalesUserId : undefined,
        paymentTerms: data.paymentTerms,
        deliveryTerms: data.deliveryTerms,
        customerNotes: data.customerNotes,
        internalNotes: data.internalNotes
      }
    });

    await prisma.auditLog.create({
      data: {
        entityType: "sales-order",
        entityId: id,
        actorId: actor.id,
        action: "SALES_ORDER_UPDATED",
        metadata: { updatedFields: Object.keys(data) }
      }
    });

    return updated;
  });

  // PUT /crm/sales-orders/:id/confirm
  fastify.put("/:id/confirm", crmWritePreHandler, async (request, reply) => {
    const { id } = request.params as { id: string };
    const actor = request.user as { id: string };

    const order = await prisma.salesOrder.findUnique({ 
      where: { id },
      include: { items: true }
    });
    if (!order) return reply.status(404).send({ error: "Sales Order not found" });

    if (order.status !== "DRAFT") {
      return reply.status(400).send({ error: "Sales Order is already confirmed or cancelled" });
    }

    // Validation checks
    if (!order.billingAddressSnapshot || !order.shippingAddressSnapshot || order.items.length === 0) {
      return reply.status(400).send({ error: "Billing/shipping addresses and items are required to confirm order." });
    }

    const updated = await prisma.salesOrder.update({
      where: { id },
      data: { status: "CONFIRMED" }
    });

    await prisma.auditLog.create({
      data: {
        entityType: "sales-order",
        entityId: id,
        actorId: actor.id,
        action: "SALES_ORDER_CONFIRMED",
        prevStatus: "DRAFT",
        newStatus: "CONFIRMED"
      }
    });

    await triggerSalesOrderNotification(
      order.assignedSalesUserId,
      null,
      `Sales Order ${order.salesOrderNumber} has been CONFIRMED.`
    );

    return updated;
  });

  // PUT /crm/sales-orders/:id/status (Workflow state updates)
  fastify.put("/:id/status", crmWritePreHandler, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { status } = request.body as { status: any };
    const actor = request.user as { id: string };

    try {
      const result = await prisma.$transaction(async (tx) => {
        // Lock the SalesOrder row first
        await tx.$executeRawUnsafe(
          `SELECT * FROM "SalesOrder" WHERE id = $1 FOR UPDATE`,
          id
        );

        const order = await tx.salesOrder.findUnique({ where: { id } });
        if (!order) throw new Error("Sales Order not found");

        // Enforce workflow logic
        const from = order.status;
        const to = status;

        if (from === to) return order;

        let valid = false;
        if (from === "CONFIRMED" && ["PAYMENT_PENDING", "READY_FOR_FULFILLMENT", "ON_HOLD", "CANCELLED"].includes(to)) valid = true;
        if (from === "PAYMENT_PENDING" && ["READY_FOR_FULFILLMENT", "ON_HOLD", "CANCELLED"].includes(to)) valid = true;
        if (from === "READY_FOR_FULFILLMENT" && ["IN_FULFILLMENT", "ON_HOLD", "CANCELLED"].includes(to)) valid = true;
        if (from === "IN_FULFILLMENT" && ["FULFILLED", "PARTIALLY_FULFILLED", "ON_HOLD", "CANCELLED"].includes(to)) valid = true;
        if (from === "PARTIALLY_FULFILLED" && ["IN_FULFILLMENT", "ON_HOLD", "CANCELLED"].includes(to)) valid = true;
        if (from === "ON_HOLD" && ["CONFIRMED", "PAYMENT_PENDING", "READY_FOR_FULFILLMENT", "IN_FULFILLMENT", "PARTIALLY_FULFILLED"].includes(to)) valid = true;
        if (from === "DRAFT" && to === "CANCELLED") valid = true;

        if (!valid) {
          throw new Error(`Invalid workflow status transition from ${from} to ${to}`);
        }

        if (to === "CANCELLED") {
          // Release all RESERVED reservations linked to this Sales Order
          await tx.inventoryReservation.updateMany({
            where: { salesOrderId: id, status: "RESERVED" },
            data: {
              status: "RELEASED",
              releasedAt: new Date()
            }
          });
        }

        const updated = await tx.salesOrder.update({
          where: { id },
          data: { status }
        });

        await tx.auditLog.create({
          data: {
            entityType: "sales-order",
            entityId: id,
            actorId: actor.id,
            action: status === "ON_HOLD" ? "SALES_ORDER_ON_HOLD" : "SALES_ORDER_STATUS_CHANGED",
            prevStatus: from,
            newStatus: to
          }
        });

        return updated;
      });

      await triggerSalesOrderNotification(
        result.assignedSalesUserId,
        null,
        `Sales Order ${result.salesOrderNumber} status changed to ${status}.`
      );

      return result;
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || "Failed to update status" });
    }
  });

  // PUT /crm/sales-orders/:id/payment (Record payment status foundation)
  fastify.put("/:id/payment", crmWritePreHandler, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { paymentStatus } = request.body as { paymentStatus: any };
    const actor = request.user as { id: string };

    const order = await prisma.salesOrder.findUnique({ where: { id } });
    if (!order) return reply.status(404).send({ error: "Sales Order not found" });

    const updated = await prisma.salesOrder.update({
      where: { id },
      data: { paymentStatus }
    });

    await prisma.auditLog.create({
      data: {
        entityType: "sales-order",
        entityId: id,
        actorId: actor.id,
        action: "SALES_ORDER_PAYMENT_STATUS_CHANGED",
        prevStatus: order.paymentStatus,
        newStatus: paymentStatus
      }
    });

    return updated;
  });

  // POST /crm/sales-orders/:id/reserve (Transactional inventory reservation)
  fastify.post("/:id/reserve", crmWritePreHandler, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { itemId, quantity } = request.body as { itemId: string; quantity: number };
    const actor = request.user as { id: string };

    if (!quantity || quantity <= 0) return reply.status(400).send({ error: "Valid quantity is required" });

    const order = await prisma.salesOrder.findUnique({ where: { id } });
    if (!order) return reply.status(404).send({ error: "Sales Order not found" });

    const item = await prisma.salesOrderItem.findUnique({ where: { id: itemId } });
    if (!item || item.salesOrderId !== id) return reply.status(404).send({ error: "Sales Order Item not found" });

    if (!item.materialId) {
      return reply.status(400).send({ error: "Only items referencing active material SKUs can be reserved." });
    }

    const materialId = item.materialId;

    try {
      const result = await prisma.$transaction(async (tx) => {
        // Lock the material row for update
        await tx.$executeRawUnsafe(
          `SELECT * FROM "Material" WHERE id = $1 FOR UPDATE`,
          materialId
        );

        // 1. Fetch current stock
        const material = await tx.material.findUnique({ where: { id: materialId } });
        if (!material) throw new Error("Material SKU not found in inventory");

        // 2. Fetch existing active reservations sum
        const reservationsAgg = await tx.inventoryReservation.aggregate({
          _sum: { quantity: true },
          where: {
            materialId,
            status: "RESERVED"
          }
        });

        const activeReservedQty = reservationsAgg._sum.quantity || 0;
        const availableStock = material.quantity - activeReservedQty;

        if (availableStock < quantity) {
          throw new Error(`Insufficient stock. Available: ${availableStock}, Requested: ${quantity}`);
        }

        // 3. Create reservation
        const res = await tx.inventoryReservation.create({
          data: {
            materialId,
            quantity,
            salesOrderId: id,
            status: "RESERVED"
          }
        });

        // 4. Log audit
        await tx.auditLog.create({
          data: {
            entityType: "sales-order",
            entityId: id,
            actorId: actor.id,
            action: "MATERIAL_STOCK_RESERVED_SALES_ORDER",
            metadata: { materialId, quantity, itemId }
          }
        });

        return res;
      });

      return result;
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || "Failed to complete reservation transaction" });
    }
  });

  // PUT /crm/sales-orders/:id/fulfill (Record fulfillment quantities)
  fastify.put("/:id/fulfill", crmWritePreHandler, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { itemId, fulfilledQty, cancelledQty = 0 } = request.body as { itemId: string; fulfilledQty: number; cancelledQty?: number };
    const actor = request.user as { id: string };

    const order = await prisma.salesOrder.findUnique({ 
      where: { id },
      include: { items: true }
    });
    if (!order) return reply.status(404).send({ error: "Sales Order not found" });

    if (order.status === "FULFILLED" || order.status === "CANCELLED") {
      return reply.status(400).send({ error: `Cannot fulfill items in order status ${order.status}` });
    }

    const item = await prisma.salesOrderItem.findUnique({ where: { id: itemId } });
    if (!item || item.salesOrderId !== id) return reply.status(404).send({ error: "Item not found" });

    // Validate quantities ordered
    const totalProcessed = item.quantityFulfilled + fulfilledQty + item.quantityCancelled + cancelledQty;
    if (totalProcessed > item.quantityOrdered) {
      return reply.status(400).send({ 
        error: `Fulfillment exceeds ordered bounds. Ordered: ${item.quantityOrdered}, Already Processed: ${item.quantityFulfilled + item.quantityCancelled}, Attempted: ${fulfilledQty + cancelledQty}` 
      });
    }

    const pendingQty = item.quantityOrdered - totalProcessed;

    const updatedItem = await prisma.$transaction(async (tx) => {
      const it = await tx.salesOrderItem.update({
        where: { id: itemId },
        data: {
          quantityFulfilled: item.quantityFulfilled + fulfilledQty,
          quantityCancelled: item.quantityCancelled + cancelledQty,
          quantityPending: pendingQty
        }
      });

      await tx.auditLog.create({
        data: {
          entityType: "sales-order",
          entityId: id,
          actorId: actor.id,
          action: "SALES_ORDER_ITEM_FULFILLMENT_UPDATED",
          metadata: { itemId, fulfilledQty, cancelledQty, pendingQty }
        }
      });

      // Recalculate status of the order
      const allItems = await tx.salesOrderItem.findMany({ where: { salesOrderId: id } });
      const allDone = allItems.every(x => x.quantityPending === 0);
      const anyDone = allItems.some(x => x.quantityFulfilled > 0);

      let nextStatus = order.status;
      if (allDone) {
        nextStatus = "FULFILLED";
      } else if (anyDone) {
        nextStatus = "PARTIALLY_FULFILLED";
      }

      if (nextStatus !== order.status) {
        await tx.salesOrder.update({
          where: { id },
          data: { status: nextStatus }
        });

        await tx.auditLog.create({
          data: {
            entityType: "sales-order",
            entityId: id,
            actorId: actor.id,
            action: "SALES_ORDER_STATUS_CHANGED",
            prevStatus: order.status,
            newStatus: nextStatus
          }
        });
      }

      return it;
    });

    return updatedItem;
  });
}
