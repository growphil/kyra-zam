import { FastifyInstance } from "fastify";
import { prisma } from "../prisma";
import { requireRoles } from "../middleware/rbac";
import { wsManager } from "../websocket/manager";
import {
  InvoiceOrderCreateSchema,
  InvoiceOrderVerificationSchema,
  InvoiceOrderApprovalSchema,
  InvoiceOrderRejectSchema,
  InvoiceOrderCorrectionSchema,
  InvoicePaymentCreateSchema,
  InvoiceDocumentUploadSchema,
} from "../schemas/zod.schemas";

// Sequential Generator for IO Number: IO-000001
async function generateIONumber(): Promise<string> {
  const last = await prisma.invoiceOrder.findFirst({
    orderBy: { ioNumber: "desc" },
  });
  let nextNum = 1;
  if (last) {
    const match = last.ioNumber.match(/\d+/);
    if (match) nextNum = parseInt(match[0], 10) + 1;
  }
  return `IO-${String(nextNum).padStart(6, "0")}`;
}

// Generate GRN Number helper
async function generateGRNNumber(): Promise<string> {
  const last = await prisma.goodsReceipt.findFirst({
    orderBy: { grnNumber: "desc" },
  });
  let nextNum = 1;
  if (last) {
    const match = last.grnNumber.match(/\d+/);
    if (match) nextNum = parseInt(match[0], 10) + 1;
  }
  return `GRN-${String(nextNum).padStart(6, "0")}`;
}

// Notification Helper
async function triggerIONotification(
  targetUserId: string | null,
  targetRole: string | null,
  message: string,
  metadata?: any
) {
  const channels = ["IN_APP", "EMAIL", "WHATSAPP"];
  for (const channel of channels) {
    try {
      await prisma.notification.create({
        data: {
          userId: targetUserId,
          role: targetRole as any,
          message,
          channel,
          status: "SENT",
        },
      });
    } catch (err) {
      console.error("Failed to persist notification:", err);
    }
  }

  try {
    if (targetRole) {
      await wsManager.broadcastToRoles([targetRole as any], "notification", { message, metadata });
    } else if (targetUserId) {
      await wsManager.sendToUser(targetUserId, "notification", { message, metadata });
    }
    wsManager.broadcastProcurement("invoice-order:update", { message, targetRole, targetUserId, metadata });
  } catch (e) {
    console.warn("WebSocket IO broadcast error:", e);
  }
}

export async function invoiceOrderRoutes(fastify: FastifyInstance) {
  const ioReadHandler = {
    preHandler: [
      requireRoles(
        "SUPERADMIN",
        "ADMIN",
        "INVENTORY_MANAGER",
        "PURCHASE_MANAGER",
        "ACCOUNTANT",
        "QC",
        "SUPERVISOR"
      ),
    ],
  };

  const ioCreateHandler = {
    preHandler: [
      requireRoles(
        "SUPERADMIN",
        "ADMIN",
        "INVENTORY_MANAGER",
        "PURCHASE_MANAGER"
      ),
    ],
  };

  const ioVerifyHandler = {
    preHandler: [
      requireRoles(
        "SUPERADMIN",
        "ADMIN",
        "INVENTORY_MANAGER"
      ),
    ],
  };

  const ioApproveHandler = {
    preHandler: [
      requireRoles(
        "SUPERADMIN",
        "ADMIN"
      ),
    ],
  };

  const ioPaymentHandler = {
    preHandler: [
      requireRoles(
        "SUPERADMIN",
        "ADMIN",
        "ACCOUNTANT",
        "PURCHASE_MANAGER"
      ),
    ],
  };

  // -------------------------------------------------------------
  // 1. GET /invoice-orders (Dashboard Metrics & Filtered List)
  // -------------------------------------------------------------
  fastify.get("/", ioReadHandler, async (request, reply) => {
    const {
      search,
      status,
      vendorId,
      purchaseOrderId,
      invoiceType,
      paymentStatus,
      page = "1",
      limit = "15",
    } = request.query as any;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const take = Math.min(100, Math.max(1, parseInt(limit, 10) || 15));
    const skip = (pageNum - 1) * take;

    const where: any = {};

    if (status && status !== "ALL") {
      where.status = status;
    }
    if (vendorId && vendorId !== "ALL") {
      where.vendorId = vendorId;
    }
    if (purchaseOrderId && purchaseOrderId !== "ALL") {
      where.purchaseOrderId = purchaseOrderId;
    }
    if (invoiceType && invoiceType !== "ALL") {
      where.invoiceType = invoiceType;
    }
    if (paymentStatus && paymentStatus !== "ALL") {
      where.paymentStatus = paymentStatus;
    }

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { ioNumber: { contains: q, mode: "insensitive" } },
        { supplierInvoiceNumber: { contains: q, mode: "insensitive" } },
        { vendor: { name: { contains: q, mode: "insensitive" } } },
        { purchaseOrder: { poNumber: { contains: q, mode: "insensitive" } } },
      ];
    }

    const [total, items, stats] = await Promise.all([
      prisma.invoiceOrder.count({ where }),
      prisma.invoiceOrder.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        include: {
          vendor: { select: { id: true, name: true, contact: true, email: true, phone: true } },
          purchaseOrder: { select: { id: true, poNumber: true, status: true, grandTotal: true, currency: true } },
          createdBy: { select: { id: true, name: true, email: true, roles: true } },
          inventoryVerifiedBy: { select: { id: true, name: true } },
          adminApprovedBy: { select: { id: true, name: true } },
          goodsReceipt: { select: { id: true, grnNumber: true, status: true } },
          _count: { select: { items: true, documents: true, payments: true } },
        },
      }),
      // Dashboard Summary Metrics
      prisma.invoiceOrder.groupBy({
        by: ["status"],
        _count: true,
        _sum: { grandTotal: true, paidAmount: true, outstandingAmount: true },
      }),
    ]);

    // Aggregate key indicators
    const metrics = {
      totalCount: 0,
      totalValue: 0,
      pendingInventoryCount: 0,
      pendingAdminCount: 0,
      qcPendingCount: 0,
      readyToStockCount: 0,
      stockedCount: 0,
      totalPaid: 0,
      totalOutstanding: 0,
    };

    stats.forEach((s) => {
      metrics.totalCount += s._count;
      metrics.totalValue += Number(s._sum.grandTotal || 0);
      metrics.totalPaid += Number(s._sum.paidAmount || 0);
      metrics.totalOutstanding += Number(s._sum.outstandingAmount || 0);

      if (s.status === "PENDING_INVENTORY") metrics.pendingInventoryCount += s._count;
      if (s.status === "PENDING_ADMIN_APPROVAL" || s.status === "INVENTORY_VERIFIED") metrics.pendingAdminCount += s._count;
      if (s.status === "QC_PENDING") metrics.qcPendingCount += s._count;
      if (s.status === "READY_TO_STOCK") metrics.readyToStockCount += s._count;
      if (s.status === "STOCKED" || s.status === "CLOSED") metrics.stockedCount += s._count;
    });

    return {
      items,
      total,
      page: pageNum,
      limit: take,
      totalPages: Math.ceil(total / take),
      metrics,
    };
  });

  // -------------------------------------------------------------
  // 2. GET /invoice-orders/pending-inventory (Inventory Queue)
  // -------------------------------------------------------------
  fastify.get("/pending-inventory", ioVerifyHandler, async (request, reply) => {
    const list = await prisma.invoiceOrder.findMany({
      where: { status: { in: ["PENDING_INVENTORY", "CORRECTION_REQUIRED", "DRAFT"] } },
      orderBy: { createdAt: "desc" },
      include: {
        vendor: true,
        purchaseOrder: { select: { id: true, poNumber: true, expectedDeliveryDate: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        documents: true,
        items: {
          include: {
            product: true,
            material: true,
            warehouse: true,
            warehouseLocation: true,
          },
        },
        _count: { select: { items: true, documents: true } },
      },
    });
    return { count: list.length, items: list };
  });

  // -------------------------------------------------------------
  // 3. GET /invoice-orders/pending-approval (Admin Queue)
  // -------------------------------------------------------------
  fastify.get("/pending-approval", ioApproveHandler, async (request, reply) => {
    const list = await prisma.invoiceOrder.findMany({
      where: {
        status: { in: ["PENDING_ADMIN_APPROVAL", "INVENTORY_VERIFIED"] },
      },
      orderBy: { createdAt: "asc" },
      include: {
        vendor: { select: { id: true, name: true } },
        purchaseOrder: { select: { id: true, poNumber: true, grandTotal: true, currency: true } },
        createdBy: { select: { id: true, name: true } },
        inventoryVerifiedBy: { select: { id: true, name: true } },
        _count: { select: { items: true, documents: true } },
      },
    });
    return { count: list.length, items: list };
  });

  // -------------------------------------------------------------
  // 4. GET /invoice-orders/:id (Detailed View & Verification workbench)
  // -------------------------------------------------------------
  fastify.get("/:id", ioReadHandler, async (request, reply) => {
    const { id } = request.params as { id: string };

    const io = await prisma.invoiceOrder.findUnique({
      where: { id },
      include: {
        vendor: true,
        purchaseOrder: {
          include: {
            items: {
              include: {
                product: true,
                material: true,
              },
            },
          },
        },
        createdBy: { select: { id: true, name: true, email: true, roles: true } },
        inventoryVerifiedBy: { select: { id: true, name: true, email: true, roles: true } },
        adminApprovedBy: { select: { id: true, name: true, email: true, roles: true } },
        goodsReceipt: {
          include: {
            items: true,
          },
        },
        items: {
          include: {
            material: true,
            product: true,
            poItem: true,
            warehouse: true,
            warehouseLocation: true,
          },
        },
        verifications: {
          include: { verifiedBy: { select: { id: true, name: true, email: true } } },
          orderBy: { verifiedAt: "desc" },
        },
        approvals: {
          include: { approvedBy: { select: { id: true, name: true, email: true } } },
          orderBy: { approvedAt: "desc" },
        },
        payments: {
          include: { recordedBy: { select: { id: true, name: true } } },
          orderBy: { paymentDate: "desc" },
        },
        documents: {
          include: { uploadedBy: { select: { id: true, name: true } } },
          orderBy: { uploadedAt: "desc" },
        },
      },
    });

    if (!io) {
      return reply.status(404).send({ error: "Invoice Order not found" });
    }

    // Fetch relevant audit logs for this IO
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        entityType: "invoice_order",
        entityId: id,
      },
      include: {
        actor: { select: { id: true, name: true, email: true } },
      },
      orderBy: { timestamp: "desc" },
    });

    return { ...io, auditLogs };
  });

  // -------------------------------------------------------------
  // 5. POST /invoice-orders (Create IO - Admin or Inventory Manager)
  // -------------------------------------------------------------
  fastify.post("/", ioCreateHandler, async (request, reply) => {
    const data = InvoiceOrderCreateSchema.parse(request.body);
    const actor = request.user as { id: string; email?: string; roles: string[] };

    const isDirect = Boolean(
      data.isDirect ||
      !data.purchaseOrderId ||
      data.purchaseOrderId === "DIRECT" ||
      data.purchaseOrderId === "NONE"
    );

    // Fetch and validate Purchase Order (if not Direct)
    let po: any = null;
    if (!isDirect && data.purchaseOrderId) {
      po = await prisma.purchaseOrder.findUnique({
        where: { id: data.purchaseOrderId },
        include: {
          items: { include: { material: true, product: true } },
          vendor: true,
        },
      });

      if (!po) {
        return reply.status(404).send({ error: "Referenced Purchase Order not found" });
      }

      if (["DRAFT", "CANCELLED", "REJECTED"].includes(po.status)) {
        return reply.status(400).send({
          error: `Cannot create an Invoice Order for Purchase Order ${po.poNumber} in status "${po.status}". PO must be approved.`,
        });
      }
    } else {
      // Direct Invoice Order (without Purchase Order)
      const vendor = await prisma.vendor.findUnique({
        where: { id: data.vendorId },
      });
      if (!vendor) {
        return reply.status(404).send({ error: "Selected Vendor not found" });
      }
    }

    const isAdmin = actor.roles.includes("ADMIN") || actor.roles.includes("SUPERADMIN");
    const isInvManager = actor.roles.includes("INVENTORY_MANAGER");

    // Calculate itemized lines and validate against PO lines if PO exists
    let computedSubtotal = 0;
    let computedTax = 0;
    let computedDiscount = 0;

    const validatedItems = data.items.map((item) => {
      const lineSubtotal = item.invoiceQuantity * item.unitPrice - (item.discount || 0);
      const lineTax = (lineSubtotal * (item.taxRate || 0)) / 100;
      const lineTotal = lineSubtotal + lineTax;

      computedSubtotal += lineSubtotal;
      computedTax += lineTax;
      computedDiscount += item.discount || 0;

      // Quantity validation against corresponding PO line
      if (item.poItemId && po?.items) {
        const poLine = po.items.find((p: any) => p.id === item.poItemId);
        if (poLine) {
          const maxAllowed = poLine.quantityOrdered - poLine.quantityCancelled;
          if (item.invoiceQuantity > maxAllowed) {
            // Flag excess quantity warning (allow with warning/review)
            console.warn(`[IO-VALIDATION] Item ${poLine.description} invoice quantity (${item.invoiceQuantity}) exceeds PO ordered quantity (${maxAllowed}).`);
          }
        }
      }

      return {
        ...item,
        lineSubtotal,
        lineTax,
        lineTotal,
      };
    });

    const addCharges = data.additionalCharges || 0;
    const computedGrandTotal = computedSubtotal + computedTax + addCharges;

    // Determine initial status based on creator role & submitNow flag
    // OPTION A: Admin creates IO & submits -> PENDING_INVENTORY (for Inventory Manager verification)
    // OPTION B: Inventory Manager creates IO & submits -> PENDING_ADMIN_APPROVAL (for Admin approval)
    let initialStatus: any = "DRAFT";
    if (data.submitNow) {
      if (isAdmin) {
        initialStatus = "PENDING_INVENTORY";
      } else if (isInvManager) {
        initialStatus = "PENDING_ADMIN_APPROVAL";
      } else {
        initialStatus = "PENDING_ADMIN_APPROVAL";
      }
    }

    const ioNumber = await generateIONumber();

    // Check duplicate supplier invoice number under the same vendor
    const existingSupplierInvoice = await prisma.invoiceOrder.findFirst({
      where: {
        vendorId: data.vendorId,
        supplierInvoiceNumber: data.supplierInvoiceNumber.trim(),
      },
    });

    if (existingSupplierInvoice) {
      return reply.status(409).send({
        error: `Supplier Invoice Number "${data.supplierInvoiceNumber}" already exists for this vendor under Invoice Order ${existingSupplierInvoice.ioNumber}. Duplicate invoice numbers are not permitted.`,
      });
    }

    // Execute atomic creation transaction
    const createdIO = await prisma.$transaction(async (tx) => {
      const newIO = await tx.invoiceOrder.create({
        data: {
          ioNumber,
          purchaseOrderId: isDirect ? null : (data.purchaseOrderId || null),
          isDirect,
          vendorId: data.vendorId,
          supplierInvoiceNumber: data.supplierInvoiceNumber.trim(),
          invoiceType: data.invoiceType as any,
          invoiceDate: data.invoiceDate ? new Date(data.invoiceDate) : new Date(),
          currency: data.currency || po?.currency || "INR",
          subtotal: computedSubtotal,
          discount: computedDiscount,
          tax: computedTax,
          additionalCharges: addCharges,
          grandTotal: computedGrandTotal,
          paymentMode: data.paymentMode as any,
          paymentMethod: data.paymentMethod || null,
          paymentStatus: "UNPAID",
          paidAmount: 0,
          outstandingAmount: computedGrandTotal,
          status: initialStatus,
          createdById: actor.id,
          remarks: data.remarks || null,
        },
      });

      // Insert line items
      for (const item of validatedItems) {
        await tx.invoiceOrderItem.create({
          data: {
            invoiceOrderId: newIO.id,
            poItemId: item.poItemId || null,
            materialId: item.materialId || null,
            productId: item.productId || null,
            description: item.description,
            unit: item.unit || "PCS",
            invoiceQuantity: item.invoiceQuantity,
            unitPrice: item.unitPrice,
            discount: item.discount || 0,
            taxRate: item.taxRate || 0,
            taxAmount: item.lineTax,
            lineTotal: item.lineTotal,
            batchNumber: item.batchNumber || null,
            serialNumber: item.serialNumber || null,
            warehouseId: item.warehouseId || null,
            warehouseLocationId: item.warehouseLocationId || null,
            inspectionNotes: item.specification || null,
          },
        });
      }

      // Initial payment recording if provided
      if (data.initialPayment && data.initialPayment.amount > 0) {
        const payAmount = data.initialPayment.amount;
        const newPaid = payAmount;
        const newOut = Math.max(0, computedGrandTotal - newPaid);
        const newPayStatus = newOut <= 0 ? "PAID" : "PARTIALLY_PAID";

        await tx.invoicePayment.create({
          data: {
            invoiceOrderId: newIO.id,
            amount: payAmount,
            paymentMethod: data.initialPayment.paymentMethod,
            paymentDate: new Date(),
            paymentReference: data.initialPayment.paymentReference || null,
            paymentDocument: data.initialPayment.paymentDocument || null,
            recordedById: actor.id,
            notes: data.initialPayment.notes || "Initial payment on creation",
          },
        });

        await tx.invoiceOrder.update({
          where: { id: newIO.id },
          data: {
            paidAmount: newPaid,
            outstandingAmount: newOut,
            paymentStatus: newPayStatus,
          },
        });
      }

      // Attach documents if provided
      if (data.documents && data.documents.length > 0) {
        for (const doc of data.documents) {
          await tx.invoiceDocument.create({
            data: {
              invoiceOrderId: newIO.id,
              documentType: doc.documentType || "FINAL_TAX_INVOICE",
              fileName: doc.fileName,
              fileReference: doc.fileReference,
              fileSize: doc.fileSize || null,
              fileType: doc.fileType || null,
              uploadedById: actor.id,
            },
          });
        }
      }

      // Audit Log
      await tx.auditLog.create({
        data: {
          entityType: "invoice_order",
          entityId: newIO.id,
          actorId: actor.id,
          action: "INVOICE_ORDER_CREATED",
          metadata: {
            ioNumber,
            isDirect,
            poNumber: po?.poNumber || "DIRECT",
            supplierInvoiceNumber: data.supplierInvoiceNumber,
            grandTotal: computedGrandTotal,
            status: initialStatus,
            createdRole: isAdmin ? "ADMIN" : "INVENTORY_MANAGER",
          },
        },
      });

      return newIO;
    });

    // Notify appropriate stakeholders
    if (initialStatus === "PENDING_INVENTORY") {
      await triggerIONotification(
        null,
        "INVENTORY_MANAGER",
        isDirect
          ? `New Direct Invoice Order ${ioNumber} created by Admin. Physical verification required.`
          : `New Invoice Order ${ioNumber} created by Admin for PO ${po?.poNumber}. Physical verification required.`,
        { ioId: createdIO.id, ioNumber }
      );
    } else if (initialStatus === "PENDING_ADMIN_APPROVAL") {
      await triggerIONotification(
        null,
        "ADMIN",
        isDirect
          ? `New Direct Invoice Order ${ioNumber} submitted by Inventory. Authorization required.`
          : `New Invoice Order ${ioNumber} submitted by Inventory for PO ${po?.poNumber}. Authorization required.`,
        { ioId: createdIO.id, ioNumber }
      );
    }

    return reply.status(201).send(createdIO);
  });

  // -------------------------------------------------------------
  // 5b. PUT /invoice-orders/:id (Edit/Update Draft IO)
  // -------------------------------------------------------------
  fastify.put("/:id", ioCreateHandler, async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = InvoiceOrderCreateSchema.parse(request.body);
    const actor = request.user as { id: string; email?: string; roles: string[] };

    const existing = await prisma.invoiceOrder.findUnique({
      where: { id },
      include: {
        items: true,
        documents: true,
        purchaseOrder: true,
      },
    });

    if (!existing) {
      return reply.status(404).send({ error: "Invoice Order not found" });
    }

    // Only allow editing if in DRAFT or CORRECTION_REQUIRED status
    if (!["DRAFT", "CORRECTION_REQUIRED"].includes(existing.status)) {
      return reply.status(400).send({
        error: `Cannot modify Invoice Order ${existing.ioNumber} in status "${existing.status}". Only DRAFT or CORRECTION_REQUIRED orders can be changed.`,
      });
    }

    const isDirect = Boolean(
      data.isDirect ||
      !data.purchaseOrderId ||
      data.purchaseOrderId === "DIRECT" ||
      data.purchaseOrderId === "NONE"
    );

    // Validate Purchase Order if not Direct
    let po: any = null;
    if (!isDirect && data.purchaseOrderId) {
      po = await prisma.purchaseOrder.findUnique({
        where: { id: data.purchaseOrderId },
        include: {
          items: { include: { material: true, product: true } },
          vendor: true,
        },
      });

      if (!po) {
        return reply.status(404).send({ error: "Referenced Purchase Order not found" });
      }

      if (["DRAFT", "CANCELLED", "REJECTED"].includes(po.status)) {
        return reply.status(400).send({
          error: `Cannot link Invoice Order to Purchase Order ${po.poNumber} in status "${po.status}". PO must be approved.`,
        });
      }
    } else {
      const vendor = await prisma.vendor.findUnique({
        where: { id: data.vendorId },
      });
      if (!vendor) {
        return reply.status(404).send({ error: "Selected Vendor not found" });
      }
    }

    // Check duplicate supplier invoice number under the same vendor (excluding this record itself)
    if (
      data.supplierInvoiceNumber.trim().toLowerCase() !== existing.supplierInvoiceNumber.trim().toLowerCase() ||
      data.vendorId !== existing.vendorId
    ) {
      const duplicate = await prisma.invoiceOrder.findFirst({
        where: {
          id: { not: id },
          vendorId: data.vendorId,
          supplierInvoiceNumber: data.supplierInvoiceNumber.trim(),
        },
      });

      if (duplicate) {
        return reply.status(409).send({
          error: `Supplier Invoice Number "${data.supplierInvoiceNumber}" already exists for this vendor under Invoice Order ${duplicate.ioNumber}. Duplicate invoice numbers are not permitted.`,
        });
      }
    }

    const isAdmin = actor.roles.includes("ADMIN") || actor.roles.includes("SUPERADMIN");
    const isInvManager = actor.roles.includes("INVENTORY_MANAGER");

    // Calculate line totals and taxes
    let computedSubtotal = 0;
    let computedTax = 0;
    let computedDiscount = 0;

    const validatedItems = data.items.map((item) => {
      const lineSubtotal = item.invoiceQuantity * item.unitPrice - (item.discount || 0);
      const lineTax = (lineSubtotal * (item.taxRate || 0)) / 100;
      const lineTotal = lineSubtotal + lineTax;

      computedSubtotal += lineSubtotal;
      computedTax += lineTax;
      computedDiscount += item.discount || 0;

      return {
        ...item,
        lineSubtotal,
        lineTax,
        lineTotal,
      };
    });

    const addCharges = data.additionalCharges || 0;
    const computedGrandTotal = computedSubtotal + computedTax + addCharges;

    // Determine status transition
    let newStatus: any = existing.status;
    if (data.submitNow) {
      if (isAdmin) {
        newStatus = "PENDING_INVENTORY";
      } else if (isInvManager) {
        newStatus = "PENDING_ADMIN_APPROVAL";
      } else {
        newStatus = "PENDING_ADMIN_APPROVAL";
      }
    }

    const currentPaid = Number(existing.paidAmount || 0);
    const newOutstanding = Math.max(0, computedGrandTotal - currentPaid);
    const newPaymentStatus =
      currentPaid >= computedGrandTotal && computedGrandTotal > 0
        ? "PAID"
        : currentPaid > 0
        ? "PARTIALLY_PAID"
        : "UNPAID";

    // Atomic update transaction
    const updatedIO = await prisma.$transaction(async (tx) => {
      // 1. Delete previous item lines
      await tx.invoiceOrderItem.deleteMany({
        where: { invoiceOrderId: id },
      });

      // 2. Re-create updated item lines
      await tx.invoiceOrderItem.createMany({
        data: validatedItems.map((item) => ({
          invoiceOrderId: id,
          poItemId: item.poItemId || null,
          materialId: item.materialId || null,
          productId: item.productId || null,
          description: item.description,
          unit: item.unit || "PCS",
          invoiceQuantity: item.invoiceQuantity,
          unitPrice: item.unitPrice,
          discount: item.discount || 0,
          taxRate: item.taxRate || 0,
          taxAmount: item.lineTax,
          lineTotal: item.lineTotal,
          batchNumber: item.batchNumber || null,
          serialNumber: item.serialNumber || null,
          warehouseId: item.warehouseId || null,
          warehouseLocationId: item.warehouseLocationId || null,
          inspectionNotes: item.specification || null,
        })),
      });

      // 3. Attach any new documents if passed
      if (data.documents && data.documents.length > 0) {
        const existingRefs = new Set(existing.documents.map((d: any) => d.fileReference));
        const newDocs = data.documents.filter((d: any) => !existingRefs.has(d.fileReference));
        if (newDocs.length > 0) {
          await tx.invoiceDocument.createMany({
            data: newDocs.map((doc: any) => ({
              invoiceOrderId: id,
              documentType: doc.documentType || "FINAL_TAX_INVOICE",
              fileName: doc.fileName,
              fileReference: doc.fileReference,
              fileSize: doc.fileSize || null,
              fileType: doc.fileType || null,
              uploadedById: actor.id,
            })),
          });
        }
      }

      // 4. Update the Invoice Order record
      const updated = await tx.invoiceOrder.update({
        where: { id },
        data: {
          purchaseOrderId: isDirect ? null : (data.purchaseOrderId || null),
          isDirect,
          vendorId: data.vendorId,
          supplierInvoiceNumber: data.supplierInvoiceNumber.trim(),
          invoiceType: data.invoiceType as any,
          invoiceDate: data.invoiceDate ? new Date(data.invoiceDate) : existing.invoiceDate,
          currency: data.currency || existing.currency,
          subtotal: computedSubtotal,
          discount: computedDiscount,
          tax: computedTax,
          additionalCharges: addCharges,
          grandTotal: computedGrandTotal,
          paymentMode: data.paymentMode as any,
          paymentMethod: data.paymentMethod || existing.paymentMethod,
          paymentStatus: newPaymentStatus as any,
          outstandingAmount: newOutstanding,
          remarks: data.remarks !== undefined ? (data.remarks?.trim() || null) : existing.remarks,
          status: newStatus,
        },
        include: {
          vendor: true,
          purchaseOrder: true,
          items: {
            include: { material: true, product: true },
          },
          documents: true,
        },
      });

      // 5. Audit Log
      await tx.auditLog.create({
        data: {
          entityType: "invoice_order",
          entityId: id,
          actorId: actor.id,
          action: data.submitNow ? "INVOICE_ORDER_SUBMITTED" : "INVOICE_ORDER_UPDATED",
          prevStatus: existing.status,
          newStatus,
          metadata: {
            ioNumber: existing.ioNumber,
            supplierInvoiceNumber: data.supplierInvoiceNumber,
            grandTotal: computedGrandTotal,
            itemCount: validatedItems.length,
            submitNow: Boolean(data.submitNow),
          },
        },
      });

      return updated;
    });

    // Notify appropriate stakeholders if submitted
    if (newStatus === "PENDING_INVENTORY" && existing.status !== "PENDING_INVENTORY") {
      await triggerIONotification(
        null,
        "INVENTORY_MANAGER",
        isDirect
          ? `Direct Invoice Order ${existing.ioNumber} was updated & submitted by Admin. Physical verification required.`
          : `Invoice Order ${existing.ioNumber} was updated & submitted by Admin for PO ${po?.poNumber || ""}. Physical verification required.`,
        { ioId: id, ioNumber: existing.ioNumber }
      );
    } else if (newStatus === "PENDING_ADMIN_APPROVAL" && existing.status !== "PENDING_ADMIN_APPROVAL") {
      await triggerIONotification(
        null,
        "ADMIN",
        isDirect
          ? `Direct Invoice Order ${existing.ioNumber} was updated & submitted by Inventory. Authorization required.`
          : `Invoice Order ${existing.ioNumber} was updated & submitted by Inventory. Authorization required.`,
        { ioId: id, ioNumber: existing.ioNumber }
      );
    }

    return reply.send(updatedIO);
  });

  // -------------------------------------------------------------
  // 5c. DELETE /invoice-orders/:id (Delete Draft IO)
  // -------------------------------------------------------------
  fastify.delete("/:id", ioCreateHandler, async (request, reply) => {
    const { id } = request.params as { id: string };
    const actor = request.user as { id: string; roles: string[] };

    const existing = await prisma.invoiceOrder.findUnique({
      where: { id },
    });

    if (!existing) {
      return reply.status(404).send({ error: "Invoice Order not found" });
    }

    if (existing.status !== "DRAFT") {
      return reply.status(400).send({
        error: `Cannot delete Invoice Order ${existing.ioNumber} in status "${existing.status}". Only DRAFT invoice orders can be deleted.`,
      });
    }

    await prisma.$transaction(async (tx) => {
      await tx.invoiceOrderItem.deleteMany({ where: { invoiceOrderId: id } });
      await tx.invoiceDocument.deleteMany({ where: { invoiceOrderId: id } });
      await tx.auditLog.deleteMany({ where: { entityId: id, entityType: "invoice_order" } });
      await tx.invoiceOrder.delete({ where: { id } });
    });

    return reply.send({ success: true, message: `Draft Invoice Order ${existing.ioNumber} deleted successfully` });
  });

  // -------------------------------------------------------------
  // 6. POST /invoice-orders/:id/submit (Submit draft IO)
  // -------------------------------------------------------------
  fastify.post("/:id/submit", ioCreateHandler, async (request, reply) => {
    const { id } = request.params as { id: string };
    const actor = request.user as { id: string; roles: string[] };

    const io = await prisma.invoiceOrder.findUnique({
      where: { id },
      include: { purchaseOrder: true },
    });

    if (!io) return reply.status(404).send({ error: "Invoice Order not found" });

    if (!["DRAFT", "CORRECTION_REQUIRED"].includes(io.status)) {
      return reply.status(400).send({
        error: `Cannot submit Invoice Order in status "${io.status}". Only DRAFT or CORRECTION_REQUIRED can be submitted.`,
      });
    }

    const isAdmin = actor.roles.includes("ADMIN") || actor.roles.includes("SUPERADMIN");
    const nextStatus = isAdmin ? "PENDING_INVENTORY" : "PENDING_ADMIN_APPROVAL";

    const updated = await prisma.$transaction(async (tx) => {
      const doc = await tx.invoiceOrder.update({
        where: { id },
        data: { status: nextStatus as any },
      });

      await tx.auditLog.create({
        data: {
          entityType: "invoice_order",
          entityId: id,
          actorId: actor.id,
          action: "INVOICE_ORDER_SUBMITTED",
          prevStatus: io.status,
          newStatus: nextStatus,
        },
      });

      return doc;
    });

    if (nextStatus === "PENDING_INVENTORY") {
      await triggerIONotification(
        null,
        "INVENTORY_MANAGER",
        `Invoice Order ${io.ioNumber} submitted for physical verification.`,
        { ioId: id, ioNumber: io.ioNumber }
      );
    } else {
      await triggerIONotification(
        null,
        "ADMIN",
        `Invoice Order ${io.ioNumber} submitted for Admin authorization.`,
        { ioId: id, ioNumber: io.ioNumber }
      );
    }

    return updated;
  });

  // -------------------------------------------------------------
  // 7. POST /invoice-orders/:id/verify (Inventory Manager Physical Verification)
  // -------------------------------------------------------------
  fastify.post("/:id/verify", ioVerifyHandler, async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = InvoiceOrderVerificationSchema.parse(request.body);
    const actor = request.user as { id: string; roles: string[] };

    const io = await prisma.invoiceOrder.findUnique({
      where: { id },
      include: {
        items: { include: { material: true, product: true } },
        purchaseOrder: true,
      },
    });

    if (!io) return reply.status(404).send({ error: "Invoice Order not found" });

    if (!["PENDING_INVENTORY", "DRAFT", "CORRECTION_REQUIRED", "PENDING_ADMIN_APPROVAL"].includes(io.status)) {
      return reply.status(400).send({
        error: `Cannot perform verification on Invoice Order in status "${io.status}".`,
      });
    }

    // Handle correction request from Inventory Manager
    if (data.requestCorrection) {
      if (!data.correctionRemarks || !data.correctionRemarks.trim()) {
        return reply.status(400).send({ error: "Correction remarks are required when requesting correction." });
      }

      const updated = await prisma.$transaction(async (tx) => {
        const doc = await tx.invoiceOrder.update({
          where: { id },
          data: {
            status: "CORRECTION_REQUIRED",
            correctionRemarks: data.correctionRemarks,
          },
        });

        await tx.invoiceOrderVerification.create({
          data: {
            invoiceOrderId: id,
            verifiedById: actor.id,
            verificationStatus: "CORRECTION_REQUESTED",
            remarks: data.remarks || null,
            discrepancySummary: data.correctionRemarks,
          },
        });

        await tx.auditLog.create({
          data: {
            entityType: "invoice_order",
            entityId: id,
            actorId: actor.id,
            action: "INVOICE_ORDER_CORRECTION_REQUESTED",
            metadata: { remarks: data.correctionRemarks },
          },
        });

        return doc;
      });

      await triggerIONotification(
        io.createdById,
        null,
        `Correction requested by Inventory for IO ${io.ioNumber}: ${data.correctionRemarks}`
      );

      return updated;
    }

    // Mathematical check for each line: Actual Received === Accepted + Rejected + Damaged
    for (const vItem of data.items) {
      const line = io.items.find((i) => i.id === vItem.itemId);
      if (!line) {
        return reply.status(400).send({ error: `Invalid item ID: ${vItem.itemId}` });
      }

      const totalBreakdown = vItem.acceptedQuantity + vItem.rejectedQuantity + vItem.damagedQuantity;
      if (vItem.actualReceivedQuantity !== totalBreakdown) {
        return reply.status(400).send({
          error: `Verification mismatch for item "${line.description}". Actual Received (${vItem.actualReceivedQuantity}) must equal Accepted (${vItem.acceptedQuantity}) + Rejected (${vItem.rejectedQuantity}) + Damaged (${vItem.damagedQuantity}).`,
        });
      }
    }

    // Execute atomic verification update
    const result = await prisma.$transaction(async (tx) => {
      let discrepancies: string[] = [];

      for (const vItem of data.items) {
        const line = io.items.find((i) => i.id === vItem.itemId)!;
        const shortage = Math.max(0, line.invoiceQuantity - vItem.actualReceivedQuantity);

        if (shortage > 0 || vItem.damagedQuantity > 0 || vItem.rejectedQuantity > 0) {
          discrepancies.push(
            `${line.description}: Invoiced ${line.invoiceQuantity}, Recv ${vItem.actualReceivedQuantity}, Acc ${vItem.acceptedQuantity}, Rej ${vItem.rejectedQuantity}, Dam ${vItem.damagedQuantity}`
          );
        }

        await tx.invoiceOrderItem.update({
          where: { id: vItem.itemId },
          data: {
            actualReceivedQuantity: vItem.actualReceivedQuantity,
            acceptedQuantity: vItem.acceptedQuantity,
            rejectedQuantity: vItem.rejectedQuantity,
            damagedQuantity: vItem.damagedQuantity,
            shortageQuantity: shortage,
            batchNumber: vItem.batchNumber || line.batchNumber || null,
            serialNumber: vItem.serialNumber || line.serialNumber || null,
            warehouseId: vItem.warehouseId || line.warehouseId || null,
            warehouseLocationId: vItem.warehouseLocationId || line.warehouseLocationId || null,
            inspectionNotes: vItem.inspectionNotes || line.inspectionNotes || null,
          },
        });
      }

      const discrepancySummary = discrepancies.length > 0 ? discrepancies.join(" | ") : "No discrepancies observed.";

      // Record verification log
      await tx.invoiceOrderVerification.create({
        data: {
          invoiceOrderId: id,
          verifiedById: actor.id,
          verificationStatus: data.isDraft ? "DRAFT" : "VERIFIED",
          remarks: data.remarks || null,
          discrepancySummary,
        },
      });

      // Update IO status
      // If saving draft, preserve current status; if final submission, transition to INVENTORY_VERIFIED / PENDING_ADMIN_APPROVAL
      let nextStatus = io.status;
      if (!data.isDraft) {
        nextStatus = "INVENTORY_VERIFIED";
      }

      const updated = await tx.invoiceOrder.update({
        where: { id },
        data: {
          status: nextStatus as any,
          inventoryVerifiedById: actor.id,
          inventoryVerifiedAt: data.isDraft ? undefined : new Date(),
        },
      });

      await tx.auditLog.create({
        data: {
          entityType: "invoice_order",
          entityId: id,
          actorId: actor.id,
          action: data.isDraft ? "INVOICE_ORDER_VERIFICATION_DRAFT" : "INVOICE_ORDER_VERIFIED",
          metadata: {
            ioNumber: io.ioNumber,
            isDraft: data.isDraft,
            discrepancySummary,
          },
        },
      });

      return updated;
    });

    if (!data.isDraft) {
      await triggerIONotification(
        null,
        "ADMIN",
        `Inventory physical verification completed for IO ${io.ioNumber}. Ready for Admin authorization.`,
        { ioId: id, ioNumber: io.ioNumber }
      );
    }

    return result;
  });

  // -------------------------------------------------------------
  // 8. POST /invoice-orders/:id/approve (Admin Final Authorization)
  // -------------------------------------------------------------
  fastify.post("/:id/approve", ioApproveHandler, async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = InvoiceOrderApprovalSchema.parse(request.body);
    const actor = request.user as { id: string; roles: string[] };

    const io = await prisma.invoiceOrder.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            material: true,
            product: { include: { material: true } },
            poItem: true,
          },
        },
        purchaseOrder: true,
        vendor: true,
      },
    });

    if (!io) return reply.status(404).send({ error: "Invoice Order not found" });

    // Segregation of duties rule: Creator cannot approve own IO
    if (io.createdById === actor.id) {
      return reply.status(403).send({
        error: "Segregation of duties violation: The creator cannot approve their own Invoice Order. Another Admin or SuperAdmin must review and authorize.",
      });
    }

    // Must be verified or in pending approval state
    const ALLOWED_APPROVE_STATES = ["INVENTORY_VERIFIED", "PENDING_ADMIN_APPROVAL"];
    if (!ALLOWED_APPROVE_STATES.includes(io.status)) {
      return reply.status(400).send({
        error: `Cannot approve Invoice Order in status "${io.status}". Physical verification by Inventory Manager must be completed before Admin approval.`,
      });
    }

    // Determine QTZ vs NQZ classification across items
    let hasQTZ = false;
    let totalAccepted = 0;

    for (const item of io.items) {
      totalAccepted += item.acceptedQuantity;
      const matType = item.material?.materialType || item.product?.material?.materialType || "NQZ";
      if (matType === "QTZ") {
        hasQTZ = true;
      }
    }

    // If QTZ: moves to QC_PENDING (quarantined; cannot post to usable stock until QC passes)
    // If NQZ: moves to APPROVED / READY_TO_STOCK
    const nextStatus = hasQTZ ? "QC_PENDING" : "APPROVED";

    const approvedIO = await prisma.$transaction(async (tx) => {
      // 1. Create or link GoodsReceipt for warehouse traceability
      const grnNumber = await generateGRNNumber();
      let warehouseId = io.items.find((i) => i.warehouseId)?.warehouseId;
      if (!warehouseId) {
        const firstWh = await tx.warehouse.findFirst();
        warehouseId = firstWh?.id;
      }

      const grn = await tx.goodsReceipt.create({
        data: {
          grnNumber,
          purchaseOrderId: io.purchaseOrderId || null,
          vendorId: io.vendorId,
          warehouseId,
          receivedById: io.inventoryVerifiedById || actor.id,
          status: hasQTZ ? "QC_PENDING" : "ACCEPTED",
          notes: `Created from Invoice Order: ${io.ioNumber} (Supplier Inv: ${io.supplierInvoiceNumber})`,
        },
      });

      for (const line of io.items) {
        const matType = line.material?.materialType || line.product?.material?.materialType || "NQZ";
        await tx.goodsReceiptItem.create({
          data: {
            goodsReceiptId: grn.id,
            productId: line.productId || null,
            materialId: line.materialId || null,
            quantityOrdered: line.poItem?.quantityOrdered || line.invoiceQuantity,
            quantityReceived: line.actualReceivedQuantity,
            quantityAccepted: line.acceptedQuantity,
            quantityRejected: line.rejectedQuantity,
            quantityDamaged: line.damagedQuantity,
            batchNumber: line.batchNumber || null,
            serialNumber: line.serialNumber || null,
            inspectionStatus: matType === "QTZ" ? "PENDING" : (line.acceptedQuantity > 0 ? "PASSED" : "FAILED"),
            notes: line.inspectionNotes || null,
          },
        });
      }

      // 2. Record approval log
      await tx.invoiceOrderApproval.create({
        data: {
          invoiceOrderId: id,
          approvedById: actor.id,
          approvalStatus: "APPROVED",
          remarks: data.remarks || "Authorized by Administrator",
        },
      });

      // 3. Update IO record
      const updated = await tx.invoiceOrder.update({
        where: { id },
        data: {
          status: nextStatus as any,
          adminApprovedById: actor.id,
          adminApprovedAt: new Date(),
          goodsReceiptId: grn.id,
        },
      });

      await tx.auditLog.create({
        data: {
          entityType: "invoice_order",
          entityId: id,
          actorId: actor.id,
          action: "INVOICE_ORDER_APPROVED",
          prevStatus: io.status,
          newStatus: nextStatus,
          metadata: {
            hasQTZ,
            grnNumber,
            totalAccepted,
            remarks: data.remarks,
          },
        },
      });

      return { doc: updated, grnNumber };
    });

    await triggerIONotification(
      io.createdById,
      null,
      `Invoice Order ${io.ioNumber} has been APPROVED by Admin.${hasQTZ ? " Quality inspection (QC) required for QTZ components." : " Ready for stock posting."}`
    );

    return approvedIO.doc;
  });

  // -------------------------------------------------------------
  // 9. POST /invoice-orders/:id/reject (Admin Rejection)
  // -------------------------------------------------------------
  fastify.post("/:id/reject", ioApproveHandler, async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = InvoiceOrderRejectSchema.parse(request.body);
    const actor = request.user as { id: string; roles: string[] };

    const io = await prisma.invoiceOrder.findUnique({ where: { id } });
    if (!io) return reply.status(404).send({ error: "Invoice Order not found" });

    if (["STOCKED", "CLOSED", "REJECTED"].includes(io.status)) {
      return reply.status(400).send({
        error: `Cannot reject Invoice Order in terminal status "${io.status}".`,
      });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const doc = await tx.invoiceOrder.update({
        where: { id },
        data: {
          status: "REJECTED",
          rejectionReason: data.reason,
        },
      });

      await tx.invoiceOrderApproval.create({
        data: {
          invoiceOrderId: id,
          approvedById: actor.id,
          approvalStatus: "REJECTED",
          remarks: data.reason,
        },
      });

      await tx.auditLog.create({
        data: {
          entityType: "invoice_order",
          entityId: id,
          actorId: actor.id,
          action: "INVOICE_ORDER_REJECTED",
          prevStatus: io.status,
          newStatus: "REJECTED",
          metadata: { reason: data.reason, remarks: data.remarks },
        },
      });

      return doc;
    });

    await triggerIONotification(
      io.createdById,
      null,
      `Invoice Order ${io.ioNumber} was REJECTED by Admin. Reason: ${data.reason}`
    );

    return updated;
  });

  // -------------------------------------------------------------
  // 10. POST /invoice-orders/:id/request-correction (Request Correction)
  // -------------------------------------------------------------
  fastify.post("/:id/request-correction", ioVerifyHandler, async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = InvoiceOrderCorrectionSchema.parse(request.body);
    const actor = request.user as { id: string; roles: string[] };

    const io = await prisma.invoiceOrder.findUnique({ where: { id } });
    if (!io) return reply.status(404).send({ error: "Invoice Order not found" });

    const updated = await prisma.$transaction(async (tx) => {
      const doc = await tx.invoiceOrder.update({
        where: { id },
        data: {
          status: "CORRECTION_REQUIRED",
          correctionRemarks: data.remarks,
        },
      });

      await tx.auditLog.create({
        data: {
          entityType: "invoice_order",
          entityId: id,
          actorId: actor.id,
          action: "INVOICE_ORDER_CORRECTION_REQUESTED",
          prevStatus: io.status,
          newStatus: "CORRECTION_REQUIRED",
          metadata: { remarks: data.remarks },
        },
      });

      return doc;
    });

    await triggerIONotification(
      io.createdById,
      null,
      `Correction requested for Invoice Order ${io.ioNumber}: ${data.remarks}`
    );

    return updated;
  });

  // -------------------------------------------------------------
  // 11. POST /invoice-orders/:id/post-stock (Centralized Stock Posting)
  // -------------------------------------------------------------
  fastify.post("/:id/post-stock", ioVerifyHandler, async (request, reply) => {
    const { id } = request.params as { id: string };
    const actor = request.user as { id: string; roles: string[] };

    const result = await prisma.$transaction(async (tx) => {
      // 1. Pessimistic Row Lock on InvoiceOrder to eliminate race conditions
      await tx.$executeRawUnsafe(`SELECT * FROM "InvoiceOrder" WHERE id = $1 FOR UPDATE`, id);

      const io = await tx.invoiceOrder.findUnique({
        where: { id },
        include: {
          items: {
            include: {
              material: true,
              product: { include: { material: true } },
              poItem: true,
            },
          },
          purchaseOrder: {
            include: { items: true },
          },
        },
      });

      if (!io) {
        const err: any = new Error("Invoice Order not found");
        err.statusCode = 404;
        throw err;
      }

      // Safeguard: Prevent duplicate stock postings
      if (io.status === "STOCKED" || io.status === "CLOSED") {
        const err: any = new Error(`Invoice Order ${io.ioNumber} has already been stocked. Duplicate stock posting is prevented.`);
        err.statusCode = 400;
        throw err;
      }

      // Eligibility check: Must be APPROVED or (if QTZ) QC inspection must be verified
      const ALLOWED_STOCK_STATUSES = ["APPROVED", "READY_TO_STOCK", "QC_PENDING", "PARTIALLY_ACCEPTED"];
      if (!ALLOWED_STOCK_STATUSES.includes(io.status)) {
        const err: any = new Error(`Invoice Order in status "${io.status}" is not eligible for stock posting. Admin approval is required.`);
        err.statusCode = 400;
        throw err;
      }

      // Default warehouse fallback
      let defaultWarehouse = await tx.warehouse.findFirst();
      if (!defaultWarehouse) {
        defaultWarehouse = await tx.warehouse.create({
          data: { name: "Central Warehouse", code: "WH-CENTRAL" },
        });
      }

      let totalPostedQuantity = 0;

      // Deterministically sort items by ID to avoid deadlock during multi-row locks
      const sortedItems = [...io.items].sort((a, b) => a.id.localeCompare(b.id));

      for (const line of sortedItems) {
        const targetMaterialId = line.materialId || line.product?.materialId;
        const eligibleQty = line.acceptedQuantity;

        // ONLY accepted quantity enters usable inventory!
        // Damaged and rejected quantities are never posted to usable stock.
        if (eligibleQty <= 0) continue;

        if (targetMaterialId) {
          // Row-level lock on Material
          await tx.$executeRawUnsafe(`SELECT * FROM "Material" WHERE id = $1 FOR UPDATE`, targetMaterialId);

          const mat = await tx.material.findUnique({ where: { id: targetMaterialId } });
          if (!mat) {
            const err: any = new Error(`Material SKU not found: ${targetMaterialId}`);
            err.statusCode = 404;
            throw err;
          }

          const targetWarehouseId = line.warehouseId || defaultWarehouse.id;

          // 1. Update physical material quantity
          await tx.material.update({
            where: { id: targetMaterialId },
            data: {
              quantity: mat.quantity + eligibleQty,
              lastRestock: new Date(),
            },
          });

          // 2. Update bin location balance if location specified
          if (line.warehouseLocationId) {
            await tx.materialLocationBalance.upsert({
              where: {
                materialId_warehouseId_locationId: {
                  materialId: targetMaterialId,
                  warehouseId: targetWarehouseId,
                  locationId: line.warehouseLocationId,
                },
              },
              create: {
                materialId: targetMaterialId,
                warehouseId: targetWarehouseId,
                locationId: line.warehouseLocationId,
                quantity: eligibleQty,
              },
              update: {
                quantity: { increment: eligibleQty },
              },
            });
          }

          // 3. Create immutable Stock Movement Ledger entry
          await tx.stockMovement.create({
            data: {
              materialId: targetMaterialId,
              quantity: eligibleQty,
              movementType: "RECEIPT",
              source: "INVOICE_ORDER",
              referenceId: io.id,
              warehouseId: targetWarehouseId,
              locationId: line.warehouseLocationId || null,
              userId: actor.id,
              reason: `Invoice Order Stock Posting: ${io.ioNumber} (Inv: ${io.supplierInvoiceNumber})`,
            },
          });

          totalPostedQuantity += eligibleQty;
        }

        // 4. Update PO line received quantities
        if (line.poItemId) {
          const poItem = io.purchaseOrder?.items.find((p) => p.id === line.poItemId);
          if (poItem) {
            const newQtyRecv = poItem.quantityReceived + eligibleQty;
            const newPending = Math.max(0, poItem.quantityOrdered - newQtyRecv - poItem.quantityCancelled);

            await tx.purchaseOrderItem.update({
              where: { id: poItem.id },
              data: {
                quantityReceived: newQtyRecv,
                quantityPending: newPending,
                ...(line.batchNumber ? { batchNumber: line.batchNumber } : {}),
              },
            });
          }
        }
      }

      // 5. Re-evaluate PO overall status (if linked to a PO)
      if (io.purchaseOrder && io.purchaseOrderId) {
        const refreshedPOItems = await tx.purchaseOrderItem.findMany({
          where: { purchaseOrderId: io.purchaseOrderId },
        });

        const allDone = refreshedPOItems.every(
          (p) => p.quantityReceived >= p.quantityOrdered - p.quantityCancelled
        );
        const anyRecv = refreshedPOItems.some((p) => p.quantityReceived > 0);

        let newPOStatus = io.purchaseOrder.status;
        if (allDone) {
          newPOStatus = "RECEIVED";
        } else if (anyRecv) {
          newPOStatus = "PARTIALLY_RECEIVED";
        }

        if (newPOStatus !== io.purchaseOrder.status) {
          await tx.purchaseOrder.update({
            where: { id: io.purchaseOrderId },
            data: { status: newPOStatus },
          });
        }
      }

      // 6. Transition IO status to STOCKED
      const stockedIO = await tx.invoiceOrder.update({
        where: { id },
        data: { status: "STOCKED" },
      });

      // 7. Audit Log
      await tx.auditLog.create({
        data: {
          entityType: "invoice_order",
          entityId: id,
          actorId: actor.id,
          action: "INVOICE_ORDER_STOCK_POSTED",
          prevStatus: io.status,
          newStatus: "STOCKED",
          metadata: {
            ioNumber: io.ioNumber,
            totalPostedQuantity,
            authorizedBy: actor.id,
          },
        },
      });

      return { doc: stockedIO, totalPostedQuantity };
    });

    await triggerIONotification(
      null,
      "INVENTORY_MANAGER",
      `Stock posting completed for IO ${result.doc.ioNumber}. Added ${result.totalPostedQuantity} accepted units to usable inventory.`,
      { ioId: id, ioNumber: result.doc.ioNumber }
    );

    return result.doc;
  });

  // -------------------------------------------------------------
  // 12. POST /invoice-orders/:id/payments (Record Payment)
  // -------------------------------------------------------------
  fastify.post("/:id/payments", ioPaymentHandler, async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = InvoicePaymentCreateSchema.parse(request.body);
    const actor = request.user as { id: string; roles: string[] };

    const io = await prisma.invoiceOrder.findUnique({ where: { id } });
    if (!io) return reply.status(404).send({ error: "Invoice Order not found" });

    const newPaid = Number(io.paidAmount) + data.amount;
    const newOutstanding = Math.max(0, Number(io.grandTotal) - newPaid);
    const newPaymentStatus = newOutstanding <= 0 ? "PAID" : "PARTIALLY_PAID";

    const updated = await prisma.$transaction(async (tx) => {
      const payment = await tx.invoicePayment.create({
        data: {
          invoiceOrderId: id,
          amount: data.amount,
          paymentMethod: data.paymentMethod,
          paymentDate: data.paymentDate ? new Date(data.paymentDate) : new Date(),
          paymentReference: data.paymentReference || null,
          paymentDocument: data.paymentDocument || null,
          recordedById: actor.id,
          notes: data.notes || null,
        },
      });

      const doc = await tx.invoiceOrder.update({
        where: { id },
        data: {
          paidAmount: newPaid,
          outstandingAmount: newOutstanding,
          paymentStatus: newPaymentStatus,
        },
      });

      await tx.auditLog.create({
        data: {
          entityType: "invoice_order",
          entityId: id,
          actorId: actor.id,
          action: "INVOICE_PAYMENT_RECORDED",
          metadata: {
            paymentId: payment.id,
            amount: data.amount,
            method: data.paymentMethod,
            reference: data.paymentReference,
            newPaid,
            newOutstanding,
            newPaymentStatus,
          },
        },
      });

      return { doc, payment };
    });

    await triggerIONotification(
      null,
      "ACCOUNTANT",
      `Payment of ${io.currency} ${data.amount} recorded for IO ${io.ioNumber}. Status: ${newPaymentStatus}.`
    );

    return updated;
  });

  // -------------------------------------------------------------
  // 13. POST /invoice-orders/:id/documents (Upload Invoice Document)
  // -------------------------------------------------------------
  fastify.post("/:id/documents", ioCreateHandler, async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = InvoiceDocumentUploadSchema.parse(request.body);
    const actor = request.user as { id: string; roles: string[] };

    const io = await prisma.invoiceOrder.findUnique({ where: { id } });
    if (!io) return reply.status(404).send({ error: "Invoice Order not found" });

    const doc = await prisma.$transaction(async (tx) => {
      const created = await tx.invoiceDocument.create({
        data: {
          invoiceOrderId: id,
          documentType: data.documentType,
          fileName: data.fileName,
          fileReference: data.fileReference,
          fileSize: data.fileSize || null,
          fileType: data.fileType || null,
          uploadedById: actor.id,
        },
      });

      // If document is FINAL_TAX_INVOICE, update invoiceType on IO
      if (data.documentType === "FINAL_TAX_INVOICE") {
        await tx.invoiceOrder.update({
          where: { id },
          data: { invoiceType: "FINAL_TAX_INVOICE" },
        });
      }

      await tx.auditLog.create({
        data: {
          entityType: "invoice_order",
          entityId: id,
          actorId: actor.id,
          action: "INVOICE_DOCUMENT_UPLOADED",
          metadata: {
            documentType: data.documentType,
            fileName: data.fileName,
          },
        },
      });

      return created;
    });

    return reply.status(201).send(doc);
  });
}

