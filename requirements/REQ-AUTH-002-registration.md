---
id: REQ-AUTH-002
title: "Registration feature creates accounts without leaking email existence"
status: Proposed
date: 2026-05-06
slug: req-auth-002-registration
category: auth
ears_pattern: event-driven
verification_methods: [test, inspection]
compliance: [SOC2_CC6.1, ISO27001_A.9.4]
satisfied_by:
  adr: [ADR-0009]
  conventions: [C-04, C-14]
implements_cross_cutting: [REQ-001, REQ-003, REQ-004, REQ-009]
type: doc
tags: [requirement, feature, auth_management]
module: auth_management
feature: registration
---

# REQ AUTH-002 — Registration

Status: **Proposed** (2026-05-06)

## Statement

**When** a caller submits a registration request, the feature **shall**
enforce the configured password policy, emit an email-verification
token if the email is novel, persist the user in the requesting tenant
in a `pending_verification` state, and audit the attempt. **If** the
email already exists the response **shall** be indistinguishable from
the success response — the duplicate is recorded server-side and the
existing owner receives an "account already exists" notification out
of band.

## Rationale

Public-facing registration endpoints are the second-most-targeted
enumeration surface after login. Treating "this email is taken" as a
visible 4xx leaks the membership of the tenant. Email verification
tokens that are guessable or reusable open the door to account
takeover via OAuth-style replay.

## Acceptance criteria

- **AC-1** A novel-email submission persists the user in the requesting
  tenant (REQ-001), records `auth.registration.requested`, and emits
  a single-use, time-bound verification token by email.
- **AC-2** A duplicate-email submission returns an indistinguishable
  response shape; the audit row records the duplicate, and the
  existing owner is notified via the configured notification
  channel (REQ-014 graceful degradation if the channel is down).
- **AC-3** Password policy is enforced server-side: configured
  minimum length, character classes, breach-list lookup if enabled.
  Rejected passwords return a generic "password does not meet
  requirements" message — never enumerate which rule failed.
- **AC-4** The verification token is single-use, expires within the
  configured TTL, and binding it audits `auth.registration.completed`
  and transitions the user to active.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `pk-modules/auth_management/features/registration/req_auth_002_test.go::TestRegister_NovelEmail_CreatesPendingUserAndDispatchesVerification`. |
| AC-2 | Test | `pk-modules/auth_management/features/registration/req_auth_002_test.go::TestRegister_DuplicateEmail_NoEnumeration` and `TestRegister_DuplicateUsername_NoEnumeration` assert that the service returns the typed sentinels `ErrEmailAlreadyRegistered` / `ErrUsernameAlreadyRegistered` without echoing the submitted value. The handler maps both to a generic 409 Conflict. |
| AC-3 | Test | `pk-modules/auth_management/features/registration/req_auth_002_test.go::TestRegister_PasswordPolicy_EnforcedAndOpaque` exercises the configurable `Config.PasswordPolicy` gate (`MinLength`, `RequireDigit/Upper/Lower/Symbol`). Violations return the typed `ErrPasswordPolicyViolation` with a generic "password does not meet requirements" message — naming the failed rule would let an attacker probe the policy. |
| AC-4 | Test | `pk-modules/auth_management/features/registration/req_auth_002_test.go::TestVerifyEmail_SingleUse_AndExpiry` exercises the `VerifiedAt` single-use guard at `verify_email.go:167-169` and the `ExpiresAt` check at `verify_email.go:163-165`. |

## Implements (cross-cutting)

- REQ-001 — multi-tenant isolation (AC-1).
- REQ-003 — no account enumeration (AC-2, AC-3).
- REQ-004 — audit per mutation (AC-1, AC-4).
- REQ-009 — observability (all ACs).

## Satisfied by

- `pk-modules/auth_management/features/registration/feature.go`
- `pk-modules/auth_management/features/registration/check_availability.go`,
  `complete_registration.go`, `password_reset.go`
- `pk-modules/auth_management/features/registration/handler.go`, `routes.go`
- `pk-modules/auth_management/features/registration/permissions.go`,
  `capabilities.go`

## Related requirements

- [REQ-AUTH-001 — Authentication](./REQ-AUTH-001-authentication.md)
- [REQ-USER-NNN — User profile](./REQ-USER-002-profile.md) — the persistent user record this feature creates.
