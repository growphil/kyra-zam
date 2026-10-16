import Fastify from "fastify";
import { authPlugin } from "../plugins/auth";
import { authRoutes } from "../routes/auth";
import { crmRoutes } from "../routes/crm";
import { paxRoutes } from "../routes/pax";
import { qualityRoutes } from "../routes/quality";
import { repairRoutes } from "../routes/repair";
import { PrismaClient } from "../generated/client";

const prisma = new PrismaClient();
const TEST_PREFIX = "T3E"; // Test 3.0-E
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
  await app.register(paxRoutes, { prefix: "/pax" });
  await app.register(qualityRoutes, { prefix: "/crm/quality" });
  await app.register(repairRoutes, { prefix: "/repair" });
  await app.ready();
  return app;
}

async function runTests() {
  console.log("🧪 Running KYRA ZAM 3.0 Phase 3.0-E Rework Loops & Cell Swap Integration Tests...\n");
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

  let engineerUser = await prisma.user.findFirst({ where: { email: `${TEST_PREFIX}engineer@kyrazam.com` } });
  if (!engineerUser) {
    engineerUser = await prisma.user.create({
      data: { name: `${TEST_PREFIX} Engineer`, email: `${TEST_PREFIX}engineer@kyrazam.com`, roles: ["PAX_TEST_ENGINEER"], passwordHash: "dummy", isActive: true }
    });
  }

  const supervisorToken = app.jwt.sign({ id: supervisorUser.id, roles: supervisorUser.roles as any });
  const techToken = app.jwt.sign({ id: techUser.id, roles: techUser.roles as any });
  const engineerToken = app.jwt.sign({ id: engineerUser.id, roles: engineerUser.roles as any });

  const supervisorHeaders = { Authorization: `Bearer ${supervisorToken}` };
  const techHeaders = { Authorization: `Bearer ${techToken}` };
  const engineerHeaders = { Authorization: `Bearer ${engineerToken}` };

  // Pre-test clean up of leftovers from crashed runs
  await prisma.paxCell.deleteMany({ where: { paxSerial: { startsWith: TEST_PREFIX } } });
  await prisma.defect.deleteMany({ where: { paxSerial: { startsWith: TEST_PREFIX } } });
  await prisma.repair.deleteMany({ where: { paxSerial: { startsWith: TEST_PREFIX } } });
  await prisma.paxPack.deleteMany({ where: { paxSerial: { startsWith: TEST_PREFIX } } });
  await prisma.workOrder.deleteMany({ where: { workOrderNumber: { startsWith: `WO-${TEST_PREFIX}` } } });
  await prisma.cell.deleteMany({ where: { serialNumber: { startsWith: TEST_PREFIX } } });
  await prisma.paxType.deleteMany({ where: { name: { startsWith: TEST_PREFIX } } });

  // Setup PaxType with delta safety thresholds
  const paxType = await prisma.paxType.create({
    data: {
      name: `${TEST_PREFIX}-PaxType-48V`,
      cellCount: 4,
      ahMin: 90.0,
      ahMax: 110.0,
      irMin: 0.5,
      irMax: 2.5,
      maxAhDifference: 0.4,
      maxIrDifference: 1.0,
      allowedGrades: ["A"]
    }
  });

  // Setup cells for the initial assembly
  const baseCellSerials = [`${TEST_PREFIX}-C1`, `${TEST_PREFIX}-C2`, `${TEST_PREFIX}-C3`, `${TEST_PREFIX}-C4`].map((s, i) => {
    return {
      serialNumber: s,
      voltage: 3.2,
      ahValue: 100.0,
      irValue: 1.0,
      grade: "A",
      batchNumber: `${TEST_PREFIX}-BATCH-1`,
      status: "CELL_TESTED" as any,
      category: "RAW_MATERIALS",
      cycles: 0
    };
  });

  for (const cellData of baseCellSerials) {
    await prisma.cell.upsert({
      where: { serialNumber: cellData.serialNumber },
      update: cellData,
      create: cellData
    });
  }

  // Create test WorkOrder
  const workOrder = await prisma.workOrder.create({
    data: {
      workOrderNumber: `WO-${TEST_PREFIX}-${Date.now().toString().slice(-4)}`,
      plannedQuantity: 1,
      remainingQuantity: 1,
      dueDate: new Date(),
      status: "IN_PROGRESS"
    }
  });

  // Create initial PaxPack in PAX_TESTED status
  const paxSerial = `${TEST_PREFIX}-PAX-001`;
  const paxPack = await prisma.paxPack.create({
    data: {
      paxSerial,
      paxTypeId: paxType.id,
      status: "PAX_TESTED",
      workOrderId: workOrder.id
    }
  });

  await prisma.paxCell.createMany({
    data: baseCellSerials.map((c, i) => ({
      paxSerial,
      cellSerial: c.serialNumber,
      position: i + 1
    }))
  });

  console.log("🔒 SECTION 1: Final QC Inspection Failures & Rework Routing");

  // 1. Submit FAIL final inspection
  const failInspectionRes = await app.inject({
    method: "POST",
    url: "/crm/quality/inspections",
    headers: supervisorHeaders,
    payload: {
      paxSerial,
      inspectionType: "FINAL",
      result: "FAIL",
      notes: "Severe drop in voltage observed on cell placement 2",
      checkpoints: [
        { name: "Visual check", description: "Visual inspection", expectedValue: "PASS", actualValue: "FAIL", result: "FAIL" }
      ]
    }
  });

  assert(failInspectionRes.statusCode === 200, "1. Submit failed final QC inspection returns 200");

  const updatedPax = await prisma.paxPack.findUnique({ where: { paxSerial } });
  assert(updatedPax?.status === "UNDER_REPAIR", "1. PaxPack is routed to UNDER_REPAIR on QC Failure");

  const spawnedDefect = await prisma.defect.findFirst({
    where: { paxSerial, status: "OPEN" }
  });
  assert(!!spawnedDefect, "1. Failed QC automatically creates an OPEN Defect ticket");
  assert(spawnedDefect?.severity === "CRITICAL", "1. Created Defect is correctly marked as CRITICAL");

  // 2. Reject sales clearance / approval if in UNDER_REPAIR status
  const approveRes = await app.inject({
    method: "POST",
    url: `/pax/${paxSerial}/approve`,
    headers: supervisorHeaders,
    payload: {
      action: "approve",
      reason: "Bypassing defect checks"
    }
  });
  assert(approveRes.statusCode === 400 && approveRes.body.includes("Status must be PAX_TESTED"), "2. Sales approval blocks clearancing packs in UNDER_REPAIR status");


  console.log("\n🧪 SECTION 2: Cell Swap Rework Validations");

  // Create replacement cells
  // A. Compatible cell
  const compatCellSerial = `${TEST_PREFIX}-CCOMP`;
  await prisma.cell.upsert({
    where: { serialNumber: compatCellSerial },
    update: { ahValue: 100.1, irValue: 1.1, grade: "A", batchNumber: `${TEST_PREFIX}-BATCH-1`, status: "CELL_TESTED" },
    create: { serialNumber: compatCellSerial, voltage: 3.2, ahValue: 100.1, irValue: 1.1, grade: "A", batchNumber: `${TEST_PREFIX}-BATCH-1`, status: "CELL_TESTED", category: "RAW_MATERIALS", cycles: 0 }
  });

  // B. Bad Grade cell
  const badGradeCellSerial = `${TEST_PREFIX}-CBADGRADE`;
  await prisma.cell.upsert({
    where: { serialNumber: badGradeCellSerial },
    update: { ahValue: 100.0, irValue: 1.0, grade: "B", batchNumber: `${TEST_PREFIX}-BATCH-1`, status: "CELL_TESTED" },
    create: { serialNumber: badGradeCellSerial, voltage: 3.2, ahValue: 100.0, irValue: 1.0, grade: "B", batchNumber: `${TEST_PREFIX}-BATCH-1`, status: "CELL_TESTED", category: "RAW_MATERIALS", cycles: 0 }
  });

  // C. Bad Batch cell
  const badBatchCellSerial = `${TEST_PREFIX}-CBADBATCH`;
  await prisma.cell.upsert({
    where: { serialNumber: badBatchCellSerial },
    update: { ahValue: 100.0, irValue: 1.0, grade: "A", batchNumber: `${TEST_PREFIX}-BATCH-2`, status: "CELL_TESTED" },
    create: { serialNumber: badBatchCellSerial, voltage: 3.2, ahValue: 100.0, irValue: 1.0, grade: "A", batchNumber: `${TEST_PREFIX}-BATCH-2`, status: "CELL_TESTED", category: "RAW_MATERIALS", cycles: 0 }
  });

  // D. Exceeds AH Delta cell (AH difference > 0.4)
  const badAhCellSerial = `${TEST_PREFIX}-CBADAH`;
  await prisma.cell.upsert({
    where: { serialNumber: badAhCellSerial },
    update: { ahValue: 100.9, irValue: 1.0, grade: "A", batchNumber: `${TEST_PREFIX}-BATCH-1`, status: "CELL_TESTED" },
    create: { serialNumber: badAhCellSerial, voltage: 3.2, ahValue: 100.9, irValue: 1.0, grade: "A", batchNumber: `${TEST_PREFIX}-BATCH-1`, status: "CELL_TESTED", category: "RAW_MATERIALS", cycles: 0 }
  });

  // E. Exceeds IR Delta cell (IR difference > 1.0)
  const badIrCellSerial = `${TEST_PREFIX}-CBADIR`;
  await prisma.cell.upsert({
    where: { serialNumber: badIrCellSerial },
    update: { ahValue: 100.0, irValue: 2.2, grade: "A", batchNumber: `${TEST_PREFIX}-BATCH-1`, status: "CELL_TESTED" },
    create: { serialNumber: badIrCellSerial, voltage: 3.2, ahValue: 100.0, irValue: 2.2, grade: "A", batchNumber: `${TEST_PREFIX}-BATCH-1`, status: "CELL_TESTED", category: "RAW_MATERIALS", cycles: 0 }
  });

  // F. Raw cell (not test graded)
  const rawCellSerial = `${TEST_PREFIX}-CRAW`;
  await prisma.cell.upsert({
    where: { serialNumber: rawCellSerial },
    update: { status: "RAW" },
    create: { serialNumber: rawCellSerial, voltage: 3.2, status: "RAW", category: "RAW_MATERIALS", cycles: 0 }
  });

  // 3. RBAC validation: Block cell swap for unauthorized roles (PAX_TEST_ENGINEER)
  const rbacSwapRes = await app.inject({
    method: "POST",
    url: "/repair/cell-swap",
    headers: engineerHeaders,
    payload: {
      paxSerial,
      oldCellSerial: `${TEST_PREFIX}-C2`,
      newCellSerial: compatCellSerial,
      defectId: spawnedDefect?.id,
      diagnosisNotes: "Swap out"
    }
  });
  assert(rbacSwapRes.statusCode === 403, "3. RBAC check blocks unauthorized roles from cell swaps");

  // 4. Swap fails if replacement cell status is not CELL_TESTED
  const statusSwapRes = await app.inject({
    method: "POST",
    url: "/repair/cell-swap",
    headers: techHeaders,
    payload: {
      paxSerial,
      oldCellSerial: `${TEST_PREFIX}-C2`,
      newCellSerial: rawCellSerial,
      defectId: spawnedDefect?.id,
      diagnosisNotes: "Swap cell"
    }
  });
  assert(statusSwapRes.statusCode === 400 && statusSwapRes.body.includes("status must be CELL_TESTED"), "4. Block cell swap if replacement cell is in RAW status");

  // 5. Swap fails if replacement cell grade mismatches or is not allowed
  const gradeSwapRes = await app.inject({
    method: "POST",
    url: "/repair/cell-swap",
    headers: techHeaders,
    payload: {
      paxSerial,
      oldCellSerial: `${TEST_PREFIX}-C2`,
      newCellSerial: badGradeCellSerial,
      defectId: spawnedDefect?.id,
      diagnosisNotes: "Swap cell"
    }
  });
  assert(gradeSwapRes.statusCode === 400 && gradeSwapRes.body.includes("Grade Mix Detected"), "5. Block cell swap if quality grades are mixed");

  // 6. Swap fails if replacement cell production batch mismatches
  const batchSwapRes = await app.inject({
    method: "POST",
    url: "/repair/cell-swap",
    headers: techHeaders,
    payload: {
      paxSerial,
      oldCellSerial: `${TEST_PREFIX}-C2`,
      newCellSerial: badBatchCellSerial,
      defectId: spawnedDefect?.id,
      diagnosisNotes: "Swap cell"
    }
  });
  assert(batchSwapRes.statusCode === 400 && batchSwapRes.body.includes("Batch Mix Detected"), "6. Enforce same production batch matching constraints");

  // 7. Swap fails if capacity delta (AH) exceeds max Ah variation limits
  const ahSwapRes = await app.inject({
    method: "POST",
    url: "/repair/cell-swap",
    headers: techHeaders,
    payload: {
      paxSerial,
      oldCellSerial: `${TEST_PREFIX}-C2`,
      newCellSerial: badAhCellSerial,
      defectId: spawnedDefect?.id,
      diagnosisNotes: "Swap cell"
    }
  });
  assert(ahSwapRes.statusCode === 400 && ahSwapRes.body.includes("exceeds max permitted variation"), "7. Prevent cell swap when capacity variation limit is violated");

  // 8. Swap fails if internal resistance delta (IR) exceeds max Ir variation limits
  const irSwapRes = await app.inject({
    method: "POST",
    url: "/repair/cell-swap",
    headers: techHeaders,
    payload: {
      paxSerial,
      oldCellSerial: `${TEST_PREFIX}-C2`,
      newCellSerial: badIrCellSerial,
      defectId: spawnedDefect?.id,
      diagnosisNotes: "Swap cell"
    }
  });
  assert(irSwapRes.statusCode === 400 && irSwapRes.body.includes("exceeds max permitted variation"), "8. Prevent cell swap when internal resistance variation limit is violated");


  console.log("\n🔄 SECTION 3: Happy Path Rework Flow & Defect Resolution");

  // 9. Execute swap successfully
  const oldCellPosition = 2; // Old cell is CELL-OLD-C2
  const targetOldCellSerial = `${TEST_PREFIX}-C2`;

  const swapRes = await app.inject({
    method: "POST",
    url: "/repair/cell-swap",
    headers: techHeaders,
    payload: {
      paxSerial,
      oldCellSerial: targetOldCellSerial,
      newCellSerial: compatCellSerial,
      defectId: spawnedDefect?.id,
      diagnosisNotes: "Replaced cell at slot 2 with compat replacement",
      oldCellDisposition: "CELL_TESTED" // Retain old cell as reusable graded stock
    }
  });

  assert(swapRes.statusCode === 200, "9. Execute cell swap successfully");

  // Confirm junction updates
  const postSwapPaxCells = await prisma.paxCell.findMany({ where: { paxSerial } });
  const newCellJunction = postSwapPaxCells.find(pc => pc.cellSerial === compatCellSerial);
  const oldCellJunction = postSwapPaxCells.find(pc => pc.cellSerial === targetOldCellSerial);

  assert(!!newCellJunction && newCellJunction.position === oldCellPosition, "9. Replacement cell is correctly bound in position slot");
  assert(!oldCellJunction, "9. Faulty cell link is deleted from pack genealogy");

  // Confirm old cell status is updated to disposition
  const swappedOldCell = await prisma.cell.findUnique({ where: { serialNumber: targetOldCellSerial } });
  assert(swappedOldCell?.status === "CELL_TESTED", "9. Swapped cell disposition status successfully updated");

  // Confirm defect resolved
  const postSwapDefect = await prisma.defect.findUnique({ where: { id: spawnedDefect?.id! } });
  assert(postSwapDefect?.status === "RESOLVED", "9. Swapped defect is auto-resolved inside the swap transaction");

  // 10. Complete repair and route back to testing
  const completeRepairRes = await app.inject({
    method: "POST",
    url: "/repair",
    headers: techHeaders,
    payload: {
      paxSerial,
      fixType: "cell_swap",
      diagnosisNotes: "Genealogy rework completed"
    }
  });

  assert(completeRepairRes.statusCode === 200, "10. Complete repair and reroute pack back to testing");

  const repairedPax = await prisma.paxPack.findUnique({ where: { paxSerial } });
  assert(repairedPax?.status === "PAX_ASSEMBLED", "10. Reworked pack returns to PAX_ASSEMBLED for testing");


  console.log("\n🧹 Cleaning up test records...");
  await prisma.paxCell.deleteMany({ where: { paxSerial } });
  await prisma.defect.deleteMany({ where: { paxSerial } });
  await prisma.repair.deleteMany({ where: { paxSerial } });
  await prisma.paxPack.delete({ where: { paxSerial } });
  await prisma.workOrder.deleteMany({ where: { workOrderNumber: { startsWith: `WO-${TEST_PREFIX}` } } });
  await prisma.cell.deleteMany({ where: { serialNumber: { startsWith: TEST_PREFIX } } });
  await prisma.paxType.delete({ where: { id: paxType.id } });

  console.log(`\n==========================================`);
  console.log(`🧪 TEST RUN COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log(`==========================================`);

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
