import { PrismaClient } from "../generated/client";

const prisma = new PrismaClient();

async function inspectForeignKeys() {
  const fks: {
    table_name: string;
    column_name: string;
    foreign_table_name: string;
    foreign_column_name: string;
  }[] = await prisma.$queryRawUnsafe(`
    SELECT
      tc.table_name,
      kcu.column_name,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name
    FROM
      information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
    ORDER BY tc.table_name;
  `);

  console.log(`Found ${fks.length} foreign key relationships in public schema:\n`);
  for (const fk of fks) {
    console.log(`"${fk.table_name}"."${fk.column_name}" -> "${fk.foreign_table_name}"."${fk.foreign_column_name}"`);
  }

  await prisma.$disconnect();
}

inspectForeignKeys();
