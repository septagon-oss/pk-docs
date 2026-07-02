---
id: REQ-003
title: "Authentication failures must not leak account existence"
status: Active
date: 2026-05-06
slug: req-003-no-account-enumeration
category: auth
ears_pattern: unwanted-behaviour
verification_methods:
  - test
  - inspection
compliance:
  - SOC2_CC6.1
  - ISO27001_A.9.4
satisfied_by:
  adr: []
  conventions: []
type: doc
tags: [requirement, auth, security]
---

# REQ 003 — Authentication failures must not leak account existence

Status: **Active** (2026-05-06)

## Statement

**If** a public authentication endpoint receives credentials, **then**
the system **shall** respond with the same status code, the same error
message, and a response time within a small constant of the verified
case, regardless of whether the supplied identifier (email, username)
is registered in the platform.

## Rationale

Account enumeration is the precondition for credential stuffing,
phishing, and targeted social-engineering attacks. An endpoint that
returns "user not found" for an unregistered email and "invalid
password" for a registered one hands an attacker a free oracle: a list
of every email that has an account on the platform. Even small timing
differences (a database lookup that returns fast for unknown emails
because no password hash is verified) reconstruct the same oracle.

Beyond the technical exposure, the property is part of the contract
with our tenants. Many of our enterprise clients require their
identity-provider integrations to demonstrate enumeration resistance
as part of a security review.

## Acceptance criteria

- **AC-1** A login attempt against an unregistered email and a login
  attempt against a registered email + wrong password both return
  HTTP 401 with the same error string (`errMsgInvalidCredentials`).
- **AC-2** The login handler invokes the password-verification path
  (`authProvider.Login`) for both the registered and unregistered
  case so the response time is dominated by the password hash work
  factor and not by the user lookup. Mean response-time delta
  between known and unknown emails is below the configured
  tolerance (target: < 5 ms).
- **AC-3** Account-state errors (`errMsgAccountLocked`,
  `errMsgAccountSuspended`, `errMsgEmailNotVerified`) **shall not**
  surface to a caller who has not proven possession of the password.
  An unauthenticated probe always sees the generic
  `errMsgInvalidCredentials` response.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `modules/platformkit-business-modules/auth_management/features/authentication/service_test.go::TestAuthenticate_InvalidEmail` and `TestAuthenticate_InvalidPassword` — both return the same typed `ErrInvalidCredentials`. The HTTP-level uniform-401 collapse is exercised by `modules/platformkit-business-modules/auth_management/features/authentication/req_auth_001_test.go::TestAuthenticate_HTTPFailureShape_IsIndistinguishable`. |
| AC-2 | Inspection | `auth_management/features/authentication/login.go` — the always-hash discipline ensures the password-verification path runs on both branches. **Verification gap: a dedicated timing-parity microbenchmark / statistical test is pending.** |
| AC-3 | Test | `modules/platformkit-business-modules/auth_management/features/authentication/service_test.go::TestAuthenticate_AccountStatuses` (table-driven across `Inactive`, `Suspended`, `Pending`) — all collapse to the typed account-status error; the HTTP layer (REQ-AUTH-001 AC-2) maps every variant to the uniform 401, asserted by `req_auth_001_test.go::TestAuthenticate_HTTPFailureShape_IsIndistinguishable`. |

## Satisfied by

- `modules/platformkit-business-modules/auth_management/features/authentication/login_service.go` —
  the constant-time `Authenticate` path.
- `modules/platformkit-business-modules/auth_management/features/authentication/login_resolution.go` —
  the post-credential `validateActiveUser` gate that defers
  account-state errors.

## Compliance traceability

- **SOC2_CC6.1** — logical access controls. Account-enumeration
  resistance is part of the authentication-control criterion.
- **ISO27001_A.9.4** — information access restriction.

## Related requirements

- [REQ-005 — Authorisation gates fail closed under transient errors](./REQ-005-authorisation-fails-closed.md) —
  the broader fail-closed posture this REQ is one instance of.

## References

- OWASP Authentication Cheat Sheet — "Authentication and Error
  Messages" section.
- May 2026 login-flow refactor commits.
