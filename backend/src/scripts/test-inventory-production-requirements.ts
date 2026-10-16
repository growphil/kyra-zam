import axios from "axios";
import { prisma } from "../prisma";

const BASE_URL = process.env.API_URL || "http://127.0.0.1:8000";

async function main() {
  console.log("================================================================================");
  console.log("TESTING INVENTORY MANAGER PRODUCTION MATERIAL REQUIREMENT VIEW WORKFLOW");
  console.log("================================================================================\n");

  const timestamp = Date.now();
  const TEST_PREFIX = `IM-TEST-${timestamp}`;

  // 1. Authenticate roles
  const invLogin = await axios.post(`${BASE_URL}/auth/login`, {
    email: "inv@kyrazam.com",
    password: "InvMgr@2025"
  });
  const invToken = invLogin.data.accessToken;
  console.log("✓ Inventory Manager Logged in:", invLogin.data.user.name);

  const supLogin = await axios.post(`${BASE_URL}/auth/login`, {
    email: "super@kyrazam.com",
    password: "Supervisor@2025"
  });
  const supervisorToken = supLogin.data.accessToken;
  console.log("✓ Supervisor Logged in:", supLogin.data.user.name);

  // Helper axios client for Inventory Manager
  const invApi = axios.create({
    baseURL: BASE_URL,
    headers: { Authorization: `Bearer ${invToken}` }
  });

  const supApi = axios.create({
    baseURL: BASE_URL,
    headers: { Authorization: `Bearer ${supervisorToken}` }
  });

  // Step 1: Create Test Materials with physical stock
  console.log("\n[Step 1] Setting up Materials and BOM...");
  const matCell = await prisma.material.create({
    data: {
      name: `LFP Cell 3.2V 100Ah ${TEST_PREFIX}`,
      category: "Cells",
      sku: `CELL-${TEST_PREFIX}`,
      quantity: 500, // Physical stock
      unit: "pcs",
      minStock: 50,
      unitPrice: 1500,
      totalValue: 750000,
      isPriceVerified: true
    }
  });

  const matBMS = await prisma.material.create({
    data: {
      name: `Smart BMS 16S 100A ${TEST_PREFIX}`,
      category: "Electronics",
      sku: `BMS-${TEST_PREFIX}`,
      quantity: 5, // Shortage stock (we need 10 for WO)
      unit: "pcs",
      minStock: 10,
      unitPrice: 4500,
      totalValue: 22500,
      isPriceVerified: true
    }
  });

  const matBusbar = await prisma.material.create({
    data: {
      name: `Copper Busbar 2x20mm ${TEST_PREFIX}`,
      category: "Hardware",
      sku: `BUSBAR-${TEST_PREFIX}`,
      quantity: 200, // Plenty of stock
      unit: "pcs",
      minStock: 20,
      unitPrice: 120,
      totalValue: 24000,
      isPriceVerified: true
    }
  });

  // Step 2: Create BOM
  const testBOM = await prisma.bOM.create({
    data: {
      name: `Industrial Pack 48V 100Ah ${TEST_PREFIX}`,
      description: "Standard 48V 100Ah Battery Pack with 16 cells and 1 BMS",
      items: {
        create: [
          { materialId: matCell.id, quantity: 16 }, // 16 cells per pack
          { materialId: matBMS.id, quantity: 1 },    // 1 BMS per pack
          { materialId: matBusbar.id, quantity: 15 } // 15 busbars per pack
        ]
      }
    },
    include: { items: true }
  });
  console.log(`✓ BOM Created: ${testBOM.name} with ${testBOM.items.length} materials`);

  // Step 3: Create Customer, Sales Order, and SalesOrderItem
  console.log("\n[Step 2] Creating Sales Order, Production Requirement & Work Order...");
  const customer = await prisma.customer.findFirst() || await prisma.customer.create({
    data: {
      customerCode: `CUS-${timestamp}`,
      name: "Acme Power Industries",
      email: `acme-${timestamp}@example.com`,
      phone: "9876543210",
      billingAddress: "123 Industrial Area",
      shippingAddress: "123 Industrial Area",
      city: "Bangalore",
      state: "Karnataka",
      country: "India",
      postalCode: "560001"
    }
  });

  const adminUser = await prisma.user.findFirst({ where: { roles: { has: "ADMIN" } } }) || 
                    await prisma.user.findFirst();

  const salesOrder = await prisma.salesOrder.create({
    data: {
      salesOrderNumber: `SO-${timestamp}`,
      customerId: customer.id,
      createdById: adminUser!.id,
      requiredDeliveryDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      status: "CONFIRMED",
      paymentStatus: "PAID",
      isFinancialCleared: true,
      subtotal: 500000,
      discount: 0,
      tax: 90000,
      grandTotal: 590000,
      paymentTerms: "100% Advance",
      deliveryTerms: "Ex-Works",
      billingAddressSnapshot: "123 Industrial Area",
      shippingAddressSnapshot: "123 Industrial Area",
      priority: "HIGH",
      items: {
        create: [
          {
            productRef: testBOM.name,
            description: "Industrial Lithium Battery Pack 48V 100Ah",
            quantityOrdered: 10,
            quantityPending: 10,
            unitPrice: 50000,
            taxAmount: 9000,
            lineSubtotal: 500000,
            lineTotal: 590000,
            fulfillmentType: "PRODUCTION_REQUIRED"
          }
        ]
      }
    },
    include: { items: true }
  });

  const soItem = salesOrder.items[0];

  const reqNumber = `PRD-${timestamp}`;
  const prodReq = await prisma.productionRequirement.create({
    data: {
      requirementNumber: reqNumber,
      salesOrderId: salesOrder.id,
      salesOrderItemId: soItem.id,
      customerId: customer.id,
      productRef: testBOM.name,
      requiredQuantity: 10, // 10 packs
      requiredDeliveryDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      priority: "HIGH",
      status: "PENDING",
      createdById: adminUser!.id
    }
  });

  const planNumber = `PLAN-${timestamp}`;
  const prodPlan = await prisma.productionPlan.create({
    data: {
      planNumber,
      productionRequirementId: prodReq.id,
      plannedStartDate: new Date(),
      plannedCompletionDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      plannedQuantity: 10,
      priority: "HIGH",
      status: "PLANNED",
      createdById: adminUser!.id
    }
  });

  const woNumber = `WO-${timestamp}`;
  const workOrder = await prisma.workOrder.create({
    data: {
      workOrderNumber: woNumber,
      productionPlanId: prodPlan.id,
      productionRequirementId: prodReq.id,
      salesOrderId: salesOrder.id,
      productRef: testBOM.name,
      bomId: testBOM.id,
      plannedQuantity: 10,
      remainingQuantity: 10,
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      status: "CREATED"
    }
  });
  console.log(`✓ Work Order Created: ${workOrder.workOrderNumber} (Planned Qty: 10 Packs)`);

  // Step 4: Call GET /inventory/production-requirements
  console.log("\n[Step 3] Fetching GET /inventory/production-requirements for Inventory Manager...");
  const prodReqsRes = await invApi.get("/inventory/production-requirements");
  const data = prodReqsRes.data;

  console.log("✓ Production Requirements Response Summary:", data.summary);
  if (!data.orders || data.orders.length === 0) {
    throw new Error("Expected at least one production order in response");
  }

  const foundWo = data.orders.find((o: any) => o.id === workOrder.id);
  if (!foundWo) {
    throw new Error(`Work Order ${workOrder.workOrderNumber} not found in /inventory/production-requirements`);
  }

  console.log(`✓ Found Work Order ${foundWo.workOrderNumber} in response.`);
  console.log(`  - Product: ${foundWo.productRef}`);
  console.log(`  - Planned Qty: ${foundWo.plannedQuantity}`);
  console.log(`  - WorkOrder Status: ${foundWo.status}`);
  console.log(`  - Computed Material Status: ${foundWo.materialStatus}`);
  console.log(`  - Required Materials Count: ${foundWo.materials.length}`);

  // Verify material calculations:
  // 1. Cells: 16 * 10 = 160 required. Physical = 500. Reserved = 0. Shortage = 0.
  const cellReq = foundWo.materials.find((m: any) => m.materialId === matCell.id);
  if (!cellReq || cellReq.requiredQty !== 160 || cellReq.availableStock !== 500 || cellReq.shortageQty !== 0) {
    throw new Error(`Invalid calculation for Cells: required=${cellReq?.requiredQty}, available=${cellReq?.availableStock}, shortage=${cellReq?.shortageQty}`);
  }
  console.log(`  ✓ Cell Material Check Passed: Required=160, Available=500, Shortage=0 (Status=${cellReq.status})`);

  // 2. BMS: 1 * 10 = 10 required. Physical = 5. Reserved = 0. Shortage = 5!
  const bmsReq = foundWo.materials.find((m: any) => m.materialId === matBMS.id);
  if (!bmsReq || bmsReq.requiredQty !== 10 || bmsReq.availableStock !== 5 || bmsReq.shortageQty !== 5) {
    throw new Error(`Invalid calculation for BMS: required=${bmsReq?.requiredQty}, available=${bmsReq?.availableStock}, shortage=${bmsReq?.shortageQty}`);
  }
  console.log(`  ✓ BMS Material Check Passed: Required=10, Available=5, Shortage=5 (Status=${bmsReq.status})`);

  // 3. Busbar: 15 * 10 = 150 required. Physical = 200. Reserved = 0. Shortage = 0.
  const busbarReq = foundWo.materials.find((m: any) => m.materialId === matBusbar.id);
  if (!busbarReq || busbarReq.requiredQty !== 150 || busbarReq.availableStock !== 200 || busbarReq.shortageQty !== 0) {
    throw new Error(`Invalid calculation for Busbar: required=${busbarReq?.requiredQty}, available=${busbarReq?.availableStock}, shortage=${busbarReq?.shortageQty}`);
  }
  console.log(`  ✓ Busbar Material Check Passed: Required=150, Available=200, Shortage=0 (Status=${busbarReq.status})`);

  if (foundWo.materialStatus !== "SHORTAGE") {
    throw new Error(`Expected WorkOrder materialStatus to be SHORTAGE, got ${foundWo.materialStatus}`);
  }
  console.log("✓ Work Order overall materialStatus correctly identified as SHORTAGE");

  // Step 5: Test Shortage Summary Aggregation
  console.log("\n[Step 4] Verifying Shortage Summary Aggregation...");
  const bmsShortageSummary = data.shortageSummary.find((s: any) => s.materialId === matBMS.id);
  if (!bmsShortageSummary || bmsShortageSummary.totalShortage !== 5) {
    throw new Error("Shortage Summary did not correctly aggregate BMS shortage of 5 units");
  }
  console.log(`✓ Shortage Summary verified: ${bmsShortageSummary.name} has total shortage of ${bmsShortageSummary.totalShortage} units across ${bmsShortageSummary.affectedWorkOrders.length} order(s)`);

  // Step 6: Test Shortage PR Spawning
  console.log("\n[Step 5] Testing Shortage Purchase Request Spawning from Inventory Manager...");
  const spawnRes = await invApi.post(`/crm/production/work-orders/${workOrder.id}/spawn-purchase-request`, {
    materialId: matBMS.id,
    shortageQty: 5
  });
  console.log(`✓ Purchase Request Spawned: ${spawnRes.data.prNumber}, Status: ${spawnRes.data.status}`);

  // Test duplicate prevention
  console.log("\n[Step 6] Verifying Duplicate Purchase Request Prevention...");
  try {
    await invApi.post(`/crm/production/work-orders/${workOrder.id}/spawn-purchase-request`, {
      materialId: matBMS.id,
      shortageQty: 5
    });
    throw new Error("Expected duplicate PR creation to fail with 400 Bad Request");
  } catch (err: any) {
    if (err.response?.status === 400 && err.response?.data?.error?.includes("already exists")) {
      console.log(`✓ Duplicate PR correctly prevented: "${err.response.data.error}"`);
    } else {
      throw err;
    }
  }

  // Step 7: Replenish stock to test Allocation
  console.log("\n[Step 7] Replenishing BMS stock to resolve shortage...");
  await prisma.material.update({
    where: { id: matBMS.id },
    data: { quantity: 25 } // Enough now (25 >= 10)
  });
  console.log("✓ BMS Stock updated to 25 pcs");

  const refreshedData = (await invApi.get("/inventory/production-requirements")).data;
  const refreshedWo = refreshedData.orders.find((o: any) => o.id === workOrder.id);
  console.log(`✓ Refreshed Work Order materialStatus: ${refreshedWo.materialStatus} (hasShortage=${refreshedWo.hasShortage})`);

  // Step 8: Allocate materials
  console.log("\n[Step 8] Allocating materials for Work Order...");
  const allocateRes = await invApi.post(`/crm/production/work-orders/${workOrder.id}/allocate`, {});
  console.log(`✓ Material allocation succeeded! Work Order status is now ${allocateRes.data.status}`);

  // Verify inventory reservations created
  const reservations = await prisma.inventoryReservation.findMany({
    where: { salesOrderId: salesOrder.id, status: "RESERVED" }
  });
  console.log(`✓ Active Reservations Created: ${reservations.length} records`);

  const postAllocData = (await invApi.get("/inventory/production-requirements")).data;
  const postAllocWo = postAllocData.orders.find((o: any) => o.id === workOrder.id);
  if (postAllocWo.status !== "READY" || postAllocWo.materialStatus !== "ALLOCATED") {
    throw new Error(`Expected WorkOrder to be READY and ALLOCATED, got status=${postAllocWo.status}, materialStatus=${postAllocWo.materialStatus}`);
  }
  console.log(`✓ Inventory View confirms: Work Order is READY and materials are ALLOCATED`);

  // Step 9: Supervisor starts Work Order -> IN_PROGRESS
  console.log("\n[Step 9] Supervisor starts Work Order...");
  await supApi.put(`/crm/production/work-orders/${workOrder.id}/status`, {
    status: "IN_PROGRESS"
  });

  const inProgData = (await invApi.get("/inventory/production-requirements")).data;
  const inProgWo = inProgData.orders.find((o: any) => o.id === workOrder.id);
  if (inProgWo.status !== "IN_PROGRESS" || inProgWo.materialStatus !== "IN_PRODUCTION") {
    throw new Error(`Expected WorkOrder to be IN_PROGRESS and IN_PRODUCTION, got ${inProgWo.status} / ${inProgWo.materialStatus}`);
  }
  console.log(`✓ Inventory Manager sees Work Order in ACTIVE PRODUCTION: Status=${inProgWo.status}, MaterialStatus=${inProgWo.materialStatus}`);

  // Step 10: Verify RBAC (Inventory Manager cannot execute supervisor actions like complete/pause)
  console.log("\n[Step 10] Testing RBAC: Inventory Manager attempting to update WorkOrder status manually...");
  try {
    await invApi.put(`/crm/production/work-orders/${workOrder.id}/status`, {
      status: "COMPLETED"
    });
    throw new Error("Expected manual complete by Inventory Manager to be blocked");
  } catch (err: any) {
    if (err.response?.status === 400 || err.response?.status === 403) {
      console.log(`✓ Strict RBAC Enforced: Manual completion blocked (${err.response.status})`);
    } else {
      throw err;
    }
  }

  // Cleanup
  console.log("\n[Cleanup] Cleaning up test data...");
  await prisma.inventoryReservation.deleteMany({ where: { salesOrderId: salesOrder.id } });
  await prisma.stockMovement.deleteMany({ where: { materialId: { in: [matCell.id, matBMS.id, matBusbar.id] } } });
  await prisma.purchaseRequestItem.deleteMany({ where: { materialId: { in: [matCell.id, matBMS.id, matBusbar.id] } } });
  await prisma.purchaseRequest.deleteMany({ where: { sourceReferenceId: { in: [prodReq.id, workOrder.id] } } });
  await prisma.workOrder.deleteMany({ where: { id: workOrder.id } });
  await prisma.productionPlan.deleteMany({ where: { id: prodPlan.id } });
  await prisma.productionRequirement.deleteMany({ where: { id: prodReq.id } });
  await prisma.salesOrderItem.deleteMany({ where: { salesOrderId: salesOrder.id } });
  await prisma.salesOrder.deleteMany({ where: { id: salesOrder.id } });
  await prisma.bOMItem.deleteMany({ where: { bomId: testBOM.id } });
  await prisma.bOM.deleteMany({ where: { id: testBOM.id } });
  await prisma.material.deleteMany({ where: { id: { in: [matCell.id, matBMS.id, matBusbar.id] } } });
  console.log("✓ Test records cleaned up successfully");

  console.log("\n================================================================================");
  console.log("🎉 ALL PRODUCTION MATERIAL REQUIREMENT TESTS PASSED SUCCESSFULLY!");
  console.log("================================================================================\n");
}

main().catch((err) => {
  console.error("❌ Test Failed:", err);
  process.exit(1);
});
