# KYRA ZAM 2.0 — Phase 4 Blockers & Defect Analysis

**Document Reference**: `docs/audit/PHASE4_BLOCKERS.md`  
**Execution Phase**: Phase 4 — Baseline Testing  
**Author**: Systems Architect & Lead DevOps Engineer  
**Repository**: `https://github.com/growphil/kyra-zam.git`  
**Audited Commit**: `5d8f64322191cd9cc4207e077a12463082f04548` (branch: `main`)  
**Status**: Verification Complete  

---

## 1. Executive Summary

During Phase 4 baseline testing, all functional commands, builds, type-checks, migrations, and import lifecycles were executed against the actual repository codebase. Four direct execution failures and five architectural blockers were confirmed.

| Blocker ID | Domain | Category | Direct Failure / Error Message | Production Impact |
|---|---|---|---|---|
| **BLK-01** | Operations | **Runtime Blocker** | `npm run worker` -> `MODULE_NOT_FOUND` (missing `./worker.ts`) | Background task processing script fails immediately upon execution. |
| **BLK-02** | Database Tooling | **Compatibility Blocker** | `ts-node prisma.config.ts` -> `Cannot find module 'prisma/config'` | Build tools and TypeScript compilers crash if loading project root config. |
| **BLK-03** | Frontend Quality | **Build Masking Blocker** | `npm run lint` -> `Cannot find module .../eslint-config-next/core-web-vitals` | Next.js build suppresses lint checks; ESLint fails out-of-the-box. |
| **BLK-04** | Security / Auth | **Security Blocker** | Role fallback in `authPlugin` & `rbac.ts` permits privilege escalation | Critical vulnerability: arbitrary tokens hijack active Superadmin sessions. |
| **BLK-05** | Security / WS | **Security Blocker** | Unauthenticated `/ws` assigned 10 privileged roles | Real-time leakage of customer orders, payments, and manufacturing data. |
| **BLK-06** | Database Deploy | **Deployment Blocker** | RDS `_prisma_migrations` contains failed `165600` entry | `prisma migrate deploy` blocked on AWS RDS until resolved via CLI. |
| **BLK-07** | Quality Assurance | **QA Blocker** | Zero automated tests configured in `backend/package.json` | High risk of undetected functional regressions during code refactoring. |

---

## 2. Detailed Blocker Analyses

### BLK-01: Missing Queue Worker Entry Point
- **Trigger Command**: `npm run worker` (in `backend/`)
- **Captured Output**:
  ```
  Error: Cannot find module './worker.ts'
  Require stack:
  - D:\GROWPHIL PROJECT\KYRA ZAM 2.O\backend\src\queues\imaginaryUncacheableRequireResolveScript
    code: 'MODULE_NOT_FOUND'
  ```
- **Root Cause**: `backend/package.json:L14` specifies `"worker": "ts-node src/queues/worker.ts"`, but the directory `backend/src/queues` does not exist on disk. While `bullmq` is listed in dependencies, no background worker has been implemented.
- **Required Action**: Remove the defunct script from `package.json` to prevent deployment scripts from attempting to start an unmanaged background daemon.

---

### BLK-02: Prisma 6 Configuration in Pinned Prisma 5.22 Project
- **Trigger Command**: `npx ts-node prisma.config.ts` (in `backend/`)
- **Captured Output**:
  ```
  TSError: ⨯ Unable to compile TypeScript:
  prisma.config.ts(4,30): error TS2307: Cannot find module 'prisma/config' or its corresponding type declarations.
  ```
- **Root Cause**: `backend/prisma.config.ts` imports `{ defineConfig } from "prisma/config"`. Prisma 5.22.0 does not include this module; it is exclusive to Prisma 6. Prisma 5 CLI ignores `prisma.config.ts`, but TypeScript tooling, test runners, or bundling scripts that scan the repository root crash on module resolution.
- **Required Action**: Delete `backend/prisma.config.ts`. In Prisma 5.22, configuration is natively specified in `prisma/schema.prisma` and `.env`.

---

### BLK-03: Frontend ESLint Configuration Import Failure
- **Trigger Command**: `npm run lint` (in `frontend/`)
- **Captured Output**:
  ```
  Cannot find module 'D:\GROWPHIL PROJECT\KYRA ZAM 2.O\frontend\node_modules\eslint-config-next\core-web-vitals' imported from D:\GROWPHIL PROJECT\KYRA ZAM 2.O\frontend\eslint.config.mjs
  Did you mean to import "eslint-config-next/core-web-vitals.js"?
  ```
- **Root Cause**: `frontend/eslint.config.mjs` uses an ESM `import` path that is missing the `.js` extension required by Node's ESM resolution for the installed version of `eslint-config-next`. To allow `next build` to proceed on Vercel, previous developers added `eslint: { ignoreDuringBuilds: true }` and `typescript: { ignoreBuildErrors: true }` in `frontend/next.config.ts`.
- **Required Action**:
  1. Fix the import path in `frontend/eslint.config.mjs` (append `.js` or use standard Next.js ESLint flat-config syntax).
  2. In `frontend/next.config.ts`, remove `ignoreBuildErrors: true` and `ignoreDuringBuilds: true`.

---

### BLK-04: User Identity Fallback in Authentication & RBAC (RISK-CRIT-01)
- **Files**: `backend/src/plugins/auth.ts:L47-55`, `backend/src/middleware/rbac.ts:L32-40`
- **Root Cause**: An intentional dev-mode fallback queries `prisma.user.findFirst({ where: { roles: { hasSome: payload.roles }, isActive: true } })` if a token's user ID is not found.
- **Remediation**: Remove fallback queries completely. Return HTTP `401 Unauthorized` whenever a token's `id` does not match an active database record.

---

### BLK-05: Unauthenticated WebSocket Wildcard Subscriptions (RISK-CRIT-02)
- **File**: `backend/src/server.ts:L126-138`
- **Root Cause**: An unauthenticated WebSocket connection catches the verification error and assigns `userId = "guest_user"` with **all 10 system roles**, pushing privileged financial and manufacturing data to any open socket.
- **Remediation**: Reject unauthenticated WebSocket connections with policy violation code `1008`, or register with an empty role list `userRoles = []`.

---

### BLK-06: Production RDS Migration State Blockage (RISK-CRIT-03)
- **Root Cause**: On AWS RDS, migration `20260825165600_add_hardening_indexes` failed previously. Running `prisma migrate deploy` directly fails because Prisma requires failed migrations to be marked rolled-back or applied before deploying newer or intervening migrations.
- **Remediation Sequence on Production EC2**:
  ```bash
  npx prisma migrate resolve --rolled-back "20260825165600_add_hardening_indexes"
  npx prisma migrate deploy
  ```

---

### BLK-07: Complete Absence of Automated Testing
- **Root Cause**: Zero test frameworks exist in `backend/` or `frontend/`.
- **Remediation**: Install Vitest and Supertest in `backend/`. Author unit and integration tests covering authentication gates, inventory concurrency, financial clearance, and warranty registration.

---

## 3. Recommended Implementation Sequence for Phase 5

The implementation plan must address blockers in three prioritized phases:

```mermaid
flowchart TD
    subgraph Batch 1: Security Criticals & Build Unblocking
        A[Fix Auth Role Fallback<br/>BLK-04 / RISK-CRIT-01]
        B[Fix WebSocket Guest Roles<br/>BLK-05 / RISK-CRIT-02]
        C[Delete Incompatible prisma.config.ts<br/>BLK-02]
        D[Clean Defunct Worker Script<br/>BLK-01]
        E[Fix Frontend ESLint & next.config.ts<br/>BLK-03]
    end

    subgraph Batch 2: Security Hardening & Concurrency Integrity
        F[Enforce CORS Origin Whitelist<br/>RISK-HIGH-01]
        G[Remove Query Parameter JWTs<br/>RISK-HIGH-02]
        H[Wire JWT_EXPIRY & Refresh Rotation<br/>RISK-HIGH-03 / RISK-MED-01]
        I[Fix Atomic Stock Increment in CellService<br/>RISK-HIGH-04]
        J[Protect Sequential Numbers against Collisions<br/>RISK-HIGH-05]
    end

    subgraph Batch 3: Automated Testing & Migration Prep
        K[Install & Configure Vitest in Backend<br/>BLK-07 / RISK-MED-03]
        L[Author Automated Tests for Auth, Inventory, Finance, Warranty]
        M[Run Full Test Suite & Verify 100% Pass]
        N[Document EC2 Production RDS Migration Steps<br/>BLK-06 / RISK-CRIT-03]
    end

    Batch 1 --> Batch 2
    Batch 2 --> Batch 3
```

---

## 4. Phase 4 Sign-Off

Baseline testing is complete. All commands, exit codes, failure logs, and technical blockers are documented.

Deliverables generated:
- `docs/audit/BASELINE_TEST_RESULTS.md`
- `docs/audit/PHASE4_BLOCKERS.md`

We are ready to proceed with **Phase 5 (Implementation Plan)** upon review and approval.
