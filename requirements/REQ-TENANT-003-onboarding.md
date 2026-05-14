---
id: REQ-TENANT-003
title: "Onboarding feature drives the public tenant-creation wizard end-to-end"
status: Proposed
date: 2026-05-07
slug: req-tenant-003-onboarding
category: tenancy
ears_pattern: event-driven
verification_methods: [test, inspection]
compliance: []
satisfied_by:
  adr: [ADR-0009]
  conventions: [C-04, C-14]
implements_cross_cutting: [REQ-001, REQ-004]
type: doc
tags: [requirement, feature, tenant_management]
module: tenant_management
feature: onboarding
---

# REQ TENANT-003 — Onboarding

Status: **Proposed** (2026-05-07)

## Statement

**When** a new organisation submits the public onboarding form, the
feature **shall** create a tenant record (REQ-TENANT-001), seed the
initial owner user (REQ-USER-001 + REQ-AUTH-002), wire the chosen
host alias, and emit a `tenant.onboarded` event so downstream
modules can run their first-tenant setup (billing creates the
default subscription, notifications sends the welcome mail). The
flow **shall** be idempotent on its public token — replaying the
same onboarding submission with the same token yields the same
tenant rather than creating a duplicate.

## Rationale

Tenant onboarding is the single most-visible new-customer step;
failures here are losses at the top of the funnel. Idempotency on
the submission token is what lets a flaky network or impatient
form-submit retry not produce two tenants for one customer. The
event-driven downstream wiring (rather than synchronous calls into
billing / notifications) is what keeps the onboarding response time
in the user-facing latency budget — the user sees "tenant created,
checking your email" while the side-effects fan out behind it.

## Acceptance criteria

- **AC-1** A successful onboarding submission creates exactly one
  tenant, one owner user, and one host alias; the response carries
  the new tenant id and a redirect to the post-onboarding screen.
- **AC-2** Replaying the same submission with the same idempotency
  token returns the existing tenant rather than creating a new
  one.
- **AC-3** A `tenant.onboarded` event is published on success;
  downstream subscribers (billing, notifications) consume it
  asynchronously and any failure on their side does not roll back
  the tenant creation.
- **AC-4** Validation errors (invalid hostname, taken hostname,
  invalid email) return typed errors before any tenant or user row
  is created.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Inspection | Coverage gap — `onboarding/` has no `*_test.go` today. The end-to-end flow is exercised by the showroom e2e suite (`tests/e2e/onboarding.go`); a unit-level test against the handler+service is tracked as a follow-up. _Verification gap: pending — cited evidence is prose / pattern / non-Go and cannot be auto-resolved._ |
| AC-2 | Inspection | Coverage gap — same as AC-1; idempotency is exercised at the e2e level only. _Verification gap: pending — cited evidence is prose / pattern / non-Go and cannot be auto-resolved._ |
| AC-3 | Inspection | `onboarding/handler.go` calls the event bus; the event type is registered in `feature.go`. |
| AC-4 | Inspection | `onboarding/handler.go` validation paths return typed errors before the persistence step. |

## Implements (cross-cutting)

- REQ-001 — multi-tenant isolation (the new tenant is the isolation root).
- REQ-004 — audit per mutation (`tenant.onboarded`).

## Satisfied by

- `pk-modules/tenant_management/features/onboarding/feature.go`
- `pk-modules/tenant_management/features/onboarding/handler.go`,
  `routes.go`, `permissions.go`

## Related requirements

- [REQ-TENANT-001 — Tenant lifecycle](./REQ-TENANT-001-tenant-lifecycle.md) — the underlying tenant create.
- [REQ-USER-001 — User](./REQ-USER-001-user.md) — the seeded owner record.
- [REQ-AUTH-002 — Registration](./REQ-AUTH-002-registration.md) — the credential side of the seeded owner.
