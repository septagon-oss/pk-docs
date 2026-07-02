---
id: REQ-AUTH-031
title: "TOTP verification accepts the current window, the configured drift, and refuses replays when the store opts in"
status: Proposed
date: 2026-05-08
slug: req-auth-031-totp-verification
category: auth
ears_pattern: ubiquitous
priority: must
risk: critical
verification_methods: [test, inspection]
compliance:
  - SOC2_CC6.1
  - ISO27001_A.9.4.2
  - NIST_IA-2
  - RFC_6238   # TOTP: Time-Based One-Time Password Algorithm
satisfied_by:
  adr: [ADR-0009]
  conventions: [C-04, C-14]
implements_cross_cutting: [REQ-001, REQ-005]
refines: REQ-AUTH-003
depends_on: [REQ-AUTH-030]
type: doc
tags: [requirement, capability, auth_management, twofactor, totp, replay]
module: auth_management
feature: twofactor
capability: verify_totp
capability_kind: failure_mode
stakeholders:
  - end-user (every MFA challenge)
  - operator (replay-rejection signal for incident response)
  - compliance auditor (NIST IA-2 evidence)
---

# REQ AUTH-031 — TOTP verification with replay protection

Status: **Proposed** (2026-05-08)

## Statement

`Service::Verify(userID, code)` **shall** retrieve the user's
TOTP secret, refuse the call if no secret is enrolled, compute
the expected TOTP value across the configured drift window
(`±Skew` periods around the current `unix/period` counter),
and accept the submitted code if it matches any window in
that band. **When** the wired `SecretStore` satisfies the
optional `ReplayGuardedSecretStore` interface, the service
**shall** also refuse any code whose matched counter is at or
below the user's last-accepted counter — closing the replay
window inside the drift band. **On** acceptance, the service
**shall** flip the user's MFA-enabled flag to `true` if not
already set, persisting the activation transition.

## Rationale

TOTP is the platform's possession-factor primitive. Its
correctness rests on three properties documented in RFC 6238:

1. **Time-window comparison.** The server and the user's
   device must agree on which 30-second window the code
   represents; a small drift band (`Skew=1` is the default)
   accommodates clock skew up to ±30 seconds.
2. **Constant-time match.** The platform iterates through
   the band and matches via string equality on
   pre-formatted decimal codes — the comparison is
   short-circuit-free over the band.
3. **Replay protection.** RFC 6238 §5.2 explicitly mandates
   that an accepted code must not be re-accepted; the
   `ReplayGuardedSecretStore` interface is how the platform
   honours that mandate without forcing every implementation
   to wire counter-tracking. Stores that opt in get full
   replay protection; stores that do not opt in keep permissive
   replay semantics with no compile-break.

The activation side-effect (flipping `enabled=true` on first
successful verification) is what completes the two-step
enrolment from REQ-AUTH-030: the secret exists from enrolment;
the user proves possession by verifying once; the flag flips
on that first successful verification.

## Acceptance criteria

- **AC-1 — Current window acceptance.** A code matching the
  current TOTP counter is accepted.
- **AC-2 — Drift acceptance.** Codes matching `current ± k`
  for `k ∈ [1, Skew]` are accepted (default `Skew=1`,
  i.e. ±30s).
- **AC-3 — Replay rejection (guarded store).** When the
  store satisfies `ReplayGuardedSecretStore`, a code whose
  matched counter is at or below the stored
  last-accepted-counter for the user is rejected even if
  the math succeeds.
- **AC-4 — Replay tolerance (unguarded store).** Stores that
  do not satisfy the optional interface continue to accept
  codes within the drift band on replay (the documented
  permissive behaviour); operators must wire a guarded store
  to close the gap.
- **AC-5 — No-secret refusal.** A `Verify` call against a
  user with no persisted secret returns the typed
  `"2FA not enrolled for user"` error.
- **AC-6 — Activation on first success.** The first
  successful verification flips the user's MFA-enabled
  flag to `true`; the corresponding `auth.mfa.enabled`
  event is published when the wired audit sink is
  configured.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `modules/platformkit-business-modules/auth_management/features/twofactor/service_test.go::TestService_Verify_ValidCode`. |
| AC-2 | Test | `modules/platformkit-business-modules/auth_management/features/twofactor/service_test.go::TestService_Verify_TimeSkewTolerance`. |
| AC-3 | Test | `modules/platformkit-business-modules/auth_management/features/twofactor/req_auth_003_test.go::TestTOTP_RejectsReplay_WithinDriftWindow` exercises a `replayGuardedStore`. |
| AC-4 | Inspection | `service.go::Verify` — the type-assert-and-fallthrough path when the store does not satisfy `ReplayGuardedSecretStore`. |
| AC-5 | Test | `modules/platformkit-business-modules/auth_management/features/twofactor/service_test.go::TestService_Verify_NotEnrolled`. |
| AC-6 | Inspection | `service.go::Verify` — the `SetEnabled(ctx, userID, true)` write at line 173. |

## Edge cases & unhappy paths

- **Counter wrap.** TOTP counters are int64; wrap at the
  Unix-epoch ceiling is a non-event for any realistic
  deployment.
- **Time travel during MFA.** A server whose clock is set
  significantly in the past would accept old codes; the
  platform relies on the deployment's NTP discipline to
  prevent this.
- **Authenticator app drift.** Some apps run their own
  clock and may drift; the configured `Skew` accommodates
  small drifts but a user with a substantially-skewed
  device must reset the device's time.
- **Concurrent verification race.** Two Verify calls with
  the same matched counter race on the
  `RecordAcceptedCounter` write; whichever lands second
  sees its own write as the new floor and the third
  call (if any) is rejected.

## Risk

- **Likelihood:** Critical — every MFA challenge depends
  on this primitive.
- **Impact:** Critical — a defective verifier is an MFA
  bypass.
- **Mitigations:** Replay-protected store (AC-3),
  no-enrolment refusal (AC-5), audit-on-activation (AC-6).

## Implements (cross-cutting)

- **REQ-001 — Multi-tenant isolation.** Verification keyed
  per user-id; tenant scope inherited from the user record.
- **REQ-005 — Fail-closed.** AC-3 + AC-5 default-deny
  on missing or replayed input.

## Compliance mapping

| Control | Coverage |
|---|---|
| SOC2 CC6.1 | AC-1..AC-3 + AC-5 — strong second-factor with replay protection. |
| ISO27001 A.9.4.2 | AC-3 — secure log-on with replay-resistant tokens. |
| NIST IA-2 | AC-1..AC-3 — possession-factor authenticator with replay protection. |
| RFC 6238 | AC-1 + AC-2 (window + skew) + AC-3 (mandated replay rejection). |

## Satisfied by

- `modules/platformkit-business-modules/auth_management/features/twofactor/service.go::Verify` —
  the orchestration.
- `modules/platformkit-business-modules/auth_management/features/twofactor/service.go::validateCodeCounter` —
  the matched-counter helper.
- `modules/platformkit-business-modules/auth_management/features/twofactor/service.go::ReplayGuardedSecretStore` —
  the optional replay-protection interface.

## Related requirements

- [REQ-AUTH-003 — Two-factor umbrella](./REQ-AUTH-003-twofactor.md)
- [REQ-AUTH-013 — MFA challenge in login](./REQ-AUTH-013-mfa-challenge.md) — the consumer that drives the verification.
- [REQ-AUTH-030 — TOTP enrolment](./REQ-AUTH-030-totp-enrollment.md) — the producer that mints the secret.
- [REQ-AUTH-032 — Backup-code recovery](./REQ-AUTH-032-backup-code-recovery.md) — the alternative second-factor path.
