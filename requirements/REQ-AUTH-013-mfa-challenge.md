---
id: REQ-AUTH-013
title: "MFA challenge inserts a second-factor verification step into the login flow when 2FA is enabled"
status: Proposed
date: 2026-05-08
slug: req-auth-013-mfa-challenge
category: auth
ears_pattern: state-driven
priority: must
risk: high
verification_methods: [test, inspection]
compliance:
  - SOC2_CC6.1
  - ISO27001_A.9.4.2
  - NIST_IA-2     # Identification and Authentication (multi-factor)
satisfied_by:
  adr: [ADR-0009]
  conventions: [C-04, C-14]
implements_cross_cutting: [REQ-001, REQ-003, REQ-004, REQ-005]
refines: REQ-AUTH-001
depends_on: [REQ-AUTH-010, REQ-AUTH-031, REQ-AUTH-032]
type: doc
tags: [requirement, capability, auth_management, authentication, mfa, totp]
module: auth_management
feature: authentication
capability: mfa_challenge
capability_kind: state_machine
stakeholders:
  - end-user (account holder with MFA)
  - tenant administrator (mandated MFA for elevated roles)
  - compliance auditor (NIST IA-2 evidence)
---

# REQ AUTH-013 — MFA challenge in the login flow

Status: **Proposed** (2026-05-08)

## Statement

**While** an authenticated user has MFA enabled, the
`Authenticate` flow **shall**, after credential verification but
before session minting, require either a valid TOTP code
(REQ-AUTH-031) or a valid one-time backup code (REQ-AUTH-032).
**If** neither factor is supplied, the flow **shall** return an
`AuthenticationResult` whose `MFARequired` shape signals the
client to prompt for a code, persisting no session and minting
no token. **If** a factor is supplied and validates, the flow
**shall** restore the tenant context that was resolved before
the challenge and proceed to mint the session.

## Rationale

MFA exists to break the implicit "knowing the password equals
having the account" equation. The challenge has to interleave
into the login flow rather than running as a separate endpoint
because:

1. **Tenant context preservation.** Login resolves the tenant
   from the host or membership lookup; the MFA challenge
   happens after that resolution but before the session row is
   written. Re-resolving the tenant on the challenge response
   would force the client to round-trip extra data and risk a
   different tenant being chosen on the second pass. The
   service therefore stamps the resolved tenant into the
   challenge response and restores it on the verify branch.
2. **Failure-mode opacity.** A credential-mismatch failure must
   look identical to an MFA-failure at the HTTP layer — both
   collapse to the uniform 401 from REQ-003. Without that, an
   attacker can probe whether they have the password right by
   checking whether the response asks for an MFA code.
3. **Backup-code parity.** A user with a lost device must still
   be able to log in. Backup codes are the documented escape
   hatch (REQ-AUTH-032); they consume on use and audit on
   consumption.

## Acceptance criteria

- **AC-1 — MFA gate triggers post-credential.** A successful
  credential verification against a user with MFA enabled
  returns an `AuthenticationResult{MFARequired: true}` and
  does **not** persist a session row.
- **AC-2 — TOTP success path.** A subsequent
  `Authenticate` call with the same credentials and a valid
  TOTP code restores the prior tenant context, mints the
  session, and returns the populated `AuthenticationResult`.
- **AC-3 — Backup-code success path.** A subsequent
  `Authenticate` call carrying a valid backup code consumes
  the code (REQ-AUTH-032 AC-1), audits the consumption, and
  mints the session.
- **AC-4 — TOTP failure.** An invalid TOTP code returns the
  same opaque outcome as a credential-mismatch — the client
  cannot tell from the response shape whether the password was
  wrong or the second factor was wrong.
- **AC-5 — Replay rejection.** When the wired SecretStore
  satisfies `ReplayGuardedSecretStore` (REQ-AUTH-031 AC-2), a
  TOTP code that has already been consumed for the user's
  current counter is rejected even if it would otherwise match
  the drift band.
- **AC-6 — Tenant continuity through MFA.** A login that
  resolved a non-host-bound tenant (e.g. a member of multiple
  tenants picking one explicitly) preserves that tenant choice
  through the MFA round-trip; the minted session binds to the
  same tenant the credential check approved.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `pk-modules/auth_management/features/authentication/service_test.go::TestAuthenticate_TwoFactorRequiredWhenEnabled`. |
| AC-2 | Test | `pk-modules/auth_management/features/authentication/service_test.go::TestAuthenticate_TwoFactorCodeSucceeds`. |
| AC-3 | Test | `pk-modules/auth_management/features/authentication/service_test.go::TestAuthenticate_TwoFactorRecoverySucceeds`. |
| AC-4 | Inspection | `login.go` MFA branch returns the same typed `ErrInvalidCredentials` shape on a wrong code; the HTTP mapper collapse from REQ-AUTH-001 AC-2 produces the uniform 401. |
| AC-5 | Test | `pk-modules/auth_management/features/twofactor/req_auth_003_test.go::TestTOTP_RejectsReplay_WithinDriftWindow` exercises the optional replay-guarded store; the flow path is the same one this REQ traverses. |
| AC-6 | Test | `pk-modules/auth_management/features/authentication/service_test.go::TestAuthenticate_TwoFactorChallengeRestoresTenantWithoutHostScopedContext`. |

## Edge cases & unhappy paths

- **MFA disabled mid-flow.** A user who disables MFA between
  the credential step and the challenge response sees the
  challenge response succeed without a code (the next call
  with the original credentials skips the MFA branch).
  Acceptable — the disable was the user's deliberate action.
- **Re-enrol race.** A user re-enrolling MFA during a flow
  has the partially-enrolled secret rejected by the validator
  until the enrolment is verified by the user via the
  enroll-verify path (REQ-AUTH-030 AC-2).
- **Backup-code exhaustion.** A user who has consumed every
  backup code and lost their device cannot authenticate; the
  recovery flow is operator-mediated reset, not an
  authentication-time recourse.
- **Time drift on the server.** TOTP relies on a small drift
  window; the configured `Skew` accommodates ±N periods. A
  server whose clock has drifted beyond the band rejects
  legitimate codes — surfaced via the `auth.totp.failed`
  counter for SRE alerting.

## Risk

- **Likelihood:** High — every login by an MFA-enabled user
  traverses this path.
- **Impact:** Critical — a bypass of MFA defeats the
  second-factor protection entirely.
- **Mitigations:** Replay protection (AC-5), opacity at
  failure (AC-4), tenant continuity (AC-6), audit on every
  consumption (REQ-AUTH-032 AC-1).

## Implements (cross-cutting)

- **REQ-001 — Multi-tenant isolation.** AC-6 preserves tenant
  choice through the challenge.
- **REQ-003 — No account enumeration.** AC-4 collapses MFA
  failure to the uniform credential-failure shape.
- **REQ-004 — Audit per mutation.** Backup-code consumption
  emits the catalogued event (REQ-AUTH-032 AC-1).
- **REQ-005 — Fail-closed.** AC-1 refuses to mint a session
  while the second factor is outstanding.

## Compliance mapping

| Control | Coverage |
|---|---|
| SOC2 CC6.1 | AC-1, AC-2, AC-5 — strong-authentication enforcement when MFA is configured. |
| ISO27001 A.9.4.2 | AC-4 — uniform-error shape preserves the secure log-on procedure. |
| NIST IA-2 | AC-1..AC-3 — multi-factor enforcement covering both knowledge (password) and possession (TOTP / backup code) factors. |

## Satisfied by

- `pk-modules/auth_management/features/authentication/login_2fa.go` — the
  challenge integration point.
- `pk-modules/auth_management/features/authentication/twofactor_store.go` —
  the bridge to the `twofactor` feature's secret store.
- `pk-modules/auth_management/features/twofactor/service.go` — the
  underlying TOTP + backup-code primitives.

## Related requirements

- [REQ-AUTH-001 — Authentication umbrella](./REQ-AUTH-001-authentication.md)
- [REQ-AUTH-003 — Two-factor authentication](./REQ-AUTH-003-twofactor.md) — the feature this capability consumes.
- [REQ-AUTH-010 — Password login](./REQ-AUTH-010-login-credentials.md) — the credential step before the challenge.
- [REQ-AUTH-031 — TOTP verification with replay protection](./REQ-AUTH-031-totp-verification.md)
- [REQ-AUTH-032 — Backup-code recovery](./REQ-AUTH-032-backup-code-recovery.md)
