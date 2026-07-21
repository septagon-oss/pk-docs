---
id: REQ-CHANGE-001
title: "Every governed mutation flows through change with an approval workflow lookup"
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

# REQ CHANGE-001 — Every governed mutation flows through change with an approval workflow lookup

Status: **Active** (2026-05-10)

## Statement

Every producer-side mutation that the platform classifies as governed
**shall** be submitted via the owner-exported
`pk-modules/change/contracts/provides/change_service.go::ChangeService.SubmitChange`
contract
before the underlying side effect is applied. The change module
**shall** look up the per-`ChangeType` workflow and either:

1. apply the mutation inline (Tier 2 — `AutoApprove=true`, audit-only), or
2. persist a `ChangeRecord(status=pending)` and create a paired
   `ApprovalRequest`, returning `ErrPendingApproval` to the caller
   (Tier 1 — approval-required), or
3. allow the producer to bypass entirely (Tier 3 — fire-and-forget,
   reads, reconciliation jobs).

For Tier 1 and Tier 2, the gate **shall** persist the `ChangeRecord` that
captures the decision and final status. The producer remains responsible
for its ordinary domain event and audit obligations under REQ-004; the
change gate does not synthesize a second `audit.change.tracked` event.
Tier-3 operations bypass this gate by definition.

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

- **AC-1** Every producer that classifies a mutation as Tier 1 or Tier 2
  registers the owner-exported `ChangeHandlerProvider` through
  `ChangeRegistrar.RegisterChangeProvider` during composition startup.
- **AC-2** A Tier-1 mutation called via the producer's public API
  returns a `PendingApprovalError` carrying the change ID rather than
  applying the change. Frontend-kit recognises its
  `PendingChangeID()` contract and maps the deferred result to
  `202 Accepted`.
- **AC-3** A Tier-2 mutation applies inline and persists a
  `ChangeRecord(status=applied)`.
- **AC-4** Approving a pending `ChangeRecord` triggers
  `change_tracking.Dispatcher.OnApproved` which calls the producer's
  `ApplyChange(ctx, request)` and updates `ChangeRecord.Status` to
  `applied` (or `apply_failed` on error).
- **AC-5** A producer whose public API exposes Tier-1 or Tier-2 mutations
  declares `ChangeService` and `ChangeRegistrar` as required composition
  dependencies. Missing change-management wiring fails startup; a manually
  constructed producer fails closed before any side effect.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Analysis | `pk-modules/tenant_management/dependencies.go` declares the owner-exported `ChangeService` and `ChangeRegistrar` contracts; `tenant_management/invocations.go` registers the canonical first consumer's provider during composition startup. |
| AC-2 | Test | `pk-modules/tenant_management/features/tenant_lifecycle/service_change_routing_test.go::TestDeleteTenantTier1ReturnsPendingApprovalError`. |
| AC-2 | Inspection | the frontend kit's `renderer/ui/entity_html_handler.go::serveDelete` detects `PendingChangeID()` and returns `202 Accepted`. |
| AC-3 | Test | `pk-modules/change/features/change_tracking/service_test.go::TestSubmitChangeAutoApproveAppliesInline`. |
| AC-4 | Test | `pk-modules/change/features/change_tracking/service_test.go::TestDispatcherOnApprovedAppliesViaProvider` covers the approval callback and applied transition. |
| AC-4 | Inspection | `pk-modules/change/features/change_tracking/dispatcher.go::Dispatcher.OnApproved` calls `MarkApplyFailed` when the producer's `ApplyChange` returns an error. |
| AC-5 | Test | `pk-modules/tenant_management/features/tenant_lifecycle/service_change_routing_test.go::TestGovernedTenantMutationsFailClosedWithoutChangeService` covers every public governed tenant mutation; `TestTenantMutationSourceRejectsDirectApplyFallbacks` prevents reintroduction of optional wiring and direct-apply branches. |

## Satisfied by

- (Pending) ADR documenting the change gate.
- `pk-modules/change/contracts/provides/change.go`
  and
  `pk-modules/change/contracts/provides/change_service.go`
  — the owner-exported registrar, provider, request, record, and
  submission contracts.
- `pk-modules/change/` — the gate
  implementation.
- `pk-modules/audit_management/features/change_approval/` —
  the human-decision surface the gate consumes.

## Related requirements

- [REQ-004 — Audit event per mutation](REQ-004-audit-event-per-mutation.md) —
  producer-owned domain mutation paths retain the platform audit
  obligation independently of this gate's `ChangeRecord` ledger.
- [REQ-TENANT-006 — Tenant mutations classified into the three-tier policy](REQ-TENANT-006-three-tier-change-policy.md) —
  the canonical first consumer.

## References

- `pk-modules/change/contracts/provides/change.go`
  and
  `pk-modules/change/contracts/provides/change_service.go`
  — owner-exported interface definitions.
- May 2026 change module landing.
