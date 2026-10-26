import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import Fastify, { FastifyInstance } from "fastify";
import { authPlugin } from "../plugins/auth";
import { errorHandler } from "../plugins/errorHandler";
import { procurementRoutes } from "../routes/procurement";
import { prisma } from "../prisma";

describe("Product Master Identity & Auto-Generation Sequence Tests", () => {
  let app: FastifyInstance;
  let adminToken: string;
  let testVendor: any;
  const uniqueCategory = "Q" + Math.random().toString(36).substring(2, 5).toUpperCase();

  before(async () => {
    app = Fastify({ logger: false });
    app.setErrorHandler(errorHandler);
    await app.register(authPlugin);
    await app.register(procurementRoutes, { prefix: "/crm/procurement" });
    await app.ready();

    let adminUser = await prisma.user.findFirst({
      where: { roles: { has: "ADMIN" }, isActive: true },
    });
    if (!adminUser) {
      adminUser = await prisma.user.findFirst({
        where: { roles: { has: "SUPERADMIN" }, isActive: true },
      });
    }
    assert.ok(adminUser, "Admin or Superadmin user must exist");

    adminToken = (app as any).jwt.sign({
      id: adminUser.id,
      email: adminUser.email,
      roles: adminUser.roles,
    });

    testVendor = await prisma.vendor.findFirst({ where: { isActive: true } });
    if (!testVendor) {
      testVendor = await prisma.vendor.create({
        data: {
          name: "Apex Global Supplies",
          category: "RAW_MATERIAL",
          isActive: true,
        },
      });
    }
  });

  after(async () => {
    await prisma.product.deleteMany({
      where: { category: uniqueCategory },
    });
    await prisma.material.deleteMany({
      where: { category: uniqueCategory },
    });
    await app.close();
  });

  it("1. Generating next part number on empty category returns 001", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/crm/procurement/products/next-part-number?category=${uniqueCategory}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.nextSequence, "001");
    assert.ok(body.partNumber.endsWith("-001"));
  });

  it("2. Registering a genuinely new product allocates sequence and records audit log", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/crm/procurement/products",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: "Test Component A",
        category: uniqueCategory,
        brand: `BrandX_${Date.now()}`,
        unit: "PCS",
        vendorId: testVendor.id,
      },
    });

    assert.equal(res.statusCode, 201);
    const body = JSON.parse(res.body);
    assert.equal(body.isExisting, false);
    assert.ok(body.product.partNumber.endsWith("-001"));
    assert.ok(body.product.uin);

    // Verify next sequence is now 002
    const resNext = await app.inject({
      method: "GET",
      url: `/crm/procurement/products/next-part-number?category=${uniqueCategory}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const nextBody = JSON.parse(resNext.body);
    assert.equal(nextBody.nextSequence, "002");
  });

  it("3. Duplicate check identifies exact matches and cross-brand matches", async () => {
    const targetPart = `PART-${Date.now().toString().slice(-4)}`;
    const brandOne = `BrandAlpha_${Date.now()}`;
    const brandTwo = `BrandBeta_${Date.now()}`;

    // Register under Brand Alpha
    const createRes = await app.inject({
      method: "POST",
      url: "/crm/procurement/products",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: "Sensor Unit Alpha",
        partNumber: targetPart,
        category: "SENSOR",
        brand: brandOne,
        unit: "PCS",
      },
    });
    assert.equal(createRes.statusCode, 201);

    // Check duplicate with Brand Alpha (Exact match)
    const exactCheck = await app.inject({
      method: "POST",
      url: "/crm/procurement/products/check-duplicate",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        partNumber: targetPart,
        brand: brandOne,
      },
    });
    assert.equal(exactCheck.statusCode, 200);
    const exactBody = JSON.parse(exactCheck.body);
    assert.equal(exactBody.hasExactMatch, true);
    assert.equal(exactBody.exactMatches[0].partNumber, targetPart);

    // Check duplicate with Brand Beta (Cross-brand match)
    const crossCheck = await app.inject({
      method: "POST",
      url: "/crm/procurement/products/check-duplicate",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        partNumber: targetPart,
        brand: brandTwo,
      },
    });
    assert.equal(crossCheck.statusCode, 200);
    const crossBody = JSON.parse(crossCheck.body);
    assert.equal(crossBody.hasExactMatch, false);
    assert.equal(crossBody.hasCrossBrandMatch, true);
    assert.equal(crossBody.crossBrandMatches[0].brand, brandOne.toUpperCase());

    // Clean up
    await prisma.product.deleteMany({ where: { partNumber: targetPart } });
    await prisma.material.deleteMany({ where: { sku: { contains: targetPart } } });
  });

  it("4. Historically deleted product sequence is not reused", async () => {
    const historicalCategory = "H" + Math.random().toString(36).substring(2, 5).toUpperCase();
    
    // Create product
    const createRes = await app.inject({
      method: "POST",
      url: "/crm/procurement/products",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: "Temporary Item",
        category: historicalCategory,
        brand: `HistBrand_${Date.now()}`,
        unit: "PCS",
      },
    });
    assert.equal(createRes.statusCode, 201);
    const createdProd = JSON.parse(createRes.body).product;
    assert.ok(createdProd.partNumber.endsWith("-001"));

    // Delete the product record directly from table
    await prisma.product.delete({ where: { id: createdProd.id } });

    // The audit log for PRODUCT_MASTER_REGISTERED remains, so next sequence must be 002, not 001!
    const nextRes = await app.inject({
      method: "GET",
      url: `/crm/procurement/products/next-part-number?category=${historicalCategory}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(nextRes.statusCode, 200);
    const nextBody = JSON.parse(nextRes.body);
    assert.equal(nextBody.nextSequence, "002");
  });
});
