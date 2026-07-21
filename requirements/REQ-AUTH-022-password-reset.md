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
  adr: [ADR-0009, ADR-0072]
  conventions: [C-04, C-22, C-14]
implements_cross_cutting: [REQ-001, REQ-004, REQ-005]
refines: REQ-AUTH-001
depends_on: [REQ-AUTH-015, REQ-AUTH-010, REQ-AUTH-012]
type: doc
tags: [requirement, capability, auth_management, authentication, password-reset, bearer]
module: auth_management
feature: authentication
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
new password via `passhash`, atomically consume the token before
invoking the `UserCredentialWriter` boundary, persist the new credential,
revoke every active session bound to the user-id (defence in
depth — a leaked credential is the trigger that drives users to
reset, and the old sessions must die), and emit the
catalogued `auth.password.reset` audit event.

**When** the platform issues the one-time password-reset bearer, it **shall**
persist only the SHA-256 digest in the purpose-bound `auth_login_tokens`
ledger. The raw bearer **shall not** enter a database row, projection, log,
audit, event, notification record, template, retry payload, or durable job.

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

The token-consume + credential-write + sessions-revoke sequence must be ordered
so concurrent submissions cannot race different passwords into the same
account. The documented order is: (1) win the token's single-use
compare-and-swap, (2) write the new credential, (3) revoke sessions. When the
token ledger and credential owner cannot share a transaction, a failure after
step (1) deliberately burns the token and the user requests a fresh one. This
fail-safe tradeoff is preferable to calling the credential writer twice. A
failure after the password write but before session revocation remains a
high-severity operational error until the full orchestration is implemented.

Password-reset authority moved to the shared purpose-bound login-token ledger.
The earlier plaintext `auth_password_resets` table has no live owner and would
retain unnecessary credential material in databases and backups. Its removal
is therefore a security-irreversible cutover, not a recoverable downgrade.

## Acceptance criteria

- **AC-1 — Happy path.** A valid token + policy-compliant
  password resets the credential, marks the token consumed,
  revokes the user's other sessions, and emits
  `auth.password.reset`.
- **AC-2 — Token reuse rejection.** A token whose `consumed_at`
  is non-nil returns the typed
  `ErrLoginTokenInvalid` (uniform with the never-existed
  case so the response does not leak the prior consumption).
- **AC-3 — Expiry rejection.** A token past its TTL returns the same typed
  `ErrLoginTokenInvalid` result as an unknown or consumed reset credential.
- **AC-4 — Policy enforcement.** A new password failing the
  configured `PasswordPolicy` returns the typed
  `ErrPasswordPolicyViolation`; the reset is not applied.
- **AC-5 — Session revocation side-effect.** After a
  successful reset, the user's other active sessions return
  the typed `"session revoked"` error on their next refresh
  or token verification.
- **AC-6 — Same-password rejection.** A new password byte-equal
  to the current password is rejected with a typed error so
  users do not "reset" by replaying their existing credential. This requires
  a hash comparison before the credential write.
- **AC-7 — Audit emission.** The `auth.password.reset` event
  carries the user id, tenant id, and the source IP / user
  agent (for operator anomaly-detection) but **never** the
  candidate password.
- **AC-8 — Hash-only bearer authority.** Password-reset issuance stores only
  the SHA-256 digest in `auth_login_tokens`, bound to the exact tenant, user,
  `password_reset` purpose, expiry, and consumption state. Migration 023 drops
  the unused plaintext credential table, and its down migration fails
  explicitly instead of recreating raw-token storage.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Inspection | `pk-modules/auth_management/features/authentication/login_link_service.go::ResetPasswordWithToken` implements consume-before-write; session revocation and event emission remain explicit verification gaps while this requirement is Proposed. |
| AC-2 | Inspection | `login_link_service.go::consumeTokenInTransaction` rejects a lost versioned compare-and-swap as `ErrLoginTokenInvalid`. |
| AC-3 | Inspection | `login_link_service.go::lookupPending` rejects expired state through the uniform `ErrLoginTokenInvalid` result. |
| AC-4 | Inspection | Verification gap: the live path currently enforces a fixed minimum length rather than the full shared `PasswordPolicy`. |
| AC-5 | Inspection | Verification gap: the live reset path does not yet invoke the REQ-AUTH-012 logout-everywhere boundary. |
| AC-6 | Inspection | Verification gap: the live reset path does not yet compare the candidate with the current password hash. |
| AC-7 | Inspection | Verification gap: the canonical `auth.password.reset` event contract exists, but the live reset path does not yet emit it. |
| AC-8 | Test | `pk-modules/auth_management/features/authentication/password_reset_schema_retirement_test.go::TestPlaintextPasswordResetSchemaIsRetired`, `TestAuthenticationFeatureDoesNotExposeLegacyPasswordResetPersistence`, and `auth_management/migrations/023_retire_plaintext_password_reset_table.{up,down}.sql`. |

## Edge cases & unhappy paths

- **No active sessions to revoke.** In the completed orchestration, the
  session-revocation step is a no-op and the audit event still records the
  reset.
- **Reset by an operator on a user's behalf.** Operator-driven
  reset uses a different code path that does not require a
  recovery token; this REQ scopes to the user-driven flow.
- **Token issued for an inactive account.** A reset against an inactive or
  suspended user must fail closed. Authoritative lifecycle revalidation is an
  implementation gap alongside AC-4 through AC-7.
- **Concurrent reset attempts.** Two redemptions of the same
  token race; whichever wins consumes the token, the other
  sees `ErrLoginTokenInvalid`.
- **Plaintext-schema cutover.** Rows in the unused plaintext table are
  discarded, not converted into live credentials. Credentials in the live
  digest-only `auth_login_tokens` ledger are unaffected.

## Risk

- **Likelihood:** Medium — invoked at human-incident frequency
  rather than per-request.
- **Impact:** Critical — a defective reset that does not
  revoke sessions leaves the attacker's session intact while
  the user thinks they have remediated.
- **Mitigations:** Session revocation as part of the reset
  transaction (AC-5), single-use TTL-bound token (AC-2 + AC-3),
  policy-enforced replacement password (AC-4 + AC-6), and hash-only scoped
  bearer authority (AC-8).

## Implements (cross-cutting)

- **REQ-001 — Multi-tenant isolation.** Reset scoped to the
  user's tenant.
- **REQ-004 — Audit per mutation.** `auth.password.reset`
  with operator-relevant metadata.
- **REQ-005 — Fail-closed.** AC-2..AC-6 default-deny on any
  precondition failure.

## Compliance mapping

| Control | Coverage |
|---|---|
| SOC2 CC6.1 | AC-1 + AC-5 — credential replacement bundles session revocation. |
| ISO27001 A.9.2.4 | AC-1, AC-4, AC-7 — secret-information lifecycle with policy + audit. |
| OWASP ASVS 2.6 | AC-2 through AC-8 define the required recovery and reset controls; the verification table records current gaps. |

## Satisfied by

Only AC-2, AC-3, and AC-8 are fully implemented; the verification table above
records the remaining Proposed gaps.

- `pk-modules/auth_management/features/authentication/login_link_service.go` —
  purpose-bound digest issuance, read-only peek, and single-use consume.
- `pk-modules/auth_management/features/authentication/login_link.go` and `forgot_password.go` —
  public request, read-only landing, and explicit reset submission.
- `pk-modules/auth_management/entities/login_token.go` —
  the digest-only `auth_login_tokens` model.
- `pk-modules/auth_management/migrations/023_retire_plaintext_password_reset_table.up.sql` —
  the security-irreversible plaintext-table retirement.

## Related requirements

- [REQ-AUTH-001 — Authentication umbrella](./REQ-AUTH-001-authentication.md)
- [REQ-AUTH-010 — Login credentials](./REQ-AUTH-010-login-credentials.md)
- [REQ-AUTH-020 — Account create](./REQ-AUTH-020-account-create.md) — the shared password-policy authority planned by AC-4.
- [REQ-AUTH-015 — Forgot password](./REQ-AUTH-015-forgot-password.md) — the upstream initiator that mints the recovery token.
- [REQ-AUTH-012 — Logout](./REQ-AUTH-012-logout.md) — the session-revocation primitive AC-5 invokes.
- [ADR 0072 — One-time public authentication bearers use hash-only scoped ledgers](../adr/0072-one-time-public-authentication-bearers-use-hash-only-scoped-ledgers.md)
- [Convention C-22](../conventions.md#c-22-one-time-public-authentication-bearers-use-hash-only-scoped-ledgers)
