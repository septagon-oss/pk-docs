---
title: "ADR 0006: Multi-entity writes are atomic or they don't happen"
status: Accepted
date: 2024-04-22
slug: adr-0006-transactional-atomicity-for-multi-entity-state
adr_topic: data-durability
type: doc
tags: [adr, transactions, data-integrity]
---

# ADR 0006 — Multi-entity writes are atomic or they don't happen

Status: **Accepted** (2024-04-22)

## The problem

Several business-module use cases create multiple related entities
in a single logical operation and rely on "best-effort rollback
`Delete`" when a later step fails. The representative case is
`OnboardTenantUseCase.Execute` — five sequential `Create`s
(Tenant → Settings → Limits → Usage → Member) with a helper that
issues `tenantService.Delete(ctx, tenant.ID)` if any later step
breaks.

The pattern fails in two different ways and we've seen both in
production. First, the best-effort `Delete` can itself fail, and it
was originally silently swallowed: `_, _ = uc.tenantService.Delete(...)`
left orphan tenant rows with no signal and no way to correlate the
orphan back to the onboarding attempt. Second — and this is the
subtler one — even when the `Delete` succeeds, the rollback isn't
atomic. The tenant row exists in a *committed* state between the
`Create` and the `Delete`, so any concurrent query sees it.
Uniqueness constraints fire against the half-state. Audit trails
record the half-state. Timed queries return it.

`crud.Repository[T]` already exposes
`WithTransaction(ctx, fn)`, which runs `fn` inside a single DB
transaction and propagates the tx through `ctx`. Every repository
call in the package honours the ctx-bound tx when present.
`crud.GenericService[T]` doesn't expose `WithTransaction` directly
— which is exactly why `OnboardTenantUseCase` couldn't wrap its
work in a transaction in the first place.

## The decision

Any use case that performs more than one `Create`/`Update`/`Delete`
whose atomicity affects correctness wraps the operation in
`tenantRepo.WithTransaction(ctx, fn)` — or an equivalent
`WithTransaction` on one of the participating repositories. Every
downstream service call within the same logical operation runs
inside that tx via `ctx` propagation.

Use cases that need transactional semantics but take
`GenericService` dependencies also take a `crud.Repository[T]` for
*one* of the participating entities, specifically to provide the
transaction boundary. That repo isn't used for reads or writes
directly — it exists as the transaction root.

Rollback failures in the non-transactional fallback path (where
`tenantRepo` is nil, as in unit tests) are logged at Error level
with the tenant id, the failed step, and the rollback error, so
operators can reconcile orphaned rows manually.

## What we gave up

- An extra dependency on some use cases. A use case that otherwise
  only needed `GenericService[T]` now takes a
  `crud.Repository[T]` purely for the tx root. A framework-level
  `TransactionRunner` primitive would be cleaner — tracked as
  follow-up if more use cases hit the same friction.
- Two code paths to maintain. The transactional path and the
  best-effort-rollback fallback both exist; the fallback is
  explicit and logs loudly, but it's still surface area.

## What we kept

- Actual atomicity. `OnboardTenantUseCase` either commits all five
  writes or commits none. No orphan rows, no half-states visible
  to concurrent queries, no audit trail lying about the outcome.
- A testable pattern. Tests inject a mock
  `tenantRepo.WithTransaction` that records whether it was
  invoked and whether the inner `fn` returned error, proving the
  transaction is actually used — no real database required.
- A reusable shape. Any multi-entity use case adopts the same
  pattern, so new code inherits the discipline without a case-by-case
  decision.

## How we enforce it

- **Unit test proof of tx usage.** Use cases that claim
  transactional atomicity include a test that injects a mock
  `crud.Repository[T]` recording whether `WithTransaction` was
  called, the ordering of inner ops, and whether rollback ran on
  simulated failure. Reference:
  `tenant_management/features/tenant_lifecycle/usecases/onboard_tenant_tx_test.go`.
- **Non-transactional fallback is logged, not silent.** When
  `tenantRepo == nil`, rollback failures log at Error with
  `tenantId`, `failedStep`, `rollbackError`. Operators alerting on
  `tenant onboarding rollback failed` catch orphan-row conditions
  in that path.
- **Gap.** No static analyzer currently flags multi-`Create` use
  cases that aren't wrapped in `WithTransaction`. An analyzer
  would need to identify "use case" functions (by naming
  convention or struct method set) and check for tx wrapping.
  Tracked as follow-up.

## References

- Commit: `e3c5cb720 fix(tenant_management): wrap onboarding in a
  real database transaction`
- Precedent: `booking_management/notification_queue.go` — existing
  multi-step writes already use `deliveryRepo.WithTransaction`.
- Related:
  [ADR 0005 — no silent failures](./0005-error-handling-discipline.md)
  — surfaces the rollback failures this ADR replaces.
- Related:
  [ADR 0007 — events go through the outbox](./0007-transactional-outbox-for-event-delivery.md)
  — rides on the transaction boundary this ADR establishes.
