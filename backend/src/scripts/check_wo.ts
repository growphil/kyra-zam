import { prisma } from "../prisma";

async function main() {
  const woId = "ac26b8b3-efc8-47b0-9435-8815d969cff2";
  const wo = await prisma.workOrder.findUnique({
    where: { id: woId },
    include: { execution: true }
  });
  console.log("Current state:", wo);
}

main().catch(console.error).finally(() => prisma.$disconnect());
