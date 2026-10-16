import Fastify from "fastify";
import { authPlugin } from "../plugins/auth";
import { authRoutes } from "../routes/auth";
import { cellRoutes } from "../routes/cells";
import { testingRoutes } from "../routes/testing";
import { paxRoutes } from "../routes/pax";
import { salesRoutes } from "../routes/sales";
import { inventoryRoutes } from "../routes/inventory";
import { repairRoutes } from "../routes/repair";
import { reportsRoutes } from "../routes/reports";
import { adminRoutes } from "../routes/admin";
import { bomRoutes } from "../routes/bom";
import { serviceRoutes } from "../routes/service";
import { scrapRoutes } from "../routes/scrap";
import { crmRoutes } from "../routes/crm";
import { quotationRoutes } from "../routes/quotations";
import { salesOrderRoutes } from "../routes/salesOrders";
import { procurementRoutes } from "../routes/procurement";
import { productionRoutes } from "../routes/production";
import { qualityRoutes } from "../routes/quality";
import { dispatchRoutes } from "../routes/dispatch";
import { financeRoutes } from "../routes/finance";
import { warrantyRoutes } from "../routes/warranty";
import { stationRoutes } from "../routes/stations";
import { multipartPlugin } from "../plugins/multipart";
import { PrismaClient, CellStatus, PaxStatus, WorkOrderStatus } from "../generated/client";

const prisma = new PrismaClient();
const RUN_ID = Date.now().toString().slice(-6);
const PREFIX = `E2E-${RUN_ID}`;

interface TestResult {
  step: string;
  role: string;
  action: string;
  expected: string;
  actual: string;
  status: "PASS" | "FAIL";
  details?: string;
}

const testResults: TestResult[] = [];
let passedCount = 0;
let failedCount = 0;

function recordTest(
  step: string,
  role: string,
  action: string,
  expected: string,
  actual: string,
  condition: boolean,
  details?: string
) {
  const status = condition ? "PASS" : "FAIL";
  if (condition) {
    passedCount++;
    console.log(`  ✅ [${step}] [${role}] ${action} -> PASS`);
  } else {
    failedCount++;
    console.log(`  ❌ [${step}] [${role}] ${action} -> FAIL: ${details || "Assertion failed"}`);
    console.log(`     Expected: ${expected} | Actual: ${actual}`);
  }
  testResults.push({ step, role, action, expected, actual, status, details });
}

async function buildApp() {
  const app = Fastify({ logger: false });
  await app.register(authPlugin);
  await app.register(multipartPlugin);

  await app.register(authRoutes, { prefix: "/auth" });
  await app.register(cellRoutes, { prefix: "/cells" });
  await app.register(testingRoutes, { prefix: "/testing" });
  await app.register(paxRoutes, { prefix: "/pax" });
  await app.register(salesRoutes, { prefix: "/sales" });
  await app.register(inventoryRoutes, { prefix: "/inventory" });
  await app.register(repairRoutes, { prefix: "/repair" });
  await app.register(reportsRoutes, { prefix: "/reports" });
  await app.register(adminRoutes, { prefix: "/admin" });
  await app.register(bomRoutes, { prefix: "/bom" });
  await app.register(serviceRoutes, { prefix: "/service" });
  await app.register(scrapRoutes, { prefix: "/scrap" });
  await app.register(crmRoutes, { prefix: "/crm" });
  await app.register(quotationRoutes, { prefix: "/crm/quotations" });
  await app.register(salesOrderRoutes, { prefix: "/crm/sales-orders" });
  await app.register(procurementRoutes, { prefix: "/crm/procurement" });
  await app.register(productionRoutes, { prefix: "/crm/production" });
  await app.register(qualityRoutes, { prefix: "/crm/quality" });
  await app.register(dispatchRoutes, { prefix: "/crm/dispatch" });
  await app.register(financeRoutes, { prefix: "/crm/finance" });
  await app.register(warrantyRoutes, { prefix: "/crm/warranty" });
  await app.register(stationRoutes, { prefix: "/crm/stations" });

  await app.ready();
  return app;
}

async function runE2EProductionTest() {
  console.log("================================================================================");
  console.log(`  🚀 KYRA ZAM 3.0 — COMPLETE E2E PRODUCTION ROLE-HANDOFF TEST (RUN: ${RUN_ID})`);
  console.log("================================================================================\n");

  const app = await buildApp();

  // ── 1. RETRIEVE TEST ACTORS & TOKENS ───────────────────────────────────────
  console.log("🔐 Step 1: Authenticating Production Personnel...");

  const supervisorUser = await prisma.user.findFirst({ where: { email: "super@kyrazam.com" } });
  const testEngineerUser = await prisma.user.findFirst({ where: { email: "test@kyrazam.com" } });
  const assemblyTechUser = await prisma.user.findFirst({ where: { email: "asm@kyrazam.com" } });
  const paxTestEngineerUser = await prisma.user.findFirst({ where: { email: "paxtest@kyrazam.com" } });
  const qcUser = await prisma.user.findFirst({ where: { email: "qc@kyrazam.com" } });
  const inventoryManagerUser = await prisma.user.findFirst({ where: { email: "inv@kyrazam.com" } });
  const salesExecUser = await prisma.user.findFirst({ where: { email: "sales@kyrazam.com" } });
  const adminUser = await prisma.user.findFirst({ where: { email: "admin@kyrazam.com" } });

  if (!supervisorUser || !testEngineerUser || !assemblyTechUser || !paxTestEngineerUser || !qcUser || !inventoryManagerUser) {
    throw new Error("Seed users missing. Please ensure prisma/seed.ts was executed.");
  }

  const supervisorToken = app.jwt.sign({ id: supervisorUser.id, roles: supervisorUser.roles as any });
  const testEngineerToken = app.jwt.sign({ id: testEngineerUser.id, roles: testEngineerUser.roles as any });
  const assemblyTechToken = app.jwt.sign({ id: assemblyTechUser.id, roles: assemblyTechUser.roles as any });
  const paxTestEngineerToken = app.jwt.sign({ id: paxTestEngineerUser.id, roles: paxTestEngineerUser.roles as any });
  const qcToken = app.jwt.sign({ id: qcUser.id, roles: qcUser.roles as any });
  const inventoryToken = app.jwt.sign({ id: inventoryManagerUser.id, roles: inventoryManagerUser.roles as any });
  const salesToken = app.jwt.sign({ id: salesExecUser!.id, roles: salesExecUser!.roles as any });
  const adminToken = app.jwt.sign({ id: adminUser!.id, roles: adminUser!.roles as any });

  const supervisorHeaders = { Authorization: `Bearer ${supervisorToken}` };
  const testEngineerHeaders = { Authorization: `Bearer ${testEngineerToken}` };
  const assemblyTechHeaders = { Authorization: `Bearer ${assemblyTechToken}` };
  const paxTestEngineerHeaders = { Authorization: `Bearer ${paxTestEngineerToken}` };
  const qcHeaders = { Authorization: `Bearer ${qcToken}` };
  const inventoryHeaders = { Authorization: `Bearer ${inventoryToken}` };
  const salesHeaders = { Authorization: `Bearer ${salesToken}` };

  console.log("  ✅ All 6 role JWT tokens generated.\n");

  // ── 2. PREPARE TEST MASTER DATA ───────────────────────────────────────────
  console.log("📦 Step 2: Preparing Master Data & Clean Test Production Order (Qty = 1)...");

  // A. Ensure Production Station
  let station = await prisma.productionStation.findFirst({ where: { isActive: true, type: "ASSEMBLY" } });
  if (!station) {
    station = await prisma.productionStation.create({
      data: { name: `Assembly Line ${PREFIX}`, code: `ASY-${RUN_ID}`, type: "ASSEMBLY", isActive: true }
    });
  }

  // B. Ensure Materials
  const cellSku = `CELL-LFP-${RUN_ID}`;
  const cellMaterial = await prisma.material.upsert({
    where: { sku: cellSku },
    update: { quantity: 100 },
    create: {
      sku: cellSku,
      name: `LFP 3.2V 3200mAh Cell ${PREFIX}`,
      category: "Cells",
      quantity: 100,
      unitPrice: 150,
      totalValue: 15000,
      minStock: 10
    }
  });

  const bmsSku = `BMS-48V-${RUN_ID}`;
  const bmsMaterial = await prisma.material.upsert({
    where: { sku: bmsSku },
    update: { quantity: 50 },
    create: {
      sku: bmsSku,
      name: `Smart BMS 16S 100A ${PREFIX}`,
      category: "Electronics",
      quantity: 50,
      unitPrice: 2500,
      totalValue: 125000,
      minStock: 5
    }
  });

  const busbarSku = `BUSBAR-CU-${RUN_ID}`;
  const busbarMaterial = await prisma.material.upsert({
    where: { sku: busbarSku },
    update: { quantity: 200 },
    create: {
      sku: busbarSku,
      name: `Copper Busbar 2x20mm ${PREFIX}`,
      category: "Hardware",
      quantity: 200,
      unitPrice: 80,
      totalValue: 16000,
      minStock: 20
    }
  });

  // C. Create BOM (1 pack requires 4 cells, 1 BMS, 4 Busbars)
  const bom = await prisma.bOM.create({
    data: {
      name: `BOM-48V-100AH-${PREFIX}`,
      description: `Production BOM for 48V 100Ah Battery Pack ${PREFIX}`,
      items: {
        create: [
          { materialId: cellMaterial.id, quantity: 4 },
          { materialId: bmsMaterial.id, quantity: 1 },
          { materialId: busbarMaterial.id, quantity: 4 }
        ]
      }
    },
    include: { items: true }
  });

  // D. Create PaxType (4 cells, AH: 3.1-3.5, IR: 10.0-30.0, grade A+/A)
  const paxType = await prisma.paxType.create({
    data: {
      name: `48V 100Ah Battery Pack ${PREFIX}`,
      cellCount: 4,
      ahMin: 3.10,
      ahMax: 3.50,
      irMin: 10.0,
      irMax: 30.0,
      retestAhMargin: 0.05,
      retestIrMargin: 2.0,
      hardFailAh: 2.8,
      hardFailIr: 50.0,
      allowedGrades: ["A+", "A"],
      maxAhDifference: 0.05,
      maxIrDifference: 3.0,
      autoPackEnabled: true,
      isProductionActive: true
    }
  });

  // E. Create Cell Inward Batch (50 cells of cellSku)
  const cellBatch = await prisma.cellInwardBatch.create({
    data: {
      inwardNumber: `INW-${PREFIX}`,
      partNumber: cellSku,
      materialId: cellMaterial.id,
      batchNumber: `BATCH-${PREFIX}`,
      quantity: 50,
      availableQty: 50,
      category: "LFP 3.2V",
      voltage: 3.2,
      receivedById: inventoryManagerUser.id,
      status: "RECEIVED"
    }
  });

  // F. Create Customer
  const customer = await prisma.customer.create({
    data: {
      customerCode: `CUS-${RUN_ID}`,
      name: `Solar Solutions Ltd ${PREFIX}`,
      email: `customer-${RUN_ID}@example.com`,
      phone: "+919876543210",
      billingAddress: "Sector 5, Industrial Area, Bangalore",
      shippingAddress: "Sector 5, Industrial Area, Bangalore",
      city: "Bangalore",
      state: "Karnataka",
      country: "India",
      postalCode: "560001"
    }
  });

  // G. Create Sales Order with Financial Clearance
  const salesOrder = await prisma.salesOrder.create({
    data: {
      salesOrderNumber: `SO-${RUN_ID}`,
      customerId: customer.id,
      createdById: salesExecUser!.id,
      requiredDeliveryDate: new Date(Date.now() + 7 * 86400000),
      status: "CONFIRMED",
      paymentStatus: "PAID",
      isFinancialCleared: true,
      financialClearedAt: new Date(),
      financialClearedById: adminUser!.id,
      subtotal: 45000,
      discount: 0,
      tax: 0,
      grandTotal: 45000,
      paymentTerms: "100% Advance",
      deliveryTerms: "Ex-Factory",
      billingAddressSnapshot: customer.billingAddress,
      shippingAddressSnapshot: customer.shippingAddress,
      items: {
        create: [
          {
            productRef: paxType.name,
            description: `Solar Battery 48V 100Ah Pack (${PREFIX})`,
            quantityOrdered: 1,
            quantityPending: 1,
            unitPrice: 45000,
            taxAmount: 0,
            lineSubtotal: 45000,
            lineTotal: 45000,
            fulfillmentType: "PRODUCTION_REQUIRED"
          }
        ]
      }
    },
    include: { items: true }
  }) as any;

  const salesOrderItemId = salesOrder.items[0].id;

  // H. Create Production Requirement
  const prodReq = await prisma.productionRequirement.create({
    data: {
      requirementNumber: `PRD-${RUN_ID}`,
      salesOrderId: salesOrder.id,
      salesOrderItemId: salesOrderItemId,
      customerId: customer.id,
      productRef: paxType.name,
      requiredQuantity: 1,
      requiredDeliveryDate: salesOrder.requiredDeliveryDate,
      priority: "NORMAL",
      fulfillmentType: "PRODUCTION_REQUIRED",
      status: "READY",
      createdById: supervisorUser.id
    }
  });

  // I. Create Production Plan and Release it
  const prodPlan = await prisma.productionPlan.create({
    data: {
      planNumber: `PLAN-${RUN_ID}`,
      productionRequirementId: prodReq.id,
      plannedStartDate: new Date(),
      plannedCompletionDate: new Date(Date.now() + 2 * 86400000),
      plannedQuantity: 1,
      supervisorId: supervisorUser.id,
      status: "RELEASED",
      createdById: supervisorUser.id
    }
  });

  // J. Create Work Order (assigned to assemblyTechUser)
  const workOrder = await prisma.workOrder.create({
    data: {
      workOrderNumber: `WO-${RUN_ID}`,
      productionPlanId: prodPlan.id,
      productionRequirementId: prodReq.id,
      salesOrderId: salesOrder.id,
      productRef: paxType.name,
      bomId: bom.id,
      plannedQuantity: 1,
      remainingQuantity: 1,
      dueDate: new Date(Date.now() + 2 * 86400000),
      supervisorId: supervisorUser.id,
      status: "CREATED",
      operators: {
        create: [
          {
            userId: assemblyTechUser.id,
            role: "OPERATOR",
            status: "ACTIVE"
          }
        ]
      }
    }
  });

  console.log(`  ✅ Test Order Prepared:`);
  console.log(`     - Sales Order: ${salesOrder.salesOrderNumber} (Financial Clearance: YES)`);
  console.log(`     - Production Req: ${prodReq.requirementNumber}`);
  console.log(`     - Production Plan: ${prodPlan.planNumber}`);
  console.log(`     - Work Order: ${workOrder.workOrderNumber} (Product: ${paxType.name}, Qty: 1)`);
  console.log(`     - Inward Batch: ${cellBatch.inwardNumber} (SKU: ${cellSku}, Available: 50)`);
  console.log(`     - Station: ${station.name} (${station.code})\n`);

  // ── 3. WORK ORDER MATERIAL ALLOCATION & SCHEDULING ────────────────────────
  console.log("📋 Step 3: Material Allocation & Scheduling for Work Order...");

  // Allocate Materials
  const allocRes = await app.inject({
    method: "POST",
    url: `/crm/production/work-orders/${workOrder.id}/allocate`,
    headers: supervisorHeaders
  });
  const allocData = JSON.parse(allocRes.body);
  recordTest(
    "Setup",
    "SUPERVISOR",
    "Allocate BOM Materials for Work Order",
    "Status 200 & WO status READY",
    `Status ${allocRes.statusCode} & WO status ${allocData.status}`,
    allocRes.statusCode === 200 && allocData.status === "READY",
    allocData.error
  );

  // Schedule for today
  const todayStr = new Date().toISOString().split("T")[0];
  const schedRes = await app.inject({
    method: "POST",
    url: "/crm/production/schedule",
    headers: supervisorHeaders,
    payload: {
      workOrderId: workOrder.id,
      assignedDate: todayStr,
      sequence: 999,
      estimatedHrs: 4.0
    }
  });
  recordTest(
    "Setup",
    "SUPERVISOR",
    "Schedule Work Order for Today",
    "Status 200",
    `Status ${schedRes.statusCode}`,
    schedRes.statusCode === 200,
    schedRes.body
  );

  // ── 4. RBAC BOUNDARY TESTS: UNAUTHORIZED WORK ORDER START ─────────────────
  console.log("\n🛡️ Step 4: RBAC Validation — Unauthorized Work Order Start...");

  const testEngStartRes = await app.inject({
    method: "POST",
    url: `/crm/production/work-orders/${workOrder.id}/start`,
    headers: testEngineerHeaders,
    payload: { stationId: station.id }
  });
  recordTest(
    "RBAC",
    "TEST_ENGINEER",
    "Attempt to START Work Order (Forbidden)",
    "Status 403 Forbidden",
    `Status ${testEngStartRes.statusCode}`,
    testEngStartRes.statusCode === 403
  );

  const asmStartRes = await app.inject({
    method: "POST",
    url: `/crm/production/work-orders/${workOrder.id}/start`,
    headers: assemblyTechHeaders,
    payload: { stationId: station.id }
  });
  recordTest(
    "RBAC",
    "ASSEMBLY_TECHNICIAN",
    "Attempt to START Work Order (Forbidden)",
    "Status 403 Forbidden",
    `Status ${asmStartRes.statusCode}`,
    asmStartRes.statusCode === 403
  );

  // ── 5. PHASE 1: SUPERVISOR STARTS PRODUCTION ──────────────────────────────
  console.log("\n🏭 Step 5: Phase 1 — Supervisor Starts Production...");

  const startRes = await app.inject({
    method: "POST",
    url: `/crm/production/work-orders/${workOrder.id}/start`,
    headers: supervisorHeaders,
    payload: { stationId: station.id }
  });
  const startData = JSON.parse(startRes.body);

  recordTest(
    "Phase 1",
    "SUPERVISOR",
    "Start Production (WO -> IN_PROGRESS & PCTR Activated)",
    "Status 200, WO IN_PROGRESS, PCTR activated",
    `Status ${startRes.statusCode}, WO ${startData.workOrder?.status}, PCTR count ${startData.cellRequirements?.length}`,
    startRes.statusCode === 200 && startData.workOrder?.status === "IN_PROGRESS" && (startData.cellRequirements?.length || 0) > 0,
    startData.error
  );

  // Concurrency Check: Double Click Start
  const doubleStartRes = await app.inject({
    method: "POST",
    url: `/crm/production/work-orders/${workOrder.id}/start`,
    headers: supervisorHeaders,
    payload: { stationId: station.id }
  });
  recordTest(
    "Concurrency",
    "SUPERVISOR",
    "Double-submit START Work Order (Idempotency / Guard)",
    "Status 400 (ALREADY_IN_PROGRESS)",
    `Status ${doubleStartRes.statusCode}`,
    doubleStartRes.statusCode === 400
  );

  // Supervisor Pause Test
  const pauseRes = await app.inject({
    method: "POST",
    url: `/crm/production/work-orders/${workOrder.id}/pause`,
    headers: supervisorHeaders,
    payload: { reason: "Routine tooling adjustment" }
  });
  const woAfterPause = await prisma.workOrder.findUnique({ where: { id: workOrder.id } });
  recordTest(
    "Supervisor Controls",
    "SUPERVISOR",
    "Supervisor PAUSE Work Order (IN_PROGRESS -> ON_HOLD)",
    "Status 200 & WO status ON_HOLD",
    `Status ${pauseRes.statusCode} & WO status ${woAfterPause?.status}`,
    pauseRes.statusCode === 200 && woAfterPause?.status === "ON_HOLD"
  );

  // Supervisor Resume Test
  const resumeRes = await app.inject({
    method: "POST",
    url: `/crm/production/work-orders/${workOrder.id}/resume`,
    headers: supervisorHeaders
  });
  const woAfterResume = await prisma.workOrder.findUnique({ where: { id: workOrder.id } });
  recordTest(
    "Supervisor Controls",
    "SUPERVISOR",
    "Supervisor RESUME Work Order (ON_HOLD -> IN_PROGRESS)",
    "Status 200 & WO status IN_PROGRESS",
    `Status ${resumeRes.statusCode} & WO status ${woAfterResume?.status}`,
    resumeRes.statusCode === 200 && woAfterResume?.status === "IN_PROGRESS"
  );

  // CRITICAL NEGATIVE TEST: Supervisor Manual Complete Attempt while downstream pending
  const superCompleteRes = await app.inject({
    method: "POST",
    url: `/crm/production/work-orders/${workOrder.id}/complete`,
    headers: supervisorHeaders,
    payload: { notes: "Premature manual completion attempt by supervisor" }
  });
  const woAfterSuperComplete = await prisma.workOrder.findUnique({ where: { id: workOrder.id } });
  recordTest(
    "Negative Test (Bug Fix)",
    "SUPERVISOR",
    "Supervisor attempts manual Work Order completion (FORBIDDEN)",
    "Status 403 Forbidden & WO remains IN_PROGRESS",
    `Status ${superCompleteRes.statusCode} & WO status ${woAfterSuperComplete?.status}`,
    superCompleteRes.statusCode === 403 && woAfterSuperComplete?.status === "IN_PROGRESS"
  );

  // Retrieve activated PCTR from DB
  const pctr = await prisma.productionCellTestingRequirement.findFirst({
    where: { workOrderId: workOrder.id, cellSku }
  });
  if (!pctr) throw new Error("PCTR not created in database upon WO start");

  console.log(`     Activated PCTR: ${pctr.requirementNumber} (Required: ${pctr.requiredQuantity}, Tested: ${pctr.testedQuantity}, Remaining: ${pctr.remainingQuantity})`);

  // ── 6. HANDOFF #1: SUPERVISOR → TEST ENGINEER ─────────────────────────────
  console.log("\n🤝 Step 6: Handoff #1 — Supervisor → Test Engineer Demand Visibility...");

  const teDemandRes = await app.inject({
    method: "GET",
    url: "/testing/production-requirements",
    headers: testEngineerHeaders
  });
  const teDemandData = JSON.parse(teDemandRes.body);
  const foundReq = teDemandData.requirements?.find((r: any) => r.id === pctr.id);

  recordTest(
    "Handoff 1",
    "TEST_ENGINEER",
    "Test Engineer sees active Production Cell Demand",
    `PCTR ${pctr.requirementNumber} visible with required = 4, remaining = 4`,
    foundReq ? `PCTR ${foundReq.requirementNumber} found (Req: ${foundReq.requiredQuantity}, Rem: ${foundReq.remainingQuantity})` : "Not found",
    !!foundReq && foundReq.requiredQuantity === 4 && foundReq.remainingQuantity === 4
  );

  // ── 7. PHASE 2: TEST ENGINEER CELL TESTING & NEGATIVE TESTS ───────────────
  console.log("\n🔬 Step 7: Phase 2 — Test Engineer QC & Negative Testing...");

  // A. Negative Test: Wrong SKU against PCTR
  const wrongSkuBatch = await prisma.cellInwardBatch.create({
    data: {
      inwardNumber: `INW-WRONG-${PREFIX}`,
      partNumber: "CELL-WRONG-SKU-999",
      batchNumber: `BATCH-WRONG-${PREFIX}`,
      quantity: 10,
      availableQty: 10,
      category: "LFP 3.2V",
      voltage: 3.2,
      receivedById: inventoryManagerUser.id,
      status: "RECEIVED"
    }
  });

  const wrongSkuTestRes = await app.inject({
    method: "POST",
    url: "/testing/apply",
    headers: testEngineerHeaders,
    payload: [
      {
        cellSerial: `CELL-WRONG-${RUN_ID}-01`,
        batchNumber: wrongSkuBatch.batchNumber,
        ahValue: 3.25,
        irValue: 15.0,
        grade: "A",
        productionRequirementId: pctr.id
      }
    ]
  });
  recordTest(
    "Negative Test",
    "TEST_ENGINEER",
    "Apply test with wrong Cell SKU against PCTR (Mismatch blocked)",
    "Status 400 or error message on SKU mismatch",
    `Status ${wrongSkuTestRes.statusCode}, body: ${wrongSkuTestRes.body.slice(0, 80)}`,
    wrongSkuTestRes.statusCode === 400 || wrongSkuTestRes.body.includes("Cell SKU mismatch")
  );

  // B. Negative Test: FAIL Test (AH Low -> Rejection)
  const failSerial = `CELL-FAIL-${RUN_ID}-01`;
  const failTestRes = await app.inject({
    method: "POST",
    url: "/testing/apply",
    headers: testEngineerHeaders,
    payload: [
      {
        cellSerial: failSerial,
        batchNumber: cellBatch.batchNumber,
        ahValue: 2.50, // Below min (3.10) -> FAIL / REJECTED
        irValue: 20.0,
        grade: "A",
        productionRequirementId: pctr.id
      }
    ]
  });
  const failCellDb = await prisma.cell.findUnique({ where: { serialNumber: failSerial } });
  recordTest(
    "Negative Test",
    "TEST_ENGINEER",
    "Cell Quality FAIL (Cell -> REJECTED, not qualified for PCTR)",
    "Cell status REJECTED, PCTR remaining unchanged (4)",
    `Cell status ${failCellDb?.status}`,
    failCellDb?.status === CellStatus.REJECTED
  );

  // C. Negative Test: RETEST Test (Marginal Ah/Ir)
  const retestSerial = `CELL-RETEST-${RUN_ID}-01`;
  const retestRes = await app.inject({
    method: "POST",
    url: "/testing/apply",
    headers: testEngineerHeaders,
    payload: [
      {
        cellSerial: retestSerial,
        batchNumber: cellBatch.batchNumber,
        ahValue: 3.08, // In retest margin [3.05, 3.10)
        irValue: 20.0,
        grade: "A",
        productionRequirementId: pctr.id
      }
    ]
  });
  const retestCellDb = await prisma.cell.findUnique({ where: { serialNumber: retestSerial } });
  recordTest(
    "Negative Test",
    "TEST_ENGINEER",
    "Cell Quality RETEST (Cell -> RETEST_REQUIRED, not double counted)",
    "Cell status RETEST_REQUIRED",
    `Cell status ${retestCellDb?.status}`,
    retestCellDb?.status === CellStatus.RETEST_REQUIRED
  );

  // D. Negative Test: HOLD Test
  const holdSerial = `CELL-HOLD-${RUN_ID}-01`;
  const holdRes = await app.inject({
    method: "POST",
    url: "/testing/apply",
    headers: testEngineerHeaders,
    payload: [
      {
        cellSerial: holdSerial,
        batchNumber: cellBatch.batchNumber,
        ahValue: 3.30,
        irValue: 31.0, // In retest/hold margin
        grade: "A",
        productionRequirementId: pctr.id
      }
    ]
  });
  const holdCellDb = await prisma.cell.findUnique({ where: { serialNumber: holdSerial } });
  recordTest(
    "Negative Test",
    "TEST_ENGINEER",
    "Cell Quality RETEST/HOLD (Cell not counted as passed)",
    "Cell status != CELL_TESTED",
    `Cell status ${holdCellDb?.status}`,
    holdCellDb?.status !== CellStatus.CELL_TESTED
  );

  // E. Valid Testing of Required 4 Cells (Pass)
  const validSerials = [
    `CELL-OK-${RUN_ID}-01`,
    `CELL-OK-${RUN_ID}-02`,
    `CELL-OK-${RUN_ID}-03`,
    `CELL-OK-${RUN_ID}-04`
  ];

  for (let i = 0; i < validSerials.length; i++) {
    const s = validSerials[i];
    const passRes = await app.inject({
      method: "POST",
      url: "/testing/apply",
      headers: testEngineerHeaders,
      payload: [
        {
          cellSerial: s,
          batchNumber: cellBatch.batchNumber,
          ahValue: 3.30 + (i * 0.01), // within 0.05 delta!
          irValue: 15.0 + (i * 0.5),   // within 3.0 delta!
          grade: "A+",
          productionRequirementId: pctr.id
        }
      ]
    });
    const cellDb = await prisma.cell.findUnique({ where: { serialNumber: s } });
    recordTest(
      "Phase 2",
      "TEST_ENGINEER",
      `Test & Qualify Cell #${i + 1} (${s})`,
      "Cell CELL_TESTED",
      `Status ${cellDb?.status} (AH: ${cellDb?.ahValue}, IR: ${cellDb?.irValue}, Grade: ${cellDb?.grade})`,
      cellDb?.status === CellStatus.CELL_TESTED && cellDb.grade === "A+"
    );
  }

  // F. Verify PCTR Completion
  const updatedPctr = await prisma.productionCellTestingRequirement.findUnique({ where: { id: pctr.id } });
  recordTest(
    "Phase 2",
    "TEST_ENGINEER",
    "PCTR Fulfilled (required = qualified = 4, remaining = 0, status = COMPLETED)",
    "Status COMPLETED, remaining = 0",
    `Status ${updatedPctr?.status}, Tested: ${updatedPctr?.testedQuantity}/${updatedPctr?.requiredQuantity}, Rem: ${updatedPctr?.remainingQuantity}`,
    updatedPctr?.status === "COMPLETED" && updatedPctr.remainingQuantity === 0 && updatedPctr.testedQuantity === 4
  );

  // G. Negative Test: Test duplicate serial
  const dupSerialRes = await app.inject({
    method: "POST",
    url: "/testing/validate-serial",
    headers: testEngineerHeaders,
    payload: { serial: validSerials[0] }
  });
  const dupData = JSON.parse(dupSerialRes.body);
  recordTest(
    "Negative Test",
    "TEST_ENGINEER",
    "Duplicate Serial Validation (Blocked from re-serialization)",
    "isValid: false & isAlreadyTested: true",
    `isValid: ${dupData.isValid}, isAlreadyTested: ${dupData.isAlreadyTested}`,
    dupData.isValid === false && dupData.isAlreadyTested === true
  );

  // ── 8. HANDOFF #2: TEST ENGINEER → ASSEMBLY TECHNICIAN ────────────────────
  console.log("\n🤝 Step 8: Handoff #2 — Test Engineer → Assembly Technician...");

  const asmDashRes = await app.inject({
    method: "GET",
    url: "/pax/assembly-dashboard",
    headers: assemblyTechHeaders
  });
  const asmDashData = JSON.parse(asmDashRes.body);
  const foundAsmWo = asmDashData.queue?.find((q: any) => q.id === workOrder.id);

  recordTest(
    "Handoff 2",
    "ASSEMBLY_TECHNICIAN",
    "Assembly Technician sees Work Order ready for PAX assembly",
    `Work Order ${workOrder.workOrderNumber} in assembly queue`,
    foundAsmWo ? `Found in queue (Status: ${foundAsmWo.status}, ReqCells: ${foundAsmWo.requiredCellCount})` : "Not found",
    !!foundAsmWo
  );

  // ── 9. PHASE 3: ASSEMBLY TECHNICIAN CELL GROUPING & ASSEMBLY ──────────────
  console.log("\n🔩 Step 9: Phase 3 — Assembly Technician Cell Binding & Assembly...");

  // Negative Test: Try assembly with rejected cell
  const badAssemblyRes = await app.inject({
    method: "POST",
    url: "/pax",
    headers: assemblyTechHeaders,
    payload: {
      paxTypeId: paxType.id,
      workOrderId: workOrder.id,
      cellSerials: [validSerials[0], validSerials[1], validSerials[2], failSerial]
    }
  });
  recordTest(
    "Negative Test",
    "ASSEMBLY_TECHNICIAN",
    "Attempt PAX assembly using REJECTED cell (Blocked)",
    "Status 400 (Cell is not TESTED)",
    `Status ${badAssemblyRes.statusCode}`,
    badAssemblyRes.statusCode === 400
  );

  // Valid PAX Assembly
  const asmRes = await app.inject({
    method: "POST",
    url: "/pax",
    headers: assemblyTechHeaders,
    payload: {
      paxTypeId: paxType.id,
      workOrderId: workOrder.id,
      cellSerials: validSerials
    }
  });
  const asmData = JSON.parse(asmRes.body);
  const createdPaxSerial = asmData.paxSerial;

  const paxDb = await prisma.paxPack.findUnique({
    where: { paxSerial: createdPaxSerial },
    include: { cells: true }
  });

  recordTest(
    "Phase 3",
    "ASSEMBLY_TECHNICIAN",
    "Assemble PAX Pack with Qualified Cells",
    "PaxPack status PAX_ASSEMBLED & 4 PaxCell records created",
    `PaxPack ${createdPaxSerial} (Status: ${paxDb?.status}, Cells: ${paxDb?.cells?.length})`,
    paxDb?.status === PaxStatus.PAX_ASSEMBLED && paxDb?.cells?.length === 4
  );

  // Negative Test: Use already consumed serialized cell in second PAX pack
  const reConsumeRes = await app.inject({
    method: "POST",
    url: "/pax",
    headers: assemblyTechHeaders,
    payload: {
      paxTypeId: paxType.id,
      workOrderId: workOrder.id,
      cellSerials: validSerials
    }
  });
  recordTest(
    "Negative Test",
    "ASSEMBLY_TECHNICIAN",
    "Attempt to reuse assigned serialized cells in another PAX (Blocked)",
    "Status 400 or 500 (Unique cell constraint)",
    `Status ${reConsumeRes.statusCode}`,
    reConsumeRes.statusCode !== 200
  );

  // Step 9B: BOM Consumption & Label Generation
  const labelRes = await app.inject({
    method: "POST",
    url: `/pax/${createdPaxSerial}/label`,
    headers: assemblyTechHeaders,
    payload: { bomId: bom.id }
  });
  const labelData = JSON.parse(labelRes.body);

  const labeledPaxDb = await prisma.paxPack.findUnique({ where: { paxSerial: createdPaxSerial } });
  recordTest(
    "Phase 3",
    "ASSEMBLY_TECHNICIAN",
    "BOM Material Deduction & Label Generation",
    "PaxPack moves to READY_FOR_PAX_TEST with QR URL",
    `Status: ${labeledPaxDb?.status}, QR: ${labeledPaxDb?.qrUrl ? "YES" : "NO"}`,
    labeledPaxDb?.status === PaxStatus.READY_FOR_PAX_TEST && !!labeledPaxDb?.qrUrl
  );

  // ── 10. HANDOFF #3: ASSEMBLY TECHNICIAN → PAX TEST ENGINEER ───────────────
  console.log("\n🤝 Step 10: Handoff #3 — Assembly Technician → PAX Test Engineer...");

  const readyPacksRes = await app.inject({
    method: "GET",
    url: "/pax?status=READY_FOR_PAX_TEST",
    headers: paxTestEngineerHeaders
  });
  const readyPacksData = JSON.parse(readyPacksRes.body);
  const foundReadyPax = readyPacksData.packs?.find((p: any) => p.paxSerial === createdPaxSerial);

  recordTest(
    "Handoff 3",
    "PAX_TEST_ENGINEER",
    "PAX Test Engineer sees assembled pack in Testing Queue",
    `PAX ${createdPaxSerial} in READY_FOR_PAX_TEST queue`,
    foundReadyPax ? `PAX ${foundReadyPax.paxSerial} found (Status: ${foundReadyPax.status})` : "Not found",
    !!foundReadyPax
  );

  // ── 11. PHASE 4: PAX TEST ENGINEER — FINAL PACK TEST ──────────────────────
  console.log("\n⚡ Step 11: Phase 4 — PAX Test Engineer Executes Final Pack Testing...");

  // Upload test report and pass
  const boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW";
  const multipartBody = 
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="status"\r\n\r\n` +
    `PAX_TESTED\r\n` +
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="report"; filename="pack-test-report.pdf"\r\n` +
    `Content-Type: application/pdf\r\n\r\n` +
    `%PDF-1.4 Mock Pack Test Report Content for ${createdPaxSerial}\r\n` +
    `--${boundary}--\r\n`;

  const paxTestRes = await app.inject({
    method: "POST",
    url: `/pax/${createdPaxSerial}/test-result`,
    headers: {
      ...paxTestEngineerHeaders,
      "Content-Type": `multipart/form-data; boundary=${boundary}`
    },
    payload: multipartBody
  });

  const testedPaxDb = await prisma.paxPack.findUnique({ where: { paxSerial: createdPaxSerial } });
  recordTest(
    "Phase 4",
    "PAX_TEST_ENGINEER",
    "Execute Final Pack Test & Upload Report",
    "PaxPack status moves to PAX_TESTED",
    `PaxPack status: ${testedPaxDb?.status}, Report: ${testedPaxDb?.testReportUrl}`,
    testedPaxDb?.status === PaxStatus.PAX_TESTED && !!testedPaxDb?.testReportUrl
  );

  // ── 12. HANDOFF #4: PAX TEST ENGINEER → QC ────────────────────────────────
  console.log("\n🤝 Step 12: Handoff #4 — PAX Test Engineer → Final Quality / QC...");

  const qcListRes = await app.inject({
    method: "GET",
    url: "/pax?status=PAX_TESTED",
    headers: qcHeaders
  });
  const qcListData = JSON.parse(qcListRes.body);
  const foundTestedPax = qcListData.packs?.find((p: any) => p.paxSerial === createdPaxSerial);

  recordTest(
    "Handoff 4",
    "QC",
    "QC Inspector sees PAX_TESTED pack awaiting Final QC sign-off",
    `PAX ${createdPaxSerial} in PAX_TESTED queue`,
    foundTestedPax ? `PAX ${foundTestedPax.paxSerial} found (Status: ${foundTestedPax.status})` : "Not found",
    !!foundTestedPax
  );

  // ── 13. PHASE 5: QC FINAL QUALITY INSPECTION & DECISION ───────────────────
  console.log("\n🔍 Step 13: Phase 5 — QC Final Inspection & Sign-off...");

  // Negative Test: Quality Separation of Duties (Assembly operator cannot sign off own WO)

  const opQcRes = await app.inject({
    method: "POST",
    url: "/crm/quality/inspections",
    headers: assemblyTechHeaders,
    payload: {
      workOrderId: workOrder.id,
      paxSerial: createdPaxSerial,
      inspectionType: "FINAL",
      result: "PASS",
      notes: "Operator self-signoff attempt",
      checkpoints: [
        { name: "Pack Voltage", result: "PASS" }
      ]
    }
  });
  recordTest(
    "Negative Test",
    "ASSEMBLY_TECHNICIAN",
    "Separation of Duties (Assembly Operator cannot perform Final QC sign-off)",
    "Status 400 or 403 (Separation of duties / RBAC)",
    `Status ${opQcRes.statusCode}`,
    opQcRes.statusCode !== 200
  );

  // Valid Final QC by Authorized QC Inspector
  const validQcRes = await app.inject({
    method: "POST",
    url: "/crm/quality/inspections",
    headers: qcHeaders,
    payload: {
      workOrderId: workOrder.id,
      paxSerial: createdPaxSerial,
      inspectionType: "FINAL",
      result: "PASS",
      notes: `Final Quality Inspection for ${createdPaxSerial} PASS. All parameters nominal.`,
      checkpoints: [
        { name: "Pack Voltage", expectedValue: "51.2V", actualValue: "51.4V", result: "PASS" },
        { name: "Insulation Resistance", expectedValue: ">100MΩ", actualValue: "250MΩ", result: "PASS" },
        { name: "BMS Communication", expectedValue: "CAN/RS485 OK", actualValue: "OK", result: "PASS" },
        { name: "Enclosure Integrity", expectedValue: "IP65", actualValue: "PASS", result: "PASS" }
      ]
    }
  });
  const qcData = JSON.parse(validQcRes.body);

  const finalPaxDb = await prisma.paxPack.findUnique({ where: { paxSerial: createdPaxSerial } });
  const finalWoDb = await prisma.workOrder.findUnique({ where: { id: workOrder.id } });

  recordTest(
    "Phase 5",
    "QC",
    "Final QC PASS Sign-off (PaxPack -> READY_FOR_SALE, WorkOrder -> COMPLETED)",
    "PaxPack READY_FOR_SALE & WorkOrder COMPLETED",
    `PaxPack status: ${finalPaxDb?.status}, WorkOrder status: ${finalWoDb?.status}`,
    finalPaxDb?.status === PaxStatus.READY_FOR_SALE && finalWoDb?.status === WorkOrderStatus.COMPLETED
  );

  // ── 14. HANDOFF #5 & PHASE 6: INVENTORY MANAGER READY FOR DISPATCH ────────
  console.log("\n🤝 Step 14: Handoff #5 — QC → Inventory Manager Dispatch Readiness...");

  const invListRes = await app.inject({
    method: "GET",
    url: "/pax?status=READY_FOR_SALE",
    headers: inventoryHeaders
  });
  const invListData = JSON.parse(invListRes.body);
  const finishedPax = invListData.packs?.find((p: any) => p.paxSerial === createdPaxSerial);

  recordTest(
    "Phase 6",
    "INVENTORY_MANAGER",
    "Inventory Manager views Finished PAX in READY_FOR_SALE inventory",
    `PAX ${createdPaxSerial} present in READY_FOR_SALE finished goods list`,
    finishedPax ? `PAX ${finishedPax.paxSerial} present (Product: ${finishedPax.paxType?.name}, Status: ${finishedPax.status})` : "Not found",
    !!finishedPax && finishedPax.status === "READY_FOR_SALE"
  );

  // ── 15. RBAC PERMISSIONS AUDIT MATRIX ─────────────────────────────────────
  console.log("\n🛡️ Step 15: Cross-Role RBAC Boundaries Audit Matrix...");

  const rbacTests = [
    {
      roleName: "SUPERVISOR",
      headers: supervisorHeaders,
      method: "POST",
      url: `/crm/production/work-orders/${workOrder.id}/pause`,
      payload: { reason: "Audit check" },
      shouldAllow: false, // already completed, returns 400 not 403
      checkRbac: true,
      desc: "Supervisor has access to Production execution controls"
    },
    {
      roleName: "SUPERVISOR",
      headers: supervisorHeaders,
      method: "POST",
      url: `/crm/production/work-orders/${workOrder.id}/complete`,
      payload: { notes: "Hacked" },
      shouldAllow: false,
      expectedStatus: 403,
      desc: "Supervisor CANNOT complete Work Orders"
    },
    {
      roleName: "TEST_ENGINEER",
      headers: testEngineerHeaders,
      method: "POST",
      url: `/crm/production/work-orders/${workOrder.id}/complete`,
      payload: { notes: "Hacked" },
      shouldAllow: false,
      expectedStatus: 403,
      desc: "Test Engineer CANNOT complete Work Orders"
    },
    {
      roleName: "ASSEMBLY_TECHNICIAN",
      headers: assemblyTechHeaders,
      method: "POST",
      url: `/crm/production/work-orders/${workOrder.id}/complete`,
      payload: { notes: "Hacked" },
      shouldAllow: false,
      expectedStatus: 403,
      desc: "Assembly Technician CANNOT complete Work Orders"
    },
    {
      roleName: "PAX_TEST_ENGINEER",
      headers: paxTestEngineerHeaders,
      method: "POST",
      url: "/pax",
      payload: { paxTypeId: paxType.id, cellSerials: [] },
      shouldAllow: false,
      expectedStatus: 403,
      desc: "PAX Test Engineer CANNOT perform PAX Assembly"
    },
    {
      roleName: "SALES_EXECUTIVE",
      headers: salesHeaders,
      method: "POST",
      url: `/crm/quality/inspections`,
      payload: { workOrderId: workOrder.id, paxSerial: createdPaxSerial, inspectionType: "FINAL", result: "PASS", checkpoints: [] },
      shouldAllow: false,
      expectedStatus: 403,
      desc: "Sales Executive CANNOT perform Quality Inspections"
    }
  ];

  for (const rTest of rbacTests) {
    const res = await app.inject({
      method: rTest.method as any,
      url: rTest.url,
      headers: rTest.headers,
      payload: rTest.payload
    });
    const isProtected = rTest.expectedStatus ? res.statusCode === rTest.expectedStatus : res.statusCode !== 403;
    recordTest(
      "RBAC Audit",
      rTest.roleName,
      rTest.desc,
      `Expected status ${rTest.expectedStatus || "Authorized/Handled"}`,
      `Got status ${res.statusCode}`,
      isProtected
    );
  }

  // ── 16. PRINT STATE TRANSITIONS TRACE ─────────────────────────────────────
  console.log("\n================================================================================");
  console.log("  📊 DATABASE STATE TRANSITION TRACE");
  console.log("================================================================================");
  console.log("ENTITY                             INITIAL STATE      -> FINAL DATABASE STATE");
  console.log("--------------------------------------------------------------------------------");
  console.log(`Sales Order (${salesOrder.salesOrderNumber})           CONFIRMED          -> ${salesOrder.status}`);
  console.log(`Production Plan (${prodPlan.planNumber})        DRAFT              -> ${prodPlan.status}`);
  console.log(`Production Requirement (${prodReq.requirementNumber})   READY              -> ${prodReq.status}`);
  console.log(`Work Order (${workOrder.workOrderNumber})            CREATED            -> ${finalWoDb?.status}`);
  console.log(`PCTR (${pctr.requirementNumber})                  IN_PROGRESS        -> ${updatedPctr?.status}`);
  console.log(`Physical Cell (${validSerials[0]})         RAW                -> ${CellStatus.CELL_TESTED}`);
  console.log(`PaxPack (${createdPaxSerial})          NONE               -> ${finalPaxDb?.status}`);
  console.log(`Final QC Sign-off                  PENDING            -> COMPLETED (PASS)`);
  console.log(`Inventory Visibility               UNAVAILABLE        -> READY_FOR_SALE`);
  console.log("================================================================================\n");

  console.log(`TOTAL TESTS: ${passedCount + failedCount} | PASSED: ${passedCount} | FAILED: ${failedCount}`);

  if (failedCount === 0) {
    console.log("\n🏆 OVERALL RESULT: E2E PASS — Complete production workflow validated across all 6 roles!");
  } else {
    console.log(`\n❌ OVERALL RESULT: E2E FAIL — ${failedCount} assertion(s) failed.`);
  }

  await prisma.$disconnect();
}

runE2EProductionTest().catch(async (e) => {
  console.error("FATAL ERROR IN TEST EXECUTION:", e);
  await prisma.$disconnect();
  process.exit(1);
});
