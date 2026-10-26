import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { FastifyInstance } from "fastify";
import { buildTestApp } from "./helpers/buildTestApp";
import { procurementRoutes } from "../routes/procurement";
import { prisma } from "../prisma";

describe("KYRA ZAM 2.0 — Admin PO Auto-Approval & Inventory Receiving Workflow", () => {
  let app: FastifyInstance;
  let adminUser: any;
  let superadminUser: any;
  let purchaseManagerUser: any;
  let inventoryManagerUser: any;
  let testVendor: any;
  let nqzMaterial: any;
  let qtzMaterial: any;

  let adminToken: string;
  let superadminToken: string;
  let purchaseManagerToken: string;
  let inventoryManagerToken: string;

  before(async () => {
    app = await buildTestApp();
    await app.listen({ port: 0, host: "127.0.0.1" });

    // Ensure users for roles
    adminUser = await prisma.user.findFirst({
      where: { roles: { has: "ADMIN" }, isActive: true }
    });
    if (!adminUser) {
      adminUser = await prisma.user.create({
        data: {
          name: "Test Admin",
          email: "test.admin@kyrazam.test",
          passwordHash: "$2a$10$abcdefghijklmnopqrstuvwxyz123456",
          roles: ["ADMIN"],
          isActive: true
        }
      });
    }

    superadminUser = await prisma.user.findFirst({
      where: { roles: { has: "SUPERADMIN" }, isActive: true }
    });
    if (!superadminUser) {
      superadminUser = await prisma.user.create({
        data: {
          name: "Test Superadmin",
          email: "test.superadmin@kyrazam.test",
          passwordHash: "$2a$10$abcdefghijklmnopqrstuvwxyz123456",
          roles: ["SUPERADMIN"],
          isActive: true
        }
      });
    }

    purchaseManagerUser = await prisma.user.findFirst({
      where: { roles: { has: "PURCHASE_MANAGER" }, isActive: true }
    });
    if (!purchaseManagerUser) {
      purchaseManagerUser = await prisma.user.create({
        data: {
          name: "Test Purchase Manager",
          email: "test.purchasemanager@kyrazam.test",
          passwordHash: "$2a$10$abcdefghijklmnopqrstuvwxyz123456",
          roles: ["PURCHASE_MANAGER"],
          isActive: true
        }
      });
    }

    inventoryManagerUser = await prisma.user.findFirst({
      where: { roles: { has: "INVENTORY_MANAGER" }, isActive: true }
    });
    if (!inventoryManagerUser) {
      inventoryManagerUser = await prisma.user.create({
        data: {
          name: "Test Inventory Manager",
          email: "test.inventorymanager@kyrazam.test",
          passwordHash: "$2a$10$abcdefghijklmnopqrstuvwxyz123456",
          roles: ["INVENTORY_MANAGER"],
          isActive: true
        }
      });
    }

    // Tokens
    adminToken = app.jwt.sign({ id: adminUser.id, email: adminUser.email, roles: adminUser.roles } as any);
    superadminToken = app.jwt.sign({ id: superadminUser.id, email: superadminUser.email, roles: superadminUser.roles } as any);
    purchaseManagerToken = app.jwt.sign({ id: purchaseManagerUser.id, email: purchaseManagerUser.email, roles: purchaseManagerUser.roles } as any);
    inventoryManagerToken = app.jwt.sign({ id: inventoryManagerUser.id, email: inventoryManagerUser.email, roles: inventoryManagerUser.roles } as any);

    // Ensure Vendor
    testVendor = await prisma.vendor.findFirst();
    if (!testVendor) {
      testVendor = await prisma.vendor.create({
        data: {
          name: "Zenith Industrial Supplies",
          contact: "Vipin Sharma",
          email: "vipin@zenithsupplies.test",
          phone: "+919876543210",
          address: "MIDC Industrial Estate, Pune"
        }
      });
    }

    // Ensure NQZ Material (Non-quarantine, direct stocking)
    const nqzSku = `MAT-NQZ-${Date.now()}`;
    nqzMaterial = await prisma.material.create({
      data: {
        name: "Standard Copper Terminals",
        category: "Hardware",
        sku: nqzSku,
        quantity: 100,
        unit: "PCS",
        unitPrice: 15.0,
        materialType: "NQZ"
      }
    });

    // Ensure QTZ Material (Quarantine, QC inspection required)
    const qtzSku = `MAT-QTZ-${Date.now()}`;
    qtzMaterial = await prisma.material.create({
      data: {
        name: "High Energy LFP Cells 3.2V 100Ah",
        category: "Battery",
        sku: qtzSku,
        quantity: 0,
        unit: "PCS",
        unitPrice: 850.0,
        materialType: "QTZ"
      }
    });
  });

  after(async () => {
    await app.close();
  });

  // -------------------------------------------------------------
  // Test 1: Admin creates PO without draft flag -> Auto-approved immediately
  // -------------------------------------------------------------
  it("1. Admin creates submitted PO -> Automatically transitions to APPROVED with approval record & audit log", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/crm/procurement/purchase-orders",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        vendorId: testVendor.id,
        expectedDeliveryDate: new Date(Date.now() + 7 * 86400000).toISOString(),
        paymentTerms: "30 Days Net",
        deliveryTerms: "FOB Pune",
        billingAddress: "KYRA ZAM HQ, Pune",
        deliveryAddress: "KYRA ZAM Factory 1, Chakan",
        items: [
          {
            materialId: nqzMaterial.id,
            description: nqzMaterial.name,
            quantityOrdered: 50,
            unitPrice: 15.0,
            taxRate: 18.0
          }
        ]
      }
    });

    assert.equal(res.statusCode, 201, `Expected 201 Created: ${res.body}`);
    const po = res.json();
    assert.equal(po.status, "APPROVED", "PO created by Admin should be automatically APPROVED");
    assert.ok(po.poNumber, "PO must have a valid sequential PO number");

    // Verify PurchaseOrderApproval record was created
    const approval = await prisma.purchaseOrderApproval.findFirst({
      where: { purchaseOrderId: po.id, status: "APPROVED" }
    });
    assert.ok(approval, "PurchaseOrderApproval record should exist in APPROVED status");
    assert.equal(approval.decidedById, adminUser.id, "Approval decider should be the creating admin");

    // Verify AuditLog
    const audit = await prisma.auditLog.findFirst({
      where: { entityId: po.id, action: "PURCHASE_ORDER_AUTO_APPROVED" }
    });
    assert.ok(audit, "Audit log with action PURCHASE_ORDER_AUTO_APPROVED should exist");
  });

  // -------------------------------------------------------------
  // Test 2: Admin creates PO as DRAFT -> NOT auto-approved
  // -------------------------------------------------------------
  it("2. Admin creates PO with isDraft: true -> Stored as DRAFT without auto-approval", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/crm/procurement/purchase-orders",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        vendorId: testVendor.id,
        expectedDeliveryDate: new Date(Date.now() + 7 * 86400000).toISOString(),
        paymentTerms: "30 Days Net",
        deliveryTerms: "FOB Pune",
        billingAddress: "KYRA ZAM HQ, Pune",
        deliveryAddress: "KYRA ZAM Factory 1, Chakan",
        isDraft: true,
        items: [
          {
            materialId: nqzMaterial.id,
            description: nqzMaterial.name,
            quantityOrdered: 30,
            unitPrice: 15.0,
            taxRate: 18.0
          }
        ]
      }
    });

    assert.equal(res.statusCode, 201);
    const po = res.json();
    assert.equal(po.status, "DRAFT", "Draft PO must remain in DRAFT status");

    const approvals = await prisma.purchaseOrderApproval.findMany({
      where: { purchaseOrderId: po.id }
    });
    assert.equal(approvals.length, 0, "Saved draft should not have an approval record");
  });

  // -------------------------------------------------------------
  // Test 3: Submitting an existing draft PO by Admin auto-approves it
  // -------------------------------------------------------------
  it("3. Admin submits saved draft PO -> Transitions directly to APPROVED with auto-approval audit log", async () => {
    // Create draft
    const createRes = await app.inject({
      method: "POST",
      url: "/crm/procurement/purchase-orders",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        vendorId: testVendor.id,
        expectedDeliveryDate: new Date(Date.now() + 7 * 86400000).toISOString(),
        paymentTerms: "30 Days Net",
        deliveryTerms: "FOB Pune",
        billingAddress: "KYRA ZAM HQ, Pune",
        deliveryAddress: "KYRA ZAM Factory 1, Chakan",
        isDraft: true,
        items: [
          {
            materialId: nqzMaterial.id,
            description: nqzMaterial.name,
            quantityOrdered: 20,
            unitPrice: 15.0,
            taxRate: 18.0
          }
        ]
      }
    });
    const draft = createRes.json();
    assert.equal(draft.status, "DRAFT");

    // Submit draft
    const submitRes = await app.inject({
      method: "PUT",
      url: `/crm/procurement/purchase-orders/${draft.id}/submit`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {}
    });

    assert.equal(submitRes.statusCode, 200);
    const submitted = submitRes.json();
    assert.equal(submitted.status, "APPROVED", "Submitted draft by Admin should transition to APPROVED");
  });

  // -------------------------------------------------------------
  // Test 4: Segregation of duties for Non-Admin (Purchase Manager)
  // -------------------------------------------------------------
  it("4. Non-admin (Purchase Manager) creates/submits PO -> Transitions to PENDING_APPROVAL and creator cannot self-approve", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/crm/procurement/purchase-orders",
      headers: { authorization: `Bearer ${purchaseManagerToken}` },
      payload: {
        vendorId: testVendor.id,
        expectedDeliveryDate: new Date(Date.now() + 7 * 86400000).toISOString(),
        paymentTerms: "30 Days Net",
        deliveryTerms: "FOB Pune",
        billingAddress: "KYRA ZAM HQ, Pune",
        deliveryAddress: "KYRA ZAM Factory 1, Chakan",
        items: [
          {
            materialId: nqzMaterial.id,
            description: nqzMaterial.name,
            quantityOrdered: 25,
            unitPrice: 15.0,
            taxRate: 18.0
          }
        ]
      }
    });

    assert.equal(res.statusCode, 201);
    const po = res.json();
    assert.equal(po.status, "PENDING_APPROVAL", "Non-admin submission must require approval");

    // Verify creator cannot approve their own PO
    const selfApproveRes = await app.inject({
      method: "PUT",
      url: `/crm/procurement/purchase-orders/${po.id}/approve`,
      headers: { authorization: `Bearer ${purchaseManagerToken}` },
      payload: {}
    });
    // Purchase manager role is not allowed on poApproveHandler (403)
    assert.equal(selfApproveRes.statusCode, 403, "Purchase manager cannot approve POs");
  });

  // -------------------------------------------------------------
  // Test 5: Authorized Issue-to-Vendor transition (APPROVED -> SENT)
  // -------------------------------------------------------------
  it("5. Issue-to-vendor transition moves APPROVED PO to SENT state", async () => {
    // Create and auto-approve PO
    const poRes = await app.inject({
      method: "POST",
      url: "/crm/procurement/purchase-orders",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        vendorId: testVendor.id,
        expectedDeliveryDate: new Date(Date.now() + 7 * 86400000).toISOString(),
        paymentTerms: "30 Days Net",
        deliveryTerms: "FOB Pune",
        billingAddress: "KYRA ZAM HQ, Pune",
        deliveryAddress: "KYRA ZAM Factory 1, Chakan",
        items: [
          {
            materialId: nqzMaterial.id,
            description: nqzMaterial.name,
            quantityOrdered: 40,
            unitPrice: 15.0,
            taxRate: 18.0
          }
        ]
      }
    });
    const po = poRes.json();
    assert.equal(po.status, "APPROVED");

    // Issue to vendor
    const issueRes = await app.inject({
      method: "PUT",
      url: `/crm/procurement/purchase-orders/${po.id}/issue-to-vendor`,
      headers: { authorization: `Bearer ${adminToken}` }
    });

    assert.equal(issueRes.statusCode, 200);
    const issued = issueRes.json();
    assert.equal(issued.status, "SENT", "Status must become SENT after issuing to vendor");

    const audit = await prisma.auditLog.findFirst({
      where: { entityId: po.id, action: "PURCHASE_ORDER_ISSUED_TO_VENDOR" }
    });
    assert.ok(audit, "Audit log for issue-to-vendor should be recorded");
  });

  // -------------------------------------------------------------
  // Test 6 & 7: Inventory Manager Receiving List DTO (no commercial pricing)
  // -------------------------------------------------------------
  it("6. Inventory Manager receiving list contains authorized POs with supplier invoice # and NO commercial details", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/crm/procurement/receiving/purchase-orders",
      headers: { authorization: `Bearer ${inventoryManagerToken}` }
    });

    assert.equal(res.statusCode, 200);
    const data = res.json();
    assert.ok(Array.isArray(data.purchaseOrders), "Should return purchaseOrders array");
    assert.ok(data.total >= 1, "Should have at least 1 authorized PO");

    // Check first PO structure
    const sample = data.purchaseOrders[0];
    assert.ok(sample.poNumber, "Must have poNumber");
    assert.ok(sample.vendorName, "Must have vendorName");
    assert.ok("supplierInvoiceNumber" in sample, "Must include supplierInvoiceNumber field");
    assert.ok(sample.status, "Must include receiving status");

    // Verify commercial prices are NOT returned
    assert.equal(sample.grandTotal, undefined, "grandTotal must not be exposed to receiver");
    assert.equal(sample.subtotal, undefined, "subtotal must not be exposed to receiver");
    assert.equal(sample.unitPrice, undefined, "unitPrice must not be exposed to receiver");
    assert.equal(sample.tax, undefined, "tax must not be exposed to receiver");
  });

  // -------------------------------------------------------------
  // Test 8: Blind Receiving Detail Screen DTO (strictly hides ordered quantities and prices)
  // -------------------------------------------------------------
  it("8. Blind Receiving detail DTO returns product identity & brand, but strictly hides ordered quantities and prices", async () => {
    // Create PO
    const poRes = await app.inject({
      method: "POST",
      url: "/crm/procurement/purchase-orders",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        vendorId: testVendor.id,
        expectedDeliveryDate: new Date(Date.now() + 7 * 86400000).toISOString(),
        paymentTerms: "30 Days Net",
        deliveryTerms: "FOB Pune",
        billingAddress: "KYRA ZAM HQ, Pune",
        deliveryAddress: "KYRA ZAM Factory 1, Chakan",
        items: [
          {
            materialId: nqzMaterial.id,
            description: nqzMaterial.name,
            quantityOrdered: 50,
            unitPrice: 15.0,
            taxRate: 18.0
          }
        ]
      }
    });
    const po = poRes.json();

    // Query blind receiving detail endpoint
    const blindRes = await app.inject({
      method: "GET",
      url: `/crm/procurement/receiving/purchase-orders/${po.id}`,
      headers: { authorization: `Bearer ${inventoryManagerToken}` }
    });

    assert.equal(blindRes.statusCode, 200);
    const blindPO = blindRes.json();

    assert.equal(blindPO.poNumber, po.poNumber);
    assert.ok(blindPO.items.length === 1);

    const blindItem = blindPO.items[0];
    assert.equal(blindItem.productName, nqzMaterial.name);
    assert.ok("brand" in blindItem, "Must include brand");
    assert.ok("category" in blindItem, "Must include category");
    assert.ok("unit" in blindItem, "Must include unit");
    assert.ok("materialType" in blindItem, "Must include materialType");

    // CRITICAL: Ordered quantities, prices, discounts, tax rates must be OMITTED
    assert.equal(blindItem.quantityOrdered, undefined, "Ordered quantity must be hidden for blind receiving");
    assert.equal(blindItem.unitPrice, undefined, "Unit price must be hidden for blind receiving");
    assert.equal(blindItem.discount, undefined, "Discount must be hidden");
    assert.equal(blindItem.taxRate, undefined, "Tax rate must be hidden");
    assert.equal(blindItem.lineTotal, undefined, "Line total must be hidden");
  });

  // -------------------------------------------------------------
  // Test 9: Exact quantity reconciliation succeeds -> PO transitions to RECEIVED
  // -------------------------------------------------------------
  it("9. Inventory Manager submits exact received count -> GoodsReceipt created and PO marked RECEIVED", async () => {
    const poRes = await app.inject({
      method: "POST",
      url: "/crm/procurement/purchase-orders",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        vendorId: testVendor.id,
        expectedDeliveryDate: new Date(Date.now() + 7 * 86400000).toISOString(),
        paymentTerms: "30 Days Net",
        deliveryTerms: "FOB Pune",
        billingAddress: "KYRA ZAM HQ, Pune",
        deliveryAddress: "KYRA ZAM Factory 1, Chakan",
        items: [
          {
            materialId: nqzMaterial.id,
            description: nqzMaterial.name,
            quantityOrdered: 60,
            unitPrice: 15.0,
            taxRate: 18.0
          }
        ]
      }
    });
    const po = poRes.json();
    const poItem = po.items[0];

    const initialStock = (await prisma.material.findUnique({ where: { id: nqzMaterial.id } }))?.quantity || 0;

    // Submit blind receiving with exact count
    const receiveRes = await app.inject({
      method: "POST",
      url: `/crm/procurement/receiving/purchase-orders/${po.id}/receive`,
      headers: { authorization: `Bearer ${inventoryManagerToken}` },
      payload: {
        supplierInvoiceNumber: "INV-EXACT-001",
        items: [
          {
            poItemId: poItem.id,
            passedQuantity: 60,
            defectiveQuantity: 0,
            batchNumber: "BATCH-EXACT-60"
          }
        ]
      }
    });

    assert.equal(receiveRes.statusCode, 200);
    const result = receiveRes.json();
    assert.equal(result.success, true);
    assert.equal(result.poStatus, "RECEIVED", "PO must transition to RECEIVED on complete receipt");
    assert.equal(result.remainingPending, 0);

    // Verify NQZ stock was incremented
    const updatedStock = (await prisma.material.findUnique({ where: { id: nqzMaterial.id } }))?.quantity || 0;
    assert.equal(updatedStock, initialStock + 60, "NQZ material usable stock must increase by accepted quantity");
  });

  // -------------------------------------------------------------
  // Test 10: Partial quantity (< outstanding) is rejected; Full receipt required
  // -------------------------------------------------------------
  it("10. Partial delivery (< outstanding) -> Rejected with 400 Bad Request; Full receipt strictly required", async () => {
    const poRes = await app.inject({
      method: "POST",
      url: "/crm/procurement/purchase-orders",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        vendorId: testVendor.id,
        expectedDeliveryDate: new Date(Date.now() + 7 * 86400000).toISOString(),
        paymentTerms: "30 Days Net",
        deliveryTerms: "FOB Pune",
        billingAddress: "KYRA ZAM HQ, Pune",
        deliveryAddress: "KYRA ZAM Factory 1, Chakan",
        items: [
          {
            materialId: nqzMaterial.id,
            description: nqzMaterial.name,
            quantityOrdered: 100,
            unitPrice: 15.0,
            taxRate: 18.0
          }
        ]
      }
    });
    const po = poRes.json();
    const poItem = po.items[0];

    // Deliver only 40 out of 100 (partial) -> Must be rejected with 400
    const partialRes = await app.inject({
      method: "POST",
      url: `/crm/procurement/receiving/purchase-orders/${po.id}/receive`,
      headers: { authorization: `Bearer ${inventoryManagerToken}` },
      payload: {
        supplierInvoiceNumber: "INV-PARTIAL-001",
        items: [
          {
            poItemId: poItem.id,
            passedQuantity: 40,
            defectiveQuantity: 0,
            batchNumber: "BATCH-PARTIAL-40"
          }
        ]
      }
    });

    assert.equal(partialRes.statusCode, 400, "Partial delivery must be rejected with 400 Bad Request");
    const err = partialRes.json();
    assert.match(err.error, /Quantity mismatch for/i);
    assert.match(err.error, /Full receipt required/i);
    assert.doesNotMatch(err.error, /100|40/i, "Must not leak actual or entered quantities in error message");

    // Complete with 100% full receipt
    const fullRes = await app.inject({
      method: "POST",
      url: `/crm/procurement/receiving/purchase-orders/${po.id}/receive`,
      headers: { authorization: `Bearer ${inventoryManagerToken}` },
      payload: {
        supplierInvoiceNumber: "INV-FULL-001",
        items: [
          {
            poItemId: poItem.id,
            passedQuantity: 100,
            defectiveQuantity: 0,
            batchNumber: "BATCH-FULL-100"
          }
        ]
      }
    });

    assert.equal(fullRes.statusCode, 200);
    const result = fullRes.json();
    assert.equal(result.poStatus, "RECEIVED", "PO must transition directly to RECEIVED on complete receipt");
    assert.equal(result.remainingPending, 0);
  });

  // -------------------------------------------------------------
  // Test 11: Excess quantities are rejected with 400 error
  // -------------------------------------------------------------
  it("11. Excess quantities (> outstanding) are rejected with 400 error", async () => {
    const poRes = await app.inject({
      method: "POST",
      url: "/crm/procurement/purchase-orders",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        vendorId: testVendor.id,
        expectedDeliveryDate: new Date(Date.now() + 7 * 86400000).toISOString(),
        paymentTerms: "30 Days Net",
        deliveryTerms: "FOB Pune",
        billingAddress: "KYRA ZAM HQ, Pune",
        deliveryAddress: "KYRA ZAM Factory 1, Chakan",
        items: [
          {
            materialId: nqzMaterial.id,
            description: nqzMaterial.name,
            quantityOrdered: 50,
            unitPrice: 15.0,
            taxRate: 18.0
          }
        ]
      }
    });
    const po = poRes.json();
    const poItem = po.items[0];

    // Attempt to receive 70 (outstanding is only 50)
    const receiveRes = await app.inject({
      method: "POST",
      url: `/crm/procurement/receiving/purchase-orders/${po.id}/receive`,
      headers: { authorization: `Bearer ${inventoryManagerToken}` },
      payload: {
        items: [
          {
            poItemId: poItem.id,
            passedQuantity: 60,
            defectiveQuantity: 10 // Total 70 > 50
          }
        ]
      }
    });

    assert.equal(receiveRes.statusCode, 400, "Excess quantity must be rejected with 400 Bad Request");
    const err = receiveRes.json();
    assert.match(err.error, /Quantity mismatch for/i);
    assert.doesNotMatch(err.error, /has outstanding quantity/i, "Error message must NOT leak expected or received quantities");
  });

  // -------------------------------------------------------------
  // Test 12: Defective stock NEVER increases usable stock in Material
  // -------------------------------------------------------------
  it("12. Defective materials are isolated and NEVER increase usable stock in Material", async () => {
    const poRes = await app.inject({
      method: "POST",
      url: "/crm/procurement/purchase-orders",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        vendorId: testVendor.id,
        expectedDeliveryDate: new Date(Date.now() + 7 * 86400000).toISOString(),
        paymentTerms: "30 Days Net",
        deliveryTerms: "FOB Pune",
        billingAddress: "KYRA ZAM HQ, Pune",
        deliveryAddress: "KYRA ZAM Factory 1, Chakan",
        items: [
          {
            materialId: nqzMaterial.id,
            description: nqzMaterial.name,
            quantityOrdered: 50,
            unitPrice: 15.0,
            taxRate: 18.0
          }
        ]
      }
    });
    const po = poRes.json();
    const poItem = po.items[0];

    const stockBefore = (await prisma.material.findUnique({ where: { id: nqzMaterial.id } }))?.quantity || 0;

    // Receive 30 accepted, 20 defective
    const receiveRes = await app.inject({
      method: "POST",
      url: `/crm/procurement/receiving/purchase-orders/${po.id}/receive`,
      headers: { authorization: `Bearer ${inventoryManagerToken}` },
      payload: {
        items: [
          {
            poItemId: poItem.id,
            passedQuantity: 30,
            defectiveQuantity: 20,
            defectNotes: "Bent pins and cracked terminal housings"
          }
        ]
      }
    });

    assert.equal(receiveRes.statusCode, 200);
    const stockAfter = (await prisma.material.findUnique({ where: { id: nqzMaterial.id } }))?.quantity || 0;

    // Stock should only increase by 30 (accepted), NOT 50!
    assert.equal(stockAfter, stockBefore + 30, "Usable stock must only increase by accepted quantity (30), never defective (20)");

    // GoodsReceiptItem should record defective quantity
    const grnItem = await prisma.goodsReceiptItem.findFirst({
      where: { materialId: nqzMaterial.id, quantityRejected: 20 }
    });
    assert.ok(grnItem, "GoodsReceiptItem must record quantityRejected: 20");
  });

  // -------------------------------------------------------------
  // Test 13: QTZ materials are quarantined in QC_PENDING (no usable stock increment)
  // -------------------------------------------------------------
  it("13. QTZ materials enter QC_PENDING quarantine and do NOT increase usable stock in Material", async () => {
    const poRes = await app.inject({
      method: "POST",
      url: "/crm/procurement/purchase-orders",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        vendorId: testVendor.id,
        expectedDeliveryDate: new Date(Date.now() + 7 * 86400000).toISOString(),
        paymentTerms: "30 Days Net",
        deliveryTerms: "FOB Pune",
        billingAddress: "KYRA ZAM HQ, Pune",
        deliveryAddress: "KYRA ZAM Factory 1, Chakan",
        items: [
          {
            materialId: qtzMaterial.id,
            description: qtzMaterial.name,
            quantityOrdered: 10,
            unitPrice: 850.0,
            taxRate: 18.0
          }
        ]
      }
    });
    const po = poRes.json();
    const poItem = po.items[0];

    const qtzStockBefore = (await prisma.material.findUnique({ where: { id: qtzMaterial.id } }))?.quantity || 0;

    // Receive 10 units of QTZ cells
    const receiveRes = await app.inject({
      method: "POST",
      url: `/crm/procurement/receiving/purchase-orders/${po.id}/receive`,
      headers: { authorization: `Bearer ${inventoryManagerToken}` },
      payload: {
        items: [
          {
            poItemId: poItem.id,
            passedQuantity: 10,
            defectiveQuantity: 0,
            batchNumber: "LFP-CELL-BATCH-01"
          }
        ]
      }
    });

    assert.equal(receiveRes.statusCode, 200);
    const result = receiveRes.json();
    assert.equal(result.grnStatus, "QC_PENDING", "GRN for QTZ material must be in QC_PENDING quarantine status");

    const qtzStockAfter = (await prisma.material.findUnique({ where: { id: qtzMaterial.id } }))?.quantity || 0;
    assert.equal(qtzStockAfter, qtzStockBefore, "QTZ material stock must NOT increase before passing QC inspection");
  });

  // -------------------------------------------------------------
  // Test 7: Commercial authorization guard: Inventory Manager cannot edit PO or prices
  // -------------------------------------------------------------
  it("7. API-level authorization prevents Inventory Managers from changing PO commercial information", async () => {
    // Attempt to update PO as Inventory Manager
    const editRes = await app.inject({
      method: "PUT",
      url: `/crm/procurement/purchase-orders/00000000-0000-0000-0000-000000000000`,
      headers: { authorization: `Bearer ${inventoryManagerToken}` },
      payload: {
        vendorId: testVendor.id,
        expectedDeliveryDate: new Date().toISOString(),
        paymentTerms: "30 Days Net",
        deliveryTerms: "FOB Pune",
        billingAddress: "Address",
        deliveryAddress: "Address",
        items: []
      }
    });

    assert.equal(editRes.statusCode, 403, "Inventory Manager must be blocked with 403 Forbidden from editing POs");
  });

  // -------------------------------------------------------------
  // Test 14: Duplicate retry idempotency protection
  // -------------------------------------------------------------
  it("14. Retry with same idempotencyKey returns existing PO without duplicate creation", async () => {
    const key = `IDEMP-KEY-${Date.now()}`;

    const res1 = await app.inject({
      method: "POST",
      url: "/crm/procurement/purchase-orders",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        idempotencyKey: key,
        vendorId: testVendor.id,
        expectedDeliveryDate: new Date(Date.now() + 7 * 86400000).toISOString(),
        paymentTerms: "30 Days Net",
        deliveryTerms: "FOB Pune",
        billingAddress: "KYRA ZAM HQ, Pune",
        deliveryAddress: "KYRA ZAM Factory 1, Chakan",
        items: [
          {
            materialId: nqzMaterial.id,
            description: nqzMaterial.name,
            quantityOrdered: 15,
            unitPrice: 15.0,
            taxRate: 18.0
          }
        ]
      }
    });
    assert.equal(res1.statusCode, 201);
    const po1 = res1.json();

    // Immediate retry with identical idempotencyKey
    const res2 = await app.inject({
      method: "POST",
      url: "/crm/procurement/purchase-orders",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        idempotencyKey: key,
        vendorId: testVendor.id,
        expectedDeliveryDate: new Date(Date.now() + 7 * 86400000).toISOString(),
        paymentTerms: "30 Days Net",
        deliveryTerms: "FOB Pune",
        billingAddress: "KYRA ZAM HQ, Pune",
        deliveryAddress: "KYRA ZAM Factory 1, Chakan",
        items: [
          {
            materialId: nqzMaterial.id,
            description: nqzMaterial.name,
            quantityOrdered: 15,
            unitPrice: 15.0,
            taxRate: 18.0
          }
        ]
      }
    });

    assert.equal(res2.statusCode, 200, "Retry should return existing PO with 200 OK");
    const po2 = res2.json();
    assert.equal(po2.id, po1.id, "Should return identical PO ID");
    assert.equal(po2.poNumber, po1.poNumber, "Should return identical PO Number");
  });
});
