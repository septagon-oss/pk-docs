---
id: REQ-AUTH-017
title: "Session lifecycle exposes list / revoke / switch operations bound to the requesting user"
status: Proposed
date: 2026-05-08
slug: req-auth-017-session-lifecycle
category: auth
ears_pattern: ubiquitous
priority: should
risk: medium
verification_methods: [test, inspection]
compliance:
  - SOC2_CC6.1
  - ISO27001_A.9.4
satisfied_by:
  adr: [ADR-0009]
  conventions: [C-04, C-14]
implements_cross_cutting: [REQ-001, REQ-004, REQ-005]
refines: REQ-AUTH-001
depends_on: [REQ-AUTH-010, REQ-AUTH-012]
type: doc
tags: [requirement, capability, auth_management, authentication, session]
module: auth_management
feature: authentication
capability: session_lifecycle
capability_kind: state_machine
stakeholders:
  - end-user (visibility into own active sessions)
  - operator (security-incident response — force-revoke a leaked session)
  - tenant administrator (cross-tenant session policy)
---

# REQ AUTH-017 — Session lifecycle (list, revoke, switch, statistics)

Status: **Proposed** (2026-05-08)

## Statement

The authentication service **shall** expose four
session-management operations:

1. **`GetUserSessions(userID, includeRevoked)`** — return the
   sessions belonging to the requesting user; results filter on
   `revoked_at` per the flag.
2. **`RevokeSession(currentToken, sessionID)`** — revoke a
   sibling session (a different device, say) without invalidating
   the current request's session. The current session may not
   self-revoke through this path; logout (REQ-AUTH-012) is the
   correct primitive.
3. **`SwitchTenantSession(req)`** — for a multi-tenant user,
   issue a new session bound to a different tenant the user is a
   member of, without re-authenticating. The previous tenant's
   session continues unaffected.
4. **`GetActiveSessionsCount` / `GetSessionStatistics`** —
   aggregate counts for operator dashboards and capacity planning.

Every operation **shall** scope to the requesting user (or, for
operator queries, require the explicit cross-tenant marker
described in REQ-007).

## Rationale

End-users and operators both need a session-management surface
beyond "log in" and "log out":

1. **User-side visibility.** A user who suspects their account
   has been used elsewhere needs to see "what sessions exist"
   and revoke specific ones — without that, the only recourse is
   "log out everywhere", which is a heavier hammer than the
   situation often warrants.
2. **Operator-side response.** When an SRE responds to "I think
   a token leaked from this customer's CI pipeline", the typical
   remediation is "find the session bound to that IP and revoke
   it". That requires a query surface and a targeted revoke
   primitive.
3. **Tenant switching.** The platform supports a user who
   belongs to multiple tenants (a consultant working with two
   customers). Switching tenants without re-entering credentials
   is the table-stakes UX; the discipline is "issue a new
   session, do not mutate the existing one" so the previous
   tenant context is preserved if the user wants to switch back.

The "cannot self-revoke through `RevokeSession`" rule is the
guard against "revoke the session you're currently using and
strand yourself" — logout is the explicit self-revocation path
because it includes the cookie-clearing handshake.

## Acceptance criteria

- **AC-1 — List own sessions.** `GetUserSessions(userID, false)`
  returns the user's non-revoked sessions; `includeRevoked=true`
  also surfaces historical entries for audit purposes.
- **AC-2 — Revoke sibling session.** `RevokeSession(token, id)`
  marks the named session revoked AND blacklists its bound
  refresh token, provided the named session belongs to the same
  user as the bearer of `token`.
- **AC-3 — Cannot self-revoke through this path.** Calling
  `RevokeSession` with the session id of the bearer's own
  session returns the typed `"cannot revoke current session"`
  error; the bearer must use logout (REQ-AUTH-012).
- **AC-4 — Cross-user-revoke refusal.** Calling `RevokeSession`
  with a session id belonging to a different user returns
  `"session not found"` (uniform with the missing-id case so
  the response does not leak the existence of the other user's
  session).
- **AC-5 — Tenant switch issues a new session.** A successful
  `SwitchTenantSession` mints a new session bound to the target
  tenant; the previous tenant's session remains active until
  separately revoked.
- **AC-6 — Tenant-switch membership check.** The switch refuses
  any tenant the user is not an active member of; the response
  shape is uniform with the missing-tenant case to avoid
  enumerating tenant memberships.
- **AC-7 — Aggregate statistics.** `GetActiveSessionsCount`
  returns the platform-wide count of non-revoked sessions for
  operator dashboards; `GetSessionStatistics` returns the
  per-tenant breakdown.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `pk-modules/auth_management/features/authentication/service_test.go::TestGetUserSessions_Success`. |
| AC-2 | Inspection | `service_test.go::TestRevokeSession_*` covers the targeted-revoke path. _Verification gap: pending — cited evidence is prose / pattern / non-Go and cannot be auto-resolved._ |
| AC-3 | Test | `pk-modules/auth_management/features/authentication/service_test.go::TestRevokeSession_CannotRevokeCurrentSession`. |
| AC-4 | Test | `pk-modules/auth_management/features/authentication/service_test.go::TestRevokeSession_SessionNotFound`. |
| AC-5 | Test | `pk-modules/auth_management/features/authentication/service_test.go::TestSwitchTenantSession_GeneratesSessionTokenWithoutProviderSession`. |
| AC-6 | Inspection | The `SwitchTenantSession` request validation enforces membership; reviewers verify the uniform-error shape. |
| AC-7 | Test | `pk-modules/auth_management/features/authentication/service_test.go::TestGetActiveSessionsCount_Success` + `TestGetSessionStatistics_Success`. |

## Edge cases & unhappy paths

- **Sessions list with paging.** Users with hundreds of stale
  sessions paginate through the result; the default shape
  returns the most recent N.
- **Tenant switch with MFA-required tenant.** A user switching
  into a tenant whose policy requires re-MFA is bounced through
  the MFA challenge flow; this REQ delegates to REQ-AUTH-013
  for that branch.
- **Stale session in the result.** A session whose refresh
  token has been revoked but whose row still says
  `revoked_at IS NULL` (race) is filtered out by the verifier
  on the next request; the list-side filter is best-effort.
- **Operator query.** Operators querying across users invoke a
  separate cross-tenant-explicit code path
  (`WithExpectedCrossTenantAccess`); this REQ does not cover
  that surface — REQ-OP-001 does.

## Risk

- **Likelihood:** Medium — list/revoke operations are
  exercised by security-conscious users and incident
  responders.
- **Impact:** Medium — a defective revoke leaves a session
  alive that the user thinks they have killed.
- **Mitigations:** Server-side row-revocation as source of
  truth (AC-2), cross-user opacity (AC-4), self-revoke refusal
  (AC-3) preserves logout as the canonical self-revocation
  path.

## Implements (cross-cutting)

- **REQ-001 — Multi-tenant isolation.** AC-5 + AC-6 enforce
  membership-bound session minting.
- **REQ-004 — Audit per mutation.** Every revoke and switch
  emits the catalogued event for the audit trail.
- **REQ-005 — Fail-closed.** AC-3 + AC-4 + AC-6 default-deny
  on any precondition mismatch.

## Compliance mapping

| Control | Coverage |
|---|---|
| SOC2 CC6.1 | AC-2 — operator-targetable session revocation. |
| ISO27001 A.9.4 | AC-1 — visibility into the current authenticated sessions. |

## Satisfied by

- `pk-modules/auth_management/features/authentication/login_session.go` —
  the session-mutation helpers.
- `pk-modules/auth_management/features/authentication/session.go` — the
  revoke / switch surface.
- `pk-modules/auth_management/features/authentication/stats_handler.go` —
  the aggregate-statistics surface.
- `pk-modules/auth_management/features/authentication/repository.go` —
  the persistence layer.

## Related requirements

- [REQ-AUTH-001 — Authentication umbrella](./REQ-AUTH-001-authentication.md)
- [REQ-AUTH-010 — Password login](./REQ-AUTH-010-login-credentials.md) — the source of new sessions.
- [REQ-AUTH-012 — Logout](./REQ-AUTH-012-logout.md) — the canonical self-revocation path.
- [REQ-OP-001 — Operator](./REQ-OP-001-operator.md) — the operator-side cross-user query surface this REQ deliberately excludes.
