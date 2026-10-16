import Fastify from "fastify";
import { authPlugin } from "../plugins/auth";
import { authRoutes } from "../routes/auth";
import { salesRoutes } from "../routes/sales";
import { qualityRoutes } from "../routes/quality";
import { PrismaClient, PaxStatus } from "../generated/client";

const prisma = new PrismaClient();

async function buildTestApp() {
  const app = Fastify({ logger: false });
  await app.register(authPlugin);
  
  // Register routes
  await app.register(authRoutes,    { prefix: "/auth" });
  await app.register(salesRoutes,   { prefix: "/sales" });
  await app.register(qualityRoutes, { prefix: "/crm/quality" });

  await app.ready();
  return app;
}

async function runTests() {
  console.log("🧪 Running Phase 8 Adversarial Defect & Quality Audit Tests...");
  const app = await buildTestApp();

  // Create test actors
  let adminUser = await prisma.user.findFirst({ where: { email: "p8admin@kyrazam.com" } });
  if (!adminUser) {
    adminUser = await prisma.user.create({
      data: {
        name: "P8 Admin",
        email: "p8admin@kyrazam.com",
        roles: ["SUPERADMIN", "ADMIN", "SUPERVISOR"],
        passwordHash: "dummy",
        isActive: true
      }
    });
  }

  let techUser = await prisma.user.findFirst({ where: { email: "p8tech@kyrazam.com" } });
  if (!techUser) {
    techUser = await prisma.user.create({
      data: {
        name: "P8 Tech",
        email: "p8tech@kyrazam.com",
        roles: ["ASSEMBLY_TECHNICIAN"],
        passwordHash: "dummy",
        isActive: true
      }
    });
  }

  const adminToken = app.jwt.sign({ id: adminUser.id, roles: adminUser.roles as any });
  const techToken = app.jwt.sign({ id: techUser.id, roles: techUser.roles as any });

  const adminHeaders = { Authorization: `Bearer ${adminToken}` };
  const techHeaders = { Authorization: `Bearer ${techToken}` };

  // Setup Customer
  let customer = await prisma.customer.findFirst({ where: { email: "p8customer@kyrazam.com" } });
  if (!customer) {
    customer = await prisma.customer.create({
      data: {
        name: "P8 Customer",
        customerCode: `CUST-P8-${Date.now().toString().slice(-4)}`,
        email: "p8customer@kyrazam.com",
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

  // Setup PaxType
  const paxType = await prisma.paxType.create({
    data: {
      name: `Type-P8-${Date.now().toString().slice(-4)}`,
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
  const paxSerials: string[] = [];
  const defectIds: string[] = [];

  const cleanup = async () => {
    console.log("\n🧹 Cleaning up test records...");
    try {
      await prisma.defect.deleteMany({ where: { id: { in: defectIds } } });
      await prisma.paxPack.deleteMany({ where: { paxSerial: { in: paxSerials } } });
      await prisma.paxType.delete({ where: { id: paxType.id } });
      
      // Clean up audit logs
      await prisma.auditLog.deleteMany({
        where: {
          OR: [
            { entityId: { in: defectIds } },
            { entityId: { in: paxSerials } }
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
    // VULNERABILITY 1: REPORT DEFECT ON SOLD_TO_CUSTOMER PACK
    // ─────────────────────────────────────────────────────────────
    console.log("\n🔥 Test 1: Reporting defect on SOLD_TO_CUSTOMER pack...");
    const soldSerial = `PAX-P8-SOLD-${Date.now()}`;
    await prisma.paxPack.create({
      data: {
        paxSerial: soldSerial,
        paxTypeId: paxType.id,
        status: PaxStatus.SOLD_TO_CUSTOMER // Sold pack!
      }
    });
    paxSerials.push(soldSerial);

    // Report a defect on this sold pack (should fail with 400)
    const defectRes1 = await app.inject({
      method: "POST",
      url: "/crm/quality/defects",
      headers: techHeaders,
      payload: {
        paxSerial: soldSerial,
        defectType: "bms_failure",
        severity: "HIGH",
        description: "Reported defect on sold pack",
        disposition: "REPAIR"
      }
    });

    if (defectRes1.statusCode === 400) {
      console.log("   ✅ Succeeded: Blocked reporting defect on customer-owned SOLD_TO_CUSTOMER pack.");
    } else {
      throw new Error(`Expected defect creation on sold pack to fail with 400, got ${defectRes1.statusCode}`);
    }

    // Now create an assembled pack for a valid defect report (to use in Test 2)
    const assembledSerial = `PAX-P8-ASSEMBLED-${Date.now()}`;
    await prisma.paxPack.create({
      data: {
        paxSerial: assembledSerial,
        paxTypeId: paxType.id,
        status: PaxStatus.PAX_ASSEMBLED
      }
    });
    paxSerials.push(assembledSerial);

    const validDefectRes = await app.inject({
      method: "POST",
      url: "/crm/quality/defects",
      headers: techHeaders,
      payload: {
        paxSerial: assembledSerial,
        defectType: "bms_failure",
        severity: "HIGH",
        description: "Reported defect on assembled pack",
        disposition: "REPAIR"
      }
    });

    if (validDefectRes.statusCode !== 200) {
      throw new Error(`Valid defect reporting failed: ${validDefectRes.payload}`);
    }

    const defect1 = JSON.parse(validDefectRes.payload);
    defectIds.push(defect1.id);

    // ─────────────────────────────────────────────────────────────
    // VULNERABILITY 2: DUPLICATE DEFECT RESOLUTION BYPASS
    // ─────────────────────────────────────────────────────────────
    console.log("\n🔥 Test 2: Resolving an already resolved defect...");
    
    // Resolve defect 1 the first time (should succeed)
    const resolveRes1 = await app.inject({
      method: "PUT",
      url: `/crm/quality/defects/${defect1.id}/resolve`,
      headers: adminHeaders,
      payload: {
        disposition: "REPAIRED",
        rootCause: "Loose connection fixed"
      }
    });
    if (resolveRes1.statusCode !== 200) {
      throw new Error(`First defect resolution failed: ${resolveRes1.payload}`);
    }
    console.log("   ✅ First resolution succeeded (Defect -> RESOLVED).");

    // Resolve defect 1 a second time (should be blocked, but let's see current behavior)
    const resolveRes2 = await app.inject({
      method: "PUT",
      url: `/crm/quality/defects/${defect1.id}/resolve`,
      headers: adminHeaders,
      payload: {
        disposition: "REPAIRED_AGAIN",
        rootCause: "Repeat resolution check"
      }
    });

    if (resolveRes2.statusCode === 200) {
      console.log("   🚨 VULNERABILITY CONFIRMED: Allowed double resolution of already RESOLVED defect!");
      const reResolvedDef = await prisma.defect.findUnique({ where: { id: defect1.id } });
      console.log(`   Defect disposition after repeat resolution: ${reResolvedDef?.disposition}`);
    } else {
      console.log("   ✅ Succeeded: Repeat resolution was blocked.");
    }

  } catch (err: any) {
    console.error("\n❌ Test Suite Failed:", err.message);
    await cleanup();
    process.exit(1);
  }

  await cleanup();
  console.log("\n🎉 Phase 8 Adversarial Defect & Quality Audit Tests completed successfully.");
  process.exit(0);
}

runTests();
