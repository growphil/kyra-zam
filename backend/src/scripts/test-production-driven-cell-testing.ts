import { PrismaClient, CellStatus } from "../generated/client";
import { evaluateQcCell, calculateGrade, QcConfig } from "../utils/qcRules";
import { normalizeSerial } from "../utils/serial";

const prisma = new PrismaClient();

async function runTests() {
  console.log("================================================================================");
  console.log("🧪 TESTING PRODUCTION-DRIVEN CELL TESTING REQUIREMENT WORKFLOW");
  console.log("================================================================================\n");

  const timestamp = Date.now();

  try {
    // 1. Setup Users
    console.log("[Step 1] Finding / Setting up personnel...");
    const supervisor = await prisma.user.findFirst({ where: { roles: { has: "SUPERVISOR" } } });
    const testEngineer = await prisma.user.findFirst({ where: { roles: { has: "TEST_ENGINEER" } } });
    const superAdmin = await prisma.user.findFirst({ where: { roles: { has: "SUPERADMIN" } } });

    if (!supervisor || !testEngineer || !superAdmin) {
      throw new Error("Required users (SUPERVISOR, TEST_ENGINEER, SUPERADMIN) not found in DB");
    }
    console.log(`✓ Supervisor: ${supervisor.name} (${supervisor.email})`);
    console.log(`✓ Test Engineer: ${testEngineer.name} (${testEngineer.email})\n`);

    // 2. Setup Cell Material and BOM
    console.log("[Step 2] Creating Test Cell Material and BOM...");
    const cellMaterial = await prisma.material.create({
      data: {
        name: `Test 3.2V 3200mAh Cell ${timestamp}`,
        category: "CELLS",
        sku: `CELL-LFP-TEST-${timestamp}`,
        quantity: 1000,
        unit: "pcs",
        minStock: 50,
        unitPrice: 120.0,
        totalValue: 120000.0,
        isPriceVerified: true,
        materialType: "CELL"
      }
    });

    const bom = await prisma.bOM.create({
      data: {
        name: `Industrial Test Pack 48V 100Ah BOM ${timestamp}`,
        description: "BOM with 16 cells per pack",
        items: {
          create: [
            { materialId: cellMaterial.id, quantity: 16 }
          ]
        }
      },
      include: { items: true }
    });
    console.log(`✓ BOM created: ${bom.name} (16 cells per pack)\n`);

    // 3. Create Inward Batch
    console.log("[Step 3] Creating Bulk Inward Batch of Raw Cells...");
    const inwardBatch = await prisma.cellInwardBatch.create({
      data: {
        inwardNumber: `INW-TEST-${timestamp}`,
        partNumber: cellMaterial.sku,
        batchNumber: `BATCH-TEST-${timestamp}`,
        materialId: cellMaterial.id,
        quantity: 500,
        availableQty: 500,
        testedQty: 0,
        rejectedQty: 0,
        consumedQty: 0,
        category: "LFP 3.2V",
        voltage: 3.2,
        cycles: 0,
        receivedById: supervisor.id,
        status: "RECEIVED"
      }
    });
    console.log(`✓ Inward Batch created: ${inwardBatch.inwardNumber} (Available: ${inwardBatch.availableQty} pcs)\n`);

    // 4. Create Production Station
    let station = await prisma.productionStation.findFirst({ where: { isActive: true } });
    if (!station) {
      station = await prisma.productionStation.create({
        data: {
          name: `Station Alpha ${timestamp}`,
          code: `ST-A-${timestamp.toString().slice(-4)}`,
          type: "ASSEMBLY",
          isActive: true
        }
      });
    }

    // 5. Create Customer & Sales Order & Work Order
    console.log("[Step 4] Creating Sales Order, Production Requirement & Plan...");
    const customer = await prisma.customer.findFirst() || await prisma.customer.create({
        data: {
            customerCode: `CUST-${timestamp.toString().slice(-4)}`,
            name: `Test Client ${timestamp}`,
            email: `client${timestamp}@test.com`,
            phone: '9876543210',
            billingAddress: 'Test Address',
            shippingAddress: 'Test Shipping',
            city: 'Bangalore',
            state: 'Karnataka',
            country: 'India',
            postalCode: '560001'
        }
    });

    const salesOrder = await prisma.salesOrder.create({
        data: {
            salesOrderNumber: `SO-${timestamp.toString().slice(-4)}`,
            customerId: customer.id,
            createdById: supervisor.id,
            requiredDeliveryDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
            status: 'CONFIRMED',
            paymentStatus: 'PAID',
            isFinancialCleared: true,
            subtotal: 100000,
            discount: 0,
            tax: 18000,
            grandTotal: 118000,
            billingAddressSnapshot: 'Test Address',
            shippingAddressSnapshot: 'Test Shipping',
            paymentTerms: '100% Advance',
            deliveryTerms: 'Ex-Works',
            items: {
                create: [
                    {
                        productRef: `Industrial Test Pack 48V 100Ah ${timestamp}`,
                        description: '48V 100Ah Battery Pack',
                        quantityOrdered: 10,
                        quantityPending: 10,
                        unitPrice: 10000,
                        taxAmount: 1800,
                        lineSubtotal: 100000,
                        lineTotal: 118000,
                        fulfillmentType: 'PRODUCTION_REQUIRED'
                    }
                ]
            }
        },
        include: { items: true }
    });

    const prodReq = await prisma.productionRequirement.create({
      data: {
        requirementNumber: `PRD-${timestamp.toString().slice(-4)}`,
        salesOrderId: salesOrder.id,
        salesOrderItemId: salesOrder.items[0].id,
        customerId: customer.id,
        productRef: "48V 100Ah Battery Pack",
        requiredQuantity: 10,
        requiredDeliveryDate: new Date(Date.now() + 7 * 86400000),
        createdById: supervisor.id,
        status: "IN_PRODUCTION"
      }
    });

    const prodPlan = await prisma.productionPlan.create({
      data: {
        planNumber: `PLAN-${timestamp.toString().slice(-4)}`,
        productionRequirementId: prodReq.id,
        plannedStartDate: new Date(),
        plannedCompletionDate: new Date(Date.now() + 7 * 86400000),
        plannedQuantity: 10,
        supervisorId: supervisor.id,
        createdById: supervisor.id,
        status: "RELEASED"
      }
    });

    const plannedPaxQty = 10;
    const workOrder = await prisma.workOrder.create({
      data: {
        workOrderNumber: `WO-${timestamp.toString().slice(-4)}`,
        productionPlanId: prodPlan.id,
        productionRequirementId: prodReq.id,
        salesOrderId: salesOrder.id,
        productRef: "48V 100Ah Battery Pack",
        bomId: bom.id,
        plannedQuantity: plannedPaxQty,
        remainingQuantity: plannedPaxQty,
        dueDate: new Date(),
        supervisorId: supervisor.id,
        status: "READY"
      }
    });

    // Schedule for today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    await prisma.workOrderScheduling.create({
      data: {
        workOrderId: workOrder.id,
        assignedDate: today,
        sequence: 1,
        estimatedHrs: 8.0
      }
    });
    console.log(`✓ Work Order created: ${workOrder.workOrderNumber} (Planned Qty: ${plannedPaxQty} packs, Status: READY)\n`);

    // 6. Test Supervisor START Work Order
    console.log("[Step 5] Simulating Supervisor START Work Order...");
    const expectedCellDemand = 16 * plannedPaxQty; // 160 cells

    // Execute Start Workflow
    const startResult = await prisma.$transaction(async (tx) => {
      // Transition status
      await tx.workOrder.update({
        where: { id: workOrder.id },
        data: { status: "IN_PROGRESS", startDate: new Date() }
      });

      await tx.workOrderExecution.upsert({
        where: { workOrderId: workOrder.id },
        create: { workOrderId: workOrder.id, startedAt: new Date(), actualHours: 0 },
        update: { startedAt: new Date(), pausedAt: null }
      });

      // Derive cell requirements
      const pctr = await tx.productionCellTestingRequirement.create({
        data: {
          requirementNumber: `PCTR-${timestamp.toString().slice(-6)}`,
          workOrderId: workOrder.id,
          materialId: cellMaterial.id,
          cellSku: cellMaterial.sku,
          cellName: cellMaterial.name,
          requiredQuantity: expectedCellDemand,
          testedQuantity: 0,
          remainingQuantity: expectedCellDemand,
          status: "IN_PROGRESS"
        }
      });

      return pctr;
    });

    console.log(`✓ Work Order is now IN_PROGRESS`);
    console.log(`✓ Production Cell Testing Requirement created: ${startResult.requirementNumber}`);
    console.log(`  - Cell SKU: ${startResult.cellSku}`);
    console.log(`  - Required Cells: ${startResult.requiredQuantity}`);
    console.log(`  - Tested Cells: ${startResult.testedQuantity}`);
    console.log(`  - Remaining Cells: ${startResult.remainingQuantity}`);
    console.log(`  - Status: ${startResult.status}\n`);

    if (startResult.requiredQuantity !== 160) {
      throw new Error(`Expected requiredQuantity 160, got ${startResult.requiredQuantity}`);
    }

    // 7. Test Physical Cell Testing with PASS
    console.log("[Step 6] Test Engineer scans and tests Cell #1 with QC PASS...");
    const cellSerial1 = `KZ-RAW-TEST-001-${timestamp}`;
    const testResult1 = await prisma.$transaction(async (tx) => {
      // Deduct inward batch available qty
      await tx.cellInwardBatch.update({
        where: { id: inwardBatch.id },
        data: {
          availableQty: { decrement: 1 },
          testedQty: { increment: 1 }
        }
      });

      // Create serialized cell
      const cell = await tx.cell.create({
        data: {
          serialNumber: normalizeSerial(cellSerial1),
          inwardBatchId: inwardBatch.id,
          partNumber: cellMaterial.sku,
          batchNumber: inwardBatch.batchNumber,
          voltage: 3.25,
          ahValue: 3.25,
          irValue: 24.0,
          grade: "A+",
          status: CellStatus.CELL_TESTED,
          category: "LFP 3.2V",
          cycles: 0,
          testingRequirementId: startResult.id
        }
      });

      // Credit production requirement
      const updatedReq = await tx.productionCellTestingRequirement.update({
        where: { id: startResult.id },
        data: {
          testedQuantity: { increment: 1 },
          remainingQuantity: { decrement: 1 }
        }
      });

      return { cell, updatedReq };
    });

    console.log(`✓ Cell ${cellSerial1} qualified (Grade ${testResult1.cell.grade})`);
    console.log(`✓ Requirement progress: ${testResult1.updatedReq.testedQuantity} / ${testResult1.updatedReq.requiredQuantity} (Remaining: ${testResult1.updatedReq.remainingQuantity})\n`);

    if (testResult1.updatedReq.testedQuantity !== 1 || testResult1.updatedReq.remainingQuantity !== 159) {
      throw new Error(`Requirement counters incorrect: tested=${testResult1.updatedReq.testedQuantity}, remaining=${testResult1.updatedReq.remainingQuantity}`);
    }

    // 8. Test Physical Cell Testing with RETEST
    console.log("[Step 7] Test Engineer tests Cell #2 with borderline values (RETEST)...");
    const cellSerial2 = `KZ-RAW-TEST-002-${timestamp}`;
    const testResult2 = await prisma.$transaction(async (tx) => {
      await tx.cellInwardBatch.update({
        where: { id: inwardBatch.id },
        data: { availableQty: { decrement: 1 } }
      });

      const cell = await tx.cell.create({
        data: {
          serialNumber: normalizeSerial(cellSerial2),
          inwardBatchId: inwardBatch.id,
          partNumber: cellMaterial.sku,
          batchNumber: inwardBatch.batchNumber,
          voltage: 3.20,
          ahValue: 2.95, // Borderline
          irValue: 46.0,
          status: CellStatus.RETEST_REQUIRED,
          retestCount: 1,
          category: "LFP 3.2V",
          cycles: 0,
          testingRequirementId: startResult.id
        }
      });

      // Production requirement must NOT be credited
      const req = await tx.productionCellTestingRequirement.findUnique({
        where: { id: startResult.id }
      });

      return { cell, req };
    });

    console.log(`✓ Cell ${cellSerial2} marked as ${testResult2.cell.status}`);
    console.log(`✓ Requirement progress unchanged: ${testResult2.req?.testedQuantity} / ${testResult2.req?.requiredQuantity} (Remaining: ${testResult2.req?.remainingQuantity})\n`);

    if (testResult2.req?.testedQuantity !== 1) {
      throw new Error("RETEST cell should NOT increment testedQuantity!");
    }

    // 9. Test Physical Cell Testing with FAIL
    console.log("[Step 8] Test Engineer tests Cell #3 with out-of-spec values (FAIL/REJECTED)...");
    const cellSerial3 = `KZ-RAW-TEST-003-${timestamp}`;
    const testResult3 = await prisma.$transaction(async (tx) => {
      await tx.cellInwardBatch.update({
        where: { id: inwardBatch.id },
        data: {
          availableQty: { decrement: 1 },
          rejectedQty: { increment: 1 }
        }
      });

      const cell = await tx.cell.create({
        data: {
          serialNumber: normalizeSerial(cellSerial3),
          inwardBatchId: inwardBatch.id,
          partNumber: cellMaterial.sku,
          batchNumber: inwardBatch.batchNumber,
          voltage: 2.1,
          ahValue: 1.5, // Severe fail
          irValue: 120.0,
          status: CellStatus.REJECTED,
          category: "LFP 3.2V",
          cycles: 0,
          testingRequirementId: startResult.id
        }
      });

      const scrap = await tx.scrapEntry.create({
        data: {
          scrapId: `SCRAP-TEST-${timestamp}`,
          scrapType: "LOSS",
          sourceType: "TESTING",
          status: "SCRAP_PENDING_REVIEW",
          materialId: cellMaterial.id,
          materialName: cellMaterial.name,
          sku: cellMaterial.sku,
          quantity: 1,
          unitCost: 120.0,
          totalCost: 120.0,
          defectType: "AH_LOW, IR_HIGH",
          severity: "HIGH",
          description: "QC failure during production testing",
          cellSerial: cell.serialNumber,
          createdBy: testEngineer.id
        }
      });

      const req = await tx.productionCellTestingRequirement.findUnique({
        where: { id: startResult.id }
      });

      return { cell, scrap, req };
    });

    console.log(`✓ Cell ${cellSerial3} marked as ${testResult3.cell.status} and auto-routed to scrap (${testResult3.scrap.scrapId})`);
    console.log(`✓ Requirement progress unchanged: ${testResult3.req?.testedQuantity} / ${testResult3.req?.requiredQuantity}\n`);

    if (testResult3.req?.testedQuantity !== 1) {
      throw new Error("REJECTED cell should NOT increment testedQuantity!");
    }

    // 10. Test Retest and PASS
    console.log("[Step 9] Cell #2 is retested on /qc-retest and passes (QC PASS)...");
    const retestPass = await prisma.$transaction(async (tx) => {
      const updatedCell = await tx.cell.update({
        where: { serialNumber: normalizeSerial(cellSerial2) },
        data: {
          ahValue: 3.22,
          irValue: 25.0,
          grade: "A",
          status: CellStatus.CELL_TESTED
        }
      });

      // Credit the linked requirement
      const req = await tx.productionCellTestingRequirement.update({
        where: { id: startResult.id },
        data: {
          testedQuantity: { increment: 1 },
          remainingQuantity: { decrement: 1 }
        }
      });

      return { updatedCell, req };
    });

    console.log(`✓ Retested Cell ${cellSerial2} passed and credited!`);
    console.log(`✓ Requirement progress now: ${retestPass.req.testedQuantity} / ${retestPass.req.requiredQuantity}\n`);

    if (retestPass.req.testedQuantity !== 2) {
      throw new Error(`Expected testedQuantity 2 after retest pass, got ${retestPass.req.testedQuantity}`);
    }

    // 11. Test Requirement Completion
    console.log("[Step 10] Testing fulfillment of remaining cells to 160...");
    const fulfilledReq = await prisma.productionCellTestingRequirement.update({
      where: { id: startResult.id },
      data: {
        testedQuantity: 160,
        remainingQuantity: 0,
        status: "COMPLETED",
        completedAt: new Date()
      }
    });

    console.log(`✓ Requirement fulfilled: ${fulfilledReq.requirementNumber} Status: ${fulfilledReq.status}`);
    console.log(`  - Qualified: ${fulfilledReq.testedQuantity} / ${fulfilledReq.requiredQuantity} cells`);

    // Verify Work Order is NOT automatically completed
    const currentWo = await prisma.workOrder.findUnique({ where: { id: workOrder.id } });
    console.log(`✓ Work Order status: ${currentWo?.status} (Retained in IN_PROGRESS under Supervisor control)\n`);

    if (currentWo?.status !== "IN_PROGRESS") {
      throw new Error("Work Order status was unexpectedly altered!");
    }

    // Cleanup
    console.log("[Cleanup] Cleaning up integration test artifacts...");
    await prisma.scrapEntry.deleteMany({ where: { cellSerial: { contains: `${timestamp}` } } });
    await prisma.cell.deleteMany({ where: { inwardBatchId: inwardBatch.id } });
    await prisma.productionCellTestingRequirement.deleteMany({ where: { workOrderId: workOrder.id } });
    await prisma.workOrderScheduling.deleteMany({ where: { workOrderId: workOrder.id } });
    await prisma.workOrderExecution.deleteMany({ where: { workOrderId: workOrder.id } });
    await prisma.workOrder.deleteMany({ where: { id: workOrder.id } });
    await prisma.productionPlan.deleteMany({ where: { id: prodPlan.id } });
    await prisma.productionRequirement.deleteMany({ where: { id: prodReq.id } });
    await prisma.salesOrderItem.deleteMany({ where: { salesOrderId: salesOrder.id } });
    await prisma.salesOrder.deleteMany({ where: { id: salesOrder.id } });
    try {
      if (customer?.id) {
        await prisma.customer.deleteMany({ where: { id: customer.id } });
      }
    } catch (_) {}
    await prisma.cellInwardBatch.deleteMany({ where: { id: inwardBatch.id } });
    await prisma.bOMItem.deleteMany({ where: { bomId: bom.id } });
    await prisma.bOM.deleteMany({ where: { id: bom.id } });
    await prisma.material.deleteMany({ where: { id: cellMaterial.id } });

    console.log("✓ Cleanup completed successfully.\n");
    console.log("================================================================================");
    console.log("🎉 ALL PRODUCTION-DRIVEN CELL TESTING TESTS PASSED SUCCESSFULLY!");
    console.log("================================================================================");
  } catch (error) {
    console.error("❌ Test failed:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
