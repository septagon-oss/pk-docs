---
id: REQ-TENANT-010
title: "Tenant create delegates to the onboarding use case for the full member + settings + audit fan-out"
status: Proposed
date: 2026-05-08
slug: req-tenant-010-tenant-create
category: tenant
ears_pattern: event-driven
priority: must
risk: high
verification_methods: [test]
compliance:
  - SOC2_CC6.1
  - SOC2_CC8.1
  - ISO27001_A.9.2.1
satisfied_by:
  adr: [ADR-0009]
  conventions: [C-04, C-14]
implements_cross_cutting: [REQ-001, REQ-004, REQ-009]
refines: REQ-TENANT-001
type: doc
tags: [requirement, capability, tenant_management, tenant_lifecycle, create]
module: tenant_management
feature: tenant_lifecycle
capability: tenant_create
capability_kind: state_machine
stakeholders:
  - operator (creates tenants for new clients)
  - tenant administrator (first member after creation)
  - compliance auditor (tenancy onboarding control)
---

# REQ TENANT-010 — Tenant create

Status: **Proposed** (2026-05-08)

## Statement

**When** a caller invokes `TenantService.CreateTenant(req)`, the
tenant lifecycle feature **shall** delegate the entire creation
flow to the configured `OnboardTenantUseCase`. The use case is
the orchestration boundary; it is responsible for persisting the
`Tenant` row, seeding the first `TenantMember` with the
designated owner role, creating the matching `TenantSettings` and
`TenantLimits` rows, and emitting the catalogued `tenant.created`
event.

On a successful return from the use case the service **shall**
increment `tenant.created`. **If** the use case is not
configured (`onboardTenantUC == nil`) the service **shall** fail
fast with a `CreateTenant: onboarding use case is not
configured` error rather than attempting a partial creation.

## Rationale

A tenant is not a single row — it is a *graph*: tenant + settings
+ limits + first-member + audit row + notification fan-out. A
naive "insert into tenants" path would leave the platform with
half-provisioned tenants whose downstream consumers (auth, audit,
admin UI) panic on missing rows. Three discipline points:

1. **Use-case-owns-orchestration.** The onboarding use case is
   the single transactional boundary. Splitting "create tenant"
   logic across the service and the use case would create two
   half-truths; the service's job is to be a thin admission
   point that records the metric and propagates the result.
2. **Fail-fast on misconfiguration.** A nil use case is a wiring
   bug — silently no-oping or attempting a degraded create
   would mask the misconfiguration in production. The error
   says explicitly which collaborator is missing.
3. **Metric is post-success only.** `tenant.created` increments
   only when the use case returns nil error; a failed create
   does not pollute the counter (operators rely on this metric
   for tenant-onboarding throughput dashboards).

## Acceptance criteria

- **AC-1 — Delegation to use case.** A successful `CreateTenant`
  call returns the use case's `*TenantDTO` verbatim; the
  service does not transform the result.
- **AC-2 — Metric on success.** A successful return increments
  the `tenant.created` counter; an error return does not
  touch the counter.
- **AC-3 — Nil use case fails fast.** A `TenantService` with
  `onboardTenantUC == nil` returns the
  `onboarding use case is not configured` error before any
  metric or event side-effect.
- **AC-4 — Error propagation.** A use-case error is returned
  unwrapped — the service does not double-wrap or rewrite the
  message.
- **AC-5 — Audit + member + settings + limits seeded.** The
  delegated use case persists all four — verified by
  inspecting the use case's own AC set (`OnboardTenantUseCase`
  tests).
- **AC-6 — Event emission.** The catalogued `tenant.created`
  event is emitted by the use case (not by this service).

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `pk-modules/tenant_management/features/tenant_lifecycle/service_test.go::TestCreateTenant_Success` — DTO equality on the use-case happy path. |
| AC-2 | Inspection | `service.go::CreateTenant` lines 91–94 — `s.metrics.Inc(ctx, "tenant.created", nil)` is gated on `err == nil`; counter-on-failure regression would be visible in test setup. Dedicated metric-on-failure test pending. |
| AC-3 | Inspection | `service.go::CreateTenant` lines 87–89 — explicit `nil` check returns the typed `onboarding use case is not configured` error before any side effect. Dedicated test pending; current `TestCreateTenant_Success` covers the configured branch only. |
| AC-4 | Test | `pk-modules/tenant_management/features/tenant_lifecycle/service_test.go::TestCreateTenant_ValidationError` — wraps and propagates the use-case error. |
| AC-5 | Test | Use case persistence is exercised via the underlying `crud.GenericService` test suites; `pk-modules/tenant_management/features/tenant_lifecycle/service_test.go::TestCreateTenant_Success` verifies the orchestration end-to-end. |
| AC-6 | Inspection | The `tenant.created` event is emitted by `usecases.OnboardTenantUseCase`; the catalogued event surface is documented at `pk-modules/tenant_management/contracts/provides/events.go`. Dedicated event-emission test pending in the use-case package. |

## Edge cases & unhappy paths

- **Slug collision.** A duplicate slug is the use case's
  responsibility; the service's behaviour is to propagate the
  typed error.
- **Owner-user not found.** A `req.OwnerID` that does not
  resolve in `user_management` is rejected by the use case
  (member seed fails); no half-created tenant is left behind
  because the use case is transactional.
- **Metrics provider nil.** `s.metrics == nil` is a legal
  configuration; the delegate-then-skip-metric path is
  exercised by the tests.
- **Concurrent create with same slug.** Last-write-wins at the
  DB layer; the second writer receives the uniqueness error
  surfaced via the use case.
- **Use case panic.** Panics in the use case bubble up to the
  HTTP layer's recover middleware; this REQ does not require
  panic-recovery here (recovery is REQ-009's
  cross-cutting responsibility).

## Risk

- **Likelihood:** Low — exercised at tenant-onboarding cadence
  (typically once per client).
- **Impact:** Critical — a half-provisioned tenant breaks every
  subsequent admin operation for that tenant.
- **Mitigations:** Use-case-owned transaction (AC-1), fail-fast
  on misconfiguration (AC-3), metric reflects success-only (AC-2).

## Implements (cross-cutting)

- **REQ-001 — Multi-tenant isolation.** AC-5 — the seeded rows
  are the substrate of tenant-scoped queries.
- **REQ-004 — Audit per mutation.** AC-6 — the catalogued event.
- **REQ-009 — Observability.** AC-2 — the success counter.

## Compliance mapping

| Control | Coverage |
|---|---|
| SOC2 CC6.1 (Logical access) | AC-5 — owner role bound at tenant creation. |
| SOC2 CC8.1 (Change management) | AC-6 — every tenant inception is on the event ledger. |
| ISO27001 A.9.2.1 (User registration) | AC-5 — first-member registration is part of the create flow. |

## Satisfied by

- `pk-modules/tenant_management/features/tenant_lifecycle/service.go::CreateTenant` — admission + metric.
- `pk-modules/tenant_management/features/tenant_lifecycle/usecases/onboard_tenant.go::Execute` — orchestration.

## Related requirements

- [REQ-TENANT-001 — Tenant lifecycle](./REQ-TENANT-001-tenant-lifecycle.md)
- [REQ-TENANT-003 — Onboarding](./REQ-TENANT-003-onboarding.md) — the public onboarding wizard that calls into this surface.
- [REQ-TENANT-011 — Tenant update + archive](./REQ-TENANT-011-tenant-update-archive.md)
- [REQ-USER-010 — User create](./REQ-USER-010-user-create.md) — the parallel user-side creation.
