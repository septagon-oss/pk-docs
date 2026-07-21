---
id: REQ-AUTH-032
title: "Backup-code recovery consumes a one-time recovery code, audits the consumption, and re-enables MFA"
status: Proposed
date: 2026-05-08
slug: req-auth-032-backup-code-recovery
category: auth
ears_pattern: event-driven
priority: must
risk: high
verification_methods: [test, inspection]
compliance:
  - SOC2_CC6.1
  - ISO27001_A.9.4.3
  - NIST_IA-12   # Identity proofing recovery
satisfied_by:
  adr: [ADR-0009]
  conventions: [C-04, C-14]
implements_cross_cutting: [REQ-001, REQ-004]
refines: REQ-AUTH-003
depends_on: [REQ-AUTH-030]
type: doc
tags: [requirement, capability, auth_management, twofactor, backup-code, recovery]
module: auth_management
feature: twofactor
capability: backup_code_recovery
capability_kind: state_machine
stakeholders:
  - end-user (locked-out account holder with backup codes)
  - operator (audit signal for backup-code use)
  - compliance auditor (recovery procedure evidence)
---

# REQ AUTH-032 — Backup-code recovery

Status: **Proposed** (2026-05-08)

## Statement

`Service::Recover(userID, recoveryCode)` **shall** consume
the supplied backup code via `SecretStore.ConsumeBackupCode`
(which atomically removes the code from the user's
remaining-codes set on success), refuse the call if the code
does not match a remaining code, mark the user's MFA-enabled
flag `true` if not already set, and emit the catalogued
`auth.twofactor.backup_consumed` audit event when the wired
`AuditSink` is configured.

## Rationale

Backup codes are the documented escape hatch when the
authenticator device is lost. They have to be:

1. **One-time-use.** A code is consumed by the act of
   redeeming it; without that, a leaked code becomes a
   long-running credential.
2. **Audited.** Consumption signals "user lost their
   primary factor and is recovering" — operators want to
   see that as a security-relevant event so they can
   correlate with other anomaly signals.
3. **Activation-bonding.** A successful recovery flips the
   MFA-enabled flag if it was off (e.g. the user disabled
   MFA via the UI, then re-enabled via recovery); the
   recovery path is meant to result in an MFA-enabled
   account state, not a temporary bypass.

The audit emission is gated on a wired `AuditSink` (see
REQ-AUTH-003 AC-3) so existing wirings continue to compile;
deployments that need the audit signal explicitly wire the
sink at FX assembly time.

## Acceptance criteria

- **AC-1 — Successful recovery.** A backup code matching
  one of the user's stored codes is consumed (the code is
  removed from the stored set), the MFA-enabled flag is
  set to `true`, and the function returns `(true, nil)`.
- **AC-2 — Single-use semantic.** A second redemption of
  the same code returns `(false, nil)` because the code has
  been removed from the stored set.
- **AC-3 — Wrong-code rejection.** A code not matching any
  remaining backup code returns `(false, nil)` without
  modifying the stored set or the MFA-enabled flag.
- **AC-4 — Audit emission.** When the service is wired
  with `WithAuditSink`, every successful redemption emits
  the `auth.twofactor.backup_consumed` audit event with
  the user id.
- **AC-5 — No-sink fall-through.** When no `AuditSink` is
  wired, the recovery path completes without an error and
  without an audit event; the platform's existing
  deployments continue to function.
- **AC-6 — Activation bonding.** A user whose MFA was
  disabled before recovery has it re-enabled by the
  successful redemption.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `pk-modules/auth_management/features/twofactor/service_test.go::TestService_Recover_ConsumesBackupCode`. |
| AC-2 | Inspection | The mock store's `ConsumeBackupCode` removes the code from the slice on the first call; the second call returns `false` from the slice search. |
| AC-3 | Inspection | `service.go::Recover` returns `(false, nil)` when `ConsumeBackupCode` reports `ok=false`. |
| AC-4 | Test | `pk-modules/auth_management/features/twofactor/req_auth_003_test.go::TestBackupCode_EmitsAuditEvent`. |
| AC-5 | Inspection | `service.go::emitAudit` returns immediately when `s.audit` is nil. |
| AC-6 | Inspection | `service.go::Recover` calls `SetEnabled(ctx, userID, true)` after a successful consume. |

## Edge cases & unhappy paths

- **Backup-code exhaustion.** A user who has redeemed
  every backup code and lost their device cannot recover
  through this path. The platform's documented next step is
  operator-mediated reset (out of band).
- **Concurrent-redemption race.** Two Recover calls with
  the same backup code race on the consume; the store
  primitive's atomic remove ensures only one wins.
- **Disabled-MFA path.** A user who has explicitly disabled
  MFA still has their backup codes; redeeming one re-enables
  MFA. This may surprise users; documentation calls it out.
- **Audit-sink panic.** A panicking sink propagates to the
  caller (the platform does not wrap sinks in a recover
  block); reviewers verify the deployed sink is
  panic-resilient.

## Risk

- **Likelihood:** Low (per-user) but Medium platform-wide —
  a steady stream of recoveries reflects ongoing device
  loss.
- **Impact:** Critical — a defective recovery either locks
  out legitimate users or authorises attackers with
  intercepted backup codes.
- **Mitigations:** Single-use semantic (AC-2), audit
  emission for anomaly correlation (AC-4), MFA-enabled
  bonding (AC-6).

## Implements (cross-cutting)

- **REQ-001 — Multi-tenant isolation.** Backup codes keyed
  per user-id; tenant scope inherited.
- **REQ-004 — Audit per mutation.** AC-4 — explicit
  audit event on every consumption.

## Compliance mapping

| Control | Coverage |
|---|---|
| SOC2 CC6.1 | AC-1 + AC-4 — controlled recovery procedure with audit signal. |
| ISO27001 A.9.4.3 | AC-2 — controlled secret-management for the recovery codes. |
| NIST IA-12 | AC-1..AC-6 — the "identity proofing recovery" surface. |

## Satisfied by

- `pk-modules/auth_management/features/twofactor/service.go::Recover` —
  the orchestration.
- `pk-modules/auth_management/features/twofactor/service.go::AuditSink` —
  the optional audit-emission interface.
- `pk-modules/auth_management/features/twofactor/service.go::ConsumeBackupCode`
  contract — the atomic remove primitive.

## Related requirements

- [REQ-AUTH-003 — Two-factor umbrella](./REQ-AUTH-003-twofactor.md)
- [REQ-AUTH-030 — TOTP enrolment](./REQ-AUTH-030-totp-enrollment.md) — the producer of the backup codes this capability consumes.
- [REQ-AUTH-031 — TOTP verification](./REQ-AUTH-031-totp-verification.md) — the primary second-factor path; backup codes are the alternative.
- [REQ-AUTH-013 — MFA challenge in login](./REQ-AUTH-013-mfa-challenge.md) — the consumer that drives the recovery flow.
