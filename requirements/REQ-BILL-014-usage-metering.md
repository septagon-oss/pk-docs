---
id: REQ-BILL-014
title: "Usage metering tracks per-subscription metric counters and rejects writes that exceed the configured limit"
status: Proposed
date: 2026-05-08
slug: req-bill-014-usage-metering
category: billing
ears_pattern: event-driven
priority: must
risk: high
verification_methods: [test]
compliance:
  - SOC2_CC6.1
  - ISO27001_A.18.1
satisfied_by:
  adr: [ADR-0009]
  conventions: [C-04, C-14]
implements_cross_cutting: [REQ-001, REQ-005, REQ-009]
refines: REQ-BILL-001
type: doc
tags: [requirement, capability, billing, subscriptions, usage, metering]
module: billing
feature: subscriptions
capability: usage_metering
capability_kind: data_invariant
stakeholders:
  - business module emitting usage signals
  - tenant administrator (sees usage dashboards)
  - finance team (revenue per usage)
---

# REQ BILL-014 — Usage metering

Status: **Proposed** (2026-05-08)

## Statement

The subscriptions feature **shall** expose two
usage-tracking operations:

1. **`UpdateUsageMetrics(subscriptionID, metric,
   delta)`** — increment (or decrement) the
   subscription's named metric counter:
   - When the metric does not exist, create it
     with the supplied `delta` as the initial
     value;
   - When the resulting counter would exceed the
     configured limit for the metric, return the
     typed limit-exceeded error and **do not**
     persist the over-limit value;
   - When the counter is within the limit (or no
     limit is set), persist the new value;
   - Validate the input shape and return a typed
     error on malformed payload;
2. **`GetSubscriptionUsage(subscriptionID)`** —
   return the current usage counter map plus the
   configured limits for the subscription. When
   the subscription has no recorded usage, return
   an empty result (not an error).

The subscription's usage limits are the per-
subscription copy made at create / plan-change
time (REQ-BILL-010 AC-8 / REQ-BILL-012); the
service trusts the subscription's limits, not
the plan's.

## Rationale

Usage metering is the platform's defense
against runaway consumption on metered features
(API calls, storage, seat counts). Three
properties:

1. **Limit-enforce on write.** A naive
   "track-then-check-elsewhere" would let a
   metric overflow before the gate fires; the
   write-side check is the load-bearing
   guarantee. The metric is the source of
   truth for "what has the subscriber
   consumed?".
2. **New metric is created lazily.** A
   subscription that adds a metric mid-cycle
   (e.g., enabled a new metered feature)
   should not have to migrate the row. The
   first write creates the counter; subsequent
   writes accumulate.
3. **Read returns empty on no-usage.** The
   admin UI's "what has this subscription
   used?" view should show zero, not a 404.
   The empty-result-on-miss is the documented
   probe semantics.

## Acceptance criteria

- **AC-1 — New metric created on first write.**
  An `UpdateUsageMetrics(subID, "api_calls",
  100)` against a subscription with no prior
  `api_calls` counter creates the entry with
  value 100.
- **AC-2 — Within-limit accumulates.** A
  subsequent update with delta 50 against a
  limit of 200 produces a counter of 150.
- **AC-3 — Exceeds-limit refused.** A delta
  that would push the counter above the
  configured limit returns the typed
  limit-exceeded error; the persisted value is
  unchanged.
- **AC-4 — No-limit accumulates without
  bound.** A metric with no configured limit
  accumulates without refusal.
- **AC-5 — Invalid data refused.** A malformed
  payload (missing subscription id, unparseable
  delta) returns the typed validation error.
- **AC-6 — Get returns usage + limits.** A
  `GetSubscriptionUsage(subID)` returns the
  full counter map plus the configured limits
  per metric.
- **AC-7 — Get returns empty on no-usage.** A
  `GetSubscriptionUsage` against a subscription
  with no recorded usage returns the
  empty-result shape (no error).

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `pk-modules/billing/features/subscriptions/service_test.go::TestUpdateUsageMetrics_NewMetric`. |
| AC-2 | Test | `pk-modules/billing/features/subscriptions/service_test.go::TestUpdateUsageMetrics_WithinLimit`. |
| AC-3 | Test | `pk-modules/billing/features/subscriptions/service_test.go::TestUpdateUsageMetrics_ExceedsLimit`. |
| AC-4 | Test | `pk-modules/billing/features/subscriptions/service_test.go::TestUpdateUsageMetrics_NoLimitsSet`. |
| AC-5 | Test | `pk-modules/billing/features/subscriptions/service_test.go::TestUpdateUsageMetrics_InvalidData`. |
| AC-6 | Test | `pk-modules/billing/features/subscriptions/service_test.go::TestGetSubscriptionUsage_WithUsageAndLimits`. |
| AC-7 | Test | `pk-modules/billing/features/subscriptions/service_test.go::TestGetSubscriptionUsage_NoUsage`. |

## Edge cases & unhappy paths

- **Negative delta.** Treated as a decrement;
  the resulting value can go below zero
  (counters do not floor-clamp). UI consumers
  should display zero when the value is
  negative.
- **Concurrent updates on the same metric.**
  Last-write-wins; for stricter accounting,
  the underlying repository should use
  optimistic locking on the counter column.
- **Limit changed mid-cycle.** A plan-change
  (REQ-BILL-012) copies new limits onto the
  subscription; subsequent updates honour the
  new limit without resetting the counter.
- **Parse-usage-value helper.** The shared
  `parseUsageValue` helper is exercised by
  `TestParseUsageValue`.
- **Subscription deleted mid-write.** Wrapped
  not-found error surfaces; the metric write
  is lost.

## Risk

- **Likelihood:** High — exercised on every
  metered feature use.
- **Impact:** High — defective metering
  either over-bills subscribers or lets
  consumption escape limits.
- **Mitigations:** Write-side limit check
  (AC-3), input validation (AC-5),
  empty-on-miss read (AC-7).

## Implements (cross-cutting)

- **REQ-001 — Multi-tenant isolation.** Each
  subscription is tenant-scoped.
- **REQ-005 — Fail-closed.** AC-3 — over-limit
  writes refused.
- **REQ-009 — Observability.** Usage metrics
  feed the admin dashboards.

## Compliance mapping

| Control | Coverage |
|---|---|
| SOC2 CC6.1 (Logical access) | AC-3 — bounded consumption per subscription. |
| ISO27001 A.18.1 (Compliance with legal requirements) | AC-6 — usage data feeds billing record retention. |

## Satisfied by

- `pk-modules/billing/features/subscriptions/service.go::UpdateUsageMetrics, GetSubscriptionUsage, parseUsageValue`.

## Related requirements

- [REQ-BILL-010 — Subscription create](./REQ-BILL-010-subscription-create.md) — limits are copied here.
- [REQ-BILL-012 — Plan change](./REQ-BILL-012-plan-change.md) — limits are recopied on plan change.
- [REQ-ENTITLE-010 — Entitlement grants](./REQ-ENTITLE-010-grant-subscriber.md) — the entitlement layer that consumes metered limits.
