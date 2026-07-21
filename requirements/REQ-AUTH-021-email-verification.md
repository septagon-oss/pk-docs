---
id: REQ-AUTH-021
title: "Email verification consumes a hash-only proof through owner-guarded activation"
status: Active
date: 2026-07-18
slug: req-auth-021-email-verification
category: auth
ears_pattern: event-driven
priority: must
risk: high
verification_methods: [test, inspection]
compliance:
  - SOC2_CC6.1
  - ISO27001_A.9.2.2
  - OWASP_ASVS_2.5
satisfied_by:
  adr: [ADR-0006, ADR-0007, ADR-0009, ADR-0071]
  conventions: [C-04, C-20, C-21, C-14]
implements_cross_cutting: [REQ-001, REQ-003, REQ-004, REQ-005]
refines: REQ-AUTH-002
depends_on: [REQ-AUTH-020, REQ-USER-001]
type: doc
tags: [requirement, capability, auth_management, registration, email-verification, bearer, csrf]
module: auth_management
feature: registration
capability: verify_email
capability_kind: state_machine
stakeholders:
  - end-user (proving email ownership)
  - tenant administrator (account-validity policy)
  - security reviewer (bearer confidentiality and replay resistance)
  - compliance auditor (identity-proofing audit)
---

# REQ AUTH-021 — Email verification

Status: **Active** (2026-07-18)

## Statement

**When** registration issues an email-verification credential, the system
**shall** persist only a tenant-scoped SHA-256 digest of a 32-byte random
bearer and **shall** confine the raw value to the in-memory sensitive-delivery
attempt and browser confirmation form.

**When** a browser opens the emailed GET URL, the system **shall not** consume
the credential or mutate the account. **When** the recipient explicitly
submits the CSRF-protected confirmation POST, the system **shall** atomically
consume the exact unexpired digest and activate only the exact non-deleted,
pending, unverified user whose tenant and current canonical email still match
the verification record.

**If** any credential, transaction, tenant, user, email, status, lifecycle,
audit, or event predicate cannot be proved, the system **shall** fail closed
and **shall not** leave either the credential or user transition partially
committed.

## Rationale

The emailed URL is a bearer credential, not ordinary message content. Raw
database, notification, retry, template, log, admin, CRUD, or MCP persistence
would turn operational read access into account-activation authority. Digest-
only storage limits disclosure while still supporting exact lookup.

The verification record proves control of one email at one point in time. It
does not authorize reactivating a user who was later suspended, deleted,
verified, moved, or changed to another address. User management therefore owns
one exact compare-and-swap for the lifecycle transition; registration cannot
replace it with a cacheable read and generic partial update.

Link scanners open URLs automatically, so safe GET and explicit CSRF POST are
separate phases. Transactional credential consume, owner activation, audit,
and typed event publication make replay, races, and partial state observable
and deterministic.

## Acceptance criteria

- **AC-1 — Hash-only issuance.** A credential contains 32 cryptographically
  random bytes represented as 64 hexadecimal characters. Persistence contains
  only its 64-character SHA-256 digest, exact tenant, user, canonical email,
  expiry, and consumption state. Raw bearer material is absent from entity,
  JSON, UI, admin, CRUD, MCP, audit, event, log, metric, job, and notification
  persistence.
- **AC-2 — Sensitive delivery.** The verification email is dispatched as
  sensitive inline content with no durable raw body or template data. Every
  replacement credential uses a distinct delivery tracking identity so
  notification idempotency cannot return a prior completed send.
- **AC-3 — Scanner-safe confirmation.** GET `/verify-email?token=...` performs
  no service verification or account mutation. A shape-valid bearer renders a
  no-JavaScript POST form with the exact bearer, exact `/verify-email` action,
  and response-authoritative CSRF token. Invalid shape produces a generic
  terminal page without echoing the token.
- **AC-4 — CSRF and response hardening.** POST `/verify-email` remains covered
  by general CSRF middleware. Confirmation pages use `no-store`, suppress
  referrers, deny framing, and remove the bearer from URLs, logs, and terminal
  success or expected-failure responses.
- **AC-5 — Atomic single use.** Redemption conditionally consumes exactly one
  tenant-scoped, unexpired, unconsumed digest inside the ambient transaction.
  Concurrent redemption has exactly one activation and one durable event.
- **AC-6 — Uniform credential rejection.** Missing, malformed, unknown,
  expired, and already-consumed credentials produce typed internal outcomes
  and no activation. Browser failure copy does not disclose which predicate
  failed.
- **AC-7 — Owner-guarded activation.** User management activates through one
  durable compare-and-swap requiring exact tenant ID, user ID, case-folded
  canonical email, `pending` status, `email_verified=false`, and
  `deleted_at IS NULL`, inside the caller's exact ambient transaction.
- **AC-8 — Lifecycle changes fail closed.** Changed-email, active, inactive,
  suspended, deleted-status, soft-deleted, already-verified, wrong-tenant,
  cross-tenant, missing-user, and missing-transaction states do not mutate the
  user and roll verification consumption back.
- **AC-9 — Atomic audit and event.** Activation, verification consumption,
  audit intent, and the typed `user.email.verified` version `2.0.0` event commit
  together. A downstream event or audit failure rolls both state changes back.
- **AC-10 — One catalog authority.** Runtime event type, version, typed payload,
  module event registration, feature metadata, and generated catalog are
  projected from the same typed event contract. `user.email_verified` is not a
  compatibility alias.
- **AC-11 — Security-irreversible cutover.** The append-only migration
  invalidates pre-cutover pending bearers, hashes terminal history, constrains
  digest shape and uniqueness, drops the raw-token column, and refuses a down
  migration that would recreate bearer storage.
- **AC-12 — Single schema owner.** Registration is the only owner of
  `email_verifications`. Authentication must not declare, migrate, cache,
  auto-migrate, or generically serve an alternate raw-token model for the same
  table.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `pk-modules/auth_management/features/registration/verification_security_test.go::TestEmailVerificationDigestIsNotProjected` and `resend_verification_test.go::TestResendVerification_ReplacesTokenBeforeDispatch`. |
| AC-2 | Test | `pk-modules/auth_management/features/registration/resend_verification_test.go::TestResendVerificationUsesDistinctSensitiveDeliveryIntentPerCredential`. |
| AC-3 | Test | `pk-modules/auth_management/features/registration/register_user_browser_test.go::TestEmailVerificationBrowserFlowRequiresExplicitCSRFProtectedPost`. |
| AC-4 | Test | `pk-modules/auth_management/features/registration/register_user_browser_test.go::TestEmailVerificationBrowserFlowRequiresExplicitCSRFProtectedPost`; inspection of `register_user_pages.go::newEmailVerificationPageOutput` and `setEmailVerificationPageHeaders` covers both response paths. |
| AC-5 | Test | `pk-modules/auth_management/features/registration/verification_security_test.go::TestVerifyEmailConcurrentRedemptionHasOneActivationAndOneDurableEvent`. |
| AC-6 | Test | `pk-modules/auth_management/features/registration/req_auth_002_test.go::TestVerifyEmail_SingleUse_AndExpiry`, `verify_email_public_semantics_test.go::TestVerifyEmailPublicAPIUsesOneCredentialRejection`, `TestVerifyEmailPublicAPISanitizesOperationalFailure`, and `register_user_browser_test.go::TestEmailVerificationBrowserExpectedRejectionsAreUniformAndTerminal`. |
| AC-7 | Test | `pk-modules/user_management/features/user/email_verification_activation_store_test.go::TestEmailVerificationActivationStoreRequiresExactAmbientAuthority` and `TestEmailVerificationActivationStoreJoinsCallerRollback`. |
| AC-8 | Test | `pk-modules/user_management/features/user/email_verification_activation_store_test.go::TestEmailVerificationActivationStoreRejectsEveryStaleOrIneligibleState`. |
| AC-9 | Test | `pk-modules/auth_management/features/registration/verification_security_test.go::TestVerifyEmailRollsBackCredentialAndActivationWhenDurableEventFails`. |
| AC-10 | Test | `pk-modules/auth_management/features/registration/event_contract_test.go::TestEmailVerifiedEventContractIsCanonical` and `TestRegistrationFeatureProjectsEmailVerifiedContractWithoutDrift`. |
| AC-11 | Test | `pk-modules/auth_management/features/registration/verification_security_test.go::TestEmailVerificationDigestMigrationIsSecurityIrreversible`. |
| AC-12 | Test | `pk-modules/auth_management/features/authentication/legacy_email_verification_schema_test.go::TestAuthenticationFeatureCannotOwnEmailVerificationSchema`. |

## Edge cases and explicit limits

- **Case differences.** Activation compares `LOWER(TRIM(email))` with the
  canonical verification address while returning the owner row unchanged.
- **Transaction retries.** A failed downstream audit or event leaves the
  credential redeemable because its consume and the user activation roll back.
- **Email changes.** A credential for the old address cannot verify or activate
  the new address. A future email-change workflow must issue a new credential
  bound to the new canonical value.
- **Administrative recovery.** Verification is deliberately not an account-
  reactivation endpoint. Suspended, inactive, or deleted users require an
  explicit audited lifecycle decision.
- **Notification failure.** Sensitive content is not retained for generic
  retries. The user requests a fresh credential after the resend cooldown.

## Risk

- **Likelihood:** High — every email/password registration traverses this
  public bearer flow and scanners routinely prefetch links.
- **Impact:** Critical — bearer disclosure or stale-state activation can grant
  an attacker an active identity or reverse an administrator's suspension.
- **Mitigations:** Hash-only persistence (AC-1), scanner-safe CSRF confirmation
  (AC-3 and AC-4), atomic single use (AC-5), exact owner CAS (AC-7 and AC-8),
  and transactionally coupled audit/event state (AC-9).

## Implements (cross-cutting)

- **REQ-001 — Multi-tenant isolation.** Credential consume and user activation
  both require the exact request tenant and reject cross-tenant mode.
- **REQ-003 — No account enumeration.** Browser failure copy does not reveal
  unknown, expired, consumed, or ineligible account state.
- **REQ-004 — Audit per mutation.** One typed event and audit intent commit with
  every successful activation.
- **REQ-005 — Fail closed.** Storage, transaction, port, lifecycle, audit, and
  event uncertainty returns no activation.

## Compliance mapping

| Control | Coverage |
|---|---|
| SOC2 CC6.1 | AC-5 through AC-9 preserve verified identity and lifecycle authority. |
| ISO27001 A.9.2.2 | AC-7 and AC-8 enforce the formal provisioning transition. |
| OWASP ASVS 2.5 | AC-1 through AC-6 enforce bounded, single-use identity-proof credentials. |

## Satisfied by

- `pk-modules/auth_management/features/registration/register_user_service.go` — hash-only issuance and sensitive delivery.
- `pk-modules/auth_management/features/registration/register_user_pages.go` — scanner-safe CSRF browser confirmation.
- `pk-modules/auth_management/features/registration/verification_repository.go` — tenant-scoped conditional digest consume.
- `pk-modules/user_management/features/user/email_verification_activation_store.go` — exact owner-guarded activation compare-and-swap.
- `pk-modules/auth_management/migrations/022_hash_and_atomically_consume_email_verifications.up.sql` — security-irreversible cutover.
- `pk-modules/auth_management/contracts/events.go` — canonical typed event contract.

## Related requirements

- [REQ-AUTH-002 — Registration umbrella](./REQ-AUTH-002-registration.md)
- [REQ-AUTH-020 — Account create](./REQ-AUTH-020-account-create.md)
- [REQ-AUTH-024 — Resend verification](./REQ-AUTH-024-resend-verification.md)
- [REQ-USER-001 — User](./REQ-USER-001-user.md)
- [ADR 0071](../adr/0071-email-verification-uses-hash-only-proofs-and-owner-guarded-activation.md)
- [Convention C-21](../conventions.md#c-21-email-verification-bearers-are-hash-only-and-owner-guarded)
