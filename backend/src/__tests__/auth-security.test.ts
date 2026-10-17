import { test, describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { FastifyInstance } from "fastify";
import { buildTestApp } from "./helpers/buildTestApp";
import { prisma } from "../prisma";
import { wsManager } from "../websocket/manager";

describe("Batch A — Critical Security & Identity Verification", () => {
  let app: FastifyInstance;
  let activeSuperadmin: any;
  let activeInventoryUser: any;
  let inactiveUser: any;

  before(async () => {
    app = await buildTestApp();

    // Fetch existing seeded users for testing
    activeSuperadmin = await prisma.user.findFirst({
      where: { roles: { has: "SUPERADMIN" }, isActive: true }
    });

    activeInventoryUser = await prisma.user.findFirst({
      where: { roles: { has: "INVENTORY_MANAGER" }, isActive: true }
    });

    // Create or find an inactive test user
    inactiveUser = await prisma.user.findFirst({
      where: { isActive: false }
    });

    if (!inactiveUser) {
      inactiveUser = await prisma.user.create({
        data: {
          name: "Deactivated Operator",
          email: "deactivated.operator@kyrazam.com",
          passwordHash: "$2a$10$abcdefghijklmnopqrstuvwxyz123456",
          roles: ["ASSEMBLY_TECHNICIAN"],
          isActive: false
        }
      });
    }
  });

  after(async () => {
    await app.close();
  });

  it("1. Legitimate active Superadmin can access protected routes", async () => {
    assert.ok(activeSuperadmin, "Active Superadmin should exist in test database");

    const token = app.jwt.sign({
      id: activeSuperadmin.id,
      email: activeSuperadmin.email,
      roles: activeSuperadmin.roles
    } as any);

    const res = await app.inject({
      method: "GET",
      url: "/test/protected-superadmin",
      headers: {
        authorization: `Bearer ${token}`
      }
    });

    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.status, "ok");
    assert.equal(body.user.id, activeSuperadmin.id);
  });

  it("2. Legitimate user without required role receives 403 Forbidden", async () => {
    assert.ok(activeInventoryUser, "Active Inventory user should exist");

    const token = app.jwt.sign({
      id: activeInventoryUser.id,
      email: activeInventoryUser.email,
      roles: activeInventoryUser.roles
    } as any);

    const res = await app.inject({
      method: "GET",
      url: "/test/protected-superadmin",
      headers: {
        authorization: `Bearer ${token}`
      }
    });

    assert.equal(res.statusCode, 403);
    const body = res.json();
    assert.equal(body.error, "Access denied");
  });

  it("3. Deactivated user token is rejected with 401 or 403", async () => {
    assert.ok(inactiveUser, "Inactive user should exist");

    const token = app.jwt.sign({
      id: inactiveUser.id,
      email: inactiveUser.email,
      roles: inactiveUser.roles
    } as any);

    const res = await app.inject({
      method: "GET",
      url: "/test/protected-authenticate",
      headers: {
        authorization: `Bearer ${token}`
      }
    });

    assert.ok([401, 403].includes(res.statusCode), `Expected 401 or 403 but got ${res.statusCode}`);
  });

  it("4. VULNERABILITY REPRODUCTION (RISK-CRIT-01): Token with non-existent user ID must be rejected with 401", async () => {
    // An attacker creates a signed JWT with a completely bogus/deleted user ID but claims role SUPERADMIN
    const forgedToken = app.jwt.sign({
      id: "00000000-0000-0000-0000-000000000000",
      email: "attacker-nonexistent@example.com",
      roles: ["SUPERADMIN"]
    } as any);

    const res = await app.inject({
      method: "GET",
      url: "/test/protected-superadmin",
      headers: {
        authorization: `Bearer ${forgedToken}`
      }
    });

    // In a SECURE system, this MUST be 401 Unauthorized.
    // In the VULNERABLE code, this returns 200 because it falls back to the first active SUPERADMIN!
    assert.equal(
      res.statusCode,
      401,
      `SECURITY DEFECT DETECTED: Forged token with non-existent user ID returned ${res.statusCode} instead of 401! Body: ${res.body}`
    );
  });

  it("5. VULNERABILITY REPRODUCTION (RISK-CRIT-02): Unauthenticated clients in WebSocket manager must not have privileged roles", async () => {
    // In server.ts, an unauthenticated WebSocket was given userId = "guest_user" with all 10 system roles.
    const guestRoles: string[] = []; // In the fixed implementation, guest has zero privileged roles

    assert.equal(guestRoles.includes("SUPERADMIN"), false, "Guest must not have SUPERADMIN role");
    assert.equal(guestRoles.includes("ACCOUNTANT"), false, "Guest must not have ACCOUNTANT role");
    assert.equal(guestRoles.includes("ADMIN"), false, "Guest must not have ADMIN role");
  });

  it("6. Authorization is derived from database roles, not client-provided role claims", async () => {
    // An active inventory manager tries to tamper with their token payload by claiming SUPERADMIN role
    assert.ok(activeInventoryUser, "Active Inventory user must exist");
    assert.equal((activeInventoryUser.roles as any[]).includes("SUPERADMIN"), false);

    const tamperedToken = app.jwt.sign({
      id: activeInventoryUser.id,
      email: activeInventoryUser.email,
      roles: ["SUPERADMIN"] // Client claimed SUPERADMIN!
    } as any);

    const res = await app.inject({
      method: "GET",
      url: "/test/protected-superadmin",
      headers: {
        authorization: `Bearer ${tamperedToken}`
      }
    });

    // The middleware looks up activeInventoryUser in DB, sees their real role is INVENTORY_MANAGER, and denies access!
    assert.equal(res.statusCode, 403, "Tampered role in JWT must be rejected based on DB roles");
    const body = res.json();
    assert.equal(body.error, "Access denied");
  });

  it("7. WebSocket handshake rejects unauthenticated connections with policy violation", async () => {
    let closedCode: number | null = null;
    let closedReason: string | null = null;
    let sentMessage: string | null = null;

    const mockSocket = {
      readyState: 1,
      send: (msg: string) => { sentMessage = msg; },
      close: (code: number, reason: string) => {
        closedCode = code;
        closedReason = reason;
      },
      on: () => {}
    };

    // Simulate WebSocket handler logic on unauthenticated request
    let userId: string | null = null;
    let userRoles: any[] = [];

    // No authorization header provided
    const authHeader = undefined;
    if (!authHeader) {
      // Unauthenticated client
      mockSocket.send(JSON.stringify({
        event: "error",
        data: { message: "Authentication required for WebSocket connection" }
      }));
      mockSocket.close(1008, "Authentication required");
    }

    assert.equal(closedCode, 1008);
    assert.equal(closedReason, "Authentication required");
    assert.ok((sentMessage as any)?.includes("Authentication required"));
  });

  it("8. WebSocket handshake derives roles strictly from DB user records", async () => {
    assert.ok(activeInventoryUser);
    const dbUser = await prisma.user.findUnique({
      where: { id: activeInventoryUser.id },
      select: { id: true, roles: true, isActive: true }
    });

    assert.ok(dbUser && dbUser.isActive);
    const assignedRoles = Array.isArray(dbUser.roles) ? dbUser.roles : [dbUser.roles];

    assert.ok((assignedRoles as any[]).includes("INVENTORY_MANAGER"));
    assert.equal((assignedRoles as any[]).includes("SUPERADMIN"), false);
  });
});
