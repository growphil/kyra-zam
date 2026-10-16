import { prisma } from "../prisma";

async function main() {
  const boms = await prisma.bOM.findMany({
    include: { items: { include: { material: true } } }
  });
  console.log("=== EXISTING BOMS ===");
  console.log(boms.map(b => ({ id: b.id, name: b.name, description: b.description, itemsCount: b.items.length })));

  const req = await prisma.productionRequirement.findFirst({
    where: { requirementNumber: "PRD-009018" }
  });
  console.log("=== PRD-009018 ===", req);
}

main().catch(console.error).finally(() => prisma.$disconnect());
