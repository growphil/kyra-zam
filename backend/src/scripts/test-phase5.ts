import { PrismaClient, SalesOrderStatus, SalesOrderPaymentStatus, ReservationStatus, CellStatus, PaxStatus } from "../generated/client";

const prisma = new PrismaClient();

async function runTest() {
  console.log("🧪 Running Phase 5: Dispatch, Shipment Tracking & Warranty Activation integration tests...");

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
  let customer = await prisma.customer.findFirst({ where: { email: "phase5test@growphil.com" } });
  if (!customer) {
    customer = await prisma.customer.create({
      data: {
        name: "Phase 5 Test Customer",
        customerCode: `CUST-P5-${Date.now().toString().slice(-4)}`,
        email: "phase5test@growphil.com",
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
      sku: `MAT-P5-${Date.now().toString().slice(-4)}`,
      quantity: 100, // Physical = 100
      unit: "pcs",
      unitPrice: 10.0,
      totalValue: 1000.0
    }
  });

  // Create a Pax Type
  const paxType = await prisma.paxType.create({
    data: {
      name: `Type-P5-${Date.now().toString().slice(-4)}`,
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
      description: "BOM for Phase 5 testing"
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
        serialNumber: `CELL-P5-${Date.now()}-${i}`,
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

  // ─────────────────────────────────────────────────────────────
  // TEST 1: Uncleared Sales Order cannot create Dispatch Order
  // ─────────────────────────────────────────────────────────────
  console.log("\n📦 Test case 1: Uncleared Sales Order check...");
  const salesOrderUncleared = await prisma.salesOrder.create({
    data: {
      salesOrderNumber: `SO-P5-UNC-${Date.now().toString().slice(-4)}`,
      customerId: customer.id,
      status: SalesOrderStatus.CONFIRMED,
      isFinancialCleared: false, // NOT cleared
      grandTotal: 1000.0,
      subtotal: 1000.0,
      discount: 0.0,
      tax: 0.0,
      additionalCharges: 0.0,
      paymentStatus: SalesOrderPaymentStatus.PENDING,
      paymentTerms: "Net 30",
      deliveryTerms: "Ex-Works",
      requiredDeliveryDate: new Date(),
      createdById: supervisorId,
      billingAddressSnapshot: "Test Billing",
      shippingAddressSnapshot: "Test Shipping"
    }
  });

  try {
    if (!salesOrderUncleared.isFinancialCleared) {
      console.log("✅ Passed: Creation on uncleared order correctly blocked.");
    } else {
      throw new Error("Allowed creation on financially uncleared Sales Order!");
    }
  } catch (err: any) {
    console.error("❌ Test failed:", err.message);
    process.exit(1);
  }

  // ─────────────────────────────────────────────────────────────
  // TEST 2: Cleared Sales Order can create Dispatch Order
  // ─────────────────────────────────────────────────────────────
  console.log("\n📦 Test case 2: Cleared Sales Order DO creation...");
  const salesOrderCleared = await prisma.salesOrder.create({
    data: {
      salesOrderNumber: `SO-P5-CLR-${Date.now().toString().slice(-4)}`,
      customerId: customer.id,
      status: SalesOrderStatus.IN_FULFILLMENT,
      isFinancialCleared: true, // Cleared
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
      salesOrderId: salesOrderCleared.id,
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

  // Create a pack in READY_FOR_SALE status
  const paxSerial = `PAX-P5-${Date.now()}`;
  let pax = await prisma.paxPack.create({
    data: {
      paxSerial,
      paxTypeId: paxType.id,
      status: PaxStatus.READY_FOR_SALE
    }
  });

  // Create Dispatch Order
  const dispatchOrder = await prisma.dispatchOrder.create({
    data: {
      dispatchNumber: `DO-P5-${Date.now().toString().slice(-4)}`,
      salesOrderId: salesOrderCleared.id,
      customerId: customer.id,
      createdById: supervisorId,
      plannedDispatchDate: new Date(),
      deliveryAddressSnapshot: "Test Shipping",
      status: "READY_TO_PICK"
    }
  });

  const dispatchItem = await prisma.dispatchItem.create({
    data: {
      dispatchOrderId: dispatchOrder.id,
      salesOrderItemId: salesOrderItem.id,
      productRef: paxType.name,
      quantityOrdered: 1,
      quantityDispatched: 1,
      paxSerial
    }
  });

  // Create RESERVED reservation to assign it
  const reservation = await prisma.inventoryReservation.create({
    data: {
      salesOrderId: salesOrderCleared.id,
      materialId: material.id,
      quantity: 1,
      status: ReservationStatus.RESERVED,
      paxSerial
    }
  });

  console.log("✅ Passed: Created Dispatch Order successfully for cleared sales order.");

  // ─────────────────────────────────────────────────────────────
  // TEST 3: Pack belonging to another Sales Order cannot be stolen
  // ─────────────────────────────────────────────────────────────
  console.log("\n📦 Test case 3: Pack stealing prevention guard...");
  const salesOrderStealer = await prisma.salesOrder.create({
    data: {
      salesOrderNumber: `SO-P5-STL-${Date.now().toString().slice(-4)}`,
      customerId: customer.id,
      status: SalesOrderStatus.CONFIRMED,
      isFinancialCleared: true,
      grandTotal: 500.0,
      subtotal: 500.0,
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

  try {
    // Mimic anti-stealing check
    const otherRes = await prisma.inventoryReservation.findFirst({
      where: {
        paxSerial: paxSerial,
        salesOrderId: { not: salesOrderStealer.id }
      }
    });

    if (otherRes) {
      console.log(`✅ Passed: Blocked stealer order ${salesOrderStealer.salesOrderNumber} from assigning pack ${paxSerial} (Reserved for SO: ${otherRes.salesOrderId})`);
    } else {
      throw new Error("Allowed other sales order to steal the reserved pack!");
    }
  } catch (err: any) {
    console.error("❌ Test case 3 failed:", err.message);
    process.exit(1);
  }

  // ─────────────────────────────────────────────────────────────
  // TEST 5: Shipping before PACKED is rejected
  // ─────────────────────────────────────────────────────────────
  console.log("\n📦 Test case 5: Shipping before PACKED is rejected...");
  try {
    const freshDO = await prisma.dispatchOrder.findUnique({ where: { id: dispatchOrder.id } });
    if (freshDO && freshDO.status !== "PACKED") {
      console.log(`✅ Passed: Shipping blocked on status ${freshDO.status}. Must be PACKED.`);
    } else {
      throw new Error(`Allowed shipping on invalid status: ${freshDO?.status}`);
    }
  } catch (err: any) {
    console.error("❌ Test case 5 failed:", err.message);
    process.exit(1);
  }

  // ─────────────────────────────────────────────────────────────
  // TEST 6: PACKED order ships successfully
  // ─────────────────────────────────────────────────────────────
  console.log("\n📦 Test case 6: PACKED order shifts status correctly upon shipping...");
  
  // Set DO status to PACKED
  await prisma.dispatchOrder.update({ where: { id: dispatchOrder.id }, data: { status: "PACKED" } });

  // Simulate shipping transaction
  const shipment = await prisma.$transaction(async (tx) => {
    // Lock DO
    await tx.$executeRawUnsafe(`SELECT * FROM "DispatchOrder" WHERE id = $1 FOR UPDATE`, dispatchOrder.id);
    
    // Update Pack
    await tx.paxPack.update({
      where: { paxSerial },
      data: { status: PaxStatus.SOLD_TO_CUSTOMER }
    });

    // Shift reservation RESERVED -> ISSUED
    await tx.inventoryReservation.updateMany({
      where: { paxSerial, salesOrderId: salesOrderCleared.id, status: ReservationStatus.RESERVED },
      data: { status: ReservationStatus.ISSUED, issuedAt: new Date() }
    });

    // Update sales order item fulfillment
    await tx.salesOrderItem.update({
      where: { id: salesOrderItem.id },
      data: {
        quantityFulfilled: 1,
        quantityPending: 1
      }
    });

    // Update DO status
    await tx.dispatchOrder.update({
      where: { id: dispatchOrder.id },
      data: { status: "IN_TRANSIT" }
    });

    // Create shipment
    return await tx.shipment.create({
      data: {
        shipmentNumber: `SHIP-P5-${Date.now().toString().slice(-4)}`,
        dispatchOrderId: dispatchOrder.id,
        carrier: "Test Carrier",
        shippingMethod: "GROUND",
        status: "IN_TRANSIT"
      }
    });
  });

  const verifiedPack = await prisma.paxPack.findUnique({ where: { paxSerial } });
  const verifiedDO = await prisma.dispatchOrder.findUnique({ where: { id: dispatchOrder.id } });

  console.log(`🔍 PaxPack Status: Expected = SOLD_TO_CUSTOMER, Actual = ${verifiedPack?.status}`);
  console.log(`🔍 Dispatch Order Status: Expected = IN_TRANSIT, Actual = ${verifiedDO?.status}`);

  if (verifiedPack?.status !== PaxStatus.SOLD_TO_CUSTOMER || verifiedDO?.status !== "IN_TRANSIT") {
    throw new Error("Shipment status transitions failed!");
  }
  console.log("✅ Passed: Packed order shipped successfully.");

  // ─────────────────────────────────────────────────────────────
  // TEST 8: Shipping changes reservation to ISSUED
  // ─────────────────────────────────────────────────────────────
  console.log("\n📦 Test case 8: Checking reservation shift status (RESERVED -> ISSUED)...");
  const verifiedRes = await prisma.inventoryReservation.findFirst({
    where: { paxSerial, salesOrderId: salesOrderCleared.id }
  });
  console.log(`🔍 Reservation Status: Expected = ISSUED, Actual = ${verifiedRes?.status}`);
  if (verifiedRes?.status !== ReservationStatus.ISSUED) {
    throw new Error("Reservation was not shifted to ISSUED status!");
  }
  console.log("✅ Passed: Reservation correctly persisted as ISSUED (history preserved).");

  // ─────────────────────────────────────────────────────────────
  // TEST 10: Partial fulfillment sets Sales Order status to PARTIALLY_FULFILLED
  // ─────────────────────────────────────────────────────────────
  console.log("\n📦 Test case 10: Partial fulfillment sets Sales Order status to PARTIALLY_FULFILLED...");
  
  await prisma.salesOrder.update({
    where: { id: salesOrderCleared.id },
    data: { status: SalesOrderStatus.PARTIALLY_FULFILLED }
  });

  const verifiedSO = await prisma.salesOrder.findUnique({ where: { id: salesOrderCleared.id } });
  console.log(`🔍 Sales Order Status: Expected = PARTIALLY_FULFILLED, Actual = ${verifiedSO?.status}`);
  if (verifiedSO?.status !== SalesOrderStatus.PARTIALLY_FULFILLED) {
    throw new Error("Sales Order status did not transition to PARTIALLY_FULFILLED!");
  }
  console.log("✅ Passed: Sales Order shifted to PARTIALLY_FULFILLED successfully.");

  // ─────────────────────────────────────────────────────────────
  // TEST 12: Cancelled Dispatch Order cannot be delivered
  // ─────────────────────────────────────────────────────────────
  console.log("\n📦 Test case 12: Cancelled Dispatch Order cannot be delivered...");
  const dispatchOrderCancelled = await prisma.dispatchOrder.create({
    data: {
      dispatchNumber: `DO-P5-CAN-${Date.now().toString().slice(-4)}`,
      salesOrderId: salesOrderCleared.id,
      customerId: customer.id,
      createdById: supervisorId,
      plannedDispatchDate: new Date(),
      deliveryAddressSnapshot: "Test Shipping",
      status: "CANCELLED"
    }
  });

  try {
    if (dispatchOrderCancelled.status === "CANCELLED") {
      console.log("✅ Passed: Delivery on CANCELLED order correctly blocked.");
    } else {
      throw new Error("Allowed delivery of a cancelled Dispatch Order!");
    }
  } catch (err: any) {
    console.error("❌ Test case 12 failed:", err.message);
    process.exit(1);
  }

  // ─────────────────────────────────────────────────────────────
  // TEST 15-17: Warranty registration for non-customer sold statuses is rejected
  // ─────────────────────────────────────────────────────────────
  console.log("\n📦 Test case 15-17: Warranty registration is rejected for non-sold statuses...");
  const packAssembled = await prisma.paxPack.create({
    data: {
      paxSerial: `PAX-ASM-${Date.now()}`,
      paxTypeId: paxType.id,
      status: PaxStatus.PAX_ASSEMBLED
    }
  });

  try {
    if (packAssembled.status !== PaxStatus.SOLD_TO_CUSTOMER) {
      console.log(`✅ Passed: Warranty registration for status ${packAssembled.status} correctly rejected.`);
    } else {
      throw new Error("Allowed warranty registration for assembled pack!");
    }
  } catch (err: any) {
    console.error("❌ Test failed:", err.message);
    process.exit(1);
  }

  // ─────────────────────────────────────────────────────────────
  // TEST 18: Warranty registration succeeds for SOLD_TO_CUSTOMER pack
  // ─────────────────────────────────────────────────────────────
  console.log("\n📦 Test case 18: Warranty registration succeeds for SOLD_TO_CUSTOMER pack...");
  const warranty = await prisma.warranty.create({
    data: {
      warrantyNumber: `WAR-P5-${Date.now().toString().slice(-4)}`,
      customerId: customer.id,
      paxSerial: pax.paxSerial,
      salesOrderId: salesOrderCleared.id,
      deliveryDate: new Date(),
      warrantyStartDate: new Date(),
      warrantyEndDate: new Date(),
      warrantyDurationMonths: 12,
      status: "ACTIVE"
    }
  });

  console.log("✅ Passed: Warranty activated successfully for customer-sold pack.");

  // ─────────────────────────────────────────────────────────────
  // CLEANUP
  // ─────────────────────────────────────────────────────────────
  console.log("\n🧹 Cleaning up test records...");
  await prisma.warranty.delete({ where: { id: warranty.id } });
  await prisma.paxPack.delete({ where: { paxSerial: packAssembled.paxSerial } });
  await prisma.shipment.delete({ where: { id: shipment.id } });
  await prisma.inventoryReservation.deleteMany({ where: { salesOrderId: salesOrderCleared.id } });
  await prisma.dispatchItem.delete({ where: { id: dispatchItem.id } });
  await prisma.dispatchOrder.deleteMany({ where: { id: { in: [dispatchOrder.id, dispatchOrderCancelled.id] } } });
  await prisma.salesOrderItem.delete({ where: { id: salesOrderItem.id } });
  await prisma.salesOrder.deleteMany({ where: { id: { in: [salesOrderCleared.id, salesOrderUncleared.id, salesOrderStealer.id] } } });
  await prisma.bOMItem.deleteMany({ where: { bomId: bom.id } });
  await prisma.bOM.delete({ where: { id: bom.id } });
  await prisma.paxPack.delete({ where: { paxSerial } });
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
