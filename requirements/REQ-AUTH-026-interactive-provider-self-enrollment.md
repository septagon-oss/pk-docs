---
id: REQ-AUTH-026
title: "Verified interactive-provider login admits an opted-in tenant guest"
status: Active
date: 2026-07-18
slug: req-auth-026-interactive-provider-self-enrollment
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
  adr: [ADR-0007, ADR-0009, ADR-0066, ADR-0070, ADR-0078]
  conventions: [C-04, C-18, C-20, C-14]
implements_cross_cutting: [REQ-001, REQ-003, REQ-004, REQ-005, REQ-007]
refines: REQ-AUTH-006
depends_on: [REQ-AUTH-006, REQ-AUTH-010, REQ-TENANT-020]
type: doc
tags: [requirement, capability, auth_management, authentication, oauth, oidc, saml, self-enrollment, tenant-admission, guest]
module: auth_management
feature: authentication
capability: interactive_provider_self_enrollment
capability_kind: inter_module_contract
stakeholders:
  - end-user (provider-authenticated account joining an opted-in tenant)
  - tenant administrator (admission-policy owner)
  - identity administrator (provider and account-lifecycle owner)
  - security reviewer (account-linking and least-privilege reviewer)
  - operator (authentication incident responder)
---

# REQ AUTH-026 — Interactive-provider tenant self-enrollment

Status: **Active** (2026-07-18)

## Statement

**Where** an active tenant is addressed through its authoritative host alias
and an OIDC or SAML runtime completes an active verified provider session whose
integrity-protected state is bound to that exact tenant, **when** the resolved
platform identity has no tenant membership, the system **shall** authenticate
only when tenant management atomically creates an active `guest` membership
because the tenant explicitly sets canonical
`interactive_provider_self_enrollment` metadata to `true`.

The interactive-provider flag is independent from
`magic_link_self_enrollment`. Neither flag authorizes the other proof method.
An existing active owner, administrator, member, or guest authenticates without
self-enrollment and keeps its current membership role. Invited, suspended,
removed, unknown-role, inactive-tenant, and policy-disabled states fail closed
without membership or session mutation.

Provider identity provisioning and tenant admission are separate boundaries.
The trusted identity runtime may create a new platform identity only from the
provider's verified identity attributes and may not reactivate a blocked
platform account as a side effect of login. Business authentication never
creates or activates a user; it accepts only the active identity returned by
the provider boundary. Tenant admission then grants only the independently
governed `guest` account kind, never a role copied from another tenant or an
old RBAC binding.

Verified email is first-link evidence, not a repeat-login identity key. The
runtime durably binds the callback tenant, protocol, stable connection key,
verified issuer or SAML entity ID, and signed subject to one exact platform
identity. Repeat callbacks resolve that binding before email and never rewrite
the platform-owned profile. Every completed provider session carries both the
authoritative callback tenant ID and durable platform identity ID. The business
boundary treats both as mandatory and fails closed if either is missing or the
exact active identity cannot be reloaded; request-host context and email are
never recovery keys.

Provider protocol validity is necessary but not sufficient callback authority.
The provider-visible OIDC `state` or SAML `RelayState` **shall** be registered
in a durable, one-time browser-flow ledger bound to an independent 256-bit
proof from the browser that started the flow and to the exact
tenant/provider/connection tuple. OIDC `state` carries the purpose-bound
protected continuation. SAML `RelayState` carries only a bounded random handle
to a separate durable, purpose-bound protected provider continuation. The
browser-flow proof **shall** be consumed atomically before provider completion;
the SAML provider continuation **shall** be consumed atomically before
assertion parsing. Browser binding remains authoritative through any local MFA
continuation. Upstream provider credentials **shall not** be projected or
persisted as PlatformKit session material.

## Rationale

An OAuth authorization code or SAML assertion proves identity at a provider;
it does not by itself grant authority in every tenant that can route a
callback. Binding provider state and the callback host to the same tenant
prevents callback replay across tenant aliases. A separate tenant flag makes
interactive-provider admission an explicit business decision rather than an
accidental consequence of enabling magic links.

Guest must be a ceiling across every authorization path. Merely adding a guest
row while leaving an old full-access role in the JWT, refresh path, local RBAC,
Topaz decision, or admin verifier would revive privilege. The durable
membership role therefore replaces other session roles with exactly `guest`,
and live authorization checks deny guests before consulting privileged
bindings in every rollout mode.

## Acceptance criteria

- **AC-1 — Verified provider completion.** Admission starts only after the
  configured interactive runtime returns an active provider session with a
  resolved durable identity ID and authoritative tenant ID. Missing, inactive,
  failed, or malformed provider sessions are denied before platform-identity
  lookup, membership mutation, or session issuance.
- **AC-2 — Exact provider-state and public-tenant binding.** The provider
  session carries the tenant ID established at interactive-login start. The
  callback request must resolve to the same tenant through server-owned public
  authority: `resolution_source=host_alias` or the configured
  `default_tenant`. Missing provider tenant state, mismatched tenant IDs, or a
  caller-selected resolution source cannot authenticate. The callback request
  tenant never fills missing provider state. The absent-membership branch is
  narrower: self-enrollment still requires `host_alias`; `default_tenant` may
  complete an already-authorized member's login but can never create a tenant
  membership.
- **AC-3 — Safe identity lifecycle boundary.** A newly provisioned provider
  identity is based only on provider-verified attributes. An existing inactive,
  suspended, deleted, or otherwise blocked platform identity is never activated
  by callback completion. The business authentication service performs no user
  create or activation write and revalidates active account status before any
  tenant or session mutation.
- **AC-4 — Independent explicit opt-in.** Absent membership requires canonical
  tenant metadata `interactive_provider_self_enrollment=true`. Missing, false,
  malformed, or unreadable policy denies. The magic-link flag alone denies.
  Tenant management re-reads tenant status and both method policies under the
  canonical row lock inside the membership transaction.
- **AC-5 — Atomic least-privilege membership.** The absent-member branch creates
  one active membership with role `guest`. The row and one durable
  `tenant.member.added` event commit together; its payload identifies
  `admissionMethod=interactive_provider`. A uniqueness race is re-read and
  evaluated without a duplicate event.
- **AC-6 — Existing membership is preserved.** Active recognized memberships
  authenticate with no role, status, or policy mutation. Invited, suspended,
  removed, or unknown membership state is denied and never reactivated.
- **AC-7 — Canonical guest claim.** The tenant-owned admission result and a
  durable role read must agree before session issuance. Guest replaces every
  RBAC/asserted role in the authentication result and access token. Refresh and
  tenant-bound re-issuance also emit exactly `[guest]`, even when an orphan
  administrative binding exists.
- **AC-8 — Live authorization ceiling.** A durable guest membership denies
  permission and admin access before local RBAC, Topaz, or full-access-token
  lookup in off, shadow, and enforce modes. Missing or mismatched authenticated
  user/tenant context and failed live membership reads fail closed.
- **AC-9 — No partial authentication.** Policy, tenant, identity, membership,
  role-proof, session, audit, or auth-event failure mints no session. A callback
  tenant mismatch is rejected before identity lookup. Operational errors remain
  visible through stable non-secret telemetry and the browser returns to the
  login surface without exposing internal state.
- **AC-10 — Method isolation.** Password login, password reset, tenant switching,
  and caller-selected tenant overrides cannot invoke interactive-provider
  admission. Magic-link confirmation uses REQ-AUTH-025 and its own policy; it
  cannot inherit this flag.
- **AC-11 — Durable provider-subject binding.** OIDC uses the validated token
  issuer and subject; SAML uses the validated assertion issuer and a stable
  signed NameID. The exact tenant/provider/connection/issuer/subject tuple is
  bound atomically with first-link identity creation only when the user owner's
  narrow provisioner, inside that transaction, serializes and proves the
  canonical verified email is unused. Auth performs no duplicate preflight
  email lookup. An existing account with the
  same email yields a link-required conflict; a separately authenticated
  proof-of-possession or explicit audited administrator flow must create that
  binding. Repeat login resolves the immutable binding even when email changes,
  requires its durable platform identity ID, never mutates the platform profile
  or relinks through email, and fails closed on a conflicting, transient,
  stale, inactive, missing-ID, or unreloadable identity binding.
- **AC-12 — Durable one-time browser-bound callback.** Interactive start
  requires a durable flow store and creates an independent cryptographically
  random 256-bit browser binding. The application-owned
  `auth_interactive_flows` ledger contains only SHA-256 digests of the complete
  browser-visible OIDC `state` or SAML `RelayState` and browser binding, plus
  the exact tenant ID, canonical provider, stable connection key, expiry, and
  consumption state. Before invoking provider completion, the callback uses
  one conditional durable update to match both digests, every authority field,
  unexpired state, and `consumed_at IS NULL`. Exactly one callback wins. A
  mismatch does not consume another flow; missing, ambiguous, expired,
  unavailable, or failing authority calls no provider and creates no
  membership or platform session.

  OIDC `state` remains the complete randomized, purpose-bound `pkps:v1`
  AES-256-GCM envelope in the browser, using purpose
  `identity.oidc.authorization-continuation`, not readable signed JWT claims.
  It protects the nonce, PKCE verifier, redirect, bounded time window, tenant,
  durable connection authority, configured issuer, and client audience.

  SAML `RelayState` is instead exactly 256 cryptographically random bits encoded
  as 43 bytes of unpadded base64url. It is an opaque handle, not an envelope or
  routing token. The complete purpose-bound `pkps:v1` AEAD envelope uses
  purpose `identity.saml.authentication-continuation` and stays durable
  server-side in a separate provider-continuation store. Its selector contains
  only the SHA-256 handle digest and the exact tenant, canonical provider,
  stable connection key, and that same purpose. The envelope protects the
  durable connection identity and key, authentication-request ID, absolute ACS
  URL, SP metadata URL, metadata source authority and entity ID, configured
  issuer, connection subject and audience, optional return target, and
  issued-at and expiry no more than five minutes plus the 30-second skew
  allowance apart. SAML completion validates the handle shape, then performs
  one database-clock conditional consume matching handle digest, tenant,
  provider, connection, purpose, unexpired state, and `consumed_at IS NULL`.
  Registration supplies only a bounded lifetime and one database-clock
  expression derives both creation and expiry. The same database clock
  supplies the expiry predicate and consumption timestamp. Exactly one caller
  receives the protected envelope across all
  replicas, while a mismatched selector does not burn the legitimate row.
  Decryption, complete claim revalidation, and assertion parsing happen only
  after consumption. Expired provider continuations are removed with indexed,
  bounded database-time cleanup; cleanup failure is visible but never relaxes
  callback authority.

  Completion rejects tampering, malformed or wrong-purpose values,
  previous signed-readable formats, recreated connections, and every client or
  callback tenant/provider/connection mismatch. SAML also requires exact ACS
  authority before assertion parsing. Rejecting prior readable JWT
  continuations is a deliberate cutover bounded by their former five-minute
  lifetime. The provider-continuation store does not replace the outer
  browser-flow ledger: the former proves SAML request correlation and replay
  exclusion, while the latter independently proves browser continuity.
- **AC-13 — Protocol cookie, MFA, and bearer boundary.** The host-only,
  `HttpOnly` flow cookie is scoped to the callback path and flow expiry. OIDC
  uses `SameSite=Lax` and `Secure` over HTTPS. Deployed SAML HTTP-POST uses
  `SameSite=None; Secure` and fails if HTTPS cannot be proven; only a loopback
  development harness may use Lax over HTTP. Local MFA retains the binding
  digest, flow reference, exact tenant/provider/connection tuple, verified
  platform identity reference, return target, and bounded expiry; it compares
  browser binding in constant time, consumes the continuation once, and never
  re-enters the provider. Provider completion projects verified non-secret
  facts only; OIDC uses a fresh 256-bit non-bearer reference. OIDC
  ID/access/refresh bearers, raw SAML assertions, and other upstream
  credentials are neither provider-neutral session metadata nor durable
  PlatformKit session state.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `pk-modules/auth_management/features/authentication/service_test.go::TestCompleteInteractiveAuthenticationRejectsInactiveProviderSessionBeforeIdentityLookup`, `pk-core/security/identity/providers/oidc/service_test.go::TestUpsertIdentity_RequiresProviderVerifiedSubjectAndEmail`, and `security/identity/providers/saml/service_test.go::TestUpsertIdentity_RejectsUntrustedOrAmbiguousEmail`. |
| AC-2 | Test | `pk-modules/auth_management/features/authentication/service_test.go::TestCompleteInteractiveAuthentication_TrustedDefaultTenantPersistsPlatformSession`, `TestCompleteInteractiveAuthenticationSelfEnrollmentRequiresAuthoritativeHostAlias`, the callback-tenant mismatch case, and `interactive_forward_only_test.go::TestInteractiveCallbackAcceptsOnlyTrustedPublicTenantResolution` plus `TestInteractiveCallbackRequiresProviderTenantBinding`. |
| AC-3 | Test | `pk-modules/auth_management/features/authentication/service_test.go::TestCompleteInteractiveAuthenticationDoesNotCreateOrActivatePlatformIdentity`, plus OIDC/SAML inactive-account and profile-authority cases. |
| AC-4 | Test | `pk-modules/tenant_management/features/tenant_lifecycle/service_membership_provisioner_test.go::TestInteractiveProviderAdmissionRequiresIndependentTenantOptIn` plus policy-lock repository tests. |
| AC-5 | Test | `pk-modules/tenant_management/features/tenant_lifecycle/service_membership_provisioner_test.go::TestEnsureLeastPrivilegeActiveMembershipCreatesGuestAndEmitsEvent`, with atomic write/outbox and duplicate-race cases. |
| AC-6 | Test | `pk-modules/tenant_management/features/tenant_lifecycle/service_membership_provisioner_test.go::TestEnsureLeastPrivilegeActiveMembershipPreservesActiveRole`, with inactive, removed, and unknown-role denial cases. |
| AC-7 | Test | `pk-modules/auth_management/features/authentication/service_test.go::TestCompleteInteractiveAuthenticationSelfEnrollsVerifiedIdentityAsGuest` and durable guest-ceiling refresh coverage. |
| AC-8 | Test | `pk-modules/auth_management/features/permissions/session_evaluator_test.go::TestSessionPermissionEvaluatorLiveGuestCeilingOverridesStaleAdminClaim`, with Topaz and tenant-admin ordering cases. |
| AC-9 | Test | `pk-modules/auth_management/features/authentication/service_test.go::TestCompleteInteractiveAuthenticationRejectsCallbackTenantMismatch`, plus identity, membership, and session mutation-failure cases. |
| AC-10 | Analysis | `pk-modules/auth_management/features/authentication/login_resolution.go` and module-boundary inspection prove only interactive callback completion passes `TenantMembershipAdmissionInteractiveProvider`. |
| AC-11 | Test | `pk-modules/auth_management/internal/adapters/federated_identity_binding_store_test.go::TestFederatedIdentityBindingDelegatesFirstLinkToOwnerThenUsesExactSubject`, `features/authentication/service_test.go::TestUserFromProviderSessionBoundIdentityFailureDoesNotRelinkByEmail`, and `interactive_forward_only_test.go::TestInteractiveIdentityRequiresDurableSubjectBinding`, with zero auth-side email preflight reads, one owner admission per attempt, mutable-email repeat, existing-email conflict, global race, rollback, migration, and conflicting-subject cases plus core OIDC/SAML tests. |
| AC-12 | Test | `pk-modules/auth_management/features/authentication/interactive_flow_security_test.go::TestInteractiveAuthenticationFlowMismatchDoesNotBurnLegitimateCallback`, `TestInteractiveAuthenticationFlowConcurrentCallbacksHaveExactlyOneProviderWinner`, `TestInteractiveAuthenticationFlowExpiryAndStorageOutageFailBeforeProvider`, `TestSAMLRelayStateIsConsumedBeforeAssertionParsingAndCannotReplay`, `TestInteractiveAuthenticationFlowStoreNeverRetainsRawStateOrBinding`, `TestInteractiveAuthenticationStartRegistrationFailureDoesNotRedirectUsableFlow`, and `TestInteractiveProviderErrorStillConsumesBoundFlow`; `interactive_flow_migration_test.go::TestInteractiveAuthenticationFlowMigrationEnforcesHashedOneTimeAuthority`; `pk-modules/auth_management/features/auth_provider/interactive_continuation_store_test.go::TestInteractiveProviderContinuationStoreConsumesOnceWithoutMismatchBurn` and `TestInteractiveProviderContinuationStoreRejectsMalformedAuthority`; `pk-modules/auth_management/features/auth_provider/interactive_continuation_migration_test.go::TestInteractiveProviderContinuationMigrationIsHashedBoundedAndOneTime`; `pk-core/security/identity/interactive_continuation.go`; `pk-core/security/protectedstate/codec_test.go`; OIDC `TestBeginAuthentication_UsesDefaultConnection` and `TestValidateOIDCStateAuthorityRequiresExactConnectionAndCallbackMetadata`; and SAML `TestSAMLMetadata_IsSharedAcrossBeginAndComplete` and `TestValidateSAMLRelayStateAuthorityRequiresExactConnectionAndCallbackMetadata` verify the separate ledgers, 256-bit/43-byte handle, server-side purpose-bound envelope, exact selector and claim authority, database-clock one-time consume, bounded expiry cleanup, readable-JWT rejection, and callback authority before assertion parsing. |
| AC-13 | Test | `pk-modules/auth_management/features/authentication/interactive_flow_browser_security_test.go::TestInteractiveBrowserStartUsesServerBindingAndOIDCLaxHostOnlyCookie`, `TestInteractiveBrowserStartUsesSecureSameSiteNoneForSAML`, `TestInteractiveBrowserSAMLInsecureProductionFailsClosedButLocalhostIsDeliberate`, `TestInteractiveBrowserAttackerStartCannotAuthorizeVictimCallback`, `TestInteractiveBrowserConcurrentTabsSelectIndependentFlowCookies`, and `TestInteractiveMFAChallengeCannotBeContinuedInAnotherBrowser`; `interactive_mfa_test.go::TestCompleteInteractiveAuthenticationRequiresLocalMFABeforeExistingOrGuestSession`, core OIDC `TestCompleteAuthentication_JITProvisionsIdentity`, and `interactive_flow_migration_test.go::TestSessionTokenScrubMigrationRemovesHistoricalProviderBearers` verify provider non-reentry and bearer-free projection and persistence. |

## Edge cases and explicit limits

- A provider-created identity and its tenant guest membership are distinct
  mutations. A tenant-policy denial may leave a valid platform identity with no
  membership, but never a tenant session or authorization grant.
- Provider sessions without authoritative tenant state or a durable identity
  ID are a deliberate forward-only cutover: they authenticate nobody and must
  restart through the current interactive flow.
- A guest-to-member promotion requires the tenant-owned membership-management
  path and a new or refreshed session. Self-enrollment never performs it.
- An existing blocked identity remains blocked even if the provider continues
  to assert a valid subject and email.
- An existing unbound account is never linked from email equality alone; the
  callback returns a link-required conflict without creating a binding.

## Satisfied by

- [ADR 0066 — Federated identities bind verified issuer and subject, not mutable claims](../adr/0066-federated-identities-bind-verified-issuer-and-subject.md) — defines immutable provider-subject identity resolution.
- [ADR 0070 — Interactive browser authentication uses durable one-time bound proofs](../adr/0070-interactive-browser-authentication-uses-durable-one-time-bound-proofs.md) — defines callback replay, browser continuity, cookie, MFA, and bearer-projection boundaries.
- ADR 0078 — SAML RelayState is a bounded handle to a durable protected continuation — amends ADR 0070's SAML representation and defines the separate provider-continuation authority. The ADR is authored in the canonical product documentation and will enter this public mirror through the documentation synchronization pipeline.
- [Convention C-18 — Federated login binds stable provider subjects](../conventions.md#c-18-federated-login-binds-stable-provider-subjects) — makes the provider-subject rule mechanical across OIDC and SAML.
- [Convention C-20 — Interactive browser authentication uses one-time bound proofs](../conventions.md#c-20-interactive-browser-authentication-uses-one-time-bound-proofs) — makes the durable consume and browser handoff rules mechanical.
- `pk-modules/auth_management/features/authentication/interactive_flow_store.go`, `login_service.go`, `login_viewer.go`, and `login_2fa.go` — hash-only browser callback authority, protocol cookies, provider ordering, and local-MFA continuation.
- `pk-modules/auth_management/features/auth_provider/interactive_continuation_store.go` and migration 037 — hash-only, purpose-bound SAML provider continuation, atomic database-clock consume, and bounded expiry lifecycle.
- `pk-modules/auth_management/migrations/020_create_interactive_authentication_flows.up.sql`, `021_scrub_upstream_session_tokens.up.sql`, and `038_harden_interactive_flow_retention.up.sql` — constrained one-time browser state, removal of prior upstream values from projectable sessions, and indexed retention for expired pending and consumed browser-flow rows.
- `pk-core/security/protectedstate/codec.go` — randomized, purpose-bound authenticated encryption for browser-carried OIDC state and the server-side SAML continuation envelope.
- `pk-core/security/identity/interactive_continuation.go` and `providers/oidc/service.go` and `providers/saml/service.go` — narrow continuation-store authority, protocol-specific state representation, protocol verification, and bearer-free provider-neutral completion.

## Related requirements

- [REQ-AUTH-006 — Auth provider](./REQ-AUTH-006-auth-provider.md)
- [REQ-AUTH-010 — Login credentials](./REQ-AUTH-010-login-credentials.md)
- [REQ-AUTH-025 — Magic-link tenant self-enrollment](./REQ-AUTH-025-magic-link-self-enrollment.md)
- [REQ-TENANT-020 — Member management](./REQ-TENANT-020-member-management.md)
