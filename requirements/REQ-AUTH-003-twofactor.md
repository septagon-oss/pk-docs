---
id: REQ-AUTH-003
title: "Two-factor authentication binds a TOTP secret per user and enforces single-use codes"
status: Proposed
date: 2026-05-06
slug: req-auth-003-twofactor
category: auth
ears_pattern: state-driven
verification_methods: [test, inspection]
compliance: [SOC2_CC6.1, ISO27001_A.9.4]
satisfied_by:
  adr: [ADR-0009]
  conventions: [C-04, C-14]
implements_cross_cutting: [REQ-003, REQ-004, REQ-005, REQ-009]
type: doc
tags: [requirement, feature, auth_management]
module: auth_management
feature: twofactor
---

# REQ AUTH-003 — Two-factor authentication

Status: **Proposed** (2026-05-06)

## Statement

**While** a user has 2FA enabled, the authentication flow **shall**
require a TOTP code in addition to credentials. Enrolment **shall**
generate a per-user secret, store it encrypted at rest, and emit
one-time backup codes that are themselves single-use. Code validation
**shall** accept the current TOTP window plus the configured drift,
reject replay of an already-consumed window, and audit every
acceptance and rejection.

## Rationale

2FA exists to stop credential-stuffing attacks that succeed on the
password factor alone. The discipline only holds if the secret is
truly secret (encrypted at rest, never logged) and if accepted codes
cannot be replayed within their drift window. Backup codes are the
fallback recovery surface and are equally sensitive.

## Acceptance criteria

- **AC-1** Enrolment generates a 160-bit secret, persists it encrypted
  with the platform's key-management primitive, and returns a
  provisioning URI plus the configured number of backup codes
  (single-display, one-time-readable).
- **AC-2** Validation accepts the current TOTP window and the
  configured drift (±N steps). The accepted window is recorded
  per-user; presenting the same window again fails closed.
- **AC-3** Backup-code consumption marks the code redeemed, audits
  `auth.twofactor.backup_consumed`, and triggers a re-enrol prompt
  when the remaining count drops below the configured threshold.
- **AC-4** Validation failures contribute to the authentication
  rate-limit (REQ-AUTH-001 AC-3) and emit
  `auth.twofactor.failed`.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `pk-modules/auth_management/features/twofactor/service_test.go::TestService_Enroll_GeneratesSecret` + `TestService_Enroll_ReturnsBackupCodes` + `TestService_Enroll_ReturnsOTPURL`. Encryption-at-rest of the secret is an inspection claim — the unit-test store keeps secrets in memory; production storage relies on the chosen `SecretStore` impl persisting via the platform's encrypted-at-rest column type. |
| AC-2 | Test | Acceptance + drift: `pk-modules/auth_management/features/twofactor/service_test.go::TestService_Verify_ValidCode` + `TestService_Verify_InvalidCode` + `TestService_Verify_TimeSkewTolerance`. Replay rejection: `req_auth_003_test.go::TestTOTP_RejectsReplay_WithinDriftWindow` exercises a `ReplayGuardedSecretStore` and confirms a code accepted at T cannot be replayed at T + ε. The optional `ReplayGuardedSecretStore` interface in `service.go` lets the wired SecretStore opt into per-user counter tracking; when present, `Service::Verify` refuses any TOTP whose counter is `<=` the stored last-accepted value. Stores that do not implement the interface fall back to the legacy behaviour with no error so existing wirings continue to compile. |
| AC-3 | Test | Consumption: `pk-modules/auth_management/features/twofactor/service_test.go::TestService_Recover_ConsumesBackupCode`. Audit emission: `req_auth_003_test.go::TestBackupCode_EmitsAuditEvent` exercises the optional `AuditSink` callback wired via `Service::WithAuditSink`; on backup-code consumption the service emits the typed `auth.twofactor.backup_consumed` event with the user id. Sinks that are not wired fall through to no-op auditing without breaking existing wirings. |
| AC-4 | Inspection | The twofactor `Service` does not own the rate-limit primitive — rate-limit integration happens at the parent authentication feature. Reviewers verify in `authentication/login_2fa.go` that a failed TOTP path increments the login rate-limit counter used by REQ-AUTH-001 AC-3. |

## Implements (cross-cutting)

- REQ-003 — no account enumeration (failure shapes uniform).
- REQ-004 — audit per mutation (AC-1, AC-3, AC-4).
- REQ-005 — fail closed on replay (AC-2).
- REQ-009 — observability.

## Satisfied by

- `pk-modules/auth_management/features/twofactor/feature.go`
- `pk-modules/auth_management/features/twofactor/service.go`,
  `service_test.go`
- `pk-modules/auth_management/features/twofactor/handler.go`, `routes.go`,
  `permissions.go`

## Related requirements

- [REQ-AUTH-001 — Authentication](./REQ-AUTH-001-authentication.md) — consumes this feature for the MFA branch.
