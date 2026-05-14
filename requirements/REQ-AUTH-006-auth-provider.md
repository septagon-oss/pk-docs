---
id: REQ-AUTH-006
title: "Auth provider feature manages tenant-scoped identity connections and forwards them to the runtime"
status: Proposed
date: 2026-05-07
slug: req-auth-006-auth-provider
category: auth
ears_pattern: optional
verification_methods: [test, inspection]
compliance: [SOC2_CC6.1, ISO27001_A.9.4]
satisfied_by:
  adr: [ADR-0009]
  conventions: [C-04, C-14]
implements_cross_cutting: [REQ-001, REQ-004, REQ-010, REQ-013]
type: doc
tags: [requirement, feature, auth_management]
module: auth_management
feature: auth_provider
---

# REQ AUTH-006 — Auth provider

Status: **Proposed** (2026-05-07)

## Statement

**Where** an external identity provider is wired (OIDC, SAML, SCIM
provisioner, OAuth2 IdP), the feature **shall** maintain a
tenant-scoped registry of `TenantIdentityConnection` records and
expose them — by purpose (login vs provisioning) — to the
authentication flow that initiates token exchange. Every
mutation (create, update, enable, disable, set-default) **shall** be
tenant-scoped and audited; secrets in the connection record **shall**
live in the runtime configuration plane, never echoed in API
responses or persisted in plaintext.

## Rationale

The auth_provider feature is the admin surface for "which identity
providers does this tenant trust?" Each tenant typically configures
one or two — corporate SSO for login, SCIM for user-lifecycle
provisioning. Treating connections as first-class records (rather
than environment variables) lets a customer add or rotate an IdP
without redeploying. The discipline keeps two properties: tenant
isolation (no tenant can read or mutate another's connection) and
secret containment (the provider's client secret round-trips through
the configuration plane only).

The feature does not own runtime token exchange — that lives in the
authentication feature's `BeginAuthentication` /
`CompleteAuthentication` calls into the configured `AuthProvider`
implementation. This REQ covers the *record management* surface; the
runtime resilience and attribute-mapping concerns are owned by
REQ-AUTH-001 and the chosen `AuthProvider` adapter.

## Acceptance criteria

- **AC-1** Connection records are tenant-scoped: every list, get,
  create, update, and delete derives the tenant from the request
  context (or an explicit override) and rejects calls with no
  tenant.
- **AC-2** Filtering connections by purpose (`login` vs
  `provisioning`) returns only records that have the corresponding
  flag enabled — provisioning-only records are not surfaced as login
  options and vice versa.
- **AC-3** Disabling a connection that is also enabled for
  provisioning toggles only the login flags (`LoginEnabled`,
  `DefaultLogin`) — the provisioning side stays active so SCIM
  syncs continue uninterrupted.
- **AC-4** When the authentication flow tests a configured
  connection, the runtime call carries the connection's tenant and
  key in its metadata so the chosen `AuthProvider` adapter can pick
  the right secret material from the configuration plane.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `pk-modules/auth_management/features/auth_provider/handlers_test.go::TestListConnections_RequiresTenantContextWhenNoOverride` + `TestCreateConnection_UsesTenantContextAndCatalog` + `TestDefaultConnection_UsesTenantContextFallback`. |
| AC-2 | Test | `pk-modules/auth_management/features/auth_provider/handlers_test.go::TestListConnections_FiltersByPurpose`. |
| AC-3 | Test | `pk-modules/auth_management/features/auth_provider/handlers_test.go::TestDisableConnection_PreservesProvisioningStatus`. |
| AC-4 | Test | `pk-modules/auth_management/features/auth_provider/handlers_test.go::TestConnection_UsesRuntimeWithConnectionMetadata`. |

## Implements (cross-cutting)

- REQ-001 — multi-tenant isolation (AC-1).
- REQ-004 — audit per mutation (the catalogued events
  `auth.provider.linked` / `auth.provider.unlinked` are emitted on
  every connection lifecycle change; reviewed at PR time).
- REQ-010 — config env-bound (provider secrets live in the runtime
  configuration plane, not in source).
- REQ-013 — integration adapters isolated (the `AuthProvider`
  abstraction is the boundary that keeps OIDC/SAML/SCIM clients out
  of the call sites that consume them).

## Satisfied by

- `pk-modules/auth_management/features/auth_provider/feature.go` — wiring.
- `pk-modules/auth_management/features/auth_provider/auth_provider.go`,
  `config.go`, `responses.go` — connection-record types and config.
- `pk-modules/auth_management/features/auth_provider/handlers.go`,
  `handlers_test.go` — admin-CRUD + runtime test endpoints.
- `pk-modules/auth_management/features/auth_provider/router.go`, `routes.go`,
  `permissions.go` — HTTP surface.

## Related requirements

- [REQ-AUTH-001 — Authentication](./REQ-AUTH-001-authentication.md) —
  consumes the connection records when initiating token exchange and
  owns the runtime resilience around that exchange.
- [REQ-AUTH-007 — SCIM provisioning](./REQ-AUTH-007-scim-provisioning.md) —
  the companion automated user-lifecycle path that uses
  provisioning-flagged connections.
