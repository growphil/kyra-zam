import { PrismaClient } from "../generated/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=== STARTING BRAND-AWARE IDENTITY MIGRATION & RECONCILIATION ===");

  // 1. Add column nextSequence to Brand if missing
  console.log("1. Adding nextSequence column to Brand table...");
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "Brand" ADD COLUMN IF NOT EXISTS "nextSequence" INTEGER NOT NULL DEFAULT 1;
  `);

  // 2. Add indexes and constraints on Product
  console.log("2. Ensuring unique constraint and index on Product(partNumber, brandId)...");
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "Product_partNumber_brandId_key" 
    ON public."Product" ("partNumber", "brandId");
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "Product_brandId_idx" 
    ON public."Product" ("brandId");
  `);

  // 3. Initialize nextSequence for all existing brands
  console.log("3. Initializing brand nextSequence counters...");
  const brands = await prisma.brand.findMany();
  for (const b of brands) {
    const prodCount = await prisma.product.count({
      where: { brandId: b.id }
    });
    const nextSeq = prodCount + 1;
    await prisma.brand.update({
      where: { id: b.id },
      data: { nextSequence: nextSeq }
    });
    console.log(`   Brand "${b.name}" (${b.code}): ${prodCount} products -> nextSequence = ${nextSeq}`);
  }

  // 4. Reconcile existing records: Texas Instruments products that shared materials with STMicroelectronics or had null materialId
  console.log("4. Reconciling shared & missing material identities...");
  const tiBrand = await prisma.brand.findFirst({
    where: { name: { equals: "Texas Instruments", mode: "insensitive" } }
  });

  if (tiBrand) {
    const tiProducts = await prisma.product.findMany({
      where: { brandId: tiBrand.id }
    });

    for (const prod of tiProducts) {
      // Check if this product has null material or is sharing a material with STMicro
      let needsNewMaterial = false;
      if (!prod.materialId) {
        needsNewMaterial = true;
      } else {
        const otherProduct = await prisma.product.findFirst({
          where: {
            materialId: prod.materialId,
            brandId: { not: tiBrand.id }
          }
        });
        if (otherProduct) {
          needsNewMaterial = true;
        }
      }

      if (needsNewMaterial) {
        const brandCode = tiBrand.code || "TXI";
        const newSku = `${brandCode}-${prod.partNumber}`;
        const newMaterialCode = `MAT-${newSku}`;

        let material = await prisma.material.findUnique({
          where: { sku: newSku }
        });

        if (!material) {
          material = await prisma.material.create({
            data: {
              sku: newSku,
              materialCode: newMaterialCode,
              name: `${prod.name} (${tiBrand.name})`,
              category: prod.category,
              unit: prod.unit || "PCS",
              description: prod.description || `Product Master SKU (${tiBrand.name})`,
              minStock: 5,
              unitPrice: 0,
              materialType: ["CELL", "CELLS"].includes(prod.category.toUpperCase()) ? "CELL" : "QTZ",
              isActive: true
            }
          });
          console.log(`   Created dedicated Material for ${tiBrand.name} ${prod.partNumber}: SKU ${newSku} (${material.id})`);
        }

        await prisma.product.update({
          where: { id: prod.id },
          data: { materialId: material.id }
        });

        // Also update any purchase order items and goods receipt items linked to this product
        await prisma.purchaseOrderItem.updateMany({
          where: { productId: prod.id, materialId: null },
          data: { materialId: material.id }
        });

        await prisma.goodsReceiptItem.updateMany({
          where: { productId: prod.id, materialId: null },
          data: { materialId: material.id }
        });

        console.log(`   Reconciled Product ${prod.uin} -> Material ${material.sku}`);
      }
    }
  }

  console.log("=== MIGRATION & RECONCILIATION COMPLETED SUCCESSFULLY ===");
}

main()
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
