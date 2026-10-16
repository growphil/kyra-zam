import Fastify from "fastify";
import { authPlugin } from "../plugins/auth";
import { authRoutes } from "../routes/auth";
import { crmRoutes } from "../routes/crm";
import { productionRoutes } from "../routes/production";
import { PrismaClient, WorkOrderStatus } from "../generated/client";

const prisma = new PrismaClient();

const TEST_PREFIX = "TSS"; // Test Scheduling Search
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

async function buildTestApp() {
  const app = Fastify({ logger: false });
  await app.register(authPlugin);
  await app.register(authRoutes, { prefix: "/auth" });
  await app.register(crmRoutes, { prefix: "/crm" });
  await app.register(productionRoutes, { prefix: "/crm/production" });
  await app.ready();
  return app;
}

async function runTests() {
  console.log("🧪 Running KYRA ZAM 3.0 Phase 3.0-A Scheduling & Search Tests...\n");
  const app = await buildTestApp();

  // Create test actors
  let supervisorUser = await prisma.user.findFirst({ where: { email: `${TEST_PREFIX}supervisor@kyrazam.com` } });
  if (!supervisorUser) {
    supervisorUser = await prisma.user.create({
      data: { name: `${TEST_PREFIX} Supervisor`, email: `${TEST_PREFIX}supervisor@kyrazam.com`, roles: ["SUPERVISOR"], passwordHash: "dummy", isActive: true }
    });
  }

  let techUser = await prisma.user.findFirst({ where: { email: `${TEST_PREFIX}tech@kyrazam.com` } });
  if (!techUser) {
    techUser = await prisma.user.create({
      data: { name: `${TEST_PREFIX} Tech`, email: `${TEST_PREFIX}tech@kyrazam.com`, roles: ["ASSEMBLY_TECHNICIAN"], passwordHash: "dummy", isActive: true }
    });
  }

  const supervisorToken = app.jwt.sign({ id: supervisorUser.id, roles: supervisorUser.roles as any });
  const techToken = app.jwt.sign({ id: techUser.id, roles: techUser.roles as any });
  const supervisorHeaders = { Authorization: `Bearer ${supervisorToken}` };
  const techHeaders = { Authorization: `Bearer ${techToken}` };

  // Setup test WorkOrders
  const wo1 = await prisma.workOrder.create({
    data: {
      workOrderNumber: `WO-${TEST_PREFIX}-${Date.now().toString().slice(-4)}-1`,
      plannedQuantity: 10, remainingQuantity: 10,
      dueDate: new Date(), status: "CREATED"
    }
  });

  const wo2 = await prisma.workOrder.create({
    data: {
      workOrderNumber: `WO-${TEST_PREFIX}-${Date.now().toString().slice(-4)}-2`,
      plannedQuantity: 10, remainingQuantity: 10,
      dueDate: new Date(), status: "READY"
    }
  });

  const completedWo = await prisma.workOrder.create({
    data: {
      workOrderNumber: `WO-${TEST_PREFIX}-${Date.now().toString().slice(-4)}-3`,
      plannedQuantity: 10, remainingQuantity: 10,
      dueDate: new Date(), status: "COMPLETED"
    }
  });

  // ============================================
  // SECTION 1: Scheduling Business Rules & APIs
  // ============================================
  console.log("\n📅 SECTION 1: Work Order Scheduling & Sequence Shift\n");

  const testDate = "2026-08-30";

  // 1. Create schedule successfully
  const res1 = await app.inject({
    method: "POST", url: "/crm/production/schedule",
    payload: { workOrderId: wo1.id, assignedDate: testDate, sequence: 1, estimatedHrs: 2.5 },
    headers: supervisorHeaders
  });
  assert(res1.statusCode === 200, "1. Create schedule successfully", `Status: ${res1.statusCode}`);

  // 2. Schedule nonexistent WorkOrder rejected
  const res2 = await app.inject({
    method: "POST", url: "/crm/production/schedule",
    payload: { workOrderId: "00000000-0000-0000-0000-000000000000", assignedDate: testDate, sequence: 2, estimatedHrs: 1.5 },
    headers: supervisorHeaders
  });
  assert(res2.statusCode === 404, "2. Schedule nonexistent WorkOrder rejected", `Status: ${res2.statusCode}`);

  // 3. Duplicate schedule is updated instead of creating a second row (idempotency/upsert)
  const res3 = await app.inject({
    method: "POST", url: "/crm/production/schedule",
    payload: { workOrderId: wo1.id, assignedDate: testDate, sequence: 1, estimatedHrs: 3.0 },
    headers: supervisorHeaders
  });
  assert(res3.statusCode === 200, "3. Duplicate schedule updates existing schedule", `Status: ${res3.statusCode}`);
  const sched1 = await prisma.workOrderScheduling.findUnique({ where: { workOrderId: wo1.id } });
  assert(sched1?.estimatedHrs === 3.0, "   Schedule updated successfully", `Hrs: ${sched1?.estimatedHrs}`);

  // 4. Sequence shifting works successfully on conflict
  // We schedule wo2 on sequence 1, which should push wo1 to sequence 2
  const res4 = await app.inject({
    method: "POST", url: "/crm/production/schedule",
    payload: { workOrderId: wo2.id, assignedDate: testDate, sequence: 1, estimatedHrs: 4.0 },
    headers: supervisorHeaders
  });
  assert(res4.statusCode === 200, "4. Sequence conflict causes auto-shift of sequence", `Status: ${res4.statusCode}`);

  const schedWo2 = await prisma.workOrderScheduling.findUnique({ where: { workOrderId: wo2.id } });
  const schedWo1 = await prisma.workOrderScheduling.findUnique({ where: { workOrderId: wo1.id } });
  assert(schedWo2?.sequence === 1, "   WO2 sequence is 1", `Seq: ${schedWo2?.sequence}`);
  assert(schedWo1?.sequence === 2, "   WO1 sequence auto-shifted to 2", `Seq: ${schedWo1?.sequence}`);

  // 5. Completed WorkOrder scheduling is blocked
  const res5 = await app.inject({
    method: "POST", url: "/crm/production/schedule",
    payload: { workOrderId: completedWo.id, assignedDate: testDate, sequence: 3, estimatedHrs: 2.0 },
    headers: supervisorHeaders
  });
  assert(res5.statusCode === 400 && res5.body.includes("terminal status"), "5. Completed WorkOrder scheduling rejected", `Status: ${res5.statusCode}, Body: ${res5.body}`);

  // 6. Unauthorized role is rejected
  const res6 = await app.inject({
    method: "POST", url: "/crm/production/schedule",
    payload: { workOrderId: wo1.id, assignedDate: testDate, sequence: 3, estimatedHrs: 2.0 },
    headers: techHeaders
  });
  assert(res6.statusCode === 403, "6. Technician scheduling rejected (RBAC)", `Status: ${res6.statusCode}`);

  // 7. Audit log is created
  const auditLogs = await prisma.auditLog.findMany({
    where: { entityType: "work-order-scheduling" }
  });
  assert(auditLogs.length > 0, "7. Audit log for schedule created", `Count: ${auditLogs.length}`);

  // 8. Rescheduling different date shifts and cleans up sequences
  // Let's reschedule wo2 to different date
  const newDate = "2026-08-31";
  const res7 = await app.inject({
    method: "POST", url: "/crm/production/schedule",
    payload: { workOrderId: wo2.id, assignedDate: newDate, sequence: 1, estimatedHrs: 4.0 },
    headers: supervisorHeaders
  });
  assert(res7.statusCode === 200, "8. Different date rescheduling succeeds", `Status: ${res7.statusCode}, Body: ${res7.body}`);

  // WO1 on old date should fill the gap and shift back to 1
  const schedWo1After = await prisma.workOrderScheduling.findUnique({ where: { workOrderId: wo1.id } });
  assert(schedWo1After?.sequence === 1, "   Old date sequences auto-shifted to close gap (WO1 back to 1)", `Seq: ${schedWo1After?.sequence}`);

  // 9. Remove schedule API
  const res8 = await app.inject({
    method: "DELETE", url: `/crm/production/schedule/${wo2.id}`,
    headers: supervisorHeaders
  });
  assert(res8.statusCode === 200, "9. Remove schedule API succeeds", `Status: ${res8.statusCode}`);
  const schedWo2Removed = await prisma.workOrderScheduling.findUnique({ where: { workOrderId: wo2.id } });
  assert(schedWo2Removed === null, "   Schedule removed from database", `Found: ${!!schedWo2Removed}`);


  // ============================================
  // SECTION 2: Global Search API
  // ============================================
  console.log("\n🔍 SECTION 2: Global Search API Verification\n");

  // Create test cell, customer, and salesOrder for lookup
  const cellSerial = `${TEST_PREFIX}-CELL-${Date.now()}`;
  await prisma.cell.create({
    data: { serialNumber: cellSerial, batchNumber: "B1", status: "RAW", category: "A", cycles: 0, voltage: 3.7 }
  });

  const soNum = `SO-SCH-${Date.now().toString().slice(-4)}`;
  const customer = await prisma.customer.create({
    data: {
      name: `${TEST_PREFIX}-Customer`, customerCode: `C-${TEST_PREFIX}-${Date.now().toString().slice(-4)}`,
      email: `${TEST_PREFIX}-cust@test.com`, phone: "12345678", type: "INDIVIDUAL",
      billingAddress: "Test Address", shippingAddress: "Test Address",
      city: "Test City", state: "Test State", country: "Test Country", postalCode: "123456"
    }
  });
  const salesOrder = await prisma.salesOrder.create({
    data: {
      salesOrderNumber: soNum,
      customer: { connect: { id: customer.id } },
      createdBy: { connect: { id: supervisorUser.id } },
      status: "DRAFT",
      grandTotal: 100, subtotal: 100, discount: 0, tax: 0, additionalCharges: 0,
      paymentTerms: "COD", deliveryTerms: "EXW", requiredDeliveryDate: new Date(),
      billingAddressSnapshot: "Test", shippingAddressSnapshot: "Test"
    }
  });

  // T10: Search cell by serial
  const search1 = await app.inject({
    method: "GET", url: `/crm/search?q=${cellSerial}`,
    headers: supervisorHeaders
  });
  const body1 = JSON.parse(search1.body);
  assert(search1.statusCode === 200 && body1.cells.length > 0, "10. Global search finds cell by serialNumber", `Count: ${body1.cells.length}`);

  // T11: Search sales order by number
  const search2 = await app.inject({
    method: "GET", url: `/crm/search?q=${soNum.slice(0, 7)}`,
    headers: supervisorHeaders
  });
  const body2 = JSON.parse(search2.body);
  assert(search2.statusCode === 200 && body2.salesOrders.length > 0, "11. Global search finds salesOrder by prefix", `Count: ${body2.salesOrders.length}`);

  // T12: Search query less than 3 chars should fail
  const search3 = await app.inject({
    method: "GET", url: "/crm/search?q=12",
    headers: supervisorHeaders
  });
  assert(search3.statusCode === 400, "12. Search query with <3 characters rejected", `Status: ${search3.statusCode}`);

  // ============================================
  // SUMMARY
  // ============================================
  console.log("\n" + "=".repeat(60));
  console.log(`Scheduling & Search: ${passed} PASSED, ${failed} FAILED / ${passed + failed} total`);
  console.log("=".repeat(60));

  // Cleanup
  console.log("\n🧹 Cleaning up test records...");
  try {
    await prisma.workOrderScheduling.deleteMany({ where: { workOrder: { workOrderNumber: { startsWith: `WO-${TEST_PREFIX}` } } } });
    await prisma.workOrder.deleteMany({ where: { workOrderNumber: { startsWith: `WO-${TEST_PREFIX}` } } });
    await prisma.cell.deleteMany({ where: { serialNumber: { startsWith: TEST_PREFIX } } });
    await prisma.salesOrder.deleteMany({ where: { salesOrderNumber: { startsWith: "SO-SCH" } } });
    await prisma.customer.deleteMany({ where: { name: { startsWith: TEST_PREFIX } } });
    await prisma.auditLog.deleteMany({ where: { actorId: supervisorUser.id } });
  } catch (cleanupErr) {
    console.warn("⚠️ Cleanup (non-fatal):", cleanupErr);
  }

  await prisma.$disconnect();
  await app.close();
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => { console.error("Fatal:", err); process.exit(1); });
