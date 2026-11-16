import { PrismaClient } from "../generated/client";
import { seedExpenseDefaults } from "./seed-expense-defaults";

const prisma = new PrismaClient();

async function run() {
  await seedExpenseDefaults(prisma);
  await prisma.$disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
