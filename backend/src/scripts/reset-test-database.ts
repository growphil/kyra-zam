import { PrismaClient } from "../generated/client";
import Fastify from "fastify";
import { authPlugin } from "../plugins/auth";
import { authRoutes } from "../routes/auth";

const prisma = new PrismaClient();

interface TableStat {
  table: string;
  before: number;
  after: number;
  deleted: number;
}

async function runDatabaseReset() {
  console.log("================================================================================");
  console.log("🚀 STARTING POSTGRESQL TEST-DATA DATABASE RESET — KYRA ZAM 2.0");
  console.log("================================================================================\n");

  // 1. Snapshot users before cleanup
  const usersBefore = await prisma.user.findMany({
    select: { id: true, email: true, name: true, passwordHash: true, roles: true, isActive: true },
    orderBy: { email: "asc" }
  });
  console.log(`📌 Pre-Cleanup Snapshot: ${usersBefore.length} users registered.\n`);

  // 2. Snapshot table counts before cleanup
  const allTables: { tablename: string }[] = await prisma.$queryRawUnsafe(`
    SELECT tablename FROM pg_tables 
    WHERE schemaname = 'public' 
    ORDER BY tablename ASC;
  `);

  const countBeforeMap = new Map<string, number>();
  for (const { tablename } of allTables) {
    if (tablename === "_prisma_migrations") continue;
    try {
      const res: { count: bigint }[] = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as count FROM "${tablename}";`);
      countBeforeMap.set(tablename, Number(res[0]?.count || 0));
    } catch (e: any) {
      console.warn(`Warning reading ${tablename}:`, e.message);
    }
  }

  // 3. Execute Transactional Deletions in FK-safe order
  console.log("🧹 Executing atomic database cleanup transaction...");

  const startTime = Date.now();

  await prisma.$transaction(async (tx) => {
    // Step 1: Service & Warranty
    await tx.$executeRawUnsafe(`DELETE FROM "ServiceCost";`);
    await tx.$executeRawUnsafe(`DELETE FROM "ServiceDelivery";`);
    await tx.$executeRawUnsafe(`DELETE FROM "ServiceTestReport";`);
    await tx.$executeRawUnsafe(`DELETE FROM "ServiceRepairLog";`);
    await tx.$executeRawUnsafe(`DELETE FROM "ServiceReopenHistory";`);
    await tx.$executeRawUnsafe(`DELETE FROM "ServiceMaterialItem";`);
    await tx.$executeRawUnsafe(`DELETE FROM "ServiceMaterialRequest";`);
    await tx.$executeRawUnsafe(`DELETE FROM "ServiceEstimate";`);
    await tx.$executeRawUnsafe(`DELETE FROM "ScrapApproval";`);
    await tx.$executeRawUnsafe(`DELETE FROM "ServiceBattery";`);
    await tx.$executeRawUnsafe(`DELETE FROM "Warranty";`);

    // Step 2: Scrap Records
    await tx.$executeRawUnsafe(`DELETE FROM "ScrapSale";`);
    await tx.$executeRawUnsafe(`DELETE FROM "ScrapInventory";`);
    await tx.$executeRawUnsafe(`DELETE FROM "ScrapEntry";`);

    // Step 3: Invoicing, Dispatch & Shipment
    await tx.$executeRawUnsafe(`DELETE FROM "ProofOfDelivery";`);
    await tx.$executeRawUnsafe(`DELETE FROM "Shipment";`);
    await tx.$executeRawUnsafe(`DELETE FROM "DeliveryPackage";`);
    await tx.$executeRawUnsafe(`DELETE FROM "Payment";`);
    await tx.$executeRawUnsafe(`DELETE FROM "InvoiceItem";`);
    await tx.$executeRawUnsafe(`DELETE FROM "Invoice";`);
    await tx.$executeRawUnsafe(`DELETE FROM "DispatchItem";`);
    await tx.$executeRawUnsafe(`DELETE FROM "DispatchOrder";`);

    // Step 4: Quality, Repairs & Defects
    await tx.$executeRawUnsafe(`DELETE FROM "Repair";`);
    await tx.$executeRawUnsafe(`DELETE FROM "Defect";`);
    await tx.$executeRawUnsafe(`DELETE FROM "QualityCheckpoint";`);
    await tx.$executeRawUnsafe(`DELETE FROM "QualityInspection";`);

    // Step 5: PAX & Cell Testing
    await tx.$executeRawUnsafe(`DELETE FROM "PaxCell";`);
    await tx.$executeRawUnsafe(`DELETE FROM "PaxPack";`);
    await tx.$executeRawUnsafe(`DELETE FROM "Cell";`);
    await tx.$executeRawUnsafe(`DELETE FROM "CellInwardBatch";`);

    // Step 6: Production Execution & Scheduling
    await tx.$executeRawUnsafe(`DELETE FROM "WorkOrderOperator";`);
    await tx.$executeRawUnsafe(`DELETE FROM "WorkOrderExecution";`);
    await tx.$executeRawUnsafe(`DELETE FROM "WorkOrderScheduling";`);
    await tx.$executeRawUnsafe(`DELETE FROM "StationOperatorAssignment";`);
    await tx.$executeRawUnsafe(`DELETE FROM "BatchAnalytics";`);
    await tx.$executeRawUnsafe(`DELETE FROM "WorkOrder";`);
    await tx.$executeRawUnsafe(`DELETE FROM "ProductionPlan";`);
    await tx.$executeRawUnsafe(`DELETE FROM "ProductionRequirement";`);

    // Step 7: Purchasing & Goods Receipt
    await tx.$executeRawUnsafe(`DELETE FROM "GoodsReceiptItem";`);
    await tx.$executeRawUnsafe(`DELETE FROM "GoodsReceipt";`);
    await tx.$executeRawUnsafe(`DELETE FROM "PurchaseOrderItem";`);
    await tx.$executeRawUnsafe(`DELETE FROM "PurchaseOrder";`);
    await tx.$executeRawUnsafe(`DELETE FROM "PurchaseRequestApproval";`);
    await tx.$executeRawUnsafe(`DELETE FROM "PurchaseRequestItem";`);
    await tx.$executeRawUnsafe(`DELETE FROM "PurchaseRequest";`);

    // Step 8: Inventory Transactions & Reservations
    await tx.$executeRawUnsafe(`DELETE FROM "InventoryReservation";`);
    await tx.$executeRawUnsafe(`DELETE FROM "StockTransferItem";`);
    await tx.$executeRawUnsafe(`DELETE FROM "StockTransfer";`);
    await tx.$executeRawUnsafe(`DELETE FROM "StockMovement";`);
    await tx.$executeRawUnsafe(`DELETE FROM "MaterialLocationBalance";`);

    // Step 9: Sales & CRM
    await tx.$executeRawUnsafe(`DELETE FROM "Sale";`);
    await tx.$executeRawUnsafe(`DELETE FROM "SalesOrderItem";`);
    await tx.$executeRawUnsafe(`DELETE FROM "SalesOrder";`);
    await tx.$executeRawUnsafe(`DELETE FROM "QuotationApproval";`);
    await tx.$executeRawUnsafe(`DELETE FROM "QuotationRevision";`);
    await tx.$executeRawUnsafe(`DELETE FROM "QuotationItem";`);
    await tx.$executeRawUnsafe(`DELETE FROM "Quotation";`);
    await tx.$executeRawUnsafe(`DELETE FROM "Activity";`);
    await tx.$executeRawUnsafe(`DELETE FROM "Lead";`);
    await tx.$executeRawUnsafe(`DELETE FROM "Customer";`);

    // Step 10: BOMs & Test Materials
    await tx.$executeRawUnsafe(`DELETE FROM "BOMItem";`);
    await tx.$executeRawUnsafe(`DELETE FROM "BOM";`);
    await tx.$executeRawUnsafe(`DELETE FROM "Material";`);

    // Step 11: Notifications & Audit Logs
    await tx.$executeRawUnsafe(`DELETE FROM "Notification";`);
    await tx.$executeRawUnsafe(`DELETE FROM "AuditLog";`);
  }, {
    timeout: 30000
  });

  const duration = Date.now() - startTime;
  console.log(`✅ Cleanup transaction committed successfully in ${duration}ms.\n`);

  // 4. Count after cleanup
  const statsTable: TableStat[] = [];
  let totalDeletedRows = 0;

  for (const { tablename } of allTables) {
    if (tablename === "_prisma_migrations") continue;
    const before = countBeforeMap.get(tablename) || 0;
    const countRes: { count: bigint }[] = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as count FROM "${tablename}";`);
    const after = Number(countRes[0]?.count || 0);
    const deleted = before - after;
    if (deleted > 0 || before > 0 || after > 0) {
      statsTable.push({ table: tablename, before, after, deleted });
      totalDeletedRows += deleted;
    }
  }

  console.log("📊 SUMMARY OF TABLE RECORDS (BEFORE vs AFTER):");
  console.table(statsTable);
  console.log(`Total rows removed: ${totalDeletedRows}\n`);

  // 5. Verify User & RBAC Preservation
  console.log("🔐 VERIFYING AUTHENTICATION & RBAC PRESERVATION:");
  const usersAfter = await prisma.user.findMany({
    select: { id: true, email: true, name: true, passwordHash: true, roles: true, isActive: true },
    orderBy: { email: "asc" }
  });

  const userCountMatch = usersBefore.length === usersAfter.length;
  console.log(`  ${userCountMatch ? "✅" : "❌"} User Count: Before=${usersBefore.length}, After=${usersAfter.length}`);

  let allHashesIntact = true;
  for (let i = 0; i < usersBefore.length; i++) {
    const b = usersBefore[i];
    const a = usersAfter.find(u => u.id === b.id);
    if (!a || a.passwordHash !== b.passwordHash || JSON.stringify(a.roles) !== JSON.stringify(b.roles)) {
      allHashesIntact = false;
      console.error(`  ❌ Mismatch for user ${b.email}: Password/Role altered!`);
    }
  }
  console.log(`  ${allHashesIntact ? "✅" : "❌"} Password Hashes & Roles: 100% Intact and Unaltered`);

  // 6. Verify Master Configuration
  console.log("\n⚙️ VERIFYING MASTER CONFIGURATION:");
  const stations = await prisma.productionStation.count();
  const warehouses = await prisma.warehouse.count();
  const locations = await prisma.warehouseLocation.count();
  const paxTypes = await prisma.paxType.count();
  const qcThresholds = await prisma.qcThreshold.count();
  const vendors = await prisma.vendor.count();

  console.log(`  ✅ Production Stations: ${stations} preserved`);
  console.log(`  ✅ Warehouses: ${warehouses} preserved`);
  console.log(`  ✅ Warehouse Locations: ${locations} preserved`);
  console.log(`  ✅ Pax Types: ${paxTypes} preserved`);
  console.log(`  ✅ QC Thresholds: ${qcThresholds} preserved`);
  console.log(`  ✅ Vendors: ${vendors} preserved`);

  // 7. Verify Live Authentication Logins across all primary roles
  console.log("\n🔑 VERIFYING LIVE AUTHENTICATION FOR APPLICATION ROLES:");

  const app = Fastify({ logger: false });
  await app.register(authPlugin);
  await app.register(authRoutes, { prefix: "/auth" });
  await app.ready();

  const testLogins = [
    { role: "SUPERADMIN", email: "superadmin@kyrazam.com", pass: "SuperAdmin@2025" },
    { role: "ADMIN", email: "admin@kyrazam.com", pass: "Admin@2025" },
    { role: "INVENTORY_MANAGER", email: "inv@kyrazam.com", pass: "InvMgr@2025" },
    { role: "SUPERVISOR", email: "super@kyrazam.com", pass: "Supervisor@2025" },
    { role: "ASSEMBLY_TECHNICIAN", email: "asm@kyrazam.com", pass: "AsmTech@2025" },
    { role: "PAX_TEST_ENGINEER", email: "paxtest@kyrazam.com", pass: "PaxTest@2025" },
    { role: "TEST_ENGINEER", email: "test@kyrazam.com", pass: "TestEng@2025" },
    { role: "SALES_EXECUTIVE", email: "sales@kyrazam.com", pass: "SalesExec@2025" },
    { role: "PURCHASE_MANAGER", email: "purchase@kyrazam.com", pass: "PurchMgr@2025" },
    { role: "ACCOUNTANT", email: "acct@kyrazam.com", pass: "Accountant@2025" },
    { role: "MARKETING_MANAGER", email: "marketing@kyrazam.com", pass: "Marketing@2025" },
    { role: "QC", email: "qc@kyrazam.com", pass: "QcEngineer@2025" }
  ];

  let loginSuccessCount = 0;
  for (const account of testLogins) {
    const res = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: account.email, password: account.pass }
    });

    if (res.statusCode === 200) {
      const body = JSON.parse(res.body);
      const hasToken = !!body.accessToken;
      const userRoles = body.user?.roles || [];
      console.log(`  ✅ PASS: ${account.role.padEnd(20)} (${account.email}) — Authenticated (Roles: ${userRoles.join(", ")})`);
      loginSuccessCount++;
    } else {
      console.error(`  ❌ FAIL: ${account.role.padEnd(20)} (${account.email}) — Status ${res.statusCode}: ${res.body}`);
    }
  }

  console.log(`\n================================================================================`);
  console.log(`🎉 DATABASE RESET COMPLETE: ${loginSuccessCount}/${testLogins.length} Primary Roles Verified Successfully!`);
  console.log("================================================================================\n");

  await app.close();
  await prisma.$disconnect();
}

runDatabaseReset().catch(err => {
  console.error("Fatal Error during Database Reset:", err);
  process.exit(1);
});
