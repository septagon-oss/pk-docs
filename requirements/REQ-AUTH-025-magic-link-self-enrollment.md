---
id: REQ-AUTH-025
title: "Magic-link confirmation self-enrolls an existing active identity only under explicit tenant admission policy"
status: Active
date: 2026-07-17
slug: req-auth-025-magic-link-self-enrollment
category: auth
ears_pattern: optional
priority: must
risk: critical
verification_methods: [test, analysis, inspection]
compliance:
  - SOC2_CC6.1
  - SOC2_CC6.7
  - ISO27001_A.9.4
  - GDPR_Art_32
satisfied_by:
  adr: [ADR-0007, ADR-0009, ADR-0070]
  conventions: [C-04, C-20, C-14]
implements_cross_cutting: [REQ-001, REQ-003, REQ-004, REQ-005, REQ-007]
refines: REQ-AUTH-001
depends_on: [REQ-AUTH-010, REQ-TENANT-020, REQ-USER-001]
type: doc
tags: [requirement, capability, auth_management, authentication, magic-link, self-enrollment, tenant-admission, guest]
module: auth_management
feature: authentication
capability: magic_link_self_enrollment
capability_kind: inter_module_contract
stakeholders:
  - end-user (existing account holder joining an opted-in tenant)
  - tenant administrator (admission-policy owner)
  - security reviewer (cross-tenant and least-privilege enforcement)
  - operator (authentication and membership incident responder)
  - compliance auditor (logical-access evidence consumer)
---

# REQ AUTH-025 — Magic-link tenant self-enrollment

Status: **Active** (2026-07-17)

## Statement

**Where** an active tenant is addressed through its authoritative host alias,
**when** an existing active identity confirms a pending magic-link token bound
to that exact identity and tenant, the system **shall** authenticate only when
tenant management proves an existing active membership with a recognized role,
or creates an active `guest` membership because no membership exists and the
tenant explicitly sets its canonical `magic_link_self_enrollment` metadata
value to `true`.

The explicit opt-in governs only the absent-membership enrollment branch. An
existing active owner, administrator, member, or guest may authenticate without
that flag; its membership and role remain unchanged. The typed admission result
**shall** distinguish a guest created by this request from a pre-existing valid
membership, and authentication **shall** derive any guest account-kind claim
from durable membership state before atomically consuming the token and issuing
the tenant-bound session.

For an identity with two-factor authentication enabled, mailbox control alone
is not sufficient. The identity **shall** complete a valid TOTP or recovery-code
challenge before tenant admission, login-token consumption, or session issuance.
Required or invalid second-factor input leaves the login token pending and
creates no membership and writes no session, audit, or auth-outbox state;
second-factor dependency failures remain distinguishable operational errors
rather than invalid-link denials.

The explicit browser confirmation **shall** also prove continuity with the
browser that rendered the scanner-safe landing page. A separate 256-bit
confirmation nonce **shall** be validated before token lookup or authentication
work, retained through any local-MFA form, and cleared on successful completion
or terminal denial. Mailbox-token validity alone does not authorize a
cross-browser confirmation POST.

For every invalid identity, inactive or removed membership, token, tenant, or
tenancy-resolution state, the system **shall** fail closed without creating or
reactivating membership and without minting a session. Tenant opt-out denies an
identity only when membership is absent. An unknown identity **shall not** be
created or enrolled by the public link-request path, and the public request
response **shall not** disclose whether the identity exists.

This requirement's opt-in exception applies only to passwordless magic-link
confirmation. Verified interactive-provider admission is governed separately
by REQ-AUTH-026 and its independent
`interactive_provider_self_enrollment` flag. Password, tenant override, and
all other authentication flows continue to require active tenant membership.

## Rationale

A magic link proves control of a mailbox, but mailbox control alone is not
authority to join every tenant using the platform. Host resolution proves which
tenant received the request, while the tenant-owned metadata flag expresses
whether that tenant accepts this enrollment mode. Requiring both facts prevents
a routable hostname from silently becoming an open-registration policy.

The newly admitted principal must be least-privileged in authorization as well
as in the tenant-members table. Persisting `Role=guest` without carrying the
durably re-read guest account-kind into the signed session would produce a
roleless authenticated principal. Downstream applications could then mistake
that principal for a normal member and bypass controls that deny guests access
to purchasing, finalization, administration, or other privileged actions.

The capability crosses two module-owned state machines. Authentication owns
identity proof, coalesced credential issuance, compare-and-swap consumption,
second-factor verification, and session issuance. Tenant management owns
admission policy, membership state, and the durable `tenant.member.added` event.
ADR-0009 keeps that collaboration behind a narrow typed port; ADR-0007 requires
the new membership and its outbox event to commit atomically. Neither module may
reach into the other's repositories.

The raw emailed URL is a bearer credential, not notification content that may
be retained for later work. It must take the sensitive inline-delivery path so
only redacted intent is durable and no tenant template, scheduler, retry replay,
or log can retain the credential.

## Acceptance criteria

- **AC-1 — Existing verified active identity only.** A magic-link request for
  an unknown email returns the same outward acceptance response as a known
  email but creates no user, login token, membership, session, or notification.
  Issuance accepts only a bare syntactically valid address and requires exactly
  one case-insensitive exact platform-identity match; cross-tenant or
  case-variant ambiguity fails closed without selecting an arbitrary user.
  Confirmation proceeds only when the token's stored user ID and canonical
  email match that existing active user. Inactive, suspended, pending, deleted,
  mismatched, ambiguous, or missing users are denied before any membership
  mutation or token consumption. For a syntactically valid address, lookup,
  token coalescing, and provider delivery run only after a bounded ephemeral
  handoff; the public response does not wait for account-dependent work, and
  saturation is outwardly indistinguishable from admission.
- **AC-2 — Exact tenant and authoritative host binding.** The pending token
  carries the target tenant ID. Confirmation requires the request to resolve to
  that same tenant with `resolution_source=host_alias` from authoritative tenant
  middleware, including for a pre-existing member. A different tenant or an
  unbound host is rendered as the generic invalid-link page with HTTP 200 so it
  cannot become a tenant-binding oracle. A request that names the same tenant
  through a header, query, cookie, caller override, default tenant, or other
  non-authoritative source is a policy denial with HTTP 403. Neither path may
  consume the token, create membership, or issue a session.
- **AC-3 — Explicit absent-member opt-in, default-deny.** When membership is
  absent, self-enrollment requires the active tenant's canonical
  `magic_link_self_enrollment` metadata value to be semantically `true`. A
  missing key, `false`, malformed value, unavailable tenant, inactive tenant,
  or failed canonical read is denied. Before inserting a guest, the tenant-owned
  admission service re-reads `status` and `metadata` from the canonical tenant
  row under a PostgreSQL shared row lock inside the same membership mutation;
  it may not fall back to a non-transactional read, and request-projected
  metadata is never policy truth. The lock is held through guest insertion and
  transactional outbox publication. The flag and policy lock are bypassed for
  an already-active membership: a valid owner, administrator, member, or guest
  may authenticate when the flag is missing or false, with no role promotion,
  demotion, or other membership mutation.
- **AC-4 — Absent membership becomes an atomic guest admission.** When no live
  or removed membership exists, tenant management creates exactly one active
  membership with role `guest` and a join timestamp. The membership write and
  one durable `tenant.member.added` outbox event commit in the same transaction;
  a failed write or event publication commits neither, and an idempotent race
  does not emit a duplicate event. The typed admission result reports
  `Created=true` and durable role `guest` only to the caller that inserted the
  row; it reports `Created=false` with the actual durable role for a
  pre-existing membership or a concurrent winner.
- **AC-5 — Existing membership state is never upgraded or reactivated.** An
  active membership with a recognized owner, administrator, member, or guest
  role succeeds without changing its role and returns `Created=false`. An
  invited, suspended, removed/soft-deleted, or unknown-status or unknown-role
  membership returns a typed policy denial and remains byte-for-byte unchanged.
  A uniqueness collision is re-read and evaluated under the same
  preserve-or-deny rule; authentication uses the typed result rather than a
  stale preflight assumption to decide whether this request created a guest.
- **AC-6 — Durable guest account-kind is mandatory.** Authentication re-reads
  the active role through the tenant-owned port. When the admission result says
  `Created=true`, both that result and the re-read must prove role `guest`; the
  authentication result and signed access token then contain the canonical
  `guest` account-kind claim. A pre-existing durable guest receives the same
  claim on login and refresh. Tenant owner, administrator, and member roles are
  membership authorization data and are not promoted into authentication RBAC
  claims. If the durable read cannot prove the required active membership, no
  session or token is issued.
- **AC-7 — Denials are non-burning and do not create an oracle.** After exact
  tenant binding, absent-member tenant opt-out, inactive tenant, same-tenant
  non-authoritative resolution, and invited, suspended, removed, or invalid-role
  membership map to the same public HTTP 403 policy-denial shape. Tenant
  mismatch or an unbound host instead maps to the generic invalid-link HTTP 200
  page defined by AC-2. The pending login token remains unconsumed, no session
  is written, and no membership mutation or admission event occurs. Internal
  storage or dependency failures remain operationally distinguishable in logs,
  metrics, and a 5xx response while also leaving the token unconsumed and
  minting no session.
- **AC-8 — Optimistic single use and coalesced issuance.** Repeated or
  concurrent requests for the same tenant, user, and purpose reuse one
  deterministic, reconstructible active bearer while creating a distinct
  delivery-tracking UUID for every immediate send. Every reordered email
  therefore carries the same valid link, and an unauthenticated resend cannot
  invalidate an earlier delivery. The persisted token row contains the bearer
  hash and non-secret binding fields from which the raw bearer is reconstructed
  in memory for delivery; the raw bearer itself is never stored. A new
  credential is created only when no active row exists or after an expired or
  non-reconstructible prior-format claimant is compare-and-swap retired with its
  version guard. Failed or non-converging retirement creates no replacement.
  V1 derivation requires at least 32 bytes of key material and binds the token
  ID, tenant, user, purpose, and expiry. Redemption reconstructs that binding
  from the selected row and compares the complete bearer in constant time;
  mutating a bound field or rotating the derivation key invalidates the
  outstanding link rather than silently retaining its authority.
  Successful confirmation consumes the selected token with the same optimistic
  guard, backed by a database invariant permitting at most one pending row for
  the tuple. Concurrent confirmations cannot both consume it or mint sessions,
  and any stale, expired, already-consumed, or wrong-purpose token fails closed.
- **AC-9 — Auth mutation is atomic and identity-safe.** Before entering the
  auth mutation, confirmation validates the token, exact identity binding,
  active account, tenant binding, any enabled second factor, tenant admission
  policy, durable membership, and any required guest account-kind. Token
  compare-and-swap consumption and session, audit, and auth-outbox issuance then
  occur in one auth-owned mutation transaction. Session persistence,
  audit/outbox publication, or final durable guest revalidation failure rolls
  back token consumption and every auth write; no caller can observe a consumed
  link without its successfully issued session.
- **AC-10 — Exception isolation.** Magic-link confirmation calls the typed
  least-privilege capability with method `magic_link`. Password authentication,
  password reset, caller-selected tenant flows, and tenant switching retain
  REQ-AUTH-010's active-membership requirement. Interactive-provider login is
  governed by REQ-AUTH-026 and method `interactive_provider`; neither method
  can inherit the other's tenant opt-in through shared resolution.
- **AC-11 — Emailed bearer-secret delivery and presentation.** A raw bearer URL
  destined for email is generated only for immediate sensitive inline delivery.
  The provider receives the original envelope only for that in-memory attempt.
  Durable state and lifecycle events replace its subject, text, and HTML with
  stable redactions; clear template data, attachments, custom headers, tags, and
  arbitrary metadata; and retain only the service-owned retention marker plus
  the routing envelope required to deliver and audit the attempt. Provider
  errors are treated as untrusted and cannot reflect the bearer into persistence
  or caller logs. Sensitive delivery cannot be scheduled or replayed from a
  failed or stale durable record.
  Browser pages carrying the token set no-store, no-referrer, and content-type
  hardening headers.
- **AC-12 — Second factor precedes every magic-link mutation.** When the exact
  active identity has two-factor authentication enabled, confirmation requires
  a valid TOTP or recovery code after mailbox proof but before tenant admission,
  login-token consumption, membership creation, or session, audit, and auth
  outbox writes. A missing factor renders the explicit second-factor challenge;
  a missing or invalid factor leaves the login token pending and creates no
  membership, session, audit, or auth-outbox state. A valid factor permits the
  ordinary admission and atomic authentication flow, and the persisted session
  records MFA-verified assurance without weakening any AC above.
  Second-factor store or verification failures remain distinguishable 5xx
  operational errors, also without consuming the token or issuing a session.
- **AC-13 — Browser-bound explicit confirmation.** A valid, non-mutating GET
  generates a cryptographically random 256-bit confirmation nonce and returns
  it as both a hidden form field and a host-only `HttpOnly` cookie scoped to
  `/login/link`, with `Max-Age=900`, `SameSite=Lax`, and `Secure` for direct or
  forwarded HTTPS. The POST validates both nonce shapes and their constant-time
  equality before token lookup, identity resolution, tenant admission,
  consumption, or session mutation. When present, `Origin` must equal the
  request origin and `Sec-Fetch-Site` must be `same-origin`; duplicate,
  missing, malformed, mismatched, or hostile proof fails closed. A local-MFA
  challenge retains the same confirmation pair. Success and terminal denial
  clear the cookie, and every landing or confirmation response is non-cacheable,
  suppresses referrers, and denies framing.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `modules/platformkit-business-modules/auth_management/features/authentication/login_link_service_test.go::TestRequestLinkIsUniformForUnknownEmail`, `login_link_handoff_test.go::TestRequestLinkReturnsBeforeKnownAndUnknownAccountDependentWork`, `TestDefaultLoginLinkHandoffLimitsExecutionToTwoWorkers`, `TestBoundedLoginLinkHandoffRejectsSaturationWithoutRunningWork`, `login_link_membership_test.go::TestAuthenticateWithTokenRejectsInactiveUserBeforeProvisioning`, and `login_link_membership_test.go::TestAuthenticateWithTokenRejectsTokenUserEmailMismatchBeforeWrites`. |
| AC-2 | Test | `modules/platformkit-business-modules/auth_management/features/authentication/login_link_membership_test.go::TestMagicLinkTenantAdmissionRequiresAuthoritativeHostAlias`, `TestAuthenticateWithTokenDeniesAuthorizedMemberFromNonAuthoritativeTenantSource`, `TestAuthenticateWithTokenCrossHostMismatchDoesNotWrite`, and `TestAuthenticateWithTokenRejectsTenantBoundTokenOnUnboundHost`; `login_link.go::HandleMagicLinkConfirmRaw` verifies the invalid-link 200 versus policy-denial 403 mapping. |
| AC-3 | Test | `modules/platformkit-business-modules/tenant_management/features/tenant_lifecycle/service_membership_provisioner_test.go::TestEnsureLeastPrivilegeActiveMembershipRequiresTenantOptIn`, `TestEnsureLeastPrivilegeActiveMembershipLocksPolicyBeforeCreate`, `TestEnsureLeastPrivilegeActiveMembershipRevalidatesPolicyInsideMutation`, and `TestEnsureLeastPrivilegeActiveMembershipPreservesActiveRole`; `tenant_membership_admission_policy_repository_test.go::TestTenantMembershipAdmissionPolicyRepositoryRequiresAmbientTransaction` and `TestTenantMembershipAdmissionPolicyRepositoryUsesPostgresShareLock` prove the canonical policy read requires the active mutation and emits PostgreSQL `FOR SHARE`. |
| AC-4 | Test | `modules/platformkit-business-modules/tenant_management/features/tenant_lifecycle/service_membership_provisioner_test.go::TestEnsureLeastPrivilegeActiveMembershipCreatesGuestAndEmitsEvent`, `TestEnsureLeastPrivilegeActiveMembershipRechecksDuplicateRace`, `TestEnsureLeastPrivilegeActiveMembershipFailsClosedWithoutTransactionalPublisher`, and `TestPublishTenantEventUsesActiveMutationTransaction`. |
| AC-5 | Test | `modules/platformkit-business-modules/tenant_management/features/tenant_lifecycle/service_membership_provisioner_test.go::TestEnsureLeastPrivilegeActiveMembershipPreservesActiveRole`, `TestEnsureLeastPrivilegeActiveMembershipDeniesActiveUnknownRole`, `TestEnsureLeastPrivilegeActiveMembershipDeniesInactiveMembershipWithoutMutation`, `TestEnsureLeastPrivilegeActiveMembershipDeniesRemovedMember`, `TestEnsureLeastPrivilegeActiveMembershipRechecksDuplicateRace`, and `TestEnsureLeastPrivilegeActiveMembershipDeniesInactiveDuplicateWinner`. |
| AC-6 | Test | `modules/platformkit-business-modules/tenant_management/features/tenant_lifecycle/service_membership_provisioner_test.go::TestResolveActiveMembershipRoleReturnsDurableGuestMarker`; `modules/platformkit-business-modules/auth_management/features/authentication/login_link_membership_test.go::TestAuthenticateWithTokenOrdersPeekValidateProvisionConsumeAndSession`, `TestCompleteAuthenticationRehydratesGuestFromDurableMembership`, `TestCompleteAuthenticationDoesNotPromoteTenantAdministrativeRoleIntoRBACClaims`, and `TestRefreshAccessTokenPreservesDurableGuestClaim`. |
| AC-7 | Test | `modules/platformkit-business-modules/auth_management/features/authentication/login_link_membership_test.go::TestHandleMagicLinkConfirmRawMembershipDenialReturnsForbidden`, `TestAuthenticateWithTokenCrossHostMismatchDoesNotWrite`, `TestAuthenticateWithTokenRejectsTenantBoundTokenOnUnboundHost`, and `TestAuthenticateWithTokenProvisioningFailureLeavesTokenPending`; handler inspection verifies operational errors remain 5xx. |
| AC-8 | Test | `modules/platformkit-business-modules/auth_management/features/authentication/login_link_service_test.go::TestConsumeTokenIsSingleUseAndPurposeScoped`, `TestRequestLinkThrottleAndCoalescing`, `TestRequestLinkResendUsesTokenUniqueDeliveryKey`, and `TestRequestLinkCoalescingPreservesFirstReturnURL`; `login_link_supersession_test.go::TestConcurrentRequestLinkDeliveriesCoalesceOnUniqueIndexWinner`, `TestLoginLinkV1BearerIsDeterministicAndBoundToPersistedSecurityFields`, `TestLoginLinkV1BearerRejectsMissingOrWeakDerivationSecret`, `TestLoginLinkV1RedemptionRequiresCurrentKeyAndUnmodifiedRowBinding`, `TestRequestLinkCASRetiresNonReconstructibleLegacyCredential`, `TestRequestLinkCASRetiresExpiredUniqueIndexClaimant`, `TestRequestLinkFailsClosedWhenLegacyCASDoesNotConverge`, and `TestRequestLinkPreservesOperationalLegacyCASFailure`; `login_link_membership_test.go::TestConsumeTokenCASConflictIsInvalidAndLeavesTokenPending` and migration `015_enforce_single_pending_login_token.up.sql` verify the consume/database invariant. |
| AC-9 | Test | `modules/platformkit-business-modules/auth_management/features/authentication/login_link_membership_test.go::TestAuthenticateWithTokenOrdersPeekValidateProvisionConsumeAndSession`, `TestAuthenticateWithTokenFinalGuestRevalidationRollsBackOnRoleDrift`, `TestAuthenticateWithTokenSessionFailureRollsBackTokenConsumption`, `TestAuthenticateWithTokenRejectsInactiveUserBeforeProvisioning`, and `TestAuthenticateWithTokenProvisioningFailureLeavesTokenPending`. |
| AC-10 | Analysis | `modules/platformkit-business-modules/auth_management/features/authentication/login_link_service.go` and import-boundary conformance verify that only magic-link confirmation reaches the typed enrollment port and no implementation package crosses the auth/tenant boundary. |
| AC-11 | Test | `modules/platformkit-business-modules/auth_management/features/authentication/login_link_service_test.go::TestRequestLinkResendUsesTokenUniqueDeliveryKey`, `modules/platformkit-business-modules/notification_management/features/email_notifications/sensitive_delivery_test.go::TestSendEmailSensitiveContentDeliversFromMemoryAndPersistsRedaction`, `TestSendEmailSensitiveContentRejectsDeferredOrTemplateInputs`, `TestSendEmailSensitiveTrackedIntentCannotRetryRedactedContent`, and `auth_management/features/authentication/login_link_membership_test.go::TestMagicLinkLandingUsesBearerSecretResponseHeaders`; the poison regression checks persisted rows and lifecycle events across subject, body, HTML, attachments, headers, tags, metadata, and provider-reflected errors, while inspection verifies no raw-link logging call exists. |
| AC-12 | Test | `modules/platformkit-business-modules/auth_management/features/authentication/login_link_mfa_test.go::TestAuthenticateWithTokenRequiresSecondFactorBeforeAdmission`, `TestAuthenticateWithTokenRejectsInvalidSecondFactorWithoutWrites`, `TestAuthenticateWithTokenAcceptsValidTOTPAndPersistsMFAAssurance`, `TestAuthenticateWithTokenAcceptsRecoveryCodeAndPersistsMFAAssurance`, `TestAuthenticateWithTokenPreservesOperationalSecondFactorFailure`, `TestAuthenticateWithTokenFailsClosedWithoutEnabledSecondFactorService`, and `TestHandleMagicLinkConfirmRawRendersSecondFactorChallengeWithoutSession`; `login_mfa_rate_limit_test.go::TestAuthenticateSubmittedInvalidSecondFactorRecordsFailure`, `TestAuthenticateSecondFactorChallengeAppliesCanonicalRateLimit`, and `TestAuthenticateSecondFactorChallengeRejectsWhenRateLimited` verify the shared password/MFA limiter convention; inspection verifies the handler forwards both factor fields and verification precedes `ensureMagicLinkTenantAdmission` and the auth mutation. |
| AC-13 | Test | `modules/platformkit-business-modules/auth_management/features/authentication/login_link_confirmation_test.go::TestMagicLinkLandingCreatesHostOnlyBrowserConfirmationAndDoesNotConsumeToken`, with secure-cookie, session-swap, origin, nonce, and MFA-continuation cases covering the browser binding. |

## Edge cases and explicit limits

- **Removed-member tombstone.** A soft-deleted membership is evidence of an
  explicit removal, not absence. It is denied with the same public 403 as other
  policy denials and is never recreated or reactivated by self-enrollment.
- **Privileged active member.** Reconfirming a magic link for an active owner,
  administrator, or member is authentication, not reprovisioning. The existing
  role is preserved even when self-enrollment is disabled; the least-privilege
  path never downgrades, upgrades, or copies that tenant role into auth RBAC
  claims.
- **Concurrent first confirmation.** Two confirmations may both prove the same
  token before one wins its compare-and-swap. Membership creation remains
  idempotent and emits at most one event. The typed admission result identifies
  the actual creator, so a pre-existing or concurrent active winner is not
  mistaken for a guest created by the current request. Only the
  token-consumption winner may mint a session. A safe membership created by the
  losing request is not rolled back across module boundaries.
- **Admission succeeds but token CAS loses.** Membership plus its outbox event
  is one tenant-owned transaction; token consumption plus session, audit, and
  auth-outbox issuance is a separate, single auth-owned transaction. This
  requirement does not claim a distributed transaction across those boundaries.
  A CAS loser mints no session; a downstream auth-issuance failure rolls the
  token consumption back so the still-pending token remains retryable.
- **Dependency outage.** An unavailable tenant, membership store, transactional
  publisher, or durable membership-role read fails closed. Operators receive
  structured error telemetry; the public flow never converts dependency
  unavailability into implicit enrollment.
- **Second-factor challenge.** For an MFA-enabled identity, the first explicit
  confirmation may transition only to a TOTP/recovery-code form. Missing or
  invalid input does not consume the mailbox token, provision membership, set a
  session cookie, or emit session audit/outbox records. The same still-pending
  token may be submitted with a valid factor; an MFA-store outage remains a 5xx
  operational failure rather than an expired-link response.
- **One-time factor survives downstream failure.** An accepted TOTP window or
  recovery code is consumed as security evidence before tenant admission. If a
  later tenant or auth mutation fails, no membership or session is minted and
  the mailbox token remains retryable, but that factor is deliberately not made
  replayable again. The user supplies a fresh TOTP window or another recovery
  code on retry; reversing this safely would require a cross-module reservation
  protocol rather than weakening the replay guard.
- **Mail scanners and link previews.** A GET may render a confirmation page but
  cannot enroll, consume, or mint a session. Only the explicit confirmation
  mutation may advance the flow. The page forbids caching and referrer leakage.
- **Notification retry.** A sensitive-link send may retain only a redacted
  terminal or failed intent. A retry worker cannot reconstruct or replay the raw
  bearer URL; the caller must perform a new immediate delivery request, which
  may reconstruct the same still-active credential but always creates a fresh
  delivery intent.
- **Unknown email.** This capability never creates a platform identity. New-user
  registration remains owned by the registration feature; the magic-link
  request retains its non-enumerating response and sends no message for an
  unknown address.

## Risk

- **Likelihood:** High — the flow is public, passwordless, and reachable on
  every tenant hostname that exposes authentication.
- **Impact:** Critical — an implicit open-enrollment policy or roleless session
  can cross tenant boundaries and bypass guest-specific restrictions.
- **Mitigations:** Exact tenant-bound proof (AC-1 and AC-2), explicit default-deny
  policy (AC-3), atomic least-privilege membership (AC-4 and AC-5), durable guest
  classification (AC-6), non-burning uniform denial (AC-7), and optimistic token
  discipline (AC-8 and AC-9), plus bearer-secret delivery controls (AC-11) and
  mandatory second-factor verification when enabled (AC-12), with browser-bound
  explicit confirmation before token lookup (AC-13).

## Implements (cross-cutting)

- **REQ-001 — Multi-tenant isolation.** AC-2 and AC-3 require the exact
  authoritative tenant context and tenant-owned admission policy before any
  membership or session is created.
- **REQ-003 — No account enumeration.** AC-1 keeps unknown and known identity
  request responses outwardly uniform and creates no external side effect for
  an unknown identity.
- **REQ-004 — Audit per mutation.** AC-4 couples each created membership to one
  durable, transactional `tenant.member.added` event.
- **REQ-005 — Authorisation fails closed.** AC-3, AC-5, AC-6, and AC-7 deny on
  missing policy, inactive state, ambiguous membership, or unavailable proof.
- **REQ-007 — Explicit cross-tenant access.** AC-2 and AC-10 constrain the
  pre-session identity lookup and tenant-owned enrollment call to the exact
  token tenant without granting a general cross-tenant authentication bypass.

## Compliance mapping

| Control | Coverage |
|---|---|
| SOC2 CC6.1 | AC-1 through AC-7 prove that only a verified active identity admitted by explicit tenant policy receives logical access. |
| SOC2 CC6.7 | AC-5 and AC-6 constrain the new principal to durable least privilege and preserve explicit revocation states. |
| ISO27001 A.9.4 | AC-2, AC-7, AC-8, AC-9, AC-11, AC-12, and AC-13 enforce a tenant-bound, single-use, browser-bound, fail-closed passwordless log-on procedure, require the configured second factor, and protect its bearer credential. |
| GDPR Art. 32 | AC-1 prevents public identity enumeration, AC-2 and AC-7 avoid turning tenant binding into an oracle, AC-11 prevents durable bearer-secret exposure, and AC-13 prevents cross-browser confirmation. |

## Satisfied by

- [ADR 0007 — Transactional outbox for event delivery](../adr/0007-transactional-outbox-for-event-delivery.md) — makes membership creation and `tenant.member.added` publication one durable transaction.
- [ADR 0009 — Ports-only cross-module communication](../adr/0009-ports-only-cross-module-communication.md) — keeps auth-to-tenant admission and durable role resolution behind the typed `TenantMembershipProvisioner` port.
- [ADR 0070 — Interactive browser authentication uses durable one-time bound proofs](../adr/0070-interactive-browser-authentication-uses-durable-one-time-bound-proofs.md) — requires the explicit browser proof before magic-link token authority is consulted.
- [Convention C-04 — Public contracts live away from their implementation](../conventions.md#c-04-public-contracts-live-away-from-their-implementation) — places the shared admission contract in the ports layer while tenant management retains implementation ownership.
- [Convention C-20 — Interactive browser authentication uses one-time bound proofs](../conventions.md#c-20-interactive-browser-authentication-uses-one-time-bound-proofs) — defines nonce pairing, browser-signal checks, MFA continuity, and terminal cleanup.
- [Convention C-14 — Every Go file declares its purpose](../conventions.md#c-14-every-go-file-declares-its-purpose) — makes this capability traceable from governed source and tests.
- `modules/platformkit-business-modules/auth_management/features/authentication/login_link.go` — scanner-safe landing, confirmation proof validation, response policy, MFA continuation, and cookie cleanup.
- `modules/platformkit-business-modules/auth_management/features/authentication/login_link_service.go` — token-bound identity validation, admission orchestration, optimistic consumption, and session issuance.
- `modules/platformkit-business-modules/tenant_management/features/tenant_lifecycle/service_membership_provisioner.go` — tenant-owned policy enforcement, membership-state preservation, guest creation, durable role resolution, and transactional event publication.
- `modules/platformkit-business-modules/ports/tenant.go` — canonical tenant metadata keys, typed policy denial, and the narrow cross-module admission contract.
- `modules/platformkit-business-modules/notification_management/features/email_notifications/service.go` — sensitive inline delivery with redacted durable intent and non-replayable failed state.

## Related requirements

- [REQ-AUTH-001 — Authentication umbrella](./REQ-AUTH-001-authentication.md) — the feature this capability refines.
- [REQ-AUTH-010 — Password login](./REQ-AUTH-010-login-credentials.md) — retains the default rule that a nonmember cannot authenticate; this requirement is its explicit opt-in, magic-link-only exception.
- [REQ-AUTH-014 — Login rate limit](./REQ-AUTH-014-login-rate-limit.md) — bounds public link requests without changing their non-enumerating response.
- [REQ-TENANT-020 — Tenant member management](./REQ-TENANT-020-member-management.md) — owns membership state and role preservation.
- [REQ-USER-001 — User](./REQ-USER-001-user.md) — owns the existing active identity this flow may admit; this capability does not create users.
- [REQ-003 — No account enumeration](./REQ-003-no-account-enumeration.md) — governs the public request response.
- [REQ-005 — Authorisation fails closed](./REQ-005-authorisation-fails-closed.md) — governs missing policy, dependency, and durable-proof failures.
