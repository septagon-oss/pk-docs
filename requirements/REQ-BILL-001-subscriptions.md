---
id: REQ-BILL-001
title: "Subscriptions feature manages billing-tier records and propagates entitlement changes"
status: Proposed
date: 2026-05-07
slug: req-bill-001-subscriptions
category: tenancy
ears_pattern: state-driven
verification_methods: [test]
compliance: []
satisfied_by:
  adr: [ADR-0009]
  conventions: [C-04, C-14]
implements_cross_cutting: [REQ-001, REQ-004, REQ-013]
type: doc
tags: [requirement, feature, billing_management]
module: billing_management
feature: subscriptions
---

# REQ BILL-001 — Subscriptions

Status: **Proposed** (2026-05-07)

## Statement

The subscriptions feature **shall** persist a tenant-scoped
subscription record (plan, status, period start/end, cancellation
state), drive its status through the explicit state machine
declared in `subscription_fsm.go::allowedTransitions` (covering
`trialing → active → past_due → unpaid → canceled` plus the
companion `paused` / `canceling` states), and propagate
entitlement changes downstream so the entitlement service
(REQ-ENTITLE-001) reflects the current plan. State transitions
**shall** emit the catalogued typed events
(`subscription.created`, `subscription.updated`,
`subscription.canceled`, `subscription.plan_changed`) that
downstream subscribers (notifications, admin UI) consume by
subscription.

## Rationale

A subscription is the contract between the platform and the paying
tenant; the discipline of an explicit state machine keeps the
"what does this tenant currently get?" question deterministic
under the realistic chaos of payment retries, dunning, and
cancellation flows. Propagating to entitlement rather than letting
every consumer query subscription directly is the integration
boundary — entitlement is the single read surface for "is this
tenant allowed to use feature X?".

## Acceptance criteria

- **AC-1** State transitions follow the FSM declared in
  `subscription_fsm.go::allowedTransitions`. `ValidateTransition`
  returns an error for any (from, to) pair not in the allowed map
  (e.g. `paused → past_due` is rejected; `paused → active` is
  allowed). The map is the source of truth — REQ readers should
  consult it for the exhaustive transition set.
- **AC-2** Each transition emits a typed event and audits the
  change with the actor, the previous state, and the new state.
- **AC-3** Plan changes propagate to the entitlement service so a
  read of "what does this tenant get?" reflects the new plan
  within the configured budget.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `pk-modules/billing_management/features/subscriptions/subscription_fsm_test.go::TestValidateTransition_UnknownStatus` covers the state-machine invariants. |
| AC-2 | Test | `pk-modules/billing_management/features/subscriptions/service_test.go::TestParseUsageValue` covers event emission and audit trail. |
| AC-3 | Test | `pk-modules/billing_management/features/subscriptions/entitlements_test.go::TestListEntitlements_UsesStructuredSubscriptionItems` covers propagation to entitlement. |

## Implements (cross-cutting)

- REQ-001 — multi-tenant isolation.
- REQ-004 — audit per mutation.
- REQ-013 — integration adapters isolated (Stripe / payment-provider boundary).

## Satisfied by

- `billing_management/features/subscriptions/feature.go`
- `billing_management/features/subscriptions/service.go`,
  `service_test.go`
- `pk-modules/billing_management/features/subscriptions/subscription_fsm_test.go`
- `billing_management/features/subscriptions/entitlements.go`,
  `entitlements_test.go`
- `billing_management/features/subscriptions/context_helpers.go`

## Related requirements

- [REQ-ENTITLE-001 — Grants](./REQ-ENTITLE-001-grants.md) — the entitlement surface this feature drives.
