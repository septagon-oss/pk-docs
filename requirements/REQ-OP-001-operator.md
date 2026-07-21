---
id: REQ-OP-001
title: "Operator feature exposes the cross-tenant control plane to platform operators"
status: Proposed
date: 2026-05-07
slug: req-op-001-operator
category: governance
ears_pattern: ubiquitous
verification_methods: [test, inspection]
compliance: [SOC2_CC6.1, ISO27001_A.9.4]
satisfied_by:
  adr: [ADR-0009]
  conventions: [C-04, C-14]
implements_cross_cutting: [REQ-005, REQ-007]
type: doc
tags: [requirement, feature, operator]
module: operator
feature: operator
---

# REQ OP-001 — Operator

Status: **Proposed** (2026-05-07)

## Statement

The operator feature **shall** expose the cross-tenant control
plane that platform operators use to investigate incidents, run
support actions, and audit tenant state. Every operator action
**shall** be authenticated against the operator credential pool
(separate from regular tenant identities), audited as a
cross-tenant access (REQ-007), and labelled with the operator's
ticket reference. The feature **shall** refuse to render any
tenant-scoped data unless the operator has explicitly entered
that tenant via `WithExpectedCrossTenantAccess`.

## Rationale

Operator access is the most-privileged surface — operators see
across tenants, run support actions, and can break things. The
discipline of explicit tenant-entry plus ticket-reference labelling
keeps the audit trail useful: a year later, "why did Joana view
Acme's billing in Q1?" is answerable by ticket id, not by
inference.

## Acceptance criteria

- **AC-1** Operator authentication uses a separate credential pool
  from tenant identities; a tenant credential cannot reach the
  operator surface.
- **AC-2** Cross-tenant reads require an explicit
  `WithExpectedCrossTenantAccess(reason)` and are audited as
  cross-tenant accesses.
- **AC-3** Operator pages render through the platform's
  `ports.SurfaceRenderer` indirection (see `page.go::PageRenderer`);
  the page itself is a thin wrapper that emits the renderer's
  `presentation.SurfaceUpdate`. A lean composition without an
  operator wiring still boots the admin shell — the page surfaces
  a "no renderer configured" banner instead of crashing.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Inspection | Code review of the operator-auth wiring; reviewers verify the credential pool is independent of `auth_management`. |
| AC-2 | Test | `pk-modules/operator/features/operator/html_handler_test.go::TestNewHTMLRenderHandler_SwapsToOperatorPrincipal` covers the cross-tenant entry guard. |
| AC-3 | Test | `pk-modules/operator/features/operator/page_test.go::TestOperatorPagePreview_NilRenderer` covers default-landing behaviour. |

## Implements (cross-cutting)

- REQ-005 — fail-closed on missing tenant entry.
- REQ-007 — explicit cross-tenant access.

## Satisfied by

- `pk-modules/operator/features/operator/handler.go`,
  `html_handler.go`, `html_handler_test.go`
- `pk-modules/operator/features/operator/page.go`, `page_test.go`

## Related requirements

- [REQ-007 — Explicit cross-tenant access](./REQ-007-explicit-cross-tenant-access.md) — the cross-cutting discipline.
