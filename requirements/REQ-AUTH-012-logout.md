---
id: REQ-AUTH-012
title: "Logout revokes the active session and any bound refresh token"
status: Proposed
date: 2026-05-08
slug: req-auth-012-logout
category: auth
ears_pattern: event-driven
priority: must
risk: medium
verification_methods: [test, inspection]
compliance:
  - SOC2_CC6.1
  - SOC2_CC6.7
  - ISO27001_A.9.4
satisfied_by:
  adr: [ADR-0009]
  conventions: [C-04, C-14]
implements_cross_cutting: [REQ-001, REQ-004, REQ-005]
refines: REQ-AUTH-001
depends_on: [REQ-AUTH-010]
type: doc
tags: [requirement, capability, auth_management, authentication, logout, session]
module: auth_management
feature: authentication
capability: logout
capability_kind: state_machine
stakeholders:
  - end-user (account holder ending a session)
  - operator (forced-logout responder)
  - compliance auditor (session-termination evidence)
---

# REQ AUTH-012 — Logout

Status: **Proposed** (2026-05-08)

## Statement

**When** a user submits a logout request — whether the
single-session flow (`Logout`) or the every-session flow
(`LogoutEverywhere`) — the system **shall** mark the session row
revoked, blacklist any associated refresh token in the shared
cache, surface an optional provider-side logout call, and emit
the catalogued `auth.user.logged_out` audit event. **If** the
logout-everywhere flow is invoked, the system **shall**
additionally revoke every other session bound to the same
user-id without disturbing sessions in other tenants the user
also belongs to.

## Rationale

Logout is the primary user-controlled defence against a
compromised device. The discipline this REQ encodes:

1. **Revocation must be immediate.** A session marked revoked
   must fail validation on the very next request. This is what
   makes "log out from my old laptop" a real safety lever
   rather than a cosmetic UI control.
2. **Refresh-token blacklist is co-equal with session revocation.**
   Without it, a stolen refresh token would continue to mint
   access tokens after the user thought they had logged out.
   The blacklist key (`blacklist:refresh:<hash>`) lives in the
   shared cache so every replica observes the revocation.
3. **Logout-everywhere is per-user, not per-account-record.**
   A user who is a member of two tenants and logs out of one
   should not lose their session in the other. The query is
   scoped accordingly.

The provider-side logout (when an `AuthProvider` is configured)
is best-effort — a provider that fails to acknowledge our
logout still results in our session being revoked locally; the
provider's stale state is the operator's problem, not the
end-user's.

## Acceptance criteria

- **AC-1 — Single-session revocation.** A `Logout` call against
  a valid session token transitions the session row to
  `revoked_at = now()`, blacklists the bound refresh token in
  the cache, and emits `auth.user.logged_out`.
- **AC-2 — Refresh-token blacklist coverage.** A subsequent
  `RefreshAccessToken` call with the revoked refresh token
  fails with `"refresh token revoked"` (REQ-AUTH-011 AC-4).
- **AC-3 — Logout-everywhere.** A `LogoutEverywhere` call
  iterates the user's other sessions, marking each revoked and
  blacklisting each refresh token; the originating session is
  revoked last so the response can include the count of
  terminated sessions.
- **AC-4 — Provider-side fail-soft.** If the configured
  `AuthProvider.Logout` returns an error, the local revocation
  still completes and the failure is logged at Warn. The user
  is logged out from the platform's perspective; the provider's
  state is reconciled out of band.
- **AC-5 — Concurrent-revoke safety.** A logout against a
  session that is already revoked returns success (idempotent);
  the second call does not produce a duplicate audit event.
- **AC-6 — Logout-everywhere error reporting.** If
  `LogoutEverywhere` cannot revoke one of the user's other
  sessions (e.g. database error mid-iteration), the call
  returns a typed error AND the partial-revocation count, so
  the caller can decide whether to retry.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `pk-modules/auth_management/features/authentication/service_test.go::TestLogout_Success` and `TestLogout_WithRefreshToken`. |
| AC-2 | Inspection | `pk-modules/auth_management/features/authentication/service_test.go::TestLogout_WithRefreshToken` asserts `blacklist:refresh:<hash>` exists post-call; refresh consumption is covered in `TestRefreshAccessToken_BlacklistedToken`. |
| AC-3 | Test | `pk-modules/auth_management/features/authentication/service_test.go::TestLogout_WithLogoutEverywhere`. |
| AC-4 | Inspection | `logout.go` provider-call wrapper logs and continues on provider error; reviewers verify the local revocation is unconditional. |
| AC-5 | Inspection | The service's update-then-publish ordering uses the row's pre-revocation state; an already-revoked row is a no-op write. |
| AC-6 | Test | `pk-modules/auth_management/features/authentication/service_test.go::TestLogout_WithLogoutEverywhere_ReturnsErrorWhenSessionRevocationFails`. |

## Edge cases & unhappy paths

- **Logout without a session token.** An empty bearer token
  returns the typed `"no session"` error from the upstream
  middleware before reaching this code path.
- **Cookie present, server-side session gone.** A logout
  against an unknown session id returns success (idempotent) so
  the client can clear its cookie without an error spinner.
- **Cache outage during logout.** If the blacklist cache write
  fails, the session row is still marked revoked. The platform
  defaults to "session-row-revocation is the source of truth"
  and the cache is the optimisation; reviewers verify the
  validate path consults the row, not just the cache.
- **Logout-everywhere on a user with one session.** The flow
  degenerates to single-session logout without an extra
  iteration penalty.

## Risk

- **Likelihood:** Medium — logout is invoked on every active
  user session at least once per device lifetime.
- **Impact:** High — a logout that does not actually revoke is
  a silent persistence of a credential the user believed they
  had ended.
- **Mitigations:** Server-side row-revocation as source of
  truth (AC-5); blacklist-cache as defence in depth (AC-2);
  provider fail-soft with observability (AC-4).

## Implements (cross-cutting)

- **REQ-001 — Multi-tenant isolation.** Logout-everywhere is
  scoped per (user-id, tenant), never globally.
- **REQ-004 — Audit per mutation.** `auth.user.logged_out`
  emitted on every revoke.
- **REQ-005 — Fail-closed.** AC-2 + AC-3 default-deny on
  subsequent token use; AC-6 surfaces partial failure.

## Compliance mapping

| Control | Coverage |
|---|---|
| SOC2 CC6.1 | AC-1, AC-3 — explicit session termination on user request. |
| SOC2 CC6.7 | AC-2 — revoked credentials cannot be replayed. |
| ISO27001 A.9.4 | AC-1, AC-3 — logoff procedure with audit trail. |

## Satisfied by

- `pk-modules/auth_management/features/authentication/logout.go` — handler
  and orchestration.
- `pk-modules/auth_management/features/authentication/login_session.go` —
  the session-mutation helpers `Logout` consumes.
- `pk-modules/auth_management/features/authentication/repository.go` —
  session-row writes.
- `pk-modules/auth_management/features/authentication/logout_browser_test.go` —
  HTML form coverage.

## Related requirements

- [REQ-AUTH-001 — Authentication umbrella](./REQ-AUTH-001-authentication.md)
- [REQ-AUTH-010 — Password login](./REQ-AUTH-010-login-credentials.md) — the session this revokes.
- [REQ-AUTH-011 — Refresh token](./REQ-AUTH-011-refresh-token.md) — the blacklist consumer.
- [REQ-AUTH-016 — Token verification](./REQ-AUTH-016-token-verification.md) — the access-token validator the revocation propagates to.
