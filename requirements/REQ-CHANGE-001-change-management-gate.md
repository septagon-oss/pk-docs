---
id: REQ-CHANGE-001
title: "Every governed mutation flows through change_management with an approval workflow lookup"
status: Active
date: 2026-05-10
slug: req-change-001-change-management-gate
category: governance
ears_pattern: ubiquitous
verification_methods:
  - test
  - analysis
satisfied_by:
  adr: []
  conventions: []
type: doc
tags: [requirement, governance, change-management]
---

# REQ CHANGE-001 — Every governed mutation flows through change_management with an approval workflow lookup

Status: **Active** (2026-05-10)

## Statement

Every producer-side mutation that the platform classifies as governed
**shall** be submitted via `change_management.ChangeService.SubmitChange`
before the underlying side effect is applied. The change_management
module **shall** look up the per-`ChangeType` workflow and either:

1. apply the mutation inline (Tier 2 — `AutoApprove=true`, audit-only), or
2. persist a `ChangeRecord(status=pending)` and create a paired
   `ApprovalRequest`, returning `ErrPendingApproval` to the caller
   (Tier 1 — approval-required), or
3. allow the producer to bypass entirely (Tier 3 — fire-and-forget,
   reads, reconciliation jobs).

In all three tiers the producer's `ApplyChange` callback **shall** emit
an `audit.change.tracked` event via `ports.AuditBoundaryRecorder` so
that the entity history reflects the mutation regardless of approval
shape.

## Rationale

Without a uniform gate, every module reinvents approval handling
ad-hoc — one stores audit events, another sends Slack messages, a
third silently mutates and hopes someone notices in the audit trail.
That divergence makes "what happens when an operator deletes a
tenant?" answerable only by reading every callsite. The gate makes
the answer the same everywhere.

The three-tier model exists because not every mutation is
approval-worthy: read-after-read reconciliation (Tier 3), bulk
display-name updates (Tier 2), and tenant deletion (Tier 1) each
need different friction. Forcing one tier on all of them is wrong;
forcing producers to declare which tier each mutation lives in is
the discipline.

## Acceptance criteria

- **AC-1** Every producer service in `pk-modules`
  with mutating operations registers a `ChangeHandlerProvider` via
  `ChangeRegistrar.RegisterChangeProvider` at module-init time.
- **AC-2** A Tier-1 mutation called via the producer's public API
  returns `apperrors.ApprovalRequired(changeID)` rather than applying
  the change. The HTTP middleware maps this to `202 Accepted`.
- **AC-3** A Tier-2 mutation applies inline and persists a
  `ChangeRecord(status=applied)` plus an `audit.change.tracked` event.
- **AC-4** Approving a pending `ChangeRecord` triggers
  `ChangeDispatcher.OnApproved` which calls the producer's
  `ApplyChange(ctx, request)` and updates `ChangeRecord.Status` to
  `applied` (or `apply_failed` on error).
- **AC-5** When `change_management` is absent from a composition,
  producers fall back to the audited direct-apply path with audit
  emission preserved (lean install).

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Analysis | `make check-module-port-event-audit` enumerates registered providers per module. |
| AC-2 | Test | `tenant_management/features/tenant_lifecycle/service_test.go` asserts `ErrPendingApproval` for `DeleteTenant`. |
| AC-3 | Test | `change_management/features/change_tracking/service_test.go` asserts inline apply + audit event. |
| AC-4 | Test | `change_management/tests/e2e/approval_flow_test.go`. |
| AC-5 | Test | Lean composition smoke test in `tenant_management/tests/`. |

## Satisfied by

- (Pending) ADR documenting the change_management gate.
- `pk-modules/change_management/` — the gate
  implementation.
- `pk-modules/audit_management/features/change_approval/` —
  the human-decision surface the gate consumes.

## Related requirements

- [REQ-004 — Audit event per mutation](REQ-004-audit-event-per-mutation.md) —
  every tier emits `audit.change.tracked`; this REQ guarantees the
  emission point.
- [REQ-TENANT-GATE-001 — Tenant mutations classified into the three-tier policy](REQ-TENANT-GATE-001-tenant-three-tier-policy.md) —
  the canonical first consumer.

## References

- `pk-modules/ports/change.go` — interface definitions.
- May 2026 change_management module landing.
