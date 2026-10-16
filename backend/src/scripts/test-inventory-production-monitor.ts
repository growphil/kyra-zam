import Fastify from "fastify";
import { authPlugin } from "../plugins/auth";
import { authRoutes } from "../routes/auth";
import { productionRoutes } from "../routes/production";
import { PrismaClient } from "../generated/client";

const prisma = new PrismaClient();
const TEST_PREFIX = "TIPM"; // Test Inventory Production Monitor
let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passed++;
  } else {
    console.log(`  ❌ FAIL: ${testName} — ${detail || ""}`);
    failed++;
  }
}

async function buildTestApp() {
  const app = Fastify({ logger: false });
  await app.register(authPlugin);
  await app.register(authRoutes, { prefix: "/auth" });
  await app.register(productionRoutes, { prefix: "/crm/production" });
  await app.ready();
  return app;
}

async function runTests() {
  console.log("🧪 Running KYRA ZAM 3.0 Inventory Manager Live Production & Material Monitor Tests...\n");
  const app = await buildTestApp();

  // 1. Create test actors
  let invUser = await prisma.user.findFirst({ where: { email: `${TEST_PREFIX}inv@kyrazam.com` } });
  if (!invUser) {
    invUser = await prisma.user.create({
      data: {
        name: `${TEST_PREFIX} Inventory Manager`,
        email: `${TEST_PREFIX}inv@kyrazam.com`,
        roles: ["INVENTORY_MANAGER"],
        passwordHash: "dummy",
        isActive: true
      }
    });
  }

  let supervisorUser = await prisma.user.findFirst({ where: { email: `${TEST_PREFIX}sup@kyrazam.com` } });
  if (!supervisorUser) {
    supervisorUser = await prisma.user.create({
      data: {
        name: `${TEST_PREFIX} Supervisor`,
        email: `${TEST_PREFIX}sup@kyrazam.com`,
        roles: ["SUPERVISOR"],
        passwordHash: "dummy",
        isActive: true
      }
    });
  }

  const invToken = app.jwt.sign({ id: invUser.id, roles: invUser.roles as any });
  const supervisorToken = app.jwt.sign({ id: supervisorUser.id, roles: supervisorUser.roles as any });

  const invHeaders = { Authorization: `Bearer ${invToken}` };
  const supervisorHeaders = { Authorization: `Bearer ${supervisorToken}` };

  // 2. Setup BOM and Materials
  const randSuffix = Date.now().toString().slice(-4);
  const materialA = await prisma.material.create({
    data: {
      name: `${TEST_PREFIX} Nickel Strip`,
      category: "HARDWARE",
      sku: `${TEST_PREFIX}-MAT-001-${randSuffix}`,
      quantity: 100,
      unit: "METERS",
      unitPrice: 15
    }
  });

  const materialB = await prisma.material.create({
    data: {
      name: `${TEST_PREFIX} BMS 48V 16S`,
      category: "ELECTRONICS",
      sku: `${TEST_PREFIX}-MAT-002-${randSuffix}`,
      quantity: 50,
      unit: "PCS",
      unitPrice: 120
    }
  });

  const bom = await prisma.bOM.create({
    data: {
      name: `${TEST_PREFIX} 48V Battery Pack BOM ${randSuffix}`,
      description: "Test BOM",
      items: {
        create: [
          { materialId: materialA.id, quantity: 2 },
          { materialId: materialB.id, quantity: 1 }
        ]
      }
    }
  });

  // 3. Create WorkOrder 1 (CREATED - Unallocated)
  const wo1 = await prisma.workOrder.create({
    data: {
      workOrderNumber: `WO-${TEST_PREFIX}-${randSuffix}`,
      bomId: bom.id,
      productRef: bom.name,
      plannedQuantity: 10,
      remainingQuantity: 10,
      dueDate: new Date(),
      status: "CREATED"
    }
  });

  // 4. Test GET /crm/production/dashboard as INVENTORY_MANAGER
  const resDash = await app.inject({
    method: "GET",
    url: "/crm/production/dashboard",
    headers: invHeaders
  });
  assert(resDash.statusCode === 200, "1. INVENTORY_MANAGER can access /crm/production/dashboard");

  const dashBody = JSON.parse(resDash.body);
  assert(Array.isArray(dashBody.liveRuns), "2. Dashboard returns liveRuns array");
  assert(Array.isArray(dashBody.unallocatedWorkOrders), "3. Dashboard returns unallocatedWorkOrders array");
  assert(dashBody.unallocatedWorkOrders.some((w: any) => w.id === wo1.id), "4. Unallocated list contains newly created WorkOrder");

  // 5. Test material allocation by INVENTORY_MANAGER
  const resAlloc = await app.inject({
    method: "POST",
    url: `/crm/production/work-orders/${wo1.id}/allocate`,
    headers: invHeaders
  });
  assert(resAlloc.statusCode === 200, "5. INVENTORY_MANAGER can allocate materials for WorkOrder");

  const wo1Allocated = await prisma.workOrder.findUnique({ where: { id: wo1.id } });
  assert(wo1Allocated?.status === "READY", "6. WorkOrder status transitioned to READY after allocation");

  // 6. Verify INVENTORY_MANAGER cannot START production (403 Forbidden)
  const resStartInv = await app.inject({
    method: "POST",
    url: `/crm/production/work-orders/${wo1.id}/start`,
    headers: invHeaders
  });
  assert(resStartInv.statusCode === 403, "7. INVENTORY_MANAGER is forbidden (403) from starting production");

  // 7. Verify INVENTORY_MANAGER cannot PAUSE production (403 Forbidden)
  const resPauseInv = await app.inject({
    method: "POST",
    url: `/crm/production/work-orders/${wo1.id}/pause`,
    payload: { reason: "test" },
    headers: invHeaders
  });
  assert(resPauseInv.statusCode === 403, "8. INVENTORY_MANAGER is forbidden (403) from pausing production");

  // 8. Verify INVENTORY_MANAGER cannot COMPLETE production (403 Forbidden)
  const resCompleteInv = await app.inject({
    method: "POST",
    url: `/crm/production/work-orders/${wo1.id}/complete`,
    headers: invHeaders
  });
  assert(resCompleteInv.statusCode === 403, "9. INVENTORY_MANAGER is forbidden (403) from completing production");

  // Create active station for test start
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

  // 9. Schedule WorkOrder for today as SUPERVISOR
  const todayStr = new Date().toISOString().split("T")[0];
  const targetDate = new Date(todayStr + "T00:00:00.000Z");
  const maxSeqRec = await prisma.workOrderScheduling.findFirst({
    where: { assignedDate: targetDate },
    orderBy: { sequence: "desc" }
  });
  const nextSeq = (maxSeqRec?.sequence || 0) + 1;

  await prisma.workOrderScheduling.create({
    data: {
      workOrderId: wo1.id,
      assignedDate: targetDate,
      sequence: nextSeq,
      estimatedHrs: 4.0
    }
  });

  // 10. SUPERVISOR starts production
  const resStartSup = await app.inject({
    method: "POST",
    url: `/crm/production/work-orders/${wo1.id}/start`,
    payload: { stationId: station.id },
    headers: supervisorHeaders
  });
  assert(resStartSup.statusCode === 200, "10. SUPERVISOR starts production successfully", `Status: ${resStartSup.statusCode}, Body: ${resStartSup.body}`);

  // 11. INVENTORY_MANAGER checks live production monitor
  const resDashLive = await app.inject({
    method: "GET",
    url: "/crm/production/dashboard",
    headers: invHeaders
  });
  const dashLiveBody = JSON.parse(resDashLive.body);
  const liveWo1 = dashLiveBody.liveRuns.find((r: any) => r.id === wo1.id);
  assert(liveWo1 !== undefined, "11. Started WorkOrder immediately surfaces in liveRuns on dashboard");
  assert(liveWo1?.status === "IN_PROGRESS", "12. Live run displays authoritative IN_PROGRESS status");
  assert(Array.isArray(liveWo1?.materials) && liveWo1.materials.length === 2, "13. Live run includes populated BOM materials breakdown");

  const matA = liveWo1?.materials.find((m: any) => m.materialId === materialA.id);
  assert(matA?.neededQty === 20, "14. Needed quantity calculation is accurate (2 per unit * 10 units = 20)");
  assert(matA?.isAllocated === true, "15. Allocation flag is true for live run");

  // ============================================
  // SUMMARY
  // ============================================
  console.log("\n" + "=".repeat(60));
  console.log(`Inventory Monitor Tests: ${passed} PASSED, ${failed} FAILED / ${passed + failed} total`);
  console.log("=".repeat(60));

  // Cleanup
  console.log("\n🧹 Cleaning up test records...");
  try {
    await prisma.workOrderExecution.deleteMany({ where: { workOrderId: wo1.id } });
    await prisma.workOrderScheduling.deleteMany({ where: { workOrderId: wo1.id } });
    await prisma.inventoryReservation.deleteMany({ where: { materialId: { in: [materialA.id, materialB.id] } } });
    await prisma.stockMovement.deleteMany({ where: { materialId: { in: [materialA.id, materialB.id] } } });
    await prisma.workOrder.deleteMany({ where: { id: wo1.id } });
    await prisma.bOMItem.deleteMany({ where: { bomId: bom.id } });
    await prisma.bOM.deleteMany({ where: { id: bom.id } });
    await prisma.material.deleteMany({ where: { id: { in: [materialA.id, materialB.id] } } });
    await prisma.auditLog.deleteMany({ where: { actorId: { in: [invUser.id, supervisorUser.id] } } });
  } catch (err) {
    console.warn("Cleanup warning:", err);
  }

  await prisma.$disconnect();
  await app.close();
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error("Fatal test error:", err);
  process.exit(1);
});
