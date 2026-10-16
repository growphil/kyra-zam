# KYRA ZAM 2.0 — Application-Wide UI, UX & Smooth-Operation Standard

**Version:** 1.0  
**Repository:** `D:\GROWPHIL PROJECT\KYRA ZAM 2.O`  
**Purpose:** Single implementation standard for a consistent, responsive, accessible, reliable, smooth-to-operate UI across the existing KYRA ZAM 2.0 ERP/MES.

> **Core rule:** Improve the existing application incrementally. Preserve working APIs, authentication, RBAC, manufacturing rules, state machines, audit history, serial genealogy, and financial/warehouse gates. Do not replace working workflows with mock pages, invent endpoints, hardcode production data, or claim success before the backend confirms it.

## 1. Mission and Definition of Smooth Working

The application must help authorised users complete industrial battery-pack manufacturing work accurately and efficiently. “Smooth working” means:

- Users can find the correct page and record quickly.
- Labels, icons, buttons, tabs, forms, tables, dialogs, and status indicators remain visible in every state.
- Pages use screen space efficiently without oversized headers or unnecessary scrolling.
- Loading, empty, success, error, offline, forbidden, not-found, and conflict states are handled explicitly.
- Frontend state reflects authoritative backend state.
- Scanning and keyboard-driven workflows are reliable.
- Layouts work from wide desktop monitors to narrow mobile screens.
- Shared components behave consistently across routes and roles.
- Tests and route checks are recorded honestly; untested routes are never marked verified.

## 2. Source of Truth and Repository-First Process

Before editing, inspect the real repository to establish the actual framework, routes, shared layouts, design tokens, component library, API contracts, schemas, status enums, role permissions, workflow state machines, tests, and scripts.

Review these documents if present:

- `KYRA_ZAM_2.0_UI_UX_Design_System_v1.0.md`
- `KYRA_ZAM_2.0_UX_Flow_Responsive_UI_Standard_v1.0.md`
- `KYRA_ZAM_2.0_UI_UX_Implementation_Tracker.md`

Do not assume a document or route exists because it is named here. If a file is missing, report it and inspect the real implementation.

### Implementation order

1. Baseline audit and actual route inventory.
2. Shared tokens, typography, application shell, and reusable component states.
3. Global contrast, visibility, responsive, and runtime-resilience defects.
4. Shared page header, navigation, tabs, buttons, forms, tables, dialogs, alerts, and badges.
5. Operational workflows, prioritising scanning, QC, packing, warehouse, and financial gates.
6. Role-by-role route verification.
7. Regression tests, build, responsive checks, and tracker updates.

Implement small, testable changes. Do not stop after an audit report.

## 3. Fixed Design System

Use the established KYRA ZAM 2.0 design system as the single source of truth. Verify existing tokens and consolidate duplicates rather than introducing a competing theme.

### 3.1 Colour tokens

| Purpose | Colour |
|---|---|
| Sidebar | `#061B3A` |
| Primary action | `#0878F9` |
| Primary hover | `#0667DB` |
| Selected surface | `#EAF5FF` |
| Workspace background | `#F4F9FF` |
| Card/modal surface | `#FFFFFF` |
| Primary text | `#0B2148` |
| Secondary text | `#526B91` |
| Muted text | `#64748B` |
| Border | `#D8E8FA` |
| Accent yellow | `#FFC928` |
| Success background/text | `#DCFCE7` / `#166534` |
| In-progress background/text | `#DBEAFE` / `#1D4ED8` |
| Pending background/text | `#FEF3C7` / `#92400E` |
| Failed background/text | `#FEE2E2` / `#991B1B` |
| Neutral background/text | `#F1F5F9` / `#475569` |
| On-hold background/text | `#FFEDD5` / `#9A3412` |

Rules:

- Keep dark navy primarily for the sidebar and explicitly intended dark surfaces.
- Use white or subtle blue-tinted surfaces for ordinary cards and forms.
- Avoid ad-hoc grey surfaces such as `#9A9BA2` where established surface/status tokens are appropriate.
- Green means genuine success/healthy state; red means danger/rejection/destructive action; amber means pending/caution/on-hold.
- Do not blindly remove every grey, green, or dark value; disabled, neutral, and semantic states can legitimately use them.
- Define foreground and background together for each component variant.

### 3.2 Typography and surfaces

- Use the existing approved font. Inter or DM Sans may be considered only after checking current usage and migration risk.
- Page title: normally 24–28px semibold; dense operational title: 22–24px where appropriate.
- Section heading: 18–20px; body: 14px; table text: 13–14px; labels/badges: 11–12px.
- Standard card radius: 10–12px; controls: approximately 8px.
- Prefer subtle blue-tinted borders over heavy shadows.
- Standard card padding: 16–20px.
- Avoid excessive gradients, glows, oversized decorative icons, and generic decoration that does not help operators.

## 4. Application Shell and Navigation

- Preserve authentication, role-based sidebar, top bar, global search, sync indicator, notifications, and user menu.
- Sidebar stays dark navy with visible labels and icons. Existing width may remain around 230–256px expanded if nested navigation needs it; collapsed target is about 72px.
- Selected navigation: primary blue with white text/icons. Hover must differ from selected state.
- Active route remains selected after mouseout, refresh, and browser navigation.
- Long labels must not overlap icons, chevrons, or badges.
- Navigation search must preserve keyboard navigation and selected state.
- Only show permitted modules/actions, while enforcing permissions on the backend too.

## 5. Compact Page Headers and Vertical Spacing

Use compact headers on ordinary operational pages:

- Desktop top content padding: about 24px, adjusted to the existing shell.
- Breadcrumb: compact 12px text.
- Page title: 24–28px; subtitle: 13–14px.
- Icon container: 36–44px.
- Gap after header: 16–24px.
- Align header actions without forcing extra height.

Create or improve a shared page-header component only if the repository does not already have one. It may support title, subtitle, icon, breadcrumbs, actions, status, and compact/standard variants.

Avoid oversized title banners, empty subtitle space, redundant dividers with large margins, excessive padding before the first useful control, and nested cards used only to display a title. Retain intentionally designed hero sections where justified.

## 6. Component State Contract

Every shared component must define its states deliberately.

### Buttons

Each variant must define background, foreground, icon colour, border, hover, focus, active, loading, and disabled states together.

- Primary: blue background, white text.
- Secondary: white/light surface, navy text, visible border.
- Ghost: readable foreground and visible hover.
- Danger: strong red action with accessible contrast.
- Icon-only: visible icon, accessible name/tooltip where appropriate, keyboard focus.
- Disabled: intentionally disabled but still understandable.
- Loading: show progress and prevent duplicate submissions.

Do not enable an unavailable action merely to make it look visible. Do not invent a label/action to fix a blank-looking control; inspect its intended behaviour.

### Tabs and segmented controls

- Active: `#EAF5FF` surface, `#0878F9` text/icon, visible indicator/border.
- Inactive: readable secondary text on white/transparent surface.
- Hover: subtle blue-tinted surface.
- Focus: visible keyboard ring.
- Disabled: neutral and understandable.
- Hover must never erase active styling.
- Query-string tabs must remain selected after refresh/back/forward navigation.
- If labels/icons disappear, inspect inherited colours, opacity, conditional classes, overlays, and pseudo-elements rather than blindly forcing all text blue.

### Forms and inputs

- Visible labels associated with controls; placeholders supplement rather than replace labels.
- Readable text, borders, focus rings, validation, and disabled states.
- Preserve entered values after recoverable failures.
- Show field-level validation and clear form-level errors.
- Prevent duplicate submission.
- Use appropriate validation/formatting for dates, serials, numeric, phone, email, and monetary fields.
- Do not silently coerce invalid values or hide errors.

### Cards, alerts, badges, and icons

- Cards use consistent white/light surfaces and borders.
- Alert colour communicates actual severity.
- Status badges map real backend enums; do not guess enum names or meanings.
- Unknown enum values use a safe readable fallback.
- Important icons and safety indicators remain legible.
- Keep visual styling separate from business state.

### Dialogs and drawers

- Standard form dialogs use white surfaces, dark headings, readable labels, and visible close actions.
- Backdrop must not become unintentionally opaque.
- Long content scrolls inside the dialog; dialogs fit narrow viewports.
- Preserve established Escape/backdrop behaviour and focus management.
- Destructive confirmations explain consequences and retain existing authorization.
- Opening a dialog must never execute a destructive action.

### Tables and pagination

- Consistent headers, row spacing, status indicators, and actions.
- Bounded internal horizontal scrolling is acceptable; avoid page-level overflow.
- Long IDs/serials/emails/addresses wrap or truncate deliberately, with access to full values when needed.
- Empty states explain no matching records and suggest filter changes where useful.
- Pagination reflects actual server totals/state.
- Disabled Prev/Next controls remain understandable.
- Preserve sorting, filtering, selection, and server-side pagination.

## 7. Responsive Standard

Required viewport checks:

- 1440px — wide desktop
- 1280px — desktop
- 1024px — laptop/tablet landscape
- 768px — tablet
- 390px — mobile
- 320–375px — narrow mobile

Rules:

- No unintended page-level horizontal scrolling.
- Use `min-width: 0` on flex/grid children where needed.
- Responsive grids collapse predictably.
- Tables can scroll inside bounded containers.
- Forms stack related fields on mobile.
- Dialogs/drawers fit the viewport and scroll internally.
- Header actions wrap/stack without covering titles.
- Sidebar remains usable on narrow screens.
- Hover-only interactions have touch/keyboard alternatives.
- Do not solve overflow by shrinking all text to unreadable sizes.

## 8. Runtime Resilience and Data States

Every route/data-dependent component must handle loading, empty results, network/API failure, null/missing fields, unknown enums, unauthorized (401), forbidden (403), not-found (404), validation failure (400/422), conflict/concurrency (409), server failure (5xx), expired session, duplicate submission, and WebSocket disconnect/reconnect/stale sync where applicable.

Requirements:

- Use route-level and component-level error boundaries where appropriate.
- Provide recovery actions such as retry, refresh, go back, or contact an authorised role when suitable.
- Avoid blank screens, unhandled exceptions, and silent failures.
- Never expose stack traces, secrets, tokens, or sensitive server details.
- Do not suppress errors without handling/logging them.
- Never show success before server confirmation.
- Sync state must truthfully represent connected, reconnecting, offline, or stale states supported by the implementation.
- Preserve safe form input after recoverable errors.
- Avoid hydration mismatches and unsafe assumptions about browser-only state.
- Never replace API errors with fake successful data.

## 9. Eight-Step Task Flow

Adapt this sequence to each actual workflow:

1. **Enter:** Open the correct page with permission checks.
2. **Identify:** Find or scan the target record/serial/order.
3. **Check prerequisites:** Validate backend status, permissions, required data, materials, and eligibility.
4. **Perform:** Present only valid actions and required inputs.
5. **Review:** Show a clear summary of what will change.
6. **Submit:** Send the authorised backend request with duplicate-submit protection.
7. **Confirm:** Show success only after server confirmation; refresh/reconcile state.
8. **Next valid gate:** Continue only when backend rules permit it.

Do not add arbitrary transitions or bypass prerequisites to make the UI appear smoother.

## 10. Scanning and Operator Experience

Where scanners/serial input exist:

- Make the expected input target obvious, focused appropriately, and keyboard accessible.
- Support rapid scanner input without forcing extra mouse clicks.
- Debounce only where appropriate; do not drop valid scans.
- Prevent duplicate processing.
- Give immediate feedback: matched, unmatched, duplicate, blocked, or requires review.
- Distinguish input/scanner errors from backend failures.
- Keep record identity and current status visible.
- Provide manual fallback where permitted by role and business rules.
- Do not mark a cell, pack, test, or stock item processed until the backend confirms it.

## 11. Manufacturing Workflow Integrity

Inspect actual backend state machines, enums, API contracts, and permissions before changes. The UI must not invent transitions.

### Inventory and inward
Preserve supplier/material identity, batch/serial traceability, quantities, and stock status. Do not show stock available before the backend records the receipt. Surface shortages, reservations, duplicate records, and unauthorised adjustments clearly.

### Testing Station and QC
Show the record, expected parameters, actual results, limits, and disposition. Preserve QC thresholds and validation. Distinguish pending, in-progress, pass, fail, and review states using actual backend values. Do not bypass required tests or quality gates. Preserve audit history.

### Production and PAX assembly
Show valid work order, pack/model, materials, station, operator, and execution status. Respect material availability, reservations, scheduling, and concurrency checks. Keep start/pause/resume/complete actions consistent with the real state machine. Prevent conflicting actions.

### Packing and finished goods
Only show eligibility when the backend confirms required prior tests/QC gates. Validate the actual material checklist against existing BOM/configuration. Persist checklist state using existing APIs. Use correct pack identity/sticker/serial data. Confirm the real authorised warehouse/finished-goods transaction before displaying completion. Preserve genealogy and audit records. Never simulate stock movement in the frontend.

### Finance and sales
Preserve quote, order, invoice, payment, outstanding, and credit rules. Financial state comes from authoritative backend data. Do not allow packing/dispatch to bypass required financial clearance. Prevent duplicate payment, invoice, conversion, or order submissions.

### Service, warranty, rework, repairs, and scrap
Preserve serial genealogy, warranty eligibility, repair/test records, approvals, and disposition rules. Scrap actions must explain consequences and retain existing authorisation. Never alter stock or remove history without the authorised backend transaction.

## 12. CRM and Lead Management

- Organise lead identity, contact details, source, priority, assigned agent, status, requirements, and notes compactly.
- Make supported activity logging easy for calls, meetings, emails, notes, follow-ups, and tasks.
- Keep history chronological and provide a meaningful empty state.
- Preserve agent assignment and status permissions.
- Customer conversion follows real eligibility rules and must be confirmed by the backend.
- Prevent duplicate customer creation.
- Never hardcode lead IDs, names, contacts, or sample activities.
- Use compact headers and balanced profile/activity layouts.

## 13. Administration and Settings

- Use compact standard headers.
- Keep configuration tabs visible/readable in every state.
- Preserve QC thresholds and model configuration semantics.
- Destructive maintenance tools clearly communicate scope, authorisation, and consequences.
- Do not execute destructive operations without existing confirmation and authorization.
- Preserve audit logging and backend error/rollback behaviour.

## 14. Role-Based Experience

The actual repository is the source of truth for role names/routes. Verify only roles and modules that exist. Candidate areas previously observed include:

- Admin/SuperAdmin and Administration
- Testing Station and QC
- Inventory and Procurement
- Production and PAX Assembly
- Packing and Finished Goods
- Finance
- CRM and Sales / Marketing Manager
- Service, Warranty, Rework, and Repairs
- Scrap
- Reports and Analytics
- Supervisory and operational management

For every actual role:
- Show only permitted routes/actions.
- Enforce permissions in the backend as well as the UI.
- Hidden buttons are not a substitute for server authorization.
- Handle direct navigation to forbidden pages correctly.
- Verify sidebar active state, refresh, browser back/forward, and expired sessions.

## 15. Accessibility and Interaction Quality

- Visible keyboard focus.
- Proper form labels and accessible names for icon-only buttons.
- Status must not be communicated by colour alone.
- Target WCAG AA contrast: 4.5:1 for normal text and 3:1 for large text and meaningful UI components where applicable.
- Keyboard support for tabs, dialogs, menus, forms, tables, and scanner workflows.
- Respect reduced-motion preferences.
- Avoid unnecessary motion and distracting transitions.
- Errors/status announcements should be accessible.
- Hover must not be the only way to discover an action.

## 16. Performance and Perceived Responsiveness

- Avoid unnecessary full-page loading for small local changes.
- Reuse established query/cache patterns.
- Prevent duplicate fetches and mutation submissions.
- Keep large tables/charts responsive using existing project patterns.
- Do not leave skeletons stuck.
- Update UI after successful mutations using existing query invalidation or real-time sync.
- Handle stale data and WebSocket reconnects truthfully.
- Do not optimise by removing backend validation or audit operations.

## 17. Security and Data Integrity

- Never expose secrets, access tokens, credentials, or sensitive server errors.
- Preserve authentication and session handling.
- Preserve RBAC; treat client input as untrusted.
- Keep destructive actions protected.
- Preserve audit trails and serial genealogy.
- Do not add frontend bypasses for CAPTCHA, OTP, approval, payment, QC, or warehouse gates.
- Never claim an action succeeded before the authoritative response.
- Avoid unnecessary logging of personal/sensitive data.

## 18. Testing and Route Verification Tracker

Inspect actual package scripts and run available typecheck, lint, production build, unit/integration, and end-to-end/regression tests.

Maintain `KYRA_ZAM_2.0_UI_UX_Implementation_Tracker.md` if present; otherwise create it and record:

| Field | Meaning |
|---|---|
| Route | Exact route from repository |
| Role | Role(s) tested |
| UI reviewed | Layout, tokens, contrast |
| States tested | Loading, empty, error, active, disabled, etc. |
| Workflow tested | Real business actions exercised |
| Responsive sizes | Widths actually checked |
| Typecheck/build | Actual result or N/A |
| Regressions | Findings and status |
| Evidence | Test name, screenshot, notes |
| Status | Not started / In progress / Blocked / Verified |
| Blocker | Concrete unresolved issue |

Do not mark a route verified from visual inspection or compilation alone. Report exact commands/results; explain any command that could not run.

### Shared component checks

Test buttons, tabs, modals, inputs, validation, tables, filters, pagination, badges, unknown enum fallback, loading/empty/error/403/404/409 states, sidebar, global header, WebSocket reconnect, scanner and duplicate-submit behaviour where applicable.

## 19. Known Screenshot Issues to Recheck

These are reported observations, not proof that the defects still exist after later changes. Recheck current code/UI:

- White-on-white or invisible active tabs in Administration settings.
- Low-contrast text on maintenance/destructive-action cards.
- Nearly invisible toolbar buttons (for example New Material and Audit Logs).
- Low-contrast pagination.
- Inconsistent green/turquoise and grey surfaces.
- Oversized page titles/header sections wasting vertical space.
- CRM lead detail page with excessive unused space and detached Requirements & Notes.
- Vendor registration modal with unexpected dark body and low-contrast controls.
- Similar styling issues on inventory, reports, scrap, QC, vendor, maintenance, and finished-goods pages.
- Administration header/tabs/KPI spacing consuming too much of the first viewport.

Fix shared causes first, then verify every affected route.

## 20. Acceptance Criteria

Application-wide work is complete only when:

1. Shared tokens are consistent; competing palettes are removed or justified.
2. Important text and icons remain visible on every surface.
3. Active, hover, focus, disabled, and loading states are distinct.
4. Ordinary operational pages use consistent compact headers.
5. No unintended page-level horizontal overflow exists at required viewports.
6. Forms, dialogs, tables, and navigation work across devices.
7. Loading, empty, error, forbidden, not-found, and conflict states are handled.
8. Backend data and state remain authoritative.
9. QC, production, packing, warehouse, finance, service, and destructive-action gates are preserved.
10. RBAC, audit history, and serial genealogy remain intact.
11. Every actual route is represented in the verification tracker.
12. Test/build results are reported honestly.
13. No route is marked verified without evidence.
14. No mock page or hardcoded sample data replaces a working screen.
15. The implementation agent changes the code instead of stopping at documentation.

## 21. Master Instruction to the Implementation Agent

Use this document together with the existing KYRA ZAM 2.0 UI/UX Design System and UX Flow & Responsive UI Standard.

First inspect the real repository and create an accurate route/component/workflow inventory. Fix shared components and tokens before route-specific issues. Implement small testable stages while preserving APIs, RBAC, state machines, manufacturing rules, audit history, serial genealogy, and financial/warehouse gates.

Do not blindly replace colours, remove valid disabled states, invent endpoints, fabricate test data, or claim success without backend confirmation. Do not stop after an audit report. Make code changes, run available checks, verify affected routes, and update the tracker with actual results.

**Final goal:** KYRA ZAM 2.0 should feel like one coherent, reliable industrial ERP/MES—not a collection of separately styled pages. Every authorised user should be able to identify records, complete valid work, understand system state, recover from errors, and proceed to the next valid workflow step confidently.
