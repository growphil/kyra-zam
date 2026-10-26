import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import Fastify, { FastifyInstance } from "fastify";
import { authPlugin } from "../plugins/auth";
import { errorHandler } from "../plugins/errorHandler";
import { adminRoutes } from "../routes/admin";
import { prisma } from "../prisma";
import { redis } from "../redis";

describe("Admin Data Purge and SuperAdmin Master Wipe Tests", () => {
  let app: FastifyInstance;
  let superadminToken: string;

  before(async () => {
    app = Fastify({ logger: false });
    app.setErrorHandler(errorHandler);
    await app.register(authPlugin);
    await app.register(adminRoutes, { prefix: "/admin" });
    await app.ready();

    let superadmin = await prisma.user.findFirst({
      where: { roles: { has: "SUPERADMIN" }, isActive: true },
    });
    assert.ok(superadmin, "Superadmin user must exist");

    superadminToken = (app as any).jwt.sign({
      id: superadmin.id,
      email: superadmin.email,
      roles: superadmin.roles,
    });
  });

  after(async () => {
    await app.close();
    await prisma.$disconnect();
    try {
      redis.disconnect();
    } catch (e) {}
  });

  it("should support clearProcurement and clearSales via DELETE /admin/clear-data", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: "/admin/clear-data",
      headers: {
        authorization: `Bearer ${superadminToken}`,
      },
      payload: {
        clearSales: true,
        clearProcurement: true,
      },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.ok(body.message.toLowerCase().includes("purged"));
  });

  it("should successfully execute POST /admin/wipe-all-data, purging all transactional tables and preserving exactly 12 seed users", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/admin/wipe-all-data",
      headers: {
        authorization: `Bearer ${superadminToken}`,
      },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.status, "success");
    assert.equal(body.activeSeedUsers, 12);

    // Verify database counts
    const userCount = await prisma.user.count();
    assert.equal(userCount, 12, "Must preserve exactly 12 seed users");

    const invoiceCount = await prisma.invoice.count();
    assert.equal(invoiceCount, 0, "Invoices must be 0");

    const quotationCount = await prisma.quotation.count();
    assert.equal(quotationCount, 0, "Quotations must be 0");

    const poCount = await prisma.purchaseOrder.count();
    assert.equal(poCount, 0, "Purchase orders must be 0");

    const prCount = await prisma.purchaseRequest.count();
    assert.equal(prCount, 0, "Purchase requests must be 0");

    const saleCount = await prisma.sale.count();
    assert.equal(saleCount, 0, "Sales must be 0");

    const leadCount = await prisma.lead.count();
    assert.equal(leadCount, 0, "Leads must be 0");

    const customerCount = await prisma.customer.count();
    assert.equal(customerCount, 0, "Customers must be 0");

    const cellCount = await prisma.cell.count();
    assert.equal(cellCount, 0, "Cells must be 0");

    const packCount = await prisma.paxPack.count();
    assert.equal(packCount, 0, "PaxPacks must be 0");
  });

  it("should successfully return baseline vendors via GET /admin/vendors", async () => {
    const superadmin = await prisma.user.findFirst({
      where: { roles: { has: "SUPERADMIN" }, isActive: true }
    });
    assert.ok(superadmin, "Superadmin must exist after wipe");
    const token = (app as any).jwt.sign({
      id: superadmin.id,
      email: superadmin.email,
      roles: superadmin.roles,
    });

    const res = await app.inject({
      method: "GET",
      url: "/admin/vendors",
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.ok(Array.isArray(body), "Must return array of vendors");
    assert.ok(body.length >= 8, `Expected at least 8 baseline vendors, got ${body.length}`);
  });
});

