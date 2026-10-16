import { PrismaClient } from "../generated/client";
import { normalizeSerial } from "../utils/serial";

const prisma = new PrismaClient();

async function run() {
  console.log("🚀 Starting database normalization...");

  const cells = await prisma.cell.findMany();
  let updatedCount = 0;

  for (const cell of cells) {
    const normalized = normalizeSerial(cell.serialNumber);
    if (normalized !== cell.serialNumber) {
      console.log(`Updating: ${cell.serialNumber} -> ${normalized}`);
      
      try {
        await prisma.$transaction(async (tx) => {
          // 1. Update Cell (Since it's the ID, we might need to be careful)
          // Prisma doesn't like updating IDs directly if they have relations.
          // We'll create a new one and delete the old one or use a raw query.
          
          // Using RAW SQL to bypass Prisma's strict ID immutability if needed, 
          // but let's try a standard update first.
          
          await tx.$executeRawUnsafe(
            `UPDATE "Cell" SET "serialNumber" = $1 WHERE "serialNumber" = $2`,
            normalized, cell.serialNumber
          );

          // 2. Update related tables
          await tx.$executeRawUnsafe(
            `UPDATE "PaxCell" SET "cellSerial" = $1 WHERE "cellSerial" = $2`,
            normalized, cell.serialNumber
          );

          await tx.$executeRawUnsafe(
            `UPDATE "AuditLog" SET "entityId" = $1 WHERE "entityId" = $2 AND "entityType" = 'cell'`,
            normalized, cell.serialNumber
          );
        });
        updatedCount++;
      } catch (err) {
        console.error(`Failed to update ${cell.serialNumber}:`, err);
      }
    }
  }

  console.log(`✅ Normalization complete. Updated ${updatedCount} cells.`);
  await prisma.$disconnect();
}

run();
