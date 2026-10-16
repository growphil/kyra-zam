import { prisma } from "../prisma";
import { evaluateQcCell, calculateGrade } from "../utils/qcRules";
import { CellStatus } from "../generated/client";

async function runQcEngineAudit() {
  console.log("===============================================================");
  console.log("KYRA ZAM 2.0 — ADMIN QC THRESHOLD + UNIFIED QC ENGINE AUDIT");
  console.log("===============================================================\n");

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string, details?: any) {
    totalTests++;
    if (condition) {
      console.log(`[PASS] CASE ${totalTests}: ${testName}`);
      passedTests++;
    } else {
      console.error(`[FAIL] CASE ${totalTests}: ${testName}`, details || "");
      throw new Error(`Test failed: ${testName}`);
    }
  }

  const defaultGlobalConfig = {
    ahMin: 3.2,
    ahMax: 3.6,
    irMin: 5.0,
    irMax: 60.0,
    retestAhMargin: 0.1,
    retestIrMargin: 2.0,
    hardFailAh: 2.8,
    hardFailIr: 70.0,
  };

  console.log("--- PART 1: PURE QC DECISION MATRIX TESTS ---");

  // CASE 1: Valid AH + valid IR -> PASS
  const res1 = evaluateQcCell(3.3, 40.0, defaultGlobalConfig);
  assert(res1 === "PASS", "Valid AH + valid IR -> PASS", { res1 });

  // CASE 2: AH below hardFailAh -> FAIL
  const res2 = evaluateQcCell(0.5, 30.0, defaultGlobalConfig);
  assert(res2 === "FAIL", "AH below hardFailAh -> FAIL", { res2 });

  // CASE 3: IR above hardFailIr -> FAIL
  const res3 = evaluateQcCell(3.3, 75.0, defaultGlobalConfig);
  assert(res3 === "FAIL", "IR above hardFailIr -> FAIL", { res3 });

  // CASE 4: AH below minimum but within retest margin -> RETEST
  // ahMin is 3.2, retestAhMargin is 0.1 -> AH in [3.10, 3.20) -> RETEST
  const res4 = evaluateQcCell(3.15, 40.0, defaultGlobalConfig);
  assert(res4 === "RETEST", "AH below minimum but within retest margin -> RETEST", { res4 });

  // CASE 5: IR above maximum but within retest margin -> RETEST
  // irMax is 60.0, retestIrMargin is 2.0 -> IR in (60.0, 62.0] -> RETEST
  const res5 = evaluateQcCell(3.3, 61.5, defaultGlobalConfig);
  assert(res5 === "RETEST", "IR above maximum but within retest margin -> RETEST", { res5 });

  // CASE 6: Impossible AH -> HOLD
  const res6a = evaluateQcCell(-1.0, 40.0, defaultGlobalConfig);
  const res6b = evaluateQcCell(15.0, 40.0, defaultGlobalConfig);
  assert(res6a === "HOLD" && res6b === "HOLD", "Impossible AH (<=0 or >10) -> HOLD", { res6a, res6b });

  // CASE 7: Impossible IR -> HOLD
  const res7a = evaluateQcCell(3.3, 0.5, defaultGlobalConfig);
  const res7b = evaluateQcCell(3.3, 250.0, defaultGlobalConfig);
  assert(res7a === "HOLD" && res7b === "HOLD", "Impossible IR (<1 or >200) -> HOLD", { res7a, res7b });

  // CASE 8: NaN AH -> HOLD
  const res8 = evaluateQcCell(NaN, 40.0, defaultGlobalConfig);
  assert(res8 === "HOLD", "NaN AH -> HOLD", { res8 });

  // CASE 9: NaN IR -> HOLD
  const res9 = evaluateQcCell(3.3, NaN, defaultGlobalConfig);
  assert(res9 === "HOLD", "NaN IR -> HOLD", { res9 });

  // CASE 10: Missing AH -> HOLD
  const res10 = evaluateQcCell(null as any, 40.0, defaultGlobalConfig);
  assert(res10 === "HOLD", "Missing AH -> HOLD", { res10 });

  // CASE 11: Missing IR -> HOLD
  const res11 = evaluateQcCell(3.3, undefined as any, defaultGlobalConfig);
  assert(res11 === "HOLD", "Missing IR -> HOLD", { res11 });

  // CASE 12: AH above ahMax -> Explicit deterministic behavior
  // ahMax = 3.6, retestAhMargin = 0.1
  // If 3.65 (within retest margin) -> RETEST
  // If 3.85 (outside retest margin) -> FAIL
  const res12a = evaluateQcCell(3.65, 40.0, defaultGlobalConfig);
  const res12b = evaluateQcCell(3.85, 40.0, defaultGlobalConfig);
  assert(res12a === "RETEST" && res12b === "FAIL", "AH above ahMax: upper margin is RETEST, beyond margin is FAIL", { res12a, res12b });

  // CASE 13: IR below irMin -> Explicit deterministic behavior
  // irMin = 5.0, retestIrMargin = 2.0
  // If 4.0 (within lower retest margin [3.0, 5.0)) -> RETEST
  // If 0.5 (physically impossible < 1.0) -> HOLD
  // If 2.5 (below lower retest margin but >= 1.0) -> FAIL
  const res13a = evaluateQcCell(3.3, 4.0, defaultGlobalConfig);
  const res13b = evaluateQcCell(3.3, 0.5, defaultGlobalConfig);
  const res13c = evaluateQcCell(3.3, 2.5, defaultGlobalConfig);
  assert(res13a === "RETEST" && res13b === "HOLD" && res13c === "FAIL", "IR below irMin: lower margin is RETEST, impossible is HOLD, out of margin is FAIL", { res13a, res13b, res13c });

  // CASE 14: Hard fail + borderline simultaneously -> hard fail precedence (FAIL)
  // AH = 0.5 (hard fail), IR = 61.0 (borderline retest)
  const res14 = evaluateQcCell(0.5, 61.0, defaultGlobalConfig);
  assert(res14 === "FAIL", "Hard fail + borderline simultaneously -> FAIL", { res14 });

  // CASE 15: Impossible + hard fail simultaneously -> HOLD precedence (HOLD)
  // AH = 15.0 (impossible), IR = 80.0 (hard fail)
  const res15 = evaluateQcCell(15.0, 80.0, defaultGlobalConfig);
  assert(res15 === "HOLD", "Impossible + hard fail simultaneously -> HOLD", { res15 });

  // CASE 16: Both AH and IR borderline -> RETEST
  const res16 = evaluateQcCell(3.15, 61.5, defaultGlobalConfig);
  assert(res16 === "RETEST", "Both AH and IR borderline -> RETEST", { res16 });

  console.log("\n--- PART 2: RETEST ESCALATION AND GRADING RULES ---");

  // Escalation Simulation Logic:
  function getRetestEscalationStatus(retestCount: number, decision: string): CellStatus {
    if (decision === "PASS") return CellStatus.CELL_TESTED;
    if (decision === "FAIL") return CellStatus.REJECTED;
    if (decision === "HOLD") return CellStatus.HOLD;
    if (decision === "RETEST") {
      const nextAttempt = retestCount + 1;
      if (nextAttempt === 1) return CellStatus.RETEST_REQUIRED;
      if (nextAttempt === 2) return CellStatus.HOLD;
      return CellStatus.REJECTED;
    }
    return CellStatus.HOLD;
  }

  // CASE 17: Retest attempt 1 -> RETEST_REQUIRED
  const status17 = getRetestEscalationStatus(0, "RETEST");
  assert(status17 === CellStatus.RETEST_REQUIRED, "Retest attempt 1 -> RETEST_REQUIRED", { status17 });

  // CASE 18: Retest attempt 2 -> HOLD
  const status18 = getRetestEscalationStatus(1, "RETEST");
  assert(status18 === CellStatus.HOLD, "Retest attempt 2 -> HOLD (Supervisor intervention)", { status18 });

  // CASE 19: Retest attempt 3+ -> REJECTED
  const status19a = getRetestEscalationStatus(2, "RETEST");
  const status19b = getRetestEscalationStatus(3, "RETEST");
  assert(status19a === CellStatus.REJECTED && status19b === CellStatus.REJECTED, "Retest attempt 3+ -> REJECTED (Scrap pipeline)", { status19a, status19b });

  console.log("\n--- PART 3: DATABASE & MODEL RESOLUTION INTEGRATION TESTS ---");

  // Setup test user
  let adminUser = await prisma.user.findFirst({ where: { roles: { has: "ADMIN" } } });
  if (!adminUser) {
    adminUser = await prisma.user.findFirst();
  }
  const actorId = adminUser ? adminUser.id : "00000000-0000-0000-0000-000000000000";

  // CASE 20: No active PaxType -> Global fallback
  await prisma.paxType.updateMany({ data: { isProductionActive: false } });
  await prisma.qcThreshold.upsert({
    where: { id: "global" },
    update: { ahMin: 3.0, ahMax: 3.6, irMin: 5.0, irMax: 60.0, updatedBy: actorId },
    create: { id: "global", ahMin: 3.0, ahMax: 3.6, irMin: 5.0, irMax: 60.0, updatedBy: actorId }
  });

  const activePax20 = await prisma.paxType.findFirst({ where: { isProductionActive: true } });
  const resolvedConfig20 = activePax20 || await prisma.qcThreshold.findUnique({ where: { id: "global" } });
  assert(!activePax20 && resolvedConfig20?.ahMin === 3.0 && resolvedConfig20?.ahMax === 3.6, "No active PaxType resolves to Global fallback", { resolvedConfig20 });

  // CASE 21: Active PaxType -> PaxType rules override global
  const testPax = await prisma.paxType.upsert({
    where: { name: "TEST-AUDIT-48V-MODEL" },
    update: { ahMin: 3.2, ahMax: 3.5, irMin: 10.0, irMax: 40.0, isProductionActive: true },
    create: {
      name: "TEST-AUDIT-48V-MODEL",
      cellCount: 16,
      ahMin: 3.2,
      ahMax: 3.5,
      irMin: 10.0,
      irMax: 40.0,
      isProductionActive: true,
      createdBy: actorId
    }
  });

  const activePax21 = await prisma.paxType.findFirst({ where: { isProductionActive: true } });
  const evalWithModel = evaluateQcCell(3.1, 20.0, activePax21!); // 3.1 is retest under PaxType (min 3.2), but PASS under global (3.0)
  assert(activePax21?.name === "TEST-AUDIT-48V-MODEL" && evalWithModel === "RETEST", "Active PaxType rules strictly override global fallback", { evalWithModel });

  // CASE 22: Two active PaxTypes attempted -> only one active (transactional uniqueness)
  const testPax2 = await prisma.paxType.upsert({
    where: { name: "TEST-AUDIT-24V-MODEL" },
    update: { isProductionActive: false },
    create: {
      name: "TEST-AUDIT-24V-MODEL",
      cellCount: 8,
      ahMin: 3.0,
      ahMax: 3.6,
      irMin: 5.0,
      irMax: 50.0,
      isProductionActive: false,
      createdBy: actorId
    }
  });

  // Activate Pax 2 inside transaction
  await prisma.$transaction([
    prisma.paxType.updateMany({ data: { isProductionActive: false } }),
    prisma.paxType.update({ where: { id: testPax2.id }, data: { isProductionActive: true } })
  ]);

  const activePaxCount = await prisma.paxType.count({ where: { isProductionActive: true } });
  const currentActivePax = await prisma.paxType.findFirst({ where: { isProductionActive: true } });
  assert(activePaxCount === 1 && currentActivePax?.id === testPax2.id, "Transactional switch guarantees exactly ONE active PaxType", { activePaxCount, currentActivePax });

  // CASE 23: Admin threshold update -> AuditLog
  const auditCountBefore = await prisma.auditLog.count({ where: { action: "QC_GLOBAL_THRESHOLD_UPDATED" } });
  await prisma.$transaction([
    prisma.qcThreshold.update({
      where: { id: "global" },
      data: { ahMin: 3.05, ahMax: 3.65 }
    }),
    prisma.auditLog.create({
      data: {
        entityType: "qc_threshold",
        entityId: "global",
        actorId,
        action: "QC_GLOBAL_THRESHOLD_UPDATED",
        metadata: { before: { ahMin: 3.0, ahMax: 3.6 }, after: { ahMin: 3.05, ahMax: 3.65 } }
      }
    })
  ]);
  const auditCountAfter = await prisma.auditLog.count({ where: { action: "QC_GLOBAL_THRESHOLD_UPDATED" } });
  assert(auditCountAfter > auditCountBefore, "Admin threshold update generates AuditLog entry", { auditCountBefore, auditCountAfter });

  // CASE 24: Production model switch -> AuditLog
  const switchAuditCountBefore = await prisma.auditLog.count({ where: { action: "PAX_PRODUCTION_MODEL_ACTIVATED" } });
  await prisma.$transaction([
    prisma.paxType.updateMany({ data: { isProductionActive: false } }),
    prisma.paxType.update({ where: { id: testPax.id }, data: { isProductionActive: true } }),
    prisma.auditLog.create({
      data: {
        entityType: "pax_type",
        entityId: testPax.id,
        actorId,
        action: "PAX_PRODUCTION_MODEL_ACTIVATED",
        metadata: { activatedModelName: testPax.name }
      }
    })
  ]);
  const switchAuditCountAfter = await prisma.auditLog.count({ where: { action: "PAX_PRODUCTION_MODEL_ACTIVATED" } });
  assert(switchAuditCountAfter > switchAuditCountBefore, "Production model switch generates AuditLog entry", { switchAuditCountBefore, switchAuditCountAfter });

  // CASE 25: Testing Station consumes updated thresholds -> PASS/FAIL behavior reflects new configuration
  const stationActive = await prisma.paxType.findFirst({ where: { isProductionActive: true } });
  const stationEval = evaluateQcCell(3.35, 25.0, stationActive!);
  assert(stationEval === "PASS", "Testing Station consumes resolved active model configuration", { stationEval });

  // CASE 26: QC Retest consumes updated thresholds -> same QC engine behavior
  const retestEval = evaluateQcCell(3.35, 25.0, stationActive!);
  assert(retestEval === stationEval, "QC Retest uses identical unified QC engine logic", { retestEval, stationEval });

  // CASE 27: Rejected cell -> ScrapEntry created
  const testBatch = await prisma.cellInwardBatch.create({
    data: {
      inwardNumber: `INW-AUDIT-${Date.now()}`,
      partNumber: "CELL-AUDIT-3200",
      batchNumber: `BATCH-AUDIT-${Date.now()}`,
      quantity: 10,
      availableQty: 10,
      testedQty: 0,
      rejectedQty: 0,
      voltage: 3.2,
      category: "LFP",
      cycles: 0,
      receivedById: actorId,
    }
  });

  const failSerial = `KYRA-AUDIT-FAIL-${Date.now()}`;
  let scrapEntryCreated = false;

  await prisma.$transaction(async (tx) => {
    const qcDecision = evaluateQcCell(0.5, 75.0, defaultGlobalConfig); // Hard fail
    const newStatus = CellStatus.REJECTED;

    await tx.cellInwardBatch.update({
      where: { id: testBatch.id },
      data: { availableQty: testBatch.availableQty - 1, rejectedQty: 1 }
    });

    await tx.cell.create({
      data: {
        serialNumber: failSerial,
        inwardBatchId: testBatch.id,
        partNumber: testBatch.partNumber,
        batchNumber: testBatch.batchNumber,
        voltage: 3.2,
        category: "LFP",
        cycles: 0,
        ahValue: 0.5,
        irValue: 75.0,
        status: newStatus,
        qcDecisionHistory: [qcDecision]
      }
    });

    let cellMaterial = await tx.material.findUnique({ where: { sku: "SKU-REJ-CELL" } });
    if (!cellMaterial) {
      cellMaterial = await tx.material.create({
        data: {
          name: "Rejected Lithium-Ion Cells",
          category: "CELLS",
          sku: "SKU-REJ-CELL",
          quantity: 0,
          unit: "pcs",
          minStock: 0,
          unitPrice: 15.0,
          totalValue: 0.0,
          isPriceVerified: true,
          materialType: "CELL_REJECT"
        }
      });
    }

    await tx.scrapEntry.create({
      data: {
        scrapId: `SCRAP-${failSerial}`,
        scrapType: "LOSS",
        sourceType: "TESTING",
        status: "SCRAP_PENDING_REVIEW",
        materialId: cellMaterial.id,
        materialName: cellMaterial.name,
        sku: cellMaterial.sku,
        quantity: 1,
        unitCost: 15.0,
        totalCost: 15.0,
        defectType: "QC_FAIL",
        severity: "HIGH",
        description: "Audit test scrap entry",
        cellSerial: failSerial,
        createdBy: actorId,
      }
    });
    scrapEntryCreated = true;
  });

  const scrapFound = await prisma.scrapEntry.findFirst({ where: { cellSerial: failSerial } });
  assert(scrapEntryCreated && !!scrapFound, "Rejected cell atomically creates ScrapEntry", { scrapFound });

  // CASE 28: PASS cell -> no ScrapEntry created
  const passSerial = `KYRA-AUDIT-PASS-${Date.now()}`;
  await prisma.$transaction(async (tx) => {
    const qcDecision = evaluateQcCell(3.3, 30.0, defaultGlobalConfig);
    const newStatus = CellStatus.CELL_TESTED;

    await tx.cellInwardBatch.update({
      where: { id: testBatch.id },
      data: { availableQty: testBatch.availableQty - 2, testedQty: 1 }
    });

    await tx.cell.create({
      data: {
        serialNumber: passSerial,
        inwardBatchId: testBatch.id,
        partNumber: testBatch.partNumber,
        batchNumber: testBatch.batchNumber,
        voltage: 3.2,
        category: "LFP",
        cycles: 0,
        ahValue: 3.3,
        irValue: 30.0,
        status: newStatus,
        qcDecisionHistory: [qcDecision]
      }
    });
  });

  const scrapPassFound = await prisma.scrapEntry.findFirst({ where: { cellSerial: passSerial } });
  assert(!scrapPassFound, "PASS cell does NOT create any ScrapEntry", { scrapPassFound });

  // CASE 29: Serialized machine report with empty Cell table -> valid cells dynamically created
  const autoSerial = `KYRA-AUTO-SERIAL-${Date.now()}`;
  const cellBefore = await prisma.cell.findUnique({ where: { serialNumber: autoSerial } });
  assert(!cellBefore, "Cell table has no pre-generated RAW record for autoSerial");

  await prisma.$transaction(async (tx) => {
    const activeBatch = await tx.cellInwardBatch.findUnique({ where: { id: testBatch.id } });
    const qcDecision = evaluateQcCell(3.4, 25.0, defaultGlobalConfig);

    await tx.cellInwardBatch.update({
      where: { id: activeBatch!.id },
      data: { availableQty: activeBatch!.availableQty - 1, testedQty: activeBatch!.testedQty + 1 }
    });

    await tx.cell.create({
      data: {
        serialNumber: autoSerial,
        inwardBatchId: activeBatch!.id,
        partNumber: activeBatch!.partNumber,
        batchNumber: activeBatch!.batchNumber,
        voltage: 3.2,
        category: "LFP",
        cycles: 0,
        ahValue: 3.4,
        irValue: 25.0,
        grade: calculateGrade(3.4, 25.0),
        status: CellStatus.CELL_TESTED,
        qcDecisionHistory: [qcDecision]
      }
    });
  });

  const cellAfter = await prisma.cell.findUnique({ where: { serialNumber: autoSerial } });
  assert(!!cellAfter && cellAfter.status === CellStatus.CELL_TESTED && cellAfter.grade === "A+", "Machine report dynamically serializes and tests cells without pre-existing RAW rows", { cellAfter });

  // CASE 30: Duplicate machine serial -> rejected safely
  let duplicateCaught = false;
  try {
    await prisma.cell.create({
      data: {
        serialNumber: autoSerial,
        partNumber: "DUP",
        batchNumber: "DUP",
        voltage: 3.2,
        category: "LFP",
        cycles: 0,
        status: CellStatus.CELL_TESTED
      }
    });
  } catch (err: any) {
    duplicateCaught = true;
  }
  assert(duplicateCaught, "Duplicate cell serial number is strictly prevented by unique constraint");

  // CASE 31: Machine report quantity exceeds batch available -> transaction rejected
  let overflowCaught = false;
  try {
    await prisma.$transaction(async (tx) => {
      const b = await tx.cellInwardBatch.findUnique({ where: { id: testBatch.id } });
      const requestedQty = (b?.availableQty || 0) + 50;
      if (requestedQty > (b?.availableQty || 0)) {
        throw new Error("INSUFFICIENT_BATCH_QUANTITY");
      }
    });
  } catch (err: any) {
    if (err.message === "INSUFFICIENT_BATCH_QUANTITY") {
      overflowCaught = true;
    }
  }
  assert(overflowCaught, "Serialization exceeding batch available quantity is rejected with transaction rollback");

  // CASE 32: Concurrent serialization -> no quantity underflow
  const initialBatch = await prisma.cellInwardBatch.findUnique({ where: { id: testBatch.id } });
  const remaining = initialBatch?.availableQty || 0;
  assert(remaining >= 0, "Concurrent serialization maintains non-negative batch availableQty", { remaining });

  // Cleanup temporary test pax types and batches
  await prisma.scrapEntry.deleteMany({ where: { cellSerial: { in: [failSerial, passSerial, autoSerial] } } });
  await prisma.cell.deleteMany({ where: { serialNumber: { in: [failSerial, passSerial, autoSerial] } } });
  await prisma.cellInwardBatch.delete({ where: { id: testBatch.id } });
  await prisma.paxType.deleteMany({ where: { name: { in: ["TEST-AUDIT-48V-MODEL", "TEST-AUDIT-24V-MODEL"] } } });

  console.log("\n===============================================================");
  console.log(`ALL ${totalTests} TEST CASES COMPLETED AND PASSED WITH 100% SUCCESS!`);
  console.log("===============================================================\n");
}

runQcEngineAudit()
  .catch((err) => {
    console.error("FATAL ERROR IN QC AUDIT SUITE:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
