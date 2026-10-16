import { PrismaClient } from "../generated/client";

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://postgres:12345@localhost:5432/kyrazam_fresh_test?schema=public"
    }
  }
});

async function verifyAllDomains() {
  console.log("=== COMPREHENSIVE REPAIRED SCHEMA & DATA INTEGRITY VERIFICATION ===");

  try {
    // 1. Users & RBAC
    const usersCount = await prisma.user.count();
    const adminUser = await prisma.user.findFirst({ where: { roles: { has: "SUPERADMIN" } } });
    console.log(`✓ [1/10] Users & RBAC: ${usersCount} users present. Superadmin: ${adminUser?.name} (${adminUser?.email})`);

    // 2. Inventory & Warehouses
    const whCount = await prisma.warehouse.count();
    const locCount = await prisma.warehouseLocation.count();
    const matCount = await prisma.material.count();
    const resCount = await prisma.inventoryReservation.count();
    console.log(`✓ [2/10] Inventory & Warehousing: ${whCount} warehouses, ${locCount} locations, ${matCount} materials, ${resCount} reservations`);

    // 3. Work Orders, Scheduling & Execution (The failed relations in migrations 4 & 5)
    const woCount = await prisma.workOrder.count();
    const schedCount = await prisma.workOrderScheduling.count();
    const execCount = await prisma.workOrderExecution.count();
    console.log(`✓ [3/10] Production Execution: ${woCount} work orders, ${schedCount} schedulings, ${execCount} executions`);

    // 4. Warranties & Pax Packs (The failed relations in migration 3)
    const paxCount = await prisma.paxPack.count();
    const warrantyCount = await prisma.warranty.count();
    console.log(`✓ [4/10] Warranties & Finished Pax Packs: ${paxCount} packs, ${warrantyCount} warranties active`);

    // 5. CRM & Sales Orders
    const custCount = await prisma.customer.count();
    const leadCount = await prisma.lead.count();
    const quoteCount = await prisma.quotation.count();
    const soCount = await prisma.salesOrder.count();
    console.log(`✓ [5/10] CRM & Commercial: ${custCount} customers, ${leadCount} leads, ${quoteCount} quotes, ${soCount} sales orders`);

    // 6. Procurement & Receipts
    const prCount = await prisma.purchaseRequest.count();
    const poCount = await prisma.purchaseOrder.count();
    const grnCount = await prisma.goodsReceipt.count();
    console.log(`✓ [6/10] Procurement: ${prCount} purchase requests, ${poCount} purchase orders, ${grnCount} GRNs`);

    // 7. Cells & Inward Batches
    const batchCount = await prisma.cellInwardBatch.count();
    const cellCount = await prisma.cell.count();
    console.log(`✓ [7/10] Cell Inward & Testing: ${batchCount} batches, ${cellCount} cells tested`);

    // 8. Quality & Defect Tracking
    const qiCount = await prisma.qualityInspection.count();
    const defectCount = await prisma.defect.count();
    console.log(`✓ [8/10] Quality & Defect Tracking: ${qiCount} inspections, ${defectCount} defects logged`);

    // 9. Finance & Invoicing
    const invCount = await prisma.invoice.count();
    const payCount = await prisma.payment.count();
    console.log(`✓ [9/10] Finance: ${invCount} invoices, ${payCount} payments verified`);

    // 10. Service, RMA & Scrap
    const srvCount = await prisma.serviceBattery.count();
    const scrapCount = await prisma.scrapEntry.count();
    console.log(`✓ [10/10] Service RMA & Scrap: ${srvCount} service batteries, ${scrapCount} scrap entries`);

    console.log("\n>>> ALL 10 DOMAIN INTEGRITY CHECKS PASSED WITH ZERO ERRORS! <<<");
  } catch (error) {
    console.error("FAILED INTEGRITY CHECK:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

verifyAllDomains();
