---
id: REQ-AUTH-012
title: "Logout durably revokes sessions and refresh families"
status: Proposed
date: 2026-07-18
slug: req-auth-012-logout
category: auth
ears_pattern: event-driven
priority: must
risk: high
verification_methods: [test, inspection]
compliance:
  - SOC2_CC6.1
  - SOC2_CC6.7
  - ISO27001_A.9.4
satisfied_by:
  adr: [ADR-0006, ADR-0007, ADR-0067]
  conventions: [C-04, C-19, C-14]
implements_cross_cutting: [REQ-001, REQ-004, REQ-005]
refines: REQ-AUTH-001
depends_on: [REQ-AUTH-010, REQ-AUTH-011, REQ-AUTH-016]
type: doc
tags: [requirement, capability, auth_management, authentication, logout, session, revocation]
module: auth_management
feature: authentication
capability: logout
capability_kind: state_machine
stakeholders:
  - end-user
  - operator
  - compliance auditor
---

# REQ AUTH-012 — Durable logout

Status: **Proposed** (2026-07-18)

## Statement

**When** an authenticated user logs out of one session, the system **shall**
cryptographically derive the exact user and session from the presented access
token and atomically revoke that durable session and its refresh family. **When**
the user selects logout everywhere, the system **shall** revoke every session
and refresh family owned by that platform identity. Cache invalidation and
provider logout **shall** remain secondary effects that cannot weaken the
committed local revocation.

## Rationale

Logout is a security boundary, not a cookie-clearing hint. A Redis blacklist
alone is insufficient because failed writes and eviction can make an old token
look current. Conversely, a submitted refresh-token body is untrusted input and
must not select which durable credential is revoked.

The session row and refresh family are the local authority. Their revocation
commits with audit and event intent. Ordinary platform access tokens are then
checked against that session and the active user on every request, while every
refresh attempt must pass the family ledger. Provider logout and cache JTI
markers improve immediacy but cannot undo or substitute for this boundary.

## Acceptance criteria

- **AC-1 — Verified logout subject.** Logout accepts only a valid access-purpose
  token and derives its non-empty user and session IDs from verified claims. It
  reloads the exact active session and rejects ownership mismatch.
- **AC-2 — Atomic single-session revocation.** One logout transaction revokes
  the exact session, its refresh family, audit intent, and
  `auth.user.logged_out` event. No caller-supplied refresh bearer is trusted as
  revocation authority.
- **AC-3 — Global identity logout.** Logout everywhere revokes all sessions and
  families owned by the authenticated platform user, across devices and tenant
  contexts, without touching another user's state.
- **AC-4 — Durable access-token enforcement.** Every platform token explicitly
  marked `type=access` is rejected after its exact session is inactive, absent,
  mismatched, or unavailable, or its exact user is inactive or unavailable.
  This check runs on every request even when JWT parsing is cached.
- **AC-5 — Cache is defence in depth.** Logout attempts to write the access JTI,
  token digest, and session invalidation marker, but cache failure does not
  roll back local logout and cache absence cannot make the durable session or
  family valid.
- **AC-6 — Provider fail-soft.** Provider-side logout runs after local commit.
  Its failure is logged without restoring the local session or returning a
  false local failure.
- **AC-7 — Idempotent browser outcome.** A repeated browser logout whose session
  is already absent or revoked still allows the client to clear its cookie and
  reach the signed-out state; it does not emit a duplicate durable mutation.
- **AC-8 — Transaction failure is explicit.** A database, audit, or outbox
  failure returns an error and commits none of the requested revocations. The
  service never reports a partially successful logout-everywhere count as a
  completed security outcome.
- **AC-9 — Session isolation.** Single-session logout leaves sibling sessions
  active. Logout everywhere may affect siblings of the same user but never a
  session or family bound to another user.
- **AC-10 — No recoverable bearer persistence.** Logout never reads or restores
  a raw refresh token from the session row; durable revocation targets the
  family by session or user identity.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `modules/platformkit-business-modules/auth_management/features/authentication/logout_security_test.go::TestLogoutDerivesRealUserFromVerifiedToken` and `TestLogoutRejectsForgedToken`. |
| AC-2 | Test | `modules/platformkit-business-modules/auth_management/features/authentication/refresh_token_durable_test.go::TestBrowserLogoutWithoutRefreshTokenRevokesDurableFamilyDuringCacheOutage` and `modules/platformkit-business-modules/auth_management/features/authentication/service_test.go::TestLogout_DoesNotTrustSubmittedRefreshToken`. |
| AC-3 | Test | `modules/platformkit-business-modules/auth_management/features/authentication/logout_security_test.go::TestLogoutEverywhereIsolatesUsers`. |
| AC-4 | Test | `core/platformkit-backend-kit/security/authn/jwt_middleware_access_session_test.go::TestJWTMiddlewareAccessVerifierFailuresFailClosed` plus auth-management access-session verifier tests exercise inactive, mismatched, unavailable, and parser-cache paths. |
| AC-5 | Test | `modules/platformkit-business-modules/auth_management/features/authentication/refresh_token_durable_test.go::TestBrowserLogoutWithoutRefreshTokenRevokesDurableFamilyDuringCacheOutage`. |
| AC-6 | Inspection | `modules/platformkit-business-modules/auth_management/features/authentication/logout.go` commits the local mutation before calling `AuthProvider.Logout` and logs provider failure at warning severity. |
| AC-7 | Test | `modules/platformkit-business-modules/auth_management/features/authentication/logout_browser_test.go::TestHandleLogoutBrowser_LogoutEverywhereUsesExistingLogoutFlow` plus browser logout cases cover invalid-session cleanup and cookie deletion. |
| AC-8 | Test | `modules/platformkit-business-modules/auth_management/features/authentication/service_test.go::TestLogout_WithLogoutEverywhere_ReturnsErrorWhenSessionRevocationFails` plus refresh/session mutation cases inject write failure; production requires the atomic mutation runner at startup. |
| AC-9 | Test | `modules/platformkit-business-modules/auth_management/features/authentication/logout_security_test.go::TestSingleLogoutRevokesOnlyPresentedSession` and `TestLogoutEverywhereIsolatesUsers`. |
| AC-10 | Test | `modules/platformkit-business-modules/auth_management/features/authentication/refresh_token_migration_test.go::TestDurableRefreshTokenMigrationContainsNoRawBearerColumn`. |

## Edge cases and unhappy paths

- **Cache outage.** Durable session and family revocation still commits. The
  access-session and refresh-family validators continue to reject the bearer.
- **Provider outage.** Local logout remains successful; provider state is
  reconciled separately.
- **Already inactive session.** The service does not mutate it again, while the
  browser still clears its credential.
- **Logout everywhere during another login.** Only sessions visible inside the
  authenticated user's transaction are targeted; any later session must pass
  its own authorization boundary and remains independently revocable.
- **Typeless preview credentials.** Separately governed local preview tokens do
  not claim PlatformKit access-session purpose and are outside this durable
  family contract.

## Risk

- **Likelihood:** Medium — users routinely end sessions and operators force
  logout during incidents.
- **Impact:** Critical — a cosmetic logout preserves an attacker-controlled
  bearer after the user believes it is dead.
- **Mitigations:** Verified subject derivation, atomic durable session/family
  revocation, per-request access-session checks, mandatory refresh rotation,
  and cache-independent enforcement.

## Implements (cross-cutting)

- **REQ-001 — Multi-tenant isolation.** Exact session ownership is verified and
  another user's sessions are never selected.
- **REQ-004 — Audit per mutation.** Logout state and audit/event intent commit
  together.
- **REQ-005 — Fail closed.** Unknown durable state cannot authorize subsequent
  access or refresh.

## Compliance mapping

| Control | Coverage |
|---|---|
| SOC2 CC6.1 | AC-1, AC-2, AC-3 — authenticated, scoped session termination. |
| SOC2 CC6.7 | AC-4, AC-5, AC-10 — revoked credentials cannot regain authority through cache loss or raw storage. |
| ISO27001 A.9.4 | AC-2, AC-3, AC-6 — reliable logoff with local audit evidence. |

## Satisfied by

- `auth_management/features/authentication/logout.go`
- `auth_management/features/authentication/refresh_token_store.go`
- `auth_management/features/authentication/access_session_verifier.go`
- `platformkit-backend-kit/security/authn/jwt_middleware.go`
- `auth_management/migrations/019_create_durable_refresh_token_families.up.sql`

## Related requirements

- [REQ-AUTH-001 — Authentication umbrella](./REQ-AUTH-001-authentication.md)
- [REQ-AUTH-010 — Password login](./REQ-AUTH-010-login-credentials.md)
- [REQ-AUTH-011 — Refresh-token redemption](./REQ-AUTH-011-refresh-token.md)
- [REQ-AUTH-016 — Token verification](./REQ-AUTH-016-token-verification.md)
- [REQ-AUTH-017 — Session lifecycle](./REQ-AUTH-017-session-lifecycle.md)
- [ADR 0067 — Refresh tokens use durable single-use families](../adr/0067-refresh-tokens-use-durable-single-use-families.md)
