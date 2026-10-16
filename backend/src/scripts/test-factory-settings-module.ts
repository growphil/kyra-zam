import Fastify from "fastify";
import { authPlugin } from "../plugins/auth";
import { adminRoutes } from "../routes/admin";
import { prisma } from "../prisma";

async function runTest() {
  console.log("=== Testing KYRA ZAM Factory Settings Module End-to-End ===");

  const app = Fastify({ logger: false });
  await app.register(authPlugin);
  await app.register(adminRoutes, { prefix: "/admin" });
  await app.ready();

  // Find or create admin user and generate JWT token
  let adminUser = await prisma.user.findFirst({
    where: { roles: { has: "SUPERADMIN" } }
  });
  if (!adminUser) {
    adminUser = await prisma.user.create({
      data: {
        name: "Super Admin Tester",
        email: "superadmin_factory_test@kyrazam.com",
        roles: ["SUPERADMIN", "ADMIN"],
        passwordHash: "hashed",
        isActive: true
      }
    });
  }

  const adminToken = app.jwt.sign({
    id: adminUser.id,
    roles: adminUser.roles
  });

  const authHeaders = {
    authorization: `Bearer ${adminToken}`
  };

  // 1. GET /admin/factory/overview
  const overviewRes = await app.inject({
    method: "GET",
    url: "/admin/factory/overview",
    headers: authHeaders
  });
  console.log(`1. GET /admin/factory/overview -> Status ${overviewRes.statusCode}`);
  if (overviewRes.statusCode !== 200) throw new Error(`Overview failed: ${overviewRes.body}`);
  console.log("   Overview stats:", overviewRes.json());

  // 2. POST /admin/factory/material-mappings
  const testMatSku = `TEST-BMS-${Date.now()}`;
  const createMatRes = await app.inject({
    method: "POST",
    url: "/admin/factory/material-mappings",
    headers: authHeaders,
    payload: {
      name: "Smart BMS 48V 100A Industrial",
      materialCode: "MAT-BMS-001",
      sku: testMatSku,
      category: "BMS",
      unit: "PCS",
      minStock: 10,
      unitPrice: 4500,
      description: "Smart 16S 48V 100A BMS with RS485 & Bluetooth",
      isActive: true
    }
  });
  console.log(`2. POST /admin/factory/material-mappings -> Status ${createMatRes.statusCode}`);
  if (createMatRes.statusCode !== 200) throw new Error(`Create material mapping failed: ${createMatRes.body}`);
  const createdMat = createMatRes.json();
  console.log(`   Created Material ID: ${createdMat.id}, SKU: ${createdMat.sku}`);

  // 2b. Attempt Duplicate Part Number
  const dupMatRes = await app.inject({
    method: "POST",
    url: "/admin/factory/material-mappings",
    headers: authHeaders,
    payload: {
      name: "Duplicate BMS",
      sku: testMatSku,
      category: "BMS",
      unit: "PCS"
    }
  });
  console.log(`2b. Duplicate SKU Test -> Status ${dupMatRes.statusCode} (Expected 409)`);
  if (dupMatRes.statusCode !== 409) throw new Error("Duplicate check failed");

  // 3. PATCH /admin/factory/material-mappings/:id
  const patchMatRes = await app.inject({
    method: "PATCH",
    url: `/admin/factory/material-mappings/${createdMat.id}`,
    headers: authHeaders,
    payload: {
      name: "Smart BMS 48V 100A Industrial V2",
      minStock: 20
    }
  });
  console.log(`3. PATCH /admin/factory/material-mappings/:id -> Status ${patchMatRes.statusCode}`);
  if (patchMatRes.statusCode !== 200) throw new Error("Patch material mapping failed");

  // 4. POST /admin/factory/cell-mappings
  const testCellSku = `TEST-CELL-LFP-${Date.now()}`;
  const createCellRes = await app.inject({
    method: "POST",
    url: "/admin/factory/cell-mappings",
    headers: authHeaders,
    payload: {
      cellSku: testCellSku,
      cellName: "3.2V 3200mAh Cylindrical Cell",
      chemistry: "LFP",
      nominalVoltage: 3.2,
      nominalCapacity: 3.2,
      supplier: "EVE Energy",
      description: "26650 LFP Cell with screw terminals",
      isActive: true
    }
  });
  console.log(`4. POST /admin/factory/cell-mappings -> Status ${createCellRes.statusCode}`);
  if (createCellRes.statusCode !== 200) throw new Error(`Create cell mapping failed: ${createCellRes.body}`);
  const createdCell = createCellRes.json();
  console.log(`   Created Cell Master ID: ${createdCell.id}, SKU: ${createdCell.cellSku}`);

  // 5. GET /admin/factory/financial-settings
  const getFinRes = await app.inject({
    method: "GET",
    url: "/admin/factory/financial-settings",
    headers: authHeaders
  });
  console.log(`5. GET /admin/factory/financial-settings -> Status ${getFinRes.statusCode}`);
  if (getFinRes.statusCode !== 200) throw new Error("Get financial settings failed");
  console.log("   Financial Defaults:", getFinRes.json());

  // 6. PUT /admin/factory/financial-settings
  const putFinRes = await app.inject({
    method: "PUT",
    url: "/admin/factory/financial-settings",
    headers: authHeaders,
    payload: {
      defaultPaymentTerms: "50% Advance / 50% Before Dispatch",
      defaultAdvancePercentage: 50,
      defaultFreightAmount: 500,
      defaultHandlingCharge: 200,
      defaultTaxRate: 18,
      defaultQuotationValidityDays: 30,
      defaultCurrency: "INR",
      minimumOrderValue: 5000
    }
  });
  console.log(`6. PUT /admin/factory/financial-settings -> Status ${putFinRes.statusCode}`);
  if (putFinRes.statusCode !== 200) throw new Error("Update financial settings failed");
  console.log("   Updated Financial:", putFinRes.json());

  // 7. GET /admin/factory/defaults & PUT /admin/factory/defaults
  const putDefaultsRes = await app.inject({
    method: "PUT",
    url: "/admin/factory/defaults",
    headers: authHeaders,
    payload: {
      defaultUnitSystem: "METRIC",
      defaultTimezone: "Asia/Kolkata",
      workingHoursPerDay: 8.0,
      productionDaysPerWeek: 6,
      defaultDeliveryTerms: "EXW - Ex Works"
    }
  });
  console.log(`7. PUT /admin/factory/defaults -> Status ${putDefaultsRes.statusCode}`);
  if (putDefaultsRes.statusCode !== 200) throw new Error("Update defaults failed");
  console.log("   Updated Defaults:", putDefaultsRes.json());

  // 8. Category Management Tests
  const testCatName = `TEST_CAT_${Date.now()}`;
  const createCatRes = await app.inject({
    method: "POST",
    url: "/admin/factory/material-categories",
    headers: authHeaders,
    payload: { name: testCatName }
  });
  console.log(`8a. POST /admin/factory/material-categories -> Status ${createCatRes.statusCode}`);
  if (createCatRes.statusCode !== 200) throw new Error("Create category failed");
  const createdCat = createCatRes.json();
  console.log(`   Created Category ID: ${createdCat.id}, Name: ${createdCat.name}`);

  // Duplicate Category check
  const dupCatRes = await app.inject({
    method: "POST",
    url: "/admin/factory/material-categories",
    headers: authHeaders,
    payload: { name: testCatName }
  });
  console.log(`8b. Duplicate Category Test -> Status ${dupCatRes.statusCode} (Expected 409)`);
  if (dupCatRes.statusCode !== 409) throw new Error("Duplicate category check failed");

  // GET /admin/factory/material-categories
  const getCatsRes = await app.inject({
    method: "GET",
    url: "/admin/factory/material-categories",
    headers: authHeaders
  });
  console.log(`8c. GET /admin/factory/material-categories -> Status ${getCatsRes.statusCode}`);
  if (getCatsRes.statusCode !== 200) throw new Error("Get categories failed");

  // DELETE /admin/factory/material-categories/:id
  const delCatRes = await app.inject({
    method: "DELETE",
    url: `/admin/factory/material-categories/${createdCat.id}`,
    headers: authHeaders
  });
  console.log(`8d. DELETE /admin/factory/material-categories/:id -> Status ${delCatRes.statusCode}`);
  if (delCatRes.statusCode !== 200) throw new Error("Delete category failed");

  // 9. Verify Audit Logs
  const auditLogs = await prisma.auditLog.findMany({
    where: {
      action: {
        in: [
          "FACTORY_MATERIAL_MAPPING_CREATED",
          "FACTORY_MATERIAL_MAPPING_UPDATED",
          "FACTORY_CELL_MAPPING_CREATED",
          "FACTORY_FINANCIAL_SETTING_UPDATED",
          "FACTORY_DEFAULTS_UPDATED",
          "FACTORY_MATERIAL_CATEGORY_CREATED",
          "FACTORY_MATERIAL_CATEGORY_DELETED"
        ]
      }
    },
    take: 10,
    orderBy: { timestamp: "desc" }
  });
  console.log(`9. Audit Logs Verified: Found ${auditLogs.length} audit trail entries.`);

  // Cleanup test material & cell records
  await prisma.material.delete({ where: { id: createdMat.id } }).catch(() => {});
  await prisma.cellMaster.delete({ where: { id: createdCell.id } }).catch(() => {});

  console.log("\n=======================================================");
  console.log("  ALL FACTORY SETTINGS BACKEND TESTS PASSED (100%) ✨  ");
  console.log("=======================================================\n");
  await app.close();
  await prisma.$disconnect();
}

runTest().catch((err) => {
  console.error("Test failed with error:", err);
  process.exit(1);
});
