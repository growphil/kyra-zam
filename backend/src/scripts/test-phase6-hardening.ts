import Fastify from "fastify";
import { authPlugin } from "../plugins/auth";
import { serviceRoutes } from "../routes/service";
import { scrapRoutes } from "../routes/scrap";
import { inventoryRoutes } from "../routes/inventory";
import { warrantyRoutes } from "../routes/warranty";
import { PrismaClient, PaxStatus } from "../generated/client";

const prisma = new PrismaClient();

async function buildTestApp() {
  const app = Fastify({ logger: false });
  await app.register(authPlugin);
  await app.register(serviceRoutes, { prefix: "/service" });
  await app.register(scrapRoutes, { prefix: "/scrap" });
  await app.register(inventoryRoutes, { prefix: "/inventory" });
  await app.register(warrantyRoutes, { prefix: "/crm/warranty" });
  await app.ready();
  return app;
}

async function runTests() {
  console.log("🧪 Running Phase 6 Hardening integration and adversarial tests...");
  const app = await buildTestApp();

  // Create test actors
  let adminUser = await prisma.user.findFirst({ where: { email: "p6admin@kyrazam.com" } });
  if (!adminUser) {
    adminUser = await prisma.user.create({
      data: {
        name: "P6 Admin",
        email: "p6admin@kyrazam.com",
        roles: ["SUPERADMIN", "ADMIN", "INVENTORY_MANAGER", "SUPERVISOR"],
        passwordHash: "dummy",
        isActive: true
      }
    });
  }

  let techUser = await prisma.user.findFirst({ where: { email: "p6tech@kyrazam.com" } });
  if (!techUser) {
    techUser = await prisma.user.create({
      data: {
        name: "P6 Tech",
        email: "p6tech@kyrazam.com",
        roles: ["ASSEMBLY_TECHNICIAN"],
        passwordHash: "dummy",
        isActive: true
      }
    });
  }

  let salesUser = await prisma.user.findFirst({ where: { email: "p6sales@kyrazam.com" } });
  if (!salesUser) {
    salesUser = await prisma.user.create({
      data: {
        name: "P6 Sales",
        email: "p6sales@kyrazam.com",
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
  let customer = await prisma.customer.findFirst({ where: { email: "p6customer@kyrazam.com" } });
  if (!customer) {
    customer = await prisma.customer.create({
      data: {
        name: "P6 Customer",
        customerCode: `CUST-P6-${Date.now().toString().slice(-4)}`,
        email: "p6customer@kyrazam.com",
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
      name: "Phase 6 Test Material",
      category: "RAW_MATERIALS",
      sku: `MAT-P6-${Date.now().toString().slice(-4)}`,
      quantity: 50,
      unit: "pcs",
      unitPrice: 100.0,
      totalValue: 5000.0
    }
  });

  // Setup PaxType and PaxPack for Warranty timing test
  const paxType = await prisma.paxType.create({
    data: {
      name: `Type-P6-${Date.now().toString().slice(-4)}`,
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
      await prisma.inventoryReservation.deleteMany({ where: { serviceBatteryId: { in: serviceBatteryIds } } });
      
      await prisma.serviceBattery.deleteMany({ where: { id: { in: serviceBatteryIds } } });
      await prisma.warranty.deleteMany({ where: { id: { in: warrantyIds } } });
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
            { entityId: material.id }
          ]
        }
      });
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
        batteryModel: "Model P6",
        originalBatterySerial: "SRV-TEST-SERIAL-1",
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
        issueDescription: "Draining test",
        createdBy: adminUser.id,
        status: "READY_FOR_DELIVERY",
        version: 1
      }
    });
    serviceBatteryIds.push(costBattery.id);

    // Test 10: Cost creation succeeds transactionally
    console.log(" - Test 10: Create cost manually...");
    const createCostRes = await app.inject({
      method: "POST",
      url: "/service/cost",
      headers: adminHeaders,
      payload: {
        serviceBatteryId: costBattery.id,
        serviceType: "Manual Tuning",
        materialCost: 200.0,
        labourCost: 150.0,
        marginAmount: 50.0,
        totalCost: 400.0,
        notes: "Diagnostic fee added"
      }
    });

    if (createCostRes.statusCode !== 200) {
      throw new Error(`Cost creation failed: ${createCostRes.payload}`);
    }
    const createdCost = JSON.parse(createCostRes.payload);

    // Check if AuditLog was created atomically
    const costAudit = await prisma.auditLog.findFirst({
      where: { entityType: "ServiceCost", entityId: createdCost.id, action: "COST_CREATED" }
    });
    if (!costAudit) {
      throw new Error("Audit log for cost creation was not created atomically");
    }
    console.log("   ✅ Succeeded: Cost and audit log created atomically.");

    // Test 11: Rollback test on failure
    console.log(" - Test 11: Transaction rollback check for duplicate cost...");
    const badCostRes = await app.inject({
      method: "POST",
      url: "/service/cost",
      headers: adminHeaders,
      payload: {
        serviceBatteryId: costBattery.id,
        totalCost: 500.0
      }
    });
    if (badCostRes.statusCode === 200) {
      throw new Error("Duplicate cost creation should have failed and rolled back");
    }
    console.log("   ✅ Succeeded: Failed cost creation correctly rolled back.");

    // Test 12 & 13: Cost override succeeds and logs
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

    // Retrieve generated service batteries and inspect uniqueness
    const createdList = idResults.map(r => JSON.parse(r.payload));
    createdList.forEach(b => serviceBatteryIds.push(b.id));

    const serviceIds = createdList.map(b => b.serviceId);
    const uniqueServiceIds = new Set(serviceIds);
    if (uniqueServiceIds.size !== serviceIds.length) {
      throw new Error(`Duplicate serviceIds generated: ${serviceIds}`);
    }
    console.log("   ✅ Succeeded: Concurrent ID generation serialized without duplicate conflicts.");

    // ─────────────────────────────────────────────────────────────
    // 4. WARRANTY VALIDATION (Tests 17-23)
    // ─────────────────────────────────────────────────────────────
    console.log("\n🧪 Running Warranty Validation Tests...");

    // Setup a valid PaxPack in SOLD_TO_CUSTOMER
    const testPaxSerial = `PAX-P6-W-${Date.now().toString().slice(-4)}`;
    await prisma.paxPack.create({
      data: {
        paxSerial: testPaxSerial,
        paxTypeId: paxType.id,
        status: PaxStatus.SOLD_TO_CUSTOMER
      }
    });
    paxSerials.push(testPaxSerial);

    // Setup active warranty
    const warrantyStart = new Date();
    const warrantyEnd = new Date(warrantyStart);
    warrantyEnd.setMonth(warrantyEnd.getMonth() + 12);

    const activeWarranty = await prisma.warranty.create({
      data: {
        warrantyNumber: `WAR-P6-${Date.now().toString().slice(-4)}`,
        customerId: customer.id,
        paxSerial: testPaxSerial,
        deliveryDate: warrantyStart,
        warrantyStartDate: warrantyStart,
        warrantyEndDate: warrantyEnd,
        warrantyDurationMonths: 12,
        coverageType: "FULL",
        status: "ACTIVE"
      }
    });
    warrantyIds.push(activeWarranty.id);

    // Test 17: Valid active warranty accepted
    console.log(" - Test 17: Service creation with valid active warranty...");
    const validWarRes = await app.inject({
      method: "POST",
      url: "/service/battery",
      headers: adminHeaders,
      payload: {
        customerName: customer.name,
        customerMobile: customer.phone,
        batteryModel: "Model War",
        originalBatterySerial: testPaxSerial,
        issueDescription: "Warranty test",
        warrantyId: activeWarranty.id
      }
    });
    if (validWarRes.statusCode !== 200) {
      throw new Error(`Valid active warranty registration failed: ${validWarRes.payload}`);
    }
    const validWarBattery = JSON.parse(validWarRes.payload);
    serviceBatteryIds.push(validWarBattery.id);
    if (validWarBattery.warrantyStatus !== "IN_WARRANTY") {
      throw new Error(`Expected battery warranty status to be IN_WARRANTY, got ${validWarBattery.warrantyStatus}`);
    }
    console.log("   ✅ Succeeded: Valid active warranty registered battery as IN_WARRANTY.");

    // Test 19: Inactive warranty rejected
    console.log(" - Test 19: Service creation with inactive warranty...");
    const inactiveWarranty = await prisma.warranty.create({
      data: {
        warrantyNumber: `WAR-P6-IN-${Date.now().toString().slice(-4)}`,
        customerId: customer.id,
        paxSerial: testPaxSerial,
        deliveryDate: warrantyStart,
        warrantyStartDate: warrantyStart,
        warrantyEndDate: warrantyEnd,
        warrantyDurationMonths: 12,
        coverageType: "FULL",
        status: "EXPIRED"
      }
    });
    warrantyIds.push(inactiveWarranty.id);

    const inactiveWarRes = await app.inject({
      method: "POST",
      url: "/service/battery",
      headers: adminHeaders,
      payload: {
        customerName: customer.name,
        customerMobile: customer.phone,
        batteryModel: "Model War",
        originalBatterySerial: testPaxSerial,
        issueDescription: "Inactive warranty test",
        warrantyId: inactiveWarranty.id
      }
    });
    if (inactiveWarRes.statusCode === 200) {
      throw new Error("Inactive warranty should have been rejected");
    }

    // Test 21: Customer mismatch rejected
    console.log(" - Test 21: Service creation with customer mismatch...");
    const wrongCustomerRes = await app.inject({
      method: "POST",
      url: "/service/battery",
      headers: adminHeaders,
      payload: {
        customerName: "Fake Customer",
        customerMobile: customer.phone,
        batteryModel: "Model War",
        originalBatterySerial: testPaxSerial,
        issueDescription: "Mismatch test",
        warrantyId: activeWarranty.id
      }
    });
    if (wrongCustomerRes.statusCode === 200) {
      throw new Error("Customer mismatch warranty should have been rejected");
    }

    // Test 22: Serial mismatch rejected
    console.log(" - Test 22: Service creation with serial mismatch...");
    const wrongSerialRes = await app.inject({
      method: "POST",
      url: "/service/battery",
      headers: adminHeaders,
      payload: {
        customerName: customer.name,
        customerMobile: customer.phone,
        batteryModel: "Model War",
        originalBatterySerial: "PAX-WRONG-SERIAL-123",
        issueDescription: "Mismatch test",
        warrantyId: activeWarranty.id
      }
    });
    if (wrongSerialRes.statusCode === 200) {
      throw new Error("Serial mismatch warranty should have been rejected");
    }

    // Test 23: Client cannot forge IN_WARRANTY status
    console.log(" - Test 23: Forge warrantyStatus check...");
    const forgeRes = await app.inject({
      method: "POST",
      url: "/service/battery",
      headers: adminHeaders,
      payload: {
        customerName: customer.name,
        customerMobile: customer.phone,
        batteryModel: "Model War",
        originalBatterySerial: "PAX-FORGE",
        issueDescription: "Forger test",
        warrantyStatus: "IN_WARRANTY" // Try to forge directly
      }
    });
    const forgedBattery = JSON.parse(forgeRes.payload);
    serviceBatteryIds.push(forgedBattery.id);
    if (forgedBattery.warrantyStatus !== "NON_WARRANTY") {
      throw new Error(`Expected forged warranty status to be NON_WARRANTY, got ${forgedBattery.warrantyStatus}`);
    }
    console.log("   ✅ Succeeded: All warranty invalid cases rejected, forgery prevented.");

    // ─────────────────────────────────────────────────────────────
    // 5. SCRAP APPROVAL SEPARATION OF DUTIES (Tests 24-25)
    // ─────────────────────────────────────────────────────────────
    console.log("\n🧪 Running Scrap Approval SoD Tests...");
    const sodBattery = await prisma.serviceBattery.create({
      data: {
        serviceId: `SRV-SOD-${Date.now().toString().slice(-4)}`,
        serialNumber: `SRV-SER-SOD-${Date.now().toString().slice(-4)}`,
        customerName: customer.name,
        customerMobile: customer.phone,
        batteryModel: "Model SoD",
        issueDescription: "Draining test",
        createdBy: adminUser.id,
        status: "DIAGNOSIS_PENDING",
        version: 1
      }
    });
    serviceBatteryIds.push(sodBattery.id);

    // Recommend scrap using techUser
    const recommendRes = await app.inject({
      method: "POST",
      url: "/service/scrap-recommend",
      headers: techHeaders, // Recommended by Tech User
      payload: {
        serviceBatteryId: sodBattery.id,
        reason: "Cells expanded"
      }
    });
    if (recommendRes.statusCode !== 200) {
      throw new Error(`Scrap recommendation failed: ${recommendRes.payload}`);
    }

    // Test 24: Tech User attempts to approve own scrap recommendation (should fail role check anyway, but let's test admin self-approve)
    // Let's create another scrap recommendation, recommended by Admin User
    const adminSodBattery = await prisma.serviceBattery.create({
      data: {
        serviceId: `SRV-SOD-ADM-${Date.now().toString().slice(-4)}`,
        serialNumber: `SRV-SER-SOD-ADM-${Date.now().toString().slice(-4)}`,
        customerName: customer.name,
        customerMobile: customer.phone,
        batteryModel: "Model SoD Admin",
        issueDescription: "Draining test",
        createdBy: adminUser.id,
        status: "DIAGNOSIS_PENDING",
        version: 1
      }
    });
    serviceBatteryIds.push(adminSodBattery.id);

    // Admin User recommends scrap
    await app.inject({
      method: "POST",
      url: "/service/scrap-recommend",
      headers: adminHeaders, // Recommended by Admin User
      payload: {
        serviceBatteryId: adminSodBattery.id,
        reason: "Corroded cells"
      }
    });

    console.log(" - Test 24: Recommender self-approval check...");
    const adminSelfApproveRes = await app.inject({
      method: "POST",
      url: "/service/scrap-approve",
      headers: adminHeaders, // Admin User tries to approve their own recommendation
      payload: {
        serviceBatteryId: adminSodBattery.id,
        approved: true,
        remarks: "Approved by me"
      }
    });
    if (adminSelfApproveRes.statusCode === 200) {
      throw new Error("Admin self-approval of scrap recommendation should have been blocked");
    }
    console.log("   ✅ Succeeded: Recommender self-approval blocked (HTTP 403).");

    // Test 25: Different authorized user can approve
    console.log(" - Test 25: Different authorized user approval...");
    // Admin User can approve Tech User's recommendation
    const techApproveRes = await app.inject({
      method: "POST",
      url: "/service/scrap-approve",
      headers: adminHeaders, // Admin User approves Tech User's recommendation
      payload: {
        serviceBatteryId: sodBattery.id,
        approved: true,
        remarks: "Different approver"
      }
    });
    if (techApproveRes.statusCode !== 200) {
      throw new Error(`Scrap approval by different user failed: ${techApproveRes.payload}`);
    }
    console.log("   ✅ Succeeded: Scrap approval by different user succeeded.");

    // ─────────────────────────────────────────────────────────────
    // 6. MATERIAL REQUEST & RESERVATIONS (Tests 26-27, 30-33)
    // ─────────────────────────────────────────────────────────────
    console.log("\n🧪 Running Material Request & Reservation Tests...");
    const mrBattery = await prisma.serviceBattery.create({
      data: {
        serviceId: `SRV-MR-${Date.now().toString().slice(-4)}`,
        serialNumber: `SRV-SER-MR-${Date.now().toString().slice(-4)}`,
        customerName: customer.name,
        customerMobile: customer.phone,
        batteryModel: "Model MR",
        issueDescription: "Draining test",
        createdBy: adminUser.id,
        status: "MATERIAL_REQUESTED",
        version: 1
      }
    });
    serviceBatteryIds.push(mrBattery.id);

    // Create material request in PENDING
    const matReq = await prisma.serviceMaterialRequest.create({
      data: {
        serviceBatteryId: mrBattery.id,
        requestedBy: techUser.id,
        status: "PENDING",
        items: {
          create: [{ materialId: material.id, quantity: 5 }]
        }
      },
      include: { items: true }
    });

    // Test 26: PENDING -> ISSUED directly is blocked (L-1)
    console.log(" - Test 26: Prevent direct transition from PENDING -> ISSUED...");
    const directIssueRes = await app.inject({
      method: "PATCH",
      url: `/service/material-request/${matReq.id}`,
      headers: adminHeaders,
      payload: { status: "ISSUED" }
    });
    if (directIssueRes.statusCode === 200) {
      throw new Error("Direct PENDING -> ISSUED transition should have been blocked");
    }
    console.log("   ✅ Succeeded: Direct transition PENDING -> ISSUED blocked.");

    // Test 27: APPROVED -> ISSUED succeeds
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

    // Verify reservation created in RESERVED status
    const initialRes = await prisma.inventoryReservation.findFirst({
      where: { serviceBatteryId: mrBattery.id, materialId: material.id }
    });
    if (!initialRes || initialRes.status !== "RESERVED") {
      throw new Error("Reservation in RESERVED status should exist");
    }

    // Transition APPROVED -> ISSUED
    const issueReqRes = await app.inject({
      method: "PATCH",
      url: `/service/material-request/${matReq.id}`,
      headers: adminHeaders,
      payload: { status: "ISSUED" }
    });
    if (issueReqRes.statusCode !== 200) {
      throw new Error(`Material request issue failed: ${issueReqRes.payload}`);
    }

    // Verify stock deduction and reservation transition to ISSUED
    const updatedMaterial = await prisma.material.findUnique({ where: { id: material.id } });
    if (updatedMaterial?.quantity !== 45) {
      throw new Error(`Expected physical quantity to be 45, got ${updatedMaterial?.quantity}`);
    }
    const finalRes = await prisma.inventoryReservation.findFirst({
      where: { serviceBatteryId: mrBattery.id, materialId: material.id }
    });
    if (!finalRes || finalRes.status !== "ISSUED") {
      throw new Error("Expected reservation status to transition to ISSUED");
    }
    console.log("   ✅ Succeeded: Material APPROVED -> ISSUED transition executed stock deduction.");

    // Test 30: Service cancellation releases RESERVED reservations
    console.log(" - Test 30 & 32 & 33: Release active reservations on Service Cancellation...");
    const cancelBattery = await prisma.serviceBattery.create({
      data: {
        serviceId: `SRV-CNCL-${Date.now().toString().slice(-4)}`,
        serialNumber: `SRV-SER-CNCL-${Date.now().toString().slice(-4)}`,
        customerName: customer.name,
        customerMobile: customer.phone,
        batteryModel: "Model MR",
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
          create: [{ materialId: material.id, quantity: 2 }]
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
    if (matAfterUpdate?.quantity !== 55) {
      throw new Error(`Expected physical stock to be 55, got ${matAfterUpdate?.quantity}`);
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
    
    // Validate final stock level matches mathematical result (55 - (5 * 2) = 45)
    const finalMaterial = await prisma.material.findUnique({ where: { id: material.id } });
    console.log(`   Final physical material stock: ${finalMaterial?.quantity}`);
    if (finalMaterial?.quantity !== 45) {
      throw new Error(`Concurrency race condition detected! Expected physical quantity to be 45, got ${finalMaterial?.quantity}`);
    }
    console.log("   ✅ Succeeded: Concurrent stock updates serialized correctly without lost updates.");

  } catch (err: any) {
    console.error("\n❌ Test Suite Failed:", err.message);
    await cleanup();
    process.exit(1);
  }

  await cleanup();
  console.log("\n🎉 ALL integration and adversarial tests PASSED successfully.");
  process.exit(0);
}

runTests();
