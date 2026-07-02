---
id: REQ-AUTH-040
title: "Permission check evaluates a (user, capability) pair against the user's role-bound permission set"
status: Proposed
date: 2026-05-08
slug: req-auth-040-permission-check
category: auth
ears_pattern: ubiquitous
priority: must
risk: critical
verification_methods: [test, inspection]
compliance:
  - SOC2_CC6.1
  - SOC2_CC6.3   # Role-based access
  - ISO27001_A.9.4
  - NIST_AC-3    # Access enforcement
satisfied_by:
  adr: [ADR-0009]
  conventions: [C-04, C-14]
implements_cross_cutting: [REQ-001, REQ-005]
refines: REQ-AUTH-004
type: doc
tags: [requirement, capability, auth_management, permissions, authz]
module: auth_management
feature: permissions
capability: check_permission
capability_kind: failure_mode
stakeholders:
  - end-user (every authorised request)
  - tenant administrator (role assignment)
  - compliance auditor (access-enforcement evidence)
---

# REQ AUTH-040 — Permission check

Status: **Proposed** (2026-05-08)

## Statement

`Service::CheckUserPermission(ctx, userID, permission)`
**shall** resolve the requesting user's effective permission
set via the user-permission repository, normalise the requested
capability through `authz.NormalizePermissionToken`, walk the
user's permissions matching either an exact or wildcard
(`resource:*`) against the canonical token, and return `true`
on match / `false` on miss. **If** the underlying read fails,
the function **shall** return `(false, err)` so callers that
ignore the error still see a deny — fail-closed by construction.

## Rationale

Permission checking is the platform's authoritative authz gate
on the request hot path. The discipline it encodes:

1. **Default-deny on read failure.** A transient database
   error returns `(false, err)`; a caller that treats `false`
   as deny remains safe even if it forgets the error.
2. **Wildcard semantics.** A role grants
   `admin.users:*` and a check for `admin.users:read` must
   match. The wildcard is a documented affordance for
   role-grant ergonomics; the matcher is `matchesPermission`
   in `service.go`.
3. **Determinism.** Same `(user, capability)` returns the
   same outcome for the duration of the user's permission
   cache; callers can rely on stability across closely-spaced
   calls in the same request.
4. **Canonical token form.** Two roles granting
   `admin.users:read` and `Admin.Users:READ` resolve to the
   same canonical token before matching; case- and
   whitespace-insensitive matching is the explicit policy.

The "purity" property — same inputs at a fixed point in time
yield the same outcome — is what makes denial decisions
debuggable from logs alone. A non-deterministic check would
let "I have the role, why am I being denied?" devolve into
case-by-case forensics.

## Acceptance criteria

- **AC-1 — Exact match.** A user whose stored permission set
  contains the exact canonical token returns `true`.
- **AC-2 — Wildcard match.** A user whose stored set contains
  `<resource>:*` returns `true` for any capability token of
  the form `<resource>:<verb>`.
- **AC-3 — Miss returns false.** A user whose stored set
  does not match the canonical token returns `(false, nil)`.
- **AC-4 — Read-failure fail-closed.** When
  `userRepo.GetUserPermissions` returns a non-nil error, the
  function returns `(false, err)` — no silent allow.
- **AC-5 — Determinism.** A repeated call with identical
  inputs against an unchanged repository state returns the
  same result.
- **AC-6 — Token normalisation.** `Admin.Users:Read`,
  `admin.users:read`, and `  admin.users:read  ` all
  canonicalise to the same token before matching.
- **AC-7 — Empty role-set fail-closed.** A user with no
  bound permissions returns `(false, nil)` for every
  capability, never `(true, nil)` for any.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `modules/platformkit-business-modules/auth_management/features/permissions/service_test.go::TestService_CheckUserPermission_ExactMatch`. |
| AC-2 | Test | `modules/platformkit-business-modules/auth_management/features/permissions/service_test.go::TestService_CheckUserPermission_WildcardMatch`. |
| AC-3 | Test | `modules/platformkit-business-modules/auth_management/features/permissions/service_test.go::TestService_CheckUserPermission_NoMatch`. |
| AC-4 | Test | `modules/platformkit-business-modules/auth_management/features/permissions/req_auth_004_test.go::TestCheckUserPermission_FailsClosedOnRepoError`. |
| AC-5 | Test | `modules/platformkit-business-modules/auth_management/features/permissions/req_auth_004_test.go::TestCheckUserPermission_IsDeterministic`. |
| AC-6 | Inspection | `authz.NormalizePermissionToken` strips/lowercases per its contract; reviewers verify the helper is the single normalisation point. |
| AC-7 | Inspection | The empty-set iteration trivially returns `false`; reviewers verify no fallback returns `true`. |

## Edge cases & unhappy paths

- **API-key principal.** When the request bears an API-key
  principal, the check routes through
  `CheckPermission` (which delegates to
  `checkAPIKeyPermission`) so the permission set
  resolves against the API key's grant rather than the
  user's role bindings.
- **Wildcard at multiple levels.** `*:*` (everything) is
  refused at role-creation time (system policy); a leaked
  super-grant must not slip past the matcher.
- **Cache coherency post-role-change.** Role mutations
  invalidate the user's permission cache on the next request
  (REQ-AUTH-004 AC-3). Within a single request, the cache
  is consistent.
- **Permission token typos.** A capability token that fails
  normalisation (malformed) returns the typed normalisation
  error; the deny is fail-closed.

## Risk

- **Likelihood:** Critical — every authz-gated endpoint
  consults this check.
- **Impact:** Critical — a defective check produces either
  blanket deny (DoS) or blanket allow (privilege bypass).
- **Mitigations:** Read-failure fail-closed (AC-4),
  determinism (AC-5), normalisation (AC-6), test coverage
  on every match path.

## Implements (cross-cutting)

- **REQ-001 — Multi-tenant isolation.** Permission lookup
  is scoped to the user's tenant via the role-binding query.
- **REQ-005 — Fail-closed.** AC-3, AC-4, AC-7 are the
  fail-closed defaults.

## Compliance mapping

| Control | Coverage |
|---|---|
| SOC2 CC6.1 | AC-1..AC-7 — access-enforcement at every privileged surface. |
| SOC2 CC6.3 | AC-1 + AC-2 — role-based access via role-bound permissions. |
| ISO27001 A.9.4 | AC-1, AC-4 — fail-closed authz gate. |
| NIST AC-3 | AC-1..AC-7 — explicit access-enforcement policy. |

## Satisfied by

- `modules/platformkit-business-modules/auth_management/features/permissions/service.go::CheckUserPermission` —
  the entry point.
- `modules/platformkit-business-modules/auth_management/features/permissions/service.go::matchesPermission` —
  the wildcard matcher.
- `security/authz/NormalizePermissionToken` — the canonical
  token primitive.

## Related requirements

- [REQ-AUTH-004 — Permissions umbrella](./REQ-AUTH-004-permissions.md)
- [REQ-AUTH-041 — Role assignment](./REQ-AUTH-041-role-assignment.md) — the producer of the role-bound permissions this check consumes.
- [REQ-AUTH-005 — Policy](./REQ-AUTH-005-policy.md) — the higher-level ABAC layer that composes capability checks.
- [REQ-005 — Fail-closed](./REQ-005-authorisation-fails-closed.md) — the cross-cutting discipline this capability instruments.
