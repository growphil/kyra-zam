# KYRA ZAM 2.0 — UX Flow, Responsive Design & UI Implementation Standard

**Version:** 1.0  
**Related standard:** `KYRA_ZAM_2.0_UI_UX_Design_System_v1.0.md`  
**Purpose:** Define workflow-aware UX, responsive behavior, runtime states, and acceptance criteria across the existing project.

## 1. Core principles
- Use the live repository as source of truth for routes, roles, permissions, APIs, and transitions.
- The master design system defines visual tokens; this document defines flows and responsive behavior.
- Make the next valid action and blockers clear.
- Preserve context after recoverable errors.
- Use scan-first interaction where supported, with manual fallback.
- Show success only after backend confirmation.
- Every applicable page must handle loading, success, empty, error, and permission-denied states.

## 2. Common task-flow model
1. Enter via role navigation, task queue, search, or record link.
2. Identify the batch/cell/Pax/order/service record; validate identity.
3. Check prerequisites and show blockers.
4. Perform the task with inline validation and units.
5. Review consequential changes.
6. Submit through the authorized backend action.
7. Confirm the actual server result and refresh relevant UI state.
8. Continue to the next valid task without bypassing workflow gates.

## 3. Workflow UX patterns
### Inward and testing
Show batch/vendor/quantity/serial context. Keep measurements, units, tolerances and outcomes together. Separate pass, retest, hold and reject. Bulk import must expose row-level errors where supported.

### Grouping and assembly
Show work order, Pax identity, cell requirements, slots and progress. Confirm scanned identity and target slot. Prevent duplicate assignment and explain conflicts.

### Pax testing and QC
Show prerequisites, target identity, measurements, thresholds, outcomes and history. Preserve failure reasons and traceability. Use only supported backend outcomes.

### Packing and finished goods
- Show only backend-eligible Pax records.
- Verify Pax identity and required test/QC state.
- Load packing material requirements from existing configuration/BOM rules where available.
- Distinguish required, optional and missing checklist items.
- Validate checklist completion before final confirmation.
- Generate the sticker using the existing Pax identity and approved label template.
- After successful packing, use the authorized warehouse/finished-goods transfer operation.
- Show destination, transaction reference and audit details; never simulate the transfer in the frontend.

### Sales, procurement, finance and dispatch
Show record identity, approval state, blockers and next permitted action. Financial clearance and dispatch eligibility must be enforced by the backend.

### Warranty and service
Sequence lookup, eligibility, intake, diagnosis, parts, repair, retest and handover according to actual existing workflows.

## 4. Responsive behavior

| Viewport | Baseline behavior |
|---|---|
| Wide desktop ≥1280px | Expanded sidebar where appropriate; multi-column grids; full tables |
| Laptop 1024–1279px | Reduce grid columns and padding; avoid clipped menus |
| Tablet 768–1023px | Compact/collapsible sidebar; touch-friendly controls; prioritize active task |
| Mobile <768px | Navigation drawer; one-column layout; stack page actions; use row cards or bounded table scrollers |
| Very narrow <380px | No fixed-width overflow; safely wrap identifiers; dialogs fit viewport |

Use existing project breakpoints where already established. Prevent body-level horizontal overflow. Use `min-width: 0` in flex/grid children where needed. Allow internal table scrolling when appropriate, never uncontrolled page-level sideways scrolling. Do not rely on hover alone. Keep dialogs/drawers scrollable and their actions reachable.

## 5. White-screen/runtime failure prevention

| Risk | Required handling |
|---|---|
| Component exception | Route/layout error boundary with safe recovery |
| API failure | Explicit loading/error/empty states and retry |
| Null or missing fields | Typed contracts and safe fallbacks |
| Unknown enum | Neutral fallback; preserve diagnostics where supported |
| Hydration mismatch | Correct server/client boundaries and browser-only isolation |
| Missing/forbidden route | Clear not-found or access-denied UI |
| Chart failure | Fallback summary/table |
| Mutation failure | Preserve safe input and offer safe retry |
| WebSocket disconnect | Visible connection state and established reconnect/refetch |
| Long-running operation | Progress state and duplicate-submit prevention |

Required states: loading, success with data, success without data, filtered no-results, recoverable error, forbidden, not-found, submitting, mutation success, and mutation conflict. Never display fake success.

## 6. Forms and interaction
- Visible labels; placeholders are supplementary.
- Required fields, units and constraints are clear.
- Inline validation plus summary for complex forms.
- Preserve input after recoverable network failures.
- Confirm destructive/irreversible actions.
- Prevent duplicate submits and preserve server-side authorization/idempotency.
- Preserve useful search/filter context.
- Support keyboard navigation and visible focus.

## 7. Role consistency
Use the real role/permission matrix. The visual system is shared; task queues and actions differ by role. The UX must clearly surface:
- Inventory: batches, serials, quantities, locations and transactions.
- Testing: measurements, tolerance, outcome and retest.
- Assembly: work order, station, slots and conflicts.
- Production: readiness, assignment and blockers.
- QC: inspection, evidence and disposition.
- Packing: eligible Pax, materials, box checklist, sticker and warehouse handoff.
- Purchase: requisition, approval, supplier order and receipt.
- Sales/CRM: customer, quotation/order stage and approvals.
- Finance: invoice, payment, reconciliation and clearance.
- Dispatch: authorized order, destination and confirmation.
- Service: warranty, diagnosis, repair and handover.
- Admin: configuration, access, audit and system health.

## 8. Engineering rules
- Use the existing framework, route structure, styling and query/state libraries.
- Build reusable responsive primitives and page-state components.
- Prefer content-driven grid/flex sizing over fixed heights.
- Centralize breakpoints and reuse master design tokens.
- Keep business decisions on the server.
- Add error boundaries without silently swallowing errors.
- Do not log secrets or sensitive customer data.
- Check existing dependencies before adding packages.

## 9. Test matrix
- Inventory all existing routes and roles.
- Test at 1440, 1280, 1024, 768, 390 and 320–375px.
- Verify no unintended page overflow, clipped controls or overlapping text.
- Simulate loading, empty, API failure, forbidden, not-found and malformed optional fields.
- Test mutation pending/success/failure/retry/double-click behavior.
- Verify direct URL access and server permissions.
- Test valid/invalid/duplicate scans and manual fallback where supported.
- Verify QC, packing, financial clearance, warehouse and dispatch gates.
- Test keyboard navigation, focus, labels and contrast.
- Run typecheck, lint, build and relevant tests; record actual outcomes.

## 10. Page acceptance checklist
- [ ] Route and authorized roles recorded.
- [ ] Global design system followed.
- [ ] Task purpose and next valid action clear.
- [ ] Prerequisites and blockers visible.
- [ ] Applicable runtime states handled.
- [ ] Desktop/tablet/mobile behavior verified.
- [ ] No unintended page-level horizontal overflow.
- [ ] Forms, scanning, tables and dialogs usable.
- [ ] Recoverable errors preserve context.
- [ ] Backend contracts and permissions preserved.
- [ ] Tests/build results recorded.
- [ ] Marked Verified only after checks pass.

## 11. Rollout
1. Inventory routes, roles and existing flows.
2. Add responsive primitives, state components and error handling.
3. Verify global shell on desktop and mobile.
4. Migrate operational modules in small groups.
5. Migrate commercial and admin modules.
6. Run route-by-route responsive and runtime-state checks.
7. Run regression tests and publish results.

Maintain a tracker with Route, Role, Workflow reviewed, Responsive checked, Runtime states checked, Regression tests, Status and Notes. Use Not Started, In Progress, Blocked and Verified.

## Completion definition
Completion requires every existing route to be inventoried, applicable flows reviewed, responsive behavior verified, runtime states covered and existing permissions/workflows preserved. A polished dashboard alone is not sufficient. Mark unavailable dependencies as Blocked, not Verified.
