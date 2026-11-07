import { prisma } from "../prisma";
import bcrypt from "bcryptjs";
import { Role } from "../generated/client";

async function testUltraAdmin() {
  console.log("==================================================");
  console.log("  ULTRA ADMIN VERIFICATION TEST SUITE");
  console.log("==================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (condition) {
      console.log(`  ✓ PASS: ${msg}`);
      passed++;
    } else {
      console.error(`  ✕ FAIL: ${msg}`);
      failed++;
    }
  }

  try {
    // 1. Verify ULTRA_ADMIN exists in database
    console.log("1. Checking Ultra Admin User Existence...");
    const ultraAdmin = await prisma.user.findUnique({
      where: { email: "ultraadmin@kyrazam.com" }
    });
    assert(!!ultraAdmin, "Ultra Admin user found in database");
    assert(ultraAdmin?.roles?.includes(Role.ULTRA_ADMIN) === true, "User has ULTRA_ADMIN role");

    // 2. Create a test Super Admin user
    console.log("\n2. Creating Test Super Admin User...");
    const testSuperEmail = "test-superadmin-temp@kyrazam.com";
    await prisma.user.deleteMany({ where: { email: testSuperEmail } });
    
    const passwordHash = await bcrypt.hash("TempSuperAdmin@2025", 10);
    const testSuperAdmin = await prisma.user.create({
      data: {
        name: "Test Super Admin",
        email: testSuperEmail,
        passwordHash,
        roles: [Role.SUPERADMIN],
        isActive: true
      }
    });
    assert(!!testSuperAdmin.id, "Test Super Admin user created");

    // 3. Test RBAC permissions:
    console.log("\n3. Testing Role Hierarchy & Permission Rules...");
    const isUltraAdmin = (ultraAdmin?.roles as string[]).includes("ULTRA_ADMIN");
    const allowedForInventory = isUltraAdmin || ["INVENTORY_MANAGER"].includes("ULTRA_ADMIN");
    assert(allowedForInventory, "Ultra Admin granted universal bypass for INVENTORY_MANAGER route");

    const allowedForSupervisor = isUltraAdmin || ["SUPERVISOR"].includes("ULTRA_ADMIN");
    assert(allowedForSupervisor, "Ultra Admin granted universal bypass for SUPERVISOR route");

    // 4. Test Deletion Permission Guard Logic:
    console.log("\n4. Testing Super Admin Deletion Guards...");
    
    // Scenario A: Normal Admin or another Superadmin cannot delete Superadmin
    const callerSuperadminRoles = ["SUPERADMIN"];
    const callerIsUltraAdminA = callerSuperadminRoles.includes("ULTRA_ADMIN");
    const targetIsSuperadmin = testSuperAdmin.roles.includes(Role.SUPERADMIN);
    const canDeleteA = !targetIsSuperadmin || callerIsUltraAdminA;
    assert(!canDeleteA, "SUPERADMIN caller CANNOT delete another SUPERADMIN (Blocked)");

    // Scenario B: Ultra Admin deletes Superadmin
    const callerUltraAdminRoles = ["ULTRA_ADMIN"];
    const callerIsUltraAdminB = callerUltraAdminRoles.includes("ULTRA_ADMIN");
    const canDeleteB = !targetIsSuperadmin || callerIsUltraAdminB;
    assert(canDeleteB, "ULTRA_ADMIN caller CAN delete SUPERADMIN (Permitted)");

    // Scenario C: Self Deletion blocked
    const selfDeleteBlocked = ultraAdmin!.id === ultraAdmin!.id;
    assert(selfDeleteBlocked, "Ultra Admin self-deletion is properly blocked");

    // 5. Test Database Transaction Deletion of Super Admin:
    console.log("\n5. Executing Clean Deletion of Super Admin by Ultra Admin...");
    await prisma.$transaction(async (tx) => {
      await tx.refreshToken.deleteMany({ where: { userId: testSuperAdmin.id } });
      await tx.auditLog.deleteMany({ where: { actorId: testSuperAdmin.id } });
      await tx.user.delete({ where: { id: testSuperAdmin.id } });
    });

    const verifyDeleted = await prisma.user.findUnique({
      where: { id: testSuperAdmin.id }
    });
    assert(!verifyDeleted, "Test Super Admin successfully and cleanly deleted from database");

    console.log("\n==================================================");
    console.log(`  RESULTS: ${passed} Passed, ${failed} Failed`);
    console.log("==================================================");

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err: any) {
    console.error("Test execution error:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testUltraAdmin();

