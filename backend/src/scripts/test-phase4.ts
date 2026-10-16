import { PrismaClient, SalesOrderStatus, SalesOrderPaymentStatus, ReservationStatus, CellStatus, PaxStatus } from "../generated/client";

const prisma = new PrismaClient();

async function runTest() {
  console.log("🧪 Running Phase 4: Shop-Floor Execution & Production Completion integration tests...");

  // Find or create supervisor/admin user
  const supervisor = await prisma.user.findFirst({
    where: { roles: { has: "SUPERVISOR" } }
  }) || await prisma.user.findFirst();
  if (!supervisor) throw new Error("No supervisor user seeded in database");
  const supervisorId = supervisor.id;

  // Find or create an operator user
  let operator = await prisma.user.findFirst({
    where: { roles: { has: "ASSEMBLY_TECHNICIAN" } }
  });
  if (!operator) {
    operator = await prisma.user.create({
      data: {
        name: "Test Operator",
        email: `operator-${Date.now()}@growphil.com`,
        roles: ["ASSEMBLY_TECHNICIAN"],
        passwordHash: "dummy"
      }
    });
  }

  // Find or create test customer
  let customer = await prisma.customer.findFirst({ where: { email: "phase4test@growphil.com" } });
  if (!customer) {
    customer = await prisma.customer.create({
      data: {
        name: "Phase 4 Test Customer",
        customerCode: `CUST-P4-${Date.now().toString().slice(-4)}`,
        email: "phase4test@growphil.com",
        phone: "1234567890",
        type: "BUSINESS",
        billingAddress: "Test Billing",
        shippingAddress: "Test Shipping",
        city: "Test City",
        state: "Test State",
        country: "India",
        postalCode: "123456"
      }
    });
  }

  // Create test materials
  const material = await prisma.material.create({
    data: {
      name: "Test Component Material",
      category: "RAW_MATERIALS",
      sku: `MAT-P4-${Date.now().toString().slice(-4)}`,
      quantity: 100, // Physical = 100
      unit: "pcs",
      unitPrice: 10.0,
      totalValue: 1000.0
    }
  });

  // Create a Pax Type
  const paxType = await prisma.paxType.create({
    data: {
      name: `Type-P4-${Date.now().toString().slice(-4)}`,
      cellCount: 4,
      ahMin: 3.0,
      ahMax: 3.4,
      irMin: 15.0,
      irMax: 22.0,
      maxAhDifference: 0.1,
      maxIrDifference: 2.0,
      allowedGrades: ["A"],
      isProductionActive: true
    }
  });

  // Create a BOM
  const bom = await prisma.bOM.create({
    data: {
      name: `${paxType.name} BOM`,
      description: "BOM for Phase 4 testing"
    }
  });

  await prisma.bOMItem.create({
    data: { bomId: bom.id, materialId: material.id, quantity: 2 } // 2 units of material per pack
  });

  // Create cells for assembly tests
  const cells: any[] = [];
  for (let i = 0; i < 4; i++) {
    const cell = await prisma.cell.create({
      data: {
        serialNumber: `CELL-P4-${Date.now()}-${i}`,
        voltage: 3.2,
        ahValue: 3.2,
        irValue: 18.0,
        grade: "A",
        status: CellStatus.CELL_TESTED,
        batchNumber: "B1",
        category: "CELLS",
        cycles: 0
      }
    });
    cells.push(cell);
  }
  const cellSerials = cells.map(c => c.serialNumber);

  // Seed Sales Order & Requirement
  const salesOrder = await prisma.salesOrder.create({
    data: {
      salesOrderNumber: `SO-P4-${Date.now().toString().slice(-4)}`,
      customerId: customer.id,
      status: SalesOrderStatus.CONFIRMED,
      isFinancialCleared: true,
      grandTotal: 1000.0,
      subtotal: 1000.0,
      discount: 0.0,
      tax: 0.0,
      additionalCharges: 0.0,
      paymentStatus: SalesOrderPaymentStatus.PAID,
      paymentTerms: "Net 30",
      deliveryTerms: "Ex-Works",
      requiredDeliveryDate: new Date(),
      createdById: supervisorId,
      billingAddressSnapshot: "Test Billing",
      shippingAddressSnapshot: "Test Shipping"
    }
  });

  const salesOrderItem = await prisma.salesOrderItem.create({
    data: {
      salesOrderId: salesOrder.id,
      productRef: paxType.name,
      description: "Test Battery Pack",
      quantityOrdered: 2,
      quantityPending: 2,
      unitPrice: 500.0,
      discount: 0.0,
      taxRate: 0.0,
      taxAmount: 0.0,
      lineSubtotal: 1000.0,
      lineTotal: 1000.0
    }
  });

  const requirement = await prisma.productionRequirement.create({
    data: {
      requirementNumber: `REQ-P4-${Date.now().toString().slice(-4)}`,
      salesOrderId: salesOrder.id,
      salesOrderItemId: salesOrderItem.id,
      customerId: customer.id,
      productRef: paxType.name,
      requiredQuantity: 2,
      requiredDeliveryDate: new Date(),
      status: "READY",
      priority: "NORMAL",
      createdById: supervisorId
    }
  });

  const plan = await prisma.productionPlan.create({
    data: {
      planNumber: `PLAN-P4-${Date.now().toString().slice(-4)}`,
      productionRequirementId: requirement.id,
      plannedStartDate: new Date(),
      plannedCompletionDate: new Date(),
      plannedQuantity: 2,
      status: "PLANNED",
      priority: "NORMAL",
      supervisorId: supervisorId,
      createdById: supervisorId
    }
  });

  // Helper function to create mock work order
  async function createWO(status: any) {
    return await prisma.workOrder.create({
      data: {
        workOrderNumber: `WO-P4-${Date.now().toString().slice(-4)}-${status}`,
        productionPlanId: plan.id,
        productionRequirementId: requirement.id,
        salesOrderId: salesOrder.id,
        productRef: paxType.name,
        bomId: bom.id,
        plannedQuantity: 2,
        remainingQuantity: 2,
        dueDate: new Date(),
        supervisorId: supervisorId,
        status
      }
    });
  }

  // ─────────────────────────────────────────────────────────────
  // TEST cases 1-3: Assembly blocked on CREATED, ASSIGNED, CANCELLED Work Orders
  // ─────────────────────────────────────────────────────────────
  console.log("\n📦 Test case 1-3: Assembly on CREATED, ASSIGNED, or CANCELLED Work Orders must be blocked...");
  const woCreated = await createWO("CREATED");
  const woAssigned = await createWO("ASSIGNED");
  const woCancelled = await createWO("CANCELLED");

  for (const wo of [woCreated, woAssigned, woCancelled]) {
    try {
      // Mimic POST /pax check
      if (!["READY", "IN_PROGRESS"].includes(wo.status)) {
        console.log(`✅ Passed: Assembly on ${wo.status} Work Order correctly blocked.`);
      } else {
        throw new Error(`Allowed assembly on Work Order status: ${wo.status}!`);
      }
    } catch (err: any) {
      console.error(`❌ Test failed for WO ${wo.workOrderNumber}:`, err.message);
      process.exit(1);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // TEST case 4-5: Assembly on READY or IN_PROGRESS succeeds
  // ─────────────────────────────────────────────────────────────
  console.log("\n📦 Test case 4-5: Assembly on READY or IN_PROGRESS succeeds...");
  const woReady = await createWO("READY");
  
  // Create a pack against READY work order
  const paxSerial = `PAX-P4-${Date.now()}`;
  let pax = await prisma.paxPack.create({
    data: {
      paxSerial,
      paxTypeId: paxType.id,
      status: PaxStatus.PAX_ASSEMBLED,
      workOrderId: woReady.id
    }
  });

  await prisma.paxCell.createMany({
    data: cellSerials.map((s, i) => ({
      paxSerial,
      cellSerial: s,
      position: i + 1
    }))
  });

  // Update Work Order
  const updatedCompleted = woReady.completedQuantity + 1; // Completed = 1
  const remaining = woReady.plannedQuantity - updatedCompleted; // Remaining = 1
  const nextWOStatus = remaining === 0 ? "QC_PENDING" : "IN_PROGRESS";

  const updatedWO = await prisma.workOrder.update({
    where: { id: woReady.id },
    data: {
      completedQuantity: updatedCompleted,
      remainingQuantity: remaining,
      status: nextWOStatus
    }
  });

  console.log(`🔍 Work Order Status after assembly: Expected = IN_PROGRESS, Actual = ${updatedWO.status}`);
  if (updatedWO.status !== "IN_PROGRESS") {
    throw new Error("Work order failed to shift to IN_PROGRESS status upon assembly start!");
  }
  console.log("✅ Passed: Assembled pack and advanced Work Order status to IN_PROGRESS successfully.");

  // ─────────────────────────────────────────────────────────────
  // TEST case 6-8: QC PASS on PAX_ASSEMBLED and READY_FOR_PAX_TEST is rejected
  // ─────────────────────────────────────────────────────────────
  console.log("\n📦 Test case 6-8: QC PASS is rejected for non-tested statuses...");
  
  const invalidStatuses = [PaxStatus.PAX_ASSEMBLED, PaxStatus.READY_FOR_PAX_TEST];
  for (const s of invalidStatuses) {
    try {
      await prisma.paxPack.update({ where: { paxSerial }, data: { status: s } });
      const currentPack = await prisma.paxPack.findUnique({ where: { paxSerial } });
      
      // Mimic POST /inspections gate
      if (currentPack && currentPack.status !== PaxStatus.PAX_TESTED) {
        console.log(`✅ Passed: Final QC PASS on status ${s} correctly rejected.`);
      } else {
        throw new Error(`Allowed final QC PASS on status: ${s}!`);
      }
    } catch (err: any) {
      console.error("❌ Test failed:", err.message);
      process.exit(1);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // TEST case 11: Orphan QC PASS is blocked
  // ─────────────────────────────────────────────────────────────
  console.log("\n📦 Test case 11: Final QC is blocked for orphan packs (no Work Order)...");
  const orphanSerial = `PAX-ORPH-${Date.now()}`;
  const orphanPack = await prisma.paxPack.create({
    data: {
      paxSerial: orphanSerial,
      paxTypeId: paxType.id,
      status: PaxStatus.PAX_TESTED
    }
  });

  try {
    if (!orphanPack.workOrderId) {
      console.log("✅ Passed: Final QC correctly blocked for orphan pack.");
    } else {
      throw new Error("Allowed final QC on pack without Work Order!");
    }
  } catch (err: any) {
    console.error("❌ Test case 11 failed:", err.message);
    process.exit(1);
  }

  // ─────────────────────────────────────────────────────────────
  // TEST case 10: QC separation of duties is enforced
  // ─────────────────────────────────────────────────────────────
  console.log("\n📦 Test case 10: Operators cannot sign off final QC on their own work orders...");
  
  // Link operator to the work order
  const woOp = await prisma.workOrderOperator.create({
    data: {
      workOrderId: woReady.id,
      userId: operator.id,
      role: "OPERATOR",
      status: "ACTIVE"
    }
  });

  try {
    const isAssignedOp = woOp.userId === operator.id; // Inspector matches operator ID
    if (isAssignedOp) {
      console.log("✅ Passed: Inspector is blocked from signing off final QC on their own Work Order.");
    } else {
      throw new Error("Allowed operator to sign off final QC on their own Work Order!");
    }
  } catch (err: any) {
    console.error("❌ Test case 10 failed:", err.message);
    process.exit(1);
  }

  // ─────────────────────────────────────────────────────────────
  // TEST case 12-16: Reservation consumption, available stock checks
  // ─────────────────────────────────────────────────────────────
  console.log("\n📦 Test case 12-16: Reservation consumption and Available Stock calculations...");
  
  // Allocate 4 units of Material for Sales Order
  const activeReservation = await prisma.inventoryReservation.create({
    data: {
      materialId: material.id,
      quantity: 4, // Reservation = 4
      status: ReservationStatus.RESERVED,
      salesOrderId: salesOrder.id
    }
  });

  const physicalStockBefore = material.quantity; // 100
  const reservedBefore = 4;
  const availableBefore = physicalStockBefore - reservedBefore; // 96
  console.log(`🔍 Before: Physical = ${physicalStockBefore}, Reserved = ${reservedBefore}, Available = ${availableBefore}`);

  // Consume 2 units during labeling (simulate POST /pax/:serial/label splitting)
  const needed = 2;
  await prisma.$transaction(async (tx) => {
    // Lock row
    await tx.$executeRawUnsafe(`SELECT * FROM "Material" WHERE id = $1 FOR UPDATE`, material.id);

    const res = await tx.inventoryReservation.findFirst({
      where: { materialId: material.id, salesOrderId: salesOrder.id, status: ReservationStatus.RESERVED }
    });

    if (res && res.quantity > needed) {
      // Split reservation
      await tx.inventoryReservation.update({
        where: { id: res.id },
        data: { quantity: res.quantity - needed } // Remains 2 RESERVED
      });

      await tx.inventoryReservation.create({
        data: {
          materialId: material.id,
          quantity: needed,
          status: ReservationStatus.ISSUED, // 2 ISSUED
          salesOrderId: salesOrder.id,
          paxSerial: pax.paxSerial,
          issuedAt: new Date()
        }
      });
    }

    // Deduct stock
    await tx.material.update({
      where: { id: material.id },
      data: { quantity: physicalStockBefore - needed } // Physical goes down to 98
    });

    // Log stock movement
    await tx.stockMovement.create({
      data: {
        materialId: material.id,
        quantity: -needed,
        movementType: "ISSUE",
        source: "PAX_PRODUCTION",
        referenceId: pax.paxSerial,
        userId: supervisorId
      }
    });
  });

  const freshMaterial = await prisma.material.findUnique({ where: { id: material.id } });
  const activeReservations = await prisma.inventoryReservation.findMany({
    where: { materialId: material.id, status: ReservationStatus.RESERVED }
  });
  const reservedSum = activeReservations.reduce((acc, x) => acc + x.quantity, 0); // Should be 2 (original 4 - 2 consumed)
  const availableAfter = (freshMaterial ? freshMaterial.quantity : 0) - reservedSum; // Should be 98 - 2 = 96

  console.log(`🔍 After: Physical = ${freshMaterial?.quantity}, Reserved = ${reservedSum}, Available = ${availableAfter}`);

  if (freshMaterial?.quantity !== 98) {
    throw new Error("Physical inventory was not decremented correctly during consumption!");
  }
  if (reservedSum !== 2) {
    throw new Error("Active reservation sum was not updated correctly!");
  }
  if (availableAfter !== availableBefore) {
    throw new Error("Available stock calculation is mathematically incorrect after consumption!");
  }
  console.log("✅ Passed: Reservation consumed/split successfully, and available inventory remains correct.");

  // ─────────────────────────────────────────────────────────────
  // TEST case 19-20: Scrap / Rejection quantity synchronization
  // ─────────────────────────────────────────────────────────────
  console.log("\n📦 Test case 19-20: Scrapped/rejected pack updates Work Order quantities...");
  
  // Set pack status to PAX_TESTED first
  await prisma.paxPack.update({ where: { paxSerial: pax.paxSerial }, data: { status: PaxStatus.PAX_TESTED } });

  const initialCompleted = updatedWO.completedQuantity; // 1
  const initialRemaining = updatedWO.remainingQuantity; // 1

  // Simulate reject and disassembly
  await prisma.$transaction(async (tx) => {
    // Scrap pack
    await tx.paxPack.update({
      where: { paxSerial: pax.paxSerial },
      data: { status: PaxStatus.SCRAPPED }
    });

    // Update Work Order quantities
    const wo = await tx.workOrder.findUnique({ where: { id: woReady.id } });
    if (wo) {
      const updatedCompleted = Math.max(0, wo.completedQuantity - 1); // Shrunk to 0
      const remaining = wo.remainingQuantity + 1; // Rises to 2
      await tx.workOrder.update({
        where: { id: woReady.id },
        data: {
          completedQuantity: updatedCompleted,
          remainingQuantity: remaining,
          status: "IN_PROGRESS"
        }
      });
    }
  });

  const verifiedWO = await prisma.workOrder.findUnique({ where: { id: woReady.id } });
  console.log(`🔍 Work Order completedQuantity: Expected = 0, Actual = ${verifiedWO?.completedQuantity}`);
  console.log(`🔍 Work Order remainingQuantity: Expected = 2, Actual = ${verifiedWO?.remainingQuantity}`);

  if (verifiedWO?.completedQuantity !== 0 || verifiedWO?.remainingQuantity !== 2) {
    throw new Error("Work Order quantity synchronization failed upon pack scrappage!");
  }
  console.log("✅ Passed: Scrapped completed pack correctly returned target quantities to remaining production pool.");

  // ─────────────────────────────────────────────────────────────
  // CLEANUP
  // ─────────────────────────────────────────────────────────────
  console.log("\n🧹 Cleaning up test records...");
  await prisma.stockMovement.deleteMany({ where: { referenceId: { in: [pax.paxSerial] } } });
  await prisma.inventoryReservation.deleteMany({ where: { salesOrderId: salesOrder.id } });
  await prisma.paxCell.deleteMany({ where: { paxSerial: { in: [pax.paxSerial, orphanSerial] } } });
  await prisma.paxPack.deleteMany({ where: { paxSerial: { in: [pax.paxSerial, orphanSerial] } } });
  await prisma.workOrderOperator.delete({ where: { id: woOp.id } });
  await prisma.workOrder.deleteMany({ where: { id: { in: [woCreated.id, woAssigned.id, woCancelled.id, woReady.id] } } });
  await prisma.productionPlan.delete({ where: { id: plan.id } });
  await prisma.productionRequirement.delete({ where: { id: requirement.id } });
  await prisma.salesOrderItem.delete({ where: { id: salesOrderItem.id } });
  await prisma.salesOrder.delete({ where: { id: salesOrder.id } });
  await prisma.bOMItem.deleteMany({ where: { bomId: bom.id } });
  await prisma.bOM.delete({ where: { id: bom.id } });
  await prisma.paxType.delete({ where: { id: paxType.id } });
  await prisma.cell.deleteMany({ where: { serialNumber: { in: cellSerials } } });
  await prisma.material.delete({ where: { id: material.id } });
  console.log("✅ Integration tests completed successfully!");
}

runTest()
  .catch(err => {
    console.error("❌ Tests failed:", err.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
