---
id: REQ-BILL-010
title: "Subscription create resolves the plan, applies trial / period defaults, and copies usage limits from the plan"
status: Proposed
date: 2026-05-08
slug: req-bill-010-subscription-create
category: billing
ears_pattern: event-driven
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
implements_cross_cutting: [REQ-001, REQ-004, REQ-009]
refines: REQ-BILL-001
type: doc
tags: [requirement, capability, billing, subscriptions, create]
module: billing
feature: subscriptions
capability: subscription_create
capability_kind: data_invariant
stakeholders:
  - tenant administrator (subscribes the tenant)
  - operator (debugs subscription provisioning)
  - finance team (revenue recognition)
---

# REQ BILL-010 — Subscription create

Status: **Proposed** (2026-05-08)

## Statement

**When** a caller invokes
`Service.CreateSubscription(req)`, the subscriptions
feature **shall**:

1. Resolve the plan via `planService.GetByID(req.PlanID)`
   and refuse with a wrapped error when the plan does
   not exist;
2. Refuse with `plan is not active` when the resolved
   plan's `Active` flag is `false`;
3. Compute the period dates: when the plan declares a
   trial and the request does not opt out, set
   `TrialEndsAt = now + plan.TrialDays`,
   `CurrentPeriodStart = now`, and
   `CurrentPeriodEnd = trial-end`. When the request
   carries an explicit `TrialDays` override, the
   override wins;
4. **Copy usage limits from the plan into the
   subscription** so the subscription carries its own
   independent limits (plan-side changes after creation
   do not retroactively apply);
5. Persist the subscription row through the wrapped
   CRUD service;
6. Apply request metadata to the subscription's
   metadata map so callers can correlate
   external-system identifiers (Stripe customer id,
   internal CRM id, etc.).

`CreateDefaultSubscription(tenantID)` **shall** invoke
the same flow against the configured default plan
(when one is registered); when no default plan exists,
the call is a no-op and returns `nil, nil` so the
tenant-onboarding flow can proceed without a
subscription.

## Rationale

A subscription is the join between a tenant and the
billing layer; defects compound across every metered
feature. Three properties:

1. **Plan-active guard.** A retired plan should not
   accept new subscribers. The `Active` flag is
   the single source of truth; the service refuses
   the create call before any persist.
2. **Limits copied at creation, not referenced.**
   Subscriptions carry their own copy of the plan's
   usage limits. A plan-side update after the
   subscription was created does not retroactively
   change what the subscriber agreed to. This is the
   "every customer locks in their terms at signup"
   discipline.
3. **Trial-override precedence.** The plan declares
   a default trial; the request can override (e.g.,
   sales granted 60 days instead of 30). The
   override is honoured.

## Acceptance criteria

- **AC-1 — Trial period applied from plan.** A
  subscription created against a plan declaring 30
  trial days (with no request override) has
  `TrialEndsAt = now + 30d` and
  `CurrentPeriodEnd = TrialEndsAt`.
- **AC-2 — Request trial-days override.** A request
  carrying explicit `TrialDays = 60` against the same
  plan has `TrialEndsAt = now + 60d`.
- **AC-3 — Subscription without trial.** A plan
  with `TrialDays = 0` produces a subscription with
  `TrialEndsAt = nil` and `CurrentPeriodEnd` set to
  the plan's billing-period boundary.
- **AC-4 — Metadata applied.** A request carrying
  metadata persists with the metadata map populated.
- **AC-5 — Plan not found.** A request whose
  `PlanID` does not resolve returns the wrapped
  `plan not found` error.
- **AC-6 — Inactive plan refused.** A request
  against a plan with `Active = false` returns
  `plan is not active`.
- **AC-7 — Create persistence failure propagates.**
  A CRUD-layer create error returns the wrapped
  error with no follow-up state changes.
- **AC-8 — Usage limits copied from plan.** The
  persisted subscription's `UsageLimits` field
  contains a deep copy of the plan's limits.
- **AC-9 — Default subscription happy path.**
  `CreateDefaultSubscription(tenantID)` against a
  configured default plan creates a subscription via
  the same orchestration.
- **AC-10 — Default subscription no-op when
  unconfigured.** When no default plan exists,
  `CreateDefaultSubscription` returns `nil, nil`
  without error.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `pk-modules/billing/features/subscriptions/service_test.go::TestCreateSubscription_WithTrialPeriod`. |
| AC-2 | Test | `pk-modules/billing/features/subscriptions/service_test.go::TestCreateSubscription_WithRequestTrialDaysOverride`. |
| AC-3 | Test | `pk-modules/billing/features/subscriptions/service_test.go::TestCreateSubscription_WithoutTrial`. |
| AC-4 | Test | `pk-modules/billing/features/subscriptions/service_test.go::TestCreateSubscription_WithMetadata`. |
| AC-5 | Test | `pk-modules/billing/features/subscriptions/service_test.go::TestCreateSubscription_PlanNotFound`. |
| AC-6 | Test | `pk-modules/billing/features/subscriptions/service_test.go::TestCreateSubscription_InactivePlan`. |
| AC-7 | Test | `pk-modules/billing/features/subscriptions/service_test.go::TestCreateSubscription_CreateFails`. |
| AC-8 | Test | `pk-modules/billing/features/subscriptions/service_test.go::TestCreateSubscription_UsageLimitsCopiedFromPlan`. |
| AC-9 | Test | `pk-modules/billing/features/subscriptions/service_test.go::TestCreateDefaultSubscription_WithDefaultPlan`. |
| AC-10 | Test | `pk-modules/billing/features/subscriptions/service_test.go::TestCreateDefaultSubscription_NoDefaultPlan` and `TestCreateDefaultSubscription_InvalidData`. |

## Edge cases & unhappy paths

- **Plan with negative trial days.** Refused at the
  plan-creation surface; the create-subscription path
  trusts the plan's invariants.
- **Concurrent create with the same tenant.** The
  underlying CRUD service determines whether
  multiple active subscriptions are allowed; the
  service does not pre-check.
- **Period-end calculation.** Computed via
  `calculatePeriodEnd` which is exercised by
  `TestCalculatePeriodEnd`.
- **Plan retired mid-flow.** A plan retired
  between the read and the persist may leak through
  (the cached read says active). Documented as a
  rare race that the operator can retire-then-wait.
- **Metadata overflow.** The metadata map is
  persisted as JSON; very large maps may exceed
  database column limits. Operators should keep
  metadata bounded.

## Risk

- **Likelihood:** Medium — every new subscriber.
- **Impact:** Critical — defective create means
  revenue loss or unauthorised access to paid
  features.
- **Mitigations:** Plan-active guard (AC-6) +
  limits-copied-at-creation (AC-8) + period-date
  derivation (AC-1..AC-3).

## Implements (cross-cutting)

- **REQ-001 — Multi-tenant isolation.** Every
  subscription is tenant-scoped via the request
  context.
- **REQ-004 — Audit per mutation.** The
  `subscription.created` event is emitted
  upstream.
- **REQ-009 — Observability.** Span coverage on
  every create.

## Compliance mapping

| Control | Coverage |
|---|---|
| SOC2 CC6.1 (Logical access) | AC-6 — only active plans accept subscribers. |
| SOC2 CC8.1 (Change management) | AC-8 — limits frozen at creation; plan changes don't retroactively apply. |
| ISO27001 A.18.1 (Compliance with legal requirements) | AC-4 — metadata supports billing-record retention. |

## Satisfied by

- `pk-modules/billing/features/subscriptions/service.go::CreateSubscription, CreateDefaultSubscription`.

## Related requirements

- [REQ-BILL-001 — Subscriptions umbrella](./REQ-BILL-001-subscriptions.md)
- [REQ-BILL-011 — Subscription lifecycle (cancel / reactivate)](./REQ-BILL-011-subscription-lifecycle.md)
- [REQ-BILL-012 — Plan change](./REQ-BILL-012-plan-change.md)
- [REQ-BILL-013 — Payment-status events](./REQ-BILL-013-payment-status.md)
- [REQ-BILL-014 — Usage metering](./REQ-BILL-014-usage-metering.md)
