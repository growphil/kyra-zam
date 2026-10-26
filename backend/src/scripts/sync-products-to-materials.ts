import { prisma } from "../prisma";

async function main() {
  console.log("Synchronizing Product Master records to Factory Material SKUs...");
  const products = await prisma.product.findMany({
    include: { material: true }
  });

  let createdCount = 0;
  let linkedCount = 0;

  for (const prod of products) {
    let materialId = prod.materialId;
    if (!materialId) {
      let mat = await prisma.material.findUnique({
        where: { sku: prod.partNumber }
      });

      if (!mat) {
        const isCell = ["CELL", "CELLS"].includes(prod.category.toUpperCase());
        mat = await prisma.material.create({
          data: {
            sku: prod.partNumber,
            materialCode: `MAT-${prod.partNumber}`,
            name: prod.name,
            category: prod.category,
            unit: prod.unit || "PCS",
            description: prod.description || `Auto-synced from Product Master (${prod.brand})`,
            minStock: 5,
            unitPrice: 0,
            materialType: isCell ? "CELL" : "QTZ",
            isActive: true
          }
        });
        createdCount++;
      }

      await prisma.product.update({
        where: { id: prod.id },
        data: { materialId: mat.id }
      });
      linkedCount++;
    }
  }

  console.log(`Sync completed: ${createdCount} Material SKUs created, ${linkedCount} Products linked.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
