import Fastify from "fastify";
import { authPlugin } from "../plugins/auth";
import { authRoutes } from "../routes/auth";
import { productionRoutes } from "../routes/production";
import { stationRoutes } from "../routes/stations";
import { PrismaClient } from "../generated/client";

const prisma = new PrismaClient();
const TEST_PREFIX = "TPE"; // Test Production Execution
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
  await app.register(productionRoutes, { prefix: "/crm/production" });
  await app.register(stationRoutes, { prefix: "/crm/stations" });
  await app.ready();
  return app;
}

async function runTests() {
  console.log("🧪 Running KYRA ZAM 3.0 Phase 3.0-B Production Execution Tests...\n");
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

  let qaUser = await prisma.user.findFirst({ where: { email: `${TEST_PREFIX}qa@kyrazam.com` } });
  if (!qaUser) {
    qaUser = await prisma.user.create({
      data: { name: `${TEST_PREFIX} QA`, email: `${TEST_PREFIX}qa@kyrazam.com`, roles: ["PAX_TEST_ENGINEER"], passwordHash: "dummy", isActive: true }
    });
  }

  const supervisorToken = app.jwt.sign({ id: supervisorUser.id, roles: supervisorUser.roles as any });
  const techToken = app.jwt.sign({ id: techUser.id, roles: techUser.roles as any });
  const qaToken = app.jwt.sign({ id: qaUser.id, roles: qaUser.roles as any });

  const supervisorHeaders = { Authorization: `Bearer ${supervisorToken}` };
  const techHeaders = { Authorization: `Bearer ${techToken}` };
  const qaHeaders = { Authorization: `Bearer ${qaToken}` };

  // Setup test WorkOrders
  const woReady = await prisma.workOrder.create({
    data: {
      workOrderNumber: `WO-${TEST_PREFIX}-${Date.now().toString().slice(-4)}-1`,
      plannedQuantity: 10, remainingQuantity: 10,
      dueDate: new Date(), status: "READY"
    }
  });

  const woNotReady = await prisma.workOrder.create({
    data: {
      workOrderNumber: `WO-${TEST_PREFIX}-${Date.now().toString().slice(-4)}-2`,
      plannedQuantity: 10, remainingQuantity: 10,
      dueDate: new Date(), status: "CREATED"
    }
  });

  // Schedule woReady
  const testDate = new Date().toISOString().split("T")[0];
  const targetDate = new Date(testDate + "T00:00:00.000Z");
  const maxSeqRecord = await prisma.workOrderScheduling.findFirst({
    where: { assignedDate: targetDate },
    orderBy: { sequence: "desc" }
  });
  const seq1 = (maxSeqRecord?.sequence || 0) + 1;

  const sched = await prisma.workOrderScheduling.create({
    data: { workOrderId: woReady.id, assignedDate: targetDate, sequence: seq1, estimatedHrs: 3.5 }
  });

  // Schedule woNotReady for today so it passes the scheduling safeguard check
  const seqNotReady = seq1 + 1;
  await prisma.workOrderScheduling.create({
    data: { workOrderId: woNotReady.id, assignedDate: targetDate, sequence: seqNotReady, estimatedHrs: 2.0 }
  });

  // Create active station for test start check-ins
  let station = await prisma.productionStation.findFirst({
    where: { code: `${TEST_PREFIX}-STATION` }
  });
  if (!station) {
    station = await prisma.productionStation.create({
      data: {
        name: `${TEST_PREFIX} Test Station`,
        code: `${TEST_PREFIX}-STATION`,
        type: "ASSEMBLY",
        isActive: true
      }
    });
  }

  // 1. Dashboard grouping
  const res1 = await app.inject({
    method: "GET", url: `/crm/production/execution/dashboard?date=${testDate}`,
    headers: supervisorHeaders
  });
  const body1 = JSON.parse(res1.body);
  assert(res1.statusCode === 200 && body1.ready.length >= 1, "1. Dashboard grouping returns scheduled WorkOrders in READY list", `Ready length: ${body1.ready.length}`);

  // 2. WorkOrder detail loads correctly
  const res2 = await app.inject({
    method: "GET", url: `/crm/production/work-orders/${woReady.id}`,
    headers: supervisorHeaders
  });
  assert(res2.statusCode === 200, "2. WorkOrder detail loads correctly", `Status: ${res2.statusCode}`);

  // 3. START rejected when prerequisites are not satisfied (materials not allocated / status not READY)
  const res3 = await app.inject({
    method: "POST", url: `/crm/production/work-orders/${woNotReady.id}/start`,
    payload: { stationId: station.id },
    headers: supervisorHeaders
  });
  assert(res3.statusCode === 400 && res3.body.includes("materials must be allocated first"), "3. START rejected if materials not allocated", `Status: ${res3.statusCode}, Body: ${res3.body}`);

  // 4. Successful START
  const res4 = await app.inject({
    method: "POST", url: `/crm/production/work-orders/${woReady.id}/start`,
    payload: { stationId: station.id },
    headers: supervisorHeaders
  });
  assert(res4.statusCode === 200, "4. Successful START transitions status to IN_PROGRESS", `Status: ${res4.statusCode}`);

  // 5. START creates execution record
  const execRecord = await prisma.workOrderExecution.findUnique({ where: { workOrderId: woReady.id } });
  assert(execRecord !== null && execRecord.startedAt !== null, "5. START creates execution record with startedAt timestamp", `Record: ${!!execRecord}`);

  // 6. Duplicate START rejected
  const res5 = await app.inject({
    method: "POST", url: `/crm/production/work-orders/${woReady.id}/start`,
    payload: { stationId: station.id },
    headers: supervisorHeaders
  });
  assert(res5.statusCode === 400 && res5.body.includes("already in progress"), "6. Duplicate START rejected", `Status: ${res5.statusCode}, Body: ${res5.body}`);

  // 7. Audit log created for START with correct dynamic previous status
  const auditStart = await prisma.auditLog.findFirst({
    where: { entityType: "work-order", action: "PRODUCTION_STARTED", entityId: woReady.id }
  });
  assert(auditStart !== null && auditStart.prevStatus === "READY" && auditStart.newStatus === "IN_PROGRESS", "7. Audit log for START created with dynamic previous status", `PrevStatus: ${auditStart?.prevStatus}`);

  // 8. PAUSE requires reason
  const res6 = await app.inject({
    method: "POST", url: `/crm/production/work-orders/${woReady.id}/pause`,
    payload: {},
    headers: supervisorHeaders
  });
  assert(res6.statusCode === 400 && res6.body.includes("reason is required"), "8. PAUSE requires a reason", `Status: ${res6.statusCode}`);

  // 9. Successful PAUSE
  const res7 = await app.inject({
    method: "POST", url: `/crm/production/work-orders/${woReady.id}/pause`,
    payload: { reason: "Need calibration" },
    headers: supervisorHeaders
  });
  assert(res7.statusCode === 200, "9. Successful PAUSE transitions status to ON_HOLD", `Status: ${res7.statusCode}`);

  const execPause = await prisma.workOrderExecution.findUnique({ where: { workOrderId: woReady.id } });
  assert(execPause?.pausedAt !== null && execPause?.pauseReason === "Need calibration", "   PAUSE records pausedAt and pauseReason", `Reason: ${execPause?.pauseReason}`);

  // 10. Audit log created for PAUSE
  const auditPause = await prisma.auditLog.findFirst({
    where: { entityType: "work-order", action: "PRODUCTION_PAUSED", entityId: woReady.id }
  });
  assert(auditPause !== null && auditPause.prevStatus === "IN_PROGRESS" && auditPause.newStatus === "ON_HOLD", "10. Audit log for PAUSE created", `NewStatus: ${auditPause?.newStatus}`);

  // 11. Resume from invalid status (e.g. not ON_HOLD) is rejected
  const res8 = await app.inject({
    method: "POST", url: `/crm/production/work-orders/${woNotReady.id}/resume`,
    headers: supervisorHeaders
  });
  assert(res8.statusCode === 400 && res8.body.includes("Only a PAUSED"), "11. Resume from invalid status is rejected", `Status: ${res8.statusCode}`);

  // 12. Successful RESUME
  const res9 = await app.inject({
    method: "POST", url: `/crm/production/work-orders/${woReady.id}/resume`,
    headers: supervisorHeaders
  });
  assert(res9.statusCode === 200, "12. Successful RESUME transitions status back to IN_PROGRESS", `Status: ${res9.statusCode}`);

  const execResume = await prisma.workOrderExecution.findUnique({ where: { workOrderId: woReady.id } });
  assert(execResume?.resumedAt !== null && execResume?.pausedAt === null && execResume?.pauseReason === null, "   RESUME resets pause reason & pausedAt", `PausedAt: ${execResume?.pausedAt}`);

  // 13. Audit log created for RESUME
  const auditResume = await prisma.auditLog.findFirst({
    where: { entityType: "work-order", action: "PRODUCTION_RESUMED", entityId: woReady.id }
  });
  assert(auditResume !== null && auditResume.prevStatus === "ON_HOLD" && auditResume.newStatus === "IN_PROGRESS", "13. Audit log for RESUME created", `NewStatus: ${auditResume?.newStatus}`);

  // 14. COMPLETE transitions status to QC_PENDING
  const res10 = await app.inject({
    method: "POST", url: `/crm/production/work-orders/${woReady.id}/complete`,
    payload: { notes: "Assembly finished successfully" },
    headers: supervisorHeaders
  });
  assert(res10.statusCode === 200, "14. COMPLETE transitions status to QC_PENDING", `Status: ${res10.statusCode}`);

  const execComplete = await prisma.workOrderExecution.findUnique({ where: { workOrderId: woReady.id } });
  assert(execComplete?.completedAt !== null && execComplete?.completionNotes === "Assembly finished successfully", "   COMPLETE records completedAt and notes", `Notes: ${execComplete?.completionNotes}`);

  // 15. COMPLETE does not directly transition status to COMPLETED
  const woFinished = await prisma.workOrder.findUnique({ where: { id: woReady.id } });
  assert(woFinished?.status === "QC_PENDING", "15. COMPLETE does not directly set status to COMPLETED (awaits QC validation)", `Status: ${woFinished?.status}`);

  // 16. Audit log created for COMPLETE
  const auditComplete = await prisma.auditLog.findFirst({
    where: { entityType: "work-order", action: "PRODUCTION_COMPLETED", entityId: woReady.id }
  });
  assert(auditComplete !== null && auditComplete.prevStatus === "IN_PROGRESS" && auditComplete.newStatus === "QC_PENDING", "16. Audit log for COMPLETE created", `NewStatus: ${auditComplete?.newStatus}`);

  // 17. Unauthorized role Complete rejected (Tech role cannot complete - requires Supervisor/Admin)
  const res11 = await app.inject({
    method: "POST", url: `/crm/production/work-orders/${woReady.id}/complete`,
    payload: { notes: "Intruder try" },
    headers: techHeaders
  });
  assert(res11.statusCode === 403, "17. Unauthorized role COMPLETE is rejected", `Status: ${res11.statusCode}`);

  // 18. Concurrent execution mutations serialization locks check
  // Verify that locking blocks secondary operations
  // Test by manually launching concurrent start promises inside a transaction block
  const woConcurrencyTest = await prisma.workOrder.create({
    data: {
      workOrderNumber: `WO-${TEST_PREFIX}-${Date.now().toString().slice(-4)}-concurrency`,
      plannedQuantity: 5, remainingQuantity: 5,
      dueDate: new Date(), status: "READY"
    }
  });

  // Schedule woConcurrencyTest for today
  const maxSeqRecord2 = await prisma.workOrderScheduling.findFirst({
    where: { assignedDate: targetDate },
    orderBy: { sequence: "desc" }
  });
  const seq2 = (maxSeqRecord2?.sequence || 0) + 1;

  await prisma.workOrderScheduling.create({
    data: { workOrderId: woConcurrencyTest.id, assignedDate: targetDate, sequence: seq2, estimatedHrs: 1.0 }
  });

  const p1 = app.inject({
    method: "POST", url: `/crm/production/work-orders/${woConcurrencyTest.id}/start`,
    payload: { stationId: station.id },
    headers: supervisorHeaders
  });
  const p2 = app.inject({
    method: "POST", url: `/crm/production/work-orders/${woConcurrencyTest.id}/start`,
    payload: { stationId: station.id },
    headers: supervisorHeaders
  });

  const [cRes1, cRes2] = await Promise.all([p1, p2]);
  const onePassed = (cRes1.statusCode === 200 && cRes2.statusCode === 400) || (cRes2.statusCode === 200 && cRes1.statusCode === 400);
  assert(onePassed, "18. Concurrent START requests serialize safely (only one succeeds)", `Res1: ${cRes1.statusCode}, Res2: ${cRes2.statusCode}`);

  // ============================================
  // SUMMARY
  // ============================================
  console.log("\n" + "=".repeat(60));
  console.log(`Execution & Cockpit: ${passed} PASSED, ${failed} FAILED / ${passed + failed} total`);
  console.log("=".repeat(60));

  // Cleanup
  console.log("\n🧹 Cleaning up test records...");
  try {
    await prisma.workOrderExecution.deleteMany({
      where: {
        workOrder: {
          workOrderNumber: { startsWith: `WO-${TEST_PREFIX}` }
        }
      }
    });
    await prisma.workOrderScheduling.deleteMany({
      where: {
        workOrder: {
          workOrderNumber: { startsWith: `WO-${TEST_PREFIX}` }
        }
      }
    });
    await prisma.workOrder.deleteMany({
      where: {
        workOrderNumber: { startsWith: `WO-${TEST_PREFIX}` }
      }
    });
    await prisma.auditLog.deleteMany({ where: { actorId: supervisorUser.id } });
    await prisma.auditLog.deleteMany({ where: { actorId: techUser.id } });
    await prisma.productionStation.deleteMany({ where: { code: { startsWith: TEST_PREFIX } } });
  } catch (cleanupErr) {
    console.warn("⚠️ Cleanup (non-fatal):", cleanupErr);
  }

  await prisma.$disconnect();
  await app.close();
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => { console.error("Fatal:", err); process.exit(1); });
