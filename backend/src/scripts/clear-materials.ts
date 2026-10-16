import { PrismaClient } from "../generated/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🔍 Checking materials in DB...");
  const count = await prisma.material.count();
  console.log(`Found ${count} material records in DB.`);

  const materials = await prisma.material.findMany({
    select: { id: true, sku: true, name: true, quantity: true, category: true }
  });
  console.log("Current Materials:", materials);

  console.log("🗑️ Deleting all Material records and dependent data (StockMovement, StockReservation, etc.)...");
  
  // Clean dependent tables if needed
  try {
    const deletedMovements = await prisma.stockMovement.deleteMany({});
    console.log(`✓ Deleted ${deletedMovements.count} stock movements`);
  } catch (e: any) {
    console.log("StockMovement delete error/not found:", e.message);
  }

  try {
    if ("stockReservation" in prisma) {
      const deletedReservations = await (prisma as any).stockReservation.deleteMany({});
      console.log(`✓ Deleted ${deletedReservations.count} stock reservations`);
    }
  } catch (e: any) {
    console.log("StockReservation delete error/not found:", e.message);
  }

  try {
    const deletedBOMItems = await prisma.bOMItem.deleteMany({});
    console.log(`✓ Deleted ${deletedBOMItems.count} BOM items`);
  } catch (e: any) {
    console.log("BOMItem delete error/not found:", e.message);
  }

  try {
    const deletedPRItems = await prisma.purchaseRequestItem.deleteMany({});
    console.log(`✓ Deleted ${deletedPRItems.count} PR items`);
  } catch (e: any) {
    console.log("PRItem note:", e.message);
  }

  try {
    const deletedPOItems = await prisma.purchaseOrderItem.deleteMany({});
    console.log(`✓ Deleted ${deletedPOItems.count} PO items`);
  } catch (e: any) {
    console.log("POItem note:", e.message);
  }

  try {
    const deletedGRNItems = await prisma.goodsReceiptItem.deleteMany({});
    console.log(`✓ Deleted ${deletedGRNItems.count} GRN items`);
  } catch (e: any) {
    console.log("GRNItem note:", e.message);
  }

  const deletedMaterials = await prisma.material.deleteMany({});
  console.log(`✓ Successfully deleted ${deletedMaterials.count} Materials.`);

  const remaining = await prisma.material.count();
  console.log(`Remaining materials in DB: ${remaining}`);
}

main()
  .catch((e) => {
    console.error("Error clearing materials:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
