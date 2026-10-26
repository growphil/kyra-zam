import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { FastifyInstance } from "fastify";
import { buildTestApp } from "./helpers/buildTestApp";
import { prisma } from "../prisma";
import bcrypt from "bcryptjs";

describe("Batch B — Authentication Hardening (CORS, Query Tokens, Expiry, Rotation)", () => {
  let app: FastifyInstance;
  let testUser: any;

  before(async () => {
    app = await buildTestApp();

    // Ensure clean state for test user
    const existing = await prisma.user.findFirst({
      where: { email: "batch-b-superadmin@kyrazam.test" }
    });

    if (existing) {
      await prisma.refreshToken.deleteMany({ where: { userId: existing.id } });
      testUser = existing;
    } else {
      const passwordHash = await bcrypt.hash("Password123!", 10);
      testUser = await prisma.user.create({
        data: {
          id: "test-user-batch-b-001",
          email: "batch-b-superadmin@kyrazam.test",
          name: "Batch B Superadmin",
          passwordHash,
          roles: ["SUPERADMIN"] as any,
          isActive: true
        }
      });
    }
  });

  after(async () => {
    if (testUser?.id) {
      await prisma.refreshToken.deleteMany({ where: { userId: testUser.id } }).catch(() => {});
    }
    await app.close();
  });

  // ==========================================
  // B1: CORS Origin Whitelisting
  // ==========================================
  describe("B1: CORS Origin Whitelisting", () => {
    test("1. Approved origin (localhost:3000) receives CORS allow headers with credentials", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/test/protected-authenticate",
        headers: {
          origin: "http://localhost:3000"
        }
      });

      assert.equal(res.headers["access-control-allow-origin"], "http://localhost:3000");
      assert.equal(res.headers["access-control-allow-credentials"], "true");
    });

    test("1b. Production origin (https://kyra-zam.vercel.app) receives CORS allow headers with credentials", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/test/protected-authenticate",
        headers: {
          origin: "https://kyra-zam.vercel.app"
        }
      });

      assert.equal(res.headers["access-control-allow-origin"], "https://kyra-zam.vercel.app");
      assert.equal(res.headers["access-control-allow-credentials"], "true");
    });

    test("1c. Preflight OPTIONS for production origin (https://kyra-zam.vercel.app) receives 204 with credentials and methods", async () => {
      const res = await app.inject({
        method: "OPTIONS",
        url: "/admin/dashboard-stats",
        headers: {
          origin: "https://kyra-zam.vercel.app",
          "access-control-request-method": "GET",
          "access-control-request-headers": "authorization, content-type"
        }
      });

      assert.equal(res.statusCode, 204);
      assert.equal(res.headers["access-control-allow-origin"], "https://kyra-zam.vercel.app");
      assert.equal(res.headers["access-control-allow-credentials"], "true");
      assert.ok(res.headers["access-control-allow-methods"]);
    });

    test("2. Untrusted origin (https://evil-attacker.com) is NOT reflected in Access-Control-Allow-Origin", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/test/protected-authenticate",
        headers: {
          origin: "https://evil-attacker.com"
        }
      });

      // Permissive reflection would have set Access-Control-Allow-Origin: https://evil-attacker.com
      assert.equal(
        res.headers["access-control-allow-origin"],
        undefined,
        "Untrusted origin must not be reflected in Access-Control-Allow-Origin header"
      );
    });

    test("3. Preflight OPTIONS for untrusted origin does not receive CORS allow headers", async () => {
      const res = await app.inject({
        method: "OPTIONS",
        url: "/test/protected-authenticate",
        headers: {
          origin: "https://evil-attacker.com",
          "access-control-request-method": "GET"
        }
      });

      assert.equal(
        res.headers["access-control-allow-origin"],
        undefined,
        "Preflight from untrusted origin must not receive Access-Control-Allow-Origin"
      );
    });

    test("4. Request without Origin header (server-to-server / curl) succeeds without CORS error", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/auth/me"
      });

      // Without Origin header, request is processed without CORS rejection (401 because no auth, not CORS block)
      assert.equal(res.statusCode, 401);
      assert.equal(res.headers["access-control-allow-origin"], undefined);
    });
  });

  // ==========================================
  // B2: JWT Transport Hardening (Query Token Rejection)
  // ==========================================
  describe("B2: JWT Transport Hardening", () => {
    test("5. fastify.authenticate rejects token passed exclusively via ?token= query parameter", async () => {
      const validToken = app.jwt.sign({
        id: testUser.id,
        email: testUser.email,
        roles: testUser.roles
      } as any);

      const res = await app.inject({
        method: "GET",
        url: `/test/protected-authenticate?token=${validToken}`
      });

      assert.equal(res.statusCode, 401, "Route must fail with 401 when token is only in URL query string");
      const body = JSON.parse(res.body);
      assert.equal(body.error, "Unauthorized");
    });

    test("6. requireRoles rejects token passed exclusively via ?token= query parameter", async () => {
      const validToken = app.jwt.sign({
        id: testUser.id,
        email: testUser.email,
        roles: testUser.roles
      } as any);

      const res = await app.inject({
        method: "GET",
        url: `/test/protected-superadmin?token=${validToken}`
      });

      assert.equal(res.statusCode, 401, "RBAC route must fail with 401 when token is only in URL query string");
      const body = JSON.parse(res.body);
      assert.equal(body.error, "Unauthorized");
    });

    test("7. Legitimate request with Authorization: Bearer header succeeds", async () => {
      const validToken = app.jwt.sign({
        id: testUser.id,
        email: testUser.email,
        roles: testUser.roles
      } as any);

      const res = await app.inject({
        method: "GET",
        url: "/test/protected-authenticate",
        headers: {
          authorization: `Bearer ${validToken}`
        }
      });

      assert.equal(res.statusCode, 200);
      const body = JSON.parse(res.body);
      assert.equal(body.status, "ok");
      assert.equal(body.user.id, testUser.id);
    });
  });

  // ==========================================
  // B3: Token Expiry Alignment
  // ==========================================
  describe("B3: Token Expiry Alignment", () => {
    test("8. Login access token expires in 60m (3600s), NOT 365 days (31536000s)", async () => {
      const loginRes = await app.inject({
        method: "POST",
        url: "/auth/login",
        payload: {
          email: testUser.email,
          password: "Password123!"
        }
      });

      assert.equal(loginRes.statusCode, 200);
      const { accessToken } = JSON.parse(loginRes.body);
      assert.ok(accessToken, "Access token must be returned on login");

      const decoded = app.jwt.decode(accessToken) as { exp: number; iat: number };
      const lifetimeSeconds = decoded.exp - decoded.iat;

      // 60 minutes = 3600 seconds
      assert.equal(
        lifetimeSeconds,
        3600,
        `Access token lifetime should be 3600 seconds (60m), got ${lifetimeSeconds}s`
      );
    });
  });

  // ==========================================
  // B4: Refresh Token Rotation & Replay Rejection
  // ==========================================
  describe("B4: Refresh Token Rotation & Replay Rejection", () => {
    test("9. Successful refresh rotates token and returns new token pair", async () => {
      // Step A: Login to get initial refresh token
      const loginRes = await app.inject({
        method: "POST",
        url: "/auth/login",
        payload: {
          email: testUser.email,
          password: "Password123!"
        }
      });
      const loginData = JSON.parse(loginRes.body);
      const initialRefreshToken = loginData.refreshToken;
      assert.ok(initialRefreshToken, "Initial refresh token must be returned");

      // Step B: Refresh session
      const refreshRes = await app.inject({
        method: "POST",
        url: "/auth/refresh",
        payload: {
          refreshToken: initialRefreshToken
        }
      });

      assert.equal(refreshRes.statusCode, 200);
      const refreshData = JSON.parse(refreshRes.body);
      assert.ok(refreshData.accessToken, "New access token must be returned");
      assert.ok(refreshData.refreshToken, "Rotated new refresh token must be returned");
      assert.notEqual(
        refreshData.refreshToken,
        initialRefreshToken,
        "New refresh token must differ from initial refresh token"
      );

      // Verify new access token lifetime is 3600s (60m), not 30 days
      const decodedNew = app.jwt.decode(refreshData.accessToken) as { exp: number; iat: number };
      assert.equal(decodedNew.exp - decodedNew.iat, 3600);

      // Step C: Verify initial refresh token is marked revoked in database
      const [userId, initialRawToken] = initialRefreshToken.split(":");
      const revokedRows = await prisma.refreshToken.findMany({
        where: { userId, revokedAt: { not: null } }
      });

      let foundRevoked = false;
      for (const row of revokedRows) {
        if (await bcrypt.compare(initialRawToken, row.tokenHash)) {
          foundRevoked = true;
          break;
        }
      }
      assert.ok(foundRevoked, "Original refresh token must have revokedAt set in PostgreSQL");
    });

    test("10. Replaying an already-used refresh token triggers replay detection and revokes all sessions", async () => {
      // Step A: Login
      const loginRes = await app.inject({
        method: "POST",
        url: "/auth/login",
        payload: {
          email: testUser.email,
          password: "Password123!"
        }
      });
      const { refreshToken: token1 } = JSON.parse(loginRes.body);

      // Step B: Legitimate client uses token1 -> receives token2
      const firstRefreshRes = await app.inject({
        method: "POST",
        url: "/auth/refresh",
        payload: { refreshToken: token1 }
      });
      assert.equal(firstRefreshRes.statusCode, 200);
      const { refreshToken: token2 } = JSON.parse(firstRefreshRes.body);

      // Step C: Attacker (or replayed client) attempts to reuse the already-rotated token1!
      const replayRes = await app.inject({
        method: "POST",
        url: "/auth/refresh",
        payload: { refreshToken: token1 }
      });

      assert.equal(replayRes.statusCode, 401);
      const replayBody = JSON.parse(replayRes.body);
      assert.match(replayBody.error, /reuse detected/i, "Must identify refresh token reuse");

      // Step D: Verify that active token2 was ALSO revoked as a security mitigation!
      const subsequentRefreshRes = await app.inject({
        method: "POST",
        url: "/auth/refresh",
        payload: { refreshToken: token2 }
      });

      assert.equal(
        subsequentRefreshRes.statusCode,
        401,
        "Active session token2 must be revoked following replay detection"
      );
    });

    test("11. Invalid refresh token format and non-existent tokens fail cleanly with 400 or 401", async () => {
      const invalidFormatRes = await app.inject({
        method: "POST",
        url: "/auth/refresh",
        payload: { refreshToken: "invalid-without-colon" }
      });
      assert.equal(invalidFormatRes.statusCode, 400);

      const nonExistentRes = await app.inject({
        method: "POST",
        url: "/auth/refresh",
        payload: { refreshToken: "fake-user-id:fake-random-token-value" }
      });
      assert.equal(nonExistentRes.statusCode, 401);
    });
  });
});
