---
title: "ADR 0066: Federated identities bind verified issuer and subject, not mutable claims"
status: Accepted
date: 2026-07-18
slug: adr-0066-federated-identities-bind-verified-issuer-and-subject
adr_topic: security
type: doc
tags: [adr, security, identity, oidc, saml, federation, account-linking]
---

# ADR 0066 — Federated identities bind verified issuer and subject, not mutable claims

Status: **Accepted** (2026-07-18)

## The problem

An OIDC email claim or SAML email attribute is useful evidence during the first
link, but it is not a stable identity key. People rename addresses, domains are
reassigned, providers recycle aliases, and one platform identity may be homed
under a different tenant from the tenant where the callback arrives. Repeating
email lookup on every callback can therefore switch principals, create a shadow
identity, or rewrite a platform-owned profile after the provider's claims
change.

Issuer and connection identity matter as well. The same textual subject from
two issuers is not the same principal, and silently accepting an issuer or
connection-key change turns an operator reconfiguration into an account-link
mutation. A partially committed first link can leave a user without its binding
or a binding without the intended user.

## The decision

Every OIDC and SAML login resolves through an immutable durable binding keyed
by the tenant, normalized protocol, stable tenant-owned connection key,
verified issuer or SAML entity ID, and signed stable subject. OIDC uses the
validated ID-token `iss` and `sub`; SAML uses the validated assertion issuer
and a non-transient signed NameID. Email never replaces any component of that
key.

A canonical provider-verified email is first-link collision evidence only.
Under one atomic database transaction, the adapter takes the subject lock and
a global canonical-email lock. It creates an unprivileged identity and inserts
the binding only when the global lookup is definitively absent. If an account
already owns that email, the callback fails with a link-required conflict: the
provider assertion alone cannot prove control of the existing PlatformKit
account. Linking then requires a separately authenticated proof-of-possession
flow or an explicit audited administrator operation. The binding and any new
identity commit together. Concurrent first links converge on one identity or
fail closed; they cannot create two users for the same canonical address.

Repeat login resolves the exact binding before considering email. Provider
claims never rewrite the linked platform profile, status, roles, permissions,
or tenant membership. A provider-returned platform identity ID is
authoritative at the business boundary: if that ID cannot be reloaded as an
active identity, authentication fails rather than falling back to email. The
provider session must also carry the authoritative tenant ID established by
the protected interactive flow. Callback request context is a second binding
check, never a substitute for missing provider tenant authority.
Tenant admission remains a separate policy decision and can add only the
tenant-owned least-privilege membership described by REQ-AUTH-026.

The persistence contract enforces one user per exact subject binding and, for
one tenant/provider/connection, at most one bound subject per platform user.
Issuer, entity-ID, connection-key, or subject transitions require an explicit
audited migration or relink operation; callbacks do not infer them. Production
federated runtimes require an atomic `FederatedDirectory`; a remote or
non-transactional adapter that cannot prove these semantics is rejected.

## What we gave up

- Changing an issuer, SAML entity ID, or stable connection key needs an
  explicit binding migration instead of silently relinking on the next login.
- First link depends on an atomic persistence boundary and serialized global
  email collision detection, so an eventually consistent remote directory
  alone is not sufficient.
- A user whose email already exists must complete an explicit account-linking
  proof instead of receiving a seamless first provider login.
- Ambiguous pre-existing email data blocks first link until an operator
  resolves it; availability does not outrank principal integrity.
- Provider sessions created before the mandatory tenant-ID and durable
  identity-ID boundary are rejected. They are not repaired from the callback
  host or relinked through a mutable email claim.

## What we kept

- Platform profiles and account lifecycle remain authoritative after the first
  link.
- A global identity can acquire separate provider bindings and tenant
  memberships only after an explicit proof-backed link; callbacks never infer
  global account ownership from email equality.
- OIDC and SAML share one provider-neutral persistence rule while retaining
  their protocol-specific verification.
- Tenant self-enrollment remains independently default-deny and grants no
  authority through the identity binding itself.

## How we enforce it

- [Convention C-18](../conventions.md#c-18-federated-login-binds-stable-provider-subjects)
  defines the provider-neutral linking discipline.
- `security/identity.FederatedDirectory` makes the durable resolution contract
  explicit; OIDC and SAML production constructors reject a plain directory.
- `auth_management/migrations/018_create_federated_identity_bindings.up.sql`
  carries the exact-key and per-user/connection uniqueness constraints.
- The auth-management adapter performs first-link collision detection,
  creation, and binding inside the ambient transaction with cross-process
  advisory locks; provider and business tests cover repeat login, email change,
  existing-account conflict, concurrent first link, and authoritative-ID
  failure.
- `interactive_forward_only_test.go::TestInteractiveIdentityRequiresDurableSubjectBinding`
  and `TestInteractiveCallbackRequiresProviderTenantBinding` ratchet the
  forward-only callback boundary against email relinking and request-tenant
  substitution.
- [REQ AUTH-026](../requirements/REQ-AUTH-026-interactive-provider-self-enrollment.md)
  verifies that identity resolution remains separate from least-privilege
  tenant admission.

## References

- [ADR 0006 — Multi-entity writes are atomic or they do not happen](./0006-transactional-atomicity-for-multi-entity-state.md)
- [ADR 0009 — Modules only talk through ports](./0009-ports-only-cross-module-communication.md)
- [REQ AUTH-026 — Interactive-provider tenant self-enrollment](../requirements/REQ-AUTH-026-interactive-provider-self-enrollment.md)
- [Convention C-18](../conventions.md#c-18-federated-login-binds-stable-provider-subjects)
