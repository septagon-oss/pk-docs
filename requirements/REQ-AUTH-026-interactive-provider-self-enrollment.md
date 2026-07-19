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
  adr: [ADR-0007, ADR-0009, ADR-0066, ADR-0070]
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
The complete OIDC `state` or SAML `RelayState` **shall** be durable, one-time,
and bound to an independent 256-bit proof from the browser that started the
flow and to the exact tenant/provider/connection tuple. This proof **shall** be
consumed atomically before provider completion and retained through any local
MFA continuation. Upstream provider credentials **shall not** be projected or
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
- **AC-2 — Exact provider-state and host binding.** The provider session carries
  the tenant ID established at interactive-login start. The callback request
  must resolve to the same tenant through authoritative
  `resolution_source=host_alias` middleware. Missing provider tenant state,
  mismatched tenant IDs, or a caller-selected/default resolution source cannot
  authenticate or self-enroll. The callback request tenant never fills missing
  provider state.
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
  bound atomically with first-link identity creation only when a global lookup
  proves the canonical verified email is unused. An existing account with the
  same email yields a link-required conflict; a separately authenticated
  proof-of-possession or explicit audited administrator flow must create that
  binding. Repeat login resolves the immutable binding even when email changes,
  requires its durable platform identity ID, never mutates the platform profile
  or relinks through email, and fails closed on a conflicting, transient,
  stale, inactive, missing-ID, or unreloadable identity binding.
- **AC-12 — Durable one-time browser-bound callback.** Interactive start
  requires a durable flow store and creates an independent cryptographically
  random 256-bit browser binding. Persistence contains only SHA-256 digests of
  the complete OIDC `state` or SAML `RelayState` and browser binding, plus the
  exact tenant ID, normalized provider, stable connection key, expiry, and
  consumption state. Before invoking provider completion, the callback uses
  one conditional durable update to match both digests, every authority field,
  unexpired state, and `consumed_at IS NULL`. Exactly one callback wins. A
  mismatch does not consume another flow; missing, ambiguous, expired,
  unavailable, or failing authority calls no provider and creates no
  membership or platform session. OIDC `state` and SAML `RelayState` are
  randomized, independently purpose-bound `pkps:v1` AES-256-GCM envelopes, not
  readable signed JWT claims. OIDC protects the nonce and PKCE verifier. SAML
  requires and protects tenant, connection, authentication-request ID,
  absolute ACS URL, issued-at and expiry no more than five minutes plus the
  30-second skew allowance apart, configured issuer, connection subject, and
  connection audience. Completion rejects tampering, malformed, wrong-purpose,
  or signed-readable formats and invalid claim authority. It rejects every
  connection/client or callback tenant/provider/connection mismatch; SAML also
  requires exact callback ACS authority before assertion parsing. Rejecting
  prior readable JWT continuations is a deliberate cutover bounded by their
  former five-minute lifetime.
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
| AC-1 | Test | `modules/platformkit-business-modules/auth_management/features/authentication/service_test.go::TestCompleteInteractiveAuthenticationRejectsInactiveProviderSessionBeforeIdentityLookup`, `core/platformkit-backend-kit/security/identity/providers/oidc/service_test.go::TestUpsertIdentity_RequiresProviderVerifiedSubjectAndEmail`, and `security/identity/providers/saml/service_test.go::TestUpsertIdentity_RejectsUntrustedOrAmbiguousEmail`. |
| AC-2 | Test | `modules/platformkit-business-modules/auth_management/features/authentication/service_test.go::TestCompleteInteractiveAuthenticationSelfEnrollmentRequiresAuthoritativeHostAlias`, the callback-tenant mismatch case, and `interactive_forward_only_test.go::TestInteractiveCallbackRequiresProviderTenantBinding`. |
| AC-3 | Test | `modules/platformkit-business-modules/auth_management/features/authentication/service_test.go::TestCompleteInteractiveAuthenticationDoesNotCreateOrActivatePlatformIdentity`, plus OIDC/SAML inactive-account and profile-authority cases. |
| AC-4 | Test | `modules/platformkit-business-modules/tenant_management/features/tenant_lifecycle/service_membership_provisioner_test.go::TestInteractiveProviderAdmissionRequiresIndependentTenantOptIn` plus policy-lock repository tests. |
| AC-5 | Test | `modules/platformkit-business-modules/tenant_management/features/tenant_lifecycle/service_membership_provisioner_test.go::TestEnsureLeastPrivilegeActiveMembershipCreatesGuestAndEmitsEvent`, with atomic write/outbox and duplicate-race cases. |
| AC-6 | Test | `modules/platformkit-business-modules/tenant_management/features/tenant_lifecycle/service_membership_provisioner_test.go::TestEnsureLeastPrivilegeActiveMembershipPreservesActiveRole`, with inactive, removed, and unknown-role denial cases. |
| AC-7 | Test | `modules/platformkit-business-modules/auth_management/features/authentication/service_test.go::TestCompleteInteractiveAuthenticationSelfEnrollsVerifiedIdentityAsGuest` and durable guest-ceiling refresh coverage. |
| AC-8 | Test | `modules/platformkit-business-modules/auth_management/features/permissions/session_evaluator_test.go::TestSessionPermissionEvaluatorLiveGuestCeilingOverridesStaleAdminClaimInEveryMode`, with Topaz and tenant-admin ordering cases. |
| AC-9 | Test | `modules/platformkit-business-modules/auth_management/features/authentication/service_test.go::TestCompleteInteractiveAuthenticationRejectsCallbackTenantMismatch`, plus identity, membership, and session mutation-failure cases. |
| AC-10 | Analysis | `modules/platformkit-business-modules/auth_management/features/authentication/login_resolution.go` and module-boundary inspection prove only interactive callback completion passes `TenantMembershipAdmissionInteractiveProvider`. |
| AC-11 | Test | `modules/platformkit-business-modules/auth_management/internal/adapters/federated_identity_binding_store_test.go::TestFederatedIdentityBindingCreatesOnDefinitiveAbsenceThenUsesExactSubject`, `features/authentication/service_test.go::TestUserFromProviderSessionBoundIdentityFailureDoesNotRelinkByEmail`, and `interactive_forward_only_test.go::TestInteractiveIdentityRequiresDurableSubjectBinding`, with mutable-email repeat, existing-email conflict, global race, rollback, migration, and conflicting-subject cases plus core OIDC/SAML tests. |
| AC-12 | Test | `modules/platformkit-business-modules/auth_management/features/authentication/interactive_flow_security_test.go::TestInteractiveAuthenticationFlowMismatchDoesNotBurnLegitimateCallback`, `TestInteractiveAuthenticationFlowConcurrentCallbacksHaveExactlyOneProviderWinner`, `TestInteractiveAuthenticationFlowExpiryAndStorageOutageFailBeforeProvider`, `TestSAMLRelayStateIsConsumedBeforeAssertionParsingAndCannotReplay`, `TestInteractiveAuthenticationFlowStoreNeverRetainsRawStateOrBinding`, `TestInteractiveAuthenticationStartRegistrationFailureDoesNotRedirectUsableFlow`, and `TestInteractiveProviderErrorStillConsumesBoundFlow`; `interactive_flow_migration_test.go::TestInteractiveAuthenticationFlowMigrationEnforcesHashedOneTimeAuthority`, `core/platformkit-backend-kit/security/protectedstate/codec_test.go`, OIDC `TestBeginAuthentication_UsesDefaultConnection` and `TestValidateOIDCStateAuthorityRequiresExactConnectionAndCallbackMetadata`, plus SAML `TestBeginAuthentication_BuildsRedirectFlowWithProtectedRelayState` and `TestValidateSAMLRelayStateAuthorityRequiresExactConnectionAndCallbackMetadata` verify migration 020, opaque purpose-bound continuations, readable-JWT rejection, bounded required SAML claims, and exact callback authority before assertion parsing. |
| AC-13 | Test | `modules/platformkit-business-modules/auth_management/features/authentication/interactive_flow_browser_security_test.go::TestInteractiveBrowserStartUsesServerBindingAndOIDCLaxHostOnlyCookie`, `TestInteractiveBrowserStartUsesSecureSameSiteNoneForSAML`, `TestInteractiveBrowserSAMLInsecureProductionFailsClosedButLocalhostIsDeliberate`, `TestInteractiveBrowserAttackerStartCannotAuthorizeVictimCallback`, `TestInteractiveBrowserConcurrentTabsSelectIndependentFlowCookies`, and `TestInteractiveMFAChallengeCannotBeContinuedInAnotherBrowser`; `interactive_mfa_test.go::TestCompleteInteractiveAuthenticationRequiresLocalMFABeforeExistingOrGuestSession`, core OIDC `TestCompleteAuthentication_JITProvisionsIdentity`, and `interactive_flow_migration_test.go::TestSessionTokenScrubMigrationRemovesHistoricalProviderBearers` verify provider non-reentry and bearer-free projection and persistence. |

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
- [Convention C-18 — Federated login binds stable provider subjects](../conventions.md#c-18-federated-login-binds-stable-provider-subjects) — makes the provider-subject rule mechanical across OIDC and SAML.
- [Convention C-20 — Interactive browser authentication uses one-time bound proofs](../conventions.md#c-20-interactive-browser-authentication-uses-one-time-bound-proofs) — makes the durable consume and browser handoff rules mechanical.
- `modules/platformkit-business-modules/auth_management/features/authentication/interactive_flow_store.go`, `login_service.go`, `login_viewer.go`, and `login_2fa.go` — hash-only callback authority, protocol cookies, provider ordering, and local-MFA continuation.
- `modules/platformkit-business-modules/auth_management/migrations/020_create_interactive_authentication_flows.up.sql` and `021_scrub_upstream_session_tokens.up.sql` — constrained one-time state and removal of prior upstream values from projectable sessions.
- `core/platformkit-backend-kit/security/protectedstate/codec.go` — randomized, purpose-bound authenticated encryption for opaque OIDC and SAML continuation state.
- `core/platformkit-backend-kit/security/identity/providers/oidc/service.go` and `saml/service.go` — protocol verification and bearer-free provider-neutral completion.

## Related requirements

- [REQ-AUTH-006 — Auth provider](./REQ-AUTH-006-auth-provider.md)
- [REQ-AUTH-010 — Login credentials](./REQ-AUTH-010-login-credentials.md)
- [REQ-AUTH-025 — Magic-link tenant self-enrollment](./REQ-AUTH-025-magic-link-self-enrollment.md)
- [REQ-TENANT-020 — Member management](./REQ-TENANT-020-member-management.md)
