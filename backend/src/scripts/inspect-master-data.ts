import { PrismaClient } from "../generated/client";

const prisma = new PrismaClient();

async function inspectMasters() {
  console.log("--- USERS ---");
  const users = await prisma.user.findMany({ select: { id: true, name: true, email: true, roles: true } });
  console.log(`Total users: ${users.length}`);
  console.table(users.slice(0, 15));

  console.log("\n--- PRODUCTION STATIONS ---");
  const stations = await prisma.productionStation.findMany();
  console.table(stations);

  console.log("\n--- WAREHOUSES & LOCATIONS ---");
  const warehouses = await prisma.warehouse.findMany({ include: { locations: true } });
  console.log(JSON.stringify(warehouses, null, 2));

  console.log("\n--- PAX TYPES ---");
  const paxTypes = await prisma.paxType.findMany();
  console.table(paxTypes);

  console.log("\n--- QC THRESHOLDS ---");
  const qcThresholds = await prisma.qcThreshold.findMany();
  console.table(qcThresholds);

  console.log("\n--- BOMS ---");
  const boms = await prisma.bOM.findMany({ select: { id: true, name: true } });
  console.table(boms);

  console.log("\n--- MATERIALS ---");
  const materials = await prisma.material.findMany({ select: { id: true, name: true, sku: true, category: true, quantity: true } });
  console.log(`Total materials: ${materials.length}`);
  console.table(materials.slice(0, 15));

  await prisma.$disconnect();
}

inspectMasters().catch(e => {
  console.error(e);
  process.exit(1);
});
