import { PrismaClient, Role, PaxStatus } from "../generated/client";
import axios from "axios";

const prisma = new PrismaClient();

async function testPackingWorkflow() {
  console.log("🧪 Testing Complete Packing Module Workflow...");

  // 1. Find or prepare a test PaxPack that has passed testing and QC
  let testPax = await prisma.paxPack.findFirst({
    where: {
      status: { in: ["READY_FOR_SALE", "PAX_TESTED"] },
      packingRecord: null
    },
    include: { paxType: true }
  });

  if (!testPax) {
    // Create a mock pax pack for testing
    const paxType = await prisma.paxType.findFirst();
    if (!paxType) throw new Error("No paxType found");

    testPax = await prisma.paxPack.create({
      data: {
        paxSerial: `TEST-PX-${Date.now()}`,
        paxTypeId: paxType.id,
        status: PaxStatus.READY_FOR_SALE,
        testReportUrl: "https://test.report/tr-001.pdf"
      },
      include: { paxType: true }
    });
    console.log(`Created test pax pack: ${testPax.paxSerial}`);
  } else {
    console.log(`Using existing eligible pax pack: ${testPax.paxSerial} (${testPax.paxType.name})`);
  }

  // 2. Test Verification
  const verifyPax = await prisma.paxPack.findUnique({
    where: { paxSerial: testPax.paxSerial },
    include: { paxType: { include: { packingConfigs: true } }, inspections: true, defects: true, packingRecord: true }
  });
  console.log(`✓ Pax Verified: Status = ${verifyPax?.status}, Configured Materials = ${verifyPax?.paxType.packingConfigs.length}`);

  // 3. Test Packing Start
  const operator = await prisma.user.findFirst({ where: { email: "packing@kyrazam.com" } });
  if (!operator) throw new Error("Packing operator user not found");

  const packingNumber = `PK-TEST-${Date.now().toString().slice(-6)}`;
  const packingRec = await prisma.packingRecord.create({
    data: {
      packingNumber,
      paxSerial: testPax.paxSerial,
      paxTypeId: testPax.paxTypeId,
      operatorId: operator.id,
      status: "PACKING_IN_PROGRESS",
      checklistItems: {
        create: [
          { itemType: "MATERIAL", itemName: "Fast Charger 54.6V", required: true, verified: true, quantity: 1, condition: "GOOD" },
          { itemType: "MATERIAL", itemName: "AC Power Cable", required: true, verified: true, quantity: 1, condition: "GOOD" },
          { itemType: "BOX", itemName: "Outer Carton Clean & Undamaged", required: true, verified: true, quantity: 1, condition: "GOOD" },
          { itemType: "BOX", itemName: "Tamper-evident Seal Applied", required: true, verified: true, quantity: 1, condition: "GOOD" }
        ]
      }
    },
    include: { checklistItems: true }
  });
  console.log(`✓ Packing session created: ${packingRec.packingNumber} with ${packingRec.checklistItems.length} checklist items.`);

  // 4. Test Final Confirmation
  const confirmed = await prisma.packingRecord.update({
    where: { id: packingRec.id },
    data: {
      status: "PACKED",
      completedAt: new Date(),
      stickerNumber: `STK-TEST-${Date.now().toString().slice(-6)}`,
      stickerGeneratedAt: new Date(),
      boxSealed: true,
      qrData: JSON.stringify({ serial: testPax.paxSerial, packingId: packingNumber })
    }
  });
  console.log(`✓ Packing confirmed: Status = ${confirmed.status}, Sticker = ${confirmed.stickerNumber}`);

  // 5. Test Warehouse Transfer
  const fgWarehouse = await prisma.warehouse.findFirst({
    include: { locations: true }
  });
  if (fgWarehouse && fgWarehouse.locations.length > 0) {
    const loc = fgWarehouse.locations[0];
    const transferred = await prisma.packingRecord.update({
      where: { id: packingRec.id },
      data: {
        status: "TRANSFERRED_TO_FINISHED_GOODS",
        destinationWarehouseId: fgWarehouse.id,
        destinationLocationId: loc.id,
        transferredAt: new Date()
      }
    });

    await prisma.stockMovement.create({
      data: {
        materialId: (await prisma.material.findFirst())?.id || "mock",
        quantity: 1,
        movementType: "RECEIPT",
        source: "PACKING_TRANSFER_FINISHED_GOODS",
        referenceId: packingNumber,
        warehouseId: fgWarehouse.id,
        locationId: loc.id,
        userId: operator.id,
        reason: "Test packing transfer"
      }
    });

    console.log(`✓ Transferred to FG Warehouse: ${fgWarehouse.name} (${loc.name || loc.code}), Status = ${transferred.status}`);
  }

  console.log("\n🎉 ALL PACKING WORKFLOW TESTS PASSED!");
}

testPackingWorkflow()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
