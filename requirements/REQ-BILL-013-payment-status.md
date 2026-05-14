---
id: REQ-BILL-013
title: "Payment-status events transition the subscription between active and past-due / unpaid based on payment outcome"
status: Proposed
date: 2026-05-08
slug: req-bill-013-payment-status
category: billing
ears_pattern: event-driven
priority: must
risk: high
verification_methods: [test]
compliance:
  - SOC2_CC6.1
  - SOC2_CC8.1
satisfied_by:
  adr: [ADR-0009]
  conventions: [C-04, C-14]
implements_cross_cutting: [REQ-001, REQ-004, REQ-013, REQ-014]
refines: REQ-BILL-001
type: doc
tags: [requirement, capability, billing_management, subscriptions, payment, status]
module: billing_management
feature: subscriptions
capability: payment_status
capability_kind: state_machine
stakeholders:
  - payment-provider integration (Stripe / etc. webhook)
  - support engineer (debugs failed-payment recovery)
  - finance team (revenue recognition)
---

# REQ BILL-013 — Payment-status event handling

Status: **Proposed** (2026-05-08)

## Statement

The subscriptions feature **shall** expose two
payment-event handlers consumed by the
payment-provider webhook adapter:

1. **`HandlePaymentSucceeded(data)`** — mark the
   subscription's status as `active` when the prior
   state was `past_due` or `unpaid`. **If** the
   subscription was already `active`, the handler
   completes without writing to the row;
2. **`HandlePaymentFailed(data)`** — flip the
   subscription's status from `active` to
   `past_due` to signal the payment-failure cycle.
   **If** the subscription is in any non-`active`
   state, the handler returns without writing.

Both handlers **shall** validate the inbound
`data` shape and return a typed error when the
payload is malformed (missing subscription id,
missing payment metadata).

## Rationale

Payment events are the bridge between the
payment-provider integration and the subscription
state machine. Three properties:

1. **Recovery on success.** A subscription that
   recovered from a payment failure must flip back
   to `active` so paid features resume; without
   this, a fixed payment leaves the subscriber
   stuck in `past_due`.
2. **Idempotency on already-active.** Webhook
   delivery is at-least-once; a duplicate
   `payment_succeeded` event must not produce
   double writes or duplicate audit rows. The
   handler's no-op-on-already-active branch is the
   idempotency guard.
3. **State-machine refusal on non-active.** A
   payment-failed event against a `canceled` or
   `trialing` subscription is suspicious; the
   handler ignores it rather than mutating an
   unrelated state. This is REQ-005 fail-closed
   discipline against malformed webhook traffic.

## Acceptance criteria

- **AC-1 — Payment succeeded recovers from past_due.**
  A `HandlePaymentSucceeded(data)` against a
  `past_due` subscription flips
  `Status = active` and persists.
- **AC-2 — Payment succeeded recovers from unpaid.**
  Same as AC-1 for `Status = unpaid`.
- **AC-3 — Payment succeeded on active is a no-op.**
  When the subscription is already `active`, the
  handler returns without writing to the row.
- **AC-4 — Payment succeeded with invalid data.**
  A malformed payload (missing subscription id,
  unparseable amount) returns the typed
  validation error.
- **AC-5 — Payment failed flips to past_due.**
  A `HandlePaymentFailed(data)` against an
  `active` subscription flips
  `Status = past_due`.
- **AC-6 — Payment failed on non-active is a no-op.**
  When the subscription is in `canceled` /
  `trialing` / etc., the handler returns
  without writing.
- **AC-7 — Payment failed with invalid data.**
  A malformed payload returns the typed
  validation error.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `pk-modules/billing_management/features/subscriptions/service_test.go::TestHandlePaymentSucceeded_PastDueToActive`. |
| AC-2 | Test | `pk-modules/billing_management/features/subscriptions/service_test.go::TestHandlePaymentSucceeded_UnpaidToActive`. |
| AC-3 | Test | `pk-modules/billing_management/features/subscriptions/service_test.go::TestHandlePaymentSucceeded_ActiveSubscription_NoChange`. |
| AC-4 | Test | `pk-modules/billing_management/features/subscriptions/service_test.go::TestHandlePaymentSucceeded_InvalidData`. |
| AC-5 | Test | `pk-modules/billing_management/features/subscriptions/service_test.go::TestHandlePaymentFailed_ActiveToPastDue`. |
| AC-6 | Test | `pk-modules/billing_management/features/subscriptions/service_test.go::TestHandlePaymentFailed_NonActiveSubscription_NoChange`. |
| AC-7 | Test | `pk-modules/billing_management/features/subscriptions/service_test.go::TestHandlePaymentFailed_InvalidData`. |

## Edge cases & unhappy paths

- **Webhook replay.** Idempotent on success
  (AC-3); on failure, the active-state guard
  prevents double-flips (AC-6).
- **Out-of-order webhooks.** A succeeded webhook
  arriving after a failed webhook for the same
  subscription correctly resolves to `active`;
  the audit ledger captures both events in
  arrival order.
- **Subscription deleted between event and
  processing.** Wrapped not-found error
  surfaces; the webhook adapter should be
  configured to retry-then-give-up rather than
  drop into infinite retry.
- **Provider-specific data.** The `data`
  parameter is `any` to accommodate
  Stripe-shaped payloads and future-provider
  shapes; the handler's first task is shape
  validation.

## Risk

- **Likelihood:** Medium — every payment cycle.
- **Impact:** Critical — defective handling
  either bills past-due subscribers or
  freezes recovered ones.
- **Mitigations:** Idempotency on success
  (AC-3) + state-machine refusal on non-active
  (AC-6) + payload validation (AC-4, AC-7).

## Implements (cross-cutting)

- **REQ-001 — Multi-tenant isolation.** Each
  subscription is tenant-scoped.
- **REQ-004 — Audit per mutation.** Each
  status flip emits the catalogued event.
- **REQ-013 — Integration adapters isolated.**
  The provider-webhook adapter calls into this
  surface; the handler knows nothing about the
  provider's wire shape.
- **REQ-014 — Graceful degradation.** AC-6 —
  out-of-state events are no-ops, not errors.

## Compliance mapping

| Control | Coverage |
|---|---|
| SOC2 CC6.1 (Logical access) | AC-1, AC-2 — paid access is restored after payment recovery. |
| SOC2 CC8.1 (Change management) | AC-1..AC-7 — every payment-driven status change auditable. |

## Satisfied by

- `pk-modules/billing_management/features/subscriptions/service.go::HandlePaymentSucceeded, HandlePaymentFailed`.

## Related requirements

- [REQ-BILL-010 — Subscription create](./REQ-BILL-010-subscription-create.md)
- [REQ-BILL-011 — Subscription lifecycle](./REQ-BILL-011-subscription-lifecycle.md)
- [REQ-BILL-015 — Subscription FSM](./REQ-BILL-015-subscription-fsm.md)
