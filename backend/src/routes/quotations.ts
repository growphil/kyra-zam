import { FastifyInstance } from "fastify";
import { prisma } from "../prisma";
import { requireRoles } from "../middleware/rbac";
import { wsManager } from "../websocket/manager";
import { 
  QuotationCreateSchema, 
  QuotationUpdateSchema 
} from "../schemas/zod.schemas";
import PDFDocument from "pdfkit";

// Notification helper
async function triggerQuotationNotification(targetUserId: string | null, targetRole: string | null, message: string) {
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
    // Real-time quotation / sales sync broadcast
    wsManager.broadcastSales("quotation:update", { message, targetRole, targetUserId });
  } catch (e) {
    console.warn("WebSocket notification broadcast failed:", e);
  }
}

// Generate sequence QT-000001
async function generateQuotationNumber(): Promise<string> {
  let attempts = 0;
  while (attempts < 10) {
    const lastQuotation = await prisma.quotation.findFirst({
      orderBy: { quotationNumber: 'desc' }
    });
    let nextNum = 1;
    if (lastQuotation) {
      const match = lastQuotation.quotationNumber.match(/\d+/);
      if (match) {
        nextNum = parseInt(match[0], 10) + 1;
      }
    }
    const numStr = `QT-${String(nextNum).padStart(6, '0')}`;
    const exists = await prisma.quotation.findUnique({ where: { quotationNumber: numStr } });
    if (!exists) return numStr;
    attempts++;
  }
  return `QT-${Math.floor(100000 + Math.random() * 900000)}`;
}

// Pricing calculation helper - Authoritative backend calculation
function calculatePricing(items: any[], additionalCharges: number = 0, freight: number = 0) {
  let subtotal = 0;
  let discountTotal = 0;
  let taxableTotal = 0;
  let taxTotal = 0;

  const processedItems = items.map(item => {
    const qty = Number(item.quantity) || 1;
    const price = Math.max(0, Number(item.unitPrice) || 0);
    const discPct = Math.min(100, Math.max(0, Number(item.discount) || 0)); // discount percentage 0-100
    const taxRate = Math.min(100, Math.max(0, Number(item.taxRate) || 0)); // tax percentage 0-100

    const lineSubtotal = qty * price;
    const discountAmount = lineSubtotal * (discPct / 100);
    const taxableAmount = Math.max(0, lineSubtotal - discountAmount);
    const taxAmount = taxableAmount * (taxRate / 100);
    const lineTotal = taxableAmount + taxAmount;

    subtotal += lineSubtotal;
    discountTotal += discountAmount;
    taxableTotal += taxableAmount;
    taxTotal += taxAmount;

    return {
      productRef: item.productRef || null,
      materialId: item.materialId || null,
      description: item.description,
      quantity: qty,
      unitPrice: parseFloat(price.toFixed(2)),
      discount: parseFloat(discPct.toFixed(2)), // stores discount percentage
      taxRate: parseFloat(taxRate.toFixed(2)),
      taxAmount: parseFloat(taxAmount.toFixed(2)),
      lineSubtotal: parseFloat(lineSubtotal.toFixed(2)),
      lineTotal: parseFloat(lineTotal.toFixed(2)),
      specification: item.specification || null,
      notes: item.notes || null
    };
  });

  const validFreight = Math.max(0, Number(freight) || 0);
  const validAddCharges = Math.max(0, Number(additionalCharges) || 0);
  const totalExtra = validFreight + validAddCharges;
  const grandTotal = taxableTotal + taxTotal + totalExtra;

  return {
    items: processedItems,
    subtotal: parseFloat(subtotal.toFixed(2)),
    discount: parseFloat(discountTotal.toFixed(2)),
    taxable: parseFloat(taxableTotal.toFixed(2)),
    tax: parseFloat(taxTotal.toFixed(2)),
    additionalCharges: parseFloat(totalExtra.toFixed(2)),
    grandTotal: parseFloat(grandTotal.toFixed(2))
  };
}

export async function quotationRoutes(fastify: FastifyInstance) {
  const salesReadPreHandler = { preHandler: [requireRoles("SALES_EXECUTIVE", "MARKETING_MANAGER", "ACCOUNTANT", "ADMIN", "SUPERADMIN")] };
  const salesWritePreHandler = { preHandler: [requireRoles("SALES_EXECUTIVE", "MARKETING_MANAGER", "ADMIN", "SUPERADMIN")] };
  const approvePreHandler = { preHandler: [requireRoles("SALES_EXECUTIVE", "ADMIN", "SUPERADMIN")] };

  // GET /crm/quotations/dashboard
  fastify.get("/dashboard", salesReadPreHandler, async (request, reply) => {
    const today = new Date();
    today.setHours(0,0,0,0);
    const in7Days = new Date(today);
    in7Days.setDate(in7Days.getDate() + 7);

    const [
      total,
      draft,
      pending,
      approved,
      sent,
      accepted,
      rejected,
      expiringSoon,
      acceptedSum
    ] = await Promise.all([
      prisma.quotation.count(),
      prisma.quotation.count({ where: { status: "DRAFT" } }),
      prisma.quotation.count({ where: { status: "PENDING_APPROVAL" } }),
      prisma.quotation.count({ where: { status: "APPROVED" } }),
      prisma.quotation.count({ where: { status: "SENT" } }),
      prisma.quotation.count({ where: { status: "ACCEPTED" } }),
      prisma.quotation.count({ where: { status: "REJECTED" } }),
      prisma.quotation.count({
        where: {
          validUntil: {
            gte: today,
            lte: in7Days
          },
          status: { notIn: ["ACCEPTED", "CANCELLED", "REJECTED"] }
        }
      }),
      prisma.quotation.aggregate({
        where: { status: "ACCEPTED" },
        _sum: { grandTotal: true }
      })
    ]);

    return {
      stats: {
        total,
        draft,
        pending,
        approved,
        sent,
        accepted,
        rejected,
        expiringSoon,
        totalAcceptedValue: parseFloat((acceptedSum._sum.grandTotal || 0).toString())
      }
    };
  });

  // GET /crm/quotations
  fastify.get("/", salesReadPreHandler, async (request, reply) => {
    const {
      search,
      status,
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
        { quotationNumber: { contains: search, mode: "insensitive" } },
        { customerNameSnapshot: { contains: search, mode: "insensitive" } },
        { customerEmailSnapshot: { contains: search, mode: "insensitive" } }
      ];
    }

    if (status) where.status = status;
    if (customerId) where.customerId = customerId;
    if (assignedSalesUserId) where.assignedSalesUserId = assignedSalesUserId;

    const [quotations, totalCount] = await Promise.all([
      prisma.quotation.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip,
        take,
        include: {
          customer: { select: { name: true, customerCode: true } },
          createdBy: { select: { name: true } },
          assignedSalesUser: { select: { name: true } },
          approvals: {
            orderBy: { createdAt: "desc" },
            take: 1,
            include: {
              decidedBy: { select: { name: true, email: true } }
            }
          }
        }
      }),
      prisma.quotation.count({ where })
    ]);

    return {
      quotations,
      total: totalCount,
      page: parseInt(page, 10),
      limit: take
    };
  });

  // GET /crm/quotations/:id
  fastify.get("/:id", salesReadPreHandler, async (request, reply) => {
    const { id } = request.params as { id: string };
    const quotation = await prisma.quotation.findUnique({
      where: { id },
      include: {
        customer: true,
        lead: true,
        salesOrder: true,
        createdBy: { select: { name: true, email: true } },
        assignedSalesUser: { select: { name: true, email: true } },
        items: { include: { material: true } },
        approvals: {
          orderBy: { createdAt: "desc" },
          include: {
            requestedBy: { select: { name: true } },
            decidedBy: { select: { name: true } }
          }
        },
        revisions: {
          orderBy: { version: "desc" },
          include: { createdBy: { select: { name: true } } }
        }
      }
    });

    if (!quotation) return reply.status(404).send({ error: "Quotation not found" });
    return quotation;
  });

  // POST /crm/quotations
  fastify.post("/", salesWritePreHandler, async (request, reply) => {
    const data = QuotationCreateSchema.parse(request.body);
    const actor = request.user as { id: string };

    const customer = await prisma.customer.findUnique({ where: { id: data.customerId } });
    if (!customer) return reply.status(400).send({ error: "Selected Customer not found" });

    // Validate Lead if present
    if (data.leadId) {
      const lead = await prisma.lead.findUnique({ where: { id: data.leadId } });
      if (!lead) return reply.status(400).send({ error: "Selected Lead not found" });
    }

    const { items, subtotal, discount, tax, additionalCharges, grandTotal } = calculatePricing(data.items, data.additionalCharges, data.freight);
    const quotationNumber = await generateQuotationNumber();

    const quotation = await prisma.$transaction(async (tx) => {
      const q = await tx.quotation.create({
        data: {
          quotationNumber,
          customerId: data.customerId,
          leadId: data.leadId || null,
          createdById: actor.id,
          assignedSalesUserId: data.assignedSalesUserId || null,
          validUntil: new Date(data.validUntil),
          status: "PENDING_APPROVAL", // Initial status is WAITING_FOR_APPROVAL
          currency: data.currency,
          subtotal,
          discount,
          tax,
          additionalCharges,
          grandTotal,
          paymentTerms: data.paymentTerms,
          deliveryTerms: data.deliveryTerms,
          notes: data.notes,
          internalNotes: data.internalNotes,
          customerNotes: data.customerNotes,
          customerNameSnapshot: customer.name,
          customerEmailSnapshot: customer.email,
          customerPhoneSnapshot: customer.phone,
          billingAddressSnapshot: customer.billingAddress,
          shippingAddressSnapshot: customer.shippingAddress,
          citySnapshot: customer.city,
          stateSnapshot: customer.state,
          countrySnapshot: customer.country,
          postalCodeSnapshot: customer.postalCode
        }
      });

      // Create items
      for (const item of items) {
        await tx.quotationItem.create({
          data: {
            quotationId: q.id,
            productRef: item.productRef,
            materialId: item.materialId,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discount: item.discount,
            taxRate: item.taxRate,
            taxAmount: item.taxAmount,
            lineSubtotal: item.lineSubtotal,
            lineTotal: item.lineTotal,
            specification: item.specification,
            notes: item.notes
          }
        });
      }

      // Create pending approval record
      await tx.quotationApproval.create({
        data: {
          quotationId: q.id,
          requestedById: actor.id,
          status: "PENDING"
        }
      });

      // Audit Log
      await tx.auditLog.create({
        data: {
          entityType: "quotation",
          entityId: q.id,
          actorId: actor.id,
          action: "QUOTATION_CREATED",
          newStatus: "PENDING_APPROVAL",
          metadata: { quotationNumber, grandTotal }
        }
      });

      return q;
    });

    // Notify Sales Executives that a new quotation is waiting for approval
    await triggerQuotationNotification(
      null,
      "SALES_EXECUTIVE",
      `Quotation ${quotationNumber} has been created and is WAITING FOR APPROVAL.`
    );

    return quotation;
  });

  // PUT /crm/quotations/:id
  fastify.put("/:id", salesWritePreHandler, async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = QuotationUpdateSchema.parse(request.body);
    const actor = request.user as { id: string };

    const quotation = await prisma.quotation.findUnique({ where: { id } });
    if (!quotation) return reply.status(404).send({ error: "Quotation not found" });

    if (quotation.status !== "DRAFT" && quotation.status !== "REJECTED" && quotation.status !== "PENDING_APPROVAL") {
      return reply.status(400).send({ error: `Quotation is in ${quotation.status} state and cannot be modified` });
    }

    const updated = await prisma.$transaction(async (tx) => {
      let calcUpdate: any = {};
      if (data.items) {
        // Recalculate
        const charges = data.additionalCharges !== undefined ? data.additionalCharges : Number(quotation.additionalCharges);
        const freight = data.freight !== undefined ? data.freight : 0;
        const { items, subtotal, discount, tax, additionalCharges, grandTotal } = calculatePricing(data.items, charges, freight);

        // Delete old items
        await tx.quotationItem.deleteMany({ where: { quotationId: id } });

        // Add new items
        for (const item of items) {
          await tx.quotationItem.create({
            data: {
              quotationId: id,
              productRef: item.productRef,
              materialId: item.materialId,
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              discount: item.discount,
              taxRate: item.taxRate,
              taxAmount: item.taxAmount,
              lineSubtotal: item.lineSubtotal,
              lineTotal: item.lineTotal,
              specification: item.specification,
              notes: item.notes
            }
          });
        }

        calcUpdate = { subtotal, discount, tax, additionalCharges, grandTotal };
      } else if (data.additionalCharges !== undefined || data.freight !== undefined) {
        // Recalculate with original items
        const rawItems = await tx.quotationItem.findMany({ where: { quotationId: id } });
        const charges = data.additionalCharges !== undefined ? data.additionalCharges : Number(quotation.additionalCharges);
        const freight = data.freight !== undefined ? data.freight : 0;
        const { subtotal, discount, tax, additionalCharges, grandTotal } = calculatePricing(rawItems, charges, freight);
        calcUpdate = { subtotal, discount, tax, additionalCharges, grandTotal };
      }

      const q = await tx.quotation.update({
        where: { id },
        data: {
          assignedSalesUserId: data.assignedSalesUserId !== undefined ? data.assignedSalesUserId : undefined,
          validUntil: data.validUntil ? new Date(data.validUntil) : undefined,
          currency: data.currency,
          paymentTerms: data.paymentTerms,
          deliveryTerms: data.deliveryTerms,
          notes: data.notes,
          internalNotes: data.internalNotes,
          customerNotes: data.customerNotes,
          ...calcUpdate
        }
      });

      await tx.auditLog.create({
        data: {
          entityType: "quotation",
          entityId: id,
          actorId: actor.id,
          action: "QUOTATION_UPDATED",
          metadata: { updatedFields: Object.keys(data) }
        }
      });

      return q;
    });

    return updated;
  });

  // PUT /crm/quotations/:id/submit
  fastify.put("/:id/submit", salesWritePreHandler, async (request, reply) => {
    const { id } = request.params as { id: string };
    const actor = request.user as { id: string };

    const quotation = await prisma.quotation.findUnique({ where: { id } });
    if (!quotation) return reply.status(404).send({ error: "Quotation not found" });

    if (quotation.status !== "DRAFT" && quotation.status !== "REJECTED") {
      return reply.status(400).send({ error: `Cannot submit quotation in status ${quotation.status}` });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const q = await tx.quotation.update({
        where: { id },
        data: { status: "PENDING_APPROVAL" }
      });

      await tx.quotationApproval.create({
        data: {
          quotationId: id,
          requestedById: actor.id,
          status: "PENDING"
        }
      });

      await tx.auditLog.create({
        data: {
          entityType: "quotation",
          entityId: id,
          actorId: actor.id,
          action: "QUOTATION_SUBMITTED_APPROVAL",
          prevStatus: quotation.status,
          newStatus: "PENDING_APPROVAL"
        }
      });

      return q;
    });

    await triggerQuotationNotification(
      null,
      "SALES_EXECUTIVE",
      `Quotation ${quotation.quotationNumber} has been submitted and is WAITING FOR APPROVAL.`
    );

    return updated;
  });

  // Approval handler logic (shared by PUT & POST)
  const handleApprove = async (request: any, reply: any) => {
    const { id } = request.params as { id: string };
    const { comments } = (request.body || {}) as { comments?: string };
    const actor = request.user as { id: string };

    const quotation = await prisma.quotation.findUnique({ where: { id } });
    if (!quotation) return reply.status(404).send({ error: "Quotation not found" });

    if (quotation.status !== "PENDING_APPROVAL") {
      return reply.status(400).send({
        error: `Quotation is in ${quotation.status} status and cannot be approved. Only quotations WAITING FOR APPROVAL (PENDING_APPROVAL) can be approved.`
      });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const q = await tx.quotation.update({
        where: { id },
        data: { status: "APPROVED" }
      });

      // Update approval record if exists, or create one
      const pendingApproval = await tx.quotationApproval.findFirst({
        where: { quotationId: id, status: "PENDING" }
      });

      if (pendingApproval) {
        await tx.quotationApproval.update({
          where: { id: pendingApproval.id },
          data: {
            status: "APPROVED",
            decidedById: actor.id,
            comments: comments || null
          }
        });
      } else {
        await tx.quotationApproval.create({
          data: {
            quotationId: id,
            requestedById: quotation.createdById,
            decidedById: actor.id,
            status: "APPROVED",
            comments: comments || null
          }
        });
      }

      await tx.auditLog.create({
        data: {
          entityType: "quotation",
          entityId: id,
          actorId: actor.id,
          action: "QUOTATION_APPROVED",
          prevStatus: quotation.status,
          newStatus: "APPROVED",
          metadata: {
            quotationId: id,
            quotationNumber: quotation.quotationNumber,
            approvingUser: actor.id,
            comments: comments || null,
            timestamp: new Date().toISOString()
          }
        }
      });

      return q;
    });

    await triggerQuotationNotification(
      quotation.createdById,
      null,
      `Your quotation ${quotation.quotationNumber} has been APPROVED by Sales Executive.`
    );

    return updated;
  };

  // PUT & POST /crm/quotations/:id/approve
  fastify.put("/:id/approve", approvePreHandler, handleApprove);
  fastify.post("/:id/approve", approvePreHandler, handleApprove);

  // Rejection handler logic (shared by PUT & POST)
  const handleReject = async (request: any, reply: any) => {
    const { id } = request.params as { id: string };
    const { comments, reason } = (request.body || {}) as { comments?: string, reason?: string };
    const actor = request.user as { id: string };

    const finalReason = reason || comments || "Rejected by Sales Reviewer";

    const quotation = await prisma.quotation.findUnique({ where: { id } });
    if (!quotation) return reply.status(404).send({ error: "Quotation not found" });

    if (quotation.status !== "PENDING_APPROVAL") {
      return reply.status(400).send({ error: `Quotation is in ${quotation.status} status and is not waiting for approval.` });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const q = await tx.quotation.update({
        where: { id },
        data: { status: "REJECTED" }
      });

      const pendingApproval = await tx.quotationApproval.findFirst({
        where: { quotationId: id, status: "PENDING" }
      });

      if (pendingApproval) {
        await tx.quotationApproval.update({
          where: { id: pendingApproval.id },
          data: {
            status: "REJECTED",
            decidedById: actor.id,
            comments,
            reason: finalReason
          }
        });
      } else {
        await tx.quotationApproval.create({
          data: {
            quotationId: id,
            requestedById: quotation.createdById,
            decidedById: actor.id,
            status: "REJECTED",
            comments,
            reason: finalReason
          }
        });
      }

      await tx.auditLog.create({
        data: {
          entityType: "quotation",
          entityId: id,
          actorId: actor.id,
          action: "QUOTATION_REJECTED",
          prevStatus: "PENDING_APPROVAL",
          newStatus: "REJECTED",
          metadata: {
            quotationId: id,
            quotationNumber: quotation.quotationNumber,
            rejectingUser: actor.id,
            comments,
            reason: finalReason,
            timestamp: new Date().toISOString()
          }
        }
      });

      return q;
    });

    await triggerQuotationNotification(
      quotation.createdById,
      null,
      `Your quotation ${quotation.quotationNumber} was REJECTED. Reason: ${finalReason}`
    );

    return updated;
  };

  // PUT & POST /crm/quotations/:id/reject
  fastify.put("/:id/reject", approvePreHandler, handleReject);
  fastify.post("/:id/reject", approvePreHandler, handleReject);

  // PUT /crm/quotations/:id/send
  fastify.put("/:id/send", salesWritePreHandler, async (request, reply) => {
    const { id } = request.params as { id: string };
    const actor = request.user as { id: string };

    const quotation = await prisma.quotation.findUnique({ where: { id } });
    if (!quotation) return reply.status(404).send({ error: "Quotation not found" });

    if (quotation.status !== "APPROVED") {
      return reply.status(400).send({ error: `Quotation is in state ${quotation.status}, must be APPROVED to send` });
    }

    const updated = await prisma.quotation.update({
      where: { id },
      data: { status: "SENT" }
    });

    await prisma.auditLog.create({
      data: {
        entityType: "quotation",
        entityId: id,
        actorId: actor.id,
        action: "QUOTATION_SENT",
        prevStatus: "APPROVED",
        newStatus: "SENT"
      }
    });

    return updated;
  });

  // PUT /crm/quotations/:id/accept
  fastify.put("/:id/accept", salesWritePreHandler, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { comments } = request.body as { comments?: string };
    const actor = request.user as { id: string };

    const quotation = await prisma.quotation.findUnique({ where: { id } });
    if (!quotation) return reply.status(404).send({ error: "Quotation not found" });

    if (quotation.status !== "SENT" && quotation.status !== "CUSTOMER_VIEWED") {
      return reply.status(400).send({ error: "Quotation must be in SENT status to accept" });
    }

    // Check expiry
    if (new Date() > new Date(quotation.validUntil)) {
      await prisma.quotation.update({ where: { id }, data: { status: "EXPIRED" } });
      return reply.status(400).send({ error: "Quotation validity has EXPIRED. Please create a revision." });
    }

    const updated = await prisma.quotation.update({
      where: { id },
      data: { status: "ACCEPTED" }
    });

    await prisma.auditLog.create({
      data: {
        entityType: "quotation",
        entityId: id,
        actorId: actor.id,
        action: "QUOTATION_ACCEPTED",
        prevStatus: quotation.status,
        newStatus: "ACCEPTED",
        metadata: { comments }
      }
    });

    await triggerQuotationNotification(
      quotation.createdById,
      null,
      `Quotation ${quotation.quotationNumber} has been ACCEPTED by customer.`
    );

    return updated;
  });

  // PUT /crm/quotations/:id/reject-customer
  fastify.put("/:id/reject-customer", salesWritePreHandler, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { comments } = request.body as { comments?: string };
    const actor = request.user as { id: string };

    const quotation = await prisma.quotation.findUnique({ where: { id } });
    if (!quotation) return reply.status(404).send({ error: "Quotation not found" });

    if (quotation.status !== "SENT" && quotation.status !== "CUSTOMER_VIEWED") {
      return reply.status(400).send({ error: "Quotation must be in SENT status" });
    }

    const updated = await prisma.quotation.update({
      where: { id },
      data: { status: "REJECTED" }
    });

    await prisma.auditLog.create({
      data: {
        entityType: "quotation",
        entityId: id,
        actorId: actor.id,
        action: "QUOTATION_REJECTED_CUSTOMER",
        prevStatus: quotation.status,
        newStatus: "REJECTED",
        metadata: { comments }
      }
    });

    return updated;
  });

  // PUT /crm/quotations/:id/cancel
  fastify.put("/:id/cancel", salesWritePreHandler, async (request, reply) => {
    const { id } = request.params as { id: string };
    const actor = request.user as { id: string };

    const quotation = await prisma.quotation.findUnique({ where: { id } });
    if (!quotation) return reply.status(404).send({ error: "Quotation not found" });

    if (["ACCEPTED", "CANCELLED", "EXPIRED"].includes(quotation.status)) {
      return reply.status(400).send({ error: `Cannot cancel a quotation that is already ${quotation.status}` });
    }

    const updated = await prisma.quotation.update({
      where: { id },
      data: { status: "CANCELLED" }
    });

    await prisma.auditLog.create({
      data: {
        entityType: "quotation",
        entityId: id,
        actorId: actor.id,
        action: "QUOTATION_CANCELLED",
        prevStatus: quotation.status,
        newStatus: "CANCELLED"
      }
    });

    return updated;
  });

  // POST /crm/quotations/:id/revise
  fastify.post("/:id/revise", salesWritePreHandler, async (request, reply) => {
    const { id } = request.params as { id: string };
    const actor = request.user as { id: string };

    const quotation = await prisma.quotation.findUnique({
      where: { id },
      include: { items: true }
    });
    if (!quotation) return reply.status(404).send({ error: "Quotation not found" });

    if (quotation.status !== "APPROVED" && quotation.status !== "SENT" && quotation.status !== "REJECTED" && quotation.status !== "EXPIRED") {
      return reply.status(400).send({ error: `Cannot revise a quotation in ${quotation.status} status` });
    }

    // Capture complete snapshot of current status & details
    const snapshot = {
      status: quotation.status,
      subtotal: parseFloat(quotation.subtotal.toString()),
      discount: parseFloat(quotation.discount.toString()),
      tax: parseFloat(quotation.tax.toString()),
      additionalCharges: parseFloat(quotation.additionalCharges.toString()),
      grandTotal: parseFloat(quotation.grandTotal.toString()),
      paymentTerms: quotation.paymentTerms,
      deliveryTerms: quotation.deliveryTerms,
      validUntil: quotation.validUntil,
      items: quotation.items.map(item => ({
        productRef: item.productRef,
        materialId: item.materialId,
        description: item.description,
        quantity: item.quantity,
        unitPrice: parseFloat(item.unitPrice.toString()),
        discount: parseFloat(item.discount.toString()),
        taxRate: parseFloat(item.taxRate.toString()),
        taxAmount: parseFloat(item.taxAmount.toString()),
        lineSubtotal: parseFloat(item.lineSubtotal.toString()),
        lineTotal: parseFloat(item.lineTotal.toString()),
        specification: item.specification,
        notes: item.notes
      }))
    };

    const revised = await prisma.$transaction(async (tx) => {
      // 1. Log old revision snapshot
      await tx.quotationRevision.create({
        data: {
          quotationId: id,
          version: quotation.version,
          snapshot,
          createdById: actor.id
        }
      });

      // 2. Update current quotation back to DRAFT, increment version count
      const updated = await tx.quotation.update({
        where: { id },
        data: {
          status: "DRAFT",
          version: quotation.version + 1
        }
      });

      await tx.auditLog.create({
        data: {
          entityType: "quotation",
          entityId: id,
          actorId: actor.id,
          action: "QUOTATION_REVISED",
          metadata: { fromVersion: quotation.version, toVersion: quotation.version + 1 }
        }
      });

      return updated;
    });

    return revised;
  });

  // GET /crm/quotations/:id/pdf - Downloads PDF Document
  fastify.get("/:id/pdf", salesReadPreHandler, async (request, reply) => {
    const { id } = request.params as { id: string };
    const quotation = await prisma.quotation.findUnique({
      where: { id },
      include: {
        customer: true,
        items: true
      }
    });

    if (!quotation) return reply.status(404).send({ error: "Quotation not found" });

    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));

    const pdfPromise = new Promise<Buffer>((resolve, reject) => {
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", (err) => reject(err));
    });

    // --- PDF LAYOUT DESIGN ---
    
    // Header Logo/Company Info
    doc.fillColor("#0F172A").fontSize(20).text("KYRA ZAM ERP", 50, 50, { bold: true } as any);
    doc.fontSize(10).fillColor("#475569").text("Industrial Energy Pack Terminals", 50, 75);
    doc.text("Email: operations@kyrazam.com | Phone: +91 90000 00000", 50, 90);

    // Quotation Metadata (Align Right)
    doc.fontSize(16).fillColor("#0F172A").text("COMMERCIAL QUOTATION", 350, 50, { align: "right" } as any);
    doc.fontSize(10).fillColor("#475569");
    doc.text(`Quotation #: ${quotation.quotationNumber}`, 350, 75, { align: "right" } as any);
    doc.text(`Version: Revision ${quotation.version}`, 350, 90, { align: "right" } as any);
    doc.text(`Date: ${new Date(quotation.quotationDate).toLocaleDateString()}`, 350, 105, { align: "right" } as any);
    doc.text(`Valid Until: ${new Date(quotation.validUntil).toLocaleDateString()}`, 350, 120, { align: "right" } as any);

    // Horizontal Rule
    doc.moveTo(50, 140).lineTo(560, 140).strokeColor("#CBD5E1").stroke();

    // Customer & Addresses Card
    doc.fillColor("#0F172A").fontSize(12).text("CUSTOMER BILL-TO / SHIP-TO", 50, 155, { bold: true } as any);
    doc.fontSize(10).fillColor("#334155");
    const custIdText = quotation.customer?.customerCode ? ` [ID: ${quotation.customer.customerCode}]` : "";
    doc.text(`Customer Name: ${quotation.customerNameSnapshot}${custIdText}`, 50, 175);
    doc.text(`Email: ${quotation.customerEmailSnapshot} | Mobile: ${quotation.customerPhoneSnapshot}`, 50, 190);
    
    // Split Address side-by-side
    doc.text("Billing Address:", 50, 215, { bold: true } as any);
    doc.text(quotation.billingAddressSnapshot, 50, 230, { width: 220 });
    doc.text(`${quotation.citySnapshot}, ${quotation.stateSnapshot} - ${quotation.postalCodeSnapshot}`, 50, 255);

    doc.text("Shipping Address:", 320, 215, { bold: true } as any);
    doc.text(quotation.shippingAddressSnapshot, 320, 230, { width: 220 });
    doc.text(`${quotation.citySnapshot}, ${quotation.stateSnapshot} - ${quotation.postalCodeSnapshot}`, 320, 255);

    // Horizontal Rule
    doc.moveTo(50, 285).lineTo(560, 285).strokeColor("#E2E8F0").stroke();

    // Items Table Header
    let y = 300;
    doc.fillColor("#0F172A").fontSize(10).text("Product / Reference", 50, y, { bold: true } as any);
    doc.text("Qty", 230, y, { bold: true } as any);
    doc.text("Unit Price", 275, y, { bold: true } as any);
    doc.text("Disc %", 355, y, { bold: true } as any);
    doc.text("Tax %", 410, y, { bold: true } as any);
    doc.text("Total Amount", 460, y, { bold: true, align: "right" } as any);
    
    doc.moveTo(50, y + 15).lineTo(560, y + 15).strokeColor("#CBD5E1").stroke();
    y += 25;

    // Items Table rows
    doc.fontSize(9).fillColor("#334155");
    for (const item of quotation.items) {
      doc.text(item.productRef || "Material Item", 50, y, { bold: true } as any);
      doc.text(item.description, 50, y + 12, { width: 170, fontStyle: "italic" } as any);
      
      doc.text(item.quantity.toString(), 230, y);
      doc.text(`${quotation.currency} ${parseFloat(item.unitPrice.toString()).toFixed(2)}`, 275, y);
      doc.text(`${parseFloat(item.discount.toString())}%`, 355, y);
      doc.text(`${parseFloat(item.taxRate.toString())}%`, 410, y);
      doc.text(`${quotation.currency} ${parseFloat(item.lineTotal.toString()).toFixed(2)}`, 460, y, { align: "right" } as any);

      y += 35;
      if (y > 680) { // Page Overflow protection
        doc.addPage();
        y = 50;
      }
    }

    doc.moveTo(50, y).lineTo(560, y).strokeColor("#CBD5E1").stroke();
    y += 15;

    // Totals Box (Align Right)
    const subtotalVal = parseFloat(quotation.subtotal.toString());
    const discountVal = parseFloat(quotation.discount.toString());
    const taxableVal = Math.max(0, subtotalVal - discountVal);

    doc.fontSize(10).fillColor("#475569");
    doc.text("Line Items Subtotal:", 300, y);
    doc.text(`${quotation.currency} ${subtotalVal.toFixed(2)}`, 460, y, { align: "right" } as any);
    
    y += 15;
    doc.text("Discount Deductions:", 300, y);
    doc.text(`- ${quotation.currency} ${discountVal.toFixed(2)}`, 460, y, { align: "right" } as any);

    y += 15;
    doc.text("Taxable Amount:", 300, y);
    doc.text(`${quotation.currency} ${taxableVal.toFixed(2)}`, 460, y, { align: "right" } as any);

    y += 15;
    doc.text("Tax Amount (GST):", 300, y);
    doc.text(`+ ${quotation.currency} ${parseFloat(quotation.tax.toString()).toFixed(2)}`, 460, y, { align: "right" } as any);

    if (Number(quotation.additionalCharges) > 0) {
      y += 15;
      doc.text("Freight & Addl Charges:", 300, y);
      doc.text(`+ ${quotation.currency} ${parseFloat(quotation.additionalCharges.toString()).toFixed(2)}`, 460, y, { align: "right" } as any);
    }

    y += 20;
    doc.fillColor("#0F172A").fontSize(12).text("GRAND TOTAL VALUE:", 300, y, { bold: true } as any);
    doc.text(`${quotation.currency} ${parseFloat(quotation.grandTotal.toString()).toFixed(2)}`, 460, y, { bold: true, align: "right" } as any);

    y += 40;
    
    // Terms & Notes Box
    doc.fontSize(10).fillColor("#0F172A").text("COMMERCIAL TERMS & NOTES", 50, y, { bold: true } as any);
    doc.fontSize(9).fillColor("#475569");
    doc.text(`Payment Terms: ${quotation.paymentTerms}`, 50, y + 15);
    doc.text(`Delivery Notes: ${quotation.deliveryTerms}`, 50, y + 30);
    if (quotation.customerNotes) {
      doc.text(`Customer Notes: ${quotation.customerNotes}`, 50, y + 45, { width: 500 });
      if (quotation.notes) {
        doc.text(`Additional Notes: ${quotation.notes}`, 50, y + 60, { width: 500 });
      }
    } else if (quotation.notes) {
      doc.text(`Additional Notes: ${quotation.notes}`, 50, y + 45, { width: 500 });
    }

    doc.end();

    const pdfBuffer = await pdfPromise;

    return reply
      .header("Content-Type", "application/pdf")
      .header("Content-Disposition", `inline; filename="Quotation_${quotation.quotationNumber}.pdf"`)
      .send(pdfBuffer);
  });
}
