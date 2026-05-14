---
id: REQ-AUTH-021
title: "Email verification consumes a single-use, time-bound token to activate a pending account"
status: Proposed
date: 2026-05-08
slug: req-auth-021-email-verification
category: auth
ears_pattern: event-driven
priority: must
risk: high
verification_methods: [test, inspection]
compliance:
  - SOC2_CC6.1
  - ISO27001_A.9.2.2
  - OWASP_ASVS_2.5   # Identity proofing
satisfied_by:
  adr: [ADR-0009]
  conventions: [C-04, C-14]
implements_cross_cutting: [REQ-001, REQ-004, REQ-005]
refines: REQ-AUTH-002
depends_on: [REQ-AUTH-020, REQ-USER-001]
type: doc
tags: [requirement, capability, auth_management, registration, email-verification]
module: auth_management
feature: registration
capability: verify_email
capability_kind: state_machine
stakeholders:
  - end-user (proving email ownership)
  - tenant administrator (account-validity policy)
  - compliance auditor (identity-proofing audit)
---

# REQ AUTH-021 — Email verification

Status: **Proposed** (2026-05-08)

## Statement

**When** a caller submits an email-verification token at the
verification endpoint, the system **shall** look up the
verification record by the hashed token, refuse the request if
the token is missing, expired, or already consumed, look up the
target user via the boundary service, transition the user to
status `active` with `email_verified=true`, mark the
verification record consumed, and emit the catalogued
`user.email.verified` event.

## Rationale

Email verification is the platform's identity-proofing
checkpoint at registration: it converts "someone claimed this
email" into "the holder of the email confirmed it". The
token-mechanics discipline rests on three properties:

1. **Single-use.** A token consumed once cannot be replayed.
   Without this, a leaked verification email becomes a
   long-running account-takeover vector.
2. **Time-bound.** Tokens expire at a configured TTL
   (typically 24 hours). An unexpired-forever token is a
   long-tail credential exposure.
3. **Activation as the load-bearing side-effect.** The
   verification record's `verified_at` flip is the signal,
   but the actual user-state transition happens via the
   boundary service's partial-update path so the producer
   module never serialises the full `User` aggregate. This is
   what keeps the `pending_verification → active` move
   consistent across the platform's two interface families
   (REQ-USER-001).

The verification-audit-row write is best-effort: the user has
already been activated, and the audit trail is reconstructable
from the `user.email.verified` event alone if the verification
row write fails. The platform logs at Error so the operator
can tell the gap exists without the user-facing flow being
disrupted.

## Acceptance criteria

- **AC-1 — Happy path.** A valid, unexpired, unconsumed token
  marks the verification record consumed
  (`verified_at = now()`), updates the user's status to
  `active` and `email_verified=true`, and publishes
  `user.email.verified`.
- **AC-2 — Single-use replay rejection.** A token that has
  already been consumed (its `verified_at` is non-nil)
  returns the typed `ErrEmailAlreadyVerified` error and does
  not re-trigger the activation.
- **AC-3 — Expiry rejection.** A token whose `expires_at` is
  in the past returns the typed
  `ErrVerificationTokenExpired` error and does not trigger
  the activation.
- **AC-4 — Unknown token.** A token that does not exist in
  the verification repository returns
  `ErrInvalidVerificationToken`. The response shape is
  uniform with the expired-and-consumed cases so the user
  cannot discriminate the failure mode.
- **AC-5 — Missing user record.** If the verification record
  exists but the bound user has been deleted, the request
  returns `ErrUserNotFound`; the verification row stays
  unconsumed so a recovery flow can re-issue.
- **AC-6 — Boundary writer requirement.** The activation step
  requires the user service to satisfy
  `ports.UserBoundaryWriter`; an unwired writer returns the
  typed configuration error rather than a silent success.
- **AC-7 — Audit-row resilience.** A failure to update the
  verification record after the user has been activated logs
  at Error and propagates `nil` to the caller — the user
  succeeds, the audit gap surfaces in metrics for operator
  triage.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `pk-modules/auth_management/features/registration/req_auth_002_test.go::TestVerifyEmail_SingleUse_AndExpiry` covers the success and the subsequent rejection. |
| AC-2 | Inspection | Same harness — second redemption returns `ErrEmailAlreadyVerified`. _Verification gap: pending — cited evidence is prose / pattern / non-Go and cannot be auto-resolved._ |
| AC-3 | Inspection | `req_auth_002_test.go::TestVerifyEmail_SingleUse_AndExpiry/expired_token_rejected`. _Verification gap: pending — cited evidence is prose / pattern / non-Go and cannot be auto-resolved._ |
| AC-4 | Inspection | `verify_email.go::VerifyEmail` — `s.verificationRepo.GetByToken` returning nil → `ErrInvalidVerificationToken`. |
| AC-5 | Inspection | `verify_email.go::VerifyEmail` — `ResolveGetByIDDTO` returning nil → `ErrUserNotFound`. |
| AC-6 | Inspection | `verify_email.go::VerifyEmail` — type assertion to `ports.UserBoundaryWriter` returns the typed error on failure. |
| AC-7 | Inspection | `verify_email.go::VerifyEmail` — Error-log-and-return-nil branch when the verification update fails. |

## Edge cases & unhappy paths

- **Concurrent consumption.** Two simultaneous redemption
  requests for the same token race on the verification-row
  read. The single-use semantic survives because the
  consumed-flag write is the source of truth; the second
  redemption sees the verified-row state and returns
  `ErrEmailAlreadyVerified`.
- **User reactivation post-suspension.** A previously
  suspended user who completes a fresh verification loop is
  reactivated; the platform allows operator-mediated reset
  flows that pre-stamp a new verification token.
- **Email-change verification.** When a user changes email,
  the same primitive issues a new token and reuses this
  endpoint; the activation update narrows to the email
  field rather than the status flip.
- **Token TTL clock skew.** Verification clocks rely on
  `time.Now()`; deployments distributed across regions with
  drifting NTP see edge-of-window false negatives, mitigated
  by the configured TTL being substantially larger than the
  expected drift.

## Risk

- **Likelihood:** Medium — every new account traverses this
  path exactly once.
- **Impact:** High — a verification bypass produces an active
  account without proven email ownership, undoing the
  identity-proofing checkpoint.
- **Mitigations:** Single-use (AC-2), TTL bounded (AC-3),
  uniform error opacity (AC-4), boundary-writer requirement
  (AC-6).

## Implements (cross-cutting)

- **REQ-001 — Multi-tenant isolation.** The verification
  record is scoped to the user's tenant; cross-tenant
  redemption is rejected by the repository's tenant-bound
  query.
- **REQ-004 — Audit per mutation.** `user.email.verified`
  emitted on every successful activation.
- **REQ-005 — Fail-closed.** AC-2..AC-6 default-deny on any
  precondition failure.

## Compliance mapping

| Control | Coverage |
|---|---|
| SOC2 CC6.1 | AC-1 — verified email as a precondition for active account status. |
| ISO27001 A.9.2.2 | AC-1 — formal user-provisioning checkpoint. |
| OWASP ASVS 2.5 | AC-2 + AC-3 — identity-proofing token discipline. |

## Satisfied by

- `pk-modules/auth_management/features/registration/verify_email.go` —
  the verifier and orchestration.
- `pk-modules/auth_management/features/registration/verification_repository.go` —
  the persistence layer.
- `pk-modules/auth_management/features/registration/register_user_service.go::sendVerificationEmail` —
  the producer side that mints tokens.

## Related requirements

- [REQ-AUTH-002 — Registration umbrella](./REQ-AUTH-002-registration.md)
- [REQ-AUTH-020 — Account create](./REQ-AUTH-020-account-create.md) — the producer of the verification token this capability consumes.
- [REQ-AUTH-024 — Resend verification](./REQ-AUTH-024-resend-verification.md) — the recovery path when the original email is lost.
- [REQ-USER-001 — User](./REQ-USER-001-user.md) — the record this capability transitions to active.
