import { PrismaClient, Role, GoodsReceiptStatus } from "../generated/client";

const prisma = new PrismaClient();

async function runTests() {
  console.log("===============================================================================");
  console.log("🚀 KYRA ZAM 2.0 — PO LINE ITEMS: BATCH & CURRENCY VERIFICATION TEST");
  console.log("===============================================================================\n");

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    totalTests++;
    if (condition) {
      passedTests++;
      console.log(`✅ [PASS] ${testName}`);
      if (detail) console.log(`   └─ ${detail}`);
    } else {
      console.error(`❌ [FAIL] ${testName}`);
      if (detail) console.error(`   └─ Reason: ${detail}`);
    }
  }

  try {
    const superAdmin = await prisma.user.findFirst({ where: { roles: { has: Role.SUPERADMIN } } });
    if (!superAdmin) throw new Error("SuperAdmin user not found");

    let vendor = await prisma.vendor.findFirst();
    if (!vendor) {
      vendor = await prisma.vendor.create({
        data: {
          name: "Test Vendor Global Ltd",
          category: "RAW_MATERIALS",
          contact: "Dev Vendor",
          email: "vendor@test.com",
          phone: "+91 99999 88888",
          address: "123 Tech Park",
          isActive: true
        }
      });
    }

    // 1. Create a Product to use in Line Items
    const testPartNumber = `BMS-TEST-${Date.now().toString().slice(-4)}`;
    const product = await prisma.product.create({
      data: {
        uin: `VEN-001-KYR-001-${testPartNumber}`,
        name: "Lithium BMS Master Controller",
        partNumber: testPartNumber,
        brand: "KYRA Electronics",
        category: "BMS",
        unit: "PCS"
      }
    });

    console.log("1. Testing PO Creation with Batch Numbers & Configured Currency (USD)...");

    // Line 1: Pre-assigned batch number
    // Line 2: No batch number (Pending at receipt => null in DB)
    const poNumber = `PO-TEST-${Date.now().toString().slice(-5)}`;
    const testBatch1 = "LOT-2026-US-001";

    const createdPO = await prisma.purchaseOrder.create({
      data: {
        poNumber,
        vendorId: vendor.id,
        createdById: superAdmin.id,
        orderDate: new Date(),
        expectedDeliveryDate: new Date(Date.now() + 86400000 * 7),
        status: "DRAFT",
        currency: "USD",
        subtotal: 1000.00,
        discount: 50.00,
        tax: 171.00,
        additionalCharges: 25.00,
        grandTotal: 1146.00,
        paymentTerms: "30 Days Net",
        deliveryTerms: "FOB Chicago Depot",
        billingAddress: "KYRA ZAM HQ",
        deliveryAddress: "KYRA ZAM Receiving Warehouse",
        notes: "Test PO with USD currency and incoming batch lot registration",
        items: {
          create: [
            {
              productId: product.id,
              brand: product.brand,
              partNumber: product.partNumber,
              productUin: product.uin,
              batchNumber: testBatch1,
              description: product.name,
              quantityOrdered: 10,
              quantityPending: 10,
              unitPrice: 50.00,
              discount: 20.00,
              taxRate: 18.00,
              taxAmount: 86.40,
              lineSubtotal: 500.00,
              lineTotal: 566.40
            },
            {
              productId: product.id,
              brand: product.brand,
              partNumber: product.partNumber,
              productUin: product.uin,
              batchNumber: null, // Pending at Receipt
              description: `${product.name} (Lot B - Pending)`,
              quantityOrdered: 10,
              quantityPending: 10,
              unitPrice: 50.00,
              discount: 30.00,
              taxRate: 18.00,
              taxAmount: 84.60,
              lineSubtotal: 500.00,
              lineTotal: 554.60
            }
          ]
        }
      },
      include: {
        items: true
      }
    });

    assert(createdPO.currency === "USD", "Purchase Order currency persisted as USD", `Currency: ${createdPO.currency}`);
    assert(createdPO.items.length === 2, "Purchase Order items created with 2 line entries");

    const itemWithBatch = createdPO.items.find(i => i.batchNumber === testBatch1);
    const itemPendingBatch = createdPO.items.find(i => i.batchNumber === null);

    assert(!!itemWithBatch && itemWithBatch.batchNumber === testBatch1, "Line item with explicit incoming lot persisted batchNumber", `Batch: ${itemWithBatch?.batchNumber}`);
    assert(!!itemPendingBatch && itemPendingBatch.batchNumber === null, "Line item pending arrival stored as null (Pending at Receipt)", `Batch: ${itemPendingBatch?.batchNumber ?? "null (Pending at Receipt)"}`);

    console.log("\n2. Testing Product Identity vs Batch Identity Separation...");
    assert(itemWithBatch?.productUin === product.uin, "Product UIN remains stable and unchanged regardless of batch", `Product UIN: ${itemWithBatch?.productUin}`);
    assert(itemWithBatch?.partNumber === product.partNumber, "Part number remains canonical (CAT-SECNO)", `Part: ${itemWithBatch?.partNumber}`);
    assert(itemWithBatch?.batchNumber !== itemWithBatch?.productUin, "Batch identity is decoupled from stable product identity", `Batch: ${itemWithBatch?.batchNumber} !== UIN: ${itemWithBatch?.productUin}`);

    console.log("\n3. Testing Inventory Stock Isolation (No stock created at PO draft)...");
    const stockMovements = await prisma.stockMovement.findMany({
      where: { referenceId: createdPO.id }
    });
    assert(stockMovements.length === 0, "No inventory stock movements created merely because batch number was entered on PO");

    console.log("\n4. Testing PO Currency & Batch Update on Draft PO...");
    const updatedBatch = "LOT-2026-US-001-REV1";
    await prisma.$transaction(async (tx) => {
      await tx.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: createdPO.id } });
      await tx.purchaseOrder.update({
        where: { id: createdPO.id },
        data: {
          currency: "EUR",
          items: {
            create: [
              {
                productId: product.id,
                brand: product.brand,
                partNumber: product.partNumber,
                productUin: product.uin,
                batchNumber: updatedBatch,
                description: product.name,
                quantityOrdered: 20,
                quantityPending: 20,
                unitPrice: 45.00,
                discount: 0,
                taxRate: 18.00,
                taxAmount: 162.00,
                lineSubtotal: 900.00,
                lineTotal: 1062.00
              }
            ]
          }
        }
      });
    });

    const refreshedPO = await prisma.purchaseOrder.findUnique({
      where: { id: createdPO.id },
      include: { items: true }
    });

    assert(refreshedPO?.currency === "EUR", "PO operating currency updated to EUR", `Currency: ${refreshedPO?.currency}`);
    assert(refreshedPO?.items[0]?.batchNumber === updatedBatch, "Updated batch number persisted successfully", `Batch: ${refreshedPO?.items[0]?.batchNumber}`);

    // Cleanup test PO and test product
    await prisma.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: createdPO.id } });
    await prisma.purchaseOrder.delete({ where: { id: createdPO.id } });
    await prisma.product.delete({ where: { id: product.id } });

    console.log("\n===============================================================================");
    console.log(`🎉 VERIFICATION COMPLETE: ${passedTests}/${totalTests} TESTS PASSED`);
    console.log("===============================================================================\n");

  } catch (error) {
    console.error("Test execution failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
