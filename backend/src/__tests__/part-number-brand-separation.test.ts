import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import Fastify, { FastifyInstance } from "fastify";
import { authPlugin } from "../plugins/auth";
import { errorHandler } from "../plugins/errorHandler";
import { procurementRoutes } from "../routes/procurement";
import { prisma } from "../prisma";

/**
 * Part-number-first selection & separate brand registration.
 * Mirrors the acceptance tests: BMS-002 registered under KYRA and RCA, then DALY.
 */
describe("Part Number Selection Separated from Brand Registration", () => {
  let app: FastifyInstance;
  let adminToken: string;
  let adminUser: any;
  let testVendor: any;
  const suffix = Date.now().toString().slice(-6);
  const PN = `BMS-SEP${suffix}`;
  const KYRA = `KYRA${suffix}`;
  const RCA = `RCA${suffix}`;
  const DALY = `DALY${suffix}`;
  const RACE = `RACE${suffix}`;
  const createdPoIds: string[] = [];

  let kyra: any;
  let rca: any;
  let daly: any;

  const auth = () => ({ authorization: `Bearer ${adminToken}` });
  const register = (brand: string, extra: Record<string, any> = {}) =>
    app.inject({
      method: "POST",
      url: "/crm/procurement/products",
      headers: auth(),
      payload: {
        name: "Smart BMS 16S 100A",
        partNumber: PN,
        brand,
        category: "BMS",
        unit: "PCS",
        technicalSpecs: "16S 100A CAN/RS485",
        ...extra
      }
    });

  before(async () => {
    app = Fastify({ logger: false });
    app.setErrorHandler(errorHandler);
    await app.register(authPlugin);
    await app.register(procurementRoutes, { prefix: "/crm/procurement" });
    await app.ready();

    adminUser =
      (await prisma.user.findFirst({ where: { roles: { has: "SUPERADMIN" }, isActive: true } })) ||
      (await prisma.user.findFirst({ where: { roles: { has: "ADMIN" }, isActive: true } }));
    assert.ok(adminUser, "Admin or Superadmin user must exist");
    adminToken = (app as any).jwt.sign({ id: adminUser.id, email: adminUser.email, roles: adminUser.roles });

    testVendor = await prisma.vendor.findFirst({ where: { isActive: true } });
    if (!testVendor) {
      testVendor = await prisma.vendor.create({
        data: { name: "Separation Test Vendor", category: "RAW_MATERIAL", isActive: true }
      });
    }

    // Seed existing brand identities KYRA + RCA for the same part number
    const k = await register(KYRA);
    assert.equal(k.statusCode, 201, k.body);
    kyra = JSON.parse(k.body).product;
    const r = await register(RCA);
    assert.equal(r.statusCode, 201, r.body);
    rca = JSON.parse(r.body).product;
  });

  after(async () => {
    if (createdPoIds.length) {
      await prisma.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: { in: createdPoIds } } });
      await prisma.auditLog.deleteMany({ where: { entityId: { in: createdPoIds } } });
      await prisma.purchaseOrder.deleteMany({ where: { id: { in: createdPoIds } } });
    }
    await prisma.product.deleteMany({ where: { partNumber: PN } });
    await prisma.material.deleteMany({ where: { sku: { contains: PN } } });
    await prisma.brand.deleteMany({ where: { name: { in: [KYRA, RCA, DALY, RACE].map((b) => b.toUpperCase()) } } });
    await prisma.brand.deleteMany({ where: { name: "READONLY", products: { none: {} } } });
    await app.close();
  });

  it("1+2. Search groups by part number, lists all brands, and does not pre-select a brand", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/crm/procurement/products/part-numbers?search=${encodeURIComponent(PN)}`,
      headers: auth()
    });
    assert.equal(res.statusCode, 200, res.body);
    const body = JSON.parse(res.body);
    const groups = body.partNumbers.filter((g: any) => g.partNumber === PN);
    assert.equal(groups.length, 1, "Exactly one part-number family result");
    const family = groups[0];
    const brands = family.brands.map((b: any) => b.brand).sort();
    assert.deepEqual(brands, [KYRA.toUpperCase(), RCA.toUpperCase()].sort());
    // The family itself carries no brand / product identity -> brand selection is a separate step
    assert.equal(family.brand, undefined);
    assert.equal(family.brandId, undefined);
    assert.equal(family.uin, undefined);
    assert.equal(family.category, "BMS");
    assert.equal(family.technicalSpecs, "16S 100A CAN/RS485");

    // Search by product name also finds the family
    const byName = await app.inject({
      method: "GET",
      url: `/crm/procurement/products/part-numbers?search=${encodeURIComponent("Smart BMS 16S")}&limit=500`,
      headers: auth()
    });
    assert.ok(JSON.parse(byName.body).partNumbers.some((g: any) => g.partNumber === PN));
  });

  it("3+4. Registering DALY creates a new identity + UIN; KYRA and RCA remain unchanged", async () => {
    const before = await prisma.product.findMany({
      where: { id: { in: [kyra.id, rca.id] } },
      include: { material: true },
      orderBy: { id: "asc" }
    });

    // Simulate a stale client sending KYRA's materialId with the family selection
    const res = await register(DALY, { materialId: kyra.materialId, vendorId: testVendor.id });
    assert.equal(res.statusCode, 201, res.body);
    const body = JSON.parse(res.body);
    daly = body.product;
    assert.equal(body.isExisting, false);
    assert.equal(daly.partNumber, PN);
    assert.equal(daly.brand, DALY.toUpperCase());
    assert.notEqual(daly.id, kyra.id);
    assert.notEqual(daly.id, rca.id);
    assert.notEqual(daly.uin, kyra.uin);
    assert.notEqual(daly.uin, rca.uin);
    assert.match(daly.uin, new RegExp(`-${PN}$`));
    // Factory Material isolation: DALY must not share KYRA's or RCA's material
    assert.ok(daly.materialId);
    assert.notEqual(daly.materialId, kyra.materialId);
    assert.notEqual(daly.materialId, rca.materialId);

    const after = await prisma.product.findMany({
      where: { id: { in: [kyra.id, rca.id] } },
      include: { material: true },
      orderBy: { id: "asc" }
    });
    for (let i = 0; i < before.length; i++) {
      assert.equal(after[i].uin, before[i].uin);
      assert.equal(after[i].brand, before[i].brand);
      assert.equal(after[i].brandId, before[i].brandId);
      assert.equal(after[i].materialId, before[i].materialId);
      assert.equal(after[i].updatedAt.getTime(), before[i].updatedAt.getTime());
      assert.equal(after[i].material?.sku, before[i].material?.sku);
      assert.equal(after[i].material?.name, before[i].material?.name);
    }
  });

  it("5. Repeating with the same brand reuses the exact existing identity", async () => {
    const res = await register(DALY);
    assert.equal(res.statusCode, 200, res.body);
    const body = JSON.parse(res.body);
    assert.equal(body.isExisting, true);
    assert.equal(body.product.id, daly.id);
    assert.equal(body.product.uin, daly.uin);
    const count = await prisma.product.count({ where: { partNumber: PN } });
    assert.equal(count, 3, "KYRA, RCA, DALY only");
  });

  it("6a. Concurrency: parallel registrations of a new brand converge on one identity", async () => {
    const responses = await Promise.all(Array.from({ length: 5 }, () => register(RACE)));
    for (const r of responses) assert.ok([200, 201].includes(r.statusCode), r.body);
    const ids = new Set(responses.map((r) => JSON.parse(r.body).product.id));
    const uins = new Set(responses.map((r) => JSON.parse(r.body).product.uin));
    assert.equal(ids.size, 1, "All parallel requests must resolve to the same product");
    assert.equal(uins.size, 1);
    const count = await prisma.product.count({
      where: { partNumber: PN, brand: { equals: RACE, mode: "insensitive" } }
    });
    assert.equal(count, 1);
  });

  it("6b. Database enforces (partNumber, brandId) uniqueness", async () => {
    await assert.rejects(
      prisma.product.create({
        data: {
          uin: `DUP-${suffix}-${PN}`,
          name: "dup",
          partNumber: PN,
          brand: daly.brand,
          brandId: daly.brandId,
          category: "BMS"
        }
      }),
      (err: any) => err?.code === "P2002"
    );
  });

  it("6c. Authorization: unauthenticated and read-only roles cannot register identities", async () => {
    const anon = await app.inject({
      method: "POST",
      url: "/crm/procurement/products",
      payload: { name: "x", partNumber: PN, brand: "ANON", category: "BMS" }
    });
    assert.equal(anon.statusCode, 401);

    const anonSearch = await app.inject({ method: "GET", url: `/crm/procurement/products/part-numbers?search=${PN}` });
    assert.equal(anonSearch.statusCode, 401);

    // RBAC derives roles from the DB user (token roles are ignored), so use a real user lacking write roles
    const readOnlyUser = await prisma.user.findFirst({
      where: {
        isActive: true,
        NOT: [
          { roles: { has: "SUPERADMIN" } },
          { roles: { has: "ADMIN" } },
          { roles: { has: "PURCHASE_MANAGER" } }
        ]
      }
    });
    assert.ok(readOnlyUser, "A seed user without PO write roles must exist");
    const readOnlyToken = (app as any).jwt.sign({
      id: readOnlyUser.id,
      email: readOnlyUser.email,
      roles: ["SUPERADMIN"] // forged claim must be ignored
    });
    const ro = await app.inject({
      method: "POST",
      url: "/crm/procurement/products",
      headers: { authorization: `Bearer ${readOnlyToken}` },
      payload: { name: "x", partNumber: PN, brand: "READONLY", category: "BMS" }
    });
    assert.equal(ro.statusCode, 403, ro.body);
  });

  it("7. PO line stores the exact product-brand identity (server-authoritative)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/crm/procurement/purchase-orders",
      headers: auth(),
      payload: {
        vendorId: testVendor.id,
        expectedDeliveryDate: new Date(Date.now() + 7 * 86400000).toISOString(),
        paymentTerms: "30 Days Net",
        deliveryTerms: "FOB",
        billingAddress: "Test billing",
        deliveryAddress: "Test delivery",
        items: [
          {
            productId: daly.id,
            // Tampered/mismatched client labels must be corrected by the server
            brand: KYRA.toUpperCase(),
            partNumber: "WRONG-PN",
            productUin: kyra.uin,
            description: daly.name,
            quantityOrdered: 2,
            unitPrice: 100,
            taxRate: 18
          }
        ]
      }
    });
    assert.ok([200, 201].includes(res.statusCode), res.body);
    const po = JSON.parse(res.body);
    createdPoIds.push(po.id);
    const lines = await prisma.purchaseOrderItem.findMany({ where: { purchaseOrderId: po.id } });
    assert.equal(lines.length, 1);
    assert.equal(lines[0].productId, daly.id);
    assert.equal(lines[0].productUin, daly.uin);
    assert.equal(lines[0].brand, daly.brand);
    assert.equal(lines[0].partNumber, PN);
  });
});
