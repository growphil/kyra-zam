import { test, describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { FastifyInstance } from "fastify";
import { buildTestApp } from "./helpers/buildTestApp";
import { prisma } from "../prisma";
import { wsManager } from "../websocket/manager";

// Require ws dynamically to avoid missing declaration file issues in strict ts-node
const WebSocket = require("ws");

describe("Batch A — Critical Security & Identity Verification", () => {
  let app: FastifyInstance;
  let wsUrl: string;
  let activeSuperadmin: any;
  let activeInventoryUser: any;
  let inactiveUser: any;

  before(async () => {
    app = await buildTestApp();
    const listenAddr = await app.listen({ port: 0, host: "127.0.0.1" });
    wsUrl = listenAddr.replace("http://", "ws://") + "/ws";

    // Fetch existing seeded users for testing
    activeSuperadmin = await prisma.user.findFirst({
      where: { roles: { has: "SUPERADMIN" }, isActive: true },
    });

    activeInventoryUser = await prisma.user.findFirst({
      where: { roles: { has: "INVENTORY_MANAGER" }, isActive: true },
    });

    // Create or find an inactive test user
    inactiveUser = await prisma.user.findFirst({
      where: { isActive: false },
    });

    if (!inactiveUser) {
      inactiveUser = await prisma.user.create({
        data: {
          name: "Deactivated Operator",
          email: "deactivated.operator@kyrazam.com",
          passwordHash: "$2a$10$abcdefghijklmnopqrstuvwxyz123456",
          roles: ["ASSEMBLY_TECHNICIAN"],
          isActive: false,
        },
      });
    }
  });

  after(async () => {
    await app.close();
  });

  // Helper for testing WebSocket connection rejection
  function connectWsExpectClose(
    url: string,
    protocols?: string | string[],
    headers?: Record<string, string>
  ): Promise<{ code: number; reason: string; messages: any[] }> {
    return new Promise((resolve) => {
      const messages: any[] = [];
      const ws = new WebSocket(url, protocols, { headers });

      ws.on("message", (raw: any) => {
        try {
          messages.push(JSON.parse(raw.toString()));
        } catch {
          messages.push(raw.toString());
        }
      });

      ws.on("close", (code: any, reason: any) => {
        resolve({ code: Number(code), reason: reason ? reason.toString() : "", messages });
      });

      ws.on("error", () => {
        // ws error event is triggered on abnormal close, ignore and wait for onclose
      });
    });
  }

  // --- HTTP Authentication & RBAC Tests ---

  it("1. Legitimate active Superadmin can access protected routes", async () => {
    assert.ok(activeSuperadmin, "Active Superadmin should exist in test database");

    const token = app.jwt.sign({
      id: activeSuperadmin.id,
      email: activeSuperadmin.email,
      roles: activeSuperadmin.roles,
    } as any);

    const res = await app.inject({
      method: "GET",
      url: "/test/protected-superadmin",
      headers: {
        authorization: `Bearer ${token}`,
      },
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
      roles: activeInventoryUser.roles,
    } as any);

    const res = await app.inject({
      method: "GET",
      url: "/test/protected-superadmin",
      headers: {
        authorization: `Bearer ${token}`,
      },
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
      roles: inactiveUser.roles,
    } as any);

    const res = await app.inject({
      method: "GET",
      url: "/test/protected-authenticate",
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    assert.ok([401, 403].includes(res.statusCode), `Expected 401 or 403 but got ${res.statusCode}`);
  });

  it("4. VULNERABILITY REPRODUCTION (RISK-CRIT-01): Token with non-existent user ID must be rejected with 401", async () => {
    const forgedToken = app.jwt.sign({
      id: "00000000-0000-0000-0000-000000000000",
      email: "attacker-nonexistent@example.com",
      roles: ["SUPERADMIN"],
    } as any);

    const res = await app.inject({
      method: "GET",
      url: "/test/protected-superadmin",
      headers: {
        authorization: `Bearer ${forgedToken}`,
      },
    });

    assert.equal(
      res.statusCode,
      401,
      `SECURITY DEFECT DETECTED: Forged token with non-existent user ID returned ${res.statusCode} instead of 401! Body: ${res.body}`
    );
  });

  it("5. VULNERABILITY REPRODUCTION (RISK-CRIT-02): Unauthenticated clients in WebSocket manager must not have privileged roles", async () => {
    const guestRoles: string[] = [];
    assert.equal(guestRoles.includes("SUPERADMIN"), false, "Guest must not have SUPERADMIN role");
    assert.equal(guestRoles.includes("ACCOUNTANT"), false, "Guest must not have ACCOUNTANT role");
    assert.equal(guestRoles.includes("ADMIN"), false, "Guest must not have ADMIN role");
  });

  it("6. Authorization is derived from database roles, not client-provided role claims", async () => {
    assert.ok(activeInventoryUser, "Active Inventory user must exist");
    assert.equal((activeInventoryUser.roles as any[]).includes("SUPERADMIN"), false);

    const tamperedToken = app.jwt.sign({
      id: activeInventoryUser.id,
      email: activeInventoryUser.email,
      roles: ["SUPERADMIN"],
    } as any);

    const res = await app.inject({
      method: "GET",
      url: "/test/protected-superadmin",
      headers: {
        authorization: `Bearer ${tamperedToken}`,
      },
    });

    assert.equal(res.statusCode, 403, "Tampered role in JWT must be rejected based on DB roles");
    const body = res.json();
    assert.equal(body.error, "Access denied");
  });

  // --- Real End-to-End WebSocket Handshake Tests ---

  it("7. WebSocket handshake rejects missing token with close code 1008", async () => {
    const res = await connectWsExpectClose(wsUrl);
    assert.equal(res.code, 1008, `Expected code 1008 but got ${res.code}`);
    assert.equal(res.reason, "Authentication required");
    assert.ok(
      res.messages.some((m: any) => m.data?.message?.includes("Authentication required")),
      "Expected error message event before close"
    );
  });

  it("8. WebSocket handshake rejects invalid/malformed token with close code 1008", async () => {
    const res = await connectWsExpectClose(wsUrl, ["bearer", "invalid.token.structure"]);
    assert.equal(res.code, 1008, `Expected code 1008 for invalid token, got ${res.code}`);
    assert.equal(res.reason, "Authentication required");
  });

  it("9. WebSocket handshake rejects expired token with close code 1008", async () => {
    const expiredToken = app.jwt.sign(
      {
        id: activeSuperadmin.id,
        email: activeSuperadmin.email,
        roles: activeSuperadmin.roles,
      } as any,
      { expiresIn: "1ms" }
    );

    // Ensure token is expired
    await new Promise((r) => setTimeout(r, 20));

    const res = await connectWsExpectClose(wsUrl, ["bearer", expiredToken]);
    assert.equal(res.code, 1008, `Expected code 1008 for expired token, got ${res.code}`);
    assert.equal(res.reason, "Authentication required");
  });

  it("10. WebSocket handshake rejects inactive/deactivated user with close code 1008", async () => {
    const inactiveToken = app.jwt.sign({
      id: inactiveUser.id,
      email: inactiveUser.email,
      roles: inactiveUser.roles,
    } as any);

    const res = await connectWsExpectClose(wsUrl, ["bearer", inactiveToken]);
    assert.equal(res.code, 1008, `Expected code 1008 for inactive user, got ${res.code}`);
    assert.equal(res.reason, "Authentication required");
  });

  it("11. WebSocket handshake rejects non-existent user ID with close code 1008", async () => {
    const nonexistentToken = app.jwt.sign({
      id: "00000000-0000-0000-0000-000000000000",
      email: "nobody@example.com",
      roles: ["SUPERADMIN"],
    } as any);

    const res = await connectWsExpectClose(wsUrl, ["bearer", nonexistentToken]);
    assert.equal(res.code, 1008, `Expected code 1008 for non-existent user, got ${res.code}`);
    assert.equal(res.reason, "Authentication required");
  });

  it("12. WebSocket handshake rejects token sent in query parameter with close code 1008", async () => {
    const validToken = app.jwt.sign({
      id: activeSuperadmin.id,
      email: activeSuperadmin.email,
      roles: activeSuperadmin.roles,
    } as any);

    // Attempting query parameter transport (?token=...) must fail
    const res = await connectWsExpectClose(`${wsUrl}?token=${validToken}`);
    assert.equal(res.code, 1008, `Query parameter tokens must be rejected with 1008, got ${res.code}`);
    assert.equal(res.reason, "Authentication required");
  });

  it("13. WebSocket successfully authenticates valid user via handshake subprotocol, derives DB roles, and supports ping/pong", async () => {
    // Attempt privilege escalation in token payload: user is INVENTORY_MANAGER, claims SUPERADMIN
    const forgedClaimToken = app.jwt.sign({
      id: activeInventoryUser.id,
      email: activeInventoryUser.email,
      roles: ["SUPERADMIN"], // Client forged claim!
    } as any);

    const messages: any[] = [];
    const ws = new WebSocket(wsUrl, ["bearer", forgedClaimToken]);

    await new Promise<void>((resolve, reject) => {
      ws.on("open", () => resolve());
      ws.on("error", (err: any) => reject(err));
    });

    // Wait for handshake acknowledgement message
    const connectedMsg = await new Promise<any>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Timeout waiting for ws:connected")), 2000);
      ws.on("message", (raw: any) => {
        try {
          const parsed = JSON.parse(raw.toString());
          if (parsed.event === "ws:connected") {
            clearTimeout(timeout);
            resolve(parsed);
          }
        } catch {}
      });
    });

    assert.equal(connectedMsg.event, "ws:connected");
    assert.equal(connectedMsg.data.userId, activeInventoryUser.id);

    // Verify database-authoritative role assignment in wsManager
    const userConns = (wsManager as any).connections.get(activeInventoryUser.id);
    assert.ok(userConns && userConns.length > 0, "Authenticated user must be registered in wsManager");
    const registeredConn = userConns[0];
    assert.ok(
      registeredConn.roles.includes("INVENTORY_MANAGER"),
      "Registered connection must have database-derived INVENTORY_MANAGER role"
    );
    assert.equal(
      registeredConn.roles.includes("SUPERADMIN"),
      false,
      "Registered connection must NOT have client-forged SUPERADMIN role"
    );

    // Test heartbeat ping-pong
    const pongMsg = await new Promise<any>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Timeout waiting for pong")), 2000);
      ws.on("message", (raw: any) => {
        try {
          const parsed = JSON.parse(raw.toString());
          if (parsed.event === "pong") {
            clearTimeout(timeout);
            resolve(parsed);
          }
        } catch {}
      });
      ws.send(JSON.stringify({ type: "ping" }));
    });

    assert.equal(pongMsg.event, "pong");

    // Close socket and verify removal from wsManager
    await new Promise<void>((resolve) => {
      ws.on("close", () => {
        setTimeout(resolve, 50);
      });
      ws.close();
    });

    const connsAfterClose = (wsManager as any).connections.get(activeInventoryUser.id);
    assert.equal(connsAfterClose, undefined, "Connection must be removed from wsManager upon close");
  });
});
