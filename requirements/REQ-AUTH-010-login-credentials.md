---
id: REQ-AUTH-010
title: "Password login authenticates a (tenant, email, password) tuple and mints a bounded session"
status: Proposed
date: 2026-05-08
slug: req-auth-010-login-credentials
category: auth
ears_pattern: event-driven
priority: must
risk: high
verification_methods: [test, analysis, inspection]
compliance:
  - SOC2_CC6.1   # Logical and physical access controls
  - SOC2_CC6.7   # Restricting access to information assets
  - ISO27001_A.9.4   # System and application access control
  - ISO27001_A.9.4.2 # Secure log-on procedures
  - NIST_AC-7    # Unsuccessful logon attempts
satisfied_by:
  adr: [ADR-0009]
  conventions: [C-04, C-14]
implements_cross_cutting: [REQ-001, REQ-003, REQ-004, REQ-005, REQ-009]
refines: REQ-AUTH-001
depends_on: [REQ-USER-001, REQ-AUTH-006]
type: doc
tags: [requirement, capability, auth_management, authentication, login, credentials]
module: auth_management
feature: authentication
capability: login_credentials
capability_kind: failure_mode
stakeholders:
  - end-user (account holder)
  - operator (incident responder)
  - tenant administrator (audit consumer)
  - compliance auditor (SOC2 / ISO27001)
---

# REQ AUTH-010 — Password login

Status: **Proposed** (2026-05-08)

## Statement

**When** an end user submits an `(email, password)` tuple at the
authentication endpoint, the system **shall**:

1. Resolve a tenant context for the request — either the tenant
   bound to the host or a tenant the user is an active member of;
2. Verify the credentials against the configured
   `AuthProvider` using the platform's password-hash primitive
   (Argon2id via `passhash`);
3. Look up the user via the `UserBoundaryService` and refuse the
   login if the account is `inactive`, `suspended`, or
   `pending_verification`;
4. On success, persist a session row bound to the resolved tenant
   and the user's role set, mint an access token + (optional)
   refresh token, set the session cookie, and emit the catalogued
   `auth.user.authenticated` event;
5. On any failure (unknown user, password mismatch, locked /
   suspended / unverified account, MFA required, rate-limit
   exceeded), surface a typed error that the HTTP layer maps to a
   single opaque outcome per REQ-003.

## Rationale

Password login is the most-targeted entry point on the platform.
Every byte of state-revealing information in the failure response
is a probe an attacker can use; every unbounded retry budget is a
brute-force runway. The discipline this REQ encodes is the
intersection of three concerns:

1. **Compliance.** SOC2 CC6.1 and ISO27001 A.9.4.2 require both a
   "secure log-on procedure" and an audit record of every
   authentication attempt — successful or not. The
   `auth.user.authenticated` and `auth.login.failed` events are
   the audit trail those controls rest on.
2. **Threat model.** The two attacker capabilities we deny:
   account enumeration via response shape (REQ-003) and
   credential stuffing via unbounded retries (REQ-AUTH-014). The
   typed-error shape and the rate-limiter close those.
3. **Operational hygiene.** Operators need login outcomes
   (success, failure, reason) in metrics and traces to spot
   incidents (e.g. a sudden spike in `auth.login.failed{reason=locked}`
   is a credential-stuffing signal). The observability triple
   (log, metric, span) is non-negotiable per REQ-009.

The MFA branch is intentionally pushed into a separate capability
(REQ-AUTH-013) so this REQ describes the credential-only path that
applies before MFA challenge is evaluated.

## Acceptance criteria

- **AC-1 — Happy path.** A correct `(email, password)` against an
  active user returns an `AuthenticationResult` populated with
  the user identifier, tenant id, role set, access token, and
  expiry; the session row exists in the session repository; and
  the `auth.user.authenticated` event has been published with the
  same tenant + user.
- **AC-2 — Account-status gates.** A submission whose target user
  exists but is in `inactive`, `suspended`, or
  `pending_verification` state is refused with a typed
  account-status error. The internal reason is recorded in the
  audit row; the HTTP response (REQ-AUTH-001 AC-2) collapses all
  account-status failures to a uniform 401.
- **AC-3 — Credential mismatch.** A submission with a wrong
  password against an existing user, or with an email that does
  not exist, returns the same typed `ErrInvalidCredentials`. The
  observable timing across the two cases differs by no more than
  the noise floor of the password-hash primitive (constant-time
  comparison + always-hash discipline).
- **AC-4 — Tenant resolution.** A login that resolves to a tenant
  the user is not a member of is refused with a typed
  tenant-membership error and never mints a session.
- **AC-5 — Observability.** Every login outcome — success or
  failure — emits a structured log line, a metric counter
  (`auth.login.{success,failed}` with a `reason` label), and a
  trace span. PII (raw password, full email) is never present in
  these signals; only the email domain is captured for incident
  triage.
- **AC-6 — Rate-limit short-circuit.** When the rate-limiter is
  configured and the (source-IP, identity) bucket is exceeded,
  the verification step is skipped entirely; the response is the
  rate-limit shape (REQ-AUTH-014).

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `pk-modules/auth_management/features/authentication/service_test.go::TestAuthenticate_Success` and `TestCompleteInteractiveAuthentication_PersistsPlatformSession`. |
| AC-2 | Test | `pk-modules/auth_management/features/authentication/service_test.go::TestAuthenticate_AccountStatuses` (table-driven across `Inactive`, `Suspended`, `Pending`). |
| AC-3 | Test | `pk-modules/auth_management/features/authentication/service_test.go::TestAuthenticate_InvalidEmail` + `TestAuthenticate_InvalidPassword`. Constant-time discipline is satisfied by `passhash.HashPassword`/`ComparePassword` (bcrypt, intrinsically constant-time on equal-length inputs); reviewers verify the always-hash branch in `login.go`. |
| AC-4 | Test | `pk-modules/auth_management/features/authentication/service_test.go::TestAuthenticate_UsesDurableTenantAuthorityAfterCrossTenantCredentialLookup` and `TestAuthenticate_TwoFactorChallengeRestoresTenantWithoutHostScopedContext`. |
| AC-5 | Test | `pk-modules/auth_management/features/authentication/service_test.go::TestAuthenticate_MetricsRecorded`. PII discipline is enforced by the `observability/logger/redactor` contract (REQ-009). |
| AC-6 | Test | `pk-modules/auth_management/features/authentication/service_test.go::TestAuthenticate_RateLimited` and `TestAuthenticate_CacheBasedRateLimit`. |

## Edge cases & unhappy paths

- **Empty submission.** Missing email or password returns
  `ErrCredentialsRequired` (HTTP 400 from the handler) before any
  database lookup.
- **Cache outage.** If the rate-limiter cache is unreachable, the
  service logs at Warn and proceeds — a hard fail here would
  amplify the outage. Reviewed against REQ-005 (fail-closed) and
  decided as an explicit availability trade-off.
- **Provider partial response.** A provider that returns a
  malformed session response is treated as `ErrInvalidCredentials`
  rather than surfacing the malformation; the malformation is
  logged at Error for operator triage.
- **Tenant deactivated mid-flow.** A login submitted for an active
  user whose tenant has just been archived is refused with
  `ErrTenantAccessUnavailable`; the user record stays untouched.

## Risk

- **Likelihood:** High — login is the most-probed surface.
- **Impact:** Critical — credential compromise compounds across
  every other authentication-gated feature.
- **Mitigations:** This REQ + REQ-AUTH-014 (rate limit) +
  REQ-AUTH-013 (MFA) + REQ-AUTH-021 (forgot-password) form the
  defence-in-depth for the password path.

## Implements (cross-cutting)

- **REQ-001 — Multi-tenant isolation.** AC-4 enforces
  membership-bound session minting.
- **REQ-003 — No account enumeration.** AC-3's uniform-error
  discipline is the runtime witness; the HTTP-layer collapse is
  in REQ-AUTH-001 AC-2.
- **REQ-004 — Audit per mutation.** AC-1 + AC-5 emit the
  catalogued events on every outcome.
- **REQ-005 — Fail-closed.** AC-2 + AC-4 + AC-6 default-deny when
  a precondition is missing or a budget is exceeded.
- **REQ-009 — Observability.** AC-5 is the explicit instrument.

## Compliance mapping

| Control | Coverage |
|---|---|
| SOC2 CC6.1 (Logical/physical access) | AC-1..AC-4 — only verified members of an active tenant receive a session. |
| SOC2 CC6.7 (Restrict access to information assets) | AC-4 — sessions cannot be minted into a tenant the user does not belong to. |
| ISO27001 A.9.4.2 (Secure log-on) | AC-3 + AC-5 + AC-6 — uniform error shape, no PII in logs, rate-limit gate. |
| NIST AC-7 (Unsuccessful logon attempts) | AC-6 — bounded retry via the rate-limiter. |
| GDPR Art. 32 (Security of processing) | AC-5 (no PII in observability signals). |

## Satisfied by

- `pk-modules/auth_management/features/authentication/login.go` — orchestration.
- `pk-modules/auth_management/features/authentication/login_service.go` — credential verification + session minting.
- `pk-modules/auth_management/features/authentication/login_resolution.go` — tenant resolution.
- `pk-modules/auth_management/features/authentication/login_session.go` — token generation.
- `pk-modules/auth_management/features/authentication/login_rate_limit.go` — bounded retry.
- `pk-modules/auth_management/features/authentication/handler.go` + `routes.go` — HTTP surface.
- `pk-modules/auth_management/features/authentication/repository.go` — session persistence.

## Related requirements

- [REQ-AUTH-001 — Authentication umbrella](./REQ-AUTH-001-authentication.md) — the feature this capability refines.
- [REQ-AUTH-011 — Refresh token](./REQ-AUTH-011-refresh-token.md) — the post-login renewal path.
- [REQ-AUTH-012 — Logout](./REQ-AUTH-012-logout.md) — the session-revocation counterpart.
- [REQ-AUTH-013 — MFA challenge](./REQ-AUTH-013-mfa-challenge.md) — the second-factor branch.
- [REQ-AUTH-014 — Login rate limit](./REQ-AUTH-014-login-rate-limit.md) — the bounded-retry policy AC-6 invokes.
- [REQ-USER-001 — User](./REQ-USER-001-user.md) — the identity record this capability authenticates against.
- [REQ-AUTH-006 — Auth provider](./REQ-AUTH-006-auth-provider.md) — the interactive / SSO branch consumed alongside this one.
