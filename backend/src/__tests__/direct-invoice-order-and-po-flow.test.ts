import path from "node:path";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { FastifyInstance } from "fastify";
import { buildTestApp } from "./helpers/buildTestApp";
import { prisma } from "../prisma";

describe("KYRA ZAM 2.0 — Direct Invoice Order & Normal Purchase Order Flow Regression Suite", () => {
  let app: FastifyInstance;
  let adminUser: any;
  let adminToken: string;
  let testVendor: any;
  let testProduct: any;
  let testMaterial: any;
  let realPO: any;
  let realPOItem: any;
  const suffix = Date.now().toString().slice(-6);
  const createdIOIds: string[] = [];
  const createdPOIds: string[] = [];

  const auth = () => ({ authorization: `Bearer ${adminToken}` });

  before(async () => {
    app = await buildTestApp();

    adminUser =
      (await prisma.user.findFirst({ where: { roles: { has: "SUPERADMIN" }, isActive: true } })) ||
      (await prisma.user.findFirst({ where: { roles: { has: "ADMIN" }, isActive: true } }));

    if (!adminUser) {
      adminUser = await prisma.user.create({
        data: {
          name: "Test Admin Direct IO",
          email: `admin.directio.${suffix}@kyrazam.test`,
          passwordHash: "$2a$10$abcdefghijklmnopqrstuvwxyz123456",
          roles: ["SUPERADMIN", "ADMIN"],
          isActive: true
        }
      });
    }

    adminToken = (app as any).jwt.sign({
      id: adminUser.id,
      email: adminUser.email,
      roles: adminUser.roles
    });

    testVendor = await prisma.vendor.findFirst({ where: { isActive: true } });
    if (!testVendor) {
      testVendor = await prisma.vendor.create({
        data: {
          name: `Direct IO Test Vendor ${suffix}`,
          category: "RAW_MATERIAL",
          isActive: true
        }
      });
    }

    testMaterial = await prisma.material.create({
      data: {
        name: `Test Raw Material ${suffix}`,
        sku: `MAT-DIO-${suffix}`,
        category: "RAW_MATERIAL",
        quantity: 100,
        unit: "PCS",
        unitPrice: 100,
        materialType: "NQZ"
      }
    });

    testProduct = await prisma.product.findFirst({ where: { isActive: true } });
    if (!testProduct) {
      testProduct = await prisma.product.create({
        data: {
          name: `Direct IO Test Component ${suffix}`,
          partNumber: `DIO-TEST-${suffix}`,
          category: "BMS",
          brand: "KYRA",
          uin: `KYR-001-KYR-001-DIO-${suffix}`,
          unit: "PCS",
          materialId: testMaterial.id,
          isActive: true
        }
      });
    }

    // Create an approved real Purchase Order via standard API
    const poRes = await app.inject({
      method: "POST",
      url: "/crm/procurement/purchase-orders",
      headers: auth(),
      payload: {
        vendorId: testVendor.id,
        expectedDeliveryDate: new Date(Date.now() + 7 * 86400000).toISOString(),
        paymentTerms: "30 Days Net",
        deliveryTerms: "FOB Pune",
        billingAddress: "KYRA ZAM HQ, Pune",
        deliveryAddress: "KYRA ZAM Factory 1, Chakan",
        items: [
          {
            materialId: testMaterial.id,
            description: testMaterial.name,
            quantityOrdered: 50,
            unitPrice: 100,
            taxRate: 18.0
          }
        ]
      }
    });

    assert.equal(poRes.statusCode, 201, poRes.body);
    realPO = poRes.json();
    createdPOIds.push(realPO.id);
    realPOItem = realPO.items[0];
  });

  after(async () => {
    for (const ioId of createdIOIds) {
      try {
        await prisma.invoiceOrderItem.deleteMany({ where: { invoiceOrderId: ioId } });
        await prisma.invoiceDocument.deleteMany({ where: { invoiceOrderId: ioId } });
        await prisma.auditLog.deleteMany({ where: { entityId: ioId, entityType: "invoice_order" } });
        await prisma.invoiceOrder.deleteMany({ where: { id: ioId } });
      } catch (err) {
        console.warn(`Cleanup failed for IO ${ioId}:`, err);
      }
    }

    for (const poId of createdPOIds) {
      try {
        await prisma.purchaseOrderApproval.deleteMany({ where: { purchaseOrderId: poId } });
        await prisma.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: poId } });
        await prisma.auditLog.deleteMany({ where: { entityId: poId, entityType: "purchase_order" } });
        await prisma.purchaseOrder.deleteMany({ where: { id: poId } });
      } catch (err) {
        console.warn(`Cleanup failed for PO ${poId}:`, err);
      }
    }

    if (testMaterial?.id) {
      try {
        await prisma.material.delete({ where: { id: testMaterial.id } });
      } catch {}
    }

    await app.close();
  });

  // --------------------------------------------------------------------------
  // 1. Guard against pseudo PO IDs on PO lookup endpoint
  // --------------------------------------------------------------------------
  it("1. GET /crm/procurement/purchase-orders/DIRECT returns 404 without crashing", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/crm/procurement/purchase-orders/DIRECT",
      headers: auth()
    });

    assert.equal(res.statusCode, 404);
    const body = JSON.parse(res.body);
    assert.equal(body.error, "Purchase Order not found");
  });

  it("2. GET /crm/procurement/purchase-orders/NONE returns 404 without crashing", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/crm/procurement/purchase-orders/NONE",
      headers: auth()
    });

    assert.equal(res.statusCode, 404);
    const body = JSON.parse(res.body);
    assert.equal(body.error, "Purchase Order not found");
  });

  // --------------------------------------------------------------------------
  // 2. Direct Invoice Order Creation (purchaseOrderId: null, isDirect: true)
  // --------------------------------------------------------------------------
  it("3. Creates a Direct Invoice Order with purchaseOrderId: null and isDirect: true", async () => {
    const supplierInvNum = `INV-DIRECT-${suffix}-01`;
    const res = await app.inject({
      method: "POST",
      url: "/crm/procurement/invoice-orders",
      headers: auth(),
      payload: {
        purchaseOrderId: null,
        isDirect: true,
        vendorId: testVendor.id,
        supplierInvoiceNumber: supplierInvNum,
        invoiceType: "FINAL_TAX_INVOICE",
        currency: "USD",
        paymentMode: "CREDIT",
        submitNow: false,
        items: [
          {
            description: "Direct Component A",
            productId: testProduct.id,
            unit: "PCS",
            invoiceQuantity: 25,
            unitPrice: 200,
            discount: 100,
            taxRate: 18
          }
        ]
      }
    });

    assert.equal(res.statusCode, 201, res.body);
    const body = JSON.parse(res.body);
    createdIOIds.push(body.id);

    assert.equal(body.isDirect, true);
    assert.equal(body.purchaseOrderId, null);
    assert.equal(body.vendorId, testVendor.id);
    assert.equal(body.supplierInvoiceNumber, supplierInvNum);
    assert.equal(body.currency, "USD");

    // Verify database record directly
    const dbRecord = await prisma.invoiceOrder.findUnique({
      where: { id: body.id },
      include: { items: true }
    });

    assert.ok(dbRecord, "Database record must exist");
    assert.equal(dbRecord.isDirect, true);
    assert.equal(dbRecord.purchaseOrderId, null);
    assert.equal(dbRecord.items.length, 1);
    assert.equal(dbRecord.items[0].poItemId, null);

    // Verify no fake PO was created
    const fakePO = await prisma.purchaseOrder.findFirst({
      where: { OR: [{ id: "DIRECT" }, { poNumber: "DIRECT" }] }
    });
    assert.equal(fakePO, null, "No fake PO named DIRECT must exist");
  });

  it("4. Creates Direct Invoice Order with purchaseOrderId: 'DIRECT' fallback handled safely", async () => {
    const supplierInvNum = `INV-DIRECT-${suffix}-02`;
    const res = await app.inject({
      method: "POST",
      url: "/crm/procurement/invoice-orders",
      headers: auth(),
      payload: {
        purchaseOrderId: "DIRECT",
        isDirect: true,
        vendorId: testVendor.id,
        supplierInvoiceNumber: supplierInvNum,
        invoiceType: "FINAL_TAX_INVOICE",
        currency: "INR",
        paymentMode: "CREDIT",
        submitNow: false,
        items: [
          {
            description: "Direct Component B",
            productId: testProduct.id,
            unit: "PCS",
            invoiceQuantity: 10,
            unitPrice: 150,
            taxRate: 18
          }
        ]
      }
    });

    assert.equal(res.statusCode, 201, res.body);
    const body = JSON.parse(res.body);
    createdIOIds.push(body.id);

    assert.equal(body.isDirect, true);
    assert.equal(body.purchaseOrderId, null);

    const dbRecord = await prisma.invoiceOrder.findUnique({ where: { id: body.id } });
    assert.ok(dbRecord);
    assert.equal(dbRecord.isDirect, true);
    assert.equal(dbRecord.purchaseOrderId, null);
  });

  // --------------------------------------------------------------------------
  // 3. Normal PO Flow (real PO lookup and PO-linked Invoice Order)
  // --------------------------------------------------------------------------
  it("5. Real Purchase Order lookup GET /crm/procurement/purchase-orders/:id returns 200 with full details", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/crm/procurement/purchase-orders/${realPO.id}`,
      headers: auth()
    });

    assert.equal(res.statusCode, 200, res.body);
    const body = JSON.parse(res.body);
    assert.equal(body.id, realPO.id);
    assert.equal(body.poNumber, realPO.poNumber);
    assert.equal(body.vendorId, testVendor.id);
    assert.equal(body.status, "APPROVED");
    assert.ok(Array.isArray(body.items) && body.items.length > 0);
  });

  it("6. Creates an Invoice Order linked to a real Purchase Order (isDirect: false)", async () => {
    const supplierInvNum = `INV-PO-${suffix}-01`;
    const res = await app.inject({
      method: "POST",
      url: "/crm/procurement/invoice-orders",
      headers: auth(),
      payload: {
        purchaseOrderId: realPO.id,
        isDirect: false,
        vendorId: testVendor.id,
        supplierInvoiceNumber: supplierInvNum,
        invoiceType: "FINAL_TAX_INVOICE",
        currency: realPO.currency,
        paymentMode: "CREDIT",
        submitNow: false,
        items: [
          {
            poItemId: realPOItem.id,
            productId: testProduct.id,
            description: "Matched PO Line Item",
            unit: "PCS",
            invoiceQuantity: 30,
            unitPrice: 100,
            taxRate: 18
          }
        ]
      }
    });

    assert.equal(res.statusCode, 201, res.body);
    const body = JSON.parse(res.body);
    createdIOIds.push(body.id);

    assert.equal(body.isDirect, false);
    assert.equal(body.purchaseOrderId, realPO.id);

    const dbRecord = await prisma.invoiceOrder.findUnique({
      where: { id: body.id },
      include: { items: true }
    });

    assert.ok(dbRecord);
    assert.equal(dbRecord.isDirect, false);
    assert.equal(dbRecord.purchaseOrderId, realPO.id);
    assert.equal(dbRecord.items[0].poItemId, realPOItem.id);
  });

  // --------------------------------------------------------------------------
  // 4. Procurement Controls & Validation Safeguards
  // --------------------------------------------------------------------------
  it("7. Reject linking Invoice Order to unapproved draft Purchase Order", async () => {
    const draftPORes = await app.inject({
      method: "POST",
      url: "/crm/procurement/purchase-orders",
      headers: auth(),
      payload: {
        vendorId: testVendor.id,
        isDraft: true,
        expectedDeliveryDate: new Date(Date.now() + 7 * 86400000).toISOString(),
        paymentTerms: "30 Days Net",
        deliveryTerms: "FOB Pune",
        billingAddress: "KYRA ZAM HQ, Pune",
        deliveryAddress: "KYRA ZAM Factory 1, Chakan",
        items: [
          {
            materialId: testMaterial.id,
            description: "Draft line",
            quantityOrdered: 10,
            unitPrice: 100,
            taxRate: 18
          }
        ]
      }
    });
    assert.equal(draftPORes.statusCode, 201);
    const draftPO = draftPORes.json();
    createdPOIds.push(draftPO.id);

    const res = await app.inject({
      method: "POST",
      url: "/crm/procurement/invoice-orders",
      headers: auth(),
      payload: {
        purchaseOrderId: draftPO.id,
        isDirect: false,
        vendorId: testVendor.id,
        supplierInvoiceNumber: `INV-FAIL-${suffix}`,
        items: [
          {
            description: "Should fail line",
            unit: "PCS",
            invoiceQuantity: 10,
            unitPrice: 100
          }
        ]
      }
    });

    assert.equal(res.statusCode, 400);
    const body = JSON.parse(res.body);
    assert.match(body.error, /PO must be approved/i);
  });

  it("8. Reject linking Invoice Order to non-existent Purchase Order ID with 404", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/crm/procurement/invoice-orders",
      headers: auth(),
      payload: {
        purchaseOrderId: "non-existent-po-id-123456",
        isDirect: false,
        vendorId: testVendor.id,
        supplierInvoiceNumber: `INV-NONE-${suffix}`,
        items: [
          {
            description: "Should 404",
            unit: "PCS",
            invoiceQuantity: 5,
            unitPrice: 100
          }
        ]
      }
    });

    assert.equal(res.statusCode, 404);
    const body = JSON.parse(res.body);
    assert.match(body.error, /Purchase Order not found/i);
  });

  it("9. Enforce duplicate supplier invoice number prevention under the same vendor (409)", async () => {
    const duplicateInvNum = `INV-DUP-${suffix}`;

    // Create first IO
    const res1 = await app.inject({
      method: "POST",
      url: "/crm/procurement/invoice-orders",
      headers: auth(),
      payload: {
        isDirect: true,
        vendorId: testVendor.id,
        supplierInvoiceNumber: duplicateInvNum,
        items: [
          {
            description: "First Item",
            unit: "PCS",
            invoiceQuantity: 1,
            unitPrice: 50
          }
        ]
      }
    });
    assert.equal(res1.statusCode, 201);
    const body1 = JSON.parse(res1.body);
    createdIOIds.push(body1.id);

    // Attempt second IO with same supplier invoice number and vendor
    const res2 = await app.inject({
      method: "POST",
      url: "/crm/procurement/invoice-orders",
      headers: auth(),
      payload: {
        isDirect: true,
        vendorId: testVendor.id,
        supplierInvoiceNumber: duplicateInvNum,
        items: [
          {
            description: "Second Item",
            unit: "PCS",
            invoiceQuantity: 1,
            unitPrice: 50
          }
        ]
      }
    });

    assert.equal(res2.statusCode, 409);
    const body2 = JSON.parse(res2.body);
    assert.match(body2.error, /Duplicate invoice numbers are not permitted/i);
  });

  // --------------------------------------------------------------------------
  // 5. Switching between Direct and Real PO in draft update
  // --------------------------------------------------------------------------
  it("10. Updates draft Invoice Order switching between Direct Invoice and real PO without stale state", async () => {
    const invNum = `INV-SWITCH-${suffix}`;

    // 1. Initially create as Direct
    const res1 = await app.inject({
      method: "POST",
      url: "/crm/procurement/invoice-orders",
      headers: auth(),
      payload: {
        isDirect: true,
        purchaseOrderId: null,
        vendorId: testVendor.id,
        supplierInvoiceNumber: invNum,
        submitNow: false,
        items: [
          {
            description: "Draft Direct Item",
            productId: testProduct.id,
            unit: "PCS",
            invoiceQuantity: 10,
            unitPrice: 100
          }
        ]
      }
    });

    assert.equal(res1.statusCode, 201);
    const draftIO = JSON.parse(res1.body);
    createdIOIds.push(draftIO.id);
    assert.equal(draftIO.isDirect, true);
    assert.equal(draftIO.purchaseOrderId, null);

    // 2. Switch draft to link to real Purchase Order
    const res2 = await app.inject({
      method: "PUT",
      url: `/crm/procurement/invoice-orders/${draftIO.id}`,
      headers: auth(),
      payload: {
        purchaseOrderId: realPO.id,
        isDirect: false,
        vendorId: testVendor.id,
        supplierInvoiceNumber: invNum,
        items: [
          {
            poItemId: realPOItem.id,
            productId: testProduct.id,
            description: "Switched to PO line",
            unit: "PCS",
            invoiceQuantity: 15,
            unitPrice: 100
          }
        ]
      }
    });

    assert.equal(res2.statusCode, 200, res2.body);
    const updated1 = await prisma.invoiceOrder.findUnique({
      where: { id: draftIO.id },
      include: { items: true }
    });
    assert.ok(updated1);
    assert.equal(updated1.isDirect, false);
    assert.equal(updated1.purchaseOrderId, realPO.id);
    assert.equal(updated1.items[0].poItemId, realPOItem.id);

    // 3. Switch draft back to Direct Invoice (without PO)
    const res3 = await app.inject({
      method: "PUT",
      url: `/crm/procurement/invoice-orders/${draftIO.id}`,
      headers: auth(),
      payload: {
        purchaseOrderId: null,
        isDirect: true,
        vendorId: testVendor.id,
        supplierInvoiceNumber: invNum,
        items: [
          {
            description: "Switched back to Direct line",
            productId: testProduct.id,
            unit: "PCS",
            invoiceQuantity: 20,
            unitPrice: 100
          }
        ]
      }
    });

    assert.equal(res3.statusCode, 200, res3.body);
    const updated2 = await prisma.invoiceOrder.findUnique({
      where: { id: draftIO.id },
      include: { items: true }
    });
    assert.ok(updated2);
    assert.equal(updated2.isDirect, true);
    assert.equal(updated2.purchaseOrderId, null);
    assert.equal(updated2.items[0].poItemId, null);
  });
});
