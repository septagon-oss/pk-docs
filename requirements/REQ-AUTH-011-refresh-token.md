---
id: REQ-AUTH-011
title: "Refresh-token redemption mints a new access token while preserving session continuity"
status: Proposed
date: 2026-05-08
slug: req-auth-011-refresh-token
category: auth
ears_pattern: event-driven
priority: must
risk: high
verification_methods: [test, inspection]
compliance:
  - SOC2_CC6.1
  - ISO27001_A.9.4
  - OWASP_ASVS_3.2.1   # Token lifetime / rotation
satisfied_by:
  adr: [ADR-0009]
  conventions: [C-04, C-14]
implements_cross_cutting: [REQ-001, REQ-004, REQ-005]
refines: REQ-AUTH-001
depends_on: [REQ-AUTH-010, REQ-AUTH-016]
type: doc
tags: [requirement, capability, auth_management, authentication, refresh, token]
module: auth_management
feature: authentication
capability: refresh_token
capability_kind: state_machine
stakeholders:
  - end-user (web/mobile client)
  - operator (incident responder; needs replay-detection signals)
  - compliance auditor (token-lifetime hygiene)
---

# REQ AUTH-011 — Refresh-token redemption

Status: **Proposed** (2026-05-08)

## Statement

**When** a caller presents a refresh token at the
`RefreshAccessToken` endpoint, the system **shall** verify the
token's signature, blacklist status, and bound session, then
issue a new short-lived access token. **Where**
`RotateRefreshTokens` is enabled in the service config, the
system **shall** also blacklist the consumed refresh token and
mint a replacement so the original cannot be redeemed twice
(single-use semantic). **If** the token is invalid, expired,
revoked, blacklisted, or its bound user is no longer eligible
to log in, the redemption **shall** fail closed with a typed
error and never produce a new token.

## Rationale

Refresh tokens are the long-lived half of the platform's
session model — they let a client renew its access token without
forcing the user to re-enter credentials. That convenience comes
with two countervailing concerns:

1. **Replay risk.** A stolen refresh token is a long-running
   credential. The single-use rotation discipline (the "rotating
   refresh token" pattern documented in OWASP ASVS 3.2.1) shrinks
   the attacker's effective window to "between this redemption
   and the next" rather than the full token TTL. The blacklist
   step is what makes a redeemed token unusable a second time.
2. **State-change propagation.** A user who has just been
   suspended or had their roles revoked must lose their access on
   the next refresh — not days later when their access token
   finally expires. The user-status revalidation in this path is
   how role-revocation actually reaches the client.

The fail-closed posture for any precondition (invalid signature,
session expired, user inactive) reflects REQ-005: a refresh that
cannot be safely renewed must produce no token, even at the cost
of forcing the user back to the login flow.

## Acceptance criteria

- **AC-1 — Happy path.** A valid, non-blacklisted refresh token
  bound to an active session and active user returns a new
  access token whose claims (`user_id`, `tenant_id`, `session_id`)
  match the refreshed session.
- **AC-2 — Single-use rotation.** When `RotateRefreshTokens` is
  configured, the consumed refresh token is blacklisted via the
  cache (`blacklist:refresh:<hash>`) and a fresh refresh token is
  returned alongside the new access token. A second redemption
  with the original refresh token returns
  `"refresh token revoked"`.
- **AC-3 — Empty / malformed input.** An empty `RefreshToken`
  returns `"refresh token is required"`; a token whose JWT
  signature does not verify against the configured secret
  returns `"invalid refresh token"` — neither path mutates state.
- **AC-4 — Blacklist precedence.** A token explicitly blacklisted
  (because the user logged out, or rotation already consumed it)
  is rejected before any further validation; the cache lookup is
  the first hop.
- **AC-5 — Session continuity.** A refresh whose claimed
  `session_id` no longer maps to a session row returns
  `"session expired"`. The session row is updated with the
  current refresh time so subsequent reads see a fresh
  `last_active_at`.
- **AC-6 — User-status revalidation.** A refresh against a user
  whose status has flipped to `inactive`, `suspended`, or
  `pending_verification` since the original login fails closed
  with the typed status error and is not silently downgraded to
  a generic "invalid token".
- **AC-7 — Cache outage tolerance.** If the blacklist-cache
  lookup fails (network error against the shared cache), the
  service logs the failure at Warn and continues with the rest
  of the validation chain. This is an explicit availability
  trade-off documented at `refresh_token.go:174-178` — the
  alternative ("reject every refresh while cache is down") would
  amplify the outage; reviewers verify the trade-off remains
  acceptable for the deployed cache implementation.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `modules/platformkit-business-modules/auth_management/features/authentication/req_auth_001_test.go::TestRefresh_SingleUse_FailsOnReplay` (first redemption must succeed before the second can fail). |
| AC-2 | Test | `modules/platformkit-business-modules/auth_management/features/authentication/req_auth_001_test.go::TestRefresh_SingleUse_FailsOnReplay` exercises the rotation discipline end-to-end. |
| AC-3 | Test | `modules/platformkit-business-modules/auth_management/features/authentication/service_test.go::TestRefreshAccessToken_EmptyToken` and the JWT-parsing branch in `validateRefreshToken`. |
| AC-4 | Test | `modules/platformkit-business-modules/auth_management/features/authentication/service_test.go::TestRefreshAccessToken_BlacklistedToken`. |
| AC-5 | Inspection | `refresh_token.go:194-197` — typed `"session expired"` return when `getSession` returns nil. |
| AC-6 | Inspection | `refresh_token.go:206-208` — `validateRefreshTokenUserStatus` propagates the typed status errors. |
| AC-7 | Inspection | `refresh_token.go:174-178` — Warn-and-continue branch on cache error, with the documented trade-off. |

## Edge cases & unhappy paths

- **Clock skew at sign-time.** A JWT signed slightly in the
  future (clock skew across sign + verify hosts) is currently
  rejected as malformed. Acceptable while the platform runs all
  components against an NTP-synced clock; revisit if the
  acceptable skew widens.
- **Concurrent redemption race.** Two redemptions of the same
  refresh token issued in rapid succession can both pass the
  blacklist check and the second invalidation can race. The
  current cache implementation is best-effort under contention;
  for stricter guarantees the deployment must use a cache that
  supports atomic compare-and-set.
- **Refresh token without rotation.** Deployments that explicitly
  disable rotation (`RotateRefreshTokens: false`) trade the
  single-use guarantee for a longer-lived token. AC-2 does not
  apply in that mode; reviewers confirm the deployment's threat
  model accepts the trade.
- **Tenant override at refresh time.** The `tenant_id` claim is
  preserved across refresh; switching tenants requires
  `SwitchTenantSession` (REQ-AUTH-017), not a refresh.

## Risk

- **Likelihood:** High — refresh paths are exercised on every
  active session.
- **Impact:** High — a successful replay reissues an access token
  that the attacker can use until rotation closes the window.
- **Mitigations:** Single-use rotation (AC-2), blacklist-first
  ordering (AC-4), user-status revalidation (AC-6), short access-
  token TTL (`AccessTokenTTL`, separate from this REQ).

## Implements (cross-cutting)

- **REQ-001 — Multi-tenant isolation.** AC-1 preserves tenant
  binding across the rotation.
- **REQ-004 — Audit per mutation.** Rotation events (rejected
  blacklisted, rejected expired, rejected user-status) flow
  through the standard audit path.
- **REQ-005 — Fail-closed.** AC-3..AC-6 default-deny when any
  precondition is missing.

## Compliance mapping

| Control | Coverage |
|---|---|
| SOC2 CC6.1 | AC-1, AC-6 — only active users renew access. |
| ISO27001 A.9.4 | AC-2 (rotation) + AC-4 (revocation propagation). |
| OWASP ASVS 3.2.1 | AC-2 — single-use rotating refresh tokens are the documented pattern. |

## Satisfied by

- `modules/platformkit-business-modules/auth_management/features/authentication/refresh_token.go` —
  the verifier + rotator.
- `modules/platformkit-business-modules/auth_management/features/authentication/login_session.go::generateAccessToken` /
  `generateRefreshToken` — the token-mint helpers.
- `modules/platformkit-business-modules/auth_management/features/authentication/req_auth_001_test.go` — replay-rejection coverage.

## Related requirements

- [REQ-AUTH-001 — Authentication umbrella](./REQ-AUTH-001-authentication.md)
- [REQ-AUTH-010 — Password login](./REQ-AUTH-010-login-credentials.md) — the path that mints the original tokens.
- [REQ-AUTH-012 — Logout](./REQ-AUTH-012-logout.md) — the session-revocation counterpart whose blacklist this path consults.
- [REQ-AUTH-016 — Token verification](./REQ-AUTH-016-token-verification.md) — the access-token validator the new token feeds.
