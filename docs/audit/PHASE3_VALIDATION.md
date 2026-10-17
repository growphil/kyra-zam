# KYRA ZAM 2.0 — Phase 3 Technical Validation & Deep Audit Report

**Document Reference**: `docs/audit/PHASE3_VALIDATION.md`  
**Execution Phase**: Phase 3 — Critical Production Risk Audit  
**Author**: Principal Software Architect & DevOps Lead  
**Repository**: `https://github.com/growphil/kyra-zam.git`  
**Audited Commit**: `5d8f64322191cd9cc4207e077a12463082f04548` (branch: `main`)  
**Status**: Read-only Deep Audit Completed  

---

## 1. Executive Summary

This validation document provides the exhaustive technical evidence, code traces, execution path proofs, and concurrency analyses supporting the findings summarized in `docs/audit/PRODUCTION_RISK_REGISTER.md`.

In strict adherence to the non-negotiable safety rules:
- No application source code was modified during this phase.
- No database migrations, resets, or seed scripts were executed on production.
- AWS production infrastructure was untouched.
- Findings are categorized by whether they were proven through **Static Code Inspection**, **Isolated Database Verification**, or **Execution Path Call-Graph Analysis**.

---

## 2. Critical Security Deep-Dive

### 2.1 Identity Fallback in Authentication & RBAC

#### Architecture Context
The backend relies on `@fastify/jwt` to parse incoming bearer tokens. Once a token is decoded, user identity and roles are verified in two critical middleware hooks:
1. `fastify.decorate("authenticate")` in `backend/src/plugins/auth.ts`
2. `requireRoles(...roles: UserRole[])` in `backend/src/middleware/rbac.ts`

#### Code Evidence & Execution Trace
In `backend/src/plugins/auth.ts` (lines 36–55):
```ts
// Step 1: Look up user by ID, email
let user = await prisma.user.findFirst({
  where: {
    OR: [
      ...(payload.id ? [{ id: payload.id }] : []),
      ...(payload.email ? [{ email: payload.email }] : [])
    ]
  },
  select: { id: true, email: true, roles: true, isActive: true }
});

// Step 2: Fallback query if user was not found by ID or email
if (!user && payload.roles && payload.roles.length > 0) {
  user = await prisma.user.findFirst({
    where: {
      roles: { hasSome: payload.roles as any },
      isActive: true
    },
    select: { id: true, email: true, roles: true, isActive: true }
  });
}
```
In `backend/src/middleware/rbac.ts` (lines 31–40):
```ts
// Fallback: If database was reseeded and ID changed, resolve by role matching to keep session alive permanently
if (!dbUser && userPayload.roles && userPayload.roles.length > 0) {
  dbUser = await prisma.user.findFirst({
    where: {
      roles: { hasSome: userPayload.roles as any },
      isActive: true
    },
    select: { id: true, email: true, roles: true, isActive: true }
  });
}
```

#### Vulnerability Analysis
- **Root Cause**: The comment in `rbac.ts` confirms this was intentionally added during early development so that local database reseeds (which generate random UUIDs) would not invalidate developers' existing browser tokens.
- **Exploit Vector**: If an attacker signs a token with an arbitrary or obsolete `id: "deleted-uuid"` and `roles: ["SUPERADMIN"]`, PostgreSQL returns `null` for Step 1. In Step 2, the backend queries `prisma.user.findFirst({ where: { roles: { hasSome: ["SUPERADMIN"] }, isActive: true } })`. PostgreSQL executes `SELECT * FROM "User" WHERE ... LIMIT 1` and returns the legitimate active Superadmin. The request context `request.user` is overwritten with this Superadmin's real database ID and email. The request proceeds with full administrative authority.
- **Classification**: **Confirmed Critical Vulnerability**.

---

### 2.2 Unauthenticated WebSocket Connections & Wildcard Role Allocation

#### Architecture Context
Fastify registers the WebSocket route `app.get("/ws", { websocket: true })` in `backend/src/server.ts:L119`. Connected clients register with `wsManager` (`backend/src/websocket/manager.ts`), which routes real-time push events to specific users and role groups.

#### Code Evidence & Execution Trace
In `backend/src/server.ts` (lines 126–138):
```ts
let userId = "guest_user";
let userRoles: any[] = [
  "SUPERADMIN", "ADMIN", "INVENTORY_MANAGER", "TEST_ENGINEER", 
  "ASSEMBLY_TECHNICIAN", "SUPERVISOR", "SALES_EXECUTIVE", 
  "ACCOUNTANT", "PURCHASE_MANAGER", "MARKETING_MANAGER"
];

try {
  await request.jwtVerify();
  const user = request.user as unknown as { id: string; roles: any }; 
  if (user) {
    userId = user.id;
    userRoles = Array.isArray(user.roles) ? user.roles : (user.roles ? [user.roles] : userRoles);
  }
} catch (authErr) {
  // Allow connection with default role subscriptions if connecting before auth sync
}

const { wsManager } = require("./websocket/manager");
wsManager.add(userId, userRoles, connection);
```

#### Vulnerability Analysis
- **Root Cause**: A temporary developer convenience allowed browser tabs to connect to WebSockets before authentication state had loaded in React.
- **Exploit Vector**: Any client connecting without a token causes `request.jwtVerify()` to throw an exception. The `catch` block catches the error and executes nothing. The client is assigned `userId = "guest_user"` with **all 10 system roles**. `wsManager.add("guest_user", ["SUPERADMIN", "ADMIN", ...], connection)` adds the socket to every role room.
- **Broadcast Exposure**: Calls such as `wsManager.broadcastToRoles(["ACCOUNTANT"], ...)` or `wsManager.broadcastSales(...)` broadcast confidential financial transactions, invoice creations, and customer orders to this guest connection.
- **Classification**: **Confirmed Critical Vulnerability**.

---

## 3. High Security Deep-Dive

### 3.1 JWT Transmission via URL Query Parameters
- **Evidence**:
  - `backend/src/plugins/auth.ts:L29-32`:
    ```ts
    const queryToken = (request.query as any)?.token;
    if (queryToken) {
      request.headers.authorization = `Bearer ${queryToken}`;
    }
    ```
  - `backend/src/middleware/rbac.ts:L13-16`: same logic.
  - `backend/src/server.ts:L121-124`: same logic.
- **Impact**: Violates RFC 6750 Section 2.3. Query parameters are routinely logged in plaintext in server access logs (ALB, Nginx), CDN caches, browser history, and HTTP `Referer` headers sent to external assets.
- **Classification**: **Confirmed High Risk**.

### 3.2 CORS Origin Reflection with Credentials
- **Evidence**: `backend/src/plugins/cors.ts:L6-9`:
  ```ts
  fastify.register(fastifyCors, {
    origin: true,
    credentials: true,
  });
  ```
- **Impact**: `@fastify/cors` with `origin: true` dynamically sets `Access-Control-Allow-Origin: <Request-Origin>` for any domain. Combined with `credentials: true`, any website visited by an authenticated user can make cross-origin requests to the backend with the user's credentials.
- **Classification**: **Confirmed High Risk**.

### 3.3 Access Token Expiration Mismatch
- **Evidence**:
  - `backend/src/routes/auth.ts:L24`: `fastify.jwt.sign(..., { expiresIn: "365d" })`
  - `backend/src/routes/auth.ts:L89`: `fastify.jwt.sign(..., { expiresIn: "30d" })`
  - `backend/.env`: `JWT_EXPIRY="60m"` and `JWT_REFRESH_EXPIRY="7d"`
- **Impact**: The environment configuration is ignored. Access tokens live for an entire year. Because JWTs are stateless, compromised access tokens cannot be revoked before 365 days elapse.
- **Classification**: **Confirmed High Risk**.

### 3.4 Refresh Token Replay and Lack of Rotation
- **Evidence**: In `backend/src/routes/auth.ts:L55-91`, when `/auth/refresh` receives a valid `${userId}:${rawToken}`, it validates the bcrypt hash against `RefreshToken`, generates a new `accessToken`, but **does NOT update `revokedAt`** and does NOT issue a new refresh token.
- **Impact**: The refresh token remains indefinitely valid for 90 days. A stolen refresh token can be used to repeatedly mint access tokens without invalidating the legitimate user's session or raising alerts.
- **Classification**: **Confirmed Medium/High Risk**.

---

## 4. Database & Runtime Architecture Deep-Dive

### 4.1 Prisma 5.22.0 Compatibility vs `prisma.config.ts`
- **Evidence**:
  - `backend/package.json:L25, L48`: `"@prisma/client": "^5.0.0"`, `"prisma": "^5.0.0"` (pinned to `5.22.0` in `package-lock.json`).
  - `backend/prisma.config.ts`:
    ```ts
    import "dotenv/config";
    import { defineConfig } from "prisma/config";
    export default defineConfig({ ... });
    ```
- **Analysis**: The `prisma/config` entry point does not exist in Prisma 5.22.0 (it was introduced in Prisma v6). While Prisma 5 CLI ignores `prisma.config.ts`, any TypeScript compilation, bundling tool, or test framework that loads the root files will fail with `Cannot find module 'prisma/config'`.
- **Classification**: **Confirmed Defect / Compatibility Risk**.

### 4.2 Prisma Client Generation in Docker Multi-Stage Build
- **Evidence**: `backend/Dockerfile:L20-24`:
  ```dockerfile
  COPY prisma ./prisma/
  COPY prisma.config.ts ./
  RUN npx prisma generate
  ```
  And in Stage 2 (Runner, line 47–51):
  ```dockerfile
  COPY --from=builder /app/node_modules ./node_modules
  COPY --from=builder /app/dist ./dist
  COPY --from=builder /app/package*.json ./
  COPY --from=builder /app/prisma ./prisma
  ```
- **Analysis**: In `schema.prisma:L3`, the client output is configured to `../src/generated/client`.
  - In Stage 1, `npx prisma generate` outputs to `/app/src/generated/client`.
  - In Stage 1, `tsc` compiles `/app/src` into `/app/dist`.
  - In Stage 2, `/app/dist` and `/app/node_modules` are copied.
  - Notice that `/app/src/generated/client` is in `src/`, which is NOT copied into Stage 2! However, the compiled JavaScript output of `/app/src/generated/client` is inside `/app/dist/generated/client`. Because `dist/server.js` requires `./generated/client`, it resolves to `/app/dist/generated/client`, allowing the runner to find the compiled client.
  - If a runtime script (like `seed.ts` via ts-node) is run inside the runner container, it would fail unless `src/generated/client` is also copied.
- **Classification**: **Partially Verified Operational Risk**.

### 4.3 Database Migration Chain & RDS P3018 Resolution
- **Chronological Chain**:
  1. `20260429104211_init`
  2. `20260504052119_fix_user_schema`
  3. `20260825160000_add_enterprise_schema` (86 models, 40 enums)
  4. `20260825165600_add_hardening_indexes` (Indexes on enterprise tables)
  5. `20260825174700_add_work_order_scheduling`
  6. `20260825181400_add_work_order_execution`
- **Clean DB Test Result**:
  - Applied all 6 migrations sequentially on isolated database `kyrazam_fresh_test`.
  - Total tables created: **98**.
  - Total enums created: **44**.
  - `prisma migrate diff --from-schema-datamodel backend/prisma/schema.prisma --to-migrations backend/prisma/migrations --exit-code`: **Returned 0 (Zero Drift)**.
- **RDS Failure Root Cause & Resolution**:
  - In RDS, `20260825165600` was run when only migrations 1 & 2 were applied. It failed because `SalesOrder` did not exist.
  - On RDS, `_prisma_migrations` recorded `20260825165600` as failed.
  - Safe Recovery Command:
    ```bash
    npx prisma migrate resolve --rolled-back "20260825165600_add_hardening_indexes"
    npx prisma migrate deploy
    ```
    This applies `20260825160000_add_enterprise_schema` first, then cleanly executes `20260825165600_add_hardening_indexes` and subsequent migrations.
- **Classification**: **Confirmed Fix Strategy**.

---

## 5. Business Integrity & Concurrency Deep-Dive

### 5.1 Concurrency Pitfall: Why `$transaction` Alone Does Not Prevent Race Conditions

A common architectural misconception is that wrapping database calls in `prisma.$transaction(async (tx) => { ... })` automatically prevents race conditions. Under PostgreSQL's default **Read Committed** isolation level:
1. `tx.material.findUnique(...)` reads the current committed row.
2. If two concurrent transactions read `quantity: 100` simultaneously, both see `100`.
3. If both add 50 and execute `tx.material.update({ data: { quantity: 150 } })`, the second update overwrites the first!
4. The database transaction succeeds, but 50 units of stock are permanently lost.

#### Case 1: Insecure Concurrent Update in Cell Service
In `backend/src/services/cell.service.ts:L58-65`:
```ts
material = await tx.material.update({
  where: { id: material.id },
  data: {
    quantity: material.quantity + validated.quantity, // INSECURE MEMORY ADDITION
    lastRestock: new Date()
  }
});
```
- **Remediation**: Use Prisma's database-level atomic operation:
  ```ts
  data: {
    quantity: { increment: validated.quantity },
    lastRestock: new Date()
  }
  ```

#### Case 2: Secure Row-Level Locking in Dispatch Orders
In `backend/src/routes/dispatch.ts:L198-201`:
```ts
// SECURE ROW-LEVEL LOCK
await tx.$executeRawUnsafe(
  `SELECT * FROM "PaxPack" WHERE "paxSerial" = $1 FOR UPDATE`,
  assignedSerial
);
```
- Here the developer correctly acquired an exclusive lock on the `PaxPack` row before verifying its reservation status, preventing double reservation.
- **Contrast**: `dispatch.ts` demonstrates proper concurrency control; `cell.service.ts` and `quality.ts` lack it.

### 5.2 Sequential Document Number Generation Race Condition
- **Evidence**: `backend/src/routes/sales.ts:L18-22`:
  ```ts
  while (true) {
    const candidate = `SO-${String(next).padStart(6, '0')}`;
    const exists = await prisma.salesOrder.findFirst({ where: { salesOrderNumber: candidate } });
    if (!exists) return candidate;
    next++;
  }
  ```
- **Failure Mode**: When two sales orders are created concurrently:
  - Request A checks if `SO-000015` exists -> Returns false.
  - Request B checks if `SO-000015` exists -> Returns false.
  - Both return `candidate = "SO-000015"`.
  - Both call `tx.salesOrder.create({ data: { salesOrderNumber: "SO-000015", ... } })`.
  - One transaction commits; the other crashes with PostgreSQL unique constraint violation `P2002`.
- **Classification**: **Confirmed High Risk**.

### 5.3 Financial Clearance Enforcement Before Dispatch
- **Evidence**: `backend/src/routes/dispatch.ts:L123-125`:
  ```ts
  if (!salesOrder.isFinancialCleared) {
    throw new Error("Cannot create Dispatch Order: Sales Order is not financially cleared.");
  }
  ```
- **Validation**:
  - The check is strictly enforced inside the database transaction.
  - A dispatch order cannot be drafted, picked, or shipped without financial clearance.
  - In `backend/src/routes/finance.ts`, only `ACCOUNTANT`, `ADMIN`, or `SUPERADMIN` roles can set `isFinancialCleared: true`.
  - If payments are cancelled in `finance.ts:L135`, `isFinancialCleared` is automatically revoked.
- **Classification**: **Verified Business Rule Enforcement**.

### 5.4 Battery Pack Warranty Activation Prerequisites
- **Evidence**: `backend/src/routes/warranty.ts:L101-131`:
  1. Acquires row lock: `SELECT * FROM "PaxPack" WHERE "paxSerial" = $1 FOR UPDATE`.
  2. Verifies `dispatchItem.dispatchOrder.status === "DELIVERED"`.
  3. Verifies `pack.status === "SOLD_TO_CUSTOMER"`.
  4. Validates customer ownership matching sales order.
  5. Prevents duplicate active warranties for the same pack serial.
  6. Writes structured `AuditLog` entry.
- **Classification**: **Verified Business Rule Enforcement**.

---

## 6. Operational & Build Verification

### 6.1 Frontend Error Suppression Masking Build Issues
- **Evidence**: `frontend/next.config.ts:L5-10`:
  ```ts
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true }
  ```
- **Verification**: Next.js build suppresses all TypeScript compile errors. This allows broken type contracts, missing module exports, and invalid prop types to pass silently during Vercel deployment.
- **Classification**: **Confirmed Defect**.

### 6.2 Missing Queue Worker Entry Point
- **Evidence**: `backend/package.json:L14`: `"worker": "ts-node src/queues/worker.ts"`.
- **Verification**: Directory `backend/src/queues` does not exist on disk. Running `npm run worker` immediately crashes with `MODULE_NOT_FOUND`.
- **Classification**: **Confirmed Defect**.

---

## 7. Phase 3 Audit Summary Table

| Finding ID | Domain | Severity | Verification Method | Impact |
|---|---|---|---|---|
| **RISK-CRIT-01** | Security / Auth | **CRITICAL** | Static Code Inspection | Privilege escalation / Superadmin hijacking via fallback |
| **RISK-CRIT-02** | Security / WS | **CRITICAL** | Static Code Inspection | Unauthenticated clients granted 10 system roles in `/ws` |
| **RISK-CRIT-03** | Database / Deploy | **CRITICAL** | Isolated DB Testing & History Trace | RDS migration blockage due to failed `20260825165600` entry |
| **RISK-HIGH-01** | Security / CORS | **HIGH** | Static Code Inspection | Origin reflection + credentials permits cross-origin theft |
| **RISK-HIGH-02** | Security / Auth | **HIGH** | Static Code Inspection | Tokens in URL query strings leak into proxy and web server logs |
| **RISK-HIGH-03** | Security / Auth | **HIGH** | Static Code Inspection | Hardcoded 365-day access token ignores 60m environment expiry |
| **RISK-HIGH-04** | Inventory / Concurrency | **HIGH** | Call-Graph & Code Inspection | Non-atomic `material.quantity` update causes lost stock updates |
| **RISK-HIGH-05** | Integrity / Concurrency | **HIGH** | Call-Graph & Code Inspection | Sequential number loop produces `P2002` duplicate key crashes |
| **RISK-HIGH-06** | Frontend / Build | **HIGH** | Static Code Inspection | `next.config.ts` suppresses TS and lint errors during build |
| **RISK-HIGH-07** | Database / Tooling | **HIGH** | Static Code Inspection | `prisma.config.ts` imports Prisma 6 module in Prisma 5 project |
| **RISK-MED-01** | Security / Auth | **MEDIUM** | Static Code Inspection | Refresh tokens are not rotated on `/auth/refresh` |
| **RISK-MED-02** | Operations / Runtime | **MEDIUM** | Filesystem Verification | `npm run worker` references non-existent `src/queues/worker.ts` |
| **RISK-MED-03** | QA / Reliability | **MEDIUM** | Package Manifest Inspection | Zero automated test frameworks configured in repository |
| **RISK-MED-04** | Quality / Concurrency | **MEDIUM** | Static Code Inspection | QC decision update lacks row-level lock |
| **RISK-LOW-01** | Infrastructure | **LOW** | Static Code Inspection | In-memory rate limiting not shared across multiple containers |
| **RISK-LOW-02** | Security / Config | **LOW** | Static Code Inspection | Static fallback secret in `auth.ts` if `JWT_SECRET` missing |

---

## 8. Phase 3 Sign-Off

The technical validation for Phase 3 is complete. All findings are categorized, verified against source code, and tied to exact remediation steps.

Deliverables generated:
- `docs/audit/PRODUCTION_RISK_REGISTER.md`
- `docs/audit/PHASE3_VALIDATION.md`

Ready for Phase 4 (Baseline Testing) upon user confirmation.
