import { PrismaClient } from "../generated/client";

const prisma = new PrismaClient();

async function inspectUsers() {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, roles: true, createdAt: true },
    orderBy: { createdAt: "asc" }
  });
  console.log(`Total users in database: ${users.length}`);
  console.table(users);
  await prisma.$disconnect();
}

inspectUsers();
