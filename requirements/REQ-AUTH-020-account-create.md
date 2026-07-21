---
id: REQ-AUTH-020
title: "Account-create persists a new user, dispatches verification, and emits the registered event"
status: Proposed
date: 2026-05-08
slug: req-auth-020-account-create
category: auth
ears_pattern: event-driven
priority: must
risk: high
verification_methods: [test]
compliance:
  - SOC2_CC6.1
  - ISO27001_A.9.2.2   # User access provisioning
  - GDPR_Art_6         # Lawfulness of processing (consent capture)
satisfied_by:
  adr: [ADR-0009]
  conventions: [C-04, C-14]
implements_cross_cutting: [REQ-001, REQ-003, REQ-004, REQ-009]
refines: REQ-AUTH-002
depends_on: [REQ-USER-001]
type: doc
tags: [requirement, capability, auth_management, registration, signup]
module: auth_management
feature: registration
capability: create_account
capability_kind: failure_mode
stakeholders:
  - end-user (signing up)
  - tenant administrator (tenant member onboarding)
  - compliance auditor (consent capture, terms acceptance)
---

# REQ AUTH-020 — Account create

Status: **Proposed** (2026-05-08)

## Statement

**When** a registration request is submitted at the
`CreateAccount` endpoint, the system **shall**:

1. Apply the configured per-email rate limit
   (REQ-AUTH-014's mechanism, registration bucket);
2. Validate the request body — non-empty `(email, username,
   password)`, well-formed email, accepted terms;
3. Reject the candidate password if it fails the configured
   `PasswordPolicy` (REQ-AUTH-002 AC-3);
4. Look up the email and username via the user-boundary
   service; reject duplicates with the typed sentinels
   `ErrEmailAlreadyRegistered` / `ErrUsernameAlreadyRegistered`
   (no submitted-value echo — REQ-003);
5. Hash the password via the platform's `passhash` primitive
   (Argon2id / bcrypt depending on configuration);
6. Persist the user with status `pending_verification` (or the
   change-management approval-pending state when configured);
7. Either dispatch a verification email (configured-default
   path) or activate the user immediately (admin-bypass path),
   propagating the activation failure to the caller as a 5xx
   error rather than silently stranding the user;
8. Publish the catalogued `user.registered` event with the
   user id, tenant id, accepted-terms flag, and registration
   metadata.

## Rationale

Account creation is the most-frequently-attacked **non**-auth
endpoint — bots probe it as both an enumeration vector and a
spam-account creation vector. The discipline encoded here
balances three concerns:

1. **No enumeration via duplicate-email response.**
   REQ-AUTH-002 AC-2 and REQ-003 are the cross-cutting source of
   truth; this REQ enforces the typed-sentinel pattern at the
   service boundary. The HTTP handler maps both sentinels to a
   uniform 409 with no submitted-value echo.
2. **Activation propagation.** A user who registers but whose
   activation write fails ends up "in the database but unable
   to log in" — a silent stranding state we deliberately do
   not allow. The activation step in the no-email-verification
   branch propagates its error to the caller so the client can
   surface the failure rather than telling the user to "check
   your email" for an email that will never arrive.
3. **Consent and audit at-create.** GDPR and the platform's
   commercial terms require explicit consent capture
   (`AcceptTerms`) and a permanent record of when each user
   accepted. The `user.registered` event payload carries the
   `acceptedTerms` flag so the audit trail has the consent
   record.

## Acceptance criteria

- **AC-1 — Happy path.** A novel-email submission with a
  policy-compliant password persists the user with status
  `pending_verification`, mints a single-use verification
  token, dispatches the verification email, publishes
  `user.registered`, and returns the populated
  `RegistrationResult`.
- **AC-2 — Duplicate email opacity.** A submission whose email
  matches an existing account returns the typed
  `ErrEmailAlreadyRegistered`; the handler maps it to a
  uniform 409 without echoing the submitted email back.
- **AC-3 — Duplicate username opacity.** A submission whose
  username matches an existing account returns
  `ErrUsernameAlreadyRegistered`; the handler maps it to a
  uniform 409 without echoing the submitted username.
- **AC-4 — Password policy gate.** A password failing the
  configured `PasswordPolicy` returns the typed
  `ErrPasswordPolicyViolation`; the user-facing message is
  the generic "password does not meet requirements" — naming
  the failed rule would let an attacker probe the policy.
- **AC-5 — Rate-limit gate.** Repeated submissions for the
  same email within the configured window return the typed
  rate-limit error (counters share namespace with the login
  rate-limit bucket).
- **AC-6 — Activation failure propagation.** When
  `RequireEmailVerification=false` and the post-create
  activation update fails, `CreateAccount` returns a 5xx
  error rather than the success-shaped response — no silently
  stranded users.
- **AC-7 — Notification fail-soft.** When the configured
  notification channel is unwired, the verification email
  cannot be dispatched; the user is still persisted and the
  fact that no email was sent is logged at Warn — the
  inability to dispatch must not block the user record from
  being created (the operator can resend manually via
  REQ-AUTH-024).
- **AC-8 — Pending-approval branch.** When change-management
  is wired, a fresh user lands in the approval queue rather
  than the user table; the response payload's
  `ApprovalRequired` flag signals the client to display
  "Registration submitted for approval".

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `pk-modules/auth_management/features/registration/req_auth_002_test.go::TestRegister_NovelEmail_CreatesPendingUserAndDispatchesVerification`. |
| AC-2 | Test | `pk-modules/auth_management/features/registration/req_auth_002_test.go::TestRegister_DuplicateEmail_NoEnumeration`. |
| AC-3 | Test | `pk-modules/auth_management/features/registration/req_auth_002_test.go::TestRegister_DuplicateUsername_NoEnumeration`. |
| AC-4 | Test | `pk-modules/auth_management/features/registration/req_auth_002_test.go::TestRegister_PasswordPolicy_EnforcedAndOpaque`. |
| AC-5 | Inspection | `register_user_rate_limit.go` mirrors the login-bucket pattern; reviewers verify the bucket key build. |
| AC-6 | Inspection | `register_user_service.go::CreateAccount` (the activation branch comment block) — failure propagates to the caller. |
| AC-7 | Inspection | `register_user_service.go::sendVerificationEmail` — when `notificationSvc` is nil the function returns nil with a Warn log; the user has already been persisted. |
| AC-8 | Inspection | `register_user_service.go` — `approvalRequired` branch sets the flag and returns the corresponding message. |

## Edge cases & unhappy paths

- **Email canonicalisation collision.** `User@Example.com`
  and `user@example.com` register against the same canonical
  bucket; the second submission collapses to AC-2.
- **Tenant context absent.** Public registration without a
  tenant context falls back to the platform's default
  tenant (configurable); operator-driven user creation in a
  specific tenant uses a different code path that bypasses
  this surface.
- **Email-verification token collision.** Each token is a
  fresh 256-bit random value; the collision probability is
  cryptographically negligible.
- **Notification provider rate-limit.** A spike of
  registrations against a notification provider with its own
  per-second cap will see some emails delayed; the platform
  retries through the notification feature's own dispatcher.

## Risk

- **Likelihood:** High — public surface, often abused by bots.
- **Impact:** Medium — a successful registration is bounded
  by what an unverified user can do until they verify their
  email.
- **Mitigations:** Rate-limit (AC-5), policy gate (AC-4),
  duplicate opacity (AC-2 + AC-3), terms-of-service consent
  capture, activation-failure propagation (AC-6).

## Implements (cross-cutting)

- **REQ-001 — Multi-tenant isolation.** Users are scoped to
  the tenant resolved from the request.
- **REQ-003 — No account enumeration.** AC-2 + AC-3 + AC-4
  are the runtime witnesses.
- **REQ-004 — Audit per mutation.** `user.registered` and
  the verification audit trail.
- **REQ-009 — Observability.** `auth.registration.completed`
  metric on success.

## Compliance mapping

| Control | Coverage |
|---|---|
| SOC2 CC6.1 | AC-1 + AC-4 — secure account-creation procedure with policy enforcement. |
| ISO27001 A.9.2.2 | AC-1 — formal user-access provisioning step. |
| GDPR Art. 6 | AC-1 + AC-8 — explicit consent capture (`acceptedTerms`) recorded in the audit trail. |

## Satisfied by

- `pk-modules/auth_management/features/registration/register_user_service.go` —
  the orchestration entry point.
- `pk-modules/auth_management/features/registration/register_user.go` —
  the JSON HTTP handler.
- `pk-modules/auth_management/features/registration/register_user_form.go` —
  the HTML form handler.
- `pk-modules/auth_management/features/registration/register_user_rate_limit.go` —
  the per-email throttle.

## Related requirements

- [REQ-AUTH-002 — Registration umbrella](./REQ-AUTH-002-registration.md)
- [REQ-AUTH-021 — Email verification](./REQ-AUTH-021-email-verification.md) — the second step this capability dispatches.
- [REQ-AUTH-022 — Password reset](./REQ-AUTH-022-password-reset.md) — the post-registration password-replacement path.
- [REQ-AUTH-023 — Availability check](./REQ-AUTH-023-availability-check.md) — the pre-submit availability surface clients consult.
- [REQ-USER-001 — User](./REQ-USER-001-user.md) — the persistent record this capability creates.
