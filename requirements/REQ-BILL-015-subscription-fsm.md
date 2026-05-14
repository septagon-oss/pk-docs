---
id: REQ-BILL-015
title: "Subscription FSM enforces declared transitions and refuses unknown source states"
status: Proposed
date: 2026-05-08
slug: req-bill-015-subscription-fsm
category: billing
ears_pattern: state-driven
priority: must
risk: high
verification_methods: [test]
compliance:
  - SOC2_CC6.1
  - SOC2_CC8.1
satisfied_by:
  adr: [ADR-0009]
  conventions: [C-04, C-14]
implements_cross_cutting: [REQ-005]
refines: REQ-BILL-001
type: doc
tags: [requirement, capability, billing_management, subscriptions, fsm]
module: billing_management
feature: subscriptions
capability: subscription_fsm
capability_kind: state_machine
stakeholders:
  - subscription service (consumer)
  - support engineer (debugs blocked transitions)
  - finance team (revenue-recognition correctness)
---

# REQ BILL-015 — Subscription state machine

Status: **Proposed** (2026-05-08)

## Statement

The subscriptions feature **shall** expose
`ValidateTransition(from, to)` as the single
source of truth for legal subscription state
transitions. The FSM **shall**:

1. Allow the documented forward transitions:
   - `trialing → active` (trial conversion)
   - `active → past_due` (payment failure)
   - `past_due → active` (payment recovered)
   - `past_due → unpaid` (extended failure)
   - `unpaid → active` (payment recovered)
   - `active → canceling` (at-period-end cancel)
   - `canceling → canceled` (period boundary
     reached)
   - `active → canceled` (immediate cancel)
   - `canceled → active` (within-grace
     reactivation, REQ-BILL-011 AC-7)
2. Refuse undocumented transitions
   (`canceled → past_due`, `canceled → trialing`,
   etc.) with the typed
   `invalid transition` error;
3. Refuse transitions from unknown source states
   with the typed `unknown subscription status`
   error so a corrupt row cannot silently
   succeed.

The lifecycle service operations
(REQ-BILL-011, REQ-BILL-012, REQ-BILL-013)
**shall** call `ValidateTransition` before
persisting any status change.

## Rationale

The FSM is the discipline anchor for "what
subscription transitions are legal?". Three
properties:

1. **Centralised refusal.** Every state-change
   path (cancel, reactivate, plan-change,
   payment-event handlers) consults the same
   validator. Without the central function,
   each path would drift over time and the
   acceptance criteria would diverge.
2. **Forward-only-on-paper.** The graph is
   acyclic except for the deliberate
   round-trips (`active ↔ past_due`,
   `canceled → active` within grace). Refusing
   undeclared edges keeps the lifecycle
   reasoning tractable.
3. **Unknown-source rejection.** A subscription
   row with a status that is none of the
   known values is corrupt; transitioning from
   it would lock in the corruption. The FSM
   refuses, surfacing the row to operators.

## Acceptance criteria

- **AC-1 — Valid transitions accepted.** The
  declared forward set returns nil from
  `ValidateTransition`.
- **AC-2 — Invalid transitions refused.**
  Undeclared transitions return the typed
  `invalid transition` error.
- **AC-3 — Unknown source state refused.** A
  transition from an unknown status returns
  the typed `unknown subscription status`
  error.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `pk-modules/billing_management/features/subscriptions/subscription_fsm_test.go::TestValidateTransition_ValidTransitions`. |
| AC-2 | Test | `pk-modules/billing_management/features/subscriptions/subscription_fsm_test.go::TestValidateTransition_InvalidTransitions`. |
| AC-3 | Test | `pk-modules/billing_management/features/subscriptions/subscription_fsm_test.go::TestValidateTransition_UnknownStatus`. |

## Edge cases & unhappy paths

- **Same-state transition.** Treated as legal
  (a no-op write) for idempotent paths;
  callers should not rely on this.
- **Schema growth.** Adding a new status (e.g.
  `frozen`) requires updating the FSM table
  in the same commit; the test suite catches
  the omission.
- **Custom states from data migration.** If a
  data migration introduced a status the FSM
  doesn't know, AC-3 refuses; operators must
  remediate the row.
- **Bidirectional payment-cycle round-trips.**
  `active ↔ past_due` is allowed; the FSM
  models real-world recovery flow.

## Risk

- **Likelihood:** Medium — every status change
  consults the FSM.
- **Impact:** High — defective transitions
  corrupt the subscription state and break
  every downstream gate.
- **Mitigations:** Centralised validator
  (AC-1, AC-2), unknown-source rejection
  (AC-3), test coverage on every documented
  edge.

## Implements (cross-cutting)

- **REQ-005 — Fail-closed.** AC-2, AC-3 —
  undeclared / unknown transitions are
  refused.

## Compliance mapping

| Control | Coverage |
|---|---|
| SOC2 CC6.1 (Logical access) | AC-2 — only documented transitions accepted. |
| SOC2 CC8.1 (Change management) | AC-1 — every status change auditable through the FSM. |

## Satisfied by

- `pk-modules/billing_management/features/subscriptions/subscription_fsm.go::ValidateTransition`.

## Related requirements

- [REQ-BILL-010 — Subscription create](./REQ-BILL-010-subscription-create.md)
- [REQ-BILL-011 — Subscription lifecycle](./REQ-BILL-011-subscription-lifecycle.md)
- [REQ-BILL-012 — Plan change](./REQ-BILL-012-plan-change.md)
- [REQ-BILL-013 — Payment-status events](./REQ-BILL-013-payment-status.md)
