---
id: REQ-AUTH-030
title: "TOTP enrollment generates a per-user secret and a one-time-display set of backup codes"
status: Proposed
date: 2026-05-08
slug: req-auth-030-totp-enrollment
category: auth
ears_pattern: event-driven
priority: must
risk: high
verification_methods: [test, inspection]
compliance:
  - SOC2_CC6.1
  - ISO27001_A.9.4.2
  - NIST_IA-2
satisfied_by:
  adr: [ADR-0009]
  conventions: [C-04, C-14]
implements_cross_cutting: [REQ-001, REQ-004]
refines: REQ-AUTH-003
type: doc
tags: [requirement, capability, auth_management, twofactor, enrollment, totp]
module: auth_management
feature: twofactor
capability: enroll
capability_kind: state_machine
stakeholders:
  - end-user (enrolling MFA)
  - tenant administrator (mandating MFA for elevated roles)
  - compliance auditor (NIST IA-2 evidence)
---

# REQ AUTH-030 — TOTP enrollment

Status: **Proposed** (2026-05-08)

## Statement

**When** a caller invokes `Service::Enroll(userID, userEmail)`,
the service **shall** generate a 160-bit random secret, persist
it via the configured `SecretStore` (without flipping the
`enabled` flag — enrolment requires user-side verification of a
freshly-generated TOTP code before activation), generate the
configured number of single-use backup codes, persist them, and
return the secret + the `otpauth://totp/...` provisioning URI +
the plaintext backup codes as a one-time response payload.

## Rationale

TOTP enrolment has three security-load-bearing properties:

1. **Secret generation is server-side.** The shared secret is
   minted by the platform and revealed to the user once via the
   provisioning URI; the user's authenticator app captures it.
   A client-side-generated secret would let a compromised
   client weaken the entropy.
2. **Enrolment is two-step.** The secret is persisted on
   enrolment, but the user's MFA flag (`enabled=true`) only
   flips after the user proves possession by submitting a
   valid TOTP code (REQ-AUTH-031). Without the two-step pattern
   a user who closed the QR-code page before scanning would
   still have MFA enabled with a secret they cannot reproduce.
3. **Backup codes are one-time-display.** They are never
   re-shown after enrolment. This is the disciplined version
   of "don't reveal the secret again"; users are responsible
   for storing the backup codes securely (password manager,
   printed copy in a safe).

## Acceptance criteria

- **AC-1 — Random-secret generation.** Each enrolment produces
  a fresh 160-bit secret distinct from any prior enrolment for
  the same user (collisions are cryptographically negligible).
- **AC-2 — Secret persisted unactivated.** After enrolment the
  secret exists in the store; the `enabled` flag is `false`
  pending verification (REQ-AUTH-031 AC-2 flips it true).
- **AC-3 — Backup-code count + format.** The response carries
  `defaultBackupCodeCount` (10) backup codes, each a base32
  string, returned exactly once.
- **AC-4 — Provisioning URI shape.** The `otpauth://totp/`
  URI carries the issuer, account email, encoded secret,
  digits, and period — the standard URI shape an
  authenticator app expects.
- **AC-5 — Encryption-at-rest.** Implementations of
  `SecretStore` persist the secret encrypted at rest; the
  in-memory test store keeps it plaintext (with the
  documented "in-memory test only" caveat). Reviewers verify
  the production store uses the platform's encrypted-column
  primitive.
- **AC-6 — Re-enrolment overwrites.** Calling `Enroll` for a
  user who already has an unactivated or activated secret
  overwrites the prior secret; the previous backup codes are
  invalidated by the same write.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `modules/platformkit-business-modules/auth_management/features/twofactor/service_test.go::TestService_Enroll_GeneratesSecret`. |
| AC-2 | Inspection | `service.go::Enroll` — the SetSecret/SetBackupCodes pair without a SetEnabled call. |
| AC-3 | Test | `modules/platformkit-business-modules/auth_management/features/twofactor/service_test.go::TestService_Enroll_ReturnsBackupCodes` (asserts the count). |
| AC-4 | Test | `modules/platformkit-business-modules/auth_management/features/twofactor/service_test.go::TestService_Enroll_ReturnsOTPURL`. |
| AC-5 | Inspection | Code review of the production `SecretStore` implementation; the in-memory test store is documented as test-only at `req_auth_003_test.go::replayGuardedStore`. |
| AC-6 | Inspection | `service.go::Enroll` overwrites unconditionally; reviewers verify the documented behaviour against the threat-model expectation. |

## Edge cases & unhappy paths

- **Concurrent re-enrolment.** Two simultaneous Enroll calls
  for the same user race; whichever wins the persisted
  secret survives; the other's secret is unreachable.
- **Backup-code generator failure.** A failure mid-enrolment
  produces a partial state — secret persisted, backup codes
  unwritten. The platform's documented recovery is
  re-enrolment by the user; reviewers verify the partial
  state is detectable.
- **Authenticator-app rejection.** Apps that don't
  understand the `otpauth://` URI (rare) require manual
  secret entry; the response carries the bare secret string
  for that fallback.

## Risk

- **Likelihood:** Medium — invoked at user-onboarding rate.
- **Impact:** High — a defective enrolment leaves the user
  with an unverified secret and no usable second factor.
- **Mitigations:** Two-step enrolment (AC-2), one-time-
  display backup codes (AC-3), encryption-at-rest discipline
  (AC-5).

## Implements (cross-cutting)

- **REQ-001 — Multi-tenant isolation.** Secrets keyed per
  user-id; the user already carries the tenant binding.
- **REQ-004 — Audit per mutation.** The
  `auth.twofactor.enrolled` event (when wired) records the
  enrolment for the audit trail.

## Compliance mapping

| Control | Coverage |
|---|---|
| SOC2 CC6.1 | AC-1 + AC-5 — strong-authentication secret lifecycle. |
| ISO27001 A.9.4.2 | AC-2 + AC-3 — proof-of-possession before MFA-enabled status. |
| NIST IA-2 | AC-1..AC-4 — possession-factor enrolment. |

## Satisfied by

- `modules/platformkit-business-modules/auth_management/features/twofactor/service.go::Enroll` —
  the orchestration.
- `modules/platformkit-business-modules/auth_management/features/twofactor/service.go::generateSecret` /
  `generateBackupCode` — the random primitives.
- `modules/platformkit-business-modules/auth_management/features/authentication/twofactor_store.go` —
  the production SecretStore implementation that persists
  with encryption-at-rest.

## Related requirements

- [REQ-AUTH-003 — Two-factor umbrella](./REQ-AUTH-003-twofactor.md)
- [REQ-AUTH-031 — TOTP verification](./REQ-AUTH-031-totp-verification.md) — the verification step that activates the secret.
- [REQ-AUTH-032 — Backup-code recovery](./REQ-AUTH-032-backup-code-recovery.md) — the consumer of the backup codes minted here.
