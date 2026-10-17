# KYRA ZAM 2.0 — Phase 6, Batch B: Authentication Hardening Results

## Executive Summary

Phase 6, Batch B (**Authentication Hardening**) has been successfully implemented, verified, and regression-tested. All 19 automated backend tests (8 in Batch A + 11 in Batch B) are passing with 100% success rate. The backend compiles cleanly (`tsc` exit code 0) and `git diff --check` passes with zero whitespace or formatting errors. No production infrastructure was modified, no database migrations or seeds were run against RDS, and no secrets have been exposed.

---

## 1. Implementation Detail by Requirement

### B1 — CORS Hardening
- **Root Cause Addressed**: `backend/src/plugins/cors.ts` previously configured `@fastify/cors` with `origin: true` and `credentials: true`. This dynamically reflected any incoming `Origin` header in `Access-Control-Allow-Origin`, permitting malicious third-party websites to execute credentialed cross-origin requests against the API on behalf of authenticated users (RISK-HIGH-01).
- **Implementation**:
  - Replaced permissive `origin: true` reflection with an explicit, configurable allowlist loaded via helper functions `getApprovedOrigins()` and `isOriginAllowed()`.
  - Configured allowlist parses comma-separated environment variables: `CORS_ORIGIN`, `FRONTEND_URL`, and `CORS_ALLOWED_ORIGINS`.
  - Default development origins (`http://localhost:3000`, `http://127.0.0.1:3000`, `http://localhost:8000`, `http://127.0.0.1:8000`) are supported for local developer workflows.
  - In non-production environments (`NODE_ENV !== "production"`), local LAN IPs (`192.168.x.x`, `10.x.x.x`, `172.16-31.x.x`) and VS Code Dev Tunnels (`*.devtunnels.ms`) are dynamically validated without opening access to external domains.
  - When an unapproved origin attempts a request, `@fastify/cors` invokes `cb(null, false)`, omitting all `Access-Control-Allow-*` headers so the browser enforces the same-origin policy.
  - Non-browser or same-origin requests (lacking an `Origin` header) continue to succeed.
  - No fictitious production domain names were hardcoded.

### B2 — JWT Transport Hardening
- **Root Cause Addressed**: JWTs were accepted via URL query parameters (`?token=...`) across authentication plugins, RBAC middleware, WebSocket handshakes, and PDF download links. Query parameter tokens are routinely leaked into HTTP access logs, proxy logs (Nginx/CloudFront/ALB), browser history, and HTTP `Referer` headers (RISK-HIGH-02).
- **Implementation**:
  - `backend/src/plugins/auth.ts`: Removed `(request.query as any)?.token` extraction.
  - `backend/src/middleware/rbac.ts`: Removed `(request.query as any)?.token` extraction.
  - `backend/src/server.ts`: Removed `queryToken` from `/ws` WebSocket endpoint. Supported handshake authentication via `Authorization: Bearer <token>` or `Sec-WebSocket-Protocol` (`["bearer", token]`), as well as in-band authentication message `{ type: "auth", token }` within 5 seconds of connection. Unauthenticated connections are rejected with WebSocket close code `1008`.
  - `frontend/src/components/providers/RealtimeProvider.tsx`: Updated WebSocket connection from `${wsBase}/ws?token=${token}` to clean `${wsBase}/ws` and sends in-band authentication payload on connection open.
  - `frontend/src/lib/api.ts`: Added `downloadAuthenticatedFile(urlPath, filename)` helper that requests documents using standard Axios `Authorization: Bearer <token>` headers and triggers a browser blob download.
  - Replaced URL query-parameter PDF links (`.../pdf?token=...`) in:
    - `frontend/src/app/[role]/sales/quotations/[id]/page.tsx`
    - `frontend/src/app/[role]/sales/quotations/page.tsx`
    - `frontend/src/app/[role]/finance/invoices/[id]/page.tsx`
    - `frontend/src/app/[role]/finance/invoices/page.tsx`

### B3 — Token Expiry Alignment & Secret Enforcement
- **Root Cause Addressed**: Access tokens issued in `backend/src/routes/auth.ts` previously hardcoded `expiresIn: "365d"` on login and `expiresIn: "30d"` on refresh, ignoring `JWT_EXPIRY="60m"` defined in `.env` (RISK-HIGH-03). In production, missing or weak JWT secrets were silently defaulted.
- **Implementation**:
  - `backend/src/plugins/auth.ts`: Configured `fastifyJwt` with validated secret and default `sign: { expiresIn: process.env.JWT_EXPIRY || "60m" }`.
  - Added fail-fast validation in `authPlugin`: If `NODE_ENV === "production"`, server startup throws an error if `JWT_SECRET` is missing, matches the insecure default, or is less than 32 characters.
  - `backend/src/routes/auth.ts`: Both `/auth/login` and `/auth/refresh` now issue access tokens with `process.env.JWT_EXPIRY || "60m"`.

### B4 — Refresh-Token Rotation & Replay Detection
- **Root Cause Addressed**: The existing `/auth/refresh` endpoint generated fresh access tokens without updating `revokedAt` on the matching `RefreshToken` row in PostgreSQL and without issuing a new refresh token. Captured refresh tokens could be reused indefinitely for 90 days (RISK-MED-01).
- **Implementation**:
  - Inspected existing schema: `model RefreshToken` already provides `id`, `tokenHash`, `userId`, `expiresAt`, `revokedAt: DateTime?`, and `createdAt`. **Zero database migrations or schema alterations were required.**
  - Configured refresh token lifetime to follow `process.env.JWT_REFRESH_EXPIRY || "7d"`.
  - Single-use token rotation: When `/auth/refresh` is called with a valid active token, it immediately sets `revokedAt: new Date()` on that record, generates a cryptographically random new refresh token, saves its bcrypt hash in PostgreSQL, and returns `{ accessToken: newAccessToken, refreshToken: newCompositeToken }`.
  - Replay / Reuse Detection: If an incoming token does not match active tokens, `/auth/refresh` checks recent revoked tokens for that user. If a match is found with a revoked token (indicating an adversary or compromised client attempting to reuse an already-refreshed token), all active refresh tokens for that user are immediately invalidated (`revokedAt: new Date()`) and HTTP 401 is returned.
  - `frontend/src/app/login/page.tsx`: Updated to persist `refreshToken` in `localStorage` alongside `token`.
  - `frontend/src/lib/api.ts`: Added an Axios response interceptor that intercepts 401 Unauthorized responses, queues concurrent requests via an in-flight promise mutex, calls `/auth/refresh`, updates tokens in `localStorage`, and replays failed requests seamlessly.

---

## 2. Test Verification & Execution Records

### Test Suite Execution
- **Environment**: Local PostgreSQL test database (`postgresql://postgres:12345@localhost:5432/kyrazam_fresh_test`).
- **Command**:
  ```powershell
  $env:DATABASE_URL="postgresql://postgres:12345@localhost:5432/kyrazam_fresh_test"; npm test
  ```
- **Exit Code**: `0`
- **Duration**: 5.29s
- **Results**: **19 tests passing across 6 test suites, 0 failing, 0 skipped**.

#### Test Breakdown
```text
▶ Batch B — Authentication Hardening (CORS, Query Tokens, Expiry, Rotation)
  ▶ B1: CORS Origin Whitelisting
    ✔ 1. Approved origin (localhost:3000) receives CORS allow headers with credentials (10.9ms)
    ✔ 2. Untrusted origin (https://evil-attacker.com) is NOT reflected in Access-Control-Allow-Origin (1.1ms)
    ✔ 3. Preflight OPTIONS for untrusted origin does not receive CORS allow headers (0.8ms)
    ✔ 4. Request without Origin header (server-to-server / curl) succeeds without CORS error (0.6ms)
  ✔ B1: CORS Origin Whitelisting (14.5ms)
  ▶ B2: JWT Transport Hardening
    ✔ 5. fastify.authenticate rejects token passed exclusively via ?token= query parameter (2.0ms)
    ✔ 6. requireRoles rejects token passed exclusively via ?token= query parameter (1.1ms)
    ✔ 7. Legitimate request with Authorization: Bearer header succeeds (6.0ms)
  ✔ B2: JWT Transport Hardening (9.6ms)
  ▶ B3: Token Expiry Alignment
    ✔ 8. Login access token expires in 60m (3600s), NOT 365 days (31536000s) (175.3ms)
  ✔ B3: Token Expiry Alignment (175.8ms)
  ▶ B4: Refresh Token Rotation & Replay Rejection
    ✔ 9. Successful refresh rotates token and returns new token pair (647.8ms)
    ✔ 10. Replaying an already-used refresh token triggers replay detection and revokes all sessions (828.0ms)
    ✔ 11. Invalid refresh token format and non-existent tokens fail cleanly with 400 or 401 (7.2ms)
  ✔ B4: Refresh Token Rotation & Replay Rejection (1483.5ms)
✔ Batch B — Authentication Hardening (CORS, Query Tokens, Expiry, Rotation) (1777.9ms)

▶ Batch A — Critical Security & Identity Verification
  ✔ 1. Legitimate active Superadmin can access protected routes (16.2ms)
  ✔ 2. Legitimate user without required role receives 403 Forbidden (3.3ms)
  ✔ 3. Deactivated user token is rejected with 401 or 403 (2.7ms)
  ✔ 4. VULNERABILITY REPRODUCTION (RISK-CRIT-01): Token with non-existent user ID must be rejected with 401 (2.3ms)
  ✔ 5. VULNERABILITY REPRODUCTION (RISK-CRIT-02): Unauthenticated clients in WebSocket manager must not have privileged roles (0.9ms)
  ✔ 6. Authorization is derived from database roles, not client-provided role claims (3.5ms)
  ✔ 7. WebSocket handshake rejects unauthenticated connections with policy violation (0.4ms)
  ✔ 8. WebSocket handshake derives roles strictly from DB user records (1.9ms)
✔ Batch A — Critical Security & Identity Verification (230.6ms)

ℹ tests 19
ℹ suites 6
ℹ pass 19
ℹ fail 0
```

### TypeScript Compilation
- **Command**: `npm run build` in `backend/`
- **Exit Code**: `0` (Zero compiler errors).

### Git Diff & Formatting Check
- **Command**: `git diff --check`
- **Exit Code**: `0` (Zero trailing whitespace, zero formatting violations).

---

## 3. Modified Files Summary

| File | Sub-batch | Changes |
| :--- | :--- | :--- |
| `backend/src/plugins/cors.ts` | B1 | Replaced `origin: true` with configurable allowlist (`CORS_ORIGIN`, `FRONTEND_URL`, LAN IPs/devtunnels in dev). |
| `backend/src/plugins/auth.ts` | B2, B3 | Removed query parameter token extraction; enforced production `JWT_SECRET` validation; applied `JWT_EXPIRY` default (60m). |
| `backend/src/middleware/rbac.ts` | B2 | Removed query parameter token extraction; enforces `Authorization: Bearer <token>`. |
| `backend/src/server.ts` | B2 | Removed query token from `/ws`; added handshake & in-band WebSocket authentication. |
| `backend/src/routes/auth.ts` | B3, B4 | Set login/refresh access token lifetime to 60m; implemented single-use refresh token rotation and replay detection. |
| `backend/src/__tests__/helpers/buildTestApp.ts` | Tests | Registered `corsPlugin` and `authRoutes` for automated testing. |
| `backend/src/__tests__/auth-hardening.test.ts` | Tests | 11 automated regression tests covering B1, B2, B3, and B4. |
| `frontend/src/components/providers/RealtimeProvider.tsx` | B2 | Cleaned WebSocket URL (`/ws`); added in-band authentication message on connection open. |
| `frontend/src/lib/api.ts` | B2, B3, B4 | Added `downloadAuthenticatedFile` helper and Axios 401 response interceptor with refresh queue. |
| `frontend/src/app/login/page.tsx` | B4 | Stored `refreshToken` in `localStorage` upon login. |
| `frontend/src/app/[role]/sales/quotations/[id]/page.tsx` | B2 | Switched PDF download to `downloadAuthenticatedFile` (no query tokens). |
| `frontend/src/app/[role]/sales/quotations/page.tsx` | B2 | Switched PDF download to `downloadAuthenticatedFile` (no query tokens). |
| `frontend/src/app/[role]/finance/invoices/[id]/page.tsx` | B2 | Switched PDF download to `downloadAuthenticatedFile` (no query tokens). |
| `frontend/src/app/[role]/finance/invoices/page.tsx` | B2 | Switched PDF download to `downloadAuthenticatedFile` (no query tokens). |

---

## 4. Limitations and Blockers

1. **Concurrent Refresh Race Protection**:
   - In single-use refresh token rotation, if a client fires multiple simultaneous requests that expire at the same instant, racing refresh calls could submit an already-rotated token.
   - **Resolution Applied**: Implemented an in-flight request queue in `frontend/src/lib/api.ts` (`isRefreshing` flag + `failedQueue`) so all concurrent 401s share a single refresh network request.
2. **Database Schema Integrity**:
   - No schema changes or Prisma migrations were required. The existing `RefreshToken` model had all necessary attributes (`revokedAt`, `expiresAt`, `tokenHash`, `userId`).
3. **Strict Boundaries Preserved**:
   - No production RDS database was contacted or modified.
   - No changes to AWS infrastructure or EC2 instance.
   - No git push or deployment executed.
   - Batch C, D, and F remain deferred until approval.
