---
id: REQ-AUTH-001
title: "Authentication feature issues bounded sessions and surfaces only opaque login outcomes"
status: Proposed
date: 2026-05-06
slug: req-auth-001-authentication
category: auth
ears_pattern: event-driven
verification_methods: [test, inspection]
compliance: [SOC2_CC6.1, SOC2_CC7.2, ISO27001_A.9.4]
satisfied_by:
  adr: [ADR-0009]
  conventions: [C-04, C-14]
implements_cross_cutting: [REQ-003, REQ-004, REQ-005, REQ-009]
type: doc
tags: [requirement, feature, auth_management]
module: auth_management
feature: authentication
---

# REQ AUTH-001 — Authentication

Status: **Proposed** (2026-05-06)

## Statement

**When** a caller submits credentials at the authentication endpoint,
the feature **shall** verify them against the configured identity store
and any enabled MFA factor; on success, mint a session bound to the
tenant, the user, and a configurable TTL, emitting a structured
`auth.user.authenticated` audit event. **If** verification fails for any
reason (unknown user, locked account, expired credential, password
mismatch, MFA failure), the feature **shall** return a single opaque
outcome that does not disclose which factor failed, increment the
rate-limiter, and emit an `auth.login.failed` row with the internal
reason recorded server-side only.

## Rationale

Authentication is the single most-targeted entry point in the platform.
Every distinguishable failure mode in the response is a signal an
attacker uses to enumerate accounts or narrow brute-force searches.
Tenants depend on bounded session TTLs to control session-hijack risk;
auditors require a complete login record for SOC 2 CC6.1 and ISO 27001
A.9.4 compliance.

## Acceptance criteria

- **AC-1** A successful credential submission returns a session whose
  `tenant_id`, `user_id`, role set, and expiry are populated and
  persisted; the platform emits the catalogued
  `auth.user.authenticated` event and the standard observability
  triple (log + metric + span) with no PII.
- **AC-2** Every failure mode returns an indistinguishable
  outcome (status, body, headers): unknown user, locked account,
  expired credential, password mismatch, and MFA-rejection are
  network-indistinguishable. The audit row records the internal
  reason; the response body never does.
- **AC-3** Repeated failures from the same source or against the same
  identity within the configured window trigger the rate-limiter,
  return the configured retry-after, and decay on success. The
  catalogued `auth.login.failed` event records the per-attempt
  reason; the rate-limit short-circuit is observable as a metric
  counter on the standard `auth.login` metric (label
  `reason=rate_limit`), not as a separate event.
- **AC-4** Logout revokes the session and any refresh token; **when
  `RotateRefreshTokens` is enabled** in the service config, refresh
  tokens are single-use — a redeemed refresh that arrives a second
  time fails closed.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `modules/platformkit-business-modules/auth_management/features/authentication/service_test.go::TestAuthenticate_Success` + `TestCompleteInteractiveAuthentication_PersistsPlatformSession` + `TestAuthenticate_MetricsRecorded` (covers session + audit + metrics). |
| AC-2 | Test | `modules/platformkit-business-modules/auth_management/features/authentication/req_auth_001_test.go::TestAuthenticate_HTTPFailureShape_IsIndistinguishable` asserts that `apierrors.AuthErrorMapper` collapses `ErrInvalidCredentials`, `ErrAccountLocked`, `ErrAccountSuspended`, and `ErrEmailNotVerified` to a uniform 401 + uniform "Invalid email or password" message. Rate-limit (429) is kept distinct as it is not account-state-revealing. |
| AC-3 | Test | `modules/platformkit-business-modules/auth_management/features/authentication/service_test.go::TestAuthenticate_RateLimited` + `TestAuthenticate_CacheBasedRateLimit`. |
| AC-4 | Test | `modules/platformkit-business-modules/auth_management/features/authentication/service_test.go::TestLogout_Success` + `TestLogout_WithRefreshToken` + `modules/platformkit-business-modules/auth_management/features/authentication/req_auth_001_test.go::TestRefresh_SingleUse_FailsOnReplay` (validates the rotation-enabled branch). |

## Implements (cross-cutting)

- REQ-003 — no account enumeration (AC-2).
- REQ-004 — every entity mutation produces an audit event (AC-1, AC-2, AC-4).
- REQ-005 — authorisation gates fail closed (AC-4 replay).
- REQ-009 — observability everywhere (AC-1).

## Satisfied by

- `modules/platformkit-business-modules/auth_management/features/authentication/feature.go` — wiring.
- `modules/platformkit-business-modules/auth_management/features/authentication/login.go`, `login_service.go`, `login_session.go`, `login_resolution.go` — credential verification, session minting.
- `modules/platformkit-business-modules/auth_management/features/authentication/login_2fa.go`, `twofactor_store.go` — MFA branch.
- `modules/platformkit-business-modules/auth_management/features/authentication/logout.go`, `refresh_token.go`, `forgot_password.go` — session lifecycle.
- `modules/platformkit-business-modules/auth_management/features/authentication/login_rate_limit.go` — bounded-retry policy.
- `modules/platformkit-business-modules/auth_management/features/authentication/handler.go`, `routes.go` — HTTP surface.
- `modules/platformkit-business-modules/auth_management/features/authentication/repository.go` — tenant-scoped session persistence.

## Related requirements

- [REQ-AUTH-002 — Registration](./REQ-AUTH-002-registration.md)
- [REQ-AUTH-003 — Two-factor authentication](./REQ-AUTH-003-twofactor.md)
- [REQ-AUTH-004 — Permissions](./REQ-AUTH-004-permissions.md)
- [REQ-AUTH-006 — Auth provider](./REQ-AUTH-006-auth-provider.md)
