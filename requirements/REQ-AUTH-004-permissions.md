---
id: REQ-AUTH-004
title: "Permissions feature evaluates role→capability bindings deterministically and fails closed"
status: Proposed
date: 2026-05-06
slug: req-auth-004-permissions
category: auth
ears_pattern: ubiquitous
verification_methods: [test, analysis]
compliance: [SOC2_CC6.1, ISO27001_A.9.4]
satisfied_by:
  adr: [ADR-0009]
  conventions: [C-04, C-14]
implements_cross_cutting: [REQ-001, REQ-004, REQ-005]
type: doc
tags: [requirement, feature, auth_management]
module: auth_management
feature: permissions
---

# REQ AUTH-004 — Permissions

Status: **Proposed** (2026-05-06)

## Statement

The permissions feature **shall** maintain the catalog of capabilities
each module declares, the roles each tenant configures, and the
binding between them. A capability check **shall** be deterministic
(same actor, same target, same time → same outcome), tenant-scoped,
and **shall** deny when the role-set is empty, the binding is
missing, or any input is unresolved.

## Rationale

Authorisation outcomes that depend on cache freshness or non-local
state become a debugging nightmare and an audit hazard. Determinism
keeps the "why was this denied?" question answerable in production
from logs alone. Fail-closed denies are how the platform maintains
the "least privilege" posture in face of misconfiguration.

## Acceptance criteria

- **AC-1** Module-declared capabilities are registered at boot via
  the FX graph; conflicting declarations fail boot rather than
  silently overwriting.
- **AC-2** A capability check with an empty role-set, an unresolved
  user, or a missing binding returns `denied` and emits
  `auth.permissions.denied{reason}`. No silent allow.
- **AC-3** Role mutations (assign, revoke, role-create,
  role-delete) are tenant-scoped (REQ-001), audited (REQ-004), and
  invalidate the affected user's permission cache by the start of
  their next request.
- **AC-4** A permission check is pure with respect to its inputs:
  given the same actor, target, and capability the result is stable
  across calls (no clock-time-dependent outcomes except for the
  documented expiring-grants path).

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Analysis | `make check-module-deps` — duplicate capability declarations fail the build. |
| AC-2 | Test | `pk-modules/auth_management/features/permissions/req_auth_004_test.go::TestCheckUserPermission_FailsClosedOnRepoError` (explicit deny on read-failure). Match-side covered by `service_test.go::TestService_CheckUserPermission_NoMatch` + `TestService_CheckUserPermission_ExactMatch` + `TestService_CheckUserPermission_WildcardMatch`. |
| AC-3 | Mixed | Audit emission: `service_test.go::TestService_AssignUserRoles_Success` asserts `bus.Published()` carries one event. Cache invalidation: not yet verified at the unit level — the production path relies on the parent service evicting per-user permission caches; tracked as a follow-up test gap. |
| AC-4 | Test | `pk-modules/auth_management/features/permissions/req_auth_004_test.go::TestCheckUserPermission_IsDeterministic` calls the check ten times against an unchanged backing store and asserts the result is stable. |

## Implements (cross-cutting)

- REQ-001 — multi-tenant isolation (AC-3).
- REQ-004 — audit per mutation (AC-3).
- REQ-005 — authz fail-closed (AC-2).

## Satisfied by

- `pk-modules/auth_management/features/permissions/feature.go`
- `pk-modules/auth_management/features/permissions/service.go`,
  `service_test.go`
- `pk-modules/auth_management/features/permissions/adapters.go`,
  `adapters_test.go`
- `pk-modules/auth_management/features/permissions/handler.go`, `routes.go`

## Related requirements

- [REQ-AUTH-005 — Policy](./REQ-AUTH-005-policy.md) — the higher-level policy layer that consumes capabilities.
