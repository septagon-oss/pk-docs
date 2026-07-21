---
id: REQ-ENTITLE-001
title: "Grants feature owns commerce-tier entitlement lifecycle (grant / suspend / revoke) with append-only history"
status: Proposed
date: 2026-05-07
slug: req-entitle-001-grants
category: tenancy
ears_pattern: ubiquitous
verification_methods: [test, inspection]
compliance: []
satisfied_by:
  adr: [ADR-0009]
  conventions: [C-04, C-14]
implements_cross_cutting: [REQ-001, REQ-004]
type: doc
tags: [requirement, feature, entitlement]
module: entitlement
feature: grants
---

# REQ ENTITLE-001 — Grants

Status: **Proposed** (2026-05-07)

## Statement

The grants feature **shall** own the commerce-tier entitlement
record lifecycle for buyers — `Grant`, `Suspend`, `Revoke`. The
service **shall** be idempotent on `(buyer, tier, source_order_id)`
when `source="order"` (a duplicate webhook delivery collapses
into `ErrEntitlementAlreadyGranted`, which callers must treat as
success without re-emitting events). Revocation **shall** be
terminal; subsequent mutations on a revoked row return
`ErrEntitlementTerminal`. Every state transition **shall** write
an append-only row to `entitlement_grant_history`.

## Rationale

Entitlements are the durable record of "this buyer has paid for
this tier" — the data downstream features check before serving
gated capabilities. Idempotency on the order id is the load-bearing
property because payment webhooks retry; without it, a single
purchase could grant the same entitlement twice. Terminal
revocation prevents support-flow ambiguity ("did we un-revoke or
re-grant?").

## Acceptance criteria

- **AC-1** `Grant` with a duplicate `(buyer, tier, source_order_id)`
  collapses to `ErrEntitlementAlreadyGranted`; the caller is
  expected to treat it as success.
- **AC-2** `Revoke` is terminal — a subsequent `Grant` on the same
  row (or any other state-changing call) returns
  `ErrEntitlementTerminal`.
- **AC-3** Every status transition writes a row to
  `entitlement_grant_history`. The history write is best-effort
  (a failed history write does not roll back the transition) so
  the entitlement row remains the source of truth and audit
  reconciliation can replay from it.
- **AC-4** Events publish via `event.PublishBestEffort` (the
  current workspace standard); the M6 upgrade target is
  `internal/outbox` so publish joins the same transaction as the
  state change.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `pk-modules/entitlement/features/grants/service_test.go::TestIsNotFound` covers the duplicate-order-idempotency path. |
| AC-2 | Test | `pk-modules/entitlement/features/grants/service_test.go::TestIsNotFound` covers the terminal-revoke branch. |
| AC-3 | Test | `pk-modules/entitlement/features/grants/service_test.go::TestIsNotFound` covers history-row writes; the best-effort behaviour is documented in the service comment block. |
| AC-4 | Inspection | `service.go` uses `event.PublishBestEffort`; reviewers verify the M6 outbox migration is still tracked as an open follow-up. |

## Implements (cross-cutting)

- REQ-001 — multi-tenant isolation (entitlements scope to tenant via the buyer reference).
- REQ-004 — audit per mutation (history rows + events).

## Satisfied by

- `entitlement/features/grants/feature.go`
- `entitlement/features/grants/service.go`,
  `service_test.go`, `subscriber_test.go`
- `entitlement/features/grants/permissions.go`,
  `routes.go`

## Related requirements

- [REQ-BILL-001 — Subscriptions](./REQ-BILL-001-subscriptions.md) — the upstream payment-state machine that drives grant emission.
