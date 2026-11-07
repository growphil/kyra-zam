import path from "node:path";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { FastifyInstance } from "fastify";
import { buildTestApp } from "./helpers/buildTestApp";
import { prisma } from "../prisma";

describe("KYRA ZAM 2.0 — Invoice Order (IO), Goods Inward & Stock Posting Workflow", () => {
  let app: FastifyInstance;
  let adminUser: any;
  let superadminUser: any;
  let secondAdminUser: any;
  let inventoryManagerUser: any;
  let purchaseManagerUser: any;
  let testVendor: any;
  let nqzMaterial: any;
  let qtzMaterial: any;
  let testWarehouse: any;
  let testPO: any;

  let adminToken: string;
  let superadminToken: string;
  let secondAdminToken: string;
  let inventoryManagerToken: string;
  let purchaseManagerToken: string;

  before(async () => {
    app = await buildTestApp();
    await app.listen({ port: 0, host: "127.0.0.1" });

    // 1. Ensure test users exist
    adminUser = await prisma.user.findFirst({
      where: { roles: { has: "ADMIN" }, isActive: true },
    });
    if (!adminUser) {
      adminUser = await prisma.user.create({
        data: {
          name: "Test Admin One",
          email: "test.admin.one@kyrazam.test",
          passwordHash: "$2a$10$abcdefghijklmnopqrstuvwxyz123456",
          roles: ["ADMIN"],
          isActive: true,
        },
      });
    }

    secondAdminUser = await prisma.user.findFirst({
      where: {
        roles: { has: "ADMIN" },
        id: { not: adminUser.id },
        isActive: true,
      },
    });
    if (!secondAdminUser) {
      secondAdminUser = await prisma.user.create({
        data: {
          name: "Test Admin Two",
          email: "test.admin.two@kyrazam.test",
          passwordHash: "$2a$10$abcdefghijklmnopqrstuvwxyz123456",
          roles: ["ADMIN"],
          isActive: true,
        },
      });
    }

    superadminUser = await prisma.user.findFirst({
      where: { roles: { has: "SUPERADMIN" }, isActive: true },
    });
    if (!superadminUser) {
      superadminUser = await prisma.user.create({
        data: {
          name: "Test Superadmin",
          email: "test.superadmin.io@kyrazam.test",
          passwordHash: "$2a$10$abcdefghijklmnopqrstuvwxyz123456",
          roles: ["SUPERADMIN"],
          isActive: true,
        },
      });
    }

    inventoryManagerUser = await prisma.user.findFirst({
      where: { roles: { has: "INVENTORY_MANAGER" }, isActive: true },
    });
    if (!inventoryManagerUser) {
      inventoryManagerUser = await prisma.user.create({
        data: {
          name: "Test Inventory Manager",
          email: "test.invmanager.io@kyrazam.test",
          passwordHash: "$2a$10$abcdefghijklmnopqrstuvwxyz123456",
          roles: ["INVENTORY_MANAGER"],
          isActive: true,
        },
      });
    }

    purchaseManagerUser = await prisma.user.findFirst({
      where: { roles: { has: "PURCHASE_MANAGER" }, isActive: true },
    });
    if (!purchaseManagerUser) {
      purchaseManagerUser = await prisma.user.create({
        data: {
          name: "Test Purchase Manager",
          email: "test.purchasemanager.io@kyrazam.test",
          passwordHash: "$2a$10$abcdefghijklmnopqrstuvwxyz123456",
          roles: ["PURCHASE_MANAGER"],
          isActive: true,
        },
      });
    }

    // 2. JWT Sign Tokens
    adminToken = app.jwt.sign({ id: adminUser.id, email: adminUser.email, roles: adminUser.roles } as any);
    secondAdminToken = app.jwt.sign({ id: secondAdminUser.id, email: secondAdminUser.email, roles: secondAdminUser.roles } as any);
    superadminToken = app.jwt.sign({ id: superadminUser.id, email: superadminUser.email, roles: superadminUser.roles } as any);
    inventoryManagerToken = app.jwt.sign({ id: inventoryManagerUser.id, email: inventoryManagerUser.email, roles: inventoryManagerUser.roles } as any);
    purchaseManagerToken = app.jwt.sign({ id: purchaseManagerUser.id, email: purchaseManagerUser.email, roles: purchaseManagerUser.roles } as any);

    // 3. Test Vendor
    testVendor = await prisma.vendor.findFirst();
    if (!testVendor) {
      testVendor = await prisma.vendor.create({
        data: {
          name: "Quantum Battery Supplies Ltd",
          contact: "Devendra Patil",
          phone: "+91 99887 76655",
          email: "sales@quantumbattery.com",
          address: "GIDC Electronics Zone, Pune",
          isActive: true,
        },
      });
    }

    // 4. Test Materials: NQZ and QTZ
    const randSuffix = Math.floor(Math.random() * 90000 + 10000);

    nqzMaterial = await prisma.material.create({
      data: {
        name: `Copper Busbar Strip 2P-${randSuffix}`,
        sku: `MAT-NQZ-${randSuffix}`,
        category: "BUSBAR",
        unit: "pcs",
        quantity: 100,
        unitPrice: 250,
        materialType: "NQZ",
      },
    });

    qtzMaterial = await prisma.material.create({
      data: {
        name: `LiFePO4 Cell Prismatic 3.2V 100Ah-${randSuffix}`,
        sku: `MAT-QTZ-${randSuffix}`,
        category: "CELLS",
        unit: "pcs",
        quantity: 50,
        unitPrice: 1800,
        materialType: "QTZ",
      },
    });

    // 5. Test Warehouse & Bin
    testWarehouse = await prisma.warehouse.findFirst({
      include: { locations: true },
    });
    if (!testWarehouse) {
      testWarehouse = await prisma.warehouse.create({
        data: {
          name: "Pune Main Plant Warehouse",
          code: `WH-PUNE-${randSuffix}`,
          locations: {
            create: [
              { name: "Rack A Bin 1", code: `LOC-A1-${randSuffix}` },
              { name: "Quarantine Bay", code: `LOC-QC-${randSuffix}` },
            ],
          },
        },
        include: { locations: true },
      });
    }

    // 6. Test Authorized Purchase Order (APPROVED)
    const poNumber = `PO-TEST-IO-${randSuffix}`;
    testPO = await prisma.purchaseOrder.create({
      data: {
        poNumber,
        vendorId: testVendor.id,
        createdById: adminUser.id,
        status: "APPROVED",
        currency: "INR",
        subtotal: 50000,
        tax: 9000,
        grandTotal: 59000,
        paymentTerms: "30 Days Net",
        deliveryTerms: "EXW Pune Depot",
        billingAddress: "KYRA ZAM HQ, Pune",
        deliveryAddress: "KYRA ZAM Central Warehouse, Pune",
        expectedDeliveryDate: new Date(Date.now() + 7 * 86400000),
        items: {
          create: [
            {
              materialId: nqzMaterial.id,
              description: nqzMaterial.name,
              quantityOrdered: 100,
              quantityReceived: 0,
              quantityPending: 100,
              unitPrice: 250,
              taxRate: 18,
              taxAmount: 4500,
              lineSubtotal: 25000,
              lineTotal: 29500,
            },
            {
              materialId: qtzMaterial.id,
              description: qtzMaterial.name,
              quantityOrdered: 50,
              quantityReceived: 0,
              quantityPending: 50,
              unitPrice: 1800,
              taxRate: 18,
              taxAmount: 16200,
              lineSubtotal: 90000,
              lineTotal: 106200,
            },
          ],
        },
      },
      include: { items: true },
    });
  });

  after(async () => {
    await app.close();
  });

  // ---------------------------------------------------------------------------
  // TEST 1: Admin Creates IO -> Status is PENDING_INVENTORY
  // ---------------------------------------------------------------------------
  let adminCreatedIOId: string;
  let adminSupplierInvNum: string;

  it("1. Admin creates submitted IO -> Automatically transitions to PENDING_INVENTORY for physical verification", async () => {
    adminSupplierInvNum = `INV-ADM-${Date.now()}`;

    const res = await app.inject({
      method: "POST",
      url: "/crm/procurement/invoice-orders",
      headers: {
        authorization: `Bearer ${adminToken}`,
        "content-type": "application/json",
      },
      payload: {
        purchaseOrderId: testPO.id,
        vendorId: testVendor.id,
        supplierInvoiceNumber: adminSupplierInvNum,
        invoiceType: "FINAL_TAX_INVOICE",
        currency: "INR",
        submitNow: true,
        items: [
          {
            poItemId: testPO.items[0].id,
            materialId: nqzMaterial.id,
            description: nqzMaterial.name,
            invoiceQuantity: 50,
            unitPrice: 250,
            taxRate: 18,
          },
        ],
      },
    });

    assert.equal(res.statusCode, 201, `Failed: ${res.body}`);
    const data = JSON.parse(res.body);
    assert.ok(data.id, "IO ID must be defined");
    assert.match(data.ioNumber, /^IO-\d{6}$/, "Must generate IO-000001 format sequential identifier");
    assert.equal(data.status, "PENDING_INVENTORY", "Admin created IO must route to PENDING_INVENTORY");
    adminCreatedIOId = data.id;

    // Verify audit log
    const log = await prisma.auditLog.findFirst({
      where: { entityType: "invoice_order", entityId: data.id },
    });
    assert.ok(log, "Audit log must be created on IO creation");
  });

  // ---------------------------------------------------------------------------
  // TEST 2: Inventory Manager Creates IO -> Status is PENDING_ADMIN_APPROVAL
  // ---------------------------------------------------------------------------
  let invMgrCreatedIOId: string;

  it("2. Inventory Manager creates submitted IO -> Transitions to PENDING_ADMIN_APPROVAL", async () => {
    const invSupplierNum = `INV-IM-${Date.now()}`;

    const res = await app.inject({
      method: "POST",
      url: "/crm/procurement/invoice-orders",
      headers: {
        authorization: `Bearer ${inventoryManagerToken}`,
        "content-type": "application/json",
      },
      payload: {
        purchaseOrderId: testPO.id,
        vendorId: testVendor.id,
        supplierInvoiceNumber: invSupplierNum,
        invoiceType: "FINAL_TAX_INVOICE",
        currency: "INR",
        submitNow: true,
        items: [
          {
            poItemId: testPO.items[1].id,
            materialId: qtzMaterial.id,
            description: qtzMaterial.name,
            invoiceQuantity: 30,
            unitPrice: 1800,
            taxRate: 18,
          },
        ],
      },
    });

    assert.equal(res.statusCode, 201, `Failed: ${res.body}`);
    const data = JSON.parse(res.body);
    assert.equal(data.status, "PENDING_ADMIN_APPROVAL", "Inventory Manager created IO must route to PENDING_ADMIN_APPROVAL");
    invMgrCreatedIOId = data.id;
  });

  // ---------------------------------------------------------------------------
  // TEST 3: Inventory Manager Cannot Approve Any IO
  // ---------------------------------------------------------------------------
  it("3. Inventory Manager is forbidden from approving IO (RBAC check)", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/crm/procurement/invoice-orders/${adminCreatedIOId}/approve`,
      headers: {
        authorization: `Bearer ${inventoryManagerToken}`,
        "content-type": "application/json",
      },
      payload: { remarks: "Self approval attempt" },
    });

    assert.equal(res.statusCode, 403, "Inventory Manager must not have permission to approve IO");
  });

  // ---------------------------------------------------------------------------
  // TEST 4: Creator Cannot Approve Own IO (Segregation of Duties)
  // ---------------------------------------------------------------------------
  it("4. Creator Admin cannot self-approve their own IO (Segregation of Duties)", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/crm/procurement/invoice-orders/${adminCreatedIOId}/approve`,
      headers: {
        authorization: `Bearer ${adminToken}`, // adminUser created this IO!
        "content-type": "application/json",
      },
      payload: { remarks: "Self approval attempt" },
    });

    assert.equal(res.statusCode, 403, "Creator must not be allowed to approve their own IO");
    const body = JSON.parse(res.body);
    assert.match(body.error, /Segregation of duties/i);
  });

  // ---------------------------------------------------------------------------
  // TEST 5: Physical Verification Workflow by Inventory Manager
  // ---------------------------------------------------------------------------
  it("5. Inventory Manager verifies physical received quantities with mathematical equation", async () => {
    const ioDetails = await prisma.invoiceOrder.findUnique({
      where: { id: adminCreatedIOId },
      include: { items: true },
    });

    const item = ioDetails!.items[0];

    // Actual received = 50, Accepted = 48, Damaged = 2, Rejected = 0
    const res = await app.inject({
      method: "POST",
      url: `/crm/procurement/invoice-orders/${adminCreatedIOId}/verify`,
      headers: {
        authorization: `Bearer ${inventoryManagerToken}`,
        "content-type": "application/json",
      },
      payload: {
        isDraft: false,
        remarks: "Gate physical count verified. 2 damaged units isolated.",
        items: [
          {
            itemId: item.id,
            actualReceivedQuantity: 50,
            acceptedQuantity: 48,
            damagedQuantity: 2,
            rejectedQuantity: 0,
            batchNumber: "LOT-2026-X9",
            warehouseId: testWarehouse.id,
          },
        ],
      },
    });

    assert.equal(res.statusCode, 200, `Failed: ${res.body}`);
    const data = JSON.parse(res.body);
    assert.equal(data.status, "INVENTORY_VERIFIED", "Status must become INVENTORY_VERIFIED");

    // Verify verification record
    const verRecord = await prisma.invoiceOrderVerification.findFirst({
      where: { invoiceOrderId: adminCreatedIOId },
    });
    assert.ok(verRecord, "InvoiceOrderVerification record must be persisted");
    assert.equal(verRecord.verificationStatus, "VERIFIED");
  });

  // ---------------------------------------------------------------------------
  // TEST 6: Invalid Verification Breakdown Rejection
  // ---------------------------------------------------------------------------
  it("6. Verification fails if Actual Received !== Accepted + Rejected + Damaged", async () => {
    const ioDetails = await prisma.invoiceOrder.findUnique({
      where: { id: adminCreatedIOId },
      include: { items: true },
    });
    const item = ioDetails!.items[0];

    // Math mismatch: actual = 50, but 40 + 5 + 0 = 45!
    const res = await app.inject({
      method: "POST",
      url: `/crm/procurement/invoice-orders/${adminCreatedIOId}/verify`,
      headers: {
        authorization: `Bearer ${inventoryManagerToken}`,
        "content-type": "application/json",
      },
      payload: {
        isDraft: false,
        items: [
          {
            itemId: item.id,
            actualReceivedQuantity: 50,
            acceptedQuantity: 40,
            damagedQuantity: 5,
            rejectedQuantity: 0,
          },
        ],
      },
    });

    assert.equal(res.statusCode, 400, "Must reject verification math mismatch with 400 Bad Request");
  });

  // ---------------------------------------------------------------------------
  // TEST 7: Independent Admin Approves Verified IO
  // ---------------------------------------------------------------------------
  it("7. Another Admin approves the verified IO -> Creates GRN and transitions status to APPROVED", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/crm/procurement/invoice-orders/${adminCreatedIOId}/approve`,
      headers: {
        authorization: `Bearer ${secondAdminToken}`, // secondAdminUser did not create this IO!
        "content-type": "application/json",
      },
      payload: { remarks: "Approved after verifying gate receipt." },
    });

    assert.equal(res.statusCode, 200, `Failed: ${res.body}`);
    const data = JSON.parse(res.body);
    assert.equal(data.status, "APPROVED", "Status must be APPROVED for NQZ goods");
    assert.ok(data.goodsReceiptId, "GoodsReceipt link must be created");

    // Verify GoodsReceipt created
    const grn = await prisma.goodsReceipt.findUnique({
      where: { id: data.goodsReceiptId },
      include: { items: true },
    });
    assert.ok(grn, "GoodsReceipt must exist in DB");
    assert.match(grn.grnNumber, /^GRN-\d{6}$/);
    assert.equal(grn.status, "ACCEPTED");
  });

  // ---------------------------------------------------------------------------
  // TEST 8: Stock Posting Posts ONLY Accepted Quantity and Creates StockMovement
  // ---------------------------------------------------------------------------
  it("8. Stock posting increments Material by accepted quantity (48) only — damaged units (2) excluded", async () => {
    const initialMat = await prisma.material.findUnique({ where: { id: nqzMaterial.id } });
    const initialQty = initialMat!.quantity;

    const res = await app.inject({
      method: "POST",
      url: `/crm/procurement/invoice-orders/${adminCreatedIOId}/post-stock`,
      headers: {
        authorization: `Bearer ${inventoryManagerToken}`,
        "content-type": "application/json",
      },
      payload: {},
    });

    assert.equal(res.statusCode, 200, `Failed: ${res.body}`);
    const data = JSON.parse(res.body);
    assert.equal(data.status, "STOCKED", "IO status must be STOCKED");

    // Verify Material physical quantity increased by +48 (NOT 50, NOT 48+2)
    const updatedMat = await prisma.material.findUnique({ where: { id: nqzMaterial.id } });
    assert.equal(
      updatedMat!.quantity,
      initialQty + 48,
      "Material usable quantity must strictly increase by accepted quantity (+48)"
    );

    // Verify immutable Stock Movement ledger entry
    const movement = await prisma.stockMovement.findFirst({
      where: { referenceId: adminCreatedIOId, materialId: nqzMaterial.id },
    });
    assert.ok(movement, "StockMovement ledger entry must be created");
    assert.equal(movement.quantity, 48);
    assert.equal(movement.movementType, "RECEIPT");
    assert.equal(movement.source, "INVOICE_ORDER");

    // Verify PO line quantityReceived was incremented by 48
    const poLine = await prisma.purchaseOrderItem.findUnique({
      where: { id: testPO.items[0].id },
    });
    assert.equal(poLine!.quantityReceived, 48);
  });

  // ---------------------------------------------------------------------------
  // TEST 9: Duplicate Stock Posting Prevention
  // ---------------------------------------------------------------------------
  it("9. Calling post-stock on an already STOCKED IO is rejected (Idempotency safeguard)", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/crm/procurement/invoice-orders/${adminCreatedIOId}/post-stock`,
      headers: {
        authorization: `Bearer ${inventoryManagerToken}`,
        "content-type": "application/json",
      },
      payload: {},
    });

    assert.equal(res.statusCode, 400, "Duplicate stock posting must be rejected with 400 error");
    const body = JSON.parse(res.body);
    assert.match(body.message || body.error, /already been stocked/i);
  });

  // ---------------------------------------------------------------------------
  // TEST 10: QTZ Materials Quarantined in QC_PENDING
  // ---------------------------------------------------------------------------
  it("10. QTZ material approval routes to QC_PENDING quarantine and does NOT increase usable stock", async () => {
    // 1. Inventory verifies invMgrCreatedIOId (which has QTZ cell material)
    const ioDetails = await prisma.invoiceOrder.findUnique({
      where: { id: invMgrCreatedIOId },
      include: { items: true },
    });
    const qtzLine = ioDetails!.items[0];

    await app.inject({
      method: "POST",
      url: `/crm/procurement/invoice-orders/${invMgrCreatedIOId}/verify`,
      headers: {
        authorization: `Bearer ${inventoryManagerToken}`,
        "content-type": "application/json",
      },
      payload: {
        isDraft: false,
        items: [
          {
            itemId: qtzLine.id,
            actualReceivedQuantity: 30,
            acceptedQuantity: 30,
            damagedQuantity: 0,
            rejectedQuantity: 0,
            batchNumber: "CELL-BATCH-A1",
          },
        ],
      },
    });

    // 2. Admin authorizes it
    const approveRes = await app.inject({
      method: "POST",
      url: `/crm/procurement/invoice-orders/${invMgrCreatedIOId}/approve`,
      headers: {
        authorization: `Bearer ${adminToken}`,
        "content-type": "application/json",
      },
      payload: { remarks: "Cell batch received. Move to QC inspection quarantine." },
    });

    assert.equal(approveRes.statusCode, 200);
    const data = JSON.parse(approveRes.body);
    assert.equal(data.status, "QC_PENDING", "QTZ components must transition to QC_PENDING quarantine");

    // 3. Verify usable stock was NOT posted
    const cellMat = await prisma.material.findUnique({ where: { id: qtzMaterial.id } });
    assert.equal(cellMat!.quantity, 50, "Usable cell stock must NOT increase while in QC_PENDING");
  });

  // ---------------------------------------------------------------------------
  // TEST 11: Duplicate Supplier Invoice Protection
  // ---------------------------------------------------------------------------
  it("11. Duplicate supplier invoice number under the same vendor is rejected with 409 Conflict", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/crm/procurement/invoice-orders",
      headers: {
        authorization: `Bearer ${adminToken}`,
        "content-type": "application/json",
      },
      payload: {
        purchaseOrderId: testPO.id,
        vendorId: testVendor.id,
        supplierInvoiceNumber: adminSupplierInvNum, // REUSING existing invoice number!
        invoiceType: "FINAL_TAX_INVOICE",
        submitNow: false,
        items: [
          {
            poItemId: testPO.items[0].id,
            materialId: nqzMaterial.id,
            description: nqzMaterial.name,
            invoiceQuantity: 10,
            unitPrice: 250,
          },
        ],
      },
    });

    assert.equal(res.statusCode, 409, "Must return 409 Conflict on duplicate supplier invoice number");
  });

  // ---------------------------------------------------------------------------
  // TEST 12: Payment Recording Updates Balances
  // ---------------------------------------------------------------------------
  it("12. Recording payments updates paidAmount, outstandingAmount, and paymentStatus", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/crm/procurement/invoice-orders/${adminCreatedIOId}/payments`,
      headers: {
        authorization: `Bearer ${adminToken}`,
        "content-type": "application/json",
      },
      payload: {
        amount: 5000,
        paymentMethod: "BANK_TRANSFER",
        paymentReference: "UTR9944112200",
        notes: "Advance 5000 cleared",
      },
    });

    assert.equal(res.statusCode, 200, `Failed: ${res.body}`);
    const data = JSON.parse(res.body);
    assert.equal(Number(data.doc.paidAmount), 5000);
    assert.equal(data.doc.paymentStatus, "PARTIALLY_PAID");

    const paymentRecord = await prisma.invoicePayment.findFirst({
      where: { invoiceOrderId: adminCreatedIOId },
    });
    assert.ok(paymentRecord, "InvoicePayment record must exist");
    assert.equal(Number(paymentRecord.amount), 5000);
  });

  // ---------------------------------------------------------------------------
  // TEST 13: Admin Rejection Flow
  // ---------------------------------------------------------------------------
  it("13. Admin rejects IO with reason -> Status transitions to REJECTED", async () => {
    // Create fresh draft IO
    const createRes = await app.inject({
      method: "POST",
      url: "/crm/procurement/invoice-orders",
      headers: {
        authorization: `Bearer ${inventoryManagerToken}`,
        "content-type": "application/json",
      },
      payload: {
        purchaseOrderId: testPO.id,
        vendorId: testVendor.id,
        supplierInvoiceNumber: `INV-REJ-${Date.now()}`,
        invoiceType: "FINAL_TAX_INVOICE",
        submitNow: true,
        items: [
          {
            poItemId: testPO.items[0].id,
            materialId: nqzMaterial.id,
            description: nqzMaterial.name,
            invoiceQuantity: 10,
            unitPrice: 250,
          },
        ],
      },
    });
    const newIO = JSON.parse(createRes.body);

    const rejRes = await app.inject({
      method: "POST",
      url: `/crm/procurement/invoice-orders/${newIO.id}/reject`,
      headers: {
        authorization: `Bearer ${adminToken}`,
        "content-type": "application/json",
      },
      payload: { reason: "Damaged shipping container; delivery refused." },
    });

    assert.equal(rejRes.statusCode, 200);
    const data = JSON.parse(rejRes.body);
    assert.equal(data.status, "REJECTED");
    assert.equal(data.rejectionReason, "Damaged shipping container; delivery refused.");
  });

  // ---------------------------------------------------------------------------
  // TEST 14: Correction Request Flow
  // ---------------------------------------------------------------------------
  it("14. Inventory Manager requests correction -> Status transitions to CORRECTION_REQUIRED", async () => {
    const createRes = await app.inject({
      method: "POST",
      url: "/crm/procurement/invoice-orders",
      headers: {
        authorization: `Bearer ${adminToken}`,
        "content-type": "application/json",
      },
      payload: {
        purchaseOrderId: testPO.id,
        vendorId: testVendor.id,
        supplierInvoiceNumber: `INV-CORR-${Date.now()}`,
        invoiceType: "FINAL_TAX_INVOICE",
        submitNow: true,
        items: [
          {
            poItemId: testPO.items[0].id,
            materialId: nqzMaterial.id,
            description: nqzMaterial.name,
            invoiceQuantity: 20,
            unitPrice: 250,
          },
        ],
      },
    });
    const newIO = JSON.parse(createRes.body);

    const corrRes = await app.inject({
      method: "POST",
      url: `/crm/procurement/invoice-orders/${newIO.id}/request-correction`,
      headers: {
        authorization: `Bearer ${inventoryManagerToken}`,
        "content-type": "application/json",
      },
      payload: { remarks: "Invoice tax rate entered as 0% but HSN requires 18%." },
    });

    assert.equal(corrRes.statusCode, 200);
    const data = JSON.parse(corrRes.body);
    assert.equal(data.status, "CORRECTION_REQUIRED");
    assert.equal(data.correctionRemarks, "Invoice tax rate entered as 0% but HSN requires 18%.");
  });

  // ---------------------------------------------------------------------------
  // TEST 15: PR Creation, Submission, and Self-Approval Prohibition (SoD)
  // ---------------------------------------------------------------------------
  it("15. PR Creator cannot self-approve own Purchase Request (Segregation of Duties)", async () => {
    // 1. AdminOne creates a PR
    const prRes = await app.inject({
      method: "POST",
      url: "/crm/procurement/purchase-requests",
      headers: {
        authorization: `Bearer ${adminToken}`,
        "content-type": "application/json",
      },
      payload: {
        source: "MANUAL",
        priority: "HIGH",
        requiredDate: new Date(Date.now() + 7 * 86400000).toISOString(),
        reason: "Battery pack assembly raw material indent",
        items: [
          {
            materialId: nqzMaterial.id,
            requestedQuantity: 50,
            requiredDate: new Date(Date.now() + 7 * 86400000).toISOString(),
            specification: "Grade A Nickel Busbars",
          },
        ],
      },
    });

    assert.equal(prRes.statusCode, 200);
    const pr = JSON.parse(prRes.body);
    assert.equal(pr.status, "DRAFT");

    // 2. Submit PR
    const subRes = await app.inject({
      method: "PUT",
      url: `/crm/procurement/purchase-requests/${pr.id}/submit`,
      headers: {
        authorization: `Bearer ${adminToken}`,
        "content-type": "application/json",
      },
      payload: {},
    });
    assert.equal(subRes.statusCode, 200);

    // 3. AdminOne (creator) attempts self-approval -> Must be rejected with 403
    const selfApproveRes = await app.inject({
      method: "PUT",
      url: `/crm/procurement/purchase-requests/${pr.id}/approve`,
      headers: {
        authorization: `Bearer ${adminToken}`,
        "content-type": "application/json",
      },
      payload: { comments: "Self approving my PR" },
    });
    assert.equal(selfApproveRes.statusCode, 403);
    assert.match(JSON.parse(selfApproveRes.body).error, /Segregation of duties/i);

    // 4. Independent AdminTwo approves -> Succeeded
    const independentApproveRes = await app.inject({
      method: "PUT",
      url: `/crm/procurement/purchase-requests/${pr.id}/approve`,
      headers: {
        authorization: `Bearer ${secondAdminToken}`,
        "content-type": "application/json",
      },
      payload: { comments: "Approved by independent Admin Two" },
    });
    assert.equal(independentApproveRes.statusCode, 200);
    assert.equal(JSON.parse(independentApproveRes.body).status, "APPROVED");
  });

  // ---------------------------------------------------------------------------
  // TEST 16: PR Admin Return for Correction & Resubmission
  // ---------------------------------------------------------------------------
  it("16. Admin returns PR for correction -> Requester edits draft and resubmits", async () => {
    // 1. Purchase Manager creates PR
    const createRes = await app.inject({
      method: "POST",
      url: "/crm/procurement/purchase-requests",
      headers: {
        authorization: `Bearer ${purchaseManagerToken}`,
        "content-type": "application/json",
      },
      payload: {
        source: "LOW_STOCK",
        priority: "NORMAL",
        requiredDate: new Date(Date.now() + 5 * 86400000).toISOString(),
        reason: "Initial indent",
        items: [
          {
            materialId: nqzMaterial.id,
            requestedQuantity: 20,
            requiredDate: new Date(Date.now() + 5 * 86400000).toISOString(),
          },
        ],
      },
    });
    const pr = JSON.parse(createRes.body);

    // Submit
    const subPrRes = await app.inject({
      method: "PUT",
      url: `/crm/procurement/purchase-requests/${pr.id}/submit`,
      headers: {
        authorization: `Bearer ${purchaseManagerToken}`,
        "content-type": "application/json",
      },
      payload: {},
    });
    assert.equal(subPrRes.statusCode, 200);

    // 2. Admin returns for correction
    const corrRes = await app.inject({
      method: "PUT",
      url: `/crm/procurement/purchase-requests/${pr.id}/request-correction`,
      headers: {
        authorization: `Bearer ${adminToken}`,
        "content-type": "application/json",
      },
      payload: { comments: "Increase quantity from 20 to 30 to meet minimum order size." },
    });
    assert.equal(corrRes.statusCode, 200);
    const returnedPR = JSON.parse(corrRes.body);
    assert.equal(returnedPR.status, "DRAFT");
    assert.match(returnedPR.notes, /CORRECTION_REQUIRED/);

    // 3. Purchase Manager edits and updates to 30
    const editRes = await app.inject({
      method: "PUT",
      url: `/crm/procurement/purchase-requests/${pr.id}`,
      headers: {
        authorization: `Bearer ${purchaseManagerToken}`,
        "content-type": "application/json",
      },
      payload: {
        source: "LOW_STOCK",
        priority: "NORMAL",
        requiredDate: new Date(Date.now() + 5 * 86400000).toISOString(),
        reason: "Updated indent to 30 units per Admin request",
        items: [
          {
            materialId: nqzMaterial.id,
            requestedQuantity: 30,
            requiredDate: new Date(Date.now() + 5 * 86400000).toISOString(),
          },
        ],
      },
    });
    assert.equal(editRes.statusCode, 200);

    // 4. Resubmit
    const resubRes = await app.inject({
      method: "PUT",
      url: `/crm/procurement/purchase-requests/${pr.id}/submit`,
      headers: {
        authorization: `Bearer ${purchaseManagerToken}`,
        "content-type": "application/json",
      },
      payload: {},
    });
    assert.equal(resubRes.statusCode, 200);
    assert.equal(JSON.parse(resubRes.body).status, "PENDING_APPROVAL");
  });

  // ---------------------------------------------------------------------------
  // TEST 17: PO Quantity cannot exceed approved PR Quantity
  // ---------------------------------------------------------------------------
  it("17. PO creation rejects exceeding approved PR line quantities and unapproved PRs", async () => {
    // 1. Create and Approve a PR for 25 units
    const prRes = await app.inject({
      method: "POST",
      url: "/crm/procurement/purchase-requests",
      headers: {
        authorization: `Bearer ${purchaseManagerToken}`,
        "content-type": "application/json",
      },
      payload: {
        source: "PRODUCTION_REQUIREMENT",
        priority: "HIGH",
        requiredDate: new Date(Date.now() + 3 * 86400000).toISOString(),
        reason: "Test PR for PO quantity limit check",
        items: [
          {
            materialId: nqzMaterial.id,
            requestedQuantity: 25,
            requiredDate: new Date(Date.now() + 3 * 86400000).toISOString(),
          },
        ],
      },
    });
    const pr = JSON.parse(prRes.body);

    // Unapproved PR cannot generate PO
    const unapprovedPORes = await app.inject({
      method: "POST",
      url: "/crm/procurement/purchase-orders",
      headers: {
        authorization: `Bearer ${adminToken}`,
        "content-type": "application/json",
      },
      payload: {
        vendorId: testVendor.id,
        purchaseRequestId: pr.id,
        expectedDeliveryDate: new Date(Date.now() + 7 * 86400000).toISOString(),
        paymentTerms: "CREDIT (30 Days)",
        deliveryTerms: "EXW",
        billingAddress: "KYRA Pune",
        deliveryAddress: "KYRA Pune Depot",
        items: [
          {
            materialId: nqzMaterial.id,
            description: nqzMaterial.name,
            quantityOrdered: 25,
            unitPrice: 100,
          },
        ],
      },
    });
    assert.equal(unapprovedPORes.statusCode, 400);
    assert.match(JSON.parse(unapprovedPORes.body).error, /PR must be in APPROVED status/);

    // Submit and approve PR
    const subPrOkRes = await app.inject({
      method: "PUT",
      url: `/crm/procurement/purchase-requests/${pr.id}/submit`,
      headers: {
        authorization: `Bearer ${purchaseManagerToken}`,
        "content-type": "application/json",
      },
      payload: {},
    });
    assert.equal(subPrOkRes.statusCode, 200);

    const approvePrOkRes = await app.inject({
      method: "PUT",
      url: `/crm/procurement/purchase-requests/${pr.id}/approve`,
      headers: {
        authorization: `Bearer ${adminToken}`,
        "content-type": "application/json",
      },
      payload: { comments: "Approved for 25 units" },
    });
    assert.equal(approvePrOkRes.statusCode, 200);

    // Attempt PO with 30 units (> 25 approved) -> Must fail with 400
    const excessPORes = await app.inject({
      method: "POST",
      url: "/crm/procurement/purchase-orders",
      headers: {
        authorization: `Bearer ${adminToken}`,
        "content-type": "application/json",
      },
      payload: {
        vendorId: testVendor.id,
        purchaseRequestId: pr.id,
        expectedDeliveryDate: new Date(Date.now() + 7 * 86400000).toISOString(),
        paymentTerms: "CASH (Immediate)",
        deliveryTerms: "EXW",
        billingAddress: "KYRA Pune",
        deliveryAddress: "KYRA Pune Depot",
        items: [
          {
            materialId: nqzMaterial.id,
            description: nqzMaterial.name,
            quantityOrdered: 30, // Exceeds 25!
            unitPrice: 100,
          },
        ],
      },
    });
    assert.equal(excessPORes.statusCode, 400);
    assert.match(JSON.parse(excessPORes.body).error, /exceeds approved PR quantity/);

    // Valid PO with 25 units -> Succeeds and marks PR as ORDERED
    const validPORes = await app.inject({
      method: "POST",
      url: "/crm/procurement/purchase-orders",
      headers: {
        authorization: `Bearer ${adminToken}`,
        "content-type": "application/json",
      },
      payload: {
        vendorId: testVendor.id,
        purchaseRequestId: pr.id,
        expectedDeliveryDate: new Date(Date.now() + 7 * 86400000).toISOString(),
        paymentTerms: "CASH (Immediate)",
        deliveryTerms: "EXW",
        billingAddress: "KYRA Pune",
        deliveryAddress: "KYRA Pune Depot",
        items: [
          {
            materialId: nqzMaterial.id,
            description: nqzMaterial.name,
            quantityOrdered: 25,
            unitPrice: 100,
          },
        ],
      },
    });
    assert.ok(validPORes.statusCode === 200 || validPORes.statusCode === 201);

    const updatedPR = await prisma.purchaseRequest.findUnique({ where: { id: pr.id } });
    assert.equal(updatedPR?.status, "ORDERED");
  });

  // ---------------------------------------------------------------------------
  // TEST 18: Multiple partial deliveries via sequential Invoice Orders
  // ---------------------------------------------------------------------------
  it("18. Multiple partial deliveries via sequential IOs (60 -> 40) update PO to PARTIALLY_RECEIVED then RECEIVED with cumulative stock", async () => {
    const stockStart = (await prisma.material.findUnique({ where: { id: nqzMaterial.id } }))?.quantity || 0;
    const testPONum = `PO-PARTIAL-IO-${Date.now()}`;
    const multiPO = await prisma.purchaseOrder.create({
      data: {
        poNumber: testPONum,
        vendorId: testVendor.id,
        createdById: adminUser.id,
        status: "APPROVED",
        currency: "INR",
        subtotal: 25000,
        tax: 4500,
        grandTotal: 29500,
        paymentTerms: "CREDIT (30 Days)",
        deliveryTerms: "EXW Pune Depot",
        billingAddress: "KYRA Pune",
        deliveryAddress: "KYRA Central Warehouse",
        expectedDeliveryDate: new Date(Date.now() + 7 * 86400000),
        items: {
          create: [
            {
              materialId: nqzMaterial.id,
              description: nqzMaterial.name,
              quantityOrdered: 100,
              quantityReceived: 0,
              quantityPending: 100,
              unitPrice: 250,
              taxRate: 18,
              taxAmount: 4500,
              lineSubtotal: 25000,
              lineTotal: 29500,
            },
          ],
        },
      },
      include: { items: true },
    });
    const poLine = multiPO.items[0];

    // Delivery 1: Admin registers IO1 for 60 units
    const io1Res = await app.inject({
      method: "POST",
      url: "/crm/procurement/invoice-orders",
      headers: {
        authorization: `Bearer ${adminToken}`,
        "content-type": "application/json",
      },
      payload: {
        purchaseOrderId: multiPO.id,
        vendorId: testVendor.id,
        supplierInvoiceNumber: `INV-SEQ-P1-${Date.now()}`,
        paymentMode: "CREDIT",
        submitNow: true,
        items: [
          {
            poItemId: poLine.id,
            materialId: nqzMaterial.id,
            description: nqzMaterial.name,
            invoiceQuantity: 60,
            unitPrice: 250,
            taxRate: 18,
          },
        ],
      },
    });
    assert.equal(io1Res.statusCode, 201);
    const io1 = JSON.parse(io1Res.body);
    const io1Db = await prisma.invoiceOrder.findUnique({ where: { id: io1.id }, include: { items: true } });

    // Inventory Manager verifies 60 units received and accepted
    const verify1Res = await app.inject({
      method: "POST",
      url: `/crm/procurement/invoice-orders/${io1.id}/verify`,
      headers: {
        authorization: `Bearer ${inventoryManagerToken}`,
        "content-type": "application/json",
      },
      payload: {
        items: [
          {
            itemId: io1Db!.items[0].id,
            actualReceivedQuantity: 60,
            acceptedQuantity: 60,
            rejectedQuantity: 0,
            damagedQuantity: 0,
            batchNumber: "BATCH-SEQ-60",
          },
        ],
      },
    });
    assert.equal(verify1Res.statusCode, 200);

    // Second Admin authorizes IO1
    const app1Res = await app.inject({
      method: "POST",
      url: `/crm/procurement/invoice-orders/${io1.id}/approve`,
      headers: {
        authorization: `Bearer ${secondAdminToken}`,
        "content-type": "application/json",
      },
      payload: { remarks: "Approved Delivery 1 of 60" },
    });
    assert.equal(app1Res.statusCode, 200);

    // Stock posting for IO1
    const post1Res = await app.inject({
      method: "POST",
      url: `/crm/procurement/invoice-orders/${io1.id}/post-stock`,
      headers: {
        authorization: `Bearer ${inventoryManagerToken}`,
        "content-type": "application/json",
      },
      payload: {},
    });
    assert.equal(post1Res.statusCode, 200);

    // Check intermediate PO status & stock
    const poAfter1 = await prisma.purchaseOrder.findUnique({
      where: { id: multiPO.id },
      include: { items: true },
    });
    assert.equal(poAfter1?.status, "PARTIALLY_RECEIVED");
    assert.equal(poAfter1?.items[0].quantityReceived, 60);
    assert.equal(poAfter1?.items[0].quantityPending, 40);

    const stockAfter1 = (await prisma.material.findUnique({ where: { id: nqzMaterial.id } }))?.quantity || 0;
    assert.equal(stockAfter1, stockStart + 60);

    // Delivery 2: Admin registers IO2 for remaining 40 units
    const io2Res = await app.inject({
      method: "POST",
      url: "/crm/procurement/invoice-orders",
      headers: {
        authorization: `Bearer ${adminToken}`,
        "content-type": "application/json",
      },
      payload: {
        purchaseOrderId: multiPO.id,
        vendorId: testVendor.id,
        supplierInvoiceNumber: `INV-SEQ-P2-${Date.now()}`,
        paymentMode: "CREDIT",
        submitNow: true,
        items: [
          {
            poItemId: poLine.id,
            materialId: nqzMaterial.id,
            description: nqzMaterial.name,
            invoiceQuantity: 40,
            unitPrice: 250,
            taxRate: 18,
          },
        ],
      },
    });
    assert.equal(io2Res.statusCode, 201);
    const io2 = JSON.parse(io2Res.body);
    const io2Db = await prisma.invoiceOrder.findUnique({ where: { id: io2.id }, include: { items: true } });

    // Inventory Manager verifies 40 units
    const verify2Res = await app.inject({
      method: "POST",
      url: `/crm/procurement/invoice-orders/${io2.id}/verify`,
      headers: {
        authorization: `Bearer ${inventoryManagerToken}`,
        "content-type": "application/json",
      },
      payload: {
        items: [
          {
            itemId: io2Db!.items[0].id,
            actualReceivedQuantity: 40,
            acceptedQuantity: 40,
            rejectedQuantity: 0,
            damagedQuantity: 0,
            batchNumber: "BATCH-SEQ-40",
          },
        ],
      },
    });
    assert.equal(verify2Res.statusCode, 200);

    // Second Admin approves IO2
    const app2Res = await app.inject({
      method: "POST",
      url: `/crm/procurement/invoice-orders/${io2.id}/approve`,
      headers: {
        authorization: `Bearer ${secondAdminToken}`,
        "content-type": "application/json",
      },
      payload: { remarks: "Approved Delivery 2 of 40" },
    });
    assert.equal(app2Res.statusCode, 200);

    // Stock posting for IO2
    const post2Res = await app.inject({
      method: "POST",
      url: `/crm/procurement/invoice-orders/${io2.id}/post-stock`,
      headers: {
        authorization: `Bearer ${inventoryManagerToken}`,
        "content-type": "application/json",
      },
      payload: {},
    });
    assert.equal(post2Res.statusCode, 200);

    // PO should now be fully RECEIVED
    const poAfter2 = await prisma.purchaseOrder.findUnique({
      where: { id: multiPO.id },
      include: { items: true },
    });
    assert.equal(poAfter2?.status, "RECEIVED");
    assert.equal(poAfter2?.items[0].quantityReceived, 100);
    assert.equal(poAfter2?.items[0].quantityPending, 0);

    const stockAfter2 = (await prisma.material.findUnique({ where: { id: nqzMaterial.id } }))?.quantity || 0;
    assert.equal(stockAfter2, stockStart + 100);
  });

  // ---------------------------------------------------------------------------
  // TEST 19: Partial delivery with damaged and rejected units via IO
  // ---------------------------------------------------------------------------
  it("19. Partial delivery with damaged and rejected units -> Only accepted units enter stock; damaged/rejected recorded separately", async () => {
    const stockStart = (await prisma.material.findUnique({ where: { id: nqzMaterial.id } }))?.quantity || 0;
    const testPONum = `PO-DEFECT-IO-${Date.now()}`;
    const defectPO = await prisma.purchaseOrder.create({
      data: {
        poNumber: testPONum,
        vendorId: testVendor.id,
        createdById: adminUser.id,
        status: "APPROVED",
        currency: "INR",
        subtotal: 12500,
        tax: 2250,
        grandTotal: 14750,
        paymentTerms: "CREDIT (30 Days)",
        deliveryTerms: "EXW Pune Depot",
        billingAddress: "KYRA Pune",
        deliveryAddress: "KYRA Central Warehouse",
        expectedDeliveryDate: new Date(Date.now() + 7 * 86400000),
        items: {
          create: [
            {
              materialId: nqzMaterial.id,
              description: nqzMaterial.name,
              quantityOrdered: 50,
              quantityReceived: 0,
              quantityPending: 50,
              unitPrice: 250,
              taxRate: 18,
              taxAmount: 2250,
              lineSubtotal: 12500,
              lineTotal: 14750,
            },
          ],
        },
      },
      include: { items: true },
    });

    const ioRes = await app.inject({
      method: "POST",
      url: "/crm/procurement/invoice-orders",
      headers: {
        authorization: `Bearer ${adminToken}`,
        "content-type": "application/json",
      },
      payload: {
        purchaseOrderId: defectPO.id,
        vendorId: testVendor.id,
        supplierInvoiceNumber: `INV-DEFECT-${Date.now()}`,
        paymentMode: "CREDIT",
        submitNow: true,
        items: [
          {
            poItemId: defectPO.items[0].id,
            materialId: nqzMaterial.id,
            description: nqzMaterial.name,
            invoiceQuantity: 50,
            unitPrice: 250,
            taxRate: 18,
          },
        ],
      },
    });
    assert.equal(ioRes.statusCode, 201);
    const io = JSON.parse(ioRes.body);
    const ioDb = await prisma.invoiceOrder.findUnique({ where: { id: io.id }, include: { items: true } });

    // Inventory Manager verifies: 50 received, 42 accepted, 5 damaged, 3 rejected
    const verifyRes = await app.inject({
      method: "POST",
      url: `/crm/procurement/invoice-orders/${io.id}/verify`,
      headers: {
        authorization: `Bearer ${inventoryManagerToken}`,
        "content-type": "application/json",
      },
      payload: {
        items: [
          {
            itemId: ioDb!.items[0].id,
            actualReceivedQuantity: 50,
            acceptedQuantity: 42,
            rejectedQuantity: 3,
            damagedQuantity: 5,
            batchNumber: "BATCH-DEFECT-50",
            inspectionNotes: "5 units physically crushed; 3 units failed dimension tolerance",
          },
        ],
      },
    });
    assert.equal(verifyRes.statusCode, 200);

    // Second Admin approves
    const appRes = await app.inject({
      method: "POST",
      url: `/crm/procurement/invoice-orders/${io.id}/approve`,
      headers: {
        authorization: `Bearer ${secondAdminToken}`,
        "content-type": "application/json",
      },
      payload: { remarks: "Approved with damage/rejection notes" },
    });
    assert.equal(appRes.statusCode, 200);

    // Stock posting
    const postRes = await app.inject({
      method: "POST",
      url: `/crm/procurement/invoice-orders/${io.id}/post-stock`,
      headers: {
        authorization: `Bearer ${inventoryManagerToken}`,
        "content-type": "application/json",
      },
      payload: {},
    });
    assert.equal(postRes.statusCode, 200);

    // Verify stock increment: ONLY 42 accepted units! Damaged (5) + rejected (3) strictly excluded
    const stockAfter = (await prisma.material.findUnique({ where: { id: nqzMaterial.id } }))?.quantity || 0;
    assert.equal(stockAfter, stockStart + 42, "Stock must only increase by accepted units (42)");

    // Verify PO line: quantityReceived = 42, quantityPending = 8, status = PARTIALLY_RECEIVED
    const poUpdated = await prisma.purchaseOrder.findUnique({
      where: { id: defectPO.id },
      include: { items: true },
    });
    assert.equal(poUpdated?.status, "PARTIALLY_RECEIVED");
    assert.equal(poUpdated?.items[0].quantityReceived, 42);
    assert.equal(poUpdated?.items[0].quantityPending, 8);
  });

  // ---------------------------------------------------------------------------
  // TEST 20: Payment installments against Invoice Order
  // ---------------------------------------------------------------------------
  it("20. Payment installments update paidAmount and outstanding balance; Goods receiving never auto-settles payment", async () => {
    const testPONum = `PO-PAY-IO-${Date.now()}`;
    const payPO = await prisma.purchaseOrder.create({
      data: {
        poNumber: testPONum,
        vendorId: testVendor.id,
        createdById: adminUser.id,
        status: "APPROVED",
        currency: "INR",
        subtotal: 10000,
        tax: 1800,
        grandTotal: 11800,
        paymentTerms: "CREDIT (30 Days)",
        deliveryTerms: "EXW",
        billingAddress: "KYRA Pune",
        deliveryAddress: "KYRA Pune Warehouse",
        expectedDeliveryDate: new Date(Date.now() + 7 * 86400000),
        items: {
          create: [
            {
              materialId: nqzMaterial.id,
              description: nqzMaterial.name,
              quantityOrdered: 40,
              quantityReceived: 0,
              quantityPending: 40,
              unitPrice: 250,
              taxRate: 18,
              taxAmount: 1800,
              lineSubtotal: 10000,
              lineTotal: 11800,
            },
          ],
        },
      },
      include: { items: true },
    });

    const ioRes = await app.inject({
      method: "POST",
      url: "/crm/procurement/invoice-orders",
      headers: {
        authorization: `Bearer ${adminToken}`,
        "content-type": "application/json",
      },
      payload: {
        purchaseOrderId: payPO.id,
        vendorId: testVendor.id,
        supplierInvoiceNumber: `INV-PAY-${Date.now()}`,
        paymentMode: "CREDIT",
        submitNow: true,
        items: [
          {
            poItemId: payPO.items[0].id,
            materialId: nqzMaterial.id,
            description: nqzMaterial.name,
            invoiceQuantity: 40,
            unitPrice: 250,
            taxRate: 18,
          },
        ],
      },
    });
    assert.equal(ioRes.statusCode, 201);
    const io = JSON.parse(ioRes.body);
    const ioDb = await prisma.invoiceOrder.findUnique({ where: { id: io.id }, include: { items: true } });

    // Verify, approve, and post stock
    await app.inject({
      method: "POST",
      url: `/crm/procurement/invoice-orders/${io.id}/verify`,
      headers: {
        authorization: `Bearer ${inventoryManagerToken}`,
        "content-type": "application/json",
      },
      payload: {
        items: [
          {
            itemId: ioDb!.items[0].id,
            actualReceivedQuantity: 40,
            acceptedQuantity: 40,
            rejectedQuantity: 0,
            damagedQuantity: 0,
          },
        ],
      },
    });
    await app.inject({
      method: "POST",
      url: `/crm/procurement/invoice-orders/${io.id}/approve`,
      headers: {
        authorization: `Bearer ${secondAdminToken}`,
        "content-type": "application/json",
      },
      payload: { remarks: "Approved for payment test" },
    });
    await app.inject({
      method: "POST",
      url: `/crm/procurement/invoice-orders/${io.id}/post-stock`,
      headers: {
        authorization: `Bearer ${inventoryManagerToken}`,
        "content-type": "application/json",
      },
      payload: {},
    });

    // Check: Even though goods are STOCKED, paymentStatus must be UNPAID with 0 paidAmount!
    const ioAfterStock = await prisma.invoiceOrder.findUnique({ where: { id: io.id } });
    assert.equal(ioAfterStock?.status, "STOCKED");
    assert.equal(ioAfterStock?.paymentStatus, "UNPAID", "Goods receiving must NEVER auto-settle payment");
    assert.equal(Number(ioAfterStock?.paidAmount), 0);
    assert.equal(Number(ioAfterStock?.outstandingAmount), 11800);

    // Installment 1: Partial payment of Rs 5,000
    const pay1Res = await app.inject({
      method: "POST",
      url: `/crm/procurement/invoice-orders/${io.id}/payments`,
      headers: {
        authorization: `Bearer ${adminToken}`,
        "content-type": "application/json",
      },
      payload: {
        amount: 5000,
        paymentMethod: "BANK_TRANSFER",
        paymentReference: "UTR-INST-001",
        notes: "First installment 5000",
      },
    });
    assert.equal(pay1Res.statusCode, 200);
    const pay1Data = JSON.parse(pay1Res.body);
    const pay1Doc = pay1Data.doc || pay1Data;
    assert.equal(pay1Doc.paymentStatus, "PARTIALLY_PAID");
    assert.equal(Number(pay1Doc.paidAmount), 5000);
    assert.equal(Number(pay1Doc.outstandingAmount), 6800);

    // Installment 2: Settle remaining Rs 6,800
    const pay2Res = await app.inject({
      method: "POST",
      url: `/crm/procurement/invoice-orders/${io.id}/payments`,
      headers: {
        authorization: `Bearer ${adminToken}`,
        "content-type": "application/json",
      },
      payload: {
        amount: 6800,
        paymentMethod: "CHEQUE",
        paymentReference: "CHQ-INST-002",
        notes: "Final settlement 6800",
      },
    });
    assert.equal(pay2Res.statusCode, 200);
    const pay2Data = JSON.parse(pay2Res.body);
    const pay2Doc = pay2Data.doc || pay2Data;
    assert.equal(pay2Doc.paymentStatus, "PAID");
    assert.equal(Number(pay2Doc.paidAmount), 11800);
    assert.equal(Number(pay2Doc.outstandingAmount), 0);
  });

  // ---------------------------------------------------------------------------
  // TEST 21: Inventory Manager forbidden from changing commercial data / approving
  // ---------------------------------------------------------------------------
  it("21. RBAC enforces segregation: Inventory Manager cannot approve IOs or record payments", async () => {
    // 1. Inventory Manager cannot approve IO (403)
    const approveFailRes = await app.inject({
      method: "POST",
      url: `/crm/procurement/invoice-orders/${testPO.id}/approve`,
      headers: {
        authorization: `Bearer ${inventoryManagerToken}`,
        "content-type": "application/json",
      },
      payload: { remarks: "Unauthorized approval attempt" },
    });
    assert.equal(approveFailRes.statusCode, 403, "Inventory Manager must be forbidden from approving IOs");

    // 2. Inventory Manager cannot record payments (403)
    const payFailRes = await app.inject({
      method: "POST",
      url: `/crm/procurement/invoice-orders/${testPO.id}/payments`,
      headers: {
        authorization: `Bearer ${inventoryManagerToken}`,
        "content-type": "application/json",
      },
      payload: {
        amount: 1000,
        paymentMethod: "CASH",
      },
    });
    assert.equal(payFailRes.statusCode, 403, "Inventory Manager must be forbidden from recording payments");
  });

  // ---------------------------------------------------------------------------
  // TEST 22: QTZ quarantine maintained across multiple deliveries
  // ---------------------------------------------------------------------------
  it("22. QTZ components across multiple deliveries remain segregated in QC_PENDING quarantine without usable stock posting", async () => {
    const qtzStockStart = (await prisma.material.findUnique({ where: { id: qtzMaterial.id } }))?.quantity || 0;
    const testPONum = `PO-QTZ-MULTI-${Date.now()}`;
    const qtzPO = await prisma.purchaseOrder.create({
      data: {
        poNumber: testPONum,
        vendorId: testVendor.id,
        createdById: adminUser.id,
        status: "APPROVED",
        currency: "INR",
        subtotal: 36000,
        tax: 6480,
        grandTotal: 42480,
        paymentTerms: "CREDIT (30 Days)",
        deliveryTerms: "EXW",
        billingAddress: "KYRA Pune",
        deliveryAddress: "KYRA Central Warehouse",
        expectedDeliveryDate: new Date(Date.now() + 7 * 86400000),
        items: {
          create: [
            {
              materialId: qtzMaterial.id,
              description: qtzMaterial.name,
              quantityOrdered: 20,
              quantityReceived: 0,
              quantityPending: 20,
              unitPrice: 1800,
              taxRate: 18,
              taxAmount: 6480,
              lineSubtotal: 36000,
              lineTotal: 42480,
            },
          ],
        },
      },
      include: { items: true },
    });

    // Delivery 1: 10 QTZ cells
    const io1Res = await app.inject({
      method: "POST",
      url: "/crm/procurement/invoice-orders",
      headers: {
        authorization: `Bearer ${adminToken}`,
        "content-type": "application/json",
      },
      payload: {
        purchaseOrderId: qtzPO.id,
        vendorId: testVendor.id,
        supplierInvoiceNumber: `INV-QTZ-D1-${Date.now()}`,
        paymentMode: "CREDIT",
        submitNow: true,
        items: [
          {
            poItemId: qtzPO.items[0].id,
            materialId: qtzMaterial.id,
            description: qtzMaterial.name,
            invoiceQuantity: 10,
            unitPrice: 1800,
            taxRate: 18,
          },
        ],
      },
    });
    const io1 = JSON.parse(io1Res.body);
    const io1Db = await prisma.invoiceOrder.findUnique({ where: { id: io1.id }, include: { items: true } });

    await app.inject({
      method: "POST",
      url: `/crm/procurement/invoice-orders/${io1.id}/verify`,
      headers: {
        authorization: `Bearer ${inventoryManagerToken}`,
        "content-type": "application/json",
      },
      payload: {
        items: [
          {
            itemId: io1Db!.items[0].id,
            actualReceivedQuantity: 10,
            acceptedQuantity: 10,
            rejectedQuantity: 0,
            damagedQuantity: 0,
            batchNumber: "BATCH-QTZ-01",
          },
        ],
      },
    });

    const app1Res = await app.inject({
      method: "POST",
      url: `/crm/procurement/invoice-orders/${io1.id}/approve`,
      headers: {
        authorization: `Bearer ${secondAdminToken}`,
        "content-type": "application/json",
      },
      payload: { remarks: "Approved QTZ Delivery 1" },
    });
    const io1Approved = JSON.parse(app1Res.body);
    assert.equal(io1Approved.status, "QC_PENDING", "QTZ delivery must enter QC_PENDING quarantine");

    // Usable stock must remain unchanged!
    const qtzStockAfter1 = (await prisma.material.findUnique({ where: { id: qtzMaterial.id } }))?.quantity || 0;
    assert.equal(qtzStockAfter1, qtzStockStart, "Usable stock of QTZ material must not increment prior to QC inspection");

    // Delivery 2: 10 QTZ cells
    const io2Res = await app.inject({
      method: "POST",
      url: "/crm/procurement/invoice-orders",
      headers: {
        authorization: `Bearer ${adminToken}`,
        "content-type": "application/json",
      },
      payload: {
        purchaseOrderId: qtzPO.id,
        vendorId: testVendor.id,
        supplierInvoiceNumber: `INV-QTZ-D2-${Date.now()}`,
        paymentMode: "CREDIT",
        submitNow: true,
        items: [
          {
            poItemId: qtzPO.items[0].id,
            materialId: qtzMaterial.id,
            description: qtzMaterial.name,
            invoiceQuantity: 10,
            unitPrice: 1800,
            taxRate: 18,
          },
        ],
      },
    });
    const io2 = JSON.parse(io2Res.body);
    const io2Db = await prisma.invoiceOrder.findUnique({ where: { id: io2.id }, include: { items: true } });

    await app.inject({
      method: "POST",
      url: `/crm/procurement/invoice-orders/${io2.id}/verify`,
      headers: {
        authorization: `Bearer ${inventoryManagerToken}`,
        "content-type": "application/json",
      },
      payload: {
        items: [
          {
            itemId: io2Db!.items[0].id,
            actualReceivedQuantity: 10,
            acceptedQuantity: 10,
            rejectedQuantity: 0,
            damagedQuantity: 0,
            batchNumber: "BATCH-QTZ-02",
          },
        ],
      },
    });

    const app2Res = await app.inject({
      method: "POST",
      url: `/crm/procurement/invoice-orders/${io2.id}/approve`,
      headers: {
        authorization: `Bearer ${secondAdminToken}`,
        "content-type": "application/json",
      },
      payload: { remarks: "Approved QTZ Delivery 2" },
    });
    const io2Approved = JSON.parse(app2Res.body);
    assert.equal(io2Approved.status, "QC_PENDING", "Second QTZ delivery must also enter QC_PENDING quarantine");

    // Usable stock still unchanged
    const qtzStockAfter2 = (await prisma.material.findUnique({ where: { id: qtzMaterial.id } }))?.quantity || 0;
    assert.equal(qtzStockAfter2, qtzStockStart, "QTZ stock must remain completely quarantined");
  });

  // ---------------------------------------------------------------------------
  // TEST 23: Concurrent stock-posting protection (Pessimistic Row Locking)
  // ---------------------------------------------------------------------------
  it("23. Concurrent post-stock calls serialize with SELECT FOR UPDATE; duplicate stock increment is prevented", async () => {
    const stockStart = (await prisma.material.findUnique({ where: { id: nqzMaterial.id } }))?.quantity || 0;
    const testPONum = `PO-CONCUR-${Date.now()}`;
    const concurPO = await prisma.purchaseOrder.create({
      data: {
        poNumber: testPONum,
        vendorId: testVendor.id,
        createdById: adminUser.id,
        status: "APPROVED",
        currency: "INR",
        subtotal: 5000,
        tax: 900,
        grandTotal: 5900,
        paymentTerms: "CREDIT (30 Days)",
        deliveryTerms: "EXW",
        billingAddress: "KYRA Pune",
        deliveryAddress: "KYRA Central Warehouse",
        expectedDeliveryDate: new Date(Date.now() + 7 * 86400000),
        items: {
          create: [
            {
              materialId: nqzMaterial.id,
              description: nqzMaterial.name,
              quantityOrdered: 20,
              quantityReceived: 0,
              quantityPending: 20,
              unitPrice: 250,
              taxRate: 18,
              taxAmount: 900,
              lineSubtotal: 5000,
              lineTotal: 5900,
            },
          ],
        },
      },
      include: { items: true },
    });

    const ioRes = await app.inject({
      method: "POST",
      url: "/crm/procurement/invoice-orders",
      headers: {
        authorization: `Bearer ${adminToken}`,
        "content-type": "application/json",
      },
      payload: {
        purchaseOrderId: concurPO.id,
        vendorId: testVendor.id,
        supplierInvoiceNumber: `INV-CONCUR-${Date.now()}`,
        paymentMode: "CREDIT",
        submitNow: true,
        items: [
          {
            poItemId: concurPO.items[0].id,
            materialId: nqzMaterial.id,
            description: nqzMaterial.name,
            invoiceQuantity: 20,
            unitPrice: 250,
            taxRate: 18,
          },
        ],
      },
    });
    const io = JSON.parse(ioRes.body);
    const ioDb = await prisma.invoiceOrder.findUnique({ where: { id: io.id }, include: { items: true } });

    await app.inject({
      method: "POST",
      url: `/crm/procurement/invoice-orders/${io.id}/verify`,
      headers: {
        authorization: `Bearer ${inventoryManagerToken}`,
        "content-type": "application/json",
      },
      payload: {
        items: [
          {
            itemId: ioDb!.items[0].id,
            actualReceivedQuantity: 20,
            acceptedQuantity: 20,
            rejectedQuantity: 0,
            damagedQuantity: 0,
          },
        ],
      },
    });

    await app.inject({
      method: "POST",
      url: `/crm/procurement/invoice-orders/${io.id}/approve`,
      headers: {
        authorization: `Bearer ${secondAdminToken}`,
        "content-type": "application/json",
      },
      payload: { remarks: "Approved for concurrency test" },
    });

    // Launch two post-stock requests concurrently
    const [resA, resB] = await Promise.all([
      app.inject({
        method: "POST",
        url: `/crm/procurement/invoice-orders/${io.id}/post-stock`,
        headers: {
          authorization: `Bearer ${inventoryManagerToken}`,
          "content-type": "application/json",
        },
        payload: {},
      }),
      app.inject({
        method: "POST",
        url: `/crm/procurement/invoice-orders/${io.id}/post-stock`,
        headers: {
          authorization: `Bearer ${inventoryManagerToken}`,
          "content-type": "application/json",
        },
        payload: {},
      }),
    ]);

    const statusCodes = [resA.statusCode, resB.statusCode].sort();
    assert.equal(statusCodes[0], 200, "One request must succeed with 200");
    assert.equal(statusCodes[1], 400, "The second concurrent request must be rejected with 400 duplicate prevention");

    // Material quantity must increase by exactly 20, NEVER 40
    const stockAfter = (await prisma.material.findUnique({ where: { id: nqzMaterial.id } }))?.quantity || 0;
    assert.equal(stockAfter, stockStart + 20, "Material quantity must increase exactly once (+20)");
  });
});
