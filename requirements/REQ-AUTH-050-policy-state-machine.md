---
id: REQ-AUTH-050
title: "Policy change state machine drives every policy mutation through draft → submitted → approved → applied"
status: Proposed
date: 2026-05-08
slug: req-auth-050-policy-state-machine
category: auth
ears_pattern: state-driven
priority: must
risk: high
verification_methods: [test, inspection]
compliance:
  - SOC2_CC8.1   # Change management
  - ISO27001_A.6.3
satisfied_by:
  adr: [ADR-0009]
  conventions: [C-04, C-14]
implements_cross_cutting: [REQ-001, REQ-004, REQ-005, REQ-007]
refines: REQ-AUTH-005
type: doc
tags: [requirement, capability, auth_management, policy, state-machine]
module: auth_management
feature: policy
capability: state_machine
capability_kind: state_machine
stakeholders:
  - tenant administrator (proposes the change)
  - operator-reviewer (approves)
  - compliance auditor (change-management evidence)
---

# REQ AUTH-050 — Policy change state machine

Status: **Proposed** (2026-05-08)

## Statement

Every policy mutation **shall** flow through the explicit state
machine `draft → submitted → impact_ready → approved →
canary_running → promoted` (with `rejected` and `rolled_back` as
terminal failure branches). State transitions **shall** be
guarded by typed pre-conditions on the request's current state;
illegal transitions **shall** be refused with a typed error.
Each transition **shall** emit the catalogued event
(`policy.change_request.created`,
`policy.change_request.submitted`,
`policy.change_request.approved`,
`policy.rollout.canary_started`,
`policy.rollout.promoted`,
`policy.rollout.rolled_back`).

## Rationale

Policy is the platform's authz blast-radius surface — a
defective policy can grant or deny across thousands of users
in a single deploy. The state-machine discipline is the
defence:

1. **Explicit transitions.** A policy change cannot skip
   from "draft" to "applied"; every state change is
   reviewer-visible and audit-recorded.
2. **Impact-readiness gate.** Before approval, the system
   computes the impact (which users / resources the change
   affects) so the reviewer sees the blast radius.
3. **Canary before promotion.** Approved changes roll out
   to a configured canary subset first; metrics from the
   canary feed the promotion decision (or a rollback).
4. **Rollback as a first-class state.** A promoted change
   that breaks production must be reversible; the rollback
   path is a typed operation with its own audit row.

The companion REQ-AUTH-051 covers the cross-tenant rejection
property; this REQ scopes to the lifecycle.

## Acceptance criteria

- **AC-1 — Forward-only happy path.** A change moves through
  draft → submitted → impact_ready → approved →
  canary_running → promoted; each transition is rejected if
  the current state does not match the documented
  pre-condition.
- **AC-2 — Transition validation.** Each state-changing
  method (`Submit`, `Approve`, `StartCanary`, `Promote`)
  refuses to operate on a request whose current state is
  not the expected predecessor.
- **AC-3 — Reject and withdraw branches.** A submitted
  request can be rejected; a draft can be withdrawn; both
  produce terminal states with their own audit rows.
- **AC-4 — Rollback semantic.** A promoted change can be
  rolled back; the rollback emits the canon event and
  marks the original request as rolled-back without
  mutating its history.
- **AC-5 — Audit completeness.** Every transition publishes
  the catalogued event; reviewers can reconstruct the full
  change history from the event stream.
- **AC-6 — Risk + severity scoring.** Submitted requests
  carry a computed risk score (`computeRisk`) and severity
  band (`severityFromRisk`) so reviewers see the blast
  radius before approving.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Inspection | `service.go` — the four state-changing methods (`Submit`, `Approve`, `StartCanary`, `Promote`) accept only their documented predecessor state. |
| AC-2 | Inspection | Same — each method begins with a state-precondition check. |
| AC-3 | Inspection | `service.go` — `Reject` + `Withdraw` paths produce terminal states. |
| AC-4 | Inspection | `service_rollout.go` — `Rollback` emits `policy.rollout.rolled_back`. |
| AC-5 | Test | `pk-modules/auth_management/features/policy/service_test.go::TestPublishPolicyEvent` exercises the publish primitive that every transition uses. |
| AC-6 | Test | `pk-modules/auth_management/features/policy/service_test.go::TestComputeRiskAndSeverity` covers the scoring path. |

## Edge cases & unhappy paths

- **Concurrent transition race.** Two operators submitting
  the same draft race; whichever lands first transitions to
  submitted, the second sees the precondition mismatch and
  is rejected.
- **Canary signal breach.** A canary whose error rate or
  deny-rate delta exceeds the configured threshold
  (REQ-AUTH-051 mechanism) auto-rolls-back; the rollback
  path is the same one operators invoke manually.
- **Approval threshold not met.** A policy class requiring
  multiple approvals stays in `approved`-pending until the
  count is met; this REQ does not specify the threshold
  count (deployment-configurable).
- **Rollback after rollback.** A rolled-back change cannot
  be re-promoted; the operator must submit a fresh request.

## Risk

- **Likelihood:** Medium — exercised at policy-change cadence.
- **Impact:** Critical — a broken policy applied at scale
  can lock out an entire tenant or grant unintended access.
- **Mitigations:** Explicit transitions (AC-1 + AC-2),
  canary gate (AC-1), rollback path (AC-4), risk scoring
  (AC-6).

## Implements (cross-cutting)

- **REQ-001 — Multi-tenant isolation.** Policies are
  tenant-scoped; the change machine respects that.
- **REQ-004 — Audit per mutation.** AC-5 is the audit trail.
- **REQ-005 — Fail-closed.** AC-2 — illegal transitions
  refused, never silently applied.
- **REQ-007 — Explicit cross-tenant access.** Reviewed via
  REQ-AUTH-051.

## Compliance mapping

| Control | Coverage |
|---|---|
| SOC2 CC8.1 | AC-1..AC-5 — formal change-management discipline with audit trail. |
| ISO27001 A.6.3 | AC-1, AC-4, AC-6 — information-security during change. |

## Satisfied by

- `pk-modules/auth_management/features/policy/service.go` — the
  state-changing API.
- `pk-modules/auth_management/features/policy/service_rollout.go` —
  canary and rollback logic.
- `pk-modules/auth_management/features/policy/service_impact.go` —
  impact-report computation.
- `pk-modules/auth_management/features/policy/service_events.go` —
  the publish primitive.

## Related requirements

- [REQ-AUTH-005 — Policy umbrella](./REQ-AUTH-005-policy.md)
- [REQ-AUTH-051 — Policy cross-tenant guard](./REQ-AUTH-051-policy-cross-tenant.md)
- [REQ-AUDIT-005 — Change approval](./REQ-AUDIT-005-change-approval.md) — the platform's broader change-management surface.
