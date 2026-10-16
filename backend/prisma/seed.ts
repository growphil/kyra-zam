import { PrismaClient, Role } from "../src/generated/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🧹 Starting complete database wipe (including legacy users)...");

  // 1. Get all table names in public schema except migrations
  const tablenames = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables 
    WHERE schemaname = 'public' 
      AND tablename NOT IN ('_prisma_migrations');
  `;

  console.log(`Found ${tablenames.length} tables to truncate...`);

  // 2. Truncate all tables with CASCADE
  for (const { tablename } of tablenames) {
    try {
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${tablename}" CASCADE;`);
      console.log(`  ✓ Truncated "${tablename}"`);
    } catch (err: any) {
      console.warn(`  ⚠️ Could not truncate "${tablename}": ${err.message}`);
    }
  }

  // 3. Ensure standard User accounts and roles exist and are active
  console.log("\n👥 Seeding clean 12 role user accounts...");

  const usersToEnsure = [
    {
      id: "00000000-0000-0000-0000-000000000001",
      name: "Arjun Mehta",
      email: "superadmin@kyrazam.com",
      roles: [Role.SUPERADMIN],
      pass: "SuperAdmin@2025"
    },
    {
      id: "00000000-0000-0000-0000-000000000002",
      name: "Priya Sharma",
      email: "admin@kyrazam.com",
      roles: [Role.ADMIN],
      pass: "Admin@2025"
    },
    {
      id: "00000000-0000-0000-0000-000000000003",
      name: "Ravi Kumar",
      email: "inv@kyrazam.com",
      roles: [Role.INVENTORY_MANAGER],
      pass: "InvMgr@2025"
    },
    {
      id: "00000000-0000-0000-0000-000000000004",
      name: "Sunita Patel",
      email: "test@kyrazam.com",
      roles: [Role.TEST_ENGINEER],
      pass: "TestEng@2025"
    },
    {
      id: "00000000-0000-0000-0000-000000000005",
      name: "Deepak Nair",
      email: "asm@kyrazam.com",
      roles: [Role.ASSEMBLY_TECHNICIAN],
      pass: "AsmTech@2025"
    },
    {
      id: "00000000-0000-0000-0000-000000000006",
      name: "Kiran Reddy",
      email: "paxtest@kyrazam.com",
      roles: [Role.PAX_TEST_ENGINEER],
      pass: "PaxTest@2025"
    },
    {
      id: "00000000-0000-0000-0000-000000000007",
      name: "Meena Iyer",
      email: "super@kyrazam.com",
      roles: [Role.SUPERVISOR],
      pass: "Supervisor@2025"
    },
    {
      id: "00000000-0000-0000-0000-000000000008",
      name: "Vikram Singh",
      email: "sales@kyrazam.com",
      roles: [Role.SALES_EXECUTIVE],
      pass: "SalesExec@2025"
    },
    {
      id: "00000000-0000-0000-0000-000000000009",
      name: "Ananya Bose",
      email: "acct@kyrazam.com",
      roles: [Role.ACCOUNTANT],
      pass: "Accountant@2025"
    },
    {
      id: "00000000-0000-0000-0000-000000000010",
      name: "Sanjay Gupta",
      email: "purchase@kyrazam.com",
      roles: [Role.PURCHASE_MANAGER],
      pass: "PurchMgr@2025"
    },
    {
      id: "00000000-0000-0000-0000-000000000011",
      name: "Rohit Sharma",
      email: "marketing@kyrazam.com",
      roles: [Role.MARKETING_MANAGER],
      pass: "Marketing@2025"
    },
    {
      id: "00000000-0000-0000-0000-000000000012",
      name: "Amit Patel",
      email: "qc@kyrazam.com",
      roles: [Role.QC],
      pass: "QcEngineer@2025"
    },
    {
      id: "00000000-0000-0000-0000-000000000013",
      name: "Suresh Patel",
      email: "packing@kyrazam.com",
      roles: [Role.PACKING_OPERATOR],
      pass: "Packing@2025"
    },
    {
      id: "00000000-0000-0000-0000-000000000014",
      name: "Rohan Verma",
      email: "seller@kyrazam.com",
      roles: [Role.SELLER],
      pass: "Seller@2025"
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
        id: u.id,
        name: u.name,
        email: u.email,
        roles: u.roles,
        passwordHash,
        isActive: true
      }
    });
    console.log(`  ✓ User active: ${u.email} (${u.roles.join(", ")})`);
  }
  console.log("\n👥 Users verified.");

  // 4. Seed Complete Enterprise Demo Data (10+ records across all roles)
  const { seedCompleteEnterpriseDemo } = await import("../src/scripts/seed-complete-enterprise-demo");
  await seedCompleteEnterpriseDemo();

  console.log("\n🚀 Seeding complete! Complete enterprise demo dataset successfully pushed across all roles.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());


