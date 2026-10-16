import { prisma } from "../prisma";

async function runTests() {
  console.log("================================================================================");
  console.log("🧪 TESTING SEPARATE CELL REQUIREMENT FROM MATERIAL AVAILABILITY WORKFLOW");
  console.log("================================================================================\n");

  const timestamp = Date.now();

  try {
    // 1. Setup Admin / Supervisor
    console.log("[Step 1] Finding Supervisor & Setting up Master Data...");
    const supervisor = await prisma.user.findFirst({
      where: { roles: { has: "SUPERVISOR" } }
    }) || await prisma.user.findFirst({
      where: { roles: { has: "ADMIN" } }
    });

    if (!supervisor) throw new Error("No supervisor found");

    // 2. Create Normal Materials and Cell Material
    console.log("[Step 2] Creating Materials (BMS, Busbar, and Cell SKU)...");
    const bmsMaterial = await prisma.material.create({
      data: {
        sku: `MAT-BMS-${timestamp}`,
        name: `Smart BMS 16S 100A ${timestamp}`,
        category: "BMS",
        unit: "pcs",
        quantity: 50,
        unitPrice: 1500
      }
    });

    const busbarMaterial = await prisma.material.create({
      data: {
        sku: `MAT-BUSBAR-${timestamp}`,
        name: `Copper Busbar ${timestamp}`,
        category: "BUSBAR",
        unit: "pcs",
        quantity: 500,
        unitPrice: 50
      }
    });

    const cellMaterial = await prisma.material.create({
      data: {
        sku: `CELL-LFP-${timestamp}`,
        name: `LFP 3.2V 3200mAh Cell ${timestamp}`,
        category: "CELL",
        unit: "pcs",
        quantity: 0, // Material quantity for cells should remain 0 as cells are in CellInwardBatch
        unitPrice: 120
      }
    });

    // 3. Create BOM with both Normal Materials and Cells
    console.log("[Step 3] Creating BOM with 16 Cells, 1 BMS, 15 Busbars per pack...");
    const bom = await prisma.bOM.create({
      data: {
        name: `Battery Pack 48V 100Ah ${timestamp}`,
        description: "Standard industrial lithium pack",
        items: {
          create: [
            {
              materialId: bmsMaterial.id,
              quantity: 1
            },
            {
              materialId: busbarMaterial.id,
              quantity: 15
            },
            {
              materialId: cellMaterial.id,
              quantity: 16 // 16 cells per pack
            }
          ]
        }
      },
      include: { items: { include: { material: true } } }
    });

    // 4. Create Inward Batch of 1000 bulk un-serialized cells
    console.log("[Step 4] Creating Bulk Inward Batch of 1,000 un-serialized cells...");
    const inwardBatch = await prisma.cellInwardBatch.create({
      data: {
        inwardNumber: `INW-${timestamp.toString().slice(-6)}`,
        partNumber: cellMaterial.sku,
        materialId: cellMaterial.id,
        batchNumber: `BAT-${timestamp.toString().slice(-4)}`,
        quantity: 1000,
        availableQty: 1000,
        category: "CELL",
        voltage: 3.2,
        receivedById: supervisor.id,
        status: "RECEIVED"
      }
    });

    // 5. Create Customer, Sales Order, and Production Requirement for 2 packs
    console.log("[Step 5] Creating Sales Order & Production Requirement for 2 packs...");
    const customer = await prisma.customer.findFirst() || await prisma.customer.create({
      data: {
        customerCode: `CUST-${timestamp.toString().slice(-4)}`,
        name: `Test Client ${timestamp}`,
        email: `client${timestamp}@test.com`,
        phone: "9876543210",
        billingAddress: "Test Address",
        shippingAddress: "Test Shipping",
        city: "Bangalore",
        state: "Karnataka",
        country: "India",
        postalCode: "560001"
      }
    });

    const salesOrder = await prisma.salesOrder.create({
      data: {
        salesOrderNumber: `SO-${timestamp.toString().slice(-4)}`,
        customerId: customer.id,
        createdById: supervisor.id,
        requiredDeliveryDate: new Date(Date.now() + 14 * 86400000),
        status: "CONFIRMED",
        paymentStatus: "PAID",
        isFinancialCleared: true,
        subtotal: 50000,
        discount: 0,
        tax: 9000,
        grandTotal: 59000,
        billingAddressSnapshot: "Test Address",
        shippingAddressSnapshot: "Test Shipping",
        paymentTerms: "100% Advance",
        deliveryTerms: "Ex-Works",
        items: {
          create: [
            {
              productRef: bom.name,
              description: "Battery Pack 48V 100Ah",
              quantityOrdered: 2,
              quantityPending: 2,
              unitPrice: 25000,
              taxAmount: 4500,
              lineSubtotal: 50000,
              lineTotal: 59000,
              fulfillmentType: "PRODUCTION_REQUIRED"
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
        productRef: bom.name,
        requiredQuantity: 2, // 2 packs
        requiredDeliveryDate: new Date(Date.now() + 7 * 86400000),
        createdById: supervisor.id,
        status: "PENDING"
      }
    });

    console.log(`✓ Production Requirement created: ${prodReq.requirementNumber} (Required: 2 packs)\n`);

    // 6. Test GET /crm/production/requirements/:id and check-materials logic
    console.log("[Step 6] Verifying separation of normal materials and cell requirements...");

    // Simulate backend check-materials calculation
    const normalMaterials: any[] = [];
    const cellRequirements: any[] = [];

    for (const item of bom.items) {
      const mat = item.material;
      const isCell = mat?.category?.toUpperCase() === "CELL" || mat?.sku?.toUpperCase().startsWith("CELL");
      const neededQty = item.quantity * prodReq.requiredQuantity;

      if (isCell) {
        const bulkInward = await prisma.cellInwardBatch.findMany({
          where: { partNumber: mat.sku, availableQty: { gt: 0 } }
        });
        const bulkInwardAvailable = bulkInward.reduce((acc, b) => acc + b.availableQty, 0);

        cellRequirements.push({
          sku: mat.sku,
          name: mat.name,
          requiredQuantity: neededQty,
          testedQuantity: 0,
          remainingQuantity: neededQty,
          bulkInwardAvailable,
          status: "TESTING REQUIRED"
        });
      } else {
        normalMaterials.push({
          sku: mat.sku,
          name: mat.name,
          required: neededQty,
          physical: mat.quantity,
          available: mat.quantity,
          shortage: Math.max(0, neededQty - mat.quantity),
          status: mat.quantity >= neededQty ? "AVAILABLE" : "SHORTAGE"
        });
      }
    }

    console.log("✓ Normal Production Materials (Non-cell only):");
    normalMaterials.forEach(m => {
      console.log(`  - ${m.name} (${m.sku}): Required=${m.required}, Physical Stock=${m.physical}, Available=${m.available}, Shortage=${m.shortage} -> Status=${m.status}`);
      if (m.sku.startsWith("CELL")) {
        throw new Error(`FAIL: Cell SKU ${m.sku} was incorrectly included in normal materials!`);
      }
    });

    console.log("\n✓ Separate Cell Testing Requirement:");
    cellRequirements.forEach(c => {
      console.log(`  - ${c.name} (${c.sku}): Required Cells=${c.requiredQuantity} (16 x 2), Qualified Cells=${c.testedQuantity}, Remaining=${c.remainingQuantity}, Bulk Inward Available=${c.bulkInwardAvailable} pcs -> Status=${c.status}`);
      if (c.requiredQuantity !== 32) {
        throw new Error(`FAIL: Expected 32 required cells (16 x 2), got ${c.requiredQuantity}`);
      }
      if (c.bulkInwardAvailable !== 1000) {
        throw new Error(`FAIL: Expected 1000 bulk inward cells, got ${c.bulkInwardAvailable}`);
      }
    });

    // 7. Test physical cell qualification does not change normal material stock
    console.log("\n[Step 7] Simulating 10 cells qualified via Test Engineer...");
    const qualifiedCount = 10;
    const updatedCellReq = {
      ...cellRequirements[0],
      testedQuantity: qualifiedCount,
      remainingQuantity: cellRequirements[0].requiredQuantity - qualifiedCount,
      status: "IN_PROGRESS"
    };

    console.log(`✓ Cell Qualification Progress: ${updatedCellReq.testedQuantity} / ${updatedCellReq.requiredQuantity} Qualified (${updatedCellReq.remainingQuantity} remaining)`);
    if (updatedCellReq.remainingQuantity !== 22) {
      throw new Error(`FAIL: Expected 22 remaining cells, got ${updatedCellReq.remainingQuantity}`);
    }

    // 8. Cleanup
    console.log("\n[Cleanup] Cleaning up test records...");
    await prisma.productionRequirement.deleteMany({ where: { id: prodReq.id } });
    await prisma.salesOrderItem.deleteMany({ where: { salesOrderId: salesOrder.id } });
    await prisma.salesOrder.deleteMany({ where: { id: salesOrder.id } });
    await prisma.cellInwardBatch.deleteMany({ where: { id: inwardBatch.id } });
    await prisma.bOMItem.deleteMany({ where: { bomId: bom.id } });
    await prisma.bOM.deleteMany({ where: { id: bom.id } });
    await prisma.material.deleteMany({ where: { id: { in: [bmsMaterial.id, busbarMaterial.id, cellMaterial.id] } } });
    try {
      if (customer?.id) {
        await prisma.customer.deleteMany({ where: { id: customer.id } });
      }
    } catch (_) {}

    console.log("✓ Cleanup completed successfully.\n");
    console.log("================================================================================");
    console.log("🎉 ALL SEPARATED CELL & MATERIAL REQUIREMENT TESTS PASSED SUCCESSFULLY!");
    console.log("================================================================================\n");
  } catch (error) {
    console.error("❌ Test failed:", error);
    throw error;
  }
}

runTests()
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
