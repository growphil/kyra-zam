import Fastify from "fastify";
import { authPlugin } from "../plugins/auth";
import { authRoutes } from "../routes/auth";
import { crmRoutes } from "../routes/crm";
import { productionRoutes } from "../routes/production";
import { stationRoutes } from "../routes/stations";
import { paxRoutes } from "../routes/pax";
import { PrismaClient } from "../generated/client";

const prisma = new PrismaClient();
const TEST_PREFIX = "T3D"; // Test 3.0-D
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
  await app.register(stationRoutes, { prefix: "/crm/stations" });
  await app.register(paxRoutes, { prefix: "/crm/pax" });
  await app.ready();
  return app;
}

async function runTests() {
  console.log("🧪 Running KYRA ZAM 3.0 Phase 3.0-D Station & Safeguard Integration Tests...\n");
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

  let adminUser = await prisma.user.findFirst({ where: { email: `${TEST_PREFIX}admin@kyrazam.com` } });
  if (!adminUser) {
    adminUser = await prisma.user.create({
      data: { name: `${TEST_PREFIX} Admin`, email: `${TEST_PREFIX}admin@kyrazam.com`, roles: ["ADMIN"], passwordHash: "dummy", isActive: true }
    });
  }

  const supervisorToken = app.jwt.sign({ id: supervisorUser.id, roles: supervisorUser.roles as any });
  const techToken = app.jwt.sign({ id: techUser.id, roles: techUser.roles as any });
  const adminToken = app.jwt.sign({ id: adminUser.id, roles: adminUser.roles as any });

  const supervisorHeaders = { Authorization: `Bearer ${supervisorToken}` };
  const techHeaders = { Authorization: `Bearer ${techToken}` };
  const adminHeaders = { Authorization: `Bearer ${adminToken}` };

  // Pre-test clean up of leftovers from crashed runs
  const stalePaxTypes = await prisma.paxType.findMany({ where: { name: { startsWith: TEST_PREFIX } }, select: { id: true } });
  const stalePaxTypeIds = stalePaxTypes.map(pt => pt.id);
  if (stalePaxTypeIds.length > 0) {
    const stalePaxPacks = await prisma.paxPack.findMany({ where: { paxTypeId: { in: stalePaxTypeIds } }, select: { paxSerial: true } });
    const staleSerials = stalePaxPacks.map(p => p.paxSerial);
    if (staleSerials.length > 0) {
      await prisma.paxCell.deleteMany({ where: { paxSerial: { in: staleSerials } } });
      await prisma.defect.deleteMany({ where: { paxSerial: { in: staleSerials } } });
      await prisma.repair.deleteMany({ where: { paxSerial: { in: staleSerials } } });
      await prisma.stockMovement.deleteMany({ where: { referenceId: { in: staleSerials } } });
      await prisma.paxPack.deleteMany({ where: { paxSerial: { in: staleSerials } } });
    }
    await prisma.paxType.deleteMany({ where: { id: { in: stalePaxTypeIds } } });
  }
  await prisma.stationOperatorAssignment.deleteMany({ where: { station: { code: { startsWith: TEST_PREFIX } } } });
  await prisma.workOrderExecution.deleteMany({ where: { workOrder: { workOrderNumber: { startsWith: `WO-${TEST_PREFIX}` } } } });
  await prisma.workOrderScheduling.deleteMany({ where: { workOrder: { workOrderNumber: { startsWith: `WO-${TEST_PREFIX}` } } } });
  await prisma.workOrder.deleteMany({ where: { workOrderNumber: { startsWith: `WO-${TEST_PREFIX}` } } });
  await prisma.productionStation.deleteMany({ where: { code: { startsWith: TEST_PREFIX } } });
  await prisma.cell.deleteMany({ where: { serialNumber: { startsWith: TEST_PREFIX } } });
  await prisma.material.deleteMany({ where: { sku: { startsWith: TEST_PREFIX } } });

  // Setup test materials
  const material = await prisma.material.create({
    data: {
      name: `${TEST_PREFIX}-Reclaimable-BMS`,
      sku: `${TEST_PREFIX}-BMS-1`,
      materialType: "BMS",
      category: "BMS",
      quantity: 10,
      minStock: 5,
      unit: "PCS"
    }
  });

  // Setup PaxType
  const paxType = await prisma.paxType.create({
    data: {
      name: `${TEST_PREFIX}-PaxType-60V`,
      cellCount: 16,
      ahMin: 90.0,
      ahMax: 110.0,
      irMin: 0.1,
      irMax: 2.0,
      maxAhDifference: 0.5,
      maxIrDifference: 2.0
    }
  });

  // ----------------- SECTION 1: Stations Configuration & Management -----------------
  console.log("\n🚉 SECTION 1: Stations Configuration & Management\n");

  // 1. Create a station with Admin role
  const createStationRes = await app.inject({
    method: "POST",
    url: "/crm/stations",
    payload: {
      name: `${TEST_PREFIX} Assembly Line A`,
      code: `${TEST_PREFIX}-LINE-A`,
      type: "ASSEMBLY",
      isActive: true
    },
    headers: adminHeaders
  });
  assert(createStationRes.statusCode === 200, "1. Create station successfully with Admin", `Status: ${createStationRes.statusCode}`);
  const stationA = createStationRes.json();

  // 2. Reject station creation with non-Admin role
  const createStationFailRes = await app.inject({
    method: "POST",
    url: "/crm/stations",
    payload: {
      name: `${TEST_PREFIX} Assembly Line B`,
      code: `${TEST_PREFIX}-LINE-B`,
      type: "ASSEMBLY",
      isActive: true
    },
    headers: techHeaders
  });
  assert(createStationFailRes.statusCode === 403, "2. Block station creation for Assembly Technician role", `Status: ${createStationFailRes.statusCode}`);

  // 3. List all stations
  const listStationsRes = await app.inject({
    method: "GET",
    url: "/crm/stations",
    headers: techHeaders
  });
  assert(listStationsRes.statusCode === 200, "3. List configured stations for authenticated user", `Status: ${listStationsRes.statusCode}`);

  // 4. Update station configuration
  const updateStationRes = await app.inject({
    method: "PUT",
    url: `/crm/stations/${stationA.id}`,
    payload: {
      name: `${TEST_PREFIX} Assembly Line A updated`
    },
    headers: adminHeaders
  });
  assert(updateStationRes.statusCode === 200, "4. Update station name successfully", `Status: ${updateStationRes.statusCode}`);

  // ----------------- SECTION 2: Station Assignments & Check-Ins -----------------
  console.log("\n👥 SECTION 2: Station Assignments & Check-Ins\n");

  // 5. Tech checks in to Station A
  const assignRes = await app.inject({
    method: "POST",
    url: "/crm/stations/assign",
    payload: {
      stationId: stationA.id
    },
    headers: techHeaders
  });
  assert(assignRes.statusCode === 200, "5. Operator can check in to active station", `Status: ${assignRes.statusCode}`);

  // 6. View active assignments list
  const activeAssignsRes = await app.inject({
    method: "GET",
    url: "/crm/stations/active-assignments",
    headers: supervisorHeaders
  });
  assert(activeAssignsRes.statusCode === 200, "6. Fetch active assignments on floor", `Status: ${activeAssignsRes.statusCode}`);
  assert(activeAssignsRes.json().length > 0, "   -> Contains active check-in assignments", `Count: ${activeAssignsRes.json().length}`);

  // 7. Tech releases station assignment
  const releaseRes = await app.inject({
    method: "POST",
    url: "/crm/stations/release",
    payload: {},
    headers: techHeaders
  });
  assert(releaseRes.statusCode === 200, "7. Operator can check out/release station assignment", `Status: ${releaseRes.statusCode}`);

  // ----------------- SECTION 3: Production Start Safeguards & Schedule Enforcement -----------------
  console.log("\n🔒 SECTION 3: Production Start Safeguards & Schedule Enforcement\n");

  const woReady = await prisma.workOrder.create({
    data: {
      workOrderNumber: `WO-${TEST_PREFIX}-${Date.now().toString().slice(-4)}-READY`,
      plannedQuantity: 1, remainingQuantity: 1,
      dueDate: new Date(), status: "READY"
    }
  });

  // 8. Start WO without stationId
  const startNoStationRes = await app.inject({
    method: "POST",
    url: `/crm/production/work-orders/${woReady.id}/start`,
    payload: {},
    headers: techHeaders
  });
  assert(startNoStationRes.statusCode === 400, "8. Block starting execution when stationId is missing", `Status: ${startNoStationRes.statusCode}`);

  // 9. Start WO with invalid stationId
  const startInvalidStationRes = await app.inject({
    method: "POST",
    url: `/crm/production/work-orders/${woReady.id}/start`,
    payload: { stationId: "00000000-0000-0000-0000-000000000000" },
    headers: techHeaders
  });
  assert(startInvalidStationRes.statusCode === 404, "9. Block starting execution with invalid stationId", `Status: ${startInvalidStationRes.statusCode}`);

  // 10. Start WO without scheduling record
  const startNoScheduleRes = await app.inject({
    method: "POST",
    url: `/crm/production/work-orders/${woReady.id}/start`,
    payload: { stationId: stationA.id },
    headers: techHeaders
  });
  assert(startNoScheduleRes.statusCode === 400, "10. Block starting unscheduled Work Order", `Status: ${startNoScheduleRes.statusCode}`);

  // Schedule for tomorrow (to test day match check)
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split("T")[0];
  
  await prisma.workOrderScheduling.create({
    data: {
      workOrderId: woReady.id,
      assignedDate: new Date(tomorrowStr + "T00:00:00.000Z"),
      sequence: 1,
      estimatedHrs: 2.0
    }
  });

  // 11. Start WO scheduled for different date
  const startWrongDateRes = await app.inject({
    method: "POST",
    url: `/crm/production/work-orders/${woReady.id}/start`,
    payload: { stationId: stationA.id },
    headers: techHeaders
  });
  assert(startWrongDateRes.statusCode === 400, "11. Block starting Work Order scheduled for a different date", `Status: ${startWrongDateRes.statusCode}`);

  // Update schedule to today
  const todayStr = new Date().toISOString().split("T")[0];
  await prisma.workOrderScheduling.update({
    where: { workOrderId: woReady.id },
    data: { assignedDate: new Date(todayStr + "T00:00:00.000Z") }
  });

  // 12. Start WO successfully
  const startSuccessRes = await app.inject({
    method: "POST",
    url: `/crm/production/work-orders/${woReady.id}/start`,
    payload: { stationId: stationA.id },
    headers: techHeaders
  });
  assert(startSuccessRes.statusCode === 200, "12. Successfully starts execution when scheduling and active station checks pass", `Status: ${startSuccessRes.statusCode}`);

  // Verify auto check-in assignment
  const assignmentsAfterStart = await prisma.stationOperatorAssignment.findMany({
    where: { operatorId: techUser.id, releasedAt: null }
  });
  assert(assignmentsAfterStart.length === 1 && assignmentsAfterStart[0].stationId === stationA.id, "   -> Operator is automatically checked into station", `Station check: ${assignmentsAfterStart[0]?.stationId}`);

  // ----------------- SECTION 4: Scrap Material Reclamation Loops -----------------
  console.log("\n♻️ SECTION 4: Scrap Material Reclamation Loops\n");

  const cellSerials = Array.from({ length: 16 }, (_, i) => `${TEST_PREFIX}-CELL-${Date.now()}-${i}`);
  for (const cs of cellSerials) {
    await prisma.cell.create({
      data: {
        serialNumber: cs,
        status: "CELL_TESTED",
        voltage: 3.2,
        irValue: 0.8,
        ahValue: 100.2,
        cycles: 1,
        category: "GRADE_A"
      }
    });
  }

  // Assemble a PaxPack
  const assembleRes = await app.inject({
    method: "POST",
    url: "/crm/pax",
    payload: {
      paxTypeId: paxType.id,
      cellSerials,
      workOrderId: woReady.id
    },
    headers: techHeaders
  });
  const paxSerial = assembleRes.json().paxSerial;

  // Set Pax status to PAX_TESTED so it can be approved or rejected by supervisor
  await prisma.paxPack.update({
    where: { paxSerial },
    data: { status: "PAX_TESTED" }
  });

  const preReclaimQty = material.quantity;

  // 13. Rejection with reclaimed materials
  const rejectRes = await app.inject({
    method: "POST",
    url: `/crm/pax/${paxSerial}/approve`,
    payload: {
      action: "reject",
      reason: "Faulty casing detected",
      reclaimedMaterials: [
        { materialId: material.id, quantity: 1 }
      ]
    },
    headers: supervisorHeaders
  });
  assert(rejectRes.statusCode === 200, "13. Supervisor can reject and disassemble Pax Pack with material returns", `Status: ${rejectRes.statusCode}`);

  const postMaterial = await prisma.material.findUnique({ where: { id: material.id } });
  assert(postMaterial!.quantity === preReclaimQty + 1, "   -> Material quantity successfully incremented in stock", `Before: ${preReclaimQty}, After: ${postMaterial!.quantity}`);

  const movement = await prisma.stockMovement.findFirst({
    where: { referenceId: paxSerial, source: "SCRAP_RECLAMATION" }
  });
  assert(!!movement && movement.movementType === "RETURN" && movement.quantity === 1, "   -> StockMovement log created with RETURN type", `Movement type: ${movement?.movementType}`);

  // Summary results
  console.log("\n==========================================");
  console.log(`🧪 TEST RUN COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log("==========================================\n");

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error("Test execution aborted:", err);
  process.exit(1);
});
