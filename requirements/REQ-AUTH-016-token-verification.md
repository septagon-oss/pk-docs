---
id: REQ-AUTH-016
title: "Access-token verification validates an inbound bearer token before any privileged action"
status: Proposed
date: 2026-05-08
slug: req-auth-016-token-verification
category: auth
ears_pattern: ubiquitous
priority: must
risk: high
verification_methods: [test, inspection]
compliance:
  - SOC2_CC6.1
  - ISO27001_A.9.4
  - OWASP_ASVS_3.5   # Token-based session management
satisfied_by:
  adr: [ADR-0009]
  conventions: [C-04, C-14]
implements_cross_cutting: [REQ-001, REQ-005]
refines: REQ-AUTH-001
depends_on: [REQ-AUTH-010]
type: doc
tags: [requirement, capability, auth_management, authentication, token, jwt]
module: auth_management
feature: authentication
capability: token_verification
capability_kind: failure_mode
stakeholders:
  - end-user (every authenticated request)
  - operator (revocation propagation must be observable)
  - compliance auditor (session lifetime hygiene)
---

# REQ AUTH-016 — Access-token verification

Status: **Proposed** (2026-05-08)

## Statement

The `VerifyToken` endpoint **shall** validate an inbound bearer
token by:

1. Checking the cache-backed blacklist (`blacklist:token:<hash>`)
   before any cryptographic work — so a revoked token is denied
   even if its signature is valid;
2. Verifying the JWT signature against the configured secret
   and the `HS256` algorithm — refusing alternative algorithms
   that would let an attacker downgrade to `none`;
3. Confirming the token's claims (`type`, `user_id`,
   `tenant_id`, `session_id`, `exp`) are well-formed and
   non-empty;
4. Refusing tokens whose claimed type does not match the
   requested verification class (e.g. a refresh token presented
   to the access-token endpoint).

**If** any check fails, the endpoint **shall** return a typed
error and never expose the token's payload to the caller.

## Rationale

Token verification is on the hot path of every authenticated
request; the discipline this REQ encodes is the cumulative
result of a long line of CVE-class mistakes:

1. **`alg: none` attack.** JWT libraries that accept whatever
   algorithm the token claims allow an attacker to sign a
   token with no key by setting `alg: none`. The platform
   pins HMAC-SHA256 explicitly and rejects mismatches.
2. **Type confusion.** Refresh tokens and access tokens share
   structure but not authority; presenting one where the
   other is expected has been a documented platform-breaker.
   The `type` claim check (line 300-303 of `refresh_token.go`,
   mirrored on the access path) closes the gap.
3. **Revocation lag.** Without a blacklist consulted *before*
   signature verification, a revoked token would still
   produce verification-success for the duration of its TTL —
   the SRE who clicked "log out everyone" would see no effect
   for hours. Blacklist-first ordering propagates revocation
   immediately on the next request.

## Acceptance criteria

- **AC-1 — Blacklist check first.** A token whose hash is in
  the `blacklist:token:<hash>` cache is rejected before the
  signature check executes; the cache lookup is the first
  branch in `VerifyToken`.
- **AC-2 — Algorithm pinning.** A JWT whose header declares
  any algorithm other than `HS256` is rejected with the typed
  unexpected-signing-method error.
- **AC-3 — Required claim presence.** Tokens missing or
  malforming `type`, `user_id`, `tenant_id`, `session_id`, or
  `exp` are rejected with a typed claim-validation error.
- **AC-4 — Type discrimination.** A refresh token presented to
  `VerifyToken` (which expects `type=access`) returns the
  typed token-type error; the inverse holds for
  `RefreshAccessToken`.
- **AC-5 — Default token-type fallback.** When the request
  omits the `TokenType` field, the verifier defaults to
  `access` rather than failing — the documented compatibility
  behaviour for existing clients.
- **AC-6 — Expired token.** A token whose `exp` is in the past
  is rejected with the typed expiry error; the user-status
  cache is not consulted because the verdict is cryptographic.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `pk-modules/auth_management/features/authentication/service_test.go::TestVerifyToken_BlacklistedToken`. |
| AC-2 | Inspection | `refresh_token.go::validateRefreshToken` (lines 285-289) pins `*jwt.SigningMethodHMAC` and rejects everything else; the access-token validator uses the same primitive. |
| AC-3 | Inspection | The claim-presence checks in `validateRefreshToken` apply to the access-token validator too; reviewers verify both paths. |
| AC-4 | Test | `pk-modules/auth_management/features/authentication/service_test.go::TestRefreshAccessToken_BlacklistedToken` covers the refresh side; the access side is exercised through the bearer middleware tests in `platformkit-backend-kit/security/authn`. |
| AC-5 | Test | `pk-modules/auth_management/features/authentication/service_test.go::TestVerifyToken_DefaultsToAccessType`. |
| AC-6 | Inspection | The JWT library's `Valid` flag captures expiry; reviewers confirm the typed error path. |

## Edge cases & unhappy paths

- **Cache outage during blacklist lookup.** If the blacklist
  cache fails, the verifier logs at Warn and continues — the
  same trade-off as REQ-AUTH-011 AC-7. A signed,
  not-yet-expired, not-blacklisted-as-far-as-we-can-tell
  token is accepted.
- **Malformed JWT (not-a-token).** A garbage string returns
  the typed parse error from the JWT library; the response is
  the same generic "invalid token" shape.
- **Token signed with a rotated secret.** The platform does
  not currently support multi-key verification; rotating
  `JWTSecretKey` invalidates every outstanding token. This is
  intentional — key rotation is rare and the global
  invalidation matches the threat model of "we suspect the
  signing key leaked".
- **Tokens used across deployments.** Two deployments running
  with different `JWTSecretKey` values produce mutually
  unverifiable tokens; this is a feature for deployment
  isolation.

## Risk

- **Likelihood:** High — every authenticated request hits the
  verifier.
- **Impact:** Critical — verification bypass undoes the entire
  authentication system.
- **Mitigations:** Algorithm pinning (AC-2), claim presence
  checks (AC-3), type discrimination (AC-4), blacklist-first
  ordering (AC-1).

## Implements (cross-cutting)

- **REQ-001 — Multi-tenant isolation.** AC-3 surfaces the
  tenant claim that downstream authz consumes.
- **REQ-005 — Fail-closed.** AC-1..AC-6 default-deny on any
  precondition failure.

## Compliance mapping

| Control | Coverage |
|---|---|
| SOC2 CC6.1 | AC-1, AC-4 — only valid, non-revoked credentials authorise actions. |
| ISO27001 A.9.4 | AC-1 + AC-3 — credential-validity check at every privileged-action boundary. |
| OWASP ASVS 3.5 | AC-1..AC-6 — full coverage of the JWT-based session-management requirements. |

## Satisfied by

- `pk-modules/auth_management/features/authentication/verify_token.go` —
  the verifier surface.
- `pk-modules/auth_management/features/authentication/refresh_token.go::validateRefreshToken` —
  the underlying signature + claim check the access-token path
  shares.
- `pk-modules/auth_management/features/authentication/login_session.go::generateAccessToken` —
  the producer side that the verifier round-trips.

## Related requirements

- [REQ-AUTH-001 — Authentication umbrella](./REQ-AUTH-001-authentication.md)
- [REQ-AUTH-010 — Password login](./REQ-AUTH-010-login-credentials.md) — the path that mints the token.
- [REQ-AUTH-011 — Refresh token](./REQ-AUTH-011-refresh-token.md) — the parallel verifier on the renewal path.
- [REQ-AUTH-012 — Logout](./REQ-AUTH-012-logout.md) — the source of the blacklist this verifier consults.
