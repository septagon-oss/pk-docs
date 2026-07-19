---
id: REQ-AUTH-024
title: "Resend verification replaces a pending token behind an opaque public response"
status: Active
date: 2026-07-15
slug: req-auth-024-resend-verification
category: auth
ears_pattern: event-driven
priority: must
risk: high
verification_methods: [test, inspection]
compliance:
  - SOC2_CC6.1
  - ISO27001_A.9.4
  - GDPR_Art_32
  - OWASP_ASVS_2.5
satisfied_by:
  adr: [ADR-0009, ADR-0071]
  conventions: [C-21, C-14]
implements_cross_cutting: [REQ-003]
refines: REQ-AUTH-002
depends_on: [REQ-AUTH-021, REQ-USER-001]
type: doc
tags: [requirement, capability, auth_management, registration, resend-verification, no-enumeration]
module: auth_management
feature: registration
capability: resend_verification
capability_kind: failure_mode
stakeholders:
  - end-user (recovering an expired or lost verification message)
  - security reviewer (account-enumeration resistance)
  - operator (notification and verification-store failure visibility)
---

# REQ AUTH-024 — Resend verification

Status: **Active** (2026-07-15)

## Statement

**When** an unauthenticated caller submits an email address to the resend
verification endpoint, the system **shall** atomically reserve the configured
cooldown (one minute by default) for the exact tenant and a SHA-256 digest of
the canonical email before account lookup or any state branch. The system
**shall** return the same opaque success response whether the address belongs
to an eligible pending account, an unknown account, an already-verified
account, or an account whose resend is cooldown-suppressed or encounters an
internal dependency failure.

**If** the address resolves to an unverified account, the system **shall**
invalidate that account's previous pending verification, generate a fresh
time-bounded random bearer, persist only its SHA-256 digest, and dispatch the
corresponding raw bearer to the canonical email stored on the account.
Invalidation and creation **shall** share one transaction. A failure to
invalidate or persist **shall** prevent dispatch. Operational failures remain
visible to the handler for logging but **shall not** alter the public response.

## Rationale

Resend verification is both an account-recovery operation and a public account
probe. Returning “already verified”, “user not found”, or a storage-specific
failure lets an attacker distinguish registered accounts and sometimes their
state. The response therefore acknowledges only that the request was accepted,
not that an account exists or an email was sent.

The cooldown is an authorization gate, not a performance hint. It executes
before lookup so known and unknown addresses consume the same abuse-control
budget, and atomic set-if-absent gives concurrent replicas one winner. Cache
outage or a wired cache without that atomic capability fails closed before
lookup, mutation, or delivery. Only a truly unwired single-replica composition
may use the bounded process-local locked fallback.

For an eligible account, replacement order is load-bearing. The old record is
invalidated before a new token is issued so a failure does not leave the caller
with two intentionally valid sequential tokens. The notification is dispatched
only after the replacement record exists, ensuring every delivered link refers
to persisted state. If dispatch itself fails, the persisted token remains safe
to replace on the next attempt; exposing that failure publicly would recreate
the account-existence oracle the opaque response prevents.

## Acceptance criteria

- **AC-1 — Opaque public response.** Eligible, unknown, already-verified,
  rate-limited, and internally failed service outcomes all produce the same
  handler success body and no public error; the endpoint therefore completes
  with its default HTTP 200 status for every service outcome.
- **AC-2 — Cooldown precedes account state.** The service reserves the exact
  tenant plus canonical-email-digest cooldown before user lookup. A suppressed
  request performs no lookup, verification mutation, or notification dispatch.
- **AC-3 — Atomic deployment-wide gate.** A wired cache must implement atomic
  set-if-absent with the configured TTL. Concurrent requests across the shared
  authority admit exactly one winner; cache error or unsupported capability
  fails closed. A bounded locked fallback is used only when no cache is wired.
- **AC-4 — Replacement order.** For an eligible unverified account,
  invalidation and creation share one transaction and dispatch occurs only
  after creation succeeds.
- **AC-5 — Fresh canonical delivery.** The replacement record contains the
  resolved account ID, canonical stored email, SHA-256 digest of a newly
  generated 32-byte random bearer, and an expiry at the configured
  `VerificationTokenTTL`. The notification goes to the canonical stored email
  and embeds the corresponding 64-character hexadecimal bearer, never the
  persisted digest.
- **AC-6 — Suppressed account states.** A portable not-found result, a nil lookup result,
  or an already-verified account returns an internal no-op success and performs
  no verification-record mutation or notification dispatch.
- **AC-7 — Invalidation failure.** If deletion of the previous verification
  record fails, the service returns a wrapped operational error and neither
  creates nor dispatches a replacement. The handler logs the failure and still
  returns the opaque public success response.
- **AC-8 — Persistence failure.** If creation of the replacement record fails,
  the service returns the operational error and does not dispatch a message.
  The handler logs the failure and still returns the opaque public success.
- **AC-9 — Delivery failure.** If notification dispatch fails after the record
  is persisted, the service returns the delivery error for operator visibility;
  the persisted token remains available for invalidation by a later resend, and
  the handler still returns the opaque public success.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `modules/platformkit-business-modules/auth_management/features/registration/resend_verification_test.go::TestResendVerificationHandler_ReturnsOpaqueSuccessForEveryServiceOutcome`. |
| AC-2 | Test | `modules/platformkit-business-modules/auth_management/features/registration/resend_verification_test.go::TestResendVerification_CooldownPrecedesLookupAndRotation` and `TestResendVerification_UnknownAccountStillClaimsCooldownBeforeLookup`. |
| AC-3 | Test | `modules/platformkit-business-modules/auth_management/features/registration/resend_verification_test.go::TestResendVerification_SharedCooldownHasOneConcurrentWinner`, `TestResendVerification_LocalFallbackHasOneConcurrentWinner`, `TestResendVerification_WiredCacheFailuresFailClosedBeforeLookup`, `TestResendVerification_SharedCooldownKeyContainsNoRawEmail`, and `TestResendVerification_MissingTenantFailsClosedBeforeLookup`. |
| AC-4 | Test | `modules/platformkit-business-modules/auth_management/features/registration/resend_verification_test.go::TestResendVerification_ReplacesTokenBeforeDispatch`. |
| AC-5 | Test | `modules/platformkit-business-modules/auth_management/features/registration/resend_verification_test.go::TestResendVerification_ReplacesTokenBeforeDispatch` and `TestResendVerificationUsesDistinctSensitiveDeliveryIntentPerCredential`. |
| AC-6 | Test | `modules/platformkit-business-modules/auth_management/features/registration/resend_verification_test.go::TestResendVerification_SuppressesUnknownAndVerifiedAccounts` and `TestResendVerification_PreservesLookupOutageForOperatorVisibility`. |
| AC-7 | Test | `modules/platformkit-business-modules/auth_management/features/registration/resend_verification_test.go::TestResendVerification_FailureOrdering` and `TestResendVerificationHandler_ReturnsOpaqueSuccessForEveryServiceOutcome`. |
| AC-8 | Test | `modules/platformkit-business-modules/auth_management/features/registration/resend_verification_test.go::TestResendVerification_FailureOrdering` and `TestResendVerificationHandler_ReturnsOpaqueSuccessForEveryServiceOutcome`. |
| AC-9 | Test | `modules/platformkit-business-modules/auth_management/features/registration/resend_verification_test.go::TestResendVerification_FailureOrdering` and `TestResendVerificationHandler_ReturnsOpaqueSuccessForEveryServiceOutcome`. |

## Edge cases and explicit limits

- **Concurrent resends.** Atomic cooldown acquisition admits one request before
  lookup or rotation. The admitted request also replaces the verification row
  inside the module mutation transaction.
- **Timing parity.** Response status and body are uniform, but an eligible
  account performs persistence and notification work that a suppressed account
  does not. Constant-time padding or durable asynchronous dispatch remains a
  separate hardening task under REQ-003; this requirement does not claim timing
  equality that the current notification boundary cannot prove.
- **Lookup errors.** `ports.ErrUserNotFound` is an opaque no-op; other lookup
  failures remain internally observable and still map to the same public 200.
- **Missing tenant.** The service cannot form cross-tenant-safe cooldown
  authority and fails closed before lookup; the handler preserves opacity.
- **Local fallback capacity.** A truly unwired single-replica composition uses
  a bounded process-local gate. Capacity exhaustion fails closed rather than
  evicting a live cooldown and admitting mail abuse.

## Risk

- **Likelihood:** High — the endpoint is public and accepts the primary account
  identifier directly.
- **Impact:** High — response differences disclose membership and account state;
  replacement-order failures can also strand users or send unusable links.
- **Mitigations:** Opaque response parity (AC-1 and AC-6), atomic pre-lookup
  cooldown (AC-2 and AC-3), fail-closed replacement ordering (AC-4, AC-7, and
  AC-8), and persisted-digest delivery coupling (AC-5 and AC-9).

## Implements (cross-cutting)

- **REQ-003 — No account enumeration.** AC-1 and AC-4 prevent response status,
  body, and error details from revealing whether an account exists or is
  already verified. The timing limitation is recorded explicitly above.

## Compliance mapping

| Control | Coverage |
|---|---|
| SOC2 CC6.1 | AC-2 through AC-7 preserve the email-identity proofing control during recovery. |
| ISO27001 A.9.4 | AC-1 and AC-4 prevent public account-state disclosure. |
| GDPR Art. 32 | AC-1 avoids exposing whether an email address is a platform data subject. |
| OWASP ASVS 2.5 | AC-2 and AC-3 preserve bounded verification-token issuance. |

## Satisfied by

- `modules/platformkit-business-modules/auth_management/features/registration/resend_verification.go` —
  the opaque handler and pre-lookup cooldown orchestration.
- `modules/platformkit-business-modules/auth_management/features/registration/resend_verification_cooldown.go` —
  tenant/email-digest atomic cooldown and bounded local fallback.
- `modules/platformkit-business-modules/auth_management/features/registration/register_user_service.go::sendVerificationEmail` —
  fresh bearer creation, digest persistence, TTL assignment, and sensitive
  notification dispatch.

## Related requirements

- [REQ-AUTH-002 — Registration umbrella](./REQ-AUTH-002-registration.md)
- [REQ-AUTH-021 — Email verification](./REQ-AUTH-021-email-verification.md) — the token-consumption contract this recovery path replenishes.
- [REQ-003 — No account enumeration](./REQ-003-no-account-enumeration.md) — the public response-opacity discipline.
- [REQ-USER-001 — User](./REQ-USER-001-user.md) — the canonical account record resolved before token replacement.
- [ADR 0071](../adr/0071-email-verification-uses-hash-only-proofs-and-owner-guarded-activation.md)
- [Convention C-21](../conventions.md#c-21-email-verification-bearers-are-hash-only-and-owner-guarded)
