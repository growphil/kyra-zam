# KYRA ZAM 2.0 — Release Security Blocker & Remediation Report

**Document Reference**: `docs/audit/RELEASE_SECURITY_BLOCKER.md`  
**Execution Date**: October 17, 2026  
**Status**: VERIFIED & RESOLVED  
**Audited Commit Base**: `9cb1e2b2bb57d4984b37a5e4056e1c8b62f5a6c8` (branch: `main`)  
**Components Evaluated**: `backend/src/plugins/auth.ts`, `backend/src/middleware/rbac.ts`, `backend/src/server.ts`, `frontend/src/components/providers/RealtimeProvider.tsx`  

---

## 1. Executive Summary & Root Cause Analysis

### 1.1 The Blocker
During deployment inspection on the AWS EC2 production instance (running commit `9cb1e2b`), three critical security vulnerabilities were discovered in the active codebase:
1. **User Identity Substitution & Fallback**: In `auth.ts` and `rbac.ts`, user authentication queried PostgreSQL using `findFirst` with `OR: [id, email]`, accompanied by the comments:
   - `// Look up user by ID, email, or role fallback`
   - `// Look up user by ID first, or fallback to email (so reseeding doesn't invalidate active user sessions)`
   If a client presented a JWT with an altered, deleted, or forged user ID, the application attempted to match and substitute an account by email, directly violating the principle of strict immutable identity.
2. **Internal Error Leakage**: Both `authPlugin` and `requireRoles` returned `{ error: "Unauthorized", details: err.message }` to clients, leaking internal Fastify JWT library verification errors and stack traces.
3. **WebSocket Handshake Leniency**: When an unauthenticated connection arrived on `/ws`, invalid handshake tokens were silently caught, allowing the socket to remain open.

### 1.2 Root Cause in Git History
Inspection of Git history across commits `5e098f4`, `54735e8`, and `9cb1e2b` revealed why these patterns persisted:
- **Commit `5e098f4` (Initial Setup)** introduced permissive identity fallback queries (`prisma.user.findFirst` with `OR: [id, email]`) and fallback role queries (`prisma.user.findFirst({ where: { roles: { hasSome: payload.roles } } })`).
- **Commit `54735e8` ("update")** removed only the role-matching fallback queries (`where: { roles: { hasSome: ... } }`), but inadvertently retained the `findFirst` with `OR: [payload.id, payload.email]` lookups in both `auth.ts` and `rbac.ts`, as well as `details: err.message` client leaks.
- **Commit `9cb1e2b` ("chore(deploy)")** addressed build configuration (`prisma.config.ts`, Dockerfile, package.json), but did not modify `auth.ts`, `rbac.ts`, or `server.ts`.

---

## 2. Security Remediations Applied

### 2.1 `backend/src/plugins/auth.ts`
- **Replaced Permissive Fallback with Strict Primary Key Lookup**:
  ```typescript
  if (!payload?.id) {
    return reply.status(401).send({ error: "Unauthorized", message: "Invalid user token" });
  }

  // Strictly look up user by immutable primary key ID - never substitute by email or role
  const user = await prisma.user.findUnique({
    where: { id: payload.id },
    select: { id: true, email: true, roles: true, isActive: true }
  });

  if (!user) {
    return reply.status(401).send({ error: "Unauthorized", message: "User not found" });
  }

  if (!user.isActive) {
    return reply.status(403).send({ error: "Forbidden", message: "Account deactivated" });
  }

  // Authoritative identity and permissions derived directly from current database roles
  request.user = { id: user.id, email: user.email, roles: user.roles as any } as any;
  ```
- **Eliminated Information Leakage**:
  Replaced `{ error: "Unauthorized", details: err.message }` with a generic, sanitized response:
  ```typescript
  return reply.status(401).send({ error: "Unauthorized", message: "Invalid or expired token" });
  ```
- **Preserved Production Secret Enforcement**:
  Retained startup validation ensuring `JWT_SECRET` is defined, >= 32 characters, and not the fallback default when `NODE_ENV === "production"`.

### 2.2 `backend/src/middleware/rbac.ts`
- **Replaced Permissive Fallback with Strict Primary Key Lookup**:
  Enforced `prisma.user.findUnique({ where: { id: userPayload.id } })`. Removed all email matching and identity substitution paths.
- **Authoritative Database Roles**:
  `request.user` is overwritten with active database records, and `hasPermission` is evaluated strictly against `dbUser.roles`, ensuring forged role claims inside JWTs are completely ignored.
- **Eliminated Information Leakage**:
  Replaced `{ error: "Unauthorized", details: err.message }` with `{ error: "Unauthorized", message: "Invalid or expired token" }`.

### 2.3 `backend/src/server.ts`
- **Immediate Fail-Closed on Invalid Handshake Tokens**:
  When a handshake token is supplied via `Authorization: Bearer <token>` or `Sec-WebSocket-Protocol`, any JWT verification failure or missing/inactive database user immediately closes the socket with close code `1008` (Policy Violation):
  ```typescript
  connection.socket.send(JSON.stringify({
    event: "error",
    data: { message: "Invalid or expired authentication token" }
  }));
  connection.socket.close(1008, "Authentication required");
  return;
  ```
- **Zero Privileges for Unauthenticated Sockets**:
  `wsManager.add` is never called before database identity verification succeeds. Unauthenticated clients receive no event broadcasts and cannot invoke heartbeat pongs.

### 2.4 `frontend/src/components/providers/RealtimeProvider.tsx`
- **Handshake Protocol Support**:
  Updated the WebSocket constructor to pass `Sec-WebSocket-Protocol` (`["bearer", token]`) during the initial HTTP handshake, allowing browser clients to authenticate immediately on connect.

---

## 3. Test & Verification Evidence

### 3.1 Automated Test Execution
- **Command**: `npm test` (running `node -r ts-node/register --test src/__tests__/*.test.ts`)
- **Exit Code**: `0` (Zero test failures)
- **Execution Log**:
  ```text
  ▶ Batch B — Authentication Hardening (CORS, Query Tokens, Expiry, Rotation)
    ▶ B1: CORS Origin Whitelisting
      ✔ 1. Approved origin (localhost:3000) receives CORS allow headers with credentials
      ✔ 2. Untrusted origin (https://evil-attacker.com) is NOT reflected in Access-Control-Allow-Origin
      ✔ 3. Preflight OPTIONS for untrusted origin does not receive CORS allow headers
      ✔ 4. Request without Origin header (server-to-server / curl) succeeds without CORS error
    ✔ B1: CORS Origin Whitelisting (13.4ms)
    ▶ B2: JWT Transport Hardening
      ✔ 5. fastify.authenticate rejects token passed exclusively via ?token= query parameter
      ✔ 6. requireRoles rejects token passed exclusively via ?token= query parameter
      ✔ 7. Legitimate request with Authorization: Bearer header succeeds
    ✔ B2: JWT Transport Hardening (6.8ms)
    ▶ B3: Token Expiry Alignment
      ✔ 8. Login access token expires in 60m (3600s), NOT 365 days
    ✔ B3: Token Expiry Alignment (152.4ms)
    ▶ B4: Refresh Token Rotation & Replay Rejection
      ✔ 9. Successful refresh rotates token and returns new token pair
      ✔ 10. Replaying an already-used refresh token triggers replay detection and revokes all sessions
      ✔ 11. Invalid refresh token format and non-existent tokens fail cleanly with 400 or 401
    ✔ B4: Refresh Token Rotation & Replay Rejection (1003.7ms)
  ✔ Batch B — Authentication Hardening (CORS, Query Tokens, Expiry, Rotation) (1264.9ms)

  ▶ Batch A — Critical Security & Identity Verification
    ✔ 1. Legitimate active Superadmin can access protected routes (27.6ms)
    ✔ 2. Legitimate user without required role receives 403 Forbidden (3.9ms)
    ✔ 3. Deactivated user token is rejected with 401 or 403 (3.6ms)
    ✔ 4. VULNERABILITY REPRODUCTION (RISK-CRIT-01): Token with non-existent user ID must be rejected with 401 (3.5ms)
    ✔ 5. VULNERABILITY REPRODUCTION (RISK-CRIT-02): Unauthenticated clients in WebSocket manager must not have privileged roles (0.4ms)
    ✔ 6. Authorization is derived from database roles, not client-provided role claims (3.4ms)
    ✔ 7. WebSocket handshake rejects unauthenticated connections with policy violation (0.5ms)
    ✔ 8. WebSocket handshake derives roles strictly from DB user records (2.4ms)
  ✔ Batch A — Critical Security & Identity Verification (144.2ms)

  ℹ tests 19
  ℹ suites 6
  ℹ pass 19
  ℹ fail 0
  ```

### 3.2 Compilation & Git Syntax Checks
- **TypeScript Compilation**: `npm run build` in `backend/` -> **Exit Code 0** (Zero errors).
- **Git Whitespace & Formatting**: `git diff --check` -> **Exit Code 0** (Zero trailing whitespace or carriage return issues).
- **Python Sidecar Syntax**: `python -m py_compile main.py processor.py qc_rules.py` -> **Exit Code 0**.

---

## 4. Component Separation & Deployment Independence

The architecture strictly preserves separation of concerns across components:
- **Backend (Fastify Node.js)**: Runs independently on EC2 port 8000.
- **Python Sidecar (FastAPI)**: Runs in isolated container on internal port 8001 (`127.0.0.1:8001`).
- **Frontend (Next.js)**: Independently built and deployed to Vercel.
- **RDS PostgreSQL & Redis**: Managed database and cache layers untouched.
