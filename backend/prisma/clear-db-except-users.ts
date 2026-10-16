import { PrismaClient, Role } from "../src/generated/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🧹 Starting complete database wipe (EXCEPT Users)...");

  // 1. Get all table names in public schema
  const tablenames = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables 
    WHERE schemaname = 'public' 
      AND tablename NOT IN ('User', '_prisma_migrations');
  `;

  console.log(`Found ${tablenames.length} tables to truncate...`);

  // 2. Truncate all non-user tables with CASCADE
  for (const { tablename } of tablenames) {
    try {
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${tablename}" CASCADE;`);
      console.log(`  ✓ Truncated "${tablename}"`);
    } catch (err: any) {
      console.warn(`  ⚠️ Could not truncate "${tablename}": ${err.message}`);
    }
  }

  // 3. Ensure standard User accounts and roles exist and are active
  console.log("\n👥 Verifying / Seeding user role accounts...");

  const usersToEnsure = [
    {
      name: "Arjun Mehta",
      email: "superadmin@kyrazam.com",
      roles: [Role.SUPERADMIN],
      pass: "SuperAdmin@2025"
    },
    {
      name: "Priya Sharma",
      email: "admin@kyrazam.com",
      roles: [Role.ADMIN],
      pass: "Admin@2025"
    },
    {
      name: "Ravi Kumar",
      email: "inv@kyrazam.com",
      roles: [Role.INVENTORY_MANAGER],
      pass: "InvMgr@2025"
    },
    {
      name: "Sunita Patel",
      email: "test@kyrazam.com",
      roles: [Role.TEST_ENGINEER],
      pass: "TestEng@2025"
    },
    {
      name: "Deepak Nair",
      email: "asm@kyrazam.com",
      roles: [Role.ASSEMBLY_TECHNICIAN],
      pass: "AsmTech@2025"
    },
    {
      name: "Kiran Reddy",
      email: "paxtest@kyrazam.com",
      roles: [Role.PAX_TEST_ENGINEER],
      pass: "PaxTest@2025"
    },
    {
      name: "Meena Iyer",
      email: "super@kyrazam.com",
      roles: [Role.SUPERVISOR],
      pass: "Supervisor@2025"
    },
    {
      name: "Vikram Singh",
      email: "sales@kyrazam.com",
      roles: [Role.SALES_EXECUTIVE],
      pass: "SalesExec@2025"
    },
    {
      name: "Ananya Bose",
      email: "acct@kyrazam.com",
      roles: [Role.ACCOUNTANT],
      pass: "Accountant@2025"
    },
    {
      name: "Sanjay Gupta",
      email: "purchase@kyrazam.com",
      roles: [Role.PURCHASE_MANAGER],
      pass: "PurchMgr@2025"
    },
    {
      name: "Rohit Sharma",
      email: "marketing@kyrazam.com",
      roles: [Role.MARKETING_MANAGER],
      pass: "Marketing@2025"
    },
    {
      name: "Amit Patel",
      email: "qc@kyrazam.com",
      roles: [Role.QC],
      pass: "QcEngineer@2025"
    }
  ];

  for (const u of usersToEnsure) {
    const passwordHash = await bcrypt.hash(u.pass, 12);
    await prisma.user.upsert({
      where: { email: u.email },
      update: {
        name: u.name,
        roles: u.roles,
        passwordHash,
        isActive: true
      },
      create: {
        name: u.name,
        email: u.email,
        roles: u.roles,
        passwordHash,
        isActive: true
      }
    });
    console.log(`  ✓ User active: ${u.email} (${u.roles.join(", ")})`);
  }

  // Also seed default QC thresholds and PAX Types if needed, or leave clean per request
  console.log("\n✅ Database wipe complete! All operational and business data cleared. Only user accounts and roles remain.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

