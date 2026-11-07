import path from "node:path";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import Fastify, { FastifyInstance } from "fastify";
import { authPlugin } from "../plugins/auth";
import { errorHandler } from "../plugins/errorHandler";
import { invoiceOrderRoutes } from "../routes/invoiceOrders";
import { procurementRoutes } from "../routes/procurement";
import { prisma } from "../prisma";

describe("Draft Invoice Order Editing & Modification (PUT /invoice-orders/:id)", () => {
  let app: FastifyInstance;
  let adminToken: string;
  let adminUser: any;
  let testVendor: any;
  let testProduct: any;
  let draftIOId: string;
  const suffix = Date.now().toString().slice(-6);

  const auth = () => ({ authorization: `Bearer ${adminToken}` });

  before(async () => {
    app = Fastify({ logger: false });
    app.setErrorHandler(errorHandler);
    await app.register(authPlugin);
    await app.register(procurementRoutes, { prefix: "/crm/procurement" });
    await app.register(invoiceOrderRoutes, { prefix: "/crm/procurement/invoice-orders" });
    await app.ready();

    adminUser =
      (await prisma.user.findFirst({ where: { roles: { has: "SUPERADMIN" }, isActive: true } })) ||
      (await prisma.user.findFirst({ where: { roles: { has: "ADMIN" }, isActive: true } }));
    assert.ok(adminUser, "Admin user must exist");
    adminToken = (app as any).jwt.sign({ id: adminUser.id, email: adminUser.email, roles: adminUser.roles });

    testVendor = await prisma.vendor.findFirst({ where: { isActive: true } });
    if (!testVendor) {
      testVendor = await prisma.vendor.create({
        data: { name: `Test Vendor ${suffix}`, category: "RAW_MATERIAL", isActive: true }
      });
    }

    testProduct = await prisma.product.findFirst({ where: { isActive: true } });
    if (!testProduct) {
      testProduct = await prisma.product.create({
        data: {
          name: `Test BMS ${suffix}`,
          partNumber: `BMS-TEST-${suffix}`,
          category: "BMS",
          brand: "KYRA",
          uin: `APE-001-KYR-001-BMS-${suffix}`,
          unit: "PCS",
          isActive: true
        }
      });
    }
  });

  after(async () => {
    if (draftIOId) {
      await prisma.invoiceOrderItem.deleteMany({ where: { invoiceOrderId: draftIOId } });
      await prisma.invoiceDocument.deleteMany({ where: { invoiceOrderId: draftIOId } });
      await prisma.auditLog.deleteMany({ where: { entityId: draftIOId, entityType: "invoice_order" } });
      await prisma.invoiceOrder.deleteMany({ where: { id: draftIOId } });
    }
    await app.close();
  });

  it("1. Creates an initial Invoice Order saved as DRAFT", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/crm/procurement/invoice-orders",
      headers: auth(),
      payload: {
        isDirect: true,
        vendorId: testVendor.id,
        supplierInvoiceNumber: `INV-DRAFT-${suffix}`,
        invoiceType: "FINAL_TAX_INVOICE",
        currency: "INR",
        paymentMode: "CREDIT",
        submitNow: false, // Save as draft
        items: [
          {
            description: "Initial Draft Item 1",
            productId: testProduct.id,
            unit: "PCS",
            invoiceQuantity: 10,
            unitPrice: 150,
            discount: 50,
            taxRate: 18
          }
        ]
      }
    });

    assert.equal(res.statusCode, 201, res.body);
    const body = JSON.parse(res.body);
    draftIOId = body.id;
    assert.equal(body.status, "DRAFT");
    assert.equal(body.supplierInvoiceNumber, `INV-DRAFT-${suffix}`);
    assert.equal(Number(body.subtotal), 1450); // 10*150 - 50 = 1450
  });

  it("2. Edits the Draft Invoice Order (PUT /invoice-orders/:id) with updated quantities, lines and invoice number", async () => {
    const res = await app.inject({
      method: "PUT",
      url: `/crm/procurement/invoice-orders/${draftIOId}`,
      headers: auth(),
      payload: {
        isDirect: true,
        vendorId: testVendor.id,
        supplierInvoiceNumber: `INV-MODIFIED-${suffix}`,
        invoiceType: "FINAL_TAX_INVOICE",
        currency: "INR",
        paymentMode: "CREDIT",
        additionalCharges: 100,
        remarks: "Updated during draft stage",
        submitNow: false,
        items: [
          {
            description: "Updated Line Item 1",
            productId: testProduct.id,
            unit: "PCS",
            invoiceQuantity: 20,
            unitPrice: 200,
            discount: 0,
            taxRate: 18
          },
          {
            description: "New Additional Line Item 2",
            unit: "PCS",
            invoiceQuantity: 5,
            unitPrice: 50,
            discount: 10,
            taxRate: 18
          }
        ]
      }
    });

    assert.equal(res.statusCode, 200, res.body);
    const body = JSON.parse(res.body);
    assert.equal(body.status, "DRAFT", "Status must remain DRAFT when submitNow is false");
    assert.equal(body.supplierInvoiceNumber, `INV-MODIFIED-${suffix}`);
    assert.equal(body.remarks, "Updated during draft stage");
    assert.equal(body.items.length, 2, "Items must be replaced with updated lines");
    
    // Check computed grand total:
    // Line 1: 20*200 = 4000, tax 18% = 720, total = 4720
    // Line 2: 5*50 - 10 = 240, tax 18% = 43.2, total = 283.2
    // Charges: 100
    // Grand Total: 4720 + 283.2 + 100 = 5103.2
    assert.equal(Number(body.subtotal), 4240);
    assert.equal(Number(body.tax), 763.2);
    assert.equal(Number(body.additionalCharges), 100);
    assert.equal(Number(body.grandTotal), 5103.2);
  });

  it("3. Verifies audit log was recorded for INVOICE_ORDER_UPDATED", async () => {
    const log = await prisma.auditLog.findFirst({
      where: { entityId: draftIOId, action: "INVOICE_ORDER_UPDATED" },
      orderBy: { timestamp: "desc" }
    });
    assert.ok(log, "Audit log must be created for update");
    assert.equal((log.metadata as any)?.supplierInvoiceNumber, `INV-MODIFIED-${suffix}`);
  });

  it("4. Rejects editing when invoice order is in non-draft status (e.g. APPROVED)", async () => {
    // Temporarily update status to APPROVED to test guard
    await prisma.invoiceOrder.update({
      where: { id: draftIOId },
      data: { status: "APPROVED" }
    });

    const res = await app.inject({
      method: "PUT",
      url: `/crm/procurement/invoice-orders/${draftIOId}`,
      headers: auth(),
      payload: {
        isDirect: true,
        vendorId: testVendor.id,
        supplierInvoiceNumber: `INV-ILLEGAL-${suffix}`,
        items: [{ description: "Illegal", unit: "PCS", invoiceQuantity: 1, unitPrice: 10 }]
      }
    });

    assert.equal(res.statusCode, 400);
    assert.match(JSON.parse(res.body).error, /Only DRAFT or CORRECTION_REQUIRED orders can be changed/);

    // Revert to DRAFT
    await prisma.invoiceOrder.update({
      where: { id: draftIOId },
      data: { status: "DRAFT" }
    });
  });

  it("5. Edits and Submits the Draft (submitNow: true) to PENDING_INVENTORY", async () => {
    const res = await app.inject({
      method: "PUT",
      url: `/crm/procurement/invoice-orders/${draftIOId}`,
      headers: auth(),
      payload: {
        isDirect: true,
        vendorId: testVendor.id,
        supplierInvoiceNumber: `INV-MODIFIED-${suffix}`,
        invoiceType: "FINAL_TAX_INVOICE",
        currency: "INR",
        paymentMode: "CREDIT",
        submitNow: true, // Submit for inward verification
        items: [
          {
            description: "Finalized Line Item",
            productId: testProduct.id,
            unit: "PCS",
            invoiceQuantity: 15,
            unitPrice: 200,
            discount: 0,
            taxRate: 18
          }
        ]
      }
    });

    assert.equal(res.statusCode, 200, res.body);
    const body = JSON.parse(res.body);
    assert.equal(body.status, "PENDING_INVENTORY", "Submitting draft must move to PENDING_INVENTORY");
  });

  it("6. Deleting a draft order via DELETE /invoice-orders/:id works for DRAFT only", async () => {
    // Create a temporary draft order to test deletion
    const createRes = await app.inject({
      method: "POST",
      url: "/crm/procurement/invoice-orders",
      headers: auth(),
      payload: {
        isDirect: true,
        vendorId: testVendor.id,
        supplierInvoiceNumber: `INV-TO-DELETE-${suffix}`,
        submitNow: false,
        items: [{ description: "Delete me", unit: "PCS", invoiceQuantity: 1, unitPrice: 10 }]
      }
    });
    assert.equal(createRes.statusCode, 201);
    const tempId = JSON.parse(createRes.body).id;

    // Delete it
    const delRes = await app.inject({
      method: "DELETE",
      url: `/crm/procurement/invoice-orders/${tempId}`,
      headers: auth()
    });
    assert.equal(delRes.statusCode, 200);
    assert.equal(JSON.parse(delRes.body).success, true);

    const exists = await prisma.invoiceOrder.findUnique({ where: { id: tempId } });
    assert.equal(exists, null, "Record must be deleted from database");
  });
});
