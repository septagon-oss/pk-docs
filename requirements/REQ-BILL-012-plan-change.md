---
id: REQ-BILL-012
title: "Plan change supports upgrade always; downgrade only when policy allows; resets billing period on immediate change"
status: Proposed
date: 2026-05-08
slug: req-bill-012-plan-change
category: billing
ears_pattern: state-driven
priority: must
risk: high
verification_methods: [test]
compliance:
  - SOC2_CC8.1
  - ISO27001_A.18.1
satisfied_by:
  adr: [ADR-0009]
  conventions: [C-04, C-14]
implements_cross_cutting: [REQ-001, REQ-004, REQ-005]
refines: REQ-BILL-001
type: doc
tags: [requirement, capability, billing_management, subscriptions, plan_change, upgrade, downgrade]
module: billing_management
feature: subscriptions
capability: plan_change
capability_kind: state_machine
stakeholders:
  - tenant administrator (changes plan tier)
  - finance team (proration accounting)
  - support engineer (debugs failed plan changes)
---

# REQ BILL-012 — Plan change

Status: **Proposed** (2026-05-08)

## Statement

The subscriptions feature **shall** expose
`Service.ChangePlan(subscriptionID, req)` that changes
the plan a subscription is bound to. The transition
**shall**:

1. Resolve the subscription and the new plan;
2. Refuse with `plan is not active` when the new plan's
   `Active = false`;
3. Refuse when the subscription is not in an active
   state (`active`, `trialing`); cancelling /
   canceled / past-due / unpaid states reject the
   change;
4. **Upgrade** (new plan price > current plan price) —
   always allowed;
5. **Downgrade** (new plan price < current plan price)
   — allowed only when the new plan's
   `AllowDowngrade` flag is `true`; otherwise refused
   with the typed downgrade-not-allowed error;
6. **Trialing → any plan** — always allowed (the
   trial is a privileged-state pass-through);
7. **Immediate change** — when `req.Immediate = true`,
   reset `CurrentPeriodStart = now`,
   `CurrentPeriodEnd = now + new-plan.BillingPeriod`,
   and bill at the next cycle on the new plan; usage
   meters reset.

The service **shall** copy the new plan's usage
limits onto the subscription (mirroring REQ-BILL-010
AC-8 — limits frozen at the time of the
change, not by reference).

## Rationale

Plan change is the most-touched billing surface after
create. Three properties:

1. **Upgrade-anytime, downgrade-policy-driven.**
   Upgrades increase revenue and access; downgrades
   surrender access mid-period and need a policy
   gate so subscribers can't cycle through paid
   tiers to dodge usage caps.
2. **Trialing is privileged.** A subscriber on a
   trial should be able to switch plans freely
   while evaluating; the trial mechanic is the
   "any-plan-fits" experiment.
3. **Immediate change resets the billing period.**
   The "switch now and bill on the new plan
   tomorrow" UX requires the period boundaries to
   reset; otherwise the subscriber would see two
   prorated invoices in confusing succession.

## Acceptance criteria

- **AC-1 — Upgrade.** A `ChangePlan` to a more
  expensive plan succeeds and persists with
  `PlanID = newPlanID`.
- **AC-2 — Downgrade allowed.** A `ChangePlan` to
  a cheaper plan whose `AllowDowngrade = true`
  succeeds.
- **AC-3 — Downgrade not allowed.** A `ChangePlan`
  to a cheaper plan whose `AllowDowngrade = false`
  returns the typed `downgrade not allowed` error.
- **AC-4 — Non-active subscription refused.** A
  `ChangePlan` against a `canceled` /
  `past_due` / etc. subscription returns the
  typed wrong-state error.
- **AC-5 — Trialing-to-any.** A `ChangePlan`
  from a `trialing` subscription succeeds
  regardless of price direction.
- **AC-6 — Inactive new-plan refused.** A
  `ChangePlan` to a plan with `Active = false`
  returns `plan is not active`.
- **AC-7 — Immediate change resets period.** A
  `ChangePlan` with `Immediate = true` sets
  `CurrentPeriodStart = now` and recomputes
  `CurrentPeriodEnd`.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `pk-modules/billing_management/features/subscriptions/service_test.go::TestChangePlan_Upgrade`. |
| AC-2 | Test | `pk-modules/billing_management/features/subscriptions/service_test.go::TestChangePlan_DowngradeAllowed`. |
| AC-3 | Test | `pk-modules/billing_management/features/subscriptions/service_test.go::TestChangePlan_DowngradeNotAllowed`. |
| AC-4 | Test | `pk-modules/billing_management/features/subscriptions/service_test.go::TestChangePlan_NonActiveSubscription`. |
| AC-5 | Test | `pk-modules/billing_management/features/subscriptions/service_test.go::TestChangePlan_TrialingSubscriptionAllowed`. |
| AC-6 | Test | `pk-modules/billing_management/features/subscriptions/service_test.go::TestChangePlan_InactiveNewPlan`. |
| AC-7 | Test | `pk-modules/billing_management/features/subscriptions/service_test.go::TestChangePlan_ImmediateResetsBillingPeriod`. |

## Edge cases & unhappy paths

- **Same-plan change.** Treated as a no-op
  upgrade/downgrade comparison (the price delta
  is zero). The persist still happens, recording
  the change attempt.
- **Trial-to-trial.** Allowed; the trial timer
  is not extended by a plan switch.
- **Concurrent plan change + cancel.** Last-
  write-wins; the subscription reflects whichever
  transition committed last.
- **Plan retired between read and persist.**
  The service trusts the read; the persist may
  succeed on a stale-active plan. The window is
  the same as REQ-BILL-010's documented race.
- **Proration.** Out of scope for this REQ; the
  immediate-change path resets the period
  boundary so the next invoice runs on the new
  plan from `now`.

## Risk

- **Likelihood:** Medium — exercised on every
  upgrade / downgrade.
- **Impact:** High — defective changes either
  let subscribers escape paid features
  (downgrade leak) or block legitimate
  upgrades.
- **Mitigations:** Active-plan guard (AC-6) +
  state-machine refusal (AC-4) + downgrade
  policy gate (AC-3).

## Implements (cross-cutting)

- **REQ-001 — Multi-tenant isolation.** Every
  change is tenant-scoped via the subscription
  record.
- **REQ-004 — Audit per mutation.** Plan-change
  events are emitted upstream.
- **REQ-005 — Fail-closed.** AC-3, AC-4, AC-6 —
  refused transitions default to no-change.

## Compliance mapping

| Control | Coverage |
|---|---|
| SOC2 CC8.1 (Change management) | AC-1..AC-7 — every plan change is auditable. |
| ISO27001 A.18.1 (Compliance with legal requirements) | AC-3 — downgrade policy enforced. |

## Satisfied by

- `pk-modules/billing_management/features/subscriptions/service.go::ChangePlan`.

## Related requirements

- [REQ-BILL-010 — Subscription create](./REQ-BILL-010-subscription-create.md)
- [REQ-BILL-011 — Subscription lifecycle](./REQ-BILL-011-subscription-lifecycle.md)
- [REQ-BILL-015 — Subscription FSM](./REQ-BILL-015-subscription-fsm.md)
