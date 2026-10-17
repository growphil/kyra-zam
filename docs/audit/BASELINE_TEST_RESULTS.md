# KYRA ZAM 2.0 — Phase 4 Baseline Test Results

**Document Reference**: `docs/audit/BASELINE_TEST_RESULTS.md`  
**Execution Phase**: Phase 4 — Baseline Testing  
**Author**: QA Engineer & DevOps Lead  
**Repository**: `https://github.com/growphil/kyra-zam.git`  
**Audited Commit**: `5d8f64322191cd9cc4207e077a12463082f04548` (branch: `main`)  
**Status**: Read-only Verification Completed (No source code or DB changes)  

---

## 1. Environment & Runtime Baseline

| Component / Runtime | Version / Status | Notes / Source |
|---|---|---|
| **Git Branch & Commit** | `main` @ `5d8f64322191cd9cc4207e077a12463082f04548` | Working tree clean (except untracked `docs/`) |
| **Node.js** | `v26.11.1` (Win32 x64) | Tested on local workstation |
| **npm** | `11.20.0` | Package manager |
| **Backend Dependencies** | 24 dependencies, 8 devDependencies | Locked via `backend/package-lock.json` |
| **Frontend Dependencies** | 23 dependencies, 9 devDependencies | Locked via `frontend/package-lock.json` |
| **Prisma CLI** | `5.22.0` | Node-API Query Engine & Schema Engine `60519735` |
| **Prisma Client** | `5.22.0` | Custom client output in `src/generated/client` |
| **Python** | `Python 3.14.4` | Located in `sidecar/venv/Scripts/python.exe` |
| **Sidecar Dependencies** | FastAPI 0.111.0, Uvicorn 0.29.0, Pandas, Rapidfuzz, OpenPyXL | Defined in `sidecar/requirements.txt` |
| **Local PostgreSQL** | PostgreSQL 16/18 on port 5432 | Used for fresh disposable migration test |
| **Production RDS** | PostgreSQL 16 (`kyra-zam-db`) | Located in AWS VPC (`172.31.0.62`); untouched |

---

## 2. Command Execution Log & Baseline Results

Each command was executed directly against the repository in non-destructive verification mode:

| Test ID | Subsystem | Exact Command Executed | Exit Code | Actual Status | Summary of Result |
|---|---|---|:---:|:---:|---|
| **CMD-01** | Git Status | `git status --short` | `0` | **Passed** | Working tree clean; only `docs/` untracked |
| **CMD-02** | Backend Prisma Version | `npx prisma -v` (in `backend/`) | `0` | **Passed** | Prisma CLI & `@prisma/client` confirmed at `5.22.0` |
| **CMD-03** | Backend TypeScript Build | `npm run build` (in `backend/`) | `0` | **Passed** | `tsc` compiled all files from `src/` to `dist/` with 0 errors |
| **CMD-04** | Backend Worker Entry Point | `npm run worker` (in `backend/`) | `1` | **Failed** | `Cannot find module './worker.ts'`; `src/queues/` missing |
| **CMD-05** | Prisma Config Compatibility | `npx ts-node prisma.config.ts` (in `backend/`) | `1` | **Failed** | `error TS2307: Cannot find module 'prisma/config'` |
| **CMD-06** | Backend Automated Tests | `npm test` (in `backend/`) | N/A | **Not configured** | No test script in `backend/package.json` |
| **CMD-07** | Frontend TypeScript Check | `npx tsc --noEmit` (in `frontend/`) | `0` | **Passed** | Zero TypeScript compilation errors in frontend |
| **CMD-08** | Frontend ESLint | `npm run lint` (in `frontend/`) | `1` | **Failed** | `Cannot find module '.../eslint-config-next/core-web-vitals'` |
| **CMD-09** | Frontend Production Build | `npm run build` (in `frontend/`) | `0` | **Passed** | Next.js compiled all 103 routes; passed via `ignoreDuringBuilds` |
| **CMD-10** | Sidecar Syntax Validation | `python -m py_compile main.py processor.py qc_rules.py` | `0` | **Passed** | Zero Python syntax errors in sidecar modules |
| **CMD-11** | Sidecar Application Import | `python -c "import main; print('OK')"` | `0` | **Passed** | FastAPI application imported cleanly |
| **CMD-12** | Database Migration Chain | `npx prisma migrate status` (on `kyrazam_fresh_test`) | `0` | **Passed** | All 6 migrations applied cleanly; schema up to date |
| **CMD-13** | Database Schema Drift | `npx prisma migrate diff ... --exit-code` | `0` | **Passed** | Zero difference between migrations & `schema.prisma` |
| **CMD-14** | Domain Data Integrity | `npx ts-node src/scripts/test-schema-integrity.ts` | `0` | **Passed** | All 10 domain relations & query integrity tests passed |

---

## 3. Subsystem Detailed Findings

### 3.1 Backend Verification

1. **Compilation (`npm run build`)**:
   - `tsc` executed successfully and emitted code into `dist/`.
   - No type errors were reported by TypeScript under the current `tsconfig.json`.
2. **Missing Queue Worker (`npm run worker`)**:
   - **Command**: `npm run worker`
   - **Exit Code**: `1`
   - **Captured Error**:
     ```
     Error: Cannot find module './worker.ts'
     Require stack:
     - D:\GROWPHIL PROJECT\KYRA ZAM 2.O\backend\src\queues\imaginaryUncacheableRequireResolveScript
     ```
   - **Status**: **Confirmed Defect / Blocked**.
3. **Prisma 6 Configuration (`prisma.config.ts`)**:
   - **Command**: `npx ts-node prisma.config.ts`
   - **Exit Code**: `1`
   - **Captured Error**: `prisma.config.ts(4,30): error TS2307: Cannot find module 'prisma/config' or its corresponding type declarations.`
   - **Status**: **Confirmed Incompatibility / Defect**.
4. **Automated Test Suite**:
   - `backend/package.json` contains no `"test"` script. No test runner is installed.
   - **Status**: **Not Configured**.

---

### 3.2 Frontend Verification

1. **Strict Type-Checking (`npx tsc --noEmit`)**:
   - **Exit Code**: `0`.
   - Standard TypeScript type-checking completed with **zero errors**.
2. **ESLint (`npm run lint`)**:
   - **Command**: `npm run lint`
   - **Exit Code**: `1`
   - **Captured Error**:
     ```
     Cannot find module '...\frontend\node_modules\eslint-config-next\core-web-vitals' imported from ...\frontend\eslint.config.mjs
     Did you mean to import "eslint-config-next/core-web-vitals.js"?
     ```
   - **Status**: **Confirmed Defect / Build Masking**.
   - This failure explains why `ignoreDuringBuilds: true` was added to `next.config.ts`.
3. **Production Build (`npm run build`)**:
   - **Exit Code**: `0`.
   - Next.js 15 generated 103 routes (12 static pages, 91 dynamic role-based routes).
   - Middleware bundle size: `85.4 kB`. Shared client bundle: `99.5 kB`.

---

### 3.3 Python Sidecar Verification

1. **Syntax Compilation**:
   - `python -m py_compile main.py processor.py qc_rules.py` returned exit code `0`.
2. **FastAPI Application Import**:
   - `python -c "import main; print('FastAPI App Loaded Successfully')"` returned exit code `0`.
   - FastAPI loads routes `/health`, `/process-report`, and `/form-groups`.

---

### 3.4 Database Migration & Schema Drift Verification

1. **Test Environment**: Isolated test database (`kyrazam_fresh_test`) on `localhost:5432`. (Zero production RDS access).
2. **Migration Sequence**:
   - `20260429104211_init`
   - `20260504052119_fix_user_schema`
   - `20260825160000_add_enterprise_schema`
   - `20260825165600_add_hardening_indexes`
   - `20260825174700_add_work_order_scheduling`
   - `20260825181400_add_work_order_execution`
3. **Prisma Status**: `6 migrations found in prisma/migrations. Database schema is up to date!`
4. **Schema Comparison**:
   - `prisma migrate diff --from-schema-datamodel prisma/schema.prisma --to-schema-datasource prisma/schema.prisma --exit-code`: **0 (No difference detected)**.
5. **Domain Integrity Script**:
   - `test-schema-integrity.ts` executed against test database.
   - All 10 domains (Users/RBAC, Inventory, Production, Warranties, CRM, Procurement, Cells, Quality, Finance, Service/Scrap) reported `100% PASS`.

---

## 4. Security Regression Baseline (Missing Test Coverage)

Because no automated testing framework is installed in the repository, the following critical security and business logic properties currently have **zero automated test coverage**:

| Domain | Property to Test | Existing Test Status | Required Verification |
|---|---|:---:|---|
| **Auth / RBAC** | Rejection of invalid user IDs without role fallback | **Missing** | Automated API test with JWT containing invalid `id` |
| **Auth / WS** | Unauthenticated WebSocket connection rejection | **Missing** | WebSocket handshake test without bearer token |
| **Auth / Query** | Rejection of JWTs provided via `?token=` query param | **Missing** | API call with token only in query string |
| **CORS** | Rejection of untrusted cross-origin requests with credentials | **Missing** | Preflight `OPTIONS` request with untrusted origin |
| **Token Expiry** | Enforcement of 60-minute access token expiry | **Missing** | Assertion on JWT `exp` payload claim |
| **Refresh Rotation** | Invalidation of replayed refresh tokens | **Missing** | Sequential `/auth/refresh` calls verifying single-use tokens |
| **Inventory** | Prevention of negative inventory balances | **Missing** | Concurrent transfer requests attempting to overdraw stock |
| **Inventory** | Atomicity of material inward increments | **Missing** | Concurrent inward batch creation for same SKU |
| **Finance** | Blocking dispatch order creation for uncleared sales orders | **Missing** | Attempt DO creation on uncleared order |
| **Warranty** | Blocking warranty activation for non-delivered packs | **Missing** | Attempt warranty registration on non-delivered pack |
| **Production** | Enforcing work order planned quantity <= requirement quantity | **Missing** | Attempt WO creation exceeding target allocation |

---

## 5. Summary of Baseline Status

- **Backend Build**: PASSING (`tsc` compiles cleanly).
- **Frontend Build**: PASSING WITH SUPPRESSED LINT (`next build` succeeds; `next lint` fails due to `eslint.config.mjs` import error).
- **Sidecar Service**: PASSING (Python syntax and imports verified).
- **Disposable DB Migrations**: PASSING (All 6 migrations apply cleanly; 0% schema drift).
- **Runtime Blockers**:
  1. `npm run worker` crashes immediately (`MODULE_NOT_FOUND`).
  2. `prisma.config.ts` fails TypeScript compilation due to Prisma 6 import.
  3. `npm run lint` fails in frontend due to ESM import syntax in `eslint.config.mjs`.
  4. Complete absence of automated unit or integration tests.

Deliverables generated:
- `docs/audit/BASELINE_TEST_RESULTS.md`
- `docs/audit/PHASE4_BLOCKERS.md`
