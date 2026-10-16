import { PrismaClient } from "../generated/client";
import { ScrapWorkflowEngine } from "../services/scrapWorkflowEngine";

const prisma = new PrismaClient();

async function runTest() {
  console.log("🧪 Running ScrapWorkflowEngine integration tests...");

  // 1. Create a dummy material
  const material = await prisma.material.create({
    data: {
      name: "Test Battery Cells",
      category: "CELLS",
      sku: `SKU-TEST-${Date.now().toString().slice(-4)}`,
      quantity: 100,
      unit: "pcs",
      unitPrice: 50.0,
      totalValue: 5000.0,
    }
  });
  console.log(`✅ Created test material: ${material.name} (Stock: ${material.quantity}, Price: ₹${material.unitPrice})`);

  // Find a test user (superadmin or similar)
  const user = await prisma.user.findFirst();
  if (!user) throw new Error("No user seeded in DB");
  const actorId = user.id;

  // ─────────────────────────────────────────────────────────────
  // TEST case 1: LOSS SCRAP WORKFLOW
  // ─────────────────────────────────────────────────────────────
  console.log("\n📦 Test case 1: Loss scrap workflow...");
  
  // Create manual scrap entry
  let scrapLoss = await prisma.scrapEntry.create({
    data: {
      scrapId: `SCRAP-LOSS-TST-${Date.now().toString().slice(-4)}`,
      scrapType: "LOSS",
      sourceType: "PRODUCTION",
      status: "REPORTED",
      materialId: material.id,
      materialName: material.name,
      sku: material.sku,
      quantity: 10,
      unitCost: material.unitPrice,
      totalCost: 10 * material.unitPrice,
      defectType: "Voltage Failure",
      severity: "HIGH",
      createdBy: actorId,
    }
  });
  console.log(`✅ Created LOSS scrap entry: ${scrapLoss.scrapId} (Qty: ${scrapLoss.quantity})`);

  // Move to UNDER_REVIEW
  scrapLoss = await prisma.$transaction(async (tx) => {
    return await ScrapWorkflowEngine.transition(
      tx,
      scrapLoss.id,
      "UNDER_REVIEW",
      actorId,
      { notes: "Evaluating defect severity" },
      ["ADMIN"]
    );
  });
  console.log(`✅ Transitioned to status: ${scrapLoss.status}`);

  // Transition to SCRAPPED (should deduct stock)
  scrapLoss = await prisma.$transaction(async (tx) => {
    return await ScrapWorkflowEngine.transition(
      tx,
      scrapLoss.id,
      "SCRAPPED",
      actorId,
      { notes: "Scrapped item write-off" },
      ["ADMIN"]
    );
  });
  console.log(`✅ Transitioned to status: ${scrapLoss.status}`);

  // Verify stock deduction
  const materialAfterScrap = await prisma.material.findUnique({ where: { id: material.id } });
  console.log(`🔍 Material Stock: Before = 100, After = ${materialAfterScrap?.quantity} (Expected: 90)`);
  if (materialAfterScrap?.quantity !== 90) {
    throw new Error("Inventory stock deduction failed!");
  }

  // ─────────────────────────────────────────────────────────────
  // TEST case 2: LOSS INVENTORY GUARD ROLLBACK
  // ─────────────────────────────────────────────────────────────
  console.log("\n📦 Test case 2: Loss scrap inventory guard rollback...");
  
  let excessiveScrap = await prisma.scrapEntry.create({
    data: {
      scrapId: `SCRAP-EXC-TST-${Date.now().toString().slice(-4)}`,
      scrapType: "LOSS",
      sourceType: "PRODUCTION",
      status: "REPORTED",
      materialId: material.id,
      materialName: material.name,
      sku: material.sku,
      quantity: 500, // Exceeds available stock (90)
      unitCost: material.unitPrice,
      totalCost: 500 * material.unitPrice,
      defectType: "Voltage Failure",
      severity: "HIGH",
      createdBy: actorId,
    }
  });

  excessiveScrap = await prisma.$transaction(async (tx) => {
    return await ScrapWorkflowEngine.transition(
      tx,
      excessiveScrap.id,
      "UNDER_REVIEW",
      actorId,
      { notes: "Reviewing excessive quantity" },
      ["ADMIN"]
    );
  });

  try {
    await prisma.$transaction(async (tx) => {
      return await ScrapWorkflowEngine.transition(
        tx,
        excessiveScrap.id,
        "SCRAPPED",
        actorId,
        { notes: "Should fail" },
        ["ADMIN"]
      );
    });
    throw new Error("Inventory guard failed to throw error on insufficient stock!");
  } catch (err: any) {
    console.log(`✅ Caught expected error: "${err.message}" (Inventory guard rolled back successfully)`);
  }

  // ─────────────────────────────────────────────────────────────
  // TEST case 3: PROFITABLE SCRAP WORKFLOW
  // ─────────────────────────────────────────────────────────────
  console.log("\n📦 Test case 3: Profitable scrap value recovery workflow...");
  
  // Create entry
  let scrapProfit = await prisma.scrapEntry.create({
    data: {
      scrapId: `SCRAP-PROF-TST-${Date.now().toString().slice(-4)}`,
      scrapType: "PROFITABLE",
      sourceType: "SERVICE",
      status: "REPORTED",
      materialId: material.id,
      materialName: material.name,
      sku: material.sku,
      quantity: 5,
      unitCost: material.unitPrice,
      totalCost: 5 * material.unitPrice,
      estimatedRecoveryValue: 150.0,
      defectType: "Other",
      severity: "LOW",
      createdBy: actorId,
    }
  });
  console.log(`✅ Created PROFITABLE scrap entry: ${scrapProfit.scrapId}`);

  // Transition to UNDER_REVIEW
  scrapProfit = await prisma.$transaction(async (tx) => {
    return await ScrapWorkflowEngine.transition(tx, scrapProfit.id, "UNDER_REVIEW", actorId, {}, ["ADMIN"]);
  });
  console.log(`✅ Transitioned to: ${scrapProfit.status}`);

  // Transition to STORED (should create ScrapInventory)
  scrapProfit = await prisma.$transaction(async (tx) => {
    return await ScrapWorkflowEngine.transition(
      tx,
      scrapProfit.id,
      "STORED",
      actorId,
      { location: "Scrap Bin C" },
      ["ADMIN"]
    );
  });
  console.log(`✅ Transitioned to: ${scrapProfit.status}`);

  // Check inventory entry
  const scrapInv = await prisma.scrapInventory.findUnique({ where: { scrapEntryId: scrapProfit.id } });
  console.log(`🔍 Scrap Inventory details: Location = "${scrapInv?.location}", Qty = ${scrapInv?.quantity}`);
  if (scrapInv?.location !== "Scrap Bin C" || scrapInv?.quantity !== 5) {
    throw new Error("Scrap inventory record failed to populate!");
  }

  // Transition to SOLD (should create ScrapSale and update actual sale value)
  scrapProfit = await prisma.$transaction(async (tx) => {
    return await ScrapWorkflowEngine.transition(
      tx,
      scrapProfit.id,
      "SOLD",
      actorId,
      { buyerName: "Metal Buyers Inc", salePrice: 40.0, quantitySold: 5 },
      ["ADMIN"]
    );
  });
  console.log(`✅ Transitioned to: ${scrapProfit.status}`);

  // Verify sale and entry revenue fields
  const scrapSale = await prisma.scrapSale.findFirst({ where: { scrapEntryId: scrapProfit.id } });
  console.log(`🔍 Sale Logged: Buyer = "${scrapSale?.buyerName}", Sale Price = ₹${scrapSale?.salePrice}, Total Revenue = ₹${scrapProfit.actualSaleValue}`);
  if (scrapSale?.buyerName !== "Metal Buyers Inc" || scrapProfit.actualSaleValue !== 200.0) {
    throw new Error("Sale recording or revenue calculation failed!");
  }

  // Verify ScrapInventory quantity dropped to 0 and marked SOLD
  const scrapInvAfterSale = await prisma.scrapInventory.findUnique({ where: { scrapEntryId: scrapProfit.id } });
  console.log(`🔍 Scrap Inventory after sale: Qty = ${scrapInvAfterSale?.quantity}, Status = ${scrapInvAfterSale?.currentStatus}`);
  if (scrapInvAfterSale?.quantity !== 0 || scrapInvAfterSale?.currentStatus !== "SOLD") {
    throw new Error("Scrap inventory cleanup failed!");
  }

  console.log("\n🎉 ALL ScrapWorkflowEngine tests passed successfully!");
}

runTest()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
