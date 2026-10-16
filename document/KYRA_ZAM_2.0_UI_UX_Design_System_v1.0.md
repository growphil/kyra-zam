# KYRA ZAM 2.0 — UI/UX Design System & Implementation Standard

**Version:** 1.0  
**Status:** Baseline specification — validate against the live repository before implementation  
**Purpose:** Single UI/UX source of truth for every role, module, and page.

## 1. Design principles
- One shared brand theme across all roles and modules.
- Dark navy sidebar, light-blue workspace, white surfaces.
- Operational clarity over decoration.
- Reuse existing components and design tokens.
- Preserve real API data, routes, permissions, validation, state transitions, and audit behavior.
- Desktop factory workstation first, with reliable tablet/mobile behavior.
- Semantic status colors are universal and never change by role.
- Avoid fake metrics, excessive gradients, oversized cards, and decorative clutter.

## 2. Brand color tokens

| Token | Hex | Usage |
|---|---|---|
| Sidebar / deep navy | `#061B3A` | Sidebar and strong navigation surfaces |
| Primary blue | `#0878F9` | Primary actions, active navigation, links, focus accents |
| Primary hover | `#0667DB` | Hover/pressed primary controls |
| Light-blue tint | `#EAF5FF` | Soft highlights |
| Application canvas | `#F4F9FF` | Main background |
| Surface | `#FFFFFF` | Cards, forms, tables, dialogs |
| Primary text | `#0B2148` | Headings and key values |
| Secondary text | `#526B91` | Supporting text |
| Muted text | `#64748B` | Metadata |
| Border | `#D8E8FA` | Borders and separators |
| Solar yellow | `#FFC928` | Small brand highlights; dark text on yellow |

### Universal semantic status colors

| State | Foreground | Background |
|---|---|---|
| Success/passed/approved | `#166534` | `#DCFCE7` |
| In progress/information | `#1D4ED8` | `#DBEAFE` |
| Pending/waiting/retest | `#92400E` | `#FEF3C7` |
| Failed/rejected/critical | `#991B1B` | `#FEE2E2` |
| Draft/inactive/neutral | `#475569` | `#F1F5F9` |
| On hold | `#9A3412` | `#FFEDD5` |

Never communicate state through color alone. Validate rendered contrast before release.

## 3. Typography

Preferred: Inter or DM Sans, reusing the existing loaded font where possible. Use monospace for serials and telemetry.

| Element | Size | Weight |
|---|---:|---:|
| Page title | 28–32px | 700 |
| Section heading | 18–20px | 600–700 |
| Card heading | 15–16px | 600 |
| KPI value | 28–32px | 700 |
| Body/form | 14px | 400–500 |
| Sidebar label | 14px | 500 |
| Table header | 12–13px | 600 |
| Table data | 13–14px | 400–500 |
| Helper text | 12px | 400 |
| Status badge | 11–12px | 600 |
| Serial/telemetry | 12–14px | 500–600 |

## 4. Layout and spacing

- Expanded sidebar: 230px
- Collapsed sidebar: 72px
- Header: 64–72px
- Main content padding: 16–24px
- Card padding: 16–20px
- Grid gap: 16px
- Card radius: 10–12px
- Input/button height: 40–44px
- Input radius: 8px
- Small-screen breakpoint baseline: 768px

Use responsive grids, avoid page-level horizontal overflow, use responsive table/card layouts, and respect reduced-motion preferences.

## 5. Application shell
- Sidebar uses `#061B3A`; active item uses `#0878F9` with white text.
- Inactive navigation uses white/light-slate text and icons.
- Preserve the original KYRA ESS logo colors.
- Support collapsed navigation, tooltips, keyboard navigation and mobile drawer.
- Header contains relevant global search, notifications and account controls.
- Every page has a concise title, optional breadcrumb, context and a primary action where relevant.
- Menu visibility is not a substitute for backend authorization.

## 6. Shared component rules
Standardize buttons, inputs, selects, cards, tables, filters, pagination, dialogs, drawers, badges, toasts, skeletons, empty/error states, QR scanners and audit timelines. Reuse existing components and libraries wherever practical.

## 7. Tables and forms
- Search/filter/sort/page where appropriate.
- Put key identifiers and status early in tables.
- Right-align numeric values and use consistent units/date formats.
- Show field labels, required indicators, validation and helper text.
- Validate on both client and server.
- Preserve user input on recoverable errors.
- Confirm high-impact operations before submission.

## 8. Role-based UX
All roles share the same brand theme, typography, components and semantic status colors. Role differences belong in permissions, navigation, queues, filters and task content—not independent themes.

UX priorities:
- Inventory: batches, GRN, serials, locations and transfers.
- Test Engineer: scan-first testing, measurements, tolerances, import/retest.
- Assembly: work orders, station, cell slots, scan validation.
- Pax Test: test procedure, measurements, safety and results.
- QC: inspection queue, defects, evidence and disposition.
- Packing: eligible queue, scan, material checklist, box checklist, sticker, FG transfer.
- Supervisor: readiness, schedule, assignments and bottlenecks.
- Sales/Marketing: leads, customers, quotations and order progress.
- Purchase: requisitions, supplier POs and GRN.
- Accountant: invoices, receipts, reconciliation and clearance.
- Admin/Superadmin: settings, access, audit and platform health.

The live RBAC schema is authoritative.

## 9. Module patterns
- Inward/testing: batch identity, vendor, quantities, serialization, OCV/IR/Ah, tolerance and disposition.
- Production/assembly: work-order readiness, material availability, station and cell-position binding.
- Pax testing/QC/packing: EOL/QC gates, defect history, persisted checklists, sticker linked to existing Pax identity, warehouse transaction integration.
- Finance/dispatch: invoice/payment/clearance states, explicit dispatch blockers and authorization.
- Service/warranty: serial lookup, warranty, intake evidence, diagnosis, parts, repair, retest and delivery history.

## 10. States and accessibility
Provide loading, empty, no-results, validation-error, permission-denied, API-error, offline, conflict and success states. Use visible focus, semantic HTML, accessible labels, logical tab order, sufficient contrast and text/icon in addition to status color.

## 11. Engineering constraints
- Follow the existing Next.js App Router and project conventions.
- Keep strict TypeScript and TS/TSX-only policy if required by the repository.
- Centralize design tokens; avoid one-off hex values.
- Preserve APIs, query behavior, WebSockets, auth, routes and business logic.
- Do not add dependencies without checking existing packages.
- Do not add mock data or placeholder production endpoints.

## 12. Migration sequence
1. Audit routes, roles, components and tokens.
2. Implement tokens and typography.
3. Migrate sidebar, navbar and page headers.
4. Standardize tables, forms, cards, dialogs and feedback states.
5. Migrate operational modules.
6. Migrate commercial modules.
7. Migrate administration and reporting.
8. Run regression, responsive, accessibility and build checks.
9. Track every page as migrated, verified, blocked or not reviewed.

## 13. Acceptance criteria
- All pages use shared palette, typography, spacing and component behavior.
- All roles retain correct routes and permissions.
- Real API data and existing workflows remain functional.
- Loading/error/empty/permission states are covered.
- Critical workflow gates remain backend-enforced.
- Desktop/tablet/mobile layouts are verified.
- Typecheck, lint, build and relevant tests pass or failures are documented.

## Appendix: CSS tokens

```css
:root {
  --color-sidebar: #061B3A;
  --color-primary: #0878F9;
  --color-primary-hover: #0667DB;
  --color-primary-soft: #EAF5FF;
  --color-app-bg: #F4F9FF;
  --color-surface: #FFFFFF;
  --color-text: #0B2148;
  --color-text-secondary: #526B91;
  --color-text-muted: #64748B;
  --color-border: #D8E8FA;
  --color-brand-highlight: #FFC928;
  --color-success-text: #166534;
  --color-success-bg: #DCFCE7;
  --color-info-text: #1D4ED8;
  --color-info-bg: #DBEAFE;
  --color-warning-text: #92400E;
  --color-warning-bg: #FEF3C7;
  --color-danger-text: #991B1B;
  --color-danger-bg: #FEE2E2;
  --color-neutral-text: #475569;
  --color-neutral-bg: #F1F5F9;
  --font-ui: Inter, "DM Sans", system-ui, sans-serif;
  --font-mono: "SFMono-Regular", Consolas, monospace;
  --sidebar-width: 230px;
  --sidebar-width-collapsed: 72px;
  --header-height: 68px;
  --radius-card: 12px;
  --radius-control: 8px;
  --space-page: 24px;
  --space-card: 18px;
  --space-grid: 16px;
}
```

## Appendix: Page checklist
- [ ] Page and role are listed in the route inventory.
- [ ] Title, breadcrumb and primary action are clear.
- [ ] Shared tokens are used.
- [ ] Typography and spacing match standards.
- [ ] Loading, empty, error and permission states exist.
- [ ] Tables/forms work and are responsive.
- [ ] Keyboard focus, labels and contrast are checked.
- [ ] Real API and authorization behavior are preserved.
- [ ] High-impact actions are confirmed and server-validated.
- [ ] Desktop/tablet/mobile layouts are verified.
- [ ] Tests and build checks are recorded.
