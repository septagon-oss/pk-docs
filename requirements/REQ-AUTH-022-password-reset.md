---
id: REQ-AUTH-022
title: "Password reset replaces a user's password after consuming a recovery token"
status: Proposed
date: 2026-05-08
slug: req-auth-022-password-reset
category: auth
ears_pattern: event-driven
priority: must
risk: high
verification_methods: [test, inspection]
compliance:
  - SOC2_CC6.1
  - ISO27001_A.9.2.4   # Management of secret authentication information
  - OWASP_ASVS_2.6
satisfied_by:
  adr: [ADR-0009]
  conventions: [C-04, C-14]
implements_cross_cutting: [REQ-001, REQ-004, REQ-005]
refines: REQ-AUTH-002
depends_on: [REQ-AUTH-015, REQ-AUTH-002]
type: doc
tags: [requirement, capability, auth_management, registration, password-reset]
module: auth_management
feature: registration
capability: password_reset
capability_kind: state_machine
stakeholders:
  - end-user (recovering account access)
  - operator (incident-response post-credential-leak)
  - compliance auditor (credential-management hygiene)
---

# REQ AUTH-022 — Password reset

Status: **Proposed** (2026-05-08)

## Statement

**When** a caller submits a recovery token plus a candidate new
password at the password-reset endpoint, the system **shall**
look up the recovery record by the hashed token, refuse the
request if the token is missing/expired/consumed, validate the
new password against the configured `PasswordPolicy`, hash the
new password via `passhash`, persist the new credential through
the `UserCredentialWriter` boundary, mark the token consumed,
revoke every active session bound to the user-id (defence in
depth — a leaked credential is the trigger that drives users to
reset, and the old sessions must die), and emit the
catalogued `user.password.reset` audit event.

## Rationale

Password reset is the unauthenticated credential-replacement
path; if it does not also revoke existing sessions, an attacker
who already obtained a session via the leaked password keeps
that session even after the user resets. The session-revocation
side-effect is what makes "I just changed my password" actually
defensive rather than only cosmetic.

The password-policy gate is the same gate as
REQ-AUTH-020 AC-4 — applying it to the reset path closes the
loophole where a user could downgrade to a weaker password by
going through the reset flow instead of an in-place change.

The token-consume + sessions-revoke + credential-write trio
must be ordered so a partial failure does not leave the user
in an unauthenticatable-but-still-leaked-session state. The
documented order: (1) write the new credential, (2) mark the
token consumed, (3) revoke sessions. A failure between (1) and
(2) is recoverable (the user retries the reset link with the
same token); a failure between (2) and (3) is logged at Error
for operator follow-up, and the user can self-revoke via the
session-list surface.

## Acceptance criteria

- **AC-1 — Happy path.** A valid token + policy-compliant
  password resets the credential, marks the token consumed,
  revokes the user's other sessions, and emits
  `user.password.reset`.
- **AC-2 — Token reuse rejection.** A token whose `consumed_at`
  is non-nil returns the typed
  `ErrInvalidVerificationToken` (uniform with the never-existed
  case so the response does not leak the prior consumption).
- **AC-3 — Expiry rejection.** A token past its TTL returns
  the typed `ErrVerificationTokenExpired`.
- **AC-4 — Policy enforcement.** A new password failing the
  configured `PasswordPolicy` returns the typed
  `ErrPasswordPolicyViolation`; the reset is not applied.
- **AC-5 — Session revocation side-effect.** After a
  successful reset, the user's other active sessions return
  the typed `"session revoked"` error on their next refresh
  or token verification.
- **AC-6 — Same-password rejection.** A new password byte-equal
  to the current password is rejected with a typed error so
  users do not "reset" by replaying their existing credential.
  (Implementation note: this requires a hash-compare; the
  reset path performs it as a single extra `passhash.Compare`.)
- **AC-7 — Audit emission.** The `user.password.reset` event
  carries the user id, tenant id, and the source IP / user
  agent (for operator anomaly-detection) but **never** the
  candidate password.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Inspection | `pk-modules/auth_management/features/registration/password_reset_test.go` (when present); reviewers verify `password_reset.go::Reset` exercises the orchestration order documented above. _Verification gap: pending — cited evidence is prose / pattern / non-Go and cannot be auto-resolved._ |
| AC-2 | Inspection | `password_reset.go` — repository check for `consumed_at` before any other branch. |
| AC-3 | Inspection | TTL check identical to REQ-AUTH-021 AC-3. |
| AC-4 | Inspection | The same `validatePasswordPolicy` helper used by REQ-AUTH-020 AC-4. |
| AC-5 | Inspection | Reviewers verify the reset flow calls into `Service::LogoutEverywhere` (REQ-AUTH-012 AC-3). |
| AC-6 | Inspection | Code review — the same-password check happens after the policy gate. |
| AC-7 | Inspection | Audit-event payload review; PII-redaction discipline mirrors `observability/logger/redactor`. |

## Edge cases & unhappy paths

- **No active sessions to revoke.** The session-revocation
  step is a no-op; the audit row still records the reset.
- **Reset by an operator on a user's behalf.** Operator-driven
  reset uses a different code path that does not require a
  recovery token; this REQ scopes to the user-driven flow.
- **Token issued for an inactive account.** A reset against
  an inactive/suspended user fails closed — the reset path
  refuses to set credentials on an account that cannot log in.
- **Concurrent reset attempts.** Two redemptions of the same
  token race; whichever wins consumes the token, the other
  sees `ErrInvalidVerificationToken`.

## Risk

- **Likelihood:** Medium — invoked at human-incident frequency
  rather than per-request.
- **Impact:** Critical — a defective reset that does not
  revoke sessions leaves the attacker's session intact while
  the user thinks they have remediated.
- **Mitigations:** Session revocation as part of the reset
  transaction (AC-5), single-use TTL-bound token (AC-2 + AC-3),
  policy-enforced replacement password (AC-4 + AC-6).

## Implements (cross-cutting)

- **REQ-001 — Multi-tenant isolation.** Reset scoped to the
  user's tenant.
- **REQ-004 — Audit per mutation.** `user.password.reset`
  with operator-relevant metadata.
- **REQ-005 — Fail-closed.** AC-2..AC-6 default-deny on any
  precondition failure.

## Compliance mapping

| Control | Coverage |
|---|---|
| SOC2 CC6.1 | AC-1 + AC-5 — credential replacement bundles session revocation. |
| ISO27001 A.9.2.4 | AC-1, AC-4, AC-7 — secret-information lifecycle with policy + audit. |
| OWASP ASVS 2.6 | AC-2..AC-7 — full coverage of the recovery + reset requirements. |

## Satisfied by

- `pk-modules/auth_management/features/registration/password_reset.go` —
  the reset orchestration.
- `pk-modules/auth_management/features/registration/verification_repository.go` —
  the token-consume persistence.
- `pk-modules/auth_management/features/registration/register_user_service.go` —
  the password-policy gate (`validatePasswordPolicy`).

## Related requirements

- [REQ-AUTH-002 — Registration umbrella](./REQ-AUTH-002-registration.md)
- [REQ-AUTH-015 — Forgot password](./REQ-AUTH-015-forgot-password.md) — the upstream initiator that mints the recovery token.
- [REQ-AUTH-012 — Logout](./REQ-AUTH-012-logout.md) — the session-revocation primitive AC-5 invokes.
