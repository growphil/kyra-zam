import { prisma } from "../prisma";

async function main() {
  const cellMaterial = await prisma.material.findFirst({
    where: { sku: "SKU-B-8888" }
  });

  if (!cellMaterial) {
    console.error("Test Cells B material not found");
    return;
  }

  const existingBom = await prisma.bOM.findFirst({
    where: { name: { contains: "10AH", mode: "insensitive" } }
  });

  if (!existingBom) {
    const [bom]: any = await prisma.$queryRawUnsafe(`
      INSERT INTO "BOM" (id, name, description, "updatedAt")
      VALUES (gen_random_uuid(), $1, $2, NOW())
      RETURNING *
    `, "10AH Battery BOM", "Standard Bill of Materials for 10AH Battery Pack");

    await prisma.$queryRawUnsafe(`
      INSERT INTO "BOMItem" (id, "bomId", "materialId", quantity)
      VALUES (gen_random_uuid(), $1, $2, $3)
    `, bom.id, cellMaterial.id, 1);

    console.log("Created 10AH Battery BOM:", bom);
  } else {
    console.log("10AH BOM already exists:", existingBom);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
