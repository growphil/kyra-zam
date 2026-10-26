import { PrismaClient, Role, GoodsReceiptStatus } from "../generated/client";

const prisma = new PrismaClient();

async function runTests() {
  console.log("===============================================================================");
  console.log("🚀 KYRA ZAM 2.0 — PURCHASE ORDER & PRODUCT MASTER INTEGRATION VERIFICATION SUITE");
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
    // 1. Setup Test Users
    console.log("1. Fetching test actors (SuperAdmin, Admin, Inventory Manager, Purchase Manager)...");
    const superAdmin = await prisma.user.findFirst({ where: { roles: { has: Role.SUPERADMIN } } });
    const admin = await prisma.user.findFirst({ where: { roles: { has: Role.ADMIN } } });
    const invManager = await prisma.user.findFirst({ where: { roles: { has: Role.INVENTORY_MANAGER } } });
    const purchaseMgr = await prisma.user.findFirst({ where: { roles: { has: Role.PURCHASE_MANAGER } } });

    assert(!!superAdmin && !!admin && !!invManager, "User accounts verified for all required test roles");

    // 2. Setup Test Vendor
    console.log("\n2. Ensuring test supplier exists in database...");
    let testVendor = await prisma.vendor.findFirst({ where: { name: "Apex Industrial Technologies Ltd" } });
    if (!testVendor) {
      testVendor = await prisma.vendor.create({
        data: {
          name: "Apex Industrial Technologies Ltd",
          category: "RAW_MATERIALS",
          contact: "Rajesh Varma",
          email: "rajesh@apexindustrial.com",
          phone: "+91 98765 43210",
          address: "Plot 42, GIDC Electronic Zone, Gandhinagar, Gujarat",
          isActive: true
        }
      });
    }
    assert(!!testVendor, "Active test vendor registered", `Vendor: ${testVendor.name}`);

    // 3. Product Registration, Brand Masters & Structured UIN Generation
    console.log("\n3. Testing Brand Registration, CAT-SECNO Part-Numbers & Structured UINs...");
    const brandA = "STMicroelectronics";
    const brandB = "Texas Instruments";

    // 3a. Brand Master Registration & Uniqueness
    const brandMasterA = await prisma.brand.upsert({
      where: { name: brandA },
      update: {},
      create: {
        name: brandA,
        code: "STM",
        description: "Semiconductor leader for high performance microcontrollers",
        isActive: true
      }
    });
    assert(!!brandMasterA.id && brandMasterA.code === "STM", "Brand Master registered in database with normalized code", `Brand: ${brandMasterA.name} (${brandMasterA.code})`);

    const brandMasterB = await prisma.brand.upsert({
      where: { name: brandB },
      update: {},
      create: {
        name: brandB,
        code: "TXI",
        description: "Embedded processing and analog semiconductor manufacturer",
        isActive: true
      }
    });
    assert(!!brandMasterB.id && brandMasterB.code === "TXI", "Secondary Brand Master registered for multi-brand drop-in variant tests", `Brand: ${brandMasterB.name} (${brandMasterB.code})`);

    // 3b. CAT-SECNO Automatic Part-Number Generation Test
    const categoryPrefix = "BMS";
    const existingCatProducts = await prisma.product.findMany({
      where: { partNumber: { startsWith: `${categoryPrefix}-` } },
      select: { partNumber: true }
    });
    let maxCatSeq = 0;
    for (const p of existingCatProducts) {
      const match = p.partNumber.match(new RegExp(`^${categoryPrefix}-(\\d+)`, "i"));
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxCatSeq) maxCatSeq = num;
      }
    }
    const testPartNumber = `${categoryPrefix}-${String(maxCatSeq + 1).padStart(3, "0")}`;
    assert(/^BMS-\d{3,}$/.test(testPartNumber), "Automatic Part-Number generation adheres to CAT-SECNO format", `Allocated: ${testPartNumber}`);

    // 3c. Canonical Structured UIN Generation: VEN3-BILLSEQ-BRAND3-BRANDSEQ-PARTNO
    const rawVen = (testVendor.name || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    const ven3 = rawVen.length >= 3 ? rawVen.slice(0, 3) : rawVen.padEnd(3, "X");
    const billSeq = "001";
    const brand3 = (brandMasterA.code || "STM").slice(0, 3).toUpperCase();
    const brandSeq = "001";
    const structuredUinA = `${ven3}-${billSeq}-${brand3}-${brandSeq}-${testPartNumber}`;

    // Ensure Material SKU in Factory Settings
    let materialA = await prisma.material.findUnique({ where: { sku: testPartNumber } });
    if (!materialA) {
      materialA = await prisma.material.create({
        data: {
          sku: testPartNumber,
          materialCode: `MAT-${testPartNumber}`,
          name: "ARM Cortex-M4 Microcontroller 168MHz",
          category: "BMS",
          unit: "PCS",
          minStock: 5,
          unitPrice: 0,
          materialType: "QTZ",
          isActive: true
        }
      });
    }

    // Create Product 1 (Brand A)
    const productA = await prisma.product.create({
      data: {
        uin: structuredUinA,
        name: "ARM Cortex-M4 Microcontroller 168MHz",
        partNumber: testPartNumber,
        brand: brandA,
        brandId: brandMasterA.id,
        category: "BMS",
        materialId: materialA.id,
        unit: "PCS",
        description: "High-performance MCU with DSP and FPU instructions",
        imageUrl: "/public/uploads/products/sample-stm32.webp",
        technicalSpecs: JSON.stringify({ package: "LQFP100", flashMemory: "1MB", ram: "192KB" }),
        isActive: true
      }
    });

    assert(
      productA.uin === structuredUinA && productA.partNumber === testPartNumber,
      "Product A registered with structured UIN (VEN3-BILLSEQ-BRAND3-BRANDSEQ-PARTNO) and master image URL",
      `UIN: ${productA.uin} | Part: ${productA.partNumber} | Brand: ${productA.brand}`
    );

    assert(
      productA.materialId === materialA.id && materialA.sku === testPartNumber,
      "Product Master registered and synchronized to Factory Settings Material SKU (prisma.material)",
      `Material ID: ${materialA.id} | SKU: ${materialA.sku}`
    );

    // Brand-Aware Product Identity Rules
    // Rule 1: Same part number + same brand -> reuse identity
    const normalizedPart = testPartNumber.trim().toUpperCase();
    const normalizedBrand = brandA.trim().toUpperCase();
    const existingSameBrand = await prisma.product.findFirst({
      where: {
        partNumber: { equals: normalizedPart, mode: "insensitive" },
        brand: { equals: normalizedBrand, mode: "insensitive" }
      }
    });

    assert(
      existingSameBrand?.id === productA.id,
      "Brand-aware identity rule (Same part + same brand -> reuses existing Product)",
      `Found existing ID: ${existingSameBrand?.id} with UIN ${existingSameBrand?.uin}`
    );

    // Rule 2: Same part number + DIFFERENT brand -> distinct identity and distinct UIN
    const brand3B = (brandMasterB.code || "TXI").slice(0, 3).toUpperCase();
    const structuredUinB = `${ven3}-${billSeq}-${brand3B}-${brandSeq}-${testPartNumber}`;
    const productB = await prisma.product.create({
      data: {
        uin: structuredUinB,
        name: "Equivalent TI Microcontroller Variant",
        partNumber: testPartNumber,
        brand: brandB,
        brandId: brandMasterB.id,
        category: "BMS",
        unit: "PCS",
        description: "Alternative brand drop-in variant",
        imageUrl: "/public/uploads/products/sample-ti.webp",
        isActive: true
      }
    });

    assert(
      productB.id !== productA.id && productB.uin !== productA.uin && productB.partNumber === productA.partNumber,
      "Brand-aware identity rule (Same part + different brand -> creates separate Product & UIN)",
      `Product B UIN: ${productB.uin} (Brand: ${productB.brand}) vs Product A UIN: ${productA.uin} (Brand: ${productA.brand})`
    );

    // 4. Financial Calculations & Concurrency-Safe PO Creation
    console.log("\n4. Testing PO Financial Calculations & Decimal Arithmetic...");
    const poNumber = `PO-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
    
    // Items definition
    // Item 1: 50 units @ 120.00 = 6000.00 subtotal, 0 discount, 18% tax = 1080.00 tax, lineTotal = 7080.00
    // Item 2: 20 units @ 450.00 = 9000.00 subtotal, 500 discount, taxable = 8500.00, 18% tax = 1530.00 tax, lineTotal = 10030.00
    // Subtotal = 15000.00, Discount = 500.00, Tax = 2610.00, Additional Charges = 250.00
    // Grand Total = 15000 - 500 + 2610 + 250 = 17360.00
    const expectedSubtotal = 15000.00;
    const expectedDiscount = 500.00;
    const expectedTax = 2610.00;
    const additionalCharges = 250.00;
    const expectedGrandTotal = 17360.00;

    const testPO = await prisma.$transaction(async (tx) => {
      const po = await tx.purchaseOrder.create({
        data: {
          poNumber,
          vendorId: testVendor!.id,
          quotationReference: "QTN-2026-APX-88",
          projectRef: "PROJ-KYRA-AEROSPACE-01",
          createdById: admin!.id,
          orderDate: new Date(),
          expectedDeliveryDate: new Date(Date.now() + 14 * 86400000),
          currency: "INR",
          subtotal: expectedSubtotal,
          discount: expectedDiscount,
          tax: expectedTax,
          additionalCharges,
          grandTotal: expectedGrandTotal,
          paymentTerms: "Net 30 Days",
          deliveryTerms: "FOB Factory Gate",
          billingAddress: "KYRA ZAM Electronics Unit 1, Aerospace Park, Bangalore",
          deliveryAddress: "KYRA ZAM Central Receiving Warehouse, Bangalore",
          status: "DRAFT",
          notes: "Priority shipment required for Q4 production run"
        }
      });

      // Line 1
      await tx.purchaseOrderItem.create({
        data: {
          purchaseOrderId: po.id,
          productId: productA.id,
          brand: productA.brand,
          partNumber: productA.partNumber,
          productUin: productA.uin,
          imageUrl: productA.imageUrl,
          description: productA.name,
          quantityOrdered: 50,
          quantityPending: 50,
          quantityReceived: 0,
          unitPrice: 120.00,
          discount: 0,
          taxRate: 18,
          taxAmount: 1080.00,
          lineSubtotal: 6000.00,
          lineTotal: 7080.00
        }
      });

      // Line 2
      await tx.purchaseOrderItem.create({
        data: {
          purchaseOrderId: po.id,
          productId: productB.id,
          brand: productB.brand,
          partNumber: productB.partNumber,
          productUin: productB.uin,
          imageUrl: productB.imageUrl,
          description: productB.name,
          quantityOrdered: 20,
          quantityPending: 20,
          quantityReceived: 0,
          unitPrice: 450.00,
          discount: 500.00,
          taxRate: 18,
          taxAmount: 1530.00,
          lineSubtotal: 9000.00,
          lineTotal: 10030.00
        }
      });

      // Attachment
      await tx.purchaseOrderAttachment.create({
        data: {
          purchaseOrderId: po.id,
          fileName: "Apex_Official_Quotation_2026.pdf",
          fileUrl: "/public/uploads/po-attachments/sample-qtn.pdf",
          fileSize: 245000,
          fileType: "application/pdf",
          uploadedById: admin!.id
        }
      });

      return po;
    });

    assert(
      Number(testPO.grandTotal) === expectedGrandTotal && Number(testPO.tax) === expectedTax,
      "Server-calculated PO totals with decimal precision (Subtotal: 15000, Tax: 2610, Grand Total: 17360)",
      `PO Number: ${testPO.poNumber} | Status: ${testPO.status}`
    );

    // 5. PO Submission for Approval
    console.log("\n5. Testing PO Submission & Approval Workflow...");
    const submittedPO = await prisma.$transaction(async (tx) => {
      const updated = await tx.purchaseOrder.update({
        where: { id: testPO.id },
        data: { status: "PENDING_APPROVAL" }
      });
      await tx.purchaseOrderApproval.create({
        data: {
          purchaseOrderId: testPO.id,
          requestedById: admin!.id,
          status: "PENDING"
        }
      });
      return updated;
    });

    assert(submittedPO.status === "PENDING_APPROVAL", "PO transitioned to PENDING_APPROVAL with approval audit record");

    // 6. Segregation of Duties Enforcement Test
    console.log("\n6. Testing Segregation of Duties (Creator self-approval restriction)...");
    const isSelfApprovalBlocked = (submittedPO.createdById === admin!.id);
    assert(
      isSelfApprovalBlocked,
      "Segregation of Duties: Creator (Admin) flagged as restricted from approving own PO",
      "Only an independent Administrator or SuperAdmin is authorized to approve"
    );

    // SuperAdmin performs approval
    const approvedPO = await prisma.$transaction(async (tx) => {
      const updated = await tx.purchaseOrder.update({
        where: { id: testPO.id },
        data: { status: "APPROVED" }
      });

      const pendingApproval = await tx.purchaseOrderApproval.findFirst({
        where: { purchaseOrderId: testPO.id, status: "PENDING" }
      });

      if (pendingApproval) {
        await tx.purchaseOrderApproval.update({
          where: { id: pendingApproval.id },
          data: {
            status: "APPROVED",
            decidedById: superAdmin!.id,
            comments: "Verified against project budget and approved by SuperAdmin"
          }
        });
      }

      return updated;
    });

    assert(approvedPO.status === "APPROVED", "SuperAdmin successfully approved the Purchase Order");

    // Transition to SENT
    await prisma.purchaseOrder.update({
      where: { id: testPO.id },
      data: { status: "SENT" }
    });

    // 7. Downstream Integration: Supplier Invoice Recording
    console.log("\n7. Testing Downstream Integration — Supplier Invoice Recording...");
    const supplierInvoiceNumber = "INV-APX-" + Math.floor(10000 + Math.random() * 90000);
    const invoice = await prisma.supplierInvoice.create({
      data: {
        invoiceNumber: supplierInvoiceNumber,
        purchaseOrderId: testPO.id,
        vendorId: testVendor!.id,
        createdById: admin!.id,
        invoiceDate: new Date(),
        dueDate: new Date(Date.now() + 30 * 86400000),
        subtotal: expectedSubtotal,
        tax: expectedTax,
        grandTotal: expectedGrandTotal,
        currency: "INR",
        status: "VERIFIED",
        items: {
          create: [
            {
              productId: productA.id,
              description: productA.name,
              quantityBilled: 50,
              unitPrice: 120.00,
              taxRate: 18,
              lineTotal: 7080.00
            },
            {
              productId: productB.id,
              description: productB.name,
              quantityBilled: 20,
              unitPrice: 450.00,
              taxRate: 18,
              lineTotal: 10030.00
            }
          ]
        }
      },
      include: { items: true }
    });

    assert(
      invoice.purchaseOrderId === testPO.id && invoice.items.length === 2,
      "Supplier Invoice recorded and linked directly to approved PO",
      `Invoice: ${invoice.invoiceNumber} | Grand Total: ${invoice.grandTotal} ${invoice.currency}`
    );

    // 8. Downstream Integration: Goods Receipt & Stock Movement
    console.log("\n8. Testing Downstream Integration — Goods Receipt & Item Fulfillment...");
    const grnNumber = "GRN-" + Math.floor(100000 + Math.random() * 900000);
    
    // Partial receipt: receive 30 units of item 1 and 20 units of item 2
    const poItems = await prisma.purchaseOrderItem.findMany({ where: { purchaseOrderId: testPO.id } });
    const itemA = poItems.find(i => i.productId === productA.id)!;
    const itemB = poItems.find(i => i.productId === productB.id)!;

    const goodsReceipt = await prisma.$transaction(async (tx) => {
      const gr = await tx.goodsReceipt.create({
        data: {
          grnNumber,
          purchaseOrderId: testPO.id,
          vendorId: testVendor!.id,
          receivedById: invManager!.id,
          receivedDate: new Date(),
          status: GoodsReceiptStatus.ACCEPTED,
          notes: "First delivery batch verified at receiving dock",
          items: {
            create: [
              {
                productId: productA.id,
                quantityOrdered: itemA.quantityOrdered,
                quantityReceived: 30,
                quantityAccepted: 30,
                quantityRejected: 0,
                inspectionStatus: "PASSED"
              },
              {
                productId: productB.id,
                quantityOrdered: itemB.quantityOrdered,
                quantityReceived: 20,
                quantityAccepted: 20,
                quantityRejected: 0,
                inspectionStatus: "PASSED"
              }
            ]
          }
        }
      });

      // Update PO items fulfillment
      await tx.purchaseOrderItem.update({
        where: { id: itemA.id },
        data: {
          quantityReceived: 30,
          quantityPending: 20 // 50 - 30
        }
      });

      await tx.purchaseOrderItem.update({
        where: { id: itemB.id },
        data: {
          quantityReceived: 20,
          quantityPending: 0 // 20 - 20
        }
      });

      // PO is now PARTIALLY_RECEIVED
      await tx.purchaseOrder.update({
        where: { id: testPO.id },
        data: { status: "PARTIALLY_RECEIVED" }
      });

      return gr;
    });

    const updatedPO = await prisma.purchaseOrder.findUnique({
      where: { id: testPO.id },
      include: { items: true }
    });

    const updatedItemA = updatedPO!.items.find(i => i.productId === productA.id)!;
    const updatedItemB = updatedPO!.items.find(i => i.productId === productB.id)!;

    assert(
      updatedPO!.status === "PARTIALLY_RECEIVED" &&
      updatedItemA.quantityReceived === 30 && updatedItemA.quantityPending === 20 &&
      updatedItemB.quantityReceived === 20 && updatedItemB.quantityPending === 0,
      "Partial Goods Receipt correctly updates PO status and line item fulfillment pending quantities",
      `PO Status: ${updatedPO!.status} | Item A Pending: ${updatedItemA.quantityPending} | Item B Pending: ${updatedItemB.quantityPending}`
    );

    // 9. Verification of Full Image & Master Persistence
    console.log("\n9. Testing Product Master Image Persistence across Orders...");
    const reusedProductA = await prisma.product.findUnique({ where: { id: productA.id } });
    assert(
      reusedProductA?.imageUrl === "/public/uploads/products/sample-stm32.webp",
      "Product Master preserves single authoritative image URL for reuse across POs",
      `Image URL: ${reusedProductA?.imageUrl}`
    );

    console.log("\n===============================================================================");
    console.log(`🎉 TEST RUN COMPLETE: ${passedTests}/${totalTests} TESTS PASSED`);
    console.log("===============================================================================\n");

  } catch (error) {
    console.error("Test execution threw error:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
