import { test, describe, before, after } from "node:test";
import assert from "node:assert";
import { buildTestApp } from "./helpers/buildTestApp";
import { FastifyInstance } from "fastify";
import { prisma } from "../prisma";

describe("Production Schema Mismatch & P2022 Error Fix Verification", () => {
  let app: FastifyInstance;
  let adminToken: string;

  before(async () => {
    app = await buildTestApp();

    // Find or ensure an active admin / superadmin user
    let user = await prisma.user.findFirst({
      where: {
        email: "superadmin@kyrazam.com",
        isActive: true
      }
    });

    if (!user) {
      user = await prisma.user.findFirst({
        where: { isActive: true }
      });
    }

    assert(user, "Active user must exist in database for testing");

    adminToken = app.jwt.sign(
      { id: user.id, roles: user.roles as any },
      { expiresIn: "1h" }
    );
  });

  after(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  test("1. GET /crm/procurement/products?search=&limit=50 returns HTTP 200 without P2022 componentId error", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/crm/procurement/products?search=&limit=50",
      headers: {
        authorization: `Bearer ${adminToken}`
      }
    });

    assert.strictEqual(res.statusCode, 200, `Expected 200, got ${res.statusCode}: ${res.body}`);
    const body = JSON.parse(res.body);
    assert.ok(Array.isArray(body.products), "Expected response to have products array");
  });

  test("2. GET /crm/procurement/brands returns HTTP 200", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/crm/procurement/brands",
      headers: {
        authorization: `Bearer ${adminToken}`
      }
    });

    assert.strictEqual(res.statusCode, 200, `Expected 200, got ${res.statusCode}: ${res.body}`);
    const body = JSON.parse(res.body);
    assert.ok(Array.isArray(body) || Array.isArray(body.brands), "Expected response to have brands");
  });

  test("3. GET /crm/procurement/purchase-orders?limit=100 returns HTTP 200", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/crm/procurement/purchase-orders?limit=100",
      headers: {
        authorization: `Bearer ${adminToken}`
      }
    });

    assert.strictEqual(res.statusCode, 200, `Expected 200, got ${res.statusCode}: ${res.body}`);
    const body = JSON.parse(res.body);
    assert.ok(Array.isArray(body.orders), "Expected response to have orders array");
  });

  test("4. GET /crm/procurement/invoice-orders?page=1&limit=15 returns HTTP 200 without P2022 isDirect error", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/crm/procurement/invoice-orders?page=1&limit=15",
      headers: {
        authorization: `Bearer ${adminToken}`
      }
    });

    assert.strictEqual(res.statusCode, 200, `Expected 200, got ${res.statusCode}: ${res.body}`);
    const body = JSON.parse(res.body);
    assert.ok(Array.isArray(body.items), "Expected response to have items array");
  });
});
