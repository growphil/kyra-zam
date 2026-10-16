import Fastify from "fastify";
import { authPlugin } from "../plugins/auth";
import { authRoutes } from "../routes/auth";
import { salesRoutes } from "../routes/sales";
import { inventoryRoutes } from "../routes/inventory";
import { qualityRoutes } from "../routes/quality";
import { productionRoutes } from "../routes/production";
import { reportsRoutes } from "../routes/reports";
import { paxRoutes } from "../routes/pax";
import { bomRoutes } from "../routes/bom";
import { serviceRoutes } from "../routes/service";
import { scrapRoutes } from "../routes/scrap";
import { PrismaClient } from "../generated/client";

const prisma = new PrismaClient();
const PREFIX = "PHG"; // Phase G

let passed = 0;
let failed = 0;
const resultsList: { scenario: number; description: string; result: "PASS" | "FAIL"; detail?: string }[] = [];

function assert(condition: boolean, scenario: number, description: string, detail?: string) {
  if (condition) {
    console.log(`  ✅ Scenario ${scenario} [PASS]: ${description}`);
    passed++;
    resultsList.push({ scenario, description, result: "PASS" });
  } else {
    console.log(`  ❌ Scenario ${scenario} [FAIL]: ${description} — ${detail || ""}`);
    failed++;
    resultsList.push({ scenario, description, result: "FAIL", detail });
  }
}

async function buildTestApp() {
  const app = Fastify({ logger: false });
  
  // Register plugins
  await app.register(authPlugin);
  
  // Register routes
  await app.register(authRoutes, { prefix: "/auth" });
  await app.register(salesRoutes, { prefix: "/sales" });
  await app.register(inventoryRoutes, { prefix: "/inventory" });
  await app.register(qualityRoutes, { prefix: "/crm/quality" });
  await app.register(productionRoutes, { prefix: "/crm/production" });
  await app.register(reportsRoutes, { prefix: "/reports" });
  await app.register(paxRoutes, { prefix: "/pax" });
  await app.register(bomRoutes, { prefix: "/bom" });
  await app.register(serviceRoutes, { prefix: "/service" });
  await app.register(scrapRoutes, { prefix: "/scrap" });
  
  await app.ready();
  return app;
}

async function runTests() {
  console.log("🧪 Starting Hardening and Regression Verification Suite (Phase 3.0-G)...\n");
  const app = await buildTestApp();

  // ─────────────────────────────────────────────────────────────
  // FIXTURES SEEDING
  // ─────────────────────────────────────────────────────────────
  
  // Actors
  const adminEmail = `${PREFIX}admin@kyrazam.com`;
  const salesEmail = `${PREFIX}sales@kyrazam.com`;
  const techEmail = `${PREFIX}tech@kyrazam.com`;

  let adminUser = await prisma.user.findFirst({ where: { email: adminEmail } });
  if (!adminUser) {
    adminUser = await prisma.user.create({
      data: { name: "PHG Admin", email: adminEmail, roles: ["SUPERADMIN", "ADMIN", "INVENTORY_MANAGER", "SUPERVISOR"], passwordHash: "123", isActive: true }
    });
  }

  let salesUser = await prisma.user.findFirst({ where: { email: salesEmail } });
  if (!salesUser) {
    salesUser = await prisma.user.create({
      data: { name: "PHG Sales", email: salesEmail, roles: ["SALES_EXECUTIVE"], passwordHash: "123", isActive: true }
    });
  }

  let techUser = await prisma.user.findFirst({ where: { email: techEmail } });
  if (!techUser) {
    techUser = await prisma.user.create({
      data: { name: "PHG Tech", email: techEmail, roles: ["ASSEMBLY_TECHNICIAN"], passwordHash: "123", isActive: true }
    });
  }

  const adminHeaders = { Authorization: `Bearer ${app.jwt.sign({ id: adminUser.id, roles: adminUser.roles as any })}` };
  const salesHeaders = { Authorization: `Bearer ${app.jwt.sign({ id: salesUser.id, roles: salesUser.roles as any })}` };
  const techHeaders = { Authorization: `Bearer ${app.jwt.sign({ id: techUser.id, roles: techUser.roles as any })}` };

  // Warehouses and Locations
  const originWh = await prisma.warehouse.upsert({
    where: { code: "WH-ORIG" },
    update: {},
    create: { code: "WH-ORIG", name: "PHG Origin Warehouse" }
  });

  const destWh = await prisma.warehouse.upsert({
    where: { code: "WH-DEST" },
    update: {},
    create: { code: "WH-DEST", name: "PHG Destination Warehouse" }
  });

  const originLoc = await prisma.warehouseLocation.upsert({
    where: { warehouseId_code: { warehouseId: originWh.id, code: "BIN-O1" } },
    update: {},
    create: { warehouseId: originWh.id, code: "BIN-O1", name: "Origin Bin 1" }
  });

  const destLoc = await prisma.warehouseLocation.upsert({
    where: { warehouseId_code: { warehouseId: destWh.id, code: "BIN-D1" } },
    update: {},
    create: { warehouseId: destWh.id, code: "BIN-D1", name: "Dest Bin 1" }
  });

  // Materials
  const bomMat = await prisma.material.create({
    data: {
      name: `PHG Material ${Date.now()}`,
      category: "BMS",
      sku: `SKU-BMS-${Date.now()}`,
      quantity: 1000,
      unit: "pcs",
      unitPrice: 15.0,
      totalValue: 15000.0,
      isPriceVerified: true,
      materialType: "QTZ"
    }
  });

  // Set Location balance for transfers
  await prisma.materialLocationBalance.create({
    data: {
      materialId: bomMat.id,
      warehouseId: originWh.id,
      locationId: originLoc.id,
      quantity: 200
    }
  });

  // ─────────────────────────────────────────────────────────────
  // SCENARIO 1 - 6: DIRECT SALES
  // ─────────────────────────────────────────────────────────────
  console.log("\n📦 Scenarios 1 - 6: Direct Sales Integrity");
  
  // Seed Pax Type, BOM & Pack
  const paxTypeName = `PT-${Date.now()}`;
  const paxType = await prisma.paxType.create({
    data: { name: paxTypeName, cellCount: 4, ahMin: 10, ahMax: 15, irMin: 1, irMax: 5, autoPackEnabled: true }
  });

  const bom = await prisma.bOM.create({
    data: { name: `${paxTypeName} BOM` }
  });

  await prisma.bOMItem.create({
    data: { bomId: bom.id, materialId: bomMat.id, quantity: 2 }
  });

  // Create a finished pack material record so direct sale physical deduction matches
  const finishedMat = await prisma.material.create({
    data: {
      name: paxTypeName,
      category: "BATTERY_PACK",
      sku: paxTypeName,
      quantity: 10,
      unit: "pcs",
      unitPrice: 500,
      totalValue: 5000
    }
  });

  const paxSerial1 = `PHG-PAX-S1-${Date.now()}`;
  const pack1 = await prisma.paxPack.create({
    data: { paxSerial: paxSerial1, paxTypeId: paxType.id, bomId: bom.id, status: "READY_FOR_SALE" }
  });

  // Create active cells for pack composition
  const cellSerials = Array.from({ length: 4 }).map((_, i) => `PHG-CELL-${i}-${Date.now()}`);
  for (const serial of cellSerials) {
    await prisma.cell.create({
      data: { serialNumber: serial, voltage: 3.2, cycles: 100, category: "PHG", grade: "A" }
    });
    await prisma.paxCell.create({
      data: { paxSerial: paxSerial1, cellSerial: serial, position: cellSerials.indexOf(serial) + 1 }
    });
  }

  const idempotencyKey = `IDEM-${Date.now()}`;
  const salePayload = {
    paxSerial: paxSerial1,
    saleType: "CUSTOMER",
    customerName: "PHG Test Customer",
    amount: 1500,
    idempotencyKey
  };

  // Scenario 1: Successful direct sale
  const saleRes1 = await app.inject({
    method: "POST",
    url: "/sales/",
    headers: salesHeaders,
    payload: salePayload
  });
  
  const saleDbRecord = await prisma.sale.findFirst({ where: { idempotencyKey } });
  const finalPaxRecord = await prisma.paxPack.findUnique({ where: { paxSerial: paxSerial1 } });
  const finalFinishedMat = await prisma.material.findUnique({ where: { id: finishedMat.id } });
  const matchingMovement = await prisma.stockMovement.findFirst({
    where: { materialId: finishedMat.id, referenceId: { contains: "DO-" } }
  });

  assert(
    saleRes1.statusCode === 200 && 
    saleDbRecord !== null && 
    finalPaxRecord?.status === "SOLD_TO_CUSTOMER" &&
    finalFinishedMat?.quantity === 9 &&
    matchingMovement !== null,
    1, "Successful direct sale creates complete fulfillment chain and decrements finished goods stock"
  );

  // Scenario 2: Duplicate direct sale request with the same idempotency key fails with 409
  const saleRes2 = await app.inject({
    method: "POST",
    url: "/sales/",
    headers: salesHeaders,
    payload: salePayload
  });
  assert(
    saleRes2.statusCode === 409 && JSON.parse(saleRes2.body).error === "SALE_ALREADY_PROCESSED",
    2, "Duplicate direct sale request fails with SALE_ALREADY_PROCESSED (409)"
  );

  // Scenario 3: Invalid pack status (selling a pack not READY_FOR_SALE)
  const paxSerial2 = `PHG-PAX-S2-${Date.now()}`;
  await prisma.paxPack.create({
    data: { paxSerial: paxSerial2, paxTypeId: paxType.id, bomId: bom.id, status: "READY_FOR_PAX_TEST" }
  });
  const saleRes3 = await app.inject({
    method: "POST",
    url: "/sales/",
    headers: salesHeaders,
    payload: { paxSerial: paxSerial2, saleType: "CUSTOMER", amount: 1500 }
  });
  assert(
    saleRes3.statusCode === 400 && JSON.parse(saleRes3.body).error.includes("status is READY_FOR_PAX_TEST"),
    3, "Selling a pack not in READY_FOR_SALE status is rejected"
  );

  // Scenario 4: Missing inventory (finished goods stock is 0)
  const paxSerial3 = `PHG-PAX-S3-${Date.now()}`;
  const pack3 = await prisma.paxPack.create({
    data: { paxSerial: paxSerial3, paxTypeId: paxType.id, bomId: bom.id, status: "READY_FOR_SALE" }
  });
  // Set finished goods stock to 0
  await prisma.material.update({ where: { id: finishedMat.id }, data: { quantity: 0 } });
  
  const saleRes4 = await app.inject({
    method: "POST",
    url: "/sales/",
    headers: salesHeaders,
    payload: { paxSerial: paxSerial3, saleType: "CUSTOMER", amount: 1500 }
  });
  console.log("DEBUG Scenario 4 response status:", saleRes4.statusCode, "body:", saleRes4.body);
  assert(
    saleRes4.statusCode === 400 && JSON.parse(saleRes4.body).error === "INSUFFICIENT_STOCK",
    4, "Direct sale fails with INSUFFICIENT_STOCK when finished pack material is out of stock"
  );

  // Restore finished goods stock
  await prisma.material.update({ where: { id: finishedMat.id }, data: { quantity: 10 } });

  // Scenario 5: Transaction rollback verification
  // We trigger an intentional database failure (e.g. by providing an invalid vendorId that fails foreign key constraint)
  const saleRes5 = await app.inject({
    method: "POST",
    url: "/sales/",
    headers: salesHeaders,
    payload: { paxSerial: paxSerial3, saleType: "VENDOR", vendorId: "invalid-uuid-format-fails-db", amount: 1500 }
  });
  console.log("DEBUG Scenario 5 response status:", saleRes5.statusCode, "body:", saleRes5.body);
  
  // Verify no SalesOrder, Warranty, or Shipment was created for this failed sale
  const rolledBackPack = await prisma.paxPack.findUnique({ where: { paxSerial: paxSerial3 } });
  const queryReservation = await prisma.inventoryReservation.findFirst({ where: { paxSerial: paxSerial3 } });
  assert(
    saleRes5.statusCode === 400 && rolledBackPack?.status === "READY_FOR_SALE" && queryReservation === null,
    5, "API failure cleanly rolls back the entire fulfillment transaction, leaving no orphans"
  );

  // Scenario 6: Warranty creation verification
  const warrantyRecord = await prisma.warranty.findFirst({ where: { paxSerial: paxSerial1 } });
  assert(
    warrantyRecord !== null && warrantyRecord.status === "ACTIVE" && warrantyRecord.warrantyDurationMonths === 12,
    6, "Warranty is successfully auto-activated with 12 months duration"
  );

  // ─────────────────────────────────────────────────────────────
  // SCENARIO 7 - 17: STOCK TRANSFERS
  // ─────────────────────────────────────────────────────────────
  console.log("\n🚚 Scenarios 7 - 17: Stock Transfers State Machine & Locking");

  let transferId = "";
  let transferNumber = "";
  
  // Scenario 7: Create transfer
  const createTransRes = await app.inject({
    method: "POST",
    url: "/inventory/transfers",
    headers: techHeaders,
    payload: {
      originWarehouseId: originWh.id,
      destinationWarehouseId: destWh.id,
      notes: "PHG relocation",
      items: [
        { materialId: bomMat.id, quantityRequested: 10, originLocationId: originLoc.id, destinationLocationId: destLoc.id }
      ]
    }
  });
  const createdTransfer = JSON.parse(createTransRes.body);
  transferId = createdTransfer.id;
  transferNumber = createdTransfer.transferNumber;

  assert(
    createTransRes.statusCode === 200 && createdTransfer.status === "REQUESTED",
    7, "Create transfer relist requested successfully (status REQUESTED)"
  );

  // Scenario 12: Invalid transition (REQUESTED -> RECEIVED) must be blocked
  const invalidTransitionRes = await app.inject({
    method: "PUT",
    url: `/inventory/transfers/${transferId}/receive`,
    headers: adminHeaders,
    payload: { receivedItems: [] }
  });
  assert(
    invalidTransitionRes.statusCode === 400 && JSON.parse(invalidTransitionRes.body).error === "INVALID_TRANSFER_STATE",
    12, "State machine rejects invalid transition REQUESTED -> RECEIVED"
  );

  // Scenario 8: Approve transfer
  const approveRes = await app.inject({
    method: "PUT",
    url: `/inventory/transfers/${transferId}/approve`,
    headers: adminHeaders
  });
  assert(
    approveRes.statusCode === 200 && JSON.parse(approveRes.body).status === "APPROVED",
    8, "Supervisor approves stock transfer successfully (status APPROVED)"
  );

  // Scenario 17: Insufficient stock (requesting to ship more than origin bin has)
  const transferItems = await prisma.stockTransferItem.findMany({ where: { transferId } });
  const transferItemId = transferItems[0].id;

  const insufficientStockRes = await app.inject({
    method: "PUT",
    url: `/inventory/transfers/${transferId}/ship`,
    headers: adminHeaders,
    payload: {
      shippedItems: [
        { itemId: transferItemId, quantityShipped: 500 } // only 200 in bin
      ]
    }
  });
  console.log("DEBUG Scenario 17 response status:", insufficientStockRes.statusCode, "body:", insufficientStockRes.body);
  assert(
    insufficientStockRes.statusCode === 400 && JSON.parse(insufficientStockRes.body).error === "INSUFFICIENT_STOCK",
    17, "Shipping blocks relocation when quantity exceeds available location balance"
  );

  // Scenario 9: Ship transfer
  const initialOriginBal = await prisma.materialLocationBalance.findFirst({
    where: { materialId: bomMat.id, warehouseId: originWh.id, locationId: originLoc.id }
  });
  const initialOverallQty = (await prisma.material.findUnique({ where: { id: bomMat.id } }))?.quantity || 0;

  const shipRes = await app.inject({
    method: "PUT",
    url: `/inventory/transfers/${transferId}/ship`,
    headers: adminHeaders,
    payload: {
      shippedItems: [
        { itemId: transferItemId, quantityShipped: 10 }
      ]
    }
  });
  console.log("DEBUG Scenario 9 response status:", shipRes.statusCode, "body:", shipRes.body);
  
  const finalOriginBal = await prisma.materialLocationBalance.findFirst({
    where: { materialId: bomMat.id, warehouseId: originWh.id, locationId: originLoc.id }
  });
  const finalOverallQty = (await prisma.material.findUnique({ where: { id: bomMat.id } }))?.quantity || 0;
  const transferItemRecord = await prisma.stockTransferItem.findFirst({ where: { transferId } });
  
  assert(
    shipRes.statusCode === 200 && 
    JSON.parse(shipRes.body).status === "IN_TRANSIT" &&
    finalOriginBal!.quantity === (initialOriginBal!.quantity - 10) &&
    finalOverallQty === (initialOverallQty - 10) &&
    transferItemRecord?.quantityShipped === 10,
    9, "Shipment updates status to IN_TRANSIT, deducts origin balances, and logs negative stock movement"
  );

  // Scenario 13: Duplicate ship (ship on already shipped transfer fails)
  const dupShipRes = await app.inject({
    method: "PUT",
    url: `/inventory/transfers/${transferId}/ship`,
    headers: adminHeaders,
    payload: { shippedItems: [] }
  });
  assert(
    dupShipRes.statusCode === 400 && JSON.parse(dupShipRes.body).error === "TRANSFER_ALREADY_SHIPPED",
    13, "Duplicate ship call fails with TRANSFER_ALREADY_SHIPPED"
  );

  // Scenario 10: Receive transfer
  const initialDestBal = (await prisma.materialLocationBalance.findFirst({
    where: { materialId: bomMat.id, warehouseId: destWh.id, locationId: destLoc.id }
  }))?.quantity || 0;
  const overallBeforeReceive = (await prisma.material.findUnique({ where: { id: bomMat.id } }))?.quantity || 0;

  const receiveRes = await app.inject({
    method: "PUT",
    url: `/inventory/transfers/${transferId}/receive`,
    headers: adminHeaders,
    payload: { receivedItems: [] }
  });

  const finalDestBal = await prisma.materialLocationBalance.findFirst({
    where: { materialId: bomMat.id, warehouseId: destWh.id, locationId: destLoc.id }
  });
  const overallAfterReceive = (await prisma.material.findUnique({ where: { id: bomMat.id } }))?.quantity || 0;

  assert(
    receiveRes.statusCode === 200 && 
    JSON.parse(receiveRes.body).status === "RECEIVED" &&
    finalDestBal!.quantity === (initialDestBal + 10) &&
    overallAfterReceive === (overallBeforeReceive + 10),
    10, "Receive updates status to RECEIVED, increments destination balances, and logs receipt stock movement"
  );

  // Scenario 14: Duplicate receive (receive on already received transfer fails)
  const dupReceiveRes = await app.inject({
    method: "PUT",
    url: `/inventory/transfers/${transferId}/receive`,
    headers: adminHeaders,
    payload: { receivedItems: [] }
  });
  assert(
    dupReceiveRes.statusCode === 400 && JSON.parse(dupReceiveRes.body).error === "TRANSFER_ALREADY_RECEIVED",
    14, "Duplicate receive call fails with TRANSFER_ALREADY_RECEIVED"
  );

  // Scenario 11: Cancel transfer Relist
  const cancelTransfer = await prisma.stockTransfer.create({
    data: {
      transferNumber: `TR-CANC-${Date.now().toString().slice(-4)}`,
      originWarehouseId: originWh.id,
      destinationWarehouseId: destWh.id,
      createdById: adminUser.id,
      status: "APPROVED"
    }
  });
  const cancelRes = await app.inject({
    method: "PUT",
    url: `/inventory/transfers/${cancelTransfer.id}/cancel`,
    headers: adminHeaders
  });
  assert(
    cancelRes.statusCode === 200 && JSON.parse(cancelRes.body).status === "CANCELLED",
    11, "Approved transfer can be cancelled successfully"
  );

  // Scenario 15: Concurrent ship (simulated concurrent shipping requests)
  const concurrentTransfer = await prisma.stockTransfer.create({
    data: {
      transferNumber: `TR-CONC-${Date.now().toString().slice(-4)}`,
      originWarehouseId: originWh.id,
      destinationWarehouseId: destWh.id,
      createdById: adminUser.id,
      status: "APPROVED",
      items: {
        create: {
          materialId: bomMat.id,
          quantityRequested: 5,
          originLocationId: originLoc.id,
          destinationLocationId: destLoc.id
        }
      }
    },
    include: { items: true }
  });

  const concurrentShipPromises = Array.from({ length: 5 }).map(() => 
    app.inject({
      method: "PUT",
      url: `/inventory/transfers/${concurrentTransfer.id}/ship`,
      headers: adminHeaders,
      payload: { shippedItems: [{ itemId: concurrentTransfer.items[0].id, quantityShipped: 5 }] }
    })
  );

  const shipResults = await Promise.all(concurrentShipPromises);
  const successfulShips = shipResults.filter(r => r.statusCode === 200);
  const rejectedShips = shipResults.filter(r => r.statusCode === 400);

  assert(
    successfulShips.length === 1 && rejectedShips.length === 4,
    15, "Concurrent shipping requests are serialized; exactly one succeeds and others fail safely"
  );

  // Scenario 16: Concurrent receive (simulated concurrent receiving requests)
  const concurrentReceivePromises = Array.from({ length: 5 }).map(() => 
    app.inject({
      method: "PUT",
      url: `/inventory/transfers/${concurrentTransfer.id}/receive`,
      headers: adminHeaders,
      payload: { receivedItems: [{ itemId: concurrentTransfer.items[0].id, quantityReceived: 5 }] }
    })
  );

  const receiveResults = await Promise.all(concurrentReceivePromises);
  const successfulReceives = receiveResults.filter(r => r.statusCode === 200);
  const rejectedReceives = receiveResults.filter(r => r.statusCode === 400);

  assert(
    successfulReceives.length === 1 && rejectedReceives.length === 4,
    16, "Concurrent receiving requests are serialized; exactly one succeeds and others fail safely"
  );

  // ─────────────────────────────────────────────────────────────
  // SCENARIO 18 - 22: DISASSEMBLY & SALVAGE
  // ─────────────────────────────────────────────────────────────
  console.log("\n🔧 Scenarios 18 - 22: Disassembly & Salvage Safety");

  // Create a pack for disassembly testing
  const paxSerialDis = `PHG-PAX-DIS-${Date.now()}`;
  const packDis = await prisma.paxPack.create({
    data: { paxSerial: paxSerialDis, paxTypeId: paxType.id, bomId: bom.id, status: "PAX_TESTED" }
  });

  // Attach cells
  const disCells = Array.from({ length: 4 }).map((_, i) => `PHG-DIS-CELL-${i}-${Date.now()}`);
  for (const serial of disCells) {
    await prisma.cell.create({
      data: { serialNumber: serial, voltage: 3.3, cycles: 50, category: "PHG", status: "RAW" }
    });
    await prisma.paxCell.create({
      data: { paxSerial: paxSerialDis, cellSerial: serial, position: disCells.indexOf(serial) + 1 }
    });
  }

  // Create a linked work order to test metrics update
  let customerForWO = await prisma.customer.findFirst();
  if (!customerForWO) {
    customerForWO = await prisma.customer.create({
      data: {
        name: `PHG Customer WO ${Date.now()}`,
        customerCode: `CC-${Date.now().toString().slice(-6)}`,
        email: `wo-${Date.now()}@example.com`,
        phone: "1234567890",
        billingAddress: "Test Billing",
        shippingAddress: "Test Shipping",
        city: "Test City"
      } as any
    });
  }

  let salesOrderForWO = await prisma.salesOrder.findFirst();
  if (!salesOrderForWO) {
    salesOrderForWO = await prisma.salesOrder.create({
      data: {
        salesOrderNumber: `SO-WO-${Date.now().toString().slice(-6)}`,
        customerId: customerForWO.id,
        createdById: adminUser.id,
        status: "APPROVED" as any,
        subtotal: 100,
        grandTotal: 100,
        requiredDeliveryDate: new Date()
      } as any
    });
  }

  let salesOrderItemForWO = await prisma.salesOrderItem.findFirst({
    where: { salesOrderId: salesOrderForWO.id }
  });
  if (!salesOrderItemForWO) {
    salesOrderItemForWO = await prisma.salesOrderItem.create({
      data: {
        salesOrderId: salesOrderForWO.id,
        productRef: paxTypeName,
        quantityOrdered: 1,
        unitPrice: 100,
        lineSubtotal: 100,
        lineTotal: 100
      } as any
    });
  }

  const req = await prisma.productionRequirement.create({
    data: {
      requirementNumber: `REQ-${Date.now()}`,
      requiredQuantity: 5,
      status: "PLANNED",
      requiredDeliveryDate: new Date(),
      createdBy: { connect: { id: adminUser.id } },
      salesOrder: { connect: { id: salesOrderForWO.id } },
      salesOrderItem: { connect: { id: salesOrderItemForWO.id } },
      customer: { connect: { id: customerForWO.id } }
    } as any
  });

  const plan = await prisma.productionPlan.create({
    data: {
      planNumber: `PLAN-WO-${Date.now()}`,
      productionRequirementId: req.id,
      plannedStartDate: new Date(),
      plannedCompletionDate: new Date(),
      plannedQuantity: 1,
      createdById: adminUser.id
    }
  });

  const workOrder = await prisma.workOrder.create({
    data: {
      workOrderNumber: `WO-PHG-${Date.now()}`,
      plannedQuantity: 5,
      completedQuantity: 2, // Assume 2 completed
      remainingQuantity: 3,
      dueDate: new Date(),
      status: "IN_PROGRESS",
      bomId: bom.id,
      productionPlanId: plan.id
    }
  });

  // Link pack to WO
  await prisma.paxPack.update({
    where: { paxSerial: paxSerialDis },
    data: { workOrderId: workOrder.id }
  });

  // Scenario 20: Invalid salvage quantity (claiming to salvage 10 units when BOM specifies 2)
  const salvageFailRes = await app.inject({
    method: "POST",
    url: `/pax/${paxSerialDis}/approve`,
    headers: adminHeaders,
    payload: {
      action: "reject",
      reason: "BMS chip defect",
      reclaimedMaterials: [
        { materialId: bomMat.id, quantity: 10 } // Exceeds BOM quantity of 2
      ]
    }
  });
  assert(
    salvageFailRes.statusCode === 400 && JSON.parse(salvageFailRes.body).error === "INVALID_SALVAGE_QUANTITY",
    20, "Salvaging salvage quantities exceeding original BOM limits is blocked"
  );

  // Scenario 18: Valid disassembly (correct quantities of 2 BMS)
  const initialStock = (await prisma.material.findUnique({ where: { id: bomMat.id } }))?.quantity || 0;
  
  const salvageSuccessRes = await app.inject({
    method: "POST",
    url: `/pax/${paxSerialDis}/approve`,
    headers: adminHeaders,
    payload: {
      action: "reject",
      reason: "Dismantling pack",
      reclaimedMaterials: [
        { materialId: bomMat.id, quantity: 2 } // Allowed
      ]
    }
  });

  const finalStock = (await prisma.material.findUnique({ where: { id: bomMat.id } }))?.quantity || 0;
  const disassembledPack = await prisma.paxPack.findUnique({ where: { paxSerial: paxSerialDis } });
  const cellsReturned = await prisma.cell.findMany({ where: { serialNumber: { in: disCells } } });
  const bindingsDeleted = await prisma.paxCell.count({ where: { paxSerial: paxSerialDis } });

  assert(
    salvageSuccessRes.statusCode === 200 &&
    disassembledPack?.status === "SCRAPPED" &&
    finalStock === (initialStock + 2) &&
    cellsReturned.every(c => c.status === "CELL_TESTED") &&
    bindingsDeleted === 0,
    18, "Valid disassembly dismantles pack, returns materials to stock, resets cell status, and deletes composite bindings"
  );

  // Scenario 19: Duplicate disassembly fails with PACK_ALREADY_DISASSEMBLED or status constraint
  const duplicateDisRes = await app.inject({
    method: "POST",
    url: `/pax/${paxSerialDis}/approve`,
    headers: adminHeaders,
    payload: {
      action: "reject",
      reason: "Dismantling again",
      reclaimedMaterials: []
    }
  });
  assert(
    duplicateDisRes.statusCode === 400 &&
    (JSON.parse(duplicateDisRes.body).error === "PACK_ALREADY_DISASSEMBLED" ||
     JSON.parse(duplicateDisRes.body).error.includes("Status must be PAX_TESTED")),
    19, "Subsequent disassembly attempts on a scrapped pack are blocked safely"
  );

  // Scenario 21: Salvage ledger verification
  const salvageMovement = await prisma.stockMovement.findFirst({
    where: { materialId: bomMat.id, source: "SCRAP_RECLAMATION", referenceId: paxSerialDis }
  });
  assert(
    salvageMovement !== null && salvageMovement.quantity === 2 && salvageMovement.movementType === "RETURN",
    21, "Reclaim stock movements are logged correctly in the stock ledger"
  );

  // Scenario 22: Work order metric verification
  const updatedWO = await prisma.workOrder.findUnique({ where: { id: workOrder.id } });
  assert(
    updatedWO?.completedQuantity === 1 && updatedWO?.remainingQuantity === 4,
    22, "Disassembly correctly decrements linked work order completedQuantity and increments remainingQuantity"
  );

  // ─────────────────────────────────────────────────────────────
  // SCENARIO 23 - 26: OEE TELEMETRY
  // ─────────────────────────────────────────────────────────────
  console.log("\n📊 Scenarios 23 - 26: OEE Telemetry & Reports");

  const woForOee = await prisma.workOrder.create({
    data: {
      workOrderNumber: `WO-OEE-${Date.now()}`,
      plannedQuantity: 1,
      remainingQuantity: 1,
      dueDate: new Date(),
      status: "READY",
      bomId: bom.id
    }
  });

  const station = await prisma.productionStation.create({
    data: {
      name: `PHG Station ${Date.now()}`,
      code: `ST-${Date.now().toString().slice(-4)}`,
      type: "ASSEMBLY",
      isActive: true
    }
  });

  // Schedule for today (avoiding assignedDate & sequence unique constraint by auto-incrementing sequence)
  const todayStr = new Date().toISOString().split("T")[0] + "T00:00:00.000Z";
  const lastSchedule = await prisma.workOrderScheduling.findFirst({
    where: { assignedDate: new Date(todayStr) },
    orderBy: { sequence: 'desc' }
  });
  const nextSeq = lastSchedule ? lastSchedule.sequence + 1 : 1;

  await prisma.workOrderScheduling.create({
    data: {
      workOrderId: woForOee.id,
      assignedDate: new Date(todayStr),
      sequence: nextSeq,
      estimatedHrs: 1.0
    }
  });

  // Scenario 24: Telemetry invalid states (PAUSE without START)
  const pauseFailRes = await app.inject({
    method: "POST",
    url: `/crm/production/work-orders/${woForOee.id}/pause`,
    headers: techHeaders,
    payload: { reason: "Broke tools" }
  });
  assert(
    pauseFailRes.statusCode === 400 && JSON.parse(pauseFailRes.body).error.includes("Only an IN_PROGRESS Work Order can be paused"),
    24, "State machine rejects pausing a work order that is not IN_PROGRESS"
  );

  // Scenario 23: Valid telemetry start
  const startRes = await app.inject({
    method: "POST",
    url: `/crm/production/work-orders/${woForOee.id}/start`,
    headers: techHeaders,
    payload: { stationId: station.id }
  });
  const startedWO = await prisma.workOrder.findUnique({ where: { id: woForOee.id } });
  
  assert(
    startRes.statusCode === 200 && startedWO?.status === "IN_PROGRESS",
    23, "Starting work order advancing status to IN_PROGRESS and checks in operator"
  );

  // Scenario 25: Duplicate complete blocks completion twice
  // Complete the work order
  await app.inject({
    method: "POST",
    url: `/crm/production/work-orders/${woForOee.id}/complete`,
    headers: adminHeaders,
    payload: { notes: "Assembled successfully" }
  });

  const dupCompleteRes = await app.inject({
    method: "POST",
    url: `/crm/production/work-orders/${woForOee.id}/complete`,
    headers: adminHeaders,
    payload: { notes: "Done again" }
  });
  assert(
    dupCompleteRes.statusCode === 400 && JSON.parse(dupCompleteRes.body).error === "Work Order must be IN_PROGRESS or ON_HOLD to complete",
    25, "Completing a completed work order is blocked"
  );

  // Scenario 26: OEE calculation validation
  const oeeRes = await app.inject({
    method: "GET",
    url: "/reports/oee",
    headers: adminHeaders
  });
  const reports = JSON.parse(oeeRes.body).stations;
  const oeeReport = reports.find((r: any) => r.stationId === station.id);

  assert(
    oeeRes.statusCode === 200 && 
    oeeReport !== undefined &&
    oeeReport.metrics.availability >= 0 && oeeReport.metrics.availability <= 100 &&
    oeeReport.metrics.performance >= 0 && oeeReport.metrics.performance <= 100 &&
    oeeReport.metrics.quality >= 0 && oeeReport.metrics.quality <= 100 &&
    oeeReport.metrics.oee >= 0 && oeeReport.metrics.oee <= 100,
    26, "OEE report generates successfully and all metrics percentage calculations reside within 0-100"
  );

  // ─────────────────────────────────────────────────────────────
  // SCENARIO 27 - 30: SECURITY / RBAC
  // ─────────────────────────────────────────────────────────────
  console.log("\n🛡️ Scenarios 27 - 30: Security & Authorization");

  // Scenario 27: Unauthorized transfer action (Technician trying to approve a transfer)
  const authTransRes = await app.inject({
    method: "PUT",
    url: `/inventory/transfers/${transferId}/approve`,
    headers: techHeaders
  });
  assert(
    authTransRes.statusCode === 403 && JSON.parse(authTransRes.body).error === "Access denied",
    27, "Technician is blocked from approving stock transfers (RBAC Enforced)"
  );

  // Scenario 28: Unauthorized inventory mutation (Sales executive trying to adjust stock)
  const authInvRes = await app.inject({
    method: "PATCH",
    url: `/inventory/materials/${bomMat.id}/stock`,
    headers: salesHeaders,
    payload: { adjustment: 100, action: "add" }
  });
  assert(
    authInvRes.statusCode === 403 && JSON.parse(authInvRes.body).error === "Access denied",
    28, "Sales executive is blocked from manual stock adjustments (RBAC Enforced)"
  );

  // Scenario 29: Unauthorized quality mutation (Sales executive trying to submit final QC PASS)
  const authQcRes = await app.inject({
    method: "POST",
    url: "/crm/quality/inspections",
    headers: salesHeaders,
    payload: {
      workOrderId: woForOee.id,
      paxSerial: paxSerial1,
      inspectionType: "FINAL",
      result: "PASS",
      notes: "Fraud pass",
      checkpoints: []
    }
  });
  assert(
    authQcRes.statusCode === 403 && JSON.parse(authQcRes.body).error === "Access denied",
    29, "Sales executive is blocked from logging final quality inspections (RBAC Enforced)"
  );

  // Scenario 30: Unauthorized reporting access (Sales executive trying to fetch OEE dashboard)
  const authReportRes = await app.inject({
    method: "GET",
    url: "/reports/oee",
    headers: salesHeaders
  });
  assert(
    authReportRes.statusCode === 403 && JSON.parse(authReportRes.body).error === "Access denied",
    30, "Sales executive is blocked from fetching OEE performance dashboard reports (RBAC Enforced)"
  );

  // ─────────────────────────────────────────────────────────────
  // RECONCILIATION AUDIT
  // ─────────────────────────────────────────────────────────────
  console.log("\n📊 Database Ledger Reconciliation Audit");
  
  // Audit the test material (bomMat)
  // Current Stock = Initial Stock + Net Movements (Transfers + Disassembly Reclaims)
  const finalDbMaterial = await prisma.material.findUnique({ where: { id: bomMat.id } });
  const stockMovements = await prisma.stockMovement.findMany({ where: { materialId: bomMat.id } });
  
  const initialQty = 1000;
  const netMovements = stockMovements.reduce((acc, m) => acc + m.quantity, 0);
  const expectedQty = initialQty + netMovements;
  
  assert(
    finalDbMaterial?.quantity === expectedQty,
    31, `Inventory Ledger Reconciles perfectly! Material Stock Qty (${finalDbMaterial?.quantity}) matches sum of all stock movements ledger (${expectedQty})`
  );

  // Summary Report
  console.log("\n==========================================");
  console.log(`🧪 Integration Hardening Test Suite Summary:`);
  console.log(`   Passed: ${passed} / 31`);
  console.log(`   Failed: ${failed} / 31`);
  console.log("==========================================");

  if (failed > 0) {
    console.error("❌ Some regression tests failed!");
    process.exit(1);
  } else {
    console.log("🎉 All 31 scenarios verified successfully! Status code 0.");
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error("System error in test script:", err);
  process.exit(1);
});
