---
id: REQ-ADMIN-013
title: "Dashboard renderer fails closed without permission and renders a composition-driven operational landing page"
status: Proposed
date: 2026-05-08
slug: req-admin-013-dashboard-rendering
category: governance
ears_pattern: ubiquitous
priority: must
risk: high
verification_methods: [test]
compliance:
  - SOC2_CC6.1
  - ISO27001_A.9.4
satisfied_by:
  adr: [ADR-0009]
  conventions: [C-04, C-14]
implements_cross_cutting: [REQ-001, REQ-005]
refines: REQ-ADMIN-002
type: doc
tags: [requirement, capability, admin_management, dashboard, render]
module: admin_management
feature: dashboard
capability: dashboard_rendering
capability_kind: failure_mode
stakeholders:
  - tenant administrator (consumes the dashboard)
  - operator (debugs blank dashboard incidents)
  - compliance auditor (administrative-access control)
---

# REQ ADMIN-013 — Dashboard rendering fail-closed

Status: **Proposed** (2026-05-08)

## Statement

The dashboard feature **shall**:

1. Fail closed (return the typed permission-denied) when a
   request's principal lacks the
   `admin.dashboard:render` (or equivalent) capability;
2. Render the composition-driven operational landing page for an
   authorised principal, including the routes and dashboard widgets
   contributed by registered modules, without reintroducing retired
   Alpine.js interaction attributes;
3. Build the admin-home route catalog by deduplicating
   routes contributed by multiple modules — the same
   route from two contributors collapses to one entry.

The profile feature **shall** apply the same fail-closed
discipline (`admin.profile:render`).

## Rationale

The admin dashboard is the operator's primary surface; a
defective render either leaks the dashboard to non-admin
users or hides it from operators with valid access. Three
properties:

1. **Render-permission gate.** The dashboard is an
   admin-only surface; the gate is the discipline anchor
   that prevents a render from happening for a tenant
   member who shouldn't see it.
2. **Composition-driven landing content.** The dashboard is an
   operational landing page. Agent chat belongs to the
   `platformkit-agent-runtime` admin section; the dashboard must not
   pretend to host the retired, never-shipped prompt-first chat UI.
3. **Route deduplication on the home catalog.** Multiple
   modules can register the same route prefix (e.g., a
   shared "settings" route). The home catalog must
   deduplicate so the operator sees one tile, not two
   identical tiles.

## Acceptance criteria

- **AC-1 — Dashboard fails closed without permission.**
  A render request from a principal without the
  dashboard capability returns the typed
  permission-denied; no widgets are rendered.
- **AC-2 — Dashboard renders for authorised
  operator.** A render request from a principal with
  the capability produces the populated workspace.
- **AC-3 — Profile fails closed without
  permission.** Same gate applies to profile.
- **AC-4 — Profile renders for authorised
  operator.** Profile renders for a holder of the
  capability.
- **AC-5 — Modern interaction contract.** Dashboard content contains
  no retired Alpine.js directives or inline click handlers; interactive
  behavior uses the platform HTMX + Stimulus path.
- **AC-6 — Home route catalog dedupes.** A graph
  with two modules contributing the same route
  produces a single catalog entry.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `modules/platformkit-business-modules/admin_management/admin_dashboard_test.go::TestRenderDashboardFailsClosedWithoutPermission`. |
| AC-2 | Test | `modules/platformkit-business-modules/admin_management/admin_dashboard_test.go::TestRenderDashboardAllowsAuthorizedOperator`. |
| AC-3 | Test | `modules/platformkit-business-modules/admin_management/admin_dashboard_test.go::TestRenderProfileFailsClosedWithoutPermission`. |
| AC-4 | Test | `modules/platformkit-business-modules/admin_management/admin_dashboard_test.go::TestRenderProfileAllowsAuthorizedOperator`. |
| AC-5 | Test | `modules/platformkit-business-modules/admin_management/admin_dashboard_test.go::TestRenderDashboardContentRejectsRetiredAlpineMarkers`. |
| AC-6 | Test | `modules/platformkit-business-modules/admin_management/admin_dashboard_test.go::TestBuildAdminHomeRouteCatalogDedupesRoutes`. |

## Edge cases & unhappy paths

- **Module contributes zero widgets.** The
  dashboard renders the layout without those widgets;
  the operator sees the rest.
- **Permission resolver unavailable.** Treated as
  fail-closed (REQ-005) — the dashboard refuses to
  render rather than silently allowing.
- **Tenant has no admin user.** The dashboard render
  is inaccessible; this is the documented expected
  state for tenants that haven't completed
  onboarding.

## Risk

- **Likelihood:** High — every admin login.
- **Impact:** Critical — defective render either
  leaks operator data or breaks operator access.
- **Mitigations:** Permission-gate on every render
  (AC-1, AC-3), authorised-render coverage (AC-2,
  AC-4), modern interaction contract (AC-5).

## Implements (cross-cutting)

- **REQ-001 — Multi-tenant isolation.** Dashboard is
  tenant-scoped.
- **REQ-005 — Fail-closed.** AC-1, AC-3 are the
  explicit gate.

## Compliance mapping

| Control | Coverage |
|---|---|
| SOC2 CC6.1 (Logical access) | AC-1, AC-3 — admin surface gated. |
| ISO27001 A.9.4 (Access control) | AC-2, AC-4 — only authorised principals see admin content. |

## Satisfied by

- `modules/platformkit-business-modules/admin_management/admin_dashboard.go` (render orchestration).
- `modules/platformkit-business-modules/admin_management/features/dashboard/feature.go` — wiring.

## Related requirements

- [REQ-ADMIN-002 — Dashboard](./REQ-ADMIN-002-dashboard.md)
- [REQ-ADMIN-008 — Profile](./REQ-ADMIN-008-profile.md)
- [REQ-018 — Renderable entities fail closed](./REQ-018-permission-coverage-fail-closed.md)
