---
id: REQ-BILL-011
title: "Subscription lifecycle: cancel immediately or at period-end, reactivate within grace, refuse out-of-state transitions"
status: Proposed
date: 2026-05-08
slug: req-bill-011-subscription-lifecycle
category: billing
ears_pattern: state-driven
priority: must
risk: high
verification_methods: [test]
compliance:
  - SOC2_CC6.1
  - SOC2_CC8.1
  - ISO27001_A.18.1
satisfied_by:
  adr: [ADR-0009]
  conventions: [C-04, C-14]
implements_cross_cutting: [REQ-001, REQ-004, REQ-005]
refines: REQ-BILL-001
type: doc
tags: [requirement, capability, billing, subscriptions, cancel, reactivate]
module: billing
feature: subscriptions
capability: subscription_lifecycle
capability_kind: state_machine
stakeholders:
  - tenant administrator (cancels their subscription)
  - support engineer (reactivates an accidentally-canceled sub)
  - finance team (period-end revenue recognition)
---

# REQ BILL-011 — Subscription cancel + reactivate

Status: **Proposed** (2026-05-08)

## Statement

The subscriptions feature **shall** expose two
lifecycle transitions:

1. **`CancelSubscription(subscriptionID, req)`** — read
   the row, determine the cancellation mode (immediate
   vs. at-period-end), record the optional `reason` in
   metadata, and persist:
   - **Immediate cancel** — set `Status = canceled`
     and `CanceledAt = now`;
   - **At-period-end cancel** — set
     `Status = canceling` (so the subscription stays
     usable until `CurrentPeriodEnd`) and stamp
     `CanceledAt = now`;
   - **Already-canceled** — return idempotent success
     without re-writing the row;
   - **Not-found** — wrapped not-found error;
2. **`ReactivateSubscription(subscriptionID)`** — read
   the row and reactivate when the subscription is in
   one of the recoverable states:
   - **Canceling** — flip `Status = active`,
     clear `CanceledAt`, persist;
   - **Canceled within grace period** — same as
     above, plus reset the period boundaries to a
     fresh window;
   - **Canceled past grace period** — refuse with
     the typed `grace period expired` error;
   - **Not canceled** — refuse with the typed
     `subscription is not canceled` error;
   - **Not-found** — wrapped not-found error.

The grace period **shall** be the documented
re-instatement window (currently the
`Config.GracePeriodDays` setting); past that, the
operator must create a new subscription rather than
resurrect the old one.

## Rationale

Subscription cancel-and-reactivate is the
edge of the billing trust boundary. Three
properties:

1. **Cancel mode preserves grace.**
   At-period-end cancellation honours the
   subscriber's already-paid period; immediate
   cancellation forfeits the remainder. The
   service makes both shapes available so the
   admin UX can pick.
2. **Reactivate has a grace window.** A
   subscriber who cancels by mistake should be
   able to undo without re-onboarding; past the
   grace window, the audit trail's "cancelled,
   then reactivated months later" shape is
   confusing and the right answer is a fresh
   subscription.
3. **State-machine refusal.** Trying to cancel
   an already-canceled subscription, or
   reactivate one that was never canceled, are
   typed errors that the UI can surface clearly.

## Acceptance criteria

- **AC-1 — Cancel immediately.** A
  `CancelSubscription` with `CancelImmediately =
  true` flips `Status = canceled` and sets
  `CanceledAt = now`.
- **AC-2 — Cancel at period end.** A
  `CancelSubscription` with `CancelImmediately =
  false` flips `Status = canceling` and sets
  `CanceledAt = now`; the subscription stays
  usable until `CurrentPeriodEnd`.
- **AC-3 — Already-canceled is idempotent.** A
  cancel against an already-canceled
  subscription returns the existing row without
  re-writing.
- **AC-4 — Cancel without reason.** A cancel
  with no `Reason` works; the metadata field is
  left empty.
- **AC-5 — Cancel not-found.** A cancel against
  a missing id returns the wrapped not-found
  error.
- **AC-6 — Reactivate canceling.** A
  reactivate against a `canceling` subscription
  flips `Status = active` and clears
  `CanceledAt`.
- **AC-7 — Reactivate within grace.** A
  reactivate against a `canceled` subscription
  whose `CanceledAt` is within the grace window
  flips `Status = active`, clears `CanceledAt`,
  and resets the period boundaries.
- **AC-8 — Grace expired.** A reactivate
  against a `canceled` subscription whose
  `CanceledAt` is past the grace window returns
  the typed `grace period expired` error; the
  row is unchanged.
- **AC-9 — Reactivate not-canceled.** A
  reactivate against an `active` subscription
  returns the typed `subscription is not
  canceled` error.
- **AC-10 — Reactivate not-found.** A
  reactivate against a missing id returns the
  wrapped not-found error.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `pk-modules/billing/features/subscriptions/service_test.go::TestCancelSubscription_Immediately`. |
| AC-2 | Test | `pk-modules/billing/features/subscriptions/service_test.go::TestCancelSubscription_AtPeriodEnd`. |
| AC-3 | Test | `pk-modules/billing/features/subscriptions/service_test.go::TestCancelSubscription_AlreadyCanceled`. |
| AC-4 | Test | `pk-modules/billing/features/subscriptions/service_test.go::TestCancelSubscription_WithoutReason`. |
| AC-5 | Test | `pk-modules/billing/features/subscriptions/service_test.go::TestCancelSubscription_NotFound`. |
| AC-6 | Test | `pk-modules/billing/features/subscriptions/service_test.go::TestReactivateSubscription_CancelingSubscription`. |
| AC-7 | Test | `pk-modules/billing/features/subscriptions/service_test.go::TestReactivateSubscription_CanceledWithinGracePeriod`. |
| AC-8 | Test | `pk-modules/billing/features/subscriptions/service_test.go::TestReactivateSubscription_GracePeriodExpired`. |
| AC-9 | Test | `pk-modules/billing/features/subscriptions/service_test.go::TestReactivateSubscription_NotCanceled`. |
| AC-10 | Test | `pk-modules/billing/features/subscriptions/service_test.go::TestReactivateSubscription_NotFound`. |

## Edge cases & unhappy paths

- **Subscription FSM violation.** The state
  machine is enforced by
  `subscription_fsm_test.go::TestValidateTransition_*`;
  any unknown transition is refused.
- **Cancel on a trialing subscription.** Allowed;
  the trial period is forfeited.
- **Reactivate after upgrade.** Plan changes that
  occurred during the cancellation window are
  preserved; the reactivate does not roll back the
  plan.
- **Concurrent cancel + reactivate.**
  Last-write-wins; the row reflects whichever
  transition committed last.

## Risk

- **Likelihood:** Medium — exercised on every
  cancellation and re-engagement.
- **Impact:** High — defective transitions either
  bill canceled subscribers or leave reactivations
  stuck.
- **Mitigations:** Idempotent cancel (AC-3),
  grace-window check (AC-7..AC-8), state-machine
  refusal (AC-9).

## Implements (cross-cutting)

- **REQ-001 — Multi-tenant isolation.** Every
  transition is tenant-scoped via the
  subscription's `TenantID`.
- **REQ-004 — Audit per mutation.** Cancel /
  reactivate emit catalogued events upstream.
- **REQ-005 — Fail-closed.** AC-8, AC-9 — out-of-
  state transitions refused with typed errors.

## Compliance mapping

| Control | Coverage |
|---|---|
| SOC2 CC6.1 (Logical access) | AC-1, AC-2 — controlled access removal. |
| SOC2 CC8.1 (Change management) | AC-1..AC-7 — every transition auditable. |
| ISO27001 A.18.1 (Compliance with legal requirements) | AC-4 — reason captured for billing dispute records. |

## Satisfied by

- `pk-modules/billing/features/subscriptions/service.go::CancelSubscription, ReactivateSubscription`.
- `pk-modules/billing/features/subscriptions/subscription_fsm.go::ValidateTransition` — the underlying state machine.

## Related requirements

- [REQ-BILL-001 — Subscriptions umbrella](./REQ-BILL-001-subscriptions.md)
- [REQ-BILL-010 — Subscription create](./REQ-BILL-010-subscription-create.md)
- [REQ-BILL-012 — Plan change](./REQ-BILL-012-plan-change.md)
- [REQ-BILL-015 — Subscription FSM](./REQ-BILL-015-subscription-fsm.md)
