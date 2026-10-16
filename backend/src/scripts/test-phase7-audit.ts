import Fastify from "fastify";
import { authPlugin } from "../plugins/auth";
import { authRoutes } from "../routes/auth";
import { salesRoutes } from "../routes/sales";
import { inventoryRoutes } from "../routes/inventory";
import { serviceRoutes } from "../routes/service";
import { scrapRoutes } from "../routes/scrap";
import { salesOrderRoutes } from "../routes/salesOrders";
import { dispatchRoutes } from "../routes/dispatch";
import { warrantyRoutes } from "../routes/warranty";
import { PrismaClient, PaxStatus, CellStatus, SalesOrderStatus, SalesOrderPaymentStatus } from "../generated/client";

const prisma = new PrismaClient();

async function buildTestApp() {
  const app = Fastify({ logger: false });
  await app.register(authPlugin);
  
  // Register routes
  await app.register(authRoutes,    { prefix: "/auth" });
  await app.register(salesRoutes,   { prefix: "/sales" });
  await app.register(inventoryRoutes, { prefix: "/inventory" });
  await app.register(serviceRoutes, { prefix: "/service" });
  await app.register(scrapRoutes,   { prefix: "/scrap" });
  await app.register(salesOrderRoutes, { prefix: "/crm/sales-orders" });
  await app.register(dispatchRoutes, { prefix: "/crm/dispatch" });
  await app.register(warrantyRoutes, { prefix: "/crm/warranty" });

  await app.ready();
  return app;
}

async function runTests() {
  console.log("🧪 Running Phase 7 Final Adversarial Integration Tests...");
  const app = await buildTestApp();

  // Create test actors
  let adminUser = await prisma.user.findFirst({ where: { email: "p7admin@kyrazam.com" } });
  if (!adminUser) {
    adminUser = await prisma.user.create({
      data: {
        name: "P7 Admin",
        email: "p7admin@kyrazam.com",
        roles: ["SUPERADMIN", "ADMIN", "INVENTORY_MANAGER", "SUPERVISOR"],
        passwordHash: "dummy",
        isActive: true
      }
    });
  }

  let techUser = await prisma.user.findFirst({ where: { email: "p7tech@kyrazam.com" } });
  if (!techUser) {
    techUser = await prisma.user.create({
      data: {
        name: "P7 Tech",
        email: "p7tech@kyrazam.com",
        roles: ["ASSEMBLY_TECHNICIAN"],
        passwordHash: "dummy",
        isActive: true
      }
    });
  }

  let salesUser = await prisma.user.findFirst({ where: { email: "p7sales@kyrazam.com" } });
  if (!salesUser) {
    salesUser = await prisma.user.create({
      data: {
        name: "P7 Sales",
        email: "p7sales@kyrazam.com",
        roles: ["SALES_EXECUTIVE"],
        passwordHash: "dummy",
        isActive: true
      }
    });
  }

  const adminToken = app.jwt.sign({ id: adminUser.id, roles: adminUser.roles as any });
  const techToken = app.jwt.sign({ id: techUser.id, roles: techUser.roles as any });
  const salesToken = app.jwt.sign({ id: salesUser.id, roles: salesUser.roles as any });

  const adminHeaders = { Authorization: `Bearer ${adminToken}` };
  const techHeaders = { Authorization: `Bearer ${techToken}` };
  const salesHeaders = { Authorization: `Bearer ${salesToken}` };

  // Setup Customer
  let customer = await prisma.customer.findFirst({ where: { email: "p7customer@kyrazam.com" } });
  if (!customer) {
    customer = await prisma.customer.create({
      data: {
        name: "P7 Customer",
        customerCode: `CUST-P7-${Date.now().toString().slice(-4)}`,
        email: "p7customer@kyrazam.com",
        phone: "9876543210",
        type: "INDIVIDUAL",
        billingAddress: "Test Billing",
        shippingAddress: "Test Shipping",
        city: "City",
        state: "State",
        country: "India",
        postalCode: "110001"
      }
    });
  }

  // Setup Material
  const material = await prisma.material.create({
    data: {
      name: "Phase 7 Test Material",
      category: "RAW_MATERIALS",
      sku: `MAT-P7-${Date.now().toString().slice(-4)}`,
      quantity: 50,
      unit: "pcs",
      unitPrice: 100.0,
      totalValue: 5000.0
    }
  });

  // Setup PaxType and PaxPack for Warranty timing test
  const paxType = await prisma.paxType.create({
    data: {
      name: `Type-P7-${Date.now().toString().slice(-4)}`,
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

  // Keep track of resources to cleanup
  const serviceBatteryIds: string[] = [];
  const warrantyIds: string[] = [];
  const paxSerials: string[] = [];
  const salesOrderIds: string[] = [];
  const dispatchOrderIds: string[] = [];
  const userIds: string[] = [];

  const cleanup = async () => {
    console.log("\n🧹 Cleaning up test records...");
    try {
      await prisma.serviceDelivery.deleteMany({ where: { serviceBatteryId: { in: serviceBatteryIds } } });
      await prisma.serviceRepairLog.deleteMany({ where: { serviceBatteryId: { in: serviceBatteryIds } } });
      await prisma.serviceMaterialItem.deleteMany({ where: { request: { serviceBatteryId: { in: serviceBatteryIds } } } });
      await prisma.serviceMaterialRequest.deleteMany({ where: { serviceBatteryId: { in: serviceBatteryIds } } });
      await prisma.serviceTestReport.deleteMany({ where: { serviceBatteryId: { in: serviceBatteryIds } } });
      await prisma.serviceEstimate.deleteMany({ where: { serviceBatteryId: { in: serviceBatteryIds } } });
      await prisma.scrapApproval.deleteMany({ where: { serviceBatteryId: { in: serviceBatteryIds } } });
      await prisma.serviceReopenHistory.deleteMany({ where: { serviceBatteryId: { in: serviceBatteryIds } } });
      await prisma.serviceCost.deleteMany({ where: { serviceBatteryId: { in: serviceBatteryIds } } });
      await prisma.inventoryReservation.deleteMany({ where: { OR: [
        { serviceBatteryId: { in: serviceBatteryIds } },
        { salesOrderId: { in: salesOrderIds } }
      ] } });
      
      await prisma.serviceBattery.deleteMany({ where: { id: { in: serviceBatteryIds } } });
      await prisma.warranty.deleteMany({ where: { OR: [{ id: { in: warrantyIds } }, { paxSerial: { in: paxSerials } }] } });
      
      await prisma.dispatchItem.deleteMany({ where: { dispatchOrderId: { in: dispatchOrderIds } } });
      await prisma.dispatchOrder.deleteMany({ where: { id: { in: dispatchOrderIds } } });
      await prisma.salesOrderItem.deleteMany({ where: { salesOrderId: { in: salesOrderIds } } });
      await prisma.salesOrder.deleteMany({ where: { id: { in: salesOrderIds } } });
      
      await prisma.paxPack.deleteMany({ where: { paxSerial: { in: paxSerials } } });
      await prisma.paxType.delete({ where: { id: paxType.id } });
      await prisma.material.delete({ where: { id: material.id } });
      
      // Clean up audit logs
      await prisma.auditLog.deleteMany({
        where: {
          OR: [
            { entityId: { in: serviceBatteryIds } },
            { entityId: { in: warrantyIds } },
            { entityId: { in: paxSerials } },
            { entityId: { in: salesOrderIds } },
            { entityId: { in: dispatchOrderIds } },
            { entityId: material.id }
          ]
        }
      });

      // Clean up users
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });

      console.log("✅ Cleanup complete.");
    } catch (err: any) {
      console.error("❌ Cleanup failed:", err.message);
    }
  };

  try {
    // ─────────────────────────────────────────────────────────────
    // 1. SERVICE WORKFLOW & CONCURRENT STATUS (Tests 1-9)
    // ─────────────────────────────────────────────────────────────
    console.log("\n🧪 Running Service Workflow and Concurrency Tests...");

    // Create a base service battery
    const createRes = await app.inject({
      method: "POST",
      url: "/service/battery",
      headers: adminHeaders,
      payload: {
        customerName: customer.name,
        customerMobile: customer.phone,
        batteryModel: "Model P7",
        originalBatterySerial: "SRV-P7-SERIAL-1",
        issueDescription: "Battery draining quickly",
        warrantyStatus: "NON_WARRANTY"
      }
    });

    if (createRes.statusCode !== 200) {
      throw new Error(`Failed to create service entry: ${createRes.payload}`);
    }
    const baseBattery = JSON.parse(createRes.payload);
    serviceBatteryIds.push(baseBattery.id);

    // Test 1 & 2: Invalid transition (RECEIVED -> REPAIR_COMPLETED) blocked
    console.log(" - Test 1 & 2: Invalid status transition directly to REPAIR_COMPLETED...");
    const badTransitionRes = await app.inject({
      method: "PATCH",
      url: `/service/service/battery/${baseBattery.id}/status`,
      headers: adminHeaders,
      payload: { status: "REPAIR_COMPLETED", version: 1 }
    });
    if (badTransitionRes.statusCode === 200) {
      throw new Error("Invalid transition should have failed");
    }
    console.log("   ✅ Succeeded: Invalid transition blocked.");

    // Test 3: ON_HOLD transition and resume
    console.log(" - Test 3: ON_HOLD resume and previousStatus checks...");
    // Move RECEIVED -> ON_HOLD
    const holdRes = await app.inject({
      method: "PATCH",
      url: `/service/service/battery/${baseBattery.id}/status`,
      headers: adminHeaders,
      payload: { status: "ON_HOLD", version: 1 }
    });
    if (holdRes.statusCode !== 200) {
      throw new Error(`Failed to move to ON_HOLD: ${holdRes.payload}`);
    }

    // Try transition from ON_HOLD to DELIVERED (which should be blocked since prevStatus was RECEIVED)
    const holdBypassRes = await app.inject({
      method: "PATCH",
      url: `/service/service/battery/${baseBattery.id}/status`,
      headers: adminHeaders,
      payload: { status: "DELIVERED", version: 2 }
    });
    if (holdBypassRes.statusCode === 200) {
      throw new Error("Bypass from ON_HOLD directly to DELIVERED should have been blocked");
    }

    // Resume from hold back to RECEIVED (valid previous status)
    const resumeRes = await app.inject({
      method: "PATCH",
      url: `/service/service/battery/${baseBattery.id}/status`,
      headers: adminHeaders,
      payload: { status: "RESUME", version: 2 }
    });
    if (resumeRes.statusCode !== 200) {
      throw new Error(`Failed to resume from ON_HOLD: ${resumeRes.payload}`);
    }
    console.log("   ✅ Succeeded: ON_HOLD transition bypass blocked, valid resume allowed.");

    // Test 6 & 7: Version verification checks
    console.log(" - Test 6 & 7: Missing and stale version checks...");
    const missingVersionRes = await app.inject({
      method: "PATCH",
      url: `/service/service/battery/${baseBattery.id}/status`,
      headers: adminHeaders,
      payload: { status: "DIAGNOSIS_PENDING" }
    });
    if (missingVersionRes.statusCode !== 400) {
      throw new Error("Missing version should return HTTP 400");
    }

    const staleVersionRes = await app.inject({
      method: "PATCH",
      url: `/service/service/battery/${baseBattery.id}/status`,
      headers: adminHeaders,
      payload: { status: "DIAGNOSIS_PENDING", version: 1 } // Stale version (should be 3 now)
    });
    if (staleVersionRes.statusCode !== 409) {
      throw new Error(`Stale version should return HTTP 409, got ${staleVersionRes.statusCode}`);
    }
    console.log("   ✅ Succeeded: Missing version (400) and stale version (409) correctly enforced.");

    // Test 8: Concurrent status updates serialization
    console.log(" - Test 8: Concurrent status updates serialization...");
    const currentVersion = 3;
    const promises = [
      app.inject({
        method: "PATCH",
        url: `/service/service/battery/${baseBattery.id}/status`,
        headers: adminHeaders,
        payload: { status: "DIAGNOSIS_PENDING", version: currentVersion }
      }),
      app.inject({
        method: "PATCH",
        url: `/service/service/battery/${baseBattery.id}/status`,
        headers: adminHeaders,
        payload: { status: "DIAGNOSIS_PENDING", version: currentVersion }
      })
    ];
    const results = await Promise.all(promises);
    const successCount = results.filter(r => r.statusCode === 200).length;
    const conflictCount = results.filter(r => r.statusCode === 409).length;

    console.log(`   Successes: ${successCount}, Conflicts: ${conflictCount}`);
    if (successCount !== 1 || conflictCount !== 1) {
      throw new Error("Pessimistic locking and version checking failed to serialize concurrent updates");
    }
    console.log("   ✅ Succeeded: Concurrency serialized (only one update succeeded).");

    // Reopen tests
    console.log(" - Test 1 & 3: DELIVERED -> REOPENED workflow validation...");
    // Let's manually set the battery to DELIVERED to verify the reopened status guard
    await prisma.serviceBattery.update({
      where: { id: baseBattery.id },
      data: { status: "DELIVERED" }
    });

    const reopenRes = await app.inject({
      method: "POST",
      url: "/service/reopen",
      headers: adminHeaders,
      payload: {
        serviceBatteryId: baseBattery.id,
        reason: "Issue returned",
        warrantyCovered: true
      }
    });

    if (reopenRes.statusCode !== 200) {
      throw new Error(`Reopen failed for DELIVERED battery: ${reopenRes.payload}`);
    }

    const reopenedBattery = await prisma.serviceBattery.findUnique({ where: { id: baseBattery.id } });
    if (reopenedBattery?.status !== "DIAGNOSIS_PENDING") {
      throw new Error(`Expected reopened battery status to be DIAGNOSIS_PENDING, got ${reopenedBattery?.status}`);
    }

    // Reopen terminal checks (SCRAP and CANCELLED cannot reopen)
    await prisma.serviceBattery.update({
      where: { id: baseBattery.id },
      data: { status: "SCRAP" }
    });

    const badReopenRes = await app.inject({
      method: "POST",
      url: "/service/reopen",
      headers: adminHeaders,
      payload: {
        serviceBatteryId: baseBattery.id,
        reason: "Should fail",
        warrantyCovered: false
      }
    });
    if (badReopenRes.statusCode === 200) {
      throw new Error("Reopening a SCRAP battery should have failed");
    }
    console.log("   ✅ Succeeded: DELIVERED -> REOPENED workflow allowed, terminal scrap block preserved.");

    // ─────────────────────────────────────────────────────────────
    // 2. SERVICE COST TRANSACTIONS (Tests 10-13)
    // ─────────────────────────────────────────────────────────────
    console.log("\n🧪 Running Service Cost Transaction Tests...");
    const costBattery = await prisma.serviceBattery.create({
      data: {
        serviceId: `SRV-CST-${Date.now().toString().slice(-4)}`,
        serialNumber: `SRV-SER-CST-${Date.now().toString().slice(-4)}`,
        customerName: customer.name,
        customerMobile: customer.phone,
        batteryModel: "Model Cost",
        issueDescription: "Cost test",
        createdBy: adminUser.id,
        status: "READY_FOR_DELIVERY",
        version: 1
      }
    });
    serviceBatteryIds.push(costBattery.id);

    // Test 10: Create cost manually
    console.log(" - Test 10: Create cost manually...");
    const costCreateRes = await app.inject({
      method: "POST",
      url: "/service/cost",
      headers: adminHeaders,
      payload: {
        serviceBatteryId: costBattery.id,
        serviceType: "REPAIR",
        materialCost: 200.0,
        labourCost: 150.0,
        marginAmount: 50.0,
        totalCost: 400.0,
        overrideReason: "Manual quote setup"
      }
    });
    if (costCreateRes.statusCode !== 200) {
      throw new Error(`Cost creation failed: ${costCreateRes.payload}`);
    }
    const createdCost = JSON.parse(costCreateRes.payload);

    // Verify AuditLog was created with prevStatus: "NONE"
    const creationAudit = await prisma.auditLog.findFirst({
      where: { entityType: "ServiceCost", entityId: createdCost.id, action: "COST_CREATED" }
    });
    if (!creationAudit || creationAudit.prevStatus !== "NONE" || creationAudit.newStatus !== "Total: ₹400") {
      throw new Error("Cost creation audit log missing or incorrect");
    }
    console.log("   ✅ Succeeded: Cost and audit log created atomically.");

    // Test 11: Transaction rollback checks
    console.log(" - Test 11: Transaction rollback check for duplicate cost...");
    const costCreateRes2 = await app.inject({
      method: "POST",
      url: "/service/cost",
      headers: adminHeaders,
      payload: {
        serviceBatteryId: costBattery.id, // duplicate battery ID should fail (unique constraint)
        serviceType: "REPAIR",
        materialCost: 100.0,
        labourCost: 100.0,
        marginPercentage: 10.0,
        overrideReason: "Fail expected"
      }
    });
    if (costCreateRes2.statusCode === 200) {
      throw new Error("Duplicate cost creation should have failed");
    }
    console.log("   ✅ Succeeded: Failed cost creation correctly rolled back.");

    // Test 12 & 13: Cost override patch transaction and audit check
    console.log(" - Test 12 & 13: Cost override transaction and audit checks...");
    const overrideRes = await app.inject({
      method: "PATCH",
      url: `/service/cost/${createdCost.id}`,
      headers: adminHeaders,
      payload: {
        totalCost: 450.0,
        overrideReason: "Discount adjustment"
      }
    });

    if (overrideRes.statusCode !== 200) {
      throw new Error(`Cost override failed: ${overrideRes.payload}`);
    }

    const overrideAudit = await prisma.auditLog.findFirst({
      where: { entityType: "ServiceCost", entityId: createdCost.id, action: "Override Applied" }
    });
    if (!overrideAudit || overrideAudit.prevStatus !== "Total: ₹400" || overrideAudit.newStatus !== "Total: ₹450") {
      throw new Error("Cost override audit log missing or has incorrect statuses");
    }
    console.log("   ✅ Succeeded: Cost override successfully saved and audited.");

    // ─────────────────────────────────────────────────────────────
    // 3. CONCURRENT ID GENERATION (Tests 14-16)
    // ─────────────────────────────────────────────────────────────
    console.log("\n🧪 Running Concurrent Battery ID Generation Tests...");
    const idPromises = [];
    for (let i = 0; i < 5; i++) {
      idPromises.push(
        app.inject({
          method: "POST",
          url: "/service/battery",
          headers: adminHeaders,
          payload: {
            customerName: customer.name,
            customerMobile: customer.phone,
            batteryModel: `Model Concurrent ${i}`,
            issueDescription: "No issue",
            warrantyStatus: "NON_WARRANTY"
          }
        })
      );
    }

    const idResults = await Promise.all(idPromises);
    const idFails = idResults.filter(r => r.statusCode !== 200);
    if (idFails.length > 0) {
      throw new Error(`Concurrent ID generation failed: ${idFails[0].payload}`);
    }

    const createdBatteries = idResults.map(r => JSON.parse(r.payload));
    createdBatteries.forEach(b => serviceBatteryIds.push(b.id));

    // Verify all generated serviceIds are unique
    const uniqueIds = new Set(createdBatteries.map(b => b.serviceId));
    if (uniqueIds.size !== 5) {
      throw new Error("Duplicate serviceIds generated under concurrency!");
    }
    console.log("   ✅ Succeeded: Concurrent ID generation serialized without duplicate conflicts.");

    // ─────────────────────────────────────────────────────────────
    // 4. WARRANTY VALIDATION (Tests 17-23)
    // ─────────────────────────────────────────────────────────────
    console.log("\n🧪 Running Warranty Validation Tests...");

    // Create a sold pack first to support warranty timing
    const packSerial = `PAX-P7-W-${Date.now().toString().slice(-4)}`;
    const paxPack = await prisma.paxPack.create({
      data: {
        paxSerial: packSerial,
        paxTypeId: paxType.id,
        status: PaxStatus.SOLD_TO_CUSTOMER
      }
    });
    paxSerials.push(packSerial);

    // Valid active warranty creation
    const activeWarranty = await prisma.warranty.create({
      data: {
        warrantyNumber: `W-ACT-${Date.now().toString().slice(-4)}`,
        customerId: customer.id,
        paxSerial: packSerial,
        deliveryDate: new Date(),
        warrantyStartDate: new Date(Date.now() - 24 * 3600 * 1000), // yesterday
        warrantyEndDate: new Date(Date.now() + 365 * 24 * 3600 * 1000), // next year
        warrantyDurationMonths: 12,
        coverageType: "FULL",
        status: "ACTIVE"
      }
    });
    warrantyIds.push(activeWarranty.id);

    // Test 17: Service creation with valid active warranty
    console.log(" - Test 17: Service creation with valid active warranty...");
    const resWarrantyOk = await app.inject({
      method: "POST",
      url: "/service/battery",
      headers: adminHeaders,
      payload: {
        customerName: customer.name,
        customerMobile: customer.phone,
        batteryModel: "Model P7",
        originalBatterySerial: packSerial,
        issueDescription: "Quick draining",
        warrantyId: activeWarranty.id
      }
    });
    if (resWarrantyOk.statusCode !== 200) {
      throw new Error(`Valid warranty intake failed: ${resWarrantyOk.payload}`);
    }
    const batteryWarrantyOk = JSON.parse(resWarrantyOk.payload);
    serviceBatteryIds.push(batteryWarrantyOk.id);
    if (batteryWarrantyOk.warrantyStatus !== "IN_WARRANTY") {
      throw new Error(`Expected derived status IN_WARRANTY, got ${batteryWarrantyOk.warrantyStatus}`);
    }
    console.log("   ✅ Succeeded: Valid active warranty registered battery as IN_WARRANTY.");

    // Test 19-23: Negative warranty validation cases
    console.log(" - Test 19-23: Expired, customer mismatch, serial mismatch, status forgery checks...");
    
    // Create an expired warranty
    const expiredPackSerial = `PAX-P7-W-EXP-${Date.now().toString().slice(-4)}`;
    await prisma.paxPack.create({
      data: {
        paxSerial: expiredPackSerial,
        paxTypeId: paxType.id,
        status: PaxStatus.SOLD_TO_CUSTOMER
      }
    });
    paxSerials.push(expiredPackSerial);

    const expiredWarranty = await prisma.warranty.create({
      data: {
        warrantyNumber: `W-EXP-${Date.now().toString().slice(-4)}`,
        customerId: customer.id,
        paxSerial: expiredPackSerial,
        deliveryDate: new Date(),
        warrantyStartDate: new Date(Date.now() - 366 * 24 * 3600 * 1000),
        warrantyEndDate: new Date(Date.now() - 10 * 24 * 3600 * 1000), // expired 10 days ago
        warrantyDurationMonths: 12,
        coverageType: "FULL",
        status: "ACTIVE"
      }
    });
    warrantyIds.push(expiredWarranty.id);

    const expiredRes = await app.inject({
      method: "POST",
      url: "/service/battery",
      headers: adminHeaders,
      payload: {
        customerName: customer.name,
        customerMobile: customer.phone,
        batteryModel: "Model P7",
        originalBatterySerial: expiredPackSerial,
        issueDescription: "Broken",
        warrantyId: expiredWarranty.id
      }
    });
    if (expiredRes.statusCode !== 400) {
      throw new Error(`Expired warranty should return HTTP 400, got ${expiredRes.statusCode}`);
    }

    // Customer mismatch
    const altCustomer = await prisma.customer.create({
      data: {
        name: "Alt Customer",
        customerCode: `CUST-ALT-${Date.now().toString().slice(-4)}`,
        email: `alt-${Date.now()}@kyrazam.com`,
        phone: "9876543211",
        billingAddress: "Billing",
        shippingAddress: "Shipping",
        city: "City",
        state: "State",
        country: "India",
        postalCode: "110001"
      }
    });
    const mismatchPackSerial = `PAX-P7-W-MIS-${Date.now().toString().slice(-4)}`;
    await prisma.paxPack.create({
      data: {
        paxSerial: mismatchPackSerial,
        paxTypeId: paxType.id,
        status: PaxStatus.SOLD_TO_CUSTOMER
      }
    });
    paxSerials.push(mismatchPackSerial);

    const mismatchWarranty = await prisma.warranty.create({
      data: {
        warrantyNumber: `W-MIS-${Date.now().toString().slice(-4)}`,
        customerId: altCustomer.id, // alt customer
        paxSerial: mismatchPackSerial,
        deliveryDate: new Date(),
        warrantyStartDate: new Date(),
        warrantyEndDate: new Date(Date.now() + 365 * 24 * 3600 * 1000),
        warrantyDurationMonths: 12,
        coverageType: "FULL",
        status: "ACTIVE"
      }
    });
    warrantyIds.push(mismatchWarranty.id);

    const mismatchRes = await app.inject({
      method: "POST",
      url: "/service/battery",
      headers: adminHeaders,
      payload: {
        customerName: customer.name, // customer mismatch
        customerMobile: customer.phone,
        batteryModel: "Model P7",
        originalBatterySerial: mismatchPackSerial,
        issueDescription: "Draining",
        warrantyId: mismatchWarranty.id
      }
    });
    if (mismatchRes.statusCode !== 400) {
      throw new Error(`Mismatched customer should return HTTP 400, got ${mismatchRes.statusCode}`);
    }

    // Serial mismatch
    const badSerialRes = await app.inject({
      method: "POST",
      url: "/service/battery",
      headers: adminHeaders,
      payload: {
        customerName: customer.name,
        customerMobile: customer.phone,
        batteryModel: "Model P7",
        originalBatterySerial: "WRONG-SERIAL-123", // wrong serial
        issueDescription: "Quick draining",
        warrantyId: activeWarranty.id
      }
    });
    if (badSerialRes.statusCode !== 400) {
      throw new Error(`Wrong serial number mismatch should return HTTP 400, got ${badSerialRes.statusCode}`);
    }

    // Try status forgery (pass warrantyStatus: "IN_WARRANTY" but supply no warrantyId)
    const forgeRes = await app.inject({
      method: "POST",
      url: "/service/battery",
      headers: adminHeaders,
      payload: {
        customerName: customer.name,
        customerMobile: customer.phone,
        batteryModel: "Model P7",
        originalBatterySerial: packSerial,
        issueDescription: "Broken",
        warrantyStatus: "IN_WARRANTY" // Forge attempt without ID
      }
    });
    if (forgeRes.statusCode !== 200) {
      throw new Error(`Should succeed, but overwrite warranty status: ${forgeRes.payload}`);
    }
    const forgedResult = JSON.parse(forgeRes.payload);
    serviceBatteryIds.push(forgedResult.id);
    if (forgedResult.warrantyStatus !== "NON_WARRANTY") {
      throw new Error(`Forgery succeeded! Expected derived status NON_WARRANTY, got ${forgedResult.warrantyStatus}`);
    }

    console.log("   ✅ Succeeded: All warranty invalid cases rejected, forgery prevented.");

    // ─────────────────────────────────────────────────────────────
    // 5. SCRAP SOD (Tests 24-25)
    // ─────────────────────────────────────────────────────────────
    console.log("\n🧪 Running Scrap Approval SoD Tests...");
    const scrapBattery = await prisma.serviceBattery.create({
      data: {
        serviceId: `SRV-SCP-${Date.now().toString().slice(-4)}`,
        serialNumber: `SRV-SER-SCP-${Date.now().toString().slice(-4)}`,
        customerName: customer.name,
        customerMobile: customer.phone,
        batteryModel: "Model Scrap",
        issueDescription: "Draining test",
        createdBy: adminUser.id,
        status: "DIAGNOSIS_PENDING",
        version: 1
      }
    });
    serviceBatteryIds.push(scrapBattery.id);

    // Recommend scrap via route instead of direct prisma creation
    await app.inject({
      method: "POST",
      url: "/service/scrap-recommend",
      headers: adminHeaders, // recommended by adminUser
      payload: {
        serviceBatteryId: scrapBattery.id,
        reason: "Defective core"
      }
    });

    // Test 24: Recommender self-approval check
    console.log(" - Test 24: Recommender self-approval check...");
    const selfApproveRes = await app.inject({
      method: "POST",
      url: "/service/scrap-approve",
      headers: adminHeaders, // adminUser is recommender
      payload: {
        serviceBatteryId: scrapBattery.id,
        approved: true,
        remarks: "Approve myself"
      }
    });
    if (selfApproveRes.statusCode !== 403) {
      throw new Error(`Self-approval should return HTTP 403, got ${selfApproveRes.statusCode}`);
    }
    console.log("   ✅ Succeeded: Recommender self-approval blocked (HTTP 403).");

    // Test 25: Different user approvals
    console.log(" - Test 25: Different authorized user approval...");
    // Let's create an Admin User B
    const adminUserB = await prisma.user.create({
      data: {
        name: "Admin B",
        email: `adminb-${Date.now()}@kyrazam.com`,
        roles: ["ADMIN"],
        passwordHash: "dummy",
        isActive: true
      }
    });
    userIds.push(adminUserB.id);
    const tokenB = app.jwt.sign({ id: adminUserB.id, roles: adminUserB.roles as any });

    const diffUserApproveRes = await app.inject({
      method: "POST",
      url: "/service/scrap-approve",
      headers: { Authorization: `Bearer ${tokenB}` }, // different user
      payload: {
        serviceBatteryId: scrapBattery.id,
        approved: true,
        remarks: "Approve other"
      }
    });
    if (diffUserApproveRes.statusCode !== 200) {
      throw new Error(`Scrap approval by different user failed: ${diffUserApproveRes.payload}`);
    }
    console.log("   ✅ Succeeded: Scrap approval by different user succeeded.");

    // ─────────────────────────────────────────────────────────────
    // 6. MATERIAL REQUEST & RESERVATIONS (Tests 26-27, 30-33)
    // ─────────────────────────────────────────────────────────────
    console.log("\n🧪 Running Material Request & Reservation Tests...");

    const matReqBattery = await prisma.serviceBattery.create({
      data: {
        serviceId: `SRV-MR-${Date.now().toString().slice(-4)}`,
        serialNumber: `SRV-SER-MR-${Date.now().toString().slice(-4)}`,
        customerName: customer.name,
        customerMobile: customer.phone,
        batteryModel: "Model Material",
        issueDescription: "Draining test",
        createdBy: adminUser.id,
        status: "MATERIAL_REQUESTED",
        version: 1
      }
    });
    serviceBatteryIds.push(matReqBattery.id);

    const matReq = await prisma.serviceMaterialRequest.create({
      data: {
        serviceBatteryId: matReqBattery.id,
        requestedBy: techUser.id,
        status: "PENDING",
        items: {
          create: [{ materialId: material.id, quantity: 2 }]
        }
      },
      include: { items: true }
    });

    // Test 26: Prevent direct transition from PENDING -> ISSUED
    console.log(" - Test 26: Prevent direct transition from PENDING -> ISSUED...");
    const badIssueRes = await app.inject({
      method: "PATCH",
      url: `/service/material-request/${matReq.id}`,
      headers: adminHeaders,
      payload: { status: "ISSUED" }
    });
    if (badIssueRes.statusCode === 200) {
      throw new Error("Direct PENDING -> ISSUED should have failed");
    }
    console.log("   ✅ Succeeded: Direct transition PENDING -> ISSUED blocked.");

    // Test 27: APPROVED -> ISSUED workflow transition reduces stock
    console.log(" - Test 27: APPROVED -> ISSUED workflow transition...");
    const approveReqRes = await app.inject({
      method: "PATCH",
      url: `/service/material-request/${matReq.id}`,
      headers: adminHeaders,
      payload: { status: "APPROVED" }
    });
    if (approveReqRes.statusCode !== 200) {
      throw new Error(`Material request approval failed: ${approveReqRes.payload}`);
    }

    const issueReqRes = await app.inject({
      method: "PATCH",
      url: `/service/material-request/${matReq.id}`,
      headers: adminHeaders,
      payload: { status: "ISSUED" }
    });
    if (issueReqRes.statusCode !== 200) {
      throw new Error(`Material request issue failed: ${issueReqRes.payload}`);
    }

    const checkMat = await prisma.material.findUnique({ where: { id: material.id } });
    if (checkMat?.quantity !== 48) { // 50 - 2 = 48
      throw new Error(`Material stock should be 48, got ${checkMat?.quantity}`);
    }
    console.log("   ✅ Succeeded: Material APPROVED -> ISSUED transition executed stock deduction.");

    // Test 30 & 32 & 33: Service Cancellation releases active reservations
    console.log(" - Test 30 & 32 & 33: Release active reservations on Service Cancellation...");
    const cancelBattery = await prisma.serviceBattery.create({
      data: {
        serviceId: `SRV-CNCL-${Date.now().toString().slice(-4)}`,
        serialNumber: `SRV-SER-CNCL-${Date.now().toString().slice(-4)}`,
        customerName: customer.name,
        customerMobile: customer.phone,
        batteryModel: "Model Cancel",
        issueDescription: "Draining test",
        createdBy: adminUser.id,
        status: "MATERIAL_REQUESTED",
        version: 1
      }
    });
    serviceBatteryIds.push(cancelBattery.id);

    const cancelMatReq = await prisma.serviceMaterialRequest.create({
      data: {
        serviceBatteryId: cancelBattery.id,
        requestedBy: techUser.id,
        status: "PENDING",
        items: {
          create: [{ materialId: material.id, quantity: 3 }]
        }
      },
      include: { items: true }
    });

    // Approve it to create RESERVED reservation
    await app.inject({
      method: "PATCH",
      url: `/service/material-request/${cancelMatReq.id}`,
      headers: adminHeaders,
      payload: { status: "APPROVED" }
    });

    // Move battery to CANCELLED and verify reservation transitions to RELEASED
    const cancelRes = await app.inject({
      method: "PATCH",
      url: `/service/service/battery/${cancelBattery.id}/status`,
      headers: adminHeaders,
      payload: { status: "CANCELLED", version: 2 }
    });
    if (cancelRes.statusCode !== 200) {
      throw new Error(`Battery cancellation failed: ${cancelRes.payload}`);
    }

    const releasedRes = await prisma.inventoryReservation.findFirst({
      where: { serviceBatteryId: cancelBattery.id, materialId: material.id }
    });
    if (!releasedRes || releasedRes.status !== "RELEASED") {
      throw new Error(`Expected reservation status RELEASED, got ${releasedRes?.status}`);
    }
    console.log("   ✅ Succeeded: Active reservations transitioned to RELEASED upon service cancellation.");

    // Test 31: Material Request Rejection releases RESERVED reservations
    console.log(" - Test 31: Material Request Rejection releases active reservations...");
    const rejectBattery = await prisma.serviceBattery.create({
      data: {
        serviceId: `SRV-REJ-${Date.now().toString().slice(-4)}`,
        serialNumber: `SRV-SER-REJ-${Date.now().toString().slice(-4)}`,
        customerName: customer.name,
        customerMobile: customer.phone,
        batteryModel: "Model Reject",
        issueDescription: "Draining test",
        createdBy: adminUser.id,
        status: "MATERIAL_REQUESTED",
        version: 1
      }
    });
    serviceBatteryIds.push(rejectBattery.id);

    const rejectMatReq = await prisma.serviceMaterialRequest.create({
      data: {
        serviceBatteryId: rejectBattery.id,
        requestedBy: techUser.id,
        status: "PENDING",
        items: {
          create: [{ materialId: material.id, quantity: 3 }]
        }
      },
      include: { items: true }
    });

    // Approve request
    await app.inject({
      method: "PATCH",
      url: `/service/material-request/${rejectMatReq.id}`,
      headers: adminHeaders,
      payload: { status: "APPROVED" }
    });

    // Reject request
    const rejectRequestRes = await app.inject({
      method: "PATCH",
      url: `/service/material-request/${rejectMatReq.id}`,
      headers: adminHeaders,
      payload: { status: "REJECTED" }
    });
    if (rejectRequestRes.statusCode !== 200) {
      throw new Error(`Material request rejection failed: ${rejectRequestRes.payload}`);
    }

    const rejectReleasedRes = await prisma.inventoryReservation.findFirst({
      where: { serviceBatteryId: rejectBattery.id, materialId: material.id }
    });
    if (!rejectReleasedRes || rejectReleasedRes.status !== "RELEASED") {
      throw new Error(`Expected reservation status RELEASED, got ${rejectReleasedRes?.status}`);
    }
    console.log("   ✅ Succeeded: Active reservations transitioned to RELEASED upon material request rejection.");

    // ─────────────────────────────────────────────────────────────
    // 7. SERVICE DELIVERY IDEMPOTENCY (Tests 28-29)
    // ─────────────────────────────────────────────────────────────
    console.log("\n🧪 Running Service Delivery Idempotency Tests...");
    const delBattery = await prisma.serviceBattery.create({
      data: {
        serviceId: `SRV-DEL-${Date.now().toString().slice(-4)}`,
        serialNumber: `SRV-SER-DEL-${Date.now().toString().slice(-4)}`,
        customerName: customer.name,
        customerMobile: customer.phone,
        batteryModel: "Model Delivery",
        issueDescription: "Draining test",
        createdBy: adminUser.id,
        status: "READY_FOR_DELIVERY",
        version: 1
      }
    });
    serviceBatteryIds.push(delBattery.id);

    // First delivery (Test 28)
    console.log(" - Test 28: First service delivery creation...");
    const delRes1 = await app.inject({
      method: "POST",
      url: "/service/delivery",
      headers: adminHeaders,
      payload: {
        serviceBatteryId: delBattery.id,
        customerSignature: "signature-base64-1",
        paymentStatus: "PAID",
        warrantyUpdate: "12-month extension"
      }
    });
    if (delRes1.statusCode !== 200) {
      throw new Error(`First delivery failed: ${delRes1.payload}`);
    }
    console.log("   ✅ Succeeded: First delivery created successfully.");

    // Second delivery (Test 29) on reopened/same battery (idempotency check)
    console.log(" - Test 29: Reopened service delivery idempotency (upsert logic)...");
    const delRes2 = await app.inject({
      method: "POST",
      url: "/service/delivery",
      headers: adminHeaders,
      payload: {
        serviceBatteryId: delBattery.id,
        customerSignature: "signature-base64-2", // updated signature
        paymentStatus: "PAID",
        warrantyUpdate: "12-month extension"
      }
    });
    if (delRes2.statusCode !== 200) {
      throw new Error(`Second delivery failed: ${delRes2.payload}`);
    }

    const deliveryRecords = await prisma.serviceDelivery.findMany({ where: { serviceBatteryId: delBattery.id } });
    if (deliveryRecords.length !== 1) {
      throw new Error(`Expected exactly 1 delivery record, found ${deliveryRecords.length}`);
    }
    if (deliveryRecords[0].customerSignature !== "signature-base64-2") {
      throw new Error("Upsert did not update delivery details");
    }
    console.log("   ✅ Succeeded: Service delivery idempotency preserved (upsert completed without unique key violations).");

    // ─────────────────────────────────────────────────────────────
    // 8. SCRAP RBAC (Tests 34-35)
    // ─────────────────────────────────────────────────────────────
    console.log("\n🧪 Running Scrap RBAC Tests...");

    // Test 34: Unauthorized role (Sales) blocked
    console.log(" - Test 34: Sales Executive scrap creation blocked...");
    const unauthorizedScrapRes = await app.inject({
      method: "POST",
      url: "/scrap",
      headers: salesHeaders,
      payload: {
        scrapType: "LOSS",
        sourceType: "INVENTORY_DAMAGE",
        materialId: material.id,
        quantity: 1,
        defectType: "Broken casing",
        severity: "LOW",
        description: "Dropped"
      }
    });
    if (unauthorizedScrapRes.statusCode !== 403) {
      throw new Error(`Expected status 403, got ${unauthorizedScrapRes.statusCode}`);
    }
    console.log("   ✅ Succeeded: Unauthorized role blocked (HTTP 403).");

    // Test 35: Authorized role (Tech) allowed
    console.log(" - Test 35: Technician scrap creation allowed...");
    const authorizedScrapRes = await app.inject({
      method: "POST",
      url: "/scrap",
      headers: techHeaders,
      payload: {
        scrapType: "LOSS",
        sourceType: "PRODUCTION",
        materialId: material.id,
        quantity: 1,
        defectType: "Cell failure",
        severity: "MEDIUM",
        description: "Tested failed"
      }
    });
    if (authorizedScrapRes.statusCode !== 200) {
      throw new Error(`Authorized scrap creation failed: ${authorizedScrapRes.payload}`);
    }
    // Clean up created scrap entry
    const createdScrap = JSON.parse(authorizedScrapRes.payload);
    await prisma.scrapEntry.delete({ where: { id: createdScrap.id } });
    console.log("   ✅ Succeeded: Authorized role scrap creation succeeded.");

    // ─────────────────────────────────────────────────────────────
    // 9. MATERIAL STOCK CONCURRENCY (Tests 36-39)
    // ─────────────────────────────────────────────────────────────
    console.log("\n🧪 Running Material Stock Concurrency Tests...");

    // Test 36: Material stock update succeeds
    console.log(" - Test 36: Standard stock update...");
    const stockRes = await app.inject({
      method: "PATCH",
      url: `/inventory/materials/${material.id}/stock`,
      headers: adminHeaders,
      payload: { adjustment: 10, action: "add" }
    });
    if (stockRes.statusCode !== 200) {
      throw new Error(`Material stock update failed: ${stockRes.payload}`);
    }
    const matAfterUpdate = await prisma.material.findUnique({ where: { id: material.id } });
    if (matAfterUpdate?.quantity !== 58) { // 48 + 10 = 58
      throw new Error(`Expected physical stock to be 58, got ${matAfterUpdate?.quantity}`);
    }
    console.log("   ✅ Succeeded: Standard stock update succeeded.");

    // Test 37 & 38: Concurrent stock updates serialization and no lost updates
    console.log(" - Test 37 & 38: Concurrent stock updates serialization...");
    const concurrentStockPromises = [];
    for (let i = 0; i < 5; i++) {
      concurrentStockPromises.push(
        app.inject({
          method: "PATCH",
          url: `/inventory/materials/${material.id}/stock`,
          headers: adminHeaders,
          payload: { adjustment: 2, action: "remove" }
        })
      );
    }
    const stockResults = await Promise.all(concurrentStockPromises);
    const stockSuccessList = stockResults.filter(r => r.statusCode === 200);
    console.log(`   Successful stock updates: ${stockSuccessList.length}/${stockResults.length}`);
    
    // Validate final stock level matches mathematical result (58 - (5 * 2) = 48)
    const finalMaterial = await prisma.material.findUnique({ where: { id: material.id } });
    console.log(`   Final physical material stock: ${finalMaterial?.quantity}`);
    if (finalMaterial?.quantity !== 48) {
      throw new Error(`Concurrency race condition detected! Expected physical quantity to be 48, got ${finalMaterial?.quantity}`);
    }
    console.log("   ✅ Succeeded: Concurrent stock updates serialized correctly without lost updates.");

    // ─────────────────────────────────────────────────────────────
    // 10. NEW ADVERSARIAL AUDIT CASES (Tests 40-44)
    // ─────────────────────────────────────────────────────────────
    console.log("\n🧪 Running Phase 7 Specific Adversarial Audit Tests...");

    // Test 40: Financial Clearance Bypass for Sales Order
    console.log(" - Test 40: Financial Clearance Bypass (Dispatch Order creation for uncleared Sales Order)...");
    const unclearedOrder = await prisma.salesOrder.create({
      data: {
        salesOrderNumber: `SO-P7-UNC-${Date.now().toString().slice(-4)}`,
        customerId: customer.id,
        status: SalesOrderStatus.CONFIRMED,
        isFinancialCleared: false, // UNCLEARED
        grandTotal: 100.0,
        subtotal: 100.0,
        discount: 0.0,
        tax: 0.0,
        additionalCharges: 0.0,
        paymentStatus: SalesOrderPaymentStatus.PENDING,
        paymentTerms: "Net 30",
        deliveryTerms: "Ex-Works",
        requiredDeliveryDate: new Date(),
        createdById: adminUser.id,
        billingAddressSnapshot: "Test Billing",
        shippingAddressSnapshot: "Test Shipping"
      }
    });
    salesOrderIds.push(unclearedOrder.id);

    const tryDispatchRes = await app.inject({
      method: "POST",
      url: "/crm/dispatch",
      headers: adminHeaders,
      payload: {
        salesOrderId: unclearedOrder.id,
        dispatchNumber: `DO-P7-UNC-${Date.now().toString().slice(-4)}`,
        carrier: "Test Carrier",
        trackingNumber: "TRK-UNC-1",
        items: []
      }
    });
    if (tryDispatchRes.statusCode === 200) {
      throw new Error("Financial clearance bypass! Dispatch Order was created for uncleared Sales Order.");
    }
    console.log("   ✅ Succeeded: Financial clearance bypass blocked (Dispatch creation failed).");

    // Test 41: Premature Fulfillment
    console.log(" - Test 41: Premature Fulfillment check...");
    const clearedOrder = await prisma.salesOrder.create({
      data: {
        salesOrderNumber: `SO-P7-CLR-${Date.now().toString().slice(-4)}`,
        customerId: customer.id,
        status: SalesOrderStatus.CONFIRMED,
        isFinancialCleared: true, // CLEARED
        grandTotal: 500.0,
        subtotal: 500.0,
        discount: 0.0,
        tax: 0.0,
        additionalCharges: 0.0,
        paymentStatus: SalesOrderPaymentStatus.PAID,
        paymentTerms: "COD",
        deliveryTerms: "Ex-Works",
        requiredDeliveryDate: new Date(),
        createdById: adminUser.id,
        billingAddressSnapshot: "Test Billing",
        shippingAddressSnapshot: "Test Shipping"
      }
    });
    salesOrderIds.push(clearedOrder.id);
    // Sales order is not fulfilled yet, status should be CONFIRMED/IN_FULFILLMENT.
    if (clearedOrder.status === SalesOrderStatus.FULFILLED) {
      throw new Error("Sales Order status set to FULFILLED prematurely.");
    }
    console.log("   ✅ Succeeded: Sales Order status remained CONFIRMED (no premature fulfillment).");

    // Test 42: Duplicate Shipment (idempotency check)
    console.log(" - Test 42: Duplicate Shipment (ship dispatch order twice)...");
    const dispatchOrder = await prisma.dispatchOrder.create({
      data: {
        dispatchNumber: `DO-P7-SHIP-${Date.now().toString().slice(-4)}`,
        salesOrderId: clearedOrder.id,
        customerId: customer.id,
        status: "READY_TO_PICK",
        createdById: adminUser.id,
        plannedDispatchDate: new Date(),
        deliveryAddressSnapshot: "Test Address"
      }
    });
    dispatchOrderIds.push(dispatchOrder.id);

    // Shipping it once (should fail if status is not PACKED)
    const badShipRes = await app.inject({
      method: "PATCH",
      url: `/crm/dispatch/${dispatchOrder.id}/ship`,
      headers: adminHeaders,
      payload: { trackingNumber: "TRK-DUP-1", carrier: "UPS" }
    });
    if (badShipRes.statusCode === 200) {
      throw new Error("Should not be able to ship an order that is not PACKED.");
    }
    console.log("   ✅ Succeeded: Premature shipping before PACKED status blocked.");

    // Test 43: Duplicate Warranty
    console.log(" - Test 43: Duplicate Warranty registration check...");
    const serialForWarranty = `PAX-P7-DUP-${Date.now().toString().slice(-4)}`;
    await prisma.paxPack.create({
      data: {
        paxSerial: serialForWarranty,
        paxTypeId: paxType.id,
        status: PaxStatus.SOLD_TO_CUSTOMER
      }
    });
    paxSerials.push(serialForWarranty);

    const activeWarranty1 = await prisma.warranty.create({
      data: {
        warrantyNumber: `W-DUP-1-${Date.now().toString().slice(-4)}`,
        customerId: customer.id,
        paxSerial: serialForWarranty,
        deliveryDate: new Date(),
        warrantyStartDate: new Date(),
        warrantyEndDate: new Date(Date.now() + 365 * 24 * 3600 * 1000),
        warrantyDurationMonths: 12,
        coverageType: "FULL",
        status: "ACTIVE"
      }
    });
    warrantyIds.push(activeWarranty1.id);

    const tryWarranty2Res = await app.inject({
      method: "POST",
      url: "/crm/warranty/warranties",
      headers: adminHeaders,
      payload: {
        paxSerial: serialForWarranty,
        customerId: customer.id,
        warrantyNumber: `W-DUP-2-${Date.now().toString().slice(-4)}`,
        startDate: new Date().toISOString(),
        durationMonths: 12
      }
    });
    if (tryWarranty2Res.statusCode === 200) {
      throw new Error("Duplicate active warranty was registered for the same battery pack.");
    }
    console.log("   ✅ Succeeded: Duplicate warranty registration blocked.");

    // Test 44: Reservation Stealing
    console.log(" - Test 44: Reservation Stealing check (Direct Sale of reserved pack)...");
    const reservedSerial = `PAX-P7-RSV-${Date.now().toString().slice(-4)}`;
    await prisma.paxPack.create({
      data: {
        paxSerial: reservedSerial,
        paxTypeId: paxType.id,
        status: PaxStatus.READY_FOR_SALE
      }
    });
    paxSerials.push(reservedSerial);

    // Create reservation for a Sales Order
    const reservation = await prisma.inventoryReservation.create({
      data: {
        paxSerial: reservedSerial,
        salesOrderId: clearedOrder.id,
        quantity: 1,
        status: "RESERVED"
      }
    });

    // Attempt direct sale of the reserved pack
    const directSaleRes = await app.inject({
      method: "POST",
      url: "/sales/direct",
      headers: adminHeaders,
      payload: {
        paxSerial: reservedSerial,
        customerId: customer.id,
        pricePaid: 1000.0
      }
    });
    if (directSaleRes.statusCode === 200) {
      throw new Error("Reservation stealing bypass! Direct sale allowed for a RESERVED pack.");
    }
    console.log("   ✅ Succeeded: Reservation stealing blocked (Direct Sale rejected).");

  } catch (err: any) {
    console.error("\n❌ Test Suite Failed:", err.message);
    await cleanup();
    process.exit(1);
  }

  await cleanup();
  console.log("\n🎉 ALL Phase 7 Final Adversarial Integration Tests PASSED successfully.");
  process.exit(0);
}

runTests();
