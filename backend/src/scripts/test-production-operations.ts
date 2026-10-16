import Fastify from "fastify";
import { authPlugin } from "../plugins/auth";
import { authRoutes } from "../routes/auth";
import { productionRoutes } from "../routes/production";
import { qualityRoutes } from "../routes/quality";
import { PrismaClient } from "../generated/client";

const prisma = new PrismaClient();
const TEST_PREFIX = "TPO"; // Test Production Operations
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
  await app.register(qualityRoutes, { prefix: "/crm/quality" });
  await app.ready();
  return app;
}

async function runTests() {
  console.log("🧪 Running KYRA ZAM 3.0 Phase 3.0-C Production Operations Dashboard Tests...\n");
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

  // Setup test materials & BOM to test allocation and regression
  const material = await prisma.material.create({
    data: {
      name: `${TEST_PREFIX} Test Cell`,
      category: "CELLS",
      sku: `SKU-${TEST_PREFIX}-${Date.now().toString().slice(-4)}`,
      quantity: 500,
      unit: "pcs",
      unitPrice: 5,
      totalValue: 2500
    }
  });

  const bom = await prisma.bOM.create({
    data: {
      name: `${TEST_PREFIX}-PROD-BOM-${Date.now().toString().slice(-4)}`,
      description: "Test BOM for operations"
    }
  });

  await prisma.bOMItem.create({
    data: {
      bomId: bom.id,
      materialId: material.id,
      quantity: 2
    }
  });

  const testDate = "2026-09-15";
  const overdueDueDate = new Date("2026-08-01");

  // Create work orders
  // 1. Scheduled, READY
  const woReady = await prisma.workOrder.create({
    data: {
      workOrderNumber: `WO-${TEST_PREFIX}-1`,
      productRef: bom.name,
      bomId: bom.id,
      plannedQuantity: 10, remainingQuantity: 10,
      dueDate: new Date(testDate), status: "READY"
    }
  });

  // 2. Scheduled, IN_PROGRESS
  const woInProgress = await prisma.workOrder.create({
    data: {
      workOrderNumber: `WO-${TEST_PREFIX}-2`,
      productRef: bom.name,
      bomId: bom.id,
      plannedQuantity: 5, remainingQuantity: 5,
      dueDate: new Date(testDate), status: "IN_PROGRESS"
    }
  });

  // 3. Scheduled, ON_HOLD
  const woPaused = await prisma.workOrder.create({
    data: {
      workOrderNumber: `WO-${TEST_PREFIX}-3`,
      productRef: bom.name,
      bomId: bom.id,
      plannedQuantity: 8, remainingQuantity: 8,
      dueDate: new Date(testDate), status: "ON_HOLD"
    }
  });

  // 4. Scheduled, QC_PENDING
  const woQcPending = await prisma.workOrder.create({
    data: {
      workOrderNumber: `WO-${TEST_PREFIX}-4`,
      productRef: bom.name,
      bomId: bom.id,
      plannedQuantity: 12, remainingQuantity: 12,
      dueDate: new Date(testDate), status: "QC_PENDING"
    }
  });

  // 5. Scheduled, COMPLETED
  const woCompleted = await prisma.workOrder.create({
    data: {
      workOrderNumber: `WO-${TEST_PREFIX}-5`,
      productRef: bom.name,
      bomId: bom.id,
      plannedQuantity: 6, remainingQuantity: 6,
      dueDate: new Date(testDate), status: "COMPLETED"
    }
  });

  // 6. Overdue (Unscheduled or Scheduled, but past due date and not completed)
  const woOverdue = await prisma.workOrder.create({
    data: {
      workOrderNumber: `WO-${TEST_PREFIX}-6`,
      productRef: bom.name,
      bomId: bom.id,
      plannedQuantity: 4, remainingQuantity: 4,
      dueDate: overdueDueDate, status: "READY"
    }
  });

  // 7. Unallocated Scheduled Today (To trigger bottleneck MATERIAL_ALLOCATION_PENDING)
  const woCreated = await prisma.workOrder.create({
    data: {
      workOrderNumber: `WO-${TEST_PREFIX}-7`,
      productRef: bom.name,
      bomId: bom.id,
      plannedQuantity: 2, remainingQuantity: 2,
      dueDate: new Date(testDate), status: "CREATED"
    }
  });

  // Schedules
  const schedReady = await prisma.workOrderScheduling.create({
    data: { workOrderId: woReady.id, assignedDate: new Date(testDate + "T00:00:00.000Z"), sequence: 2, estimatedHrs: 4.0 }
  });
  const schedInProgress = await prisma.workOrderScheduling.create({
    data: { workOrderId: woInProgress.id, assignedDate: new Date(testDate + "T00:00:00.000Z"), sequence: 3, estimatedHrs: 3.0 }
  });
  const schedPaused = await prisma.workOrderScheduling.create({
    data: { workOrderId: woPaused.id, assignedDate: new Date(testDate + "T00:00:00.000Z"), sequence: 4, estimatedHrs: 2.0 }
  });
  const schedQcPending = await prisma.workOrderScheduling.create({
    data: { workOrderId: woQcPending.id, assignedDate: new Date(testDate + "T00:00:00.000Z"), sequence: 5, estimatedHrs: 5.0 }
  });
  const schedCompleted = await prisma.workOrderScheduling.create({
    data: { workOrderId: woCompleted.id, assignedDate: new Date(testDate + "T00:00:00.000Z"), sequence: 6, estimatedHrs: 1.5 }
  });
  const schedCreated = await prisma.workOrderScheduling.create({
    data: { workOrderId: woCreated.id, assignedDate: new Date(testDate + "T00:00:00.000Z"), sequence: 1, estimatedHrs: 2.0 }
  });

  // Executions
  await prisma.workOrderExecution.create({
    data: { workOrderId: woInProgress.id, startedAt: new Date(Date.now() - 3600000 * 2.5), actualHours: 2.5 } // 2.5 hours so far
  });
  await prisma.workOrderExecution.create({
    data: { workOrderId: woPaused.id, startedAt: new Date(Date.now() - 3600000 * 4), pausedAt: new Date(), pauseReason: "Broken tool", actualHours: 2.5 } // Overrun
  });
  await prisma.workOrderExecution.create({
    data: { workOrderId: woQcPending.id, startedAt: new Date(Date.now() - 3600000 * 6), completedAt: new Date(), actualHours: 5.5 } // 5.5 actual, 5.0 est
  });
  await prisma.workOrderExecution.create({
    data: { workOrderId: woCompleted.id, startedAt: new Date(Date.now() - 3600000 * 2), completedAt: new Date(), actualHours: 1.2 } // 1.2 actual, 1.5 est
  });

  // Assign Technician as operator
  await prisma.workOrderOperator.create({
    data: { workOrderId: woInProgress.id, userId: techUser.id, role: "OPERATOR", status: "ACTIVE" }
  });

  // Create audit logs for timeline verification
  await prisma.auditLog.create({
    data: { entityType: "work-order", entityId: woInProgress.id, actorId: supervisorUser.id, action: "PRODUCTION_STARTED", prevStatus: "READY", newStatus: "IN_PROGRESS" }
  });
  await prisma.auditLog.create({
    data: { entityType: "work-order", entityId: woPaused.id, actorId: supervisorUser.id, action: "PRODUCTION_STARTED", prevStatus: "READY", newStatus: "IN_PROGRESS" }
  });
  await prisma.auditLog.create({
    data: { entityType: "work-order", entityId: woPaused.id, actorId: supervisorUser.id, action: "PRODUCTION_PAUSED", prevStatus: "IN_PROGRESS", newStatus: "ON_HOLD", metadata: { pauseReason: "Broken tool" } }
  });

  console.log("🛠️ Invoking Operational Dashboard API...");

  // 1. Dashboard returns correct summary
  const resDashboard = await app.inject({
    method: "GET",
    url: `/crm/production/operations/dashboard?date=${testDate}`,
    headers: supervisorHeaders
  });

  assert(resDashboard.statusCode === 200, "1. Operations dashboard returns status code 200");
  const data = JSON.parse(resDashboard.body);

  // 2. Scheduled count correct
  assert(data.summary?.scheduled === 6, "2. Scheduled count correct (6 items scheduled today)", `Got: ${data.summary?.scheduled}`);

  // 3. READY count correct
  assert(data.summary?.ready === 1, "3. READY count correct (1 item)", `Got: ${data.summary?.ready}`);

  // 4. IN_PROGRESS count correct
  assert(data.summary?.inProgress === 1, "4. IN_PROGRESS count correct (1 item)", `Got: ${data.summary?.inProgress}`);

  // 5. PAUSED count correct
  assert(data.summary?.paused === 1, "5. PAUSED (ON_HOLD) count correct (1 item)", `Got: ${data.summary?.paused}`);

  // 6. QC_PENDING count correct
  assert(data.summary?.qcPending === 1, "6. QC_PENDING count correct (1 item)", `Got: ${data.summary?.qcPending}`);

  // 7. COMPLETED count correct
  assert(data.summary?.completed === 1, "7. COMPLETED count correct (1 item)", `Got: ${data.summary?.completed}`);

  // 8. Overdue calculation
  assert(data.summary?.overdue >= 1, "8. Overdue calculation returns at least 1 overdue item", `Got: ${data.summary?.overdue}`);

  // 9. Current production run detection
  assert(data.currentRun !== null && data.currentRun.workOrderNumber === `WO-${TEST_PREFIX}-2`, "9. Current production run correctly identifies WO-2", `Got: ${JSON.stringify(data.currentRun)}`);
  assert(data.currentRun?.technicians.includes(techUser.name), "   Current run correctly reports operators/technicians");

  // 10. Planned vs actual calculation & 11. Variance calculation
  // Completed/QC_pending: WO-4 (est 5.0, act 5.5) and WO-5 (est 1.5, act 1.2)
  // Total Planned = 5.0 + 1.5 = 6.5
  // Total Actual = 5.5 + 1.2 = 6.7
  // Total Variance = 6.7 - 6.5 = 0.2
  assert(data.performance?.plannedHours === 6.5, "10. Performance plannedHours calculation matches target", `Got: ${data.performance?.plannedHours}`);
  assert(Math.abs(data.performance?.actualHours - 6.7) < 0.0001, "    Performance actualHours calculation matches target", `Got: ${data.performance?.actualHours}`);
  assert(Math.abs(data.performance?.varianceHours - 0.2) < 0.0001, "11. Performance variance hours correct (+0.2 hours)", `Got: ${data.performance?.varianceHours}`);

  // 12. Bottleneck detection
  // We expect:
  // - MATERIAL_ALLOCATION_PENDING on WO-7
  // - SEQUENCE_DELAY on WO-1 (READY, sequence 2, but WO-2 sequence 3 is IN_PROGRESS)
  // - PRODUCTION_PAUSED on WO-3
  // - QC_PENDING on WO-4
  // - ESTIMATE_EXCEEDED on WO-3 (act 2.5 > est 2.0) and WO-4 (act 5.5 > est 5.0)
  const types = data.bottlenecks?.map((b: any) => b.type) || [];
  assert(types.includes("MATERIAL_ALLOCATION_PENDING"), "12. Bottleneck: detects MATERIAL_ALLOCATION_PENDING", `Types: ${types}`);
  assert(types.includes("SEQUENCE_DELAY"), "    Bottleneck: detects SEQUENCE_DELAY", `Types: ${types}`);
  assert(types.includes("PRODUCTION_PAUSED"), "    Bottleneck: detects PRODUCTION_PAUSED", `Types: ${types}`);
  assert(types.includes("QC_PENDING"), "    Bottleneck: detects QC_PENDING", `Types: ${types}`);
  assert(types.includes("ESTIMATE_EXCEEDED"), "    Bottleneck: detects ESTIMATE_EXCEEDED", `Types: ${types}`);

  // 13. WorkOrder operational detail
  const resDetail = await app.inject({
    method: "GET",
    url: `/crm/production/work-orders/${woInProgress.id}`,
    headers: techHeaders
  });
  assert(resDetail.statusCode === 200, "13. WorkOrder operational detail API returns 200");
  const detail = JSON.parse(resDetail.body);

  // 14. Audit timeline retrieval
  assert(detail.auditHistory?.length >= 1, "14. Audit history loaded successfully with work order detail", `Logs: ${detail.auditHistory?.length}`);

  // 15. Unauthorized operations blocked
  const resUnauth = await app.inject({
    method: "GET",
    url: `/crm/production/operations/dashboard?date=${testDate}`,
    headers: { Authorization: "Bearer badtoken" }
  });
  assert(resUnauth.statusCode === 401 || resUnauth.statusCode === 403, "15. Unauthorized access blocked (returns 401/403)", `Got: ${resUnauth.statusCode}`);

  // 16. Existing execution APIs remain functional
  const resPause = await app.inject({
    method: "POST",
    url: `/crm/production/work-orders/${woInProgress.id}/pause`,
    payload: { reason: "Need inspection" },
    headers: supervisorHeaders
  });
  assert(resPause.statusCode === 200, "16. Existing pause execution API functional", `Status: ${resPause.statusCode}`);

  // 17. Existing scheduling APIs remain functional
  const resUnscheduled = await app.inject({
    method: "GET",
    url: `/crm/production/schedule/unscheduled`,
    headers: supervisorHeaders
  });
  assert(resUnscheduled.statusCode === 200, "17. Existing scheduling API (get unscheduled) functional");

  // 18. No regression to WorkOrder state machine
  // Verify direct READY transition remains blocked
  const resStatusReady = await app.inject({
    method: "PUT",
    url: `/crm/production/work-orders/${woReady.id}/status`,
    payload: { status: "READY" },
    headers: supervisorHeaders
  });
  assert(resStatusReady.statusCode === 400 && resStatusReady.body.includes("Cannot transition status to READY manually"), "18. WorkOrder state machine regression check (direct READY transition blocked)", `Status: ${resStatusReady.statusCode}, Body: ${resStatusReady.body}`);

  // 19. No regression to material allocation
  // Allocate should work
  const testWoToAllocate = await prisma.workOrder.create({
    data: {
      workOrderNumber: `WO-${TEST_PREFIX}-ALLOCATE`,
      productRef: bom.name,
      bomId: bom.id,
      plannedQuantity: 5, remainingQuantity: 5,
      dueDate: new Date(testDate), status: "CREATED"
    }
  });
  const resAlloc = await app.inject({
    method: "POST",
    url: `/crm/production/work-orders/${testWoToAllocate.id}/allocate`,
    headers: supervisorHeaders
  });
  assert(resAlloc.statusCode === 200, "19. Existing material allocation API functional", `Status: ${resAlloc.statusCode}`);

  // 20. No regression to QC flow
  // Verify we can submit inspections
  const resQc = await app.inject({
    method: "POST",
    url: `/crm/quality/inspections`,
    payload: {
      workOrderId: woQcPending.id,
      inspectionType: "IN_PROCESS",
      result: "PASS",
      notes: "Tests looking good",
      checkpoints: [
        { name: "Visual inspection", result: "PASS", expectedValue: "clean", actualValue: "clean" }
      ]
    },
    headers: supervisorHeaders
  });
  assert(resQc.statusCode === 200, "20. Quality inspection flow regression check (IN_PROCESS submit works)", `Status: ${resQc.statusCode}`);

  // ============================================
  // SUMMARY
  // ============================================
  console.log("\n" + "=".repeat(60));
  console.log(`Operations & Cockpit: ${passed} PASSED, ${failed} FAILED / ${passed + failed} total`);
  console.log("=".repeat(60));

  // Cleanup
  console.log("\n🧹 Cleaning up test records...");
  try {
    await prisma.qualityCheckpoint.deleteMany({
      where: {
        inspection: {
          workOrderId: { in: [woReady.id, woInProgress.id, woPaused.id, woQcPending.id, woCompleted.id, woOverdue.id, woCreated.id, testWoToAllocate.id] }
        }
      }
    });
    await prisma.qualityInspection.deleteMany({
      where: {
        workOrderId: { in: [woReady.id, woInProgress.id, woPaused.id, woQcPending.id, woCompleted.id, woOverdue.id, woCreated.id, testWoToAllocate.id] }
      }
    });
    await prisma.workOrderOperator.deleteMany({
      where: {
        workOrderId: { in: [woReady.id, woInProgress.id, woPaused.id, woQcPending.id, woCompleted.id, woOverdue.id, woCreated.id, testWoToAllocate.id] }
      }
    });
    await prisma.workOrderExecution.deleteMany({
      where: {
        workOrderId: { in: [woReady.id, woInProgress.id, woPaused.id, woQcPending.id, woCompleted.id, woOverdue.id, woCreated.id, testWoToAllocate.id] }
      }
    });
    await prisma.workOrderScheduling.deleteMany({
      where: {
        workOrderId: { in: [woReady.id, woInProgress.id, woPaused.id, woQcPending.id, woCompleted.id, woOverdue.id, woCreated.id, testWoToAllocate.id] }
      }
    });
    await prisma.inventoryReservation.deleteMany({
      where: {
        materialId: material.id
      }
    });
    await prisma.stockMovement.deleteMany({
      where: {
        materialId: material.id
      }
    });
    await prisma.workOrder.deleteMany({
      where: {
        workOrderNumber: { startsWith: `WO-${TEST_PREFIX}` }
      }
    });
    await prisma.bOMItem.deleteMany({
      where: {
        bomId: bom.id
      }
    });
    await prisma.bOM.deleteMany({
      where: {
        id: bom.id
      }
    });
    await prisma.material.deleteMany({
      where: {
        id: material.id
      }
    });
    await prisma.auditLog.deleteMany({ where: { actorId: supervisorUser.id } });
    await prisma.auditLog.deleteMany({ where: { actorId: techUser.id } });
  } catch (cleanupErr) {
    console.warn("⚠️ Cleanup (non-fatal):", cleanupErr);
  }

  await prisma.$disconnect();
  await app.close();
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => { console.error("Fatal:", err); process.exit(1); });
