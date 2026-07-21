---
id: REQ-AUTH-014
title: "Login rate-limit bounds password-attempt volume per source identity"
status: Proposed
date: 2026-05-08
slug: req-auth-014-login-rate-limit
category: auth
ears_pattern: state-driven
priority: must
risk: high
verification_methods: [test]
compliance:
  - SOC2_CC6.1
  - SOC2_CC7.2     # Detection of anomalies
  - ISO27001_A.9.4.2
  - NIST_AC-7      # Unsuccessful logon attempts
  - OWASP_ASVS_2.2.1   # Rate-limit and anti-automation
satisfied_by:
  adr: [ADR-0009]
  conventions: [C-04, C-14]
implements_cross_cutting: [REQ-005, REQ-009]
refines: REQ-AUTH-001
depends_on: [REQ-AUTH-010]
type: doc
tags: [requirement, capability, auth_management, authentication, rate_limit]
module: auth_management
feature: authentication
capability: login_rate_limit
capability_kind: failure_mode
stakeholders:
  - end-user (legitimate retry budget)
  - operator (incident response — credential-stuffing detection)
  - tenant administrator (account-lockout policy)
---

# REQ AUTH-014 — Login rate limit

Status: **Proposed** (2026-05-08)

## Statement

**While** repeated failed login attempts accumulate against a
given identity (`email`) or source (`source IP`) within the
configured window, the `Authenticate` flow **shall** refuse
further attempts beyond the configured threshold and respond
with a typed rate-limit error. The counter **shall** decay on
successful authentication so a legitimate user is not stranded
after a few mistyped passwords. The rate-limit gate **shall**
short-circuit the verification step entirely so an over-limit
caller cannot probe credentials.

## Rationale

Without a bounded retry budget, the password layer is
arbitrarily abusable: an attacker with a username list and
infinite attempts will eventually find a weak password. The
classic OWASP guidance (ASVS 2.2.1) requires both **per-account**
and **per-source** limits — per-account stops a slow
single-account brute force, per-source stops a fast
many-account distributed attack from one host.

The "decay on success" rule is what keeps the limit from
becoming a denial-of-service vector against legitimate users:
a person who mistypes their password three times and then
succeeds should not have their next four attempts pre-blocked.

The "short-circuit before verification" ordering matters
because the verification step is itself a side-channel — the
hash compare consumes measurable CPU. A well-behaved
rate-limited response must be observably indistinguishable
from a verification path that did execute.

## Acceptance criteria

- **AC-1 — Per-identity limit.** After
  `Config.MaxLoginAttempts` failures against the same
  `email` within the configured window, the next attempt
  returns the typed rate-limit error without invoking the
  verification step.
- **AC-2 — Counter decay on success.** A successful login
  resets the per-identity counter so the user starts fresh on
  the next session.
- **AC-3 — Cache-backed counter.** The rate-limit counter
  lives in the shared cache (`rate_limit:login:<key>`) so
  every replica observes the same budget. A process-local
  counter would be bypassable by round-robining across
  replicas — this is the documented reason `Service.WithCache`
  exists.
- **AC-4 — Cache-outage fallback.** If the cache is
  unreachable, the gate falls back to a process-local counter
  with a Warn log; reviewers verify the fallback is safe
  (per-replica rather than no rate-limit at all).
- **AC-5 — Observability.** The metric
  `auth.login.rate_limited` increments on each rejected
  attempt with a reason label; logs include the email domain
  (never the full email — REQ-009) and the source IP for
  operator triage.
- **AC-6 — Same response shape.** The rate-limit response is
  HTTP 429 with the configured retry-after header
  (REQ-AUTH-001 AC-2 keeps 429 distinct from the 401 collapse
  because rate-limit is not account-state-revealing).

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `pk-modules/auth_management/features/authentication/service_test.go::TestAuthenticate_RateLimited`. |
| AC-2 | Test | `pk-modules/auth_management/features/authentication/service_test.go::TestAuthenticate_CacheBasedRateLimit` covers the cache-backed counter; the success-resets-counter behaviour is part of the same harness's flow. |
| AC-3 | Test | `pk-modules/auth_management/features/authentication/service_test.go::TestAuthenticate_CacheBasedRateLimit` — cache-backed coverage. |
| AC-4 | Inspection | `login_rate_limit.go` falls back to a process-local map when `Service.cache` is nil; reviewers verify the fallback path logs the warning. |
| AC-5 | Inspection | `pk-modules/auth_management/features/authentication/service_test.go::TestAuthenticate_MetricsRecorded` covers the metric emission discipline; the rate-limited path uses the same pattern. |
| AC-6 | Inspection | The HTTP handler mapper at `pk-core/api/errors/mapper.go` keeps 429 distinct (`MapDomainWithMessage(ErrRateLimitExceeded, TooManyRequests, ...)`). |

## Edge cases & unhappy paths

- **Email canonicalisation.** Two attempts against
  `user@example.com` and `User@Example.com` count toward the
  same bucket; the cache key is built from the lowercased
  email.
- **Distributed attack.** Per-identity limits alone do not
  stop an attacker who tries one password against a million
  accounts. The per-source-IP limit (configured separately)
  is the corresponding defence; this REQ's per-identity rule
  is the inner ring.
- **Rotating IPs (proxied attack).** An attacker with a
  proxy pool defeats the per-IP limit. The platform's
  upstream gateway (CDN / WAF) is the documented backstop;
  the in-process rate-limit is the second ring.
- **Rate-limit budget shared across an SSO + password
  flow.** When a tenant has both flows enabled, the budget
  is per-identity regardless of which path the attacker
  attempts; the cache key does not include the auth method.

## Risk

- **Likelihood:** High — the platform sees credential-stuffing
  attempts as a continuous baseline.
- **Impact:** High — without this gate, password-only accounts
  are guessable in proportion to the attacker's budget.
- **Mitigations:** Per-identity (this REQ) + per-source-IP
  (configured separately) + REQ-AUTH-013 (MFA) + REQ-AUTH-002
  AC-3 (password policy).

## Implements (cross-cutting)

- **REQ-005 — Fail-closed.** AC-1 + AC-6 default-deny on
  budget exceeded.
- **REQ-009 — Observability.** AC-5 — the SRE signal that
  drives credential-stuffing alerts.

## Compliance mapping

| Control | Coverage |
|---|---|
| SOC2 CC6.1 | AC-1 — bounded authentication attempts. |
| SOC2 CC7.2 | AC-5 — anomaly-detection signal. |
| ISO27001 A.9.4.2 | AC-1 + AC-2 — bounded retries with legitimate-user-friendly decay. |
| NIST AC-7 | AC-1 — explicit unsuccessful-logon-attempt counter. |
| OWASP ASVS 2.2.1 | AC-1 + AC-3 — anti-automation rate-limit at the auth layer. |

## Satisfied by

- `pk-modules/auth_management/features/authentication/login_rate_limit.go` —
  the cache-backed counter + bucket key derivation.
- `pk-modules/auth_management/features/authentication/login.go` — the
  verification short-circuit ordering.
- `infrastructure/cache/` — the shared cache the counter sits
  on top of.

## Related requirements

- [REQ-AUTH-001 — Authentication umbrella](./REQ-AUTH-001-authentication.md)
- [REQ-AUTH-010 — Password login](./REQ-AUTH-010-login-credentials.md) — the path this rate-limit guards.
- [REQ-AUTH-013 — MFA challenge](./REQ-AUTH-013-mfa-challenge.md) — the second-factor gate that makes a successful guess less catastrophic.
- [REQ-009 — Observability](./REQ-009-observability-everywhere.md) — the broader telemetry discipline AC-5 instruments.
