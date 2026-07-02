---
id: REQ-AUTH-015
title: "Forgot-password initiates a recovery flow without disclosing whether an email is registered"
status: Proposed
date: 2026-05-08
slug: req-auth-015-forgot-password
category: auth
ears_pattern: event-driven
priority: must
risk: medium
verification_methods: [test, inspection]
compliance:
  - SOC2_CC6.1
  - ISO27001_A.9.4
  - GDPR_Art_32
  - OWASP_ASVS_2.6   # Authentication recovery
satisfied_by:
  adr: [ADR-0009]
  conventions: [C-04, C-14]
implements_cross_cutting: [REQ-003, REQ-004, REQ-014]
refines: REQ-AUTH-001
type: doc
tags: [requirement, capability, auth_management, authentication, password-reset, no-enumeration]
module: auth_management
feature: authentication
capability: forgot_password
capability_kind: failure_mode
stakeholders:
  - end-user (account holder who lost access)
  - operator (incident responder; spike-detection signal)
  - compliance auditor (account-recovery audit trail)
---

# REQ AUTH-015 — Forgot-password recovery initiation

Status: **Proposed** (2026-05-08)

## Statement

**When** a caller submits an email at the forgot-password
endpoint, the system **shall** return the same opaque success
response regardless of whether the email matches an existing
user. **If** the email matches an active user, the system
**shall** mint a single-use, time-bound recovery token and
dispatch a recovery email through the configured notification
channel. **If** the email does not match, the system **shall**
record the attempt for operator anomaly-detection but **shall
not** distinguish the response in shape, size, or timing.

## Rationale

The forgot-password endpoint is one of the two unauthenticated
account-existence probes (the other being login itself). The
classic enumeration attack: submit the endpoint twice, once
with a candidate email and once with a known-bogus email, and
infer membership from any visible difference. The defence is
total response-shape uniformity:

1. **Body uniform.** The "we sent you an email if it matched"
   message is identical across both branches.
2. **Status uniform.** Both branches return 200 OK.
3. **Timing approximately uniform.** Both branches do
   roughly the same amount of work (one DB lookup; the
   email-dispatch is asynchronous via the notification channel).
   Strict timing-attack hardening is constrained by what the
   stack can offer; the platform's documented goal is "within
   the noise floor of the network round-trip".

The audit-trail rationale is operational: a sudden spike of
forgot-password attempts against unknown emails is a
credential-recovery probing campaign, and the operator needs
that signal even though the user-facing response is opaque.

## Acceptance criteria

- **AC-1 — Uniform response on match.** A submission against
  an existing active user returns the success-shaped response
  AND mints a recovery token AND dispatches the email.
- **AC-2 — Uniform response on miss.** A submission against an
  unknown email returns the same success-shaped response AND
  records the attempt in the audit log AND does **not** dispatch
  any email or expose the email to any external system.
- **AC-3 — Single-use token.** A recovery token consumed once
  cannot be reused; the second redemption fails closed even
  within the TTL window.
- **AC-4 — Time-bound token.** A recovery token's TTL is
  bounded by `Config.VerificationTokenTTL`; consumption after
  the TTL fails closed and audits the expiry.
- **AC-5 — Rate-limit coupling.** Repeated submissions for the
  same email within the configured window are rate-limited via
  the same mechanism as login (REQ-AUTH-014); the user-facing
  response remains the opaque success shape, but the
  notification email is suppressed once the budget is
  exceeded so a single email can't be turned into a spam
  cannon.
- **AC-6 — Inactive / suspended account.** An email matching an
  inactive or suspended user does not dispatch a recovery
  email — the account is not recoverable through self-service —
  but the response shape stays uniform with the active-account
  branch.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Inspection | `modules/platformkit-business-modules/auth_management/features/authentication/forgot_password_test.go` (when present) — the happy-path mint-and-dispatch flow. *Note:* coverage gap if the test file is currently absent; reviewers verify the path manually until the test lands. _Verification gap: pending — cited evidence is prose / pattern / non-Go and cannot be auto-resolved._ |
| AC-2 | Inspection | Same harness — the unknown-email path returns the identical response. _Verification gap: pending — cited evidence is prose / pattern / non-Go and cannot be auto-resolved._ |
| AC-3 | Inspection | `forgot_password.go` token-redemption path; reviewers confirm the consumed-token marker is set and checked on subsequent redemptions. |
| AC-4 | Inspection | `forgot_password.go` TTL check against `Config.VerificationTokenTTL`. |
| AC-5 | Inspection | Reviewers verify the rate-limit hook is consulted at the same point the login flow consults it; counters share the same key namespace. |
| AC-6 | Inspection | Account-status check before the dispatch step; reviewers verify no email is dispatched for non-active accounts. |

## Edge cases & unhappy paths

- **Notification provider outage.** If the email channel is
  unreachable, the user-facing response is still the opaque
  success — the platform cannot distinguish "we tried and
  failed" from "we did not try" without leaking the existence
  signal. The failure is logged and surfaces in metrics so
  the operator can see the gap.
- **Tenant-deactivated branch.** A user whose tenant has been
  archived sees the opaque success but no email; recovery for
  archived-tenant users is operator-mediated.
- **Email-domain blocklist.** Submissions to disposable-email
  domains (when the configured blocklist is enabled) follow
  the same opaque-success shape; the dispatch is suppressed.
  This keeps the disposable-email policy from leaking via
  response timing.
- **Concurrent recovery.** Two simultaneous forgot-password
  submissions for the same account mint two tokens; either
  consuming the first invalidates the second to maintain the
  single-use semantic.

## Risk

- **Likelihood:** Medium — the endpoint is reachable
  unauthenticated and is regularly probed.
- **Impact:** High if the enumeration leak is present — every
  user's membership becomes externally observable. Lower
  impact for the recovery-email vector itself when MFA
  (REQ-AUTH-013) is configured.
- **Mitigations:** Response-shape uniformity (AC-1 + AC-2),
  rate-limit coupling (AC-5), single-use TTL-bound tokens
  (AC-3 + AC-4).

## Implements (cross-cutting)

- **REQ-003 — No account enumeration.** AC-1 + AC-2 are the
  runtime witnesses.
- **REQ-004 — Audit per mutation.** Every initiation, mint,
  consume, and miss is audited for operator anomaly-detection.
- **REQ-014 — Graceful degradation.** AC-5 — channel-outage
  failures degrade visibly rather than silently.

## Compliance mapping

| Control | Coverage |
|---|---|
| SOC2 CC6.1 | AC-3 + AC-4 — bounded recovery credential lifecycle. |
| ISO27001 A.9.4 | AC-1 + AC-2 — secure recovery procedure. |
| GDPR Art. 32 | AC-2 — no information about data-subject existence is leaked to unauthenticated callers. |
| OWASP ASVS 2.6 | AC-1..AC-6 — full coverage of the documented authentication-recovery requirements. |

## Satisfied by

- `modules/platformkit-business-modules/auth_management/features/authentication/forgot_password.go` —
  the token mint + dispatch orchestration.
- `modules/platformkit-business-modules/auth_management/features/authentication/login_service.go` —
  the recovery-flow integration with the user lookup helpers.

## Related requirements

- [REQ-AUTH-001 — Authentication umbrella](./REQ-AUTH-001-authentication.md)
- [REQ-AUTH-010 — Password login](./REQ-AUTH-010-login-credentials.md)
- [REQ-AUTH-014 — Login rate limit](./REQ-AUTH-014-login-rate-limit.md) — the bucket this REQ shares for AC-5.
- [REQ-AUTH-022 — Password reset](./REQ-AUTH-022-password-reset.md) — the post-recovery password-replacement step this flow leads into.
- [REQ-003 — No account enumeration](./REQ-003-no-account-enumeration.md) — the cross-cutting discipline this capability enacts.
