import { FastifyInstance } from "fastify";
import { prisma } from "../prisma";
import { requireRoles } from "../middleware/rbac";
import { InvoiceCreateSchema, PaymentCreateSchema, PaymentVerificationRejectSchema } from "../schemas/zod.schemas";
import { Prisma } from "../generated/client";
import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import { pipeline } from "stream";
import util from "util";

const pump = util.promisify(pipeline);

// Sequential numbering helpers
async function generateInvoiceNumber() {
  const last = await prisma.invoice.findFirst({ orderBy: { invoiceNumber: 'desc' } });
  let next = 1;
  if (last) {
    const match = last.invoiceNumber.match(/\d+/);
    if (match) next = parseInt(match[0], 10) + 1;
  }
  return `INV-${String(next).padStart(6, '0')}`;
}

async function generatePaymentReference() {
  const last = await prisma.payment.findFirst({ orderBy: { paymentReference: 'desc' } });
  let next = 1;
  if (last) {
    const match = last.paymentReference.match(/\d+/);
    if (match) next = parseInt(match[0], 10) + 1;
  }
  return `PAY-${String(next).padStart(6, '0')}`;
}

export async function financeRoutes(fastify: FastifyInstance) {
  const accountantPreHandler = { preHandler: [requireRoles("ACCOUNTANT", "ADMIN", "SUPERADMIN")] };
  const financePreHandler = { preHandler: [requireRoles("INVENTORY_MANAGER", "PURCHASE_MANAGER", "ACCOUNTANT", "ADMIN", "SUPERADMIN")] };
  const paymentSubmitPreHandler = { preHandler: [requireRoles("MARKETING_MANAGER", "SALES_EXECUTIVE", "ACCOUNTANT", "ADMIN", "SUPERADMIN")] };
  const readPreHandler = { preHandler: [requireRoles("INVENTORY_MANAGER", "PURCHASE_MANAGER", "SALES_EXECUTIVE", "MARKETING_MANAGER", "ACCOUNTANT", "ADMIN", "SUPERADMIN")] };

  // GET /crm/finance/dashboard
  fastify.get("/dashboard", readPreHandler, async (request, reply) => {
    const issuedInvoices = await prisma.invoice.findMany({
      where: { status: { in: ["ISSUED", "PARTIALLY_PAID", "PAID"] } }
    });

    let totalInvoiced = new Prisma.Decimal(0);
    let totalCollected = new Prisma.Decimal(0);
    let totalOutstanding = new Prisma.Decimal(0);
    let overdueCount = 0;

    const now = new Date();

    for (const inv of issuedInvoices) {
      totalInvoiced = totalInvoiced.add(inv.grandTotal);
      totalCollected = totalCollected.add(inv.paidAmount);
      totalOutstanding = totalOutstanding.add(inv.outstandingAmount);

      if (inv.outstandingAmount.gt(0) && new Date(inv.dueDate) < now) {
        overdueCount++;
      }
    }

    const [draftCount, issuedCount, partialCount, paidCount] = await Promise.all([
      prisma.invoice.count({ where: { status: "DRAFT" } }),
      prisma.invoice.count({ where: { status: "ISSUED" } }),
      prisma.invoice.count({ where: { status: "PARTIALLY_PAID" } }),
      prisma.invoice.count({ where: { status: "PAID" } })
    ]);

    return {
      stats: {
        totalInvoiced: totalInvoiced.toNumber(),
        totalCollected: totalCollected.toNumber(),
        totalOutstanding: totalOutstanding.toNumber(),
        overdueCount,
        draftCount,
        issuedCount,
        partialCount,
        paidCount
      }
    };
  });

  // GET /crm/finance/invoices
  fastify.get("/invoices", readPreHandler, async (request, reply) => {
    const { status, customerId } = request.query as any;
    const where: any = {};
    if (status) where.status = status;
    if (customerId) where.customerId = customerId;

    const invoices = await prisma.invoice.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        customer: { select: { name: true } },
        salesOrder: {
          select: {
            id: true,
            salesOrderNumber: true,
            isFinancialCleared: true,
            paymentStatus: true,
            grandTotal: true,
            payments: {
              where: { status: "VERIFIED" },
              select: { id: true, amount: true, status: true }
            }
          }
        },
        payments: {
          where: { status: "VERIFIED" },
          select: { id: true, amount: true, status: true }
        }
      }
    });

    // Auto-reconcile any invoice that has received verified payments on SO or invoice
    const reconciled = await Promise.all(
      invoices.map(async (inv) => {
        if (inv.status === "PAID" || inv.status === "VOID") return inv;

        const allVerifiedPayments = [
          ...(inv.payments || []),
          ...(inv.salesOrder?.payments || [])
        ];
        const uniquePayments = new Set<string>();
        let totalPaid = new Prisma.Decimal(0);
        for (const p of allVerifiedPayments) {
          if (!uniquePayments.has(p.id)) {
            uniquePayments.add(p.id);
            totalPaid = totalPaid.add(p.amount);
          }
        }

        if (inv.salesOrder?.isFinancialCleared && totalPaid.lt(inv.grandTotal) && inv.salesOrder.paymentStatus === "PAID") {
          totalPaid = inv.grandTotal;
        }

        if (totalPaid.gt(inv.paidAmount)) {
          const effectivePaid = totalPaid.gte(inv.grandTotal) ? inv.grandTotal : totalPaid;
          const effectiveOutstanding = inv.grandTotal.sub(effectivePaid);
          const nextStatus = effectiveOutstanding.lte(0) ? "PAID" : "PARTIALLY_PAID";

          await prisma.invoice.update({
            where: { id: inv.id },
            data: {
              paidAmount: effectivePaid,
              outstandingAmount: effectiveOutstanding.lt(0) ? new Prisma.Decimal(0) : effectiveOutstanding,
              status: nextStatus
            }
          }).catch(() => {});

          if (inv.salesOrderId) {
            await prisma.payment.updateMany({
              where: { salesOrderId: inv.salesOrderId, invoiceId: null },
              data: { invoiceId: inv.id }
            }).catch(() => {});
          }

          return {
            ...inv,
            paidAmount: effectivePaid,
            outstandingAmount: effectiveOutstanding.lt(0) ? new Prisma.Decimal(0) : effectiveOutstanding,
            status: nextStatus
          };
        }

        return inv;
      })
    );

    return reconciled;
  });

  // GET /crm/finance/invoices/:id
  fastify.get("/invoices/:id", readPreHandler, async (request, reply) => {
    const { id } = request.params as { id: string };
    let inv: any = await prisma.invoice.findUnique({
      where: { id },
      include: {
        customer: true,
        salesOrder: {
          include: {
            payments: {
              include: { recordedBy: { select: { name: true } }, verifiedBy: { select: { name: true } } }
            }
          }
        },
        dispatchOrder: true,
        items: true,
        payments: { include: { recordedBy: { select: { name: true } }, verifiedBy: { select: { name: true } } } }
      }
    });
    if (!inv) return reply.status(404).send({ error: "Invoice not found" });

    // Auto-reconcile if payments exist
    if (inv.status !== "PAID" && inv.status !== "VOID") {
      const verifiedPayments = [
        ...(inv.payments?.filter((p: any) => p.status === "VERIFIED") || []),
        ...(inv.salesOrder?.payments?.filter((p: any) => p.status === "VERIFIED") || [])
      ];
      const uniqueIds = new Set();
      let totalPaid = new Prisma.Decimal(0);
      for (const p of verifiedPayments) {
        if (!uniqueIds.has(p.id)) {
          uniqueIds.add(p.id);
          totalPaid = totalPaid.add(p.amount);
        }
      }
      if (inv.salesOrder?.isFinancialCleared && totalPaid.lt(inv.grandTotal) && inv.salesOrder.paymentStatus === "PAID") {
        totalPaid = inv.grandTotal;
      }

      if (totalPaid.gt(inv.paidAmount)) {
        const effectivePaid = totalPaid.gte(inv.grandTotal) ? inv.grandTotal : totalPaid;
        const effectiveOutstanding = inv.grandTotal.sub(effectivePaid);
        const nextStatus = effectiveOutstanding.lte(0) ? "PAID" : "PARTIALLY_PAID";

        inv = await prisma.invoice.update({
          where: { id: inv.id },
          data: {
            paidAmount: effectivePaid,
            outstandingAmount: effectiveOutstanding.lt(0) ? new Prisma.Decimal(0) : effectiveOutstanding,
            status: nextStatus
          },
          include: {
            customer: true,
            salesOrder: true,
            dispatchOrder: true,
            items: true,
            payments: { include: { recordedBy: { select: { name: true } } } }
          }
        });
      }
    }

    return inv;
  });

  // POST /crm/finance/invoices
  fastify.post("/invoices", financePreHandler, async (request, reply) => {
    const data = InvoiceCreateSchema.parse(request.body);
    const actor = request.user as { id: string };

    const invoiceNumber = await generateInvoiceNumber();

    try {
      const invoice = await prisma.$transaction(async (tx) => {
        let so: any = null;
        if (data.salesOrderId) {
          so = await tx.salesOrder.findUnique({
            where: { id: data.salesOrderId },
            include: { items: true, customer: true, payments: { where: { status: "VERIFIED" } } }
          });
        }

        const billingAddressSnapshot = data.billingAddressSnapshot || so?.billingAddressSnapshot || so?.customer?.billingAddress || "N/A";
        const shippingAddressSnapshot = data.shippingAddressSnapshot || so?.shippingAddressSnapshot || so?.customer?.shippingAddress || "N/A";
        const paymentTerms = data.paymentTerms || so?.paymentTerms || "Full advance";
        const additionalCharges = data.additionalCharges !== undefined ? data.additionalCharges : (so ? Number(so.additionalCharges) : 0);

        let itemsToProcess: any[] = [];
        if (data.items && data.items.length > 0) {
          itemsToProcess = data.items;
        } else if (so && so.items && so.items.length > 0) {
          itemsToProcess = so.items.map((it: any) => ({
            salesOrderItemId: it.id,
            productRef: it.productRef,
            description: it.description,
            quantity: it.quantityOrdered,
            unitPrice: Number(it.unitPrice),
            discount: Number(it.discount || 0),
            taxRate: Number(it.taxRate || 0)
          }));
        }

        if (itemsToProcess.length === 0) {
          throw new Error("No items found to generate invoice");
        }

        let subtotal = new Prisma.Decimal(0);
        let totalDiscount = new Prisma.Decimal(0);
        let totalTax = new Prisma.Decimal(0);

        const itemsData = [];

        for (const item of itemsToProcess) {
          const qty = new Prisma.Decimal(item.quantity);
          const price = new Prisma.Decimal(item.unitPrice);
          const disc = new Prisma.Decimal(item.discount || 0);
          const taxRate = new Prisma.Decimal(item.taxRate || 0);

          const lineSubtotal = qty.mul(price);
          const taxable = lineSubtotal.sub(disc);
          const taxAmt = taxable.mul(taxRate).div(100);
          const lineTotal = taxable.add(taxAmt);

          subtotal = subtotal.add(lineSubtotal);
          totalDiscount = totalDiscount.add(disc);
          totalTax = totalTax.add(taxAmt);

          itemsData.push({
            salesOrderItemId: item.salesOrderItemId || null,
            productRef: item.productRef || null,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discount: item.discount || 0,
            taxRate: item.taxRate || 0,
            taxAmount: taxAmt,
            lineSubtotal,
            lineTotal
          });
        }

        const taxableAmount = subtotal.sub(totalDiscount);
        const grandTotal = taxableAmount.add(totalTax).add(new Prisma.Decimal(additionalCharges));
        
        // Authoritative reconciliation with verified payments on the sales order
        let existingPaid = new Prisma.Decimal(0);
        if (so) {
          const verifiedPayments = so.payments || [];
          const soVerifiedSum = verifiedPayments.reduce((sum: any, p: any) => sum.add(p.amount), new Prisma.Decimal(0));
          if (so.isFinancialCleared && soVerifiedSum.lt(grandTotal) && so.paymentStatus === "PAID") {
            existingPaid = grandTotal;
          } else {
            existingPaid = soVerifiedSum;
          }
        }

        const effectivePaid = existingPaid.gte(grandTotal) ? grandTotal : existingPaid;
        const effectiveOutstanding = grandTotal.sub(effectivePaid);
        let status: string = data.status || "ISSUED";
        if (effectiveOutstanding.lte(0)) {
          status = "PAID";
        } else if (effectivePaid.gt(0)) {
          status = "PARTIALLY_PAID";
        }

        const doc = await tx.invoice.create({
          data: {
            invoiceNumber,
            customerId: data.customerId,
            salesOrderId: data.salesOrderId || null,
            dispatchOrderId: data.dispatchOrderId || null,
            dueDate: new Date(data.dueDate),
            currency: data.currency || "INR",
            subtotal,
            discount: totalDiscount,
            taxableAmount,
            tax: totalTax,
            additionalCharges: new Prisma.Decimal(additionalCharges),
            grandTotal,
            paidAmount: effectivePaid,
            outstandingAmount: effectiveOutstanding.lt(0) ? new Prisma.Decimal(0) : effectiveOutstanding,
            paymentTerms,
            billingAddressSnapshot,
            shippingAddressSnapshot,
            notes: data.notes || null,
            createdById: actor.id,
            status
          }
        });

        // Link existing verified payments to this invoice
        if (data.salesOrderId) {
          await tx.payment.updateMany({
            where: { salesOrderId: data.salesOrderId, invoiceId: null },
            data: { invoiceId: doc.id }
          });
        }

        for (const it of itemsData) {
          await tx.invoiceItem.create({
            data: {
              invoiceId: doc.id,
              ...it
            }
          });
        }

        await tx.auditLog.create({
          data: {
            entityType: "invoice",
            entityId: doc.id,
            actorId: actor.id,
            action: status === "PAID" ? "INVOICE_CREATED_AND_SETTLED" : status === "ISSUED" ? "INVOICE_ISSUED" : "INVOICE_DRAFT_CREATED",
            newStatus: status,
            metadata: { invoiceNumber, paidAmount: effectivePaid.toNumber(), outstandingAmount: effectiveOutstanding.toNumber() }
          }
        });

        return doc;
      });

      return invoice;
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || "Failed to create invoice" });
    }
  });

  // PUT /crm/finance/invoices/:id/issue
  fastify.put("/invoices/:id/issue", financePreHandler, async (request, reply) => {
    const { id } = request.params as { id: string };
    const actor = request.user as { id: string };

    const inv = await prisma.invoice.findUnique({ where: { id } });
    if (!inv) return reply.status(404).send({ error: "Invoice not found" });
    if (inv.status !== "DRAFT") return reply.status(400).send({ error: "Only DRAFT invoices can be issued" });

    const updated = await prisma.invoice.update({
      where: { id },
      data: { status: "ISSUED" }
    });

    await prisma.auditLog.create({
      data: {
        entityType: "invoice",
        entityId: id,
        actorId: actor.id,
        action: "INVOICE_ISSUED",
        prevStatus: "DRAFT",
        newStatus: "ISSUED"
      }
    });

    return updated;
  });

  // POST /crm/finance/invoices/:id/quick-clear (Auto-generate payment & immediately clear customer invoice)
  fastify.post("/invoices/:id/quick-clear", accountantPreHandler, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = (request.body || {}) as any;
    const actor = request.user as { id: string };

    const inv = await prisma.invoice.findUnique({
      where: { id },
      include: { customer: true, salesOrder: true }
    });

    if (!inv) return reply.status(404).send({ error: "Invoice not found" });
    if (inv.status === "VOID") return reply.status(400).send({ error: "Cannot clear a VOID invoice" });
    if (inv.status === "PAID" || inv.outstandingAmount.lte(0)) {
      return reply.status(400).send({ error: "Invoice is already fully settled and cleared" });
    }

    const clearAmount = inv.outstandingAmount;
    const paymentReference = await generatePaymentReference();
    const paymentMethod = body.paymentMethod || "BANK_TRANSFER";
    const referenceNumber = body.referenceNumber || `CLEAR-${inv.invoiceNumber}`;
    const notes = body.notes || `Auto-generated payment settlement for ${inv.invoiceNumber}`;

    try {
      const result = await prisma.$transaction(async (tx) => {
        // 1. Create verified payment for the full outstanding amount
        const payment = await tx.payment.create({
          data: {
            paymentReference,
            customerId: inv.customerId,
            salesOrderId: inv.salesOrderId,
            invoiceId: inv.id,
            amount: clearAmount,
            paymentMethod,
            referenceNumber,
            notes,
            status: "VERIFIED",
            recordedById: actor.id,
            verifiedById: actor.id,
            verifiedAt: new Date()
          }
        });

        // 2. Mark invoice as fully PAID
        const updatedInvoice = await tx.invoice.update({
          where: { id: inv.id },
          data: {
            paidAmount: inv.grandTotal,
            outstandingAmount: new Prisma.Decimal(0),
            status: "PAID"
          }
        });

        // 3. If Sales Order attached, check and grant financial clearance if settled
        let clearedSalesOrder: any = null;
        if (inv.salesOrderId) {
          const allVerifiedPayments = await tx.payment.findMany({
            where: { salesOrderId: inv.salesOrderId, status: "VERIFIED" }
          });
          const totalVerified = allVerifiedPayments.reduce((sum, p) => sum.add(p.amount), new Prisma.Decimal(0));

          const so = await tx.salesOrder.findUnique({ where: { id: inv.salesOrderId } });
          if (so) {
            const isFullPayment = totalVerified.gte(so.grandTotal);
            const soUpdate: any = {
              paymentStatus: isFullPayment ? "PAID" : "PARTIALLY_PAID"
            };
            if (isFullPayment) {
              soUpdate.isFinancialCleared = true;
              soUpdate.financialClearedAt = new Date();
              soUpdate.financialClearedById = actor.id;
              soUpdate.financialOriginalAmount = totalVerified;
            }

            clearedSalesOrder = await tx.salesOrder.update({
              where: { id: so.id },
              data: soUpdate
            });

            if (isFullPayment) {
              await tx.auditLog.create({
                data: {
                  entityType: "sales-order",
                  entityId: so.id,
                  actorId: actor.id,
                  action: "FINANCIAL_CLEARANCE_GRANTED",
                  prevStatus: so.isFinancialCleared ? "CLEARED" : "PENDING_CLEARANCE",
                  newStatus: "CLEARED",
                  metadata: {
                    salesOrderNumber: so.salesOrderNumber,
                    grandTotal: so.grandTotal.toNumber(),
                    totalVerified: totalVerified.toNumber(),
                    source: "INVOICE_QUICK_CLEAR"
                  }
                }
              });
            }
          }
        }

        // 4. Audit Log for Invoice & Payment
        await tx.auditLog.create({
          data: {
            entityType: "invoice",
            entityId: inv.id,
            actorId: actor.id,
            action: "INVOICE_CLEARED_AUTO_PAYMENT",
            prevStatus: inv.status,
            newStatus: "PAID",
            metadata: {
              invoiceNumber: inv.invoiceNumber,
              amountCleared: clearAmount.toNumber(),
              paymentReference
            }
          }
        });

        await tx.auditLog.create({
          data: {
            entityType: "payment",
            entityId: payment.id,
            actorId: actor.id,
            action: "PAYMENT_AUTO_VERIFIED",
            newStatus: "VERIFIED",
            metadata: {
              paymentReference,
              amount: clearAmount.toNumber(),
              invoiceId: inv.id
            }
          }
        });

        return { payment, updatedInvoice, clearedSalesOrder };
      });

      // Notification
      const clearMsg = `Invoice ${inv.invoiceNumber} for ${inv.customer?.name || "Customer"} was cleared with payment ${result.payment.paymentReference} (₹${clearAmount.toString()}).`;
      const targetRoles = ["ACCOUNTANT", "ADMIN", "SUPERADMIN", "MARKETING_MANAGER", "SALES_EXECUTIVE"];
      for (const r of targetRoles) {
        await prisma.notification.create({
          data: {
            role: r as any,
            message: clearMsg,
            channel: "IN_APP",
            status: "SENT"
          }
        });
      }

      try {
        const { wsManager } = require("../websocket/manager");
        await wsManager.broadcastToRoles(targetRoles, "notification", { message: clearMsg });
      } catch (e) {
        console.warn("WebSocket broadcast failed:", e);
      }

      return {
        message: "Invoice successfully settled and cleared",
        payment: result.payment,
        invoice: result.updatedInvoice
      };
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || "Failed to auto-clear invoice" });
    }
  });

  // GET /crm/finance/invoices/:id/pdf - Downloads Invoice PDF Document
  fastify.get("/invoices/:id/pdf", readPreHandler, async (request, reply) => {
    const { id } = request.params as { id: string };
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        customer: true,
        salesOrder: true,
        items: true,
        payments: true
      }
    });

    if (!invoice) return reply.status(404).send({ error: "Invoice not found" });

    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));

    const pdfPromise = new Promise<Buffer>((resolve, reject) => {
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", (err) => reject(err));
    });

    // Header Logo/Company Info
    doc.fillColor("#0F172A").fontSize(20).text("KYRA ZAM ERP", 50, 50, { bold: true } as any);
    doc.fontSize(10).fillColor("#475569").text("Industrial Energy Pack Terminals", 50, 75);
    doc.text("Email: operations@kyrazam.com | Phone: +91 90000 00000", 50, 90);

    // Invoice Metadata (Align Right)
    doc.fontSize(16).fillColor("#0F172A").text("TAX INVOICE", 350, 50, { align: "right" } as any);
    doc.fontSize(10).fillColor("#475569");
    doc.text(`Invoice #: ${invoice.invoiceNumber}`, 350, 75, { align: "right" } as any);
    if (invoice.salesOrder?.salesOrderNumber) {
      doc.text(`Sales Order #: ${invoice.salesOrder.salesOrderNumber}`, 350, 90, { align: "right" } as any);
    }
    doc.text(`Invoice Date: ${new Date(invoice.invoiceDate).toLocaleDateString()}`, 350, 105, { align: "right" } as any);
    doc.text(`Due Date: ${new Date(invoice.dueDate).toLocaleDateString()}`, 350, 120, { align: "right" } as any);
    doc.text(`Status: ${invoice.status}`, 350, 135, { align: "right" } as any);

    // Horizontal Rule
    doc.moveTo(50, 155).lineTo(560, 155).strokeColor("#CBD5E1").stroke();

    // Customer & Addresses Card
    doc.fillColor("#0F172A").fontSize(12).text("BILL TO / SHIP TO", 50, 170, { bold: true } as any);
    doc.fontSize(10).fillColor("#334155");
    doc.text(`Customer Name: ${invoice.customer?.name || "Customer"}`, 50, 190);
    if (invoice.customer?.taxGst) {
      doc.text(`GSTIN: ${invoice.customer.taxGst}`, 50, 205);
    }
    
    // Split Address side-by-side
    doc.text("Billing Address:", 50, 225, { bold: true } as any);
    doc.text(invoice.billingAddressSnapshot || "N/A", 50, 240, { width: 220 });

    doc.text("Shipping Address:", 320, 225, { bold: true } as any);
    doc.text(invoice.shippingAddressSnapshot || "N/A", 320, 240, { width: 220 });

    // Horizontal Rule
    doc.moveTo(50, 290).lineTo(560, 290).strokeColor("#E2E8F0").stroke();

    // Items Table Header
    let y = 305;
    doc.fillColor("#0F172A").fontSize(10).text("Product / Item Description", 50, y, { bold: true } as any);
    doc.text("Qty", 250, y, { bold: true } as any);
    doc.text("Unit Price", 300, y, { bold: true } as any);
    doc.text("Tax %", 380, y, { bold: true } as any);
    doc.text("Total Amount", 460, y, { bold: true, align: "right" } as any);
    
    doc.moveTo(50, y + 15).lineTo(560, y + 15).strokeColor("#CBD5E1").stroke();
    y += 25;

    // Items Table rows
    doc.fontSize(9).fillColor("#334155");
    for (const item of invoice.items) {
      doc.text(item.productRef || "Item", 50, y, { bold: true } as any);
      doc.text(item.description, 50, y + 12, { width: 180, fontStyle: "italic" } as any);
      
      doc.text(item.quantity.toString(), 250, y);
      doc.text(`${invoice.currency} ${parseFloat(item.unitPrice.toString()).toFixed(2)}`, 300, y);
      doc.text(`${parseFloat(item.taxRate.toString())}%`, 380, y);
      doc.text(`${invoice.currency} ${parseFloat(item.lineTotal.toString()).toFixed(2)}`, 460, y, { align: "right" } as any);

      y += 35;
      if (y > 680) {
        doc.addPage();
        y = 50;
      }
    }

    doc.moveTo(50, y).lineTo(560, y).strokeColor("#CBD5E1").stroke();
    y += 15;

    // Totals Box
    doc.fontSize(10).fillColor("#475569");
    doc.text("Subtotal:", 320, y);
    doc.text(`${invoice.currency} ${parseFloat(invoice.subtotal.toString()).toFixed(2)}`, 460, y, { align: "right" } as any);
    
    y += 15;
    if (Number(invoice.discount) > 0) {
      doc.text("Discount Deductions:", 320, y);
      doc.text(`- ${invoice.currency} ${parseFloat(invoice.discount.toString()).toFixed(2)}`, 460, y, { align: "right" } as any);
      y += 15;
    }

    doc.text("Tax Amount (GST):", 320, y);
    doc.text(`${invoice.currency} ${parseFloat(invoice.tax.toString()).toFixed(2)}`, 460, y, { align: "right" } as any);

    if (Number(invoice.additionalCharges) > 0) {
      y += 15;
      doc.text("Freight & Additional:", 320, y);
      doc.text(`${invoice.currency} ${parseFloat(invoice.additionalCharges.toString()).toFixed(2)}`, 460, y, { align: "right" } as any);
    }

    y += 20;
    doc.fillColor("#0F172A").fontSize(12).text("GRAND TOTAL VALUE:", 320, y, { bold: true } as any);
    doc.text(`${invoice.currency} ${parseFloat(invoice.grandTotal.toString()).toFixed(2)}`, 460, y, { bold: true, align: "right" } as any);

    y += 20;
    doc.fillColor("#059669").fontSize(10).text("Amount Paid:", 320, y);
    doc.text(`${invoice.currency} ${parseFloat(invoice.paidAmount.toString()).toFixed(2)}`, 460, y, { align: "right" } as any);

    y += 15;
    doc.fillColor(Number(invoice.outstandingAmount) > 0 ? "#DC2626" : "#059669").fontSize(10).text("Balance Due:", 320, y, { bold: true } as any);
    doc.text(`${invoice.currency} ${parseFloat(invoice.outstandingAmount.toString()).toFixed(2)}`, 460, y, { bold: true, align: "right" } as any);

    y += 35;
    
    // Terms & Notes Box
    doc.fontSize(10).fillColor("#0F172A").text("PAYMENT TERMS & BANK DETAILS", 50, y, { bold: true } as any);
    doc.fontSize(9).fillColor("#475569");
    doc.text(`Payment Terms: ${invoice.paymentTerms}`, 50, y + 15);
    doc.text(`Bank: HDFC Bank | A/C: 50200012345678 | IFSC: HDFC0001234`, 50, y + 30);
    if (invoice.notes) {
      doc.text(`Notes: ${invoice.notes}`, 50, y + 45, { width: 500 });
    }

    doc.end();

    const pdfBuffer = await pdfPromise;

    return reply
      .header("Content-Type", "application/pdf")
      .header("Content-Disposition", `inline; filename="Invoice_${invoice.invoiceNumber}.pdf"`)
      .send(pdfBuffer);
  });

  // PUT /crm/finance/invoices/:id/void
  fastify.put("/invoices/:id/void", financePreHandler, async (request, reply) => {
    const { id } = request.params as { id: string };
    const actor = request.user as { id: string };

    const inv = await prisma.invoice.findUnique({ where: { id } });
    if (!inv) return reply.status(404).send({ error: "Invoice not found" });
    if (inv.status === "VOID" || inv.status === "PAID") {
      return reply.status(400).send({ error: "Invoice cannot be voided in current state" });
    }

    const updated = await prisma.invoice.update({
      where: { id },
      data: { status: "VOID" }
    });

    await prisma.auditLog.create({
      data: {
        entityType: "invoice",
        entityId: id,
        actorId: actor.id,
        action: "INVOICE_VOIDED",
        prevStatus: inv.status,
        newStatus: "VOID"
      }
    });

    return updated;
  });


  // --- PAYMENT PROOF UPLOAD & PAYMENTS WORKFLOW ---

  // POST /crm/finance/upload-proof (Proof of payment upload)
  fastify.post("/upload-proof", paymentSubmitPreHandler, async (request, reply) => {
    const data = await request.file();
    if (!data) {
      return reply.status(400).send({ error: "No file provided" });
    }

    const uploadDir = path.join(__dirname, "../../public/uploads/payments");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const ext = path.extname(data.filename) || ".png";
    const fileName = `PAY-PROOF-${Date.now()}-${Math.random().toString(36).substring(2, 8)}${ext}`;
    const filePath = path.join(uploadDir, fileName);

    await pump(data.file, fs.createWriteStream(filePath));

    return { url: `/public/uploads/payments/${fileName}` };
  });

  // GET /crm/finance/payments
  fastify.get("/payments", readPreHandler, async (request, reply) => {
    const { customerId, invoiceId, salesOrderId, status } = request.query as any;
    const where: any = {};
    if (customerId) where.customerId = customerId;
    if (invoiceId) where.invoiceId = invoiceId;
    if (salesOrderId) where.salesOrderId = salesOrderId;
    if (status) where.status = status;

    return prisma.payment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        customer: { select: { id: true, name: true, customerCode: true } },
        salesOrder: { select: { id: true, salesOrderNumber: true, grandTotal: true, isFinancialCleared: true, paymentStatus: true } },
        invoice: { select: { id: true, invoiceNumber: true, grandTotal: true, status: true } },
        recordedBy: { select: { id: true, name: true, email: true } },
        verifiedBy: { select: { id: true, name: true, email: true } }
      }
    });
  });

  // GET /crm/finance/payments/:id
  fastify.get("/payments/:id", readPreHandler, async (request, reply) => {
    const { id } = request.params as { id: string };
    const payment = await prisma.payment.findUnique({
      where: { id },
      include: {
        customer: true,
        salesOrder: {
          include: {
            customer: true,
            payments: {
              include: {
                recordedBy: { select: { name: true } },
                verifiedBy: { select: { name: true } }
              },
              orderBy: { createdAt: "desc" }
            }
          }
        },
        invoice: true,
        recordedBy: { select: { id: true, name: true, email: true } },
        verifiedBy: { select: { id: true, name: true, email: true } }
      }
    });

    if (!payment) return reply.status(404).send({ error: "Payment not found" });
    return payment;
  });

  // POST /crm/finance/payments (Marketing Manager records payment -> PENDING_VERIFICATION)
  fastify.post("/payments", paymentSubmitPreHandler, async (request, reply) => {
    const data = PaymentCreateSchema.parse(request.body);
    const actor = request.user as { id: string };

    const paymentReference = await generatePaymentReference();
    const amt = new Prisma.Decimal(data.amount);

    if (amt.lte(0)) {
      return reply.status(400).send({ error: "Payment amount must be greater than 0" });
    }

    try {
      const result = await prisma.$transaction(async (tx) => {
        let customerId = data.customerId;
        let salesOrder: any = null;
        let invoice: any = null;

        // If Sales Order provided
        if (data.salesOrderId) {
          salesOrder = await tx.salesOrder.findUnique({
            where: { id: data.salesOrderId },
            include: {
              payments: true
            }
          });

          if (!salesOrder) throw new Error("Sales Order not found");
          if (["CANCELLED", "DRAFT"].includes(salesOrder.status)) {
            throw new Error(`Sales Order is in ${salesOrder.status} status and cannot receive payments.`);
          }

          customerId = salesOrder.customerId;

          // Calculate authoritative remaining balance based on verified payments
          const verifiedTotal = salesOrder.payments
            .filter((p: any) => p.status === "VERIFIED")
            .reduce((sum: Prisma.Decimal, p: any) => sum.add(p.amount), new Prisma.Decimal(0));

          const remainingPayable = salesOrder.grandTotal.sub(verifiedTotal);

          if (amt.gt(remainingPayable)) {
            throw new Error(`Payment amount (₹${amt.toString()}) exceeds remaining payable amount (₹${remainingPayable.toString()}).`);
          }
        }

        // If Invoice provided
        if (data.invoiceId) {
          invoice = await tx.invoice.findUnique({
            where: { id: data.invoiceId }
          });

          if (!invoice) throw new Error("Invoice not found");
          if (invoice.status === "DRAFT" || invoice.status === "VOID") {
            throw new Error(`Invoice status ${invoice.status} is not eligible for payment.`);
          }

          if (!customerId) customerId = invoice.customerId;

          if (amt.gt(invoice.outstandingAmount)) {
            throw new Error(`Payment amount exceeds outstanding invoice balance`);
          }
        }

        if (!customerId) {
          throw new Error("Customer ID could not be determined for payment");
        }

        const pay = await tx.payment.create({
          data: {
            paymentReference,
            customerId,
            salesOrderId: data.salesOrderId || null,
            invoiceId: data.invoiceId || null,
            amount: amt,
            paymentMethod: data.paymentMethod,
            referenceNumber: data.referenceNumber || null,
            bankDetails: data.bankDetails || null,
            notes: data.notes || null,
            paymentProofUrl: data.paymentProofUrl || null,
            status: "PENDING_VERIFICATION",
            recordedById: actor.id
          }
        });

        // Audit Log: PAYMENT_SUBMITTED
        await tx.auditLog.create({
          data: {
            entityType: "payment",
            entityId: pay.id,
            actorId: actor.id,
            action: "PAYMENT_SUBMITTED",
            newStatus: "PENDING_VERIFICATION",
            metadata: {
              paymentReference,
              amount: data.amount,
              salesOrderId: data.salesOrderId,
              salesOrderNumber: salesOrder?.salesOrderNumber,
              invoiceId: data.invoiceId
            }
          }
        });

        return { pay, salesOrder, invoice };
      });

      // Send Notification to Accountants & Admins
      const orderRef = result.salesOrder ? `for Sales Order ${result.salesOrder.salesOrderNumber}` : "";
      const notifMsg = `Payment ${result.pay.paymentReference} of ₹${data.amount} ${orderRef} submitted for verification.`;
      const accountantRoles = ["ACCOUNTANT", "ADMIN", "SUPERADMIN"];

      for (const r of accountantRoles) {
        await prisma.notification.create({
          data: {
            role: r as any,
            message: notifMsg,
            channel: "IN_APP",
            status: "SENT"
          }
        });
      }

      try {
        const { wsManager } = require("../websocket/manager");
        await wsManager.broadcastToRoles(accountantRoles, "notification", { message: notifMsg });
      } catch (e) {
        console.warn("WebSocket notification broadcast failed:", e);
      }

      return result.pay;
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || "Failed to record payment" });
    }
  });

  // PUT /crm/finance/payments/:id/verify (Accountant verifies payment & unlocks financial clearance if full)
  fastify.put("/payments/:id/verify", accountantPreHandler, async (request, reply) => {
    const { id } = request.params as { id: string };
    const actor = request.user as { id: string };

    try {
      const result = await prisma.$transaction(async (tx) => {
        // Fetch payment
        const payment = await tx.payment.findUnique({
          where: { id },
          include: {
            salesOrder: true,
            invoice: true
          }
        });

        if (!payment) throw new Error("Payment not found");

        if (payment.status === "VERIFIED") {
          throw new Error("Payment has already been verified.");
        }

        if (payment.status !== "PENDING_VERIFICATION") {
          throw new Error(`Only payments in PENDING_VERIFICATION status can be verified. Current status: ${payment.status}`);
        }

        // 1. Mark payment VERIFIED
        const updatedPayment = await tx.payment.update({
          where: { id },
          data: {
            status: "VERIFIED",
            verifiedById: actor.id,
            verifiedAt: new Date()
          }
        });

        let clearedSalesOrder: any = null;
        let soPaymentStatus: string = "PENDING";

        // 2. If Sales Order attached, recalculate total verified payments & financial clearance
        if (payment.salesOrderId) {
          const allVerifiedPayments = await tx.payment.findMany({
            where: {
              salesOrderId: payment.salesOrderId,
              status: "VERIFIED"
            }
          });

          const totalVerified = allVerifiedPayments.reduce(
            (sum, p) => sum.add(p.amount),
            new Prisma.Decimal(0)
          );

          const so = await tx.salesOrder.findUnique({
            where: { id: payment.salesOrderId }
          });

          if (so) {
            const isFullPayment = totalVerified.gte(so.grandTotal);
            soPaymentStatus = isFullPayment ? "PAID" : totalVerified.gt(0) ? "PARTIALLY_PAID" : "PENDING";

            const soUpdateData: any = {
              paymentStatus: soPaymentStatus
            };

            if (isFullPayment) {
              soUpdateData.isFinancialCleared = true;
              soUpdateData.financialClearedAt = new Date();
              soUpdateData.financialClearedById = actor.id;
              soUpdateData.financialOriginalAmount = totalVerified;
            }

            clearedSalesOrder = await tx.salesOrder.update({
              where: { id: so.id },
              data: soUpdateData
            });

            if (isFullPayment) {
              await tx.auditLog.create({
                data: {
                  entityType: "sales-order",
                  entityId: so.id,
                  actorId: actor.id,
                  action: "FINANCIAL_CLEARANCE_GRANTED",
                  prevStatus: so.isFinancialCleared ? "CLEARED" : "PENDING_CLEARANCE",
                  newStatus: "CLEARED",
                  metadata: {
                    salesOrderNumber: so.salesOrderNumber,
                    grandTotal: so.grandTotal.toNumber(),
                    totalVerified: totalVerified.toNumber(),
                    verifiedBy: actor.id
                  }
                }
              });
            }
          }
        }

        // 3. If Invoice attached, update invoice paid and outstanding amounts
        if (payment.invoiceId) {
          const inv = await tx.invoice.findUnique({
            where: { id: payment.invoiceId }
          });

          if (inv) {
            const nextPaid = inv.paidAmount.add(payment.amount);
            const nextOutstanding = inv.outstandingAmount.sub(payment.amount);
            const nextStatus = nextOutstanding.lte(0) ? "PAID" : "PARTIALLY_PAID";

            await tx.invoice.update({
              where: { id: inv.id },
              data: {
                paidAmount: nextPaid,
                outstandingAmount: nextOutstanding.lt(0) ? new Prisma.Decimal(0) : nextOutstanding,
                status: nextStatus
              }
            });
          }
        }

        // 4. Create Audit Log: PAYMENT_VERIFIED
        await tx.auditLog.create({
          data: {
            entityType: "payment",
            entityId: payment.id,
            actorId: actor.id,
            action: "PAYMENT_VERIFIED",
            prevStatus: "PENDING_VERIFICATION",
            newStatus: "VERIFIED",
            metadata: {
              paymentId: payment.id,
              paymentReference: payment.paymentReference,
              amount: payment.amount.toNumber(),
              salesOrderId: payment.salesOrderId,
              accountant: actor.id,
              timestamp: new Date()
            }
          }
        });

        return { updatedPayment, clearedSalesOrder, originalPayment: payment };
      });

      // Send Notifications
      const { updatedPayment, clearedSalesOrder } = result;

      // Notify submitter & Marketing Managers
      const verifyMsg = `Payment ${updatedPayment.paymentReference} of ₹${updatedPayment.amount} has been verified by Accountant.`;
      const targetMarketing = ["MARKETING_MANAGER", "SALES_EXECUTIVE", "ADMIN", "SUPERADMIN"];
      for (const r of targetMarketing) {
        await prisma.notification.create({
          data: {
            role: r as any,
            message: verifyMsg,
            channel: "IN_APP",
            status: "SENT"
          }
        });
      }

      // If full financial clearance granted, notify production & sales roles
      if (clearedSalesOrder && clearedSalesOrder.isFinancialCleared) {
        const clearMsg = `Sales Order ${clearedSalesOrder.salesOrderNumber} is financially cleared (Full payment ₹${clearedSalesOrder.grandTotal} verified). Production process unlocked.`;
        const prodRoles = ["SUPERVISOR", "MARKETING_MANAGER", "SALES_EXECUTIVE", "ADMIN", "SUPERADMIN"];
        for (const r of prodRoles) {
          await prisma.notification.create({
            data: {
              role: r as any,
              message: clearMsg,
              channel: "IN_APP",
              status: "SENT"
            }
          });
        }
      }

      try {
        const { wsManager } = require("../websocket/manager");
        await wsManager.broadcastToRoles(["MARKETING_MANAGER", "SALES_EXECUTIVE", "ACCOUNTANT", "SUPERVISOR", "ADMIN"], "notification", {
          message: verifyMsg
        });
      } catch (e) {
        console.warn("WebSocket broadcast failed:", e);
      }

      return updatedPayment;
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || "Failed to verify payment" });
    }
  });

  // PUT /crm/finance/payments/:id/reject (Accountant rejects payment with reason)
  fastify.put("/payments/:id/reject", accountantPreHandler, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { reason } = PaymentVerificationRejectSchema.parse(request.body);
    const actor = request.user as { id: string };

    try {
      const result = await prisma.$transaction(async (tx) => {
        const payment = await tx.payment.findUnique({
          where: { id },
          include: { salesOrder: true }
        });

        if (!payment) throw new Error("Payment not found");

        if (payment.status !== "PENDING_VERIFICATION") {
          throw new Error(`Only payments in PENDING_VERIFICATION status can be rejected. Current status: ${payment.status}`);
        }

        const updatedPayment = await tx.payment.update({
          where: { id },
          data: {
            status: "REJECTED",
            rejectionReason: reason,
            verifiedById: actor.id,
            verifiedAt: new Date()
          }
        });

        // Audit Log: PAYMENT_REJECTED
        await tx.auditLog.create({
          data: {
            entityType: "payment",
            entityId: payment.id,
            actorId: actor.id,
            action: "PAYMENT_REJECTED",
            prevStatus: "PENDING_VERIFICATION",
            newStatus: "REJECTED",
            metadata: {
              paymentId: payment.id,
              paymentReference: payment.paymentReference,
              amount: payment.amount.toNumber(),
              salesOrderId: payment.salesOrderId,
              reason,
              accountant: actor.id,
              timestamp: new Date()
            }
          }
        });

        return { updatedPayment, salesOrder: payment.salesOrder };
      });

      // Send rejection notification
      const rejectMsg = `Payment ${result.updatedPayment.paymentReference} (₹${result.updatedPayment.amount}) was REJECTED by Accountant. Reason: ${reason}`;
      const targetRoles = ["MARKETING_MANAGER", "SALES_EXECUTIVE", "ADMIN", "SUPERADMIN"];
      for (const r of targetRoles) {
        await prisma.notification.create({
          data: {
            role: r as any,
            message: rejectMsg,
            channel: "IN_APP",
            status: "SENT"
          }
        });
      }

      try {
        const { wsManager } = require("../websocket/manager");
        await wsManager.broadcastToRoles(targetRoles, "notification", { message: rejectMsg });
      } catch (e) {
        console.warn("WebSocket broadcast failed:", e);
      }

      return result.updatedPayment;
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || "Failed to reject payment" });
    }
  });

  // GET /crm/finance/approved-transactions
  fastify.get("/approved-transactions", readPreHandler, async (request, reply) => {
    const orders = await prisma.salesOrder.findMany({
      where: {
        status: { notIn: ["DRAFT", "CANCELLED"] }
      },
      orderBy: { createdAt: "desc" },
      include: {
        customer: true,
        items: true,
        quotation: {
          include: {
            approvals: {
              where: { status: "APPROVED" },
              include: { decidedBy: { select: { name: true } } }
            }
          }
        },
        invoices: {
          where: { status: { not: "VOID" } }
        },
        payments: {
          include: {
            recordedBy: { select: { name: true } },
            verifiedBy: { select: { name: true } }
          }
        }
      }
    });
    return orders;
  });

  // PUT /crm/finance/sales-orders/:id/clear (Manual Financial Clearance for Admin/Accountant if all conditions met)
  fastify.put("/sales-orders/:id/clear", accountantPreHandler, async (request, reply) => {
    const { id } = request.params as { id: string };
    const actor = request.user as { id: string };

    const order = await prisma.salesOrder.findUnique({
      where: { id },
      include: {
        invoices: { where: { status: { not: "VOID" } } },
        payments: { where: { status: "VERIFIED" } },
        customer: true
      }
    });

    if (!order) return reply.status(404).send({ error: "Sales Order not found" });
    if (order.isFinancialCleared) {
      return reply.status(400).send({ error: "Sales Order is already financially cleared" });
    }

    const totalVerified = order.payments.reduce((sum, p) => sum.add(p.amount), new Prisma.Decimal(0));
    const isPaidInFull = totalVerified.gte(order.grandTotal) || (order.invoices.length > 0 && order.invoices.every(inv => inv.status === "PAID"));

    if (!isPaidInFull) {
      return reply.status(400).send({ 
        error: `Cannot clear order: Total verified payment (₹${totalVerified.toString()}) is less than order total (₹${order.grandTotal.toString()}).` 
      });
    }

    const updated = await prisma.salesOrder.update({
      where: { id },
      data: {
        isFinancialCleared: true,
        financialClearedAt: new Date(),
        financialClearedById: actor.id,
        financialOriginalAmount: totalVerified.gt(0) ? totalVerified : order.grandTotal,
        paymentStatus: "PAID"
      }
    });

    await prisma.auditLog.create({
      data: {
        entityType: "sales-order",
        entityId: id,
        actorId: actor.id,
        action: "FINANCIAL_CLEARANCE_GRANTED",
        prevStatus: "PENDING_CLEARANCE",
        newStatus: "CLEARED",
        metadata: { salesOrderNumber: order.salesOrderNumber, manualOverride: true }
      }
    });

    const message = `Sales Order ${order.salesOrderNumber} is financially cleared and ready for production processing.`;
    const targetRoles = ["SUPERVISOR", "MARKETING_MANAGER", "SALES_EXECUTIVE", "ADMIN", "SUPERADMIN"];
    for (const r of targetRoles) {
      await prisma.notification.create({
        data: {
          role: r as any,
          message,
          channel: "IN_APP",
          status: "SENT"
        }
      });
    }

    try {
      const { wsManager } = require("../websocket/manager");
      await wsManager.broadcastToRoles(targetRoles, "notification", { message });
    } catch (e) {
      console.warn("WebSocket notification broadcast failed:", e);
    }

    return updated;
  });
}
