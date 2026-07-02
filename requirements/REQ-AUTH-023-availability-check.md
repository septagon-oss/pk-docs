---
id: REQ-AUTH-023
title: "Availability check returns a uniform-shape response so it cannot be used to enumerate accounts"
status: Proposed
date: 2026-05-08
slug: req-auth-023-availability-check
category: auth
ears_pattern: ubiquitous
priority: should
risk: high
verification_methods: [test, inspection]
compliance:
  - SOC2_CC6.1
  - GDPR_Art_32
  - OWASP_ASVS_3.2
satisfied_by:
  adr: [ADR-0009]
  conventions: [C-04, C-14]
implements_cross_cutting: [REQ-003]
refines: REQ-AUTH-002
type: doc
tags: [requirement, capability, auth_management, registration, availability]
module: auth_management
feature: registration
capability: check_availability
capability_kind: failure_mode
stakeholders:
  - end-user (UX feedback during signup)
  - tenant administrator (privacy posture)
  - compliance auditor (no-enumeration evidence)
---

# REQ AUTH-023 — Availability check

Status: **Proposed** (2026-05-08)

## Statement

The availability-check endpoint **shall** report whether a
candidate `email` or `username` can be used for a new
registration **without** unconditionally disclosing whether the
candidate value is already in use. The endpoint **shall** be
rate-limited per source so it cannot be turned into an
enumeration oracle, **shall** require the candidate value to
match the same validation rules the registration endpoint
applies (so an attacker cannot probe with malformed input to
side-channel the database), and **shall** record sufficient
audit signal that an operator can detect bulk probing.

## Rationale

A naive "is this username taken?" endpoint becomes a perfect
enumeration tool — submit candidate emails until the response
flips, and the membership of the platform is fully readable.
The platform's documented pattern: provide UX-grade
"availability" feedback to legitimate signup forms (the
Captcha-protected, rate-limited surface) while denying that
same feedback to bulk-probing attackers.

The implementation balance:

1. **For legitimate signup flows** (low rate, single check),
   the endpoint returns the truth so the form can show "this
   username is already taken — try another".
2. **For bulk probing**, the rate-limiter kicks in and
   subsequent responses return a uniform "unavailable" shape
   that does not actually disclose the database state.

This means the endpoint's contract is "best-effort
availability hint within the configured budget; uniform
opacity beyond it" — the same shape that defends REQ-003
without crippling the UX.

## Acceptance criteria

- **AC-1 — Truthful response within budget.** A submission
  within the per-source rate-limit window returns the actual
  availability state for the candidate value.
- **AC-2 — Opaque response beyond budget.** A submission
  beyond the per-source rate-limit returns a uniform
  "unavailable" response shape — neither true availability
  nor a typed rate-limit error that would itself be a
  side-channel signal.
- **AC-3 — Validation parity.** The endpoint applies the
  same email-format and username-format validation as the
  registration endpoint; malformed candidates return the
  same typed validation errors so the validation surface
  cannot be probed independently.
- **AC-4 — Audit-only enumeration detection.** Repeated
  availability checks against many distinct candidates from
  the same source emit operator-grade audit signal
  (`auth.registration.availability_probed`) so a probing
  campaign is observable.
- **AC-5 — Rate-limit-bucket parity.** The bucket the
  availability endpoint consults shares its key namespace
  with the registration rate-limit (REQ-AUTH-014's
  mechanism, registration scope) so an attacker cannot
  evade it by interleaving check + register requests.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Inspection | `check_availability.go` — the truthful-response branch when the rate-limit budget is non-exhausted. |
| AC-2 | Inspection | `check_availability.go` — the budget-exceeded branch returns the uniform shape. |
| AC-3 | Inspection | `register_user_form.go::registrationErrorMessage` — shared validation discipline; reviewers verify the availability handler uses the same primitives. |
| AC-4 | Inspection | Audit-event emission verified at the handler boundary. |
| AC-5 | Inspection | Both paths derive the bucket key from `(source, namespace="registration")`; reviewers verify the shared constant. |

## Edge cases & unhappy paths

- **Empty input.** Empty `email` or `username` returns the
  validation error from AC-3.
- **Tenant-bound vs platform-wide uniqueness.** Email is
  unique platform-wide; username uniqueness is per-tenant.
  The availability check honours that scope so a candidate
  username already taken in another tenant returns
  "available" within the requesting tenant.
- **Disposable-email domains.** Optional blocklist
  integration returns "unavailable" without consulting the
  database (the candidate would not be registrable anyway);
  this gives the UX the right answer at the cost of a
  small information leak about the blocklist contents,
  which the platform accepts as a tradeoff.
- **Caching.** The endpoint is not cached at the CDN/edge
  layer to avoid leaking historical responses; the
  per-source bucket is the only memoisation.

## Risk

- **Likelihood:** High — public, frequently abused as an
  enumeration vector.
- **Impact:** High when defective — full membership leak.
- **Mitigations:** Per-source rate-limit (AC-2 + AC-5),
  validation parity (AC-3), audit-only signal for probing
  detection (AC-4).

## Implements (cross-cutting)

- **REQ-003 — No account enumeration.** AC-2 + AC-5 are the
  runtime witnesses; AC-4 instruments the bypass-attempt
  signal for operator response.

## Compliance mapping

| Control | Coverage |
|---|---|
| SOC2 CC6.1 | AC-2 — restricting the membership signal beyond legitimate-use volume. |
| GDPR Art. 32 | AC-2 — no data-subject-existence signal at scale. |
| OWASP ASVS 3.2 | AC-2 + AC-5 — anti-automation discipline at the availability surface. |

## Satisfied by

- `modules/platformkit-business-modules/auth_management/features/registration/check_availability.go` —
  the availability handler.
- `modules/platformkit-business-modules/auth_management/features/registration/register_user_rate_limit.go` —
  the shared bucket.

## Related requirements

- [REQ-AUTH-002 — Registration umbrella](./REQ-AUTH-002-registration.md)
- [REQ-AUTH-020 — Account create](./REQ-AUTH-020-account-create.md) — the path with the actual create-vs-fail signal.
- [REQ-AUTH-014 — Login rate limit](./REQ-AUTH-014-login-rate-limit.md) — the cousin throttle on the login surface.
- [REQ-003 — No account enumeration](./REQ-003-no-account-enumeration.md) — the cross-cutting discipline this capability instruments.
