import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import Fastify, { FastifyInstance } from "fastify";
import { authPlugin } from "../plugins/auth";
import { errorHandler } from "../plugins/errorHandler";
import { procurementRoutes } from "../routes/procurement";
import { prisma } from "../prisma";

describe("Brand-Aware Product Identity & Material Synchronization Tests", () => {
  let app: FastifyInstance;
  let adminToken: string;
  let testVendor: any;
  const testPartNumber = `BMS-REGTEST-${Date.now().toString().slice(-4)}`;

  before(async () => {
    app = Fastify({ logger: false });
    app.setErrorHandler(errorHandler);
    await app.register(authPlugin);
    await app.register(procurementRoutes, { prefix: "/crm/procurement" });
    await app.ready();

    // Find or create admin user for auth
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

    // Create or find a test vendor
    testVendor = await prisma.vendor.findFirst({ where: { isActive: true } });
    if (!testVendor) {
      testVendor = await prisma.vendor.create({
        data: {
          name: "Apex Energy Components",
          category: "RAW_MATERIAL",
          isActive: true,
        },
      });
    }
  });

  after(async () => {
    // Cleanup products and materials created in tests
    await prisma.product.deleteMany({
      where: { partNumber: { startsWith: testPartNumber } },
    });
    await prisma.material.deleteMany({
      where: { sku: { contains: testPartNumber } },
    });
    await app.close();
  });

  it("1. Registering the same part number under two different brands creates separate product identities and new UINs", async () => {
    const brandAName = `BrandAlpha-${Date.now().toString().slice(-4)}`;
    const brandBName = `BrandBeta-${Date.now().toString().slice(-4)}`;

    // Create under Brand Alpha
    const resA = await app.inject({
      method: "POST",
      url: "/crm/procurement/products",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: "100A Active Balancer BMS Alpha",
        partNumber: testPartNumber,
        brand: brandAName,
        vendorId: testVendor.id,
        category: "BMS",
        unit: "PCS",
        technicalSpecs: "16S 100A",
      },
    });

    assert.equal(resA.statusCode, 201);
    const bodyA = JSON.parse(resA.body);
    assert.equal(bodyA.isExisting, false);
    assert.ok(bodyA.product.id);
    assert.ok(bodyA.product.brandId);
    assert.equal(bodyA.product.partNumber, testPartNumber);
    assert.match(bodyA.product.uin, new RegExp(`-${testPartNumber}$`));

    // Create under Brand Beta with the exact same partNumber
    const resB = await app.inject({
      method: "POST",
      url: "/crm/procurement/products",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: "100A Active Balancer BMS Beta",
        partNumber: testPartNumber,
        brand: brandBName,
        vendorId: testVendor.id,
        category: "BMS",
        unit: "PCS",
        technicalSpecs: "16S 100A",
      },
    });

    assert.equal(resB.statusCode, 201);
    const bodyB = JSON.parse(resB.body);
    assert.equal(bodyB.isExisting, false);
    assert.ok(bodyB.product.id);
    assert.ok(bodyB.product.brandId);
    assert.notEqual(bodyA.product.id, bodyB.product.id, "Product identities must be distinct");
    assert.notEqual(bodyA.product.uin, bodyB.product.uin, "Product UINs must be distinct");
    assert.notEqual(bodyA.product.brandId, bodyB.product.brandId, "Brand IDs must be distinct");
  });

  it("2. Registering the same part number under the same brand returns/reuses the existing product rather than creating a duplicate", async () => {
    const brandName = `BrandGamma-${Date.now().toString().slice(-4)}`;

    // First registration
    const resFirst = await app.inject({
      method: "POST",
      url: "/crm/procurement/products",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: "200A Smart BMS Gamma",
        partNumber: `${testPartNumber}-GM`,
        brand: brandName,
        vendorId: testVendor.id,
        category: "BMS",
        unit: "PCS",
      },
    });

    assert.equal(resFirst.statusCode, 201);
    const firstBody = JSON.parse(resFirst.body);
    assert.equal(firstBody.isExisting, false);
    const initialId = firstBody.product.id;
    const initialUin = firstBody.product.uin;

    // Second registration with identical part number and brand
    const resSecond = await app.inject({
      method: "POST",
      url: "/crm/procurement/products",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: "200A Smart BMS Gamma",
        partNumber: `${testPartNumber}-GM`,
        brand: brandName,
        brandId: firstBody.product.brandId,
        vendorId: testVendor.id,
        category: "BMS",
        unit: "PCS",
      },
    });

    assert.equal(resSecond.statusCode, 200);
    const secondBody = JSON.parse(resSecond.body);
    assert.equal(secondBody.isExisting, true);
    assert.equal(secondBody.product.id, initialId, "Must return the same product ID");
    assert.equal(secondBody.product.uin, initialUin, "Must return the same UIN");

    // Verify DB count has exactly 1 product
    const count = await prisma.product.count({
      where: {
        partNumber: `${testPartNumber}-GM`,
        brandId: firstBody.product.brandId,
      },
    });
    assert.equal(count, 1, "Database must not contain duplicate product records for the same brand and part number");
  });

  it("3. Concurrency safety: simultaneous creation under the same brand generates unique sequential UINs without collisions", async () => {
    const brandName = `ConcurrentBrand-${Date.now().toString().slice(-4)}`;
    const uniqueCode = `C${Math.floor(100 + Math.random() * 899)}`;
    const brand = await prisma.brand.create({
      data: {
        name: brandName,
        code: uniqueCode,
        nextSequence: 1,
      },
    });

    // Launch 4 concurrent requests with different part numbers under the same brand
    const partNumbers = [
      `${testPartNumber}-C1`,
      `${testPartNumber}-C2`,
      `${testPartNumber}-C3`,
      `${testPartNumber}-C4`,
    ];

    const promises = partNumbers.map((pn) =>
      app.inject({
        method: "POST",
        url: "/crm/procurement/products",
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          name: `Concurrent Item ${pn}`,
          partNumber: pn,
          brand: brandName,
          brandId: brand.id,
          category: "BMS",
          unit: "PCS",
        },
      })
    );

    const responses = await Promise.all(promises);
    for (const res of responses) {
      assert.equal(res.statusCode, 201, `Failed response: ${res.body}`);
    }

    const bodies = responses.map((r) => JSON.parse(r.body));
    const uins = bodies.map((b) => b.product.uin);
    const uniqueUins = new Set(uins);
    assert.equal(uniqueUins.size, 4, "All 4 concurrently created UINs must be completely unique");

    // Verify brand sequence was updated atomically
    const refreshedBrand = await prisma.brand.findUnique({ where: { id: brand.id } });
    assert.equal(refreshedBrand?.nextSequence, 5, "Brand nextSequence counter must be 5 after 4 creations");
  });

  it("4. Factory Material synchronization: Brand A and Brand B with same part number have distinct, non-overlapping Material records", async () => {
    const brandXName = `BrandXray-${Date.now().toString().slice(-4)}`;
    const brandYName = `BrandYankee-${Date.now().toString().slice(-4)}`;
    const sharedPartNumber = `${testPartNumber}-SHARED`;

    // 1. Create product under Brand X
    const resX = await app.inject({
      method: "POST",
      url: "/crm/procurement/products",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: "Shared Spec BMS Xray",
        partNumber: sharedPartNumber,
        brand: brandXName,
        category: "BMS",
        unit: "PCS",
      },
    });
    assert.equal(resX.statusCode, 201);
    const bodyX = JSON.parse(resX.body);

    // 2. Create product under Brand Y with the exact same part number
    const resY = await app.inject({
      method: "POST",
      url: "/crm/procurement/products",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: "Shared Spec BMS Yankee",
        partNumber: sharedPartNumber,
        brand: brandYName,
        category: "BMS",
        unit: "PCS",
      },
    });
    assert.equal(resY.statusCode, 201);
    const bodyY = JSON.parse(resY.body);

    assert.ok(bodyX.product.materialId, "Product X must have a linked Factory Material");
    assert.ok(bodyY.product.materialId, "Product Y must have a linked Factory Material");
    assert.notEqual(
      bodyX.product.materialId,
      bodyY.product.materialId,
      "Product X and Product Y must have separate, non-overlapping Factory Material records"
    );

    // Verify materials in DB
    const matX = await prisma.material.findUnique({ where: { id: bodyX.product.materialId } });
    const matY = await prisma.material.findUnique({ where: { id: bodyY.product.materialId } });

    assert.ok(matX, "Material X must exist");
    assert.ok(matY, "Material Y must exist");
    assert.notEqual(matX?.sku, matY?.sku, "Material SKUs must be distinct");
    assert.equal(matX?.sku, sharedPartNumber);
    assert.ok(matY?.sku.includes(sharedPartNumber));
  });
});
