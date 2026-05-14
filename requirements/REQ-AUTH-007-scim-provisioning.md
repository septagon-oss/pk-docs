---
id: REQ-AUTH-007
title: "SCIM provisioning feature exposes idempotent SCIM 2.0 endpoints scoped to the calling tenant"
status: Proposed (implementation deferred)
date: 2026-05-06
slug: req-auth-007-scim-provisioning
category: auth
ears_pattern: optional
verification_methods: [test, inspection]
compliance: [SOC2_CC6.1, ISO27001_A.9.4]
satisfied_by:
  adr: [ADR-0009]
  conventions: [C-04, C-14]
implements_cross_cutting: [REQ-001, REQ-004, REQ-009]
type: doc
tags: [requirement, feature, auth_management]
module: auth_management
feature: scim_provisioning
---

# REQ AUTH-007 — SCIM provisioning

Status: **Proposed (implementation deferred)** (2026-05-06)

> **Implementation note.** The `scim_provisioning` directory currently
> contains 137 lines across 4 files (feature wiring, permissions,
> routes, e2e). The actual SCIM endpoints, idempotency layer, and
> conformance handlers are not yet built. The auth_management module
> catalog at `.claude/generated/modules/auth_management.md` does not
> list this as an active feature. This REQ documents the requirement
> shape so that when implementation lands, the AC suite is ready;
> tests are deferred until the implementation does.

## Statement

**Where** SCIM provisioning is enabled for a tenant, the feature
**shall** expose SCIM 2.0–conformant endpoints for User and Group
resources. Every operation **shall** be authenticated via the
configured bearer token, scoped to the calling tenant (REQ-001), and
idempotent — replaying a request with the same SCIM `externalId`
**shall** produce the same final state and the same response.

## Rationale

SCIM is the IdP-driven user-lifecycle channel; it must be
indistinguishable from the human-driven path in terms of audit and
isolation guarantees. SCIM clients retry aggressively, so non-idempotent
operations cause duplicate users and ghost groups in production.
Schema conformance matters because most clients (Okta, Azure AD)
abort the entire sync on a single non-conformant response.

## Acceptance criteria

- **AC-1** Every SCIM endpoint requires a valid bearer token tied to
  a tenant; absence or expiry returns `401` in SCIM error format.
- **AC-2** User create/update/delete and Group create/update/delete
  are idempotent: repeating the same operation yields the same final
  state and response (no duplicate rows, no extra audit events
  beyond the configured one-per-mutation).
- **AC-3** Non-conformant requests fail with the SCIM error format
  (status, `scimType`, `detail`) — never with a platform-generic
  4xx body that the client cannot parse.
- **AC-4** Every successful operation emits a
  `scim.<resource>.<verb>` audit row scoped to the tenant.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Inspection | `auth_management/features/scim_provisioning/routes.go` — bearer-token middleware mounted at the SCIM mount point. The feature directory currently ships only `feature.go`, `routes.go`, `permissions.go`, `e2e.go`; no Go-level test file exists. **Verification gap: dedicated SCIM auth test pending.** |
| AC-2 | Inspection | `auth_management/features/scim_provisioning/feature.go` — handler wiring delegates to the `auth_management` provisioning runtime, whose idempotency comes from the underlying provider adapter. **Verification gap: dedicated SCIM idempotency test pending.** |
| AC-3 | Inspection | The SCIM error envelope is the provider adapter's responsibility (see REQ-013 — adapters isolated). **Verification gap: dedicated SCIM error-format conformance test pending.** |
| AC-4 | Inspection | Every handler call site in `routes.go` invokes the audit service via the platform's standard middleware. **Verification gap: dedicated audit-row-per-SCIM-op test pending.** |

## Implements (cross-cutting)

- REQ-001 — multi-tenant isolation.
- REQ-004 — audit per mutation.
- REQ-009 — observability.

## Satisfied by

- `auth_management/features/scim_provisioning/feature.go`
- `auth_management/features/scim_provisioning/routes.go`,
  `permissions.go`

## Related requirements

- [REQ-AUTH-006 — Auth provider](./REQ-AUTH-006-auth-provider.md) — the companion sign-in side of IdP integration.
- [REQ-USER-NNN — User lifecycle](./REQ-USER-001-user.md) — the user records this feature provisions.
