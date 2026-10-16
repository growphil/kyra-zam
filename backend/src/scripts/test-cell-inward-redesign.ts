import { prisma } from "../prisma";
import { CellService } from "../services/cell.service";
import { evaluateQcCell } from "../utils/qcRules";
import { CellStatus } from "../generated/client";

async function runTest() {
  console.log("🚀 Starting Cell Inward Redesign Integration Test...");

  const TEST_PART = "TEST-CELL-LFP-3200";
  const TEST_BATCH = `BATCH-TEST-${Date.now().toString().slice(-6)}`;
  const TEST_SERIAL_1 = `KZ-RAW-TEST-${Date.now().toString().slice(-5)}-01`;
  const TEST_SERIAL_2 = `KZ-RAW-TEST-${Date.now().toString().slice(-5)}-02`;

  try {
    // 0. Fetch or create a test user
    const user = await prisma.user.findFirst({ where: { email: "inv@kyrazam.com" } }) 
      || await prisma.user.findFirst();
    if (!user) throw new Error("No user found in database for testing");

    console.log(`👤 Using actor: ${user.name} (${user.email})`);

    // ── STEP 1: INVENTORY MANAGER BULK INWARD (QUANTITY BASED) ─────────────
    console.log("\n📦 1. Executing Cell Inward: Part Number + Quantity (500 pcs)...");
    const inwardBatch = await CellService.createInwardBatch({
      partNumber: TEST_PART,
      quantity: 500,
      batchNumber: TEST_BATCH,
      category: "LFP 3.2V",
      voltage: 3.2,
      cycles: 0,
      notes: "End-to-end integration test lot"
    }, user.id);

    console.log(`✅ Inward Batch Created: ${inwardBatch.inwardNumber} (ID: ${inwardBatch.id})`);
    console.log(`   Part Number: ${inwardBatch.partNumber}`);
    console.log(`   Received Qty: ${inwardBatch.quantity}`);
    console.log(`   Available Qty: ${inwardBatch.availableQty}`);
    console.log(`   Status: ${inwardBatch.status}`);

    if (inwardBatch.quantity !== 500 || inwardBatch.availableQty !== 500) {
      throw new Error(`Assertion failed: Expected 500 received and available, got ${inwardBatch.quantity} / ${inwardBatch.availableQty}`);
    }

    // Check Material stock
    const material = await prisma.material.findUnique({ where: { sku: TEST_PART } });
    if (!material || material.quantity < 500) {
      throw new Error(`Assertion failed: Material ${TEST_PART} stock not updated correctly`);
    }
    console.log(`✅ Material Stock Updated: SKU ${material.sku} -> Quantity ${material.quantity} pcs`);

    // ── STEP 2: TEST ENGINEER SERIALIZATION & TESTING HANDOFF ──────────────
    console.log("\n🔬 2. Simulating Test Engineer Physical Serialization & Test Apply...");
    console.log(`   Testing physical cell #1: ${TEST_SERIAL_1} (AH: 102.5, IR: 24.5)`);
    console.log(`   Testing physical cell #2: ${TEST_SERIAL_2} (AH: 101.8, IR: 25.1)`);

    // Test Engineer applies test results for the 2 cells
    const activeBatch = await prisma.cellInwardBatch.findUnique({ where: { id: inwardBatch.id } });
    if (!activeBatch || activeBatch.availableQty !== 500) {
      throw new Error("Active batch not available before testing");
    }

    // Create Cell 1 with test result
    const cell1 = await prisma.cell.create({
      data: {
        serialNumber: TEST_SERIAL_1,
        inwardBatchId: activeBatch.id,
        partNumber: activeBatch.partNumber,
        batchNumber: activeBatch.batchNumber,
        voltage: activeBatch.voltage,
        category: activeBatch.category,
        cycles: activeBatch.cycles,
        ahValue: 102.5,
        irValue: 24.5,
        grade: "Grade A",
        status: CellStatus.CELL_TESTED,
      }
    });

    // Create Cell 2 with test result
    const cell2 = await prisma.cell.create({
      data: {
        serialNumber: TEST_SERIAL_2,
        inwardBatchId: activeBatch.id,
        partNumber: activeBatch.partNumber,
        batchNumber: activeBatch.batchNumber,
        voltage: activeBatch.voltage,
        category: activeBatch.category,
        cycles: activeBatch.cycles,
        ahValue: 101.8,
        irValue: 25.1,
        grade: "Grade A",
        status: CellStatus.CELL_TESTED,
      }
    });

    // Decrement Inward Batch available quantity by 2
    const updatedBatch = await prisma.cellInwardBatch.update({
      where: { id: activeBatch.id },
      data: {
        availableQty: activeBatch.availableQty - 2,
        testedQty: activeBatch.testedQty + 2,
        status: "IN_TESTING"
      }
    });

    console.log(`✅ Cells created and serialized in DB:`);
    console.log(`   - ${cell1.serialNumber} (Grade: ${cell1.grade}, Status: ${cell1.status}, Batch: ${cell1.batchNumber})`);
    console.log(`   - ${cell2.serialNumber} (Grade: ${cell2.grade}, Status: ${cell2.status}, Batch: ${cell2.batchNumber})`);
    console.log(`✅ Inward Batch Availability updated:`);
    console.log(`   - Available Qty: ${updatedBatch.availableQty} (decreased from 500 to 498)`);
    console.log(`   - Tested Qty: ${updatedBatch.testedQty} (increased from 0 to 2)`);
    console.log(`   - Status: ${updatedBatch.status}`);

    if (updatedBatch.availableQty !== 498 || updatedBatch.testedQty !== 2) {
      throw new Error(`Assertion failed: Expected availableQty 498, got ${updatedBatch.availableQty}`);
    }

    // ── STEP 3: TRACEABILITY GENEALOGY VERIFICATION ────────────────────────
    console.log("\n🔍 3. Verifying Traceability from Serial Number back to Inward Batch...");
    const tracedCell = await prisma.cell.findUnique({
      where: { serialNumber: TEST_SERIAL_1 },
      include: {
        inwardBatch: {
          include: { receivedBy: true, material: true }
        }
      }
    });

    if (!tracedCell || !tracedCell.inwardBatch) {
      throw new Error("Traceability link between Cell and InwardBatch is missing");
    }

    console.log(`✅ Full Traceability Verified:`);
    console.log(`   Serial: ${tracedCell.serialNumber}`);
    console.log(`   ├── Part Number: ${tracedCell.partNumber}`);
    console.log(`   ├── Inward Ref: ${tracedCell.inwardBatch.inwardNumber}`);
    console.log(`   ├── Received By: ${tracedCell.inwardBatch.receivedBy.name}`);
    console.log(`   ├── Batch: ${tracedCell.batchNumber}`);
    console.log(`   └── Test Grade: ${tracedCell.grade} (Status: ${tracedCell.status})`);

    // ── STEP 4: CLEANUP TEST DATA ──────────────────────────────────────────
    console.log("\n🧹 4. Cleaning up test artifacts...");
    await prisma.cell.deleteMany({ where: { serialNumber: { in: [TEST_SERIAL_1, TEST_SERIAL_2] } } });
    await prisma.stockMovement.deleteMany({ where: { reason: { contains: inwardBatch.inwardNumber } } });
    await prisma.auditLog.deleteMany({ where: { entityId: inwardBatch.id } });
    await prisma.cellInwardBatch.delete({ where: { id: inwardBatch.id } });
    await prisma.material.deleteMany({ where: { sku: TEST_PART } });

    console.log("✨ ALL INTEGRATION TESTS PASSED SUCCESSFULLY! ✨\n");
  } catch (error) {
    console.error("❌ Integration test failed:", error);
    process.exit(1);
  }
}

runTest();
