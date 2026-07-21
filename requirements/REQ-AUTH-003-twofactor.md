---
id: REQ-AUTH-003
title: "Two-factor authentication binds a TOTP secret per user and enforces single-use codes"
status: Active
date: 2026-07-18
slug: req-auth-003-twofactor
category: auth
ears_pattern: state-driven
verification_methods: [test, inspection]
compliance: [SOC2_CC6.1, ISO27001_A.9.4]
satisfied_by:
  adr: [ADR-0009, ADR-0065, ADR-0070]
  conventions: [C-04, C-17, C-20, C-14]
implements_cross_cutting: [REQ-003, REQ-004, REQ-005, REQ-009]
type: doc
tags: [requirement, feature, auth_management]
module: auth_management
feature: twofactor
---

# REQ AUTH-003 — Two-factor authentication

Status: **Active** (2026-07-18)

## Statement

**While** a user has 2FA enabled, the authentication flow **shall**
require a TOTP code in addition to credentials. Enrolment **shall**
generate a per-user secret, store it encrypted at rest, and emit
one-time backup codes that are themselves single-use. Code validation
**shall** accept the current TOTP window plus the configured drift,
reject replay of an already-consumed window, and audit every
acceptance and rejection. An ordinary enrollment request **shall not**
replace or disable an active factor; replacement requires a separately
authorized recovery or current-factor flow.

## Rationale

2FA exists to stop credential-stuffing attacks that succeed on the
password factor alone. The discipline only holds if the secret is
truly secret (encrypted at rest, never logged) and if accepted codes
cannot be replayed within their drift window. Backup codes are the
fallback recovery surface and are equally sensitive.

## Acceptance criteria

- **AC-1** Enrolment generates a 160-bit secret and seals it before persistence
  in a C-17 `pkse:v1` AES-256-GCM envelope bound to the user ID. Every
  non-development environment requires an explicitly configured 32-byte active
  key and accepts at most three distinct decrypt-only previous keys for
  rotation. The response returns
  a provisioning URI plus the configured number of single-display backup codes;
  durable backup codes remain one-way hashes.
- **AC-2** Validation accepts the current TOTP window and the
  configured drift (±N steps). The accepted window is recorded
  per-user; presenting the same window again fails closed.
- **AC-3** Backup-code consumption marks the code redeemed, audits
  `auth.mfa.backup_code_consumed`, and triggers a re-enrol signal
  when the remaining count drops below the configured threshold.
- **AC-4** Validation failures contribute to the authentication
  rate-limit (REQ-AUTH-001 AC-3) and emit
  `auth.mfa.verification_failed`.
- **AC-5** Pre-envelope plaintext enrollment state is never silently accepted
  or downgraded to single-factor login. Migration 017 removes plaintext seed
  and recovery material while preserving the prior verified marker as a
  fail-closed re-enrollment lock. Malformed, tampered, wrong-user, unknown-key,
  or locked state reports an operational/re-enrollment error while MFA remains
  logically required.
- **AC-6** Enrollment rejects an already-active factor and a migration
  re-enrollment lock before generating or storing replacement credentials. It
  rechecks that state inside the durable transaction, generates the complete
  seed and recovery-code set before the first write, and commits the seed and
  recovery hashes together. A concurrent activation, entropy failure, state
  read failure, or storage failure leaves the live secret, verified marker,
  backup codes, and replay counter unchanged.
- **AC-7** When a verified interactive-provider callback transitions to local
  MFA, the continuation retains the SHA-256 digest of the original 256-bit
  browser binding, flow reference, exact tenant/provider/connection tuple,
  verified platform identity reference, and only the bounded non-secret facts
  needed to render and complete local MFA. It compares the same browser binding
  in constant time, revalidates that exact authority, and consumes the
  continuation once before session issuance. A missing, mismatched, expired,
  replayed, or unavailable continuation creates no membership or session and
  never re-enters the provider. No upstream provider credential or arbitrary
  provider metadata is retained in the challenge state.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | Enrollment tests plus `pk-modules/auth_management/features/authentication/totp_secret_protector_test.go::TestTOTPSecretProtectorRoundTripUsesRandomVersionedAEADEnvelope`, `TestTOTPSecretProtectorBindsEnvelopeToUserAndRejectsTampering`, `TestProvideTOTPSecretProtectionRequiresDedicatedProductionKey`, `TestProvideTOTPSecretProtectionEnvironmentOverrideCannotEnableDevelopmentFallback`, `TestTOTPSecretKeyringDecryptsPreviousKey`, and `TestMFASetupClassifiesSecretAndBackupCodesAsNonProjectable`. |
| AC-2 | Test | Acceptance + drift: `pk-modules/auth_management/features/twofactor/service_test.go::TestService_Verify_ValidCode` + `TestService_Verify_InvalidCode` + `TestService_Verify_TimeSkewTolerance`. Atomic replay rejection: `pk-modules/auth_management/features/twofactor/req_auth_003_test.go::TestTOTP_RejectsReplay_WithinDriftWindow`, `TestTOTP_ConcurrentReplayHasExactlyOneWinner`, and `TestTOTP_EnableFailureRollsBackCounterAdvancement`. Production-store evidence: `pk-modules/auth_management/features/authentication/twofactor_store_replay_test.go::TestPersistentSecretStoreProductionWiringRejectsImmediateTOTPReplay` + `TestPersistentSecretStoreAdvanceAcceptedCounterCASAllowsOneWinner`. `AtomicReplayGuardSecretStore::AdvanceAcceptedCounter` replaces the race-prone split read/write protocol; the production `persistentSecretStore` advances migration-016's durable counter through the entity-version CAS, and `Service::Verify` commits that advancement together with `SetEnabled` in the store transaction. `NewProduction` rejects stores missing either capability, while the lightweight `New` constructor is reserved for deliberately lean in-memory integrations. |
| AC-3 | Test | `pk-modules/auth_management/features/twofactor/service_test.go::TestService_Recover_ConsumesBackupCode`, `pk-modules/auth_management/features/twofactor/req_auth_003_test.go::TestBackupCode_EmitsAuditEvent`, and `pk-modules/auth_management/features/twofactor/durable_security_events_test.go::TestBackupCodeConsumptionSignalsReenrollmentBelowThreshold` verify atomic consumption, remaining-count threshold, audit, and declared event publication. |
| AC-4 | Inspection | The twofactor `Service` does not own the rate-limit primitive — rate-limit integration happens at the parent authentication feature. Reviewers verify in `pk-modules/auth_management/features/authentication/login_2fa.go` that a failed TOTP path increments the login rate-limit counter used by REQ-AUTH-001 AC-3. |
| AC-5 | Test | `pk-modules/auth_management/features/authentication/totp_secret_protector_test.go::TestPersistentSecretStoreMigrationLockDoesNotDowngradeMFA`, `TestPersistentSecretStoreUnreadableEnvelopeDoesNotReportMFADisabled`, `TestPersistentSecretStorePersistsOnlyEnvelopeAndFailsClosedOnPlaintext`, and `pk-modules/auth_management/features/twofactor/totp_secret_migration_test.go::TestTOTPSecretEnvelopeMigrationIntegrity`. |
| AC-6 | Test | `pk-modules/auth_management/features/twofactor/service_test.go::TestService_Enroll_RefusesToReplaceActiveFactorWithoutMutation`, `TestService_Enroll_GenerationAndStateReadFailuresDoNotMutateFactor`, `pk-modules/auth_management/features/twofactor/req_auth_003_test.go::TestTOTP_EnrollmentStorageFailureRollsBackCompleteFactorState`, and `pk-modules/auth_management/features/authentication/twofactor_store_replay_test.go::TestPersistentSecretStoreRefusesActiveSecretReplacementWithoutMutation`. |
| AC-7 | Test | `pk-modules/auth_management/features/authentication/interactive_mfa_test.go::TestCompleteInteractiveAuthenticationRequiresLocalMFABeforeExistingOrGuestSession`, `TestCompleteInteractiveAuthenticationInvalidReplayAndRateLimitLeaveChallengeSafe`, `TestCompleteInteractiveAuthenticationChallengeStoreDeleteFailureHasNoAuthWrites`, `TestCompleteInteractiveAuthenticationRejectsExpiredStoredProviderSession`, and `interactive_flow_browser_security_test.go::TestInteractiveMFAChallengeCannotBeContinuedInAnotherBrowser`; inspection verifies digest-only browser continuity and exclusion of upstream credentials. |

## Implements (cross-cutting)

- REQ-003 — no account enumeration (failure shapes uniform).
- REQ-004 — audit per mutation (AC-1, AC-3, AC-4).
- REQ-005 — fail closed on replay (AC-2).
- REQ-009 — observability.

## Satisfied by

- [ADR 0070 — Interactive browser authentication uses durable one-time bound proofs](../adr/0070-interactive-browser-authentication-uses-durable-one-time-bound-proofs.md)
- [Convention C-20 — Interactive browser authentication uses one-time bound proofs](../conventions.md#c-20-interactive-browser-authentication-uses-one-time-bound-proofs)
- `pk-modules/auth_management/features/twofactor/feature.go`
- `pk-modules/auth_management/features/twofactor/service.go`,
  `service_test.go`
- `pk-modules/auth_management/features/twofactor/handler.go`
- `pk-modules/auth_management/features/authentication/totp_secret_protector.go`
- `pk-modules/auth_management/features/authentication/twofactor_store.go`
- `pk-modules/auth_management/migrations/016_add_atomic_totp_replay_counter.up.sql`
- `pk-modules/auth_management/migrations/017_protect_totp_secrets_at_rest.up.sql`

## Deployment and key rotation

- Before migration 017 runs outside development, configure
  `modules.auth_management.config.totp_secret_encryption_key` as standard
  base64 encoding of exactly 32 random bytes (`openssl rand -base64 32`).
- During rotation, place at most three old keys in
  `totp_secret_encryption_previous_keys`, deploy the new active writer, allow
  authenticated reads to rewrap rows, prove no old-key envelopes remain, then
  remove the old key.
- Accounts that previously had active plaintext MFA become fail-closed
  re-enrollment locks. They require an approved administrative/account-recovery
  path; ordinary sign-in cannot silently bypass the missing factor.
- Migration 017 is intentionally security-irreversible. Recovery rolls the
  application and keyring forward instead of restoring plaintext writers.

## Related requirements

- [REQ-AUTH-001 — Authentication](./REQ-AUTH-001-authentication.md) — consumes this feature for the MFA branch.
