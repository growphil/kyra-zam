# KYRA ZAM 2.0 — Production Deployment Report

**Execution Date**: October 17, 2026  
**Infrastructure Target**: AWS EC2 (Mumbai region / `ap-south-1`), AWS RDS PostgreSQL (`kyrazam`), Vercel (Frontend)  
**Document Location**: `docs/deployment/DEPLOYMENT_REPORT.md`  

---

## 1. Executive Summary & Deployment Status

- **Deployment Phase Reached**: **Phase 1 Verified & Pushed to GitHub — Ready for EC2 Pull**
- **Approved Remote Release Commit on GitHub**: `54735e8` (*"update"*)
- **Local Working Tree State**: Prepared for GitHub Desktop commit (Reliability cleanup + Full Documentation)
- **Component Test & Build Status**:
  - Backend Automated Test Suite: **19 / 19 PASS (100%)**
  - Backend TypeScript Build (`tsc`): **PASS (Exit Code 0)**
  - Frontend Next.js Production Build (`next build`): **PASS (Exit Code 0)**
  - Python Sidecar Compilation (`py_compile`): **PASS (Exit Code 0)**

---

## 2. Phase 1 — Verification Results

### 2.1 Git Status & Commit Inspection
- **Branch**: `main` (tracking `origin/main`)
- **Active Release Commit on GitHub**: `54735e8`
- **Verified Scope in Release**:
  - Batch A Critical Security (Identity fallback removed, WebSocket roles restricted)
  - Batch B Authentication Hardening (Strict CORS allowlist, query tokens removed, 60m expiry, refresh rotation & replay detection)
  - 19 Automated Tests (`backend/src/__tests__/`)
  - Authenticated Blob Download & in-band WebSocket protocols
  - Reliability cleanup: Removed `prisma.config.ts`, pruned defunct `worker` script, updated `backend/Dockerfile`
  - Authenticated blob download and in-band WebSocket protocols
  - Deployment & Audit reports
  - **Backend**:
    - `backend/package.json`: Added `npm test` script.
    - `backend/src/middleware/rbac.ts`: Removed query parameter token fallback; enforce `Authorization: Bearer <token>`.
    - `backend/src/plugins/auth.ts`: Removed query parameter token bypass; enforce production `JWT_SECRET` (>= 32 chars).
    - `backend/src/plugins/cors.ts`: Replaced open `origin: true` with strict whitelist (`CORS_ORIGIN`, `FRONTEND_URL`, LAN IPs in dev).
    - `backend/src/routes/auth.ts`: Set 60m access token expiry; implemented single-use refresh token rotation with replay detection.
    - `backend/src/server.ts`: Hardened WebSocket `/ws` against unauthenticated access and role spoofing; required in-band handshake or Bearer header.
    - `backend/src/__tests__/`: 19 automated tests validating CORS, JWT query tokens, refresh rotation, and RBAC rules.
  - **Frontend**:
    - `frontend/src/app/[role]/finance/invoices/[id]/page.tsx`: Replaced `?token=` query URL with authenticated blob download.
    - `frontend/src/app/[role]/finance/invoices/page.tsx`: Replaced `?token=` query URL with authenticated blob download.
    - `frontend/src/app/[role]/sales/quotations/[id]/page.tsx`: Replaced `?token=` query URL with authenticated blob download.
    - `frontend/src/app/[role]/sales/quotations/page.tsx`: Replaced `?token=` query URL with authenticated blob download.
    - `frontend/src/app/login/page.tsx`: Saved `refreshToken` to local storage on login.
    - `frontend/src/components/providers/RealtimeProvider.tsx`: Sent authenticated handshake via in-band WebSocket protocol.
    - `frontend/src/lib/api.ts`: Added Axios 401 refresh token interceptor with concurrent queueing; added `downloadAuthenticatedFile` utility.

### 2.2 Test & Build Execution Records

#### A. Backend Unit & Security Tests
- **Command**: `npm test` (running `node -r ts-node/register --test src/__tests__/*.test.ts`)
- **Exit Code**: `0`
- **Result Summary**:
  ```text
  ▶ Batch B — Authentication Hardening (CORS, Query Tokens, Expiry, Rotation)
    ▶ B1: CORS Origin Whitelisting
      ✔ 1. Approved origin (localhost:3000) receives CORS allow headers with credentials
      ✔ 2. Untrusted origin (https://evil-attacker.com) is NOT reflected in Access-Control-Allow-Origin
      ✔ 3. Preflight OPTIONS for untrusted origin does not receive CORS allow headers
      ✔ 4. Request without Origin header (server-to-server / curl) succeeds without CORS error
    ✔ B1: CORS Origin Whitelisting (1059ms)
    ▶ B2: JWT Transport Hardening
      ✔ 5. fastify.authenticate rejects token passed exclusively via ?token= query parameter
      ✔ 6. requireRoles rejects token passed exclusively via ?token= query parameter
      ✔ 7. Legitimate request with Authorization: Bearer header succeeds
    ✔ B2: JWT Transport Hardening (313ms)
    ▶ B3: Token Expiry Alignment
      ✔ 8. Login access token expires in 60m (3600s), NOT 365 days (31536000s)
    ✔ B3: Token Expiry Alignment (354ms)
    ▶ B4: Refresh Token Rotation & Replay Rejection
      ✔ 9. Successful refresh rotates token and returns new token pair
      ✔ 10. Replaying an already-used refresh token triggers replay detection and revokes all sessions
      ✔ 11. Invalid refresh token format and non-existent tokens fail cleanly with 400 or 401
    ✔ B4: Refresh Token Rotation & Replay Rejection (1258ms)
  ✔ Batch B — Authentication Hardening (CORS, Query Tokens, Expiry, Rotation) (3424ms)
  ▶ Batch A — Critical Security & Identity Verification
    ✔ 1. Legitimate active Superadmin can access protected routes
    ✔ 2. Legitimate user without required role receives 403 Forbidden
    ✔ 3. Deactivated user token is rejected with 401 or 403
    ✔ 4. VULNERABILITY REPRODUCTION (RISK-CRIT-01): Token with non-existent user ID must be rejected with 401
    ✔ 5. VULNERABILITY REPRODUCTION (RISK-CRIT-02): Unauthenticated clients in WebSocket manager must not have privileged roles
    ✔ 6. Authorization is derived from database roles, not client-provided role claims
    ✔ 7. WebSocket handshake rejects unauthenticated connections with policy violation
    ✔ 8. WebSocket handshake derives roles strictly from DB user records
  ✔ Batch A — Critical Security & Identity Verification (1627ms)
  ℹ tests 19
  ℹ suites 6
  ℹ pass 19
  ℹ fail 0
  ```

#### B. Backend Production Compilation
- **Command**: `npm run build` (`tsc`) in `backend/`
- **Exit Code**: `0`
- **Result**: Zero TypeScript compilation errors.

#### C. Frontend Production Build
- **Command**: `npm run build` (`next build`) in `frontend/`
- **Exit Code**: `0`
- **Result**: Successfully compiled all 12 static/dynamic routes and API endpoints, generating optimized bundles.

#### D. Python Sidecar Verification
- **Command**: `python -m py_compile main.py processor.py qc_rules.py` in `sidecar/`
- **Exit Code**: `0`
- **Result**: All Python files syntax-valid and ready for execution.

---

## 3. Deployment Discovery & Architecture Mapping

| Component | Target Environment | Host / Port | Exposure / Security Bound | Startup & Configuration |
|---|---|---|---|---|
| **Frontend** | Vercel | HTTPS / Public | Publicly accessible via CDN | Next.js App Router, configured with `NEXT_PUBLIC_API_URL` pointing to backend |
| **Backend** | EC2 Ubuntu (Mumbai) | Port 8000 | Reverse proxy / Direct | Fastify HTTP + WebSocket, reads `.env.production`, depends on healthy Redis & Sidecar |
| **Python Sidecar** | EC2 Docker Container | Port 8001 | **Private only** (`127.0.0.1:8001:8001`) | FastAPI Uvicorn, healthcheck at `http://localhost:8001/health` |
| **Redis** | EC2 Docker Container | Port 6379 | **Private only** (`127.0.0.1:6379:6379`) | Redis 7 Alpine, persistent volume `redis_data` |
| **RDS PostgreSQL**| AWS RDS (`kyrazam`) | Port 5432 | **VPC Private Subnet** (`172.31.0.62`) | AWS RDS PostgreSQL, accessible only within the VPC from EC2 |

---

## 4. Critical Gate Blocker & Approval Required

### Blocker BLK-DEP-01: Intended Release Changes Not Committed or Pushed
- **Rule Violated**: *Phase 1 Rule 6: "If security fixes are incomplete, tests fail, or required changes are not pushed, stop and report the blocker. Do not deploy unapproved code. Do not push unreviewed code."*
- **Detail**:
  The latest commit on GitHub is `5d8f643` ("issue fix"). If EC2 pulls `5d8f643` now, the deployed production server will **lack** all Batch A and Batch B critical security fixes (WebSocket authentication, CORS restrictions, token query parameter removal, token rotation).
- **Remediation Action Required**:
  1. User reviews the uncommitted Batch A and Batch B security fixes and test harness.
  2. Stage and commit the verified changes:
     ```bash
     git add backend/package.json backend/src/middleware/rbac.ts backend/src/plugins/auth.ts backend/src/plugins/cors.ts backend/src/routes/auth.ts backend/src/server.ts backend/src/__tests__/ docs/ frontend/src/app/[role]/finance/invoices/[id]/page.tsx frontend/src/app/[role]/finance/invoices/page.tsx frontend/src/app/[role]/sales/quotations/[id]/page.tsx frontend/src/app/[role]/sales/quotations/page.tsx frontend/src/app/login/page.tsx frontend/src/components/providers/RealtimeProvider.tsx frontend/src/lib/api.ts
     git commit -m "fix(security): resolve auth fallbacks, websocket role leaks, cors whitelist, and add regression tests"
     git push origin main
     ```
  3. Once pushed, proceed to Phase 2 to pull the exact newly pushed commit on the EC2 instance.

### Blocker BLK-DEP-02: RDS Migration History State Check Required on EC2
- **Rule Preserved**: *Phase 4 Rule 7: "If migrations are confirmed safe and necessary, obtain explicit approval before applying them. Never run prisma migrate reset, db push, or destructive SQL."*
- **Detail**:
  RDS migration `20260825165600_add_hardening_indexes` was previously in a failed status on RDS, while `20260825160000_add_enterprise_schema` is pending.
- **Remediation Plan on EC2**:
  1. Take manual RDS snapshot via AWS CLI / Console: `kyra-zam-db-pre-deploy-$(date +%s)`.
  2. Run `npx prisma migrate status` on EC2 to inspect the exact live RDS migration state.
  3. Resolve the failed migration safely: `npx prisma migrate resolve --rolled-back "20260825165600_add_hardening_indexes"`.
  4. Run `npx prisma migrate deploy` only after explicit confirmation.
