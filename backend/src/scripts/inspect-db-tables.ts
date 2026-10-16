import { PrismaClient } from "../generated/client";

const prisma = new PrismaClient();

async function inspectDatabase() {
  console.log("🔍 Inspecting PostgreSQL database tables and record counts...\n");

  // Query all user tables in public schema
  const tables: { tablename: string }[] = await prisma.$queryRawUnsafe(`
    SELECT tablename FROM pg_tables 
    WHERE schemaname = 'public' 
    ORDER BY tablename ASC;
  `);

  console.log(`Found ${tables.length} tables in schema 'public':\n`);

  const results: { table: string; count: number }[] = [];

  for (const { tablename } of tables) {
    if (tablename === '_prisma_migrations') continue;
    try {
      const countRes: { count: bigint }[] = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as count FROM "${tablename}";`);
      const count = Number(countRes[0]?.count || 0);
      results.push({ table: tablename, count });
    } catch (e: any) {
      console.warn(`Could not count table ${tablename}:`, e.message);
    }
  }

  // Print results
  console.table(results);

  await prisma.$disconnect();
}

inspectDatabase().catch(e => {
  console.error("Error inspecting database:", e);
  process.exit(1);
});
