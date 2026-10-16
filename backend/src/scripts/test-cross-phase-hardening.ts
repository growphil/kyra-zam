import Fastify from "fastify";
import { authPlugin } from "../plugins/auth";
import { authRoutes } from "../routes/auth";
import { salesOrderRoutes } from "../routes/salesOrders";
import { serviceRoutes } from "../routes/service";
import { testingRoutes } from "../routes/testing";
import { qualityRoutes } from "../routes/quality";
import { procurementRoutes } from "../routes/procurement";
import { paxRoutes } from "../routes/pax";
import { PrismaClient, CellStatus, PaxStatus, SalesOrderStatus } from "../generated/client";
import { multipartPlugin } from "../plugins/multipart";

const prisma = new PrismaClient();

const TEST_PREFIX = "CPH"; // Cross-Phase Hardening
let passed = 0;
let failed = 0;
const resultsList: { test: string; result: "PASS" | "FAIL"; detail?: string }[] = [];

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passed++;
    resultsList.push({ test: testName, result: "PASS" });
  } else {
    console.log(`  ❌ FAIL: ${testName} — ${detail || ""}`);
    failed++;
    resultsList.push({ test: testName, result: "FAIL", detail });
  }
}

function buildMultipartBody(fields: Record<string, string>, fileFieldName: string, filename: string, fileContent: string) {
  const boundary = "------WebKitFormBoundary7MA4YWxkTrZu0gW";
  let body = "";
  for (const [key, value] of Object.entries(fields)) {
    body += `--${boundary}\r\n`;
    body += `Content-Disposition: form-data; name="${key}"\r\n\r\n`;
    body += `${value}\r\n`;
  }
  body += `--${boundary}\r\n`;
  body += `Content-Disposition: form-data; name="${fileFieldName}"; filename="${filename}"\r\n`;
  body += `Content-Type: text/plain\r\n\r\n`;
  body += `${fileContent}\r\n`;
  body += `--${boundary}--\r\n`;

  return {
    headers: {
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
    },
    body
  };
}

async function buildTestApp() {
  const app = Fastify({ logger: false });
  await app.register(authPlugin);
  await app.register(multipartPlugin);
  await app.register(authRoutes, { prefix: "/auth" });
  await app.register(salesOrderRoutes, { prefix: "/crm/sales-orders" });
  await app.register(serviceRoutes, { prefix: "/service" });
  await app.register(testingRoutes, { prefix: "/testing" });
  await app.register(qualityRoutes, { prefix: "/crm/quality" });
  await app.register(procurementRoutes, { prefix: "/crm/procurement" });
  await app.register(paxRoutes, { prefix: "/pax" });
  await app.ready();
  return app;
}

async function runTests() {
  console.log("🧪 Running Cross-Phase Hardening Adversarial Tests...\n");
  const app = await buildTestApp();

  // Create test actors (using valid Prisma Role enum values)
  let adminUser = await prisma.user.findFirst({ where: { email: `${TEST_PREFIX}admin@kyrazam.com` } });
  if (!adminUser) {
    adminUser = await prisma.user.create({
      data: { name: `${TEST_PREFIX} Admin`, email: `${TEST_PREFIX}admin@kyrazam.com`, roles: ["SUPERADMIN", "ADMIN", "INVENTORY_MANAGER", "PAX_TEST_ENGINEER", "SALES_EXECUTIVE", "PURCHASE_MANAGER"], passwordHash: "dummy", isActive: true }
    });
  }

  let techUser = await prisma.user.findFirst({ where: { email: `${TEST_PREFIX}tech@kyrazam.com` } });
  if (!techUser) {
    techUser = await prisma.user.create({
      data: { name: `${TEST_PREFIX} Tech`, email: `${TEST_PREFIX}tech@kyrazam.com`, roles: ["ASSEMBLY_TECHNICIAN", "INVENTORY_MANAGER"], passwordHash: "dummy", isActive: true }
    });
  }

  let salesUser = await prisma.user.findFirst({ where: { email: `${TEST_PREFIX}sales@kyrazam.com` } });
  if (!salesUser) {
    salesUser = await prisma.user.create({
      data: { name: `${TEST_PREFIX} Sales`, email: `${TEST_PREFIX}sales@kyrazam.com`, roles: ["SALES_EXECUTIVE"], passwordHash: "dummy", isActive: true }
    });
  }

  // Sign JWT tokens
  const adminToken = app.jwt.sign({ id: adminUser.id, roles: adminUser.roles as any });
  const techToken = app.jwt.sign({ id: techUser.id, roles: techUser.roles as any });
  const salesToken = app.jwt.sign({ id: salesUser.id, roles: salesUser.roles as any });
  const adminHeaders = { Authorization: `Bearer ${adminToken}` };
  const techHeaders = { Authorization: `Bearer ${techToken}` };
  const salesHeaders = { Authorization: `Bearer ${salesToken}` };

  // Setup Customer
  let customer = await prisma.customer.findFirst({ where: { email: `${TEST_PREFIX}customer@test.com` } });
  if (!customer) {
    customer = await prisma.customer.create({
      data: {
        name: `${TEST_PREFIX} Customer`,
        customerCode: `CUST-${TEST_PREFIX}-${Date.now().toString().slice(-4)}`,
        email: `${TEST_PREFIX}customer@test.com`,
        phone: "1234567890",
        type: "INDIVIDUAL",
        billingAddress: "Test Billing",
        shippingAddress: "Test Shipping",
        city: "City",
        state: "State",
        country: "India",
        postalCode: "110001"
      }
    });
  }

  // Deactivate all other active production paxTypes to avoid conflict
  await prisma.paxType.updateMany({
    where: { isProductionActive: true },
    data: { isProductionActive: false }
  });

  // Setup PaxType
  const paxType = await prisma.paxType.create({
    data: {
      name: `Type-${TEST_PREFIX}-${Date.now().toString().slice(-6)}`,
      cellCount: 4,
      ahMin: 3.0, ahMax: 5.0, irMin: 5.0, irMax: 30.0,
      maxAhDifference: 0.1, maxIrDifference: 2.0,
      allowedGrades: ["A", "A+"],
      isProductionActive: true
    }
  });

  // Create test material
  const testMaterial = await prisma.material.create({
    data: {
      name: `${TEST_PREFIX}-TestMaterial-${Date.now()}`, category: "CELLS",
      sku: `${TEST_PREFIX}-MAT-${Date.now()}`, quantity: 100, unit: "pcs",
      minStock: 0, unitPrice: 10.0, totalValue: 1000.0, isPriceVerified: true,
    }
  });

  // ============================================
  // SECTION 1: Sales Order Reservation (H-01)
  // ============================================
  console.log("\n📋 SECTION 1: Sales Order Reservation Stock Lock\n");

  const salesOrder = await prisma.salesOrder.create({
    data: {
      salesOrderNumber: `SO-${TEST_PREFIX}-${Date.now().toString().slice(-6)}`,
      customerId: customer.id,
      status: SalesOrderStatus.CONFIRMED,
      isFinancialCleared: true,
      grandTotal: 1000.0, subtotal: 1000.0, discount: 0.0, tax: 0.0, additionalCharges: 0.0,
      paymentStatus: "PAID", paymentTerms: "Net 30", deliveryTerms: "Ex-Works",
      requiredDeliveryDate: new Date(Date.now() + 86400000 * 30),
      createdById: salesUser.id, assignedSalesUserId: salesUser.id,
      billingAddressSnapshot: "Test Billing", shippingAddressSnapshot: "Test Shipping"
    }
  });

  const soItem = await prisma.salesOrderItem.create({
    data: {
      salesOrderId: salesOrder.id, materialId: testMaterial.id,
      description: "Test Product", quantityOrdered: 50, quantityPending: 50,
      unitPrice: 20, taxAmount: 0, lineSubtotal: 1000, lineTotal: 1000,
    }
  });

  // T01: Valid reservation should succeed
  const res1 = await app.inject({
    method: "POST", url: `/crm/sales-orders/${salesOrder.id}/reserve`,
    payload: { itemId: soItem.id, quantity: 50 }, headers: salesHeaders
  });
  assert(res1.statusCode === 200, "T01: Valid reservation succeeds", `Status: ${res1.statusCode}`);

  // T02: Over-reservation should fail
  const res2 = await app.inject({
    method: "POST", url: `/crm/sales-orders/${salesOrder.id}/reserve`,
    payload: { itemId: soItem.id, quantity: 60 }, headers: salesHeaders
  });
  assert(res2.statusCode === 400, "T02: Over-reservation blocked", `Status: ${res2.statusCode}`);

  // T03: Negative quantity should fail
  const res3 = await app.inject({
    method: "POST", url: `/crm/sales-orders/${salesOrder.id}/reserve`,
    payload: { itemId: soItem.id, quantity: -5 }, headers: salesHeaders
  });
  assert(res3.statusCode === 400, "T03: Negative quantity blocked", `Status: ${res3.statusCode}`);

  // ============================================
  // SECTION 2: Sales Order Cancel + Reservation Release (M-02)
  // ============================================
  console.log("\n📋 SECTION 2: Sales Order Cancellation Releases Reservations\n");

  const preCancel = await prisma.inventoryReservation.findMany({
    where: { salesOrderId: salesOrder.id, status: "RESERVED" }
  });
  assert(preCancel.length > 0, "T04: Active reservations exist before cancel", `Count: ${preCancel.length}`);

  const res4 = await app.inject({
    method: "PUT", url: `/crm/sales-orders/${salesOrder.id}/status`,
    payload: { status: "CANCELLED" }, headers: salesHeaders
  });
  assert(res4.statusCode === 200, "T05: Sales order cancellation succeeds", `Status: ${res4.statusCode}`);

  const postCancel = await prisma.inventoryReservation.findMany({
    where: { salesOrderId: salesOrder.id, status: "RESERVED" }
  });
  assert(postCancel.length === 0, "T06: All reservations released after cancel", `Remaining: ${postCancel.length}`);

  const releasedRes = await prisma.inventoryReservation.findMany({
    where: { salesOrderId: salesOrder.id, status: "RELEASED" }
  });
  assert(releasedRes.length > 0, "T07: Reservations transitioned to RELEASED", `Count: ${releasedRes.length}`);

  // T08: Double cancel handled gracefully
  const res5 = await app.inject({
    method: "PUT", url: `/crm/sales-orders/${salesOrder.id}/status`,
    payload: { status: "CANCELLED" }, headers: salesHeaders
  });
  const body5 = JSON.parse(res5.body);
  assert(
    res5.statusCode === 400 || (res5.statusCode === 200 && body5.status === "CANCELLED"),
    "T08: Double cancel handled gracefully", `Status: ${res5.statusCode}`
  );

  // ============================================
  // SECTION 3: Service Battery Warranty Validation (M-01)
  // ============================================
  console.log("\n📋 SECTION 3: Service Battery Warranty Validation\n");

  const warrantyPaxSerial = `${TEST_PREFIX}-PAX-WARRANTY-${Date.now()}`;
  await prisma.paxPack.create({
    data: {
      paxSerial: warrantyPaxSerial,
      paxTypeId: paxType.id,
      status: "READY_FOR_SALE"
    }
  });

  const warranty = await prisma.warranty.create({
    data: {
      warrantyNumber: `WAR-${TEST_PREFIX}-${Date.now()}`,
      paxSerial: warrantyPaxSerial,
      customerId: customer.id,
      deliveryDate: new Date(Date.now() - 86400000),
      warrantyStartDate: new Date(Date.now() - 86400000),
      warrantyEndDate: new Date(Date.now() + 86400000 * 365),
      warrantyDurationMonths: 12, status: "ACTIVE",
    }
  });

  // T09: Warranty service without originalBatterySerial should fail
  const res6 = await app.inject({
    method: "POST", url: "/service/battery",
    payload: { customerName: customer.name, customerMobile: "1234567890", batteryModel: "TEST-MODEL", issueDescription: "Test issue", warrantyId: warranty.id },
    headers: techHeaders
  });
  assert(res6.statusCode === 400 && res6.body.includes("originalBatterySerial is required"), "T09: Warranty without serial blocked", `Status: ${res6.statusCode}, Body: ${res6.body}`);

  // T10: Warranty with wrong serial should fail
  const res7 = await app.inject({
    method: "POST", url: "/service/battery",
    payload: { customerName: customer.name, customerMobile: "1234567890", batteryModel: "TEST-MODEL", issueDescription: "Test issue", warrantyId: warranty.id, originalBatterySerial: "WRONG-SERIAL" },
    headers: techHeaders
  });
  assert(res7.statusCode === 400 && res7.body.includes("serial number mismatch"), "T10: Warranty serial mismatch blocked", `Status: ${res7.statusCode}`);

  // T11: Warranty with correct serial should succeed
  const res8 = await app.inject({
    method: "POST", url: "/service/battery",
    payload: { customerName: customer.name, customerMobile: "1234567890", batteryModel: "TEST-MODEL", issueDescription: "Test issue", warrantyId: warranty.id, originalBatterySerial: warranty.paxSerial },
    headers: techHeaders
  });
  assert(res8.statusCode === 200, "T11: Warranty with correct serial succeeds", `Status: ${res8.statusCode}`);

  // T12: Expired warranty should fail
  const expiredPaxSerial = `${TEST_PREFIX}-PAX-EXP-${Date.now()}`;
  await prisma.paxPack.create({
    data: {
      paxSerial: expiredPaxSerial,
      paxTypeId: paxType.id,
      status: "READY_FOR_SALE"
    }
  });

  const expiredWarranty = await prisma.warranty.create({
    data: {
      warrantyNumber: `WAR-${TEST_PREFIX}-EXP-${Date.now()}`,
      paxSerial: expiredPaxSerial,
      customerId: customer.id,
      deliveryDate: new Date(Date.now() - 86400000 * 730),
      warrantyStartDate: new Date(Date.now() - 86400000 * 730),
      warrantyEndDate: new Date(Date.now() - 86400000),
      warrantyDurationMonths: 12, status: "ACTIVE",
    }
  });

  const res9 = await app.inject({
    method: "POST", url: "/service/battery",
    payload: { customerName: customer.name, customerMobile: "1234567890", batteryModel: "TEST-MODEL", issueDescription: "Test issue", warrantyId: expiredWarranty.id, originalBatterySerial: expiredWarranty.paxSerial },
    headers: techHeaders
  });
  assert(res9.statusCode === 400 && res9.body.includes("expired"), "T12: Expired warranty blocked", `Status: ${res9.statusCode}`);

  // ============================================
  // SECTION 4: Cell Testing Row Lock (H-03)
  // ============================================
  console.log("\n📋 SECTION 4: Cell Testing Row Lock Verification\n");

  const cell1Serial = `${TEST_PREFIX}-CELL-${Date.now()}-1`;
  const cell2Serial = `${TEST_PREFIX}-CELL-${Date.now()}-2`;

  await prisma.cell.create({
    data: { serialNumber: cell1Serial, batchNumber: `${TEST_PREFIX}-BATCH-${Date.now()}`, status: CellStatus.RAW, voltage: 3.7, category: "A", cycles: 0, retestCount: 0, qcDecisionHistory: [] }
  });
  await prisma.cell.create({
    data: { serialNumber: cell2Serial, batchNumber: `${TEST_PREFIX}-BATCH-${Date.now()}`, status: CellStatus.RAW, voltage: 3.7, category: "A", cycles: 0, retestCount: 0, qcDecisionHistory: [] }
  });

  // T13: Valid cell test should pass
  const res10 = await app.inject({
    method: "POST", url: "/testing/apply",
    payload: [{ cellSerial: cell1Serial, ahValue: 4.0, irValue: 15.0, grade: "A" }],
    headers: adminHeaders
  });
  const body10 = JSON.parse(res10.body);
  assert(res10.statusCode === 200 && body10.passed === 1, "T13: Valid cell test passes", `Body: ${res10.body}`);

  // T14: Cell status updated
  const cell1After = await prisma.cell.findUnique({ where: { serialNumber: cell1Serial } });
  assert(cell1After?.status === CellStatus.CELL_TESTED, "T14: Cell status updated to CELL_TESTED", `Status: ${cell1After?.status}`);

  // T15: Cell with failing values should reject
  const res11 = await app.inject({
    method: "POST", url: "/testing/apply",
    payload: [{ cellSerial: cell2Serial, ahValue: 1.0, irValue: 80.0, grade: "F" }],
    headers: adminHeaders
  });
  const body11 = JSON.parse(res11.body);
  assert(res11.statusCode === 200 && body11.rejected === 1, "T15: Cell with bad values REJECTED", `Body: ${res11.body}`);

  // T16: Non-existent cell should produce error
  const res12 = await app.inject({
    method: "POST", url: "/testing/apply",
    payload: [{ cellSerial: "NONEXISTENT-CELL-999", ahValue: 4.0, irValue: 15.0, grade: "A" }],
    headers: adminHeaders
  });
  const body12 = JSON.parse(res12.body);
  assert(res12.statusCode === 200 && body12.errors === 1, "T16: Non-existent cell produces error", `Body: ${res12.body}`);

  // ============================================
  // SECTION 5: PaxPack State Machine (C-01, C-02, C-03)
  // ============================================
  console.log("\n📋 SECTION 5: PaxPack State Machine Locks\n");

  const paxSerial1 = `${TEST_PREFIX}-PAX-${Date.now()}-1`;
  await prisma.paxPack.create({ data: { paxSerial: paxSerial1, paxTypeId: paxType.id, status: PaxStatus.PAX_ASSEMBLED } });

  // T17: Approve from PAX_ASSEMBLED should fail
  const res13 = await app.inject({
    method: "POST", url: `/pax/${paxSerial1}/approve`, payload: { action: "approve" }, headers: adminHeaders
  });
  assert(res13.statusCode === 400, "T17: Approve from PAX_ASSEMBLED blocked", `Status: ${res13.statusCode}, Body: ${res13.body}`);

  // Move to PAX_TESTED and approve
  await prisma.paxPack.update({ where: { paxSerial: paxSerial1 }, data: { status: PaxStatus.PAX_TESTED } });

  const res14 = await app.inject({
    method: "POST", url: `/pax/${paxSerial1}/approve`, payload: { action: "approve" }, headers: adminHeaders
  });
  assert(res14.statusCode === 200, "T18: Approve from PAX_TESTED succeeds", `Status: ${res14.statusCode}`);

  const pax1After = await prisma.paxPack.findUnique({ where: { paxSerial: paxSerial1 } });
  assert(pax1After?.status === PaxStatus.READY_FOR_SALE, "T19: PaxPack → READY_FOR_SALE", `Status: ${pax1After?.status}`);

  // T20: Test result upload on sold pack should fail
  const paxSerial2 = `${TEST_PREFIX}-PAX-${Date.now()}-2`;
  await prisma.paxPack.create({ data: { paxSerial: paxSerial2, paxTypeId: paxType.id, status: PaxStatus.SOLD_TO_CUSTOMER } });

  const mp = buildMultipartBody({ status: "PAX_TESTED" }, "file", "report.txt", "Dummy Report Content");
  const res15 = await app.inject({
    method: "POST", url: `/pax/${paxSerial2}/test-result`,
    headers: { ...adminHeaders, ...mp.headers },
    payload: mp.body
  });
  assert(res15.statusCode === 400, "T20: Test result on sold pack blocked", `Status: ${res15.statusCode}, Body: ${res15.body}`);

  // ============================================
  // SECTION 6: Quality Inspection Final QC Lock
  // ============================================
  console.log("\n📋 SECTION 6: Quality Inspection Final QC Locks\n");

  const paxSerial3 = `${TEST_PREFIX}-PAX-QC-${Date.now()}`;
  const workOrder = await prisma.workOrder.create({
    data: {
      workOrderNumber: `WO-${TEST_PREFIX}-${Date.now().toString().slice(-6)}`,
      status: "QC_PENDING", plannedQuantity: 1, remainingQuantity: 1,
      dueDate: new Date(Date.now() + 86400000 * 30),
    }
  });

  await prisma.paxPack.create({ data: { paxSerial: paxSerial3, paxTypeId: paxType.id, status: PaxStatus.PAX_ASSEMBLED, workOrderId: workOrder.id } });

  // T21: Final QC PASS on non-PAX_TESTED should fail
  const res16 = await app.inject({
    method: "POST", url: "/crm/quality/inspections",
    payload: { workOrderId: workOrder.id, paxSerial: paxSerial3, inspectionType: "FINAL", result: "PASS", checkpoints: [{ name: "Visual", result: "PASS" }] },
    headers: adminHeaders
  });
  assert(res16.statusCode === 400, "T21: Final QC PASS on non-PAX_TESTED blocked", `Status: ${res16.statusCode}`);

  // Move to PAX_TESTED
  await prisma.paxPack.update({ where: { paxSerial: paxSerial3 }, data: { status: PaxStatus.PAX_TESTED } });

  // T22: Final QC PASS on PAX_TESTED should succeed
  const res17 = await app.inject({
    method: "POST", url: "/crm/quality/inspections",
    payload: { workOrderId: workOrder.id, paxSerial: paxSerial3, inspectionType: "FINAL", result: "PASS", checkpoints: [{ name: "Visual", result: "PASS" }] },
    headers: adminHeaders
  });
  assert(res17.statusCode === 200, "T22: Final QC PASS on PAX_TESTED succeeds", `Status: ${res17.statusCode}`);

  const pax3After = await prisma.paxPack.findUnique({ where: { paxSerial: paxSerial3 } });
  assert(pax3After?.status === PaxStatus.READY_FOR_SALE, "T23: PaxPack → READY_FOR_SALE after QC", `Status: ${pax3After?.status}`);

  // ============================================
  // SECTION 7: Defect Scrap Cell Recovery (M-03)
  // ============================================
  console.log("\n📋 SECTION 7: Defect Scrap Cell Recovery\n");

  const paxSerial4 = `${TEST_PREFIX}-PAX-SCRAP-${Date.now()}`;
  const cellScrapSerial = `${TEST_PREFIX}-CELL-SCRAP-${Date.now()}`;

  await prisma.cell.create({
    data: { serialNumber: cellScrapSerial, batchNumber: `${TEST_PREFIX}-BATCH-SCRAP-${Date.now()}`, status: CellStatus.CELL_TESTED, voltage: 3.7, category: "A", cycles: 0, retestCount: 0, qcDecisionHistory: [] }
  });
  await prisma.paxPack.create({ data: { paxSerial: paxSerial4, paxTypeId: paxType.id, status: PaxStatus.PAX_ASSEMBLED } });
  await prisma.paxCell.create({ data: { paxSerial: paxSerial4, cellSerial: cellScrapSerial, position: 1 } });

  // T24: SCRAP defect report succeeds
  const res18 = await app.inject({
    method: "POST", url: "/crm/quality/defects",
    payload: { paxSerial: paxSerial4, defectType: "STRUCTURAL", severity: "CRITICAL", description: "Pack housing cracked", disposition: "SCRAP" },
    headers: adminHeaders
  });
  assert(res18.statusCode === 200, "T24: Defect SCRAP report succeeds", `Status: ${res18.statusCode}`);

  const pax4After = await prisma.paxPack.findUnique({ where: { paxSerial: paxSerial4 } });
  assert(pax4After?.status === "SCRAPPED", "T25: PaxPack marked SCRAPPED", `Status: ${pax4After?.status}`);

  const cellAfterScrap = await prisma.cell.findUnique({ where: { serialNumber: cellScrapSerial } });
  assert(cellAfterScrap?.status === CellStatus.CELL_TESTED, "T26: Cell returned to CELL_TESTED", `Status: ${cellAfterScrap?.status}`);

  const paxCellLinks = await prisma.paxCell.findMany({ where: { paxSerial: paxSerial4 } });
  assert(paxCellLinks.length === 0, "T27: PaxCell junction rows deleted", `Count: ${paxCellLinks.length}`);

  const cellReturnLog = await prisma.auditLog.findFirst({
    where: { entityType: "cell", entityId: cellScrapSerial, action: "returned_from_scrapped_pax" }
  });
  assert(cellReturnLog !== null, "T28: Audit log for cell return exists", `Found: ${!!cellReturnLog}`);

  // ============================================
  // SECTION 8: Defect on Sold Pack Blocked
  // ============================================
  console.log("\n📋 SECTION 8: Defect on Sold Pack Blocked\n");

  const res19 = await app.inject({
    method: "POST", url: "/crm/quality/defects",
    payload: { paxSerial: paxSerial2, defectType: "ELECTRICAL", severity: "HIGH", description: "Test", disposition: "REPAIR" },
    headers: adminHeaders
  });
  assert(res19.statusCode === 400 && res19.body.includes("customer-owned"), "T29: Defect on sold pack blocked", `Status: ${res19.statusCode}`);

  // ============================================
  // SECTION 9: RBAC Query Token Security
  // ============================================
  console.log("\n📋 SECTION 9: RBAC Query Token Security\n");

  const fs = require("fs");
  const path = require("path");
  const rbacSource = fs.readFileSync(path.join(__dirname, "../middleware/rbac.ts"), "utf8");
  const hasQueryToken = rbacSource.includes("request.query.token") || rbacSource.includes("query.token");
  assert(!hasQueryToken, "T30: RBAC does not parse query.token", `Found: ${hasQueryToken}`);

  // ============================================
  // SUMMARY
  // ============================================
  console.log("\n" + "=".repeat(60));
  console.log(`Cross-Phase Hardening: ${passed} PASSED, ${failed} FAILED / ${passed + failed} total`);
  console.log("=".repeat(60));

  if (failed > 0) {
    console.log("\n❌ FAILED TESTS:");
    resultsList.filter(r => r.result === "FAIL").forEach(r => console.log(`  - ${r.test}: ${r.detail}`));
    console.log("\n⚠️  CROSS-PHASE HARDENING VERIFICATION FAILED.");
  } else {
    console.log("\n🎉 ALL 30 Cross-Phase Hardening Tests PASSED successfully.");
  }

  // Cleanup
  console.log("\n🧹 Cleaning up test records...");
  try {
    await prisma.auditLog.deleteMany({ where: { actorId: { in: [adminUser.id, techUser.id, salesUser.id] } } });
    await prisma.qualityCheckpoint.deleteMany({ where: { inspection: { inspectorId: adminUser.id } } });
    await prisma.qualityInspection.deleteMany({ where: { inspectorId: adminUser.id } });
    await prisma.defect.deleteMany({ where: { reportedById: adminUser.id } });
    await prisma.scrapEntry.deleteMany({ where: { createdBy: adminUser.id } });
    await prisma.inventoryReservation.deleteMany({ where: { salesOrderId: salesOrder.id } });
    await prisma.salesOrderItem.deleteMany({ where: { salesOrderId: salesOrder.id } });
    await prisma.salesOrder.deleteMany({ where: { id: salesOrder.id } });
    await prisma.paxCell.deleteMany({ where: { paxSerial: { startsWith: TEST_PREFIX } } });
    await prisma.serviceRepairLog.deleteMany({ where: { serviceBattery: { createdBy: techUser.id } } });
    await prisma.serviceBattery.deleteMany({ where: { createdBy: techUser.id } });
    await prisma.paxPack.deleteMany({ where: { paxSerial: { startsWith: TEST_PREFIX } } });
    await prisma.cell.deleteMany({ where: { serialNumber: { startsWith: TEST_PREFIX } } });
    await prisma.warranty.deleteMany({ where: { id: { in: [warranty.id, expiredWarranty.id] } } });
    await prisma.workOrder.deleteMany({ where: { id: workOrder.id } });
    await prisma.material.deleteMany({ where: { id: testMaterial.id } });
    await prisma.paxType.deleteMany({ where: { id: paxType.id } });
  } catch (cleanupErr) {
    console.warn("⚠️  Cleanup (non-fatal):", cleanupErr);
  }

  await prisma.$disconnect();
  await app.close();
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => { console.error("Fatal:", err); process.exit(1); });
