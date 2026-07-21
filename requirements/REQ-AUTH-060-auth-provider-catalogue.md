---
id: REQ-AUTH-060
title: "Auth-provider catalogue exposes tenant-scoped CRUD over identity-connection records"
status: Proposed
date: 2026-05-08
slug: req-auth-060-auth-provider-catalogue
category: auth
ears_pattern: ubiquitous
priority: must
risk: high
verification_methods: [test]
compliance:
  - SOC2_CC6.1
  - ISO27001_A.9.4
satisfied_by:
  adr: [ADR-0009]
  conventions: [C-04, C-14]
implements_cross_cutting: [REQ-001, REQ-004, REQ-013]
refines: REQ-AUTH-006
type: doc
tags: [requirement, capability, auth_management, auth_provider, catalogue]
module: auth_management
feature: auth_provider
capability: connection_catalogue
capability_kind: data_invariant
stakeholders:
  - tenant administrator (configuring SSO)
  - operator (helping tenants debug SSO)
  - compliance auditor (IdP-record management)
---

# REQ AUTH-060 — Auth-provider connection catalogue

Status: **Proposed** (2026-05-08)

## Statement

The auth-provider feature **shall** expose admin-grade CRUD
over `TenantIdentityConnection` records: list connections
filtered by purpose (`login` vs `provisioning`), look up the
default connection for a (tenant, purpose) pair, create a new
connection scoped to the request tenant, update an existing
connection's editable fields, and disable login on a
connection without disturbing its provisioning side.

Every operation **shall** scope to the request tenant; calls
without a tenant context **shall** be refused. Filtering by
purpose **shall** surface only records that have the
corresponding flag enabled — provisioning-only records
**shall not** appear as login options and vice versa.

## Rationale

Identity-connection records are the bridge between the
platform and a tenant's chosen identity provider (OIDC, SAML,
SCIM). The CRUD surface has three load-bearing properties:

1. **Tenant scope.** Every operation derives the tenant
   from the request context (or an explicit override) and
   refuses calls where neither is present. Without this,
   tenant A's admin could list, modify, or disable tenant
   B's IdP records.
2. **Purpose filtering.** Connections may serve login,
   provisioning, or both; the list endpoint must respect
   the requested purpose so a "login" UI does not show a
   provisioning-only SCIM connector as an option.
3. **Disable preserves provisioning.** A connection used
   for both login and SCIM must be partially disablable —
   the operator who clicks "stop letting users log in via
   this IdP" must not break the SCIM sync that keeps the
   user list current.

The surface is also where the connection catalogue's
relationship with the runtime authentication flow is
brokered: the runtime test path (REQ-AUTH-061) consults
this same record set.

## Acceptance criteria

- **AC-1 — List with purpose filter.** A list call with
  `purpose=login` returns only connections whose
  `LoginEnabled=true`; `purpose=provisioning` returns only
  those with `ProvisioningEnabled=true`.
- **AC-2 — Default connection by purpose.** A
  default-connection call returns the unique record with
  the corresponding `DefaultLogin` or `DefaultProvisioning`
  flag (or nil if none exists).
- **AC-3 — Create scoped to request tenant.** Create
  derives the tenant from `appcontext` (or an explicit
  `TenantID` field); the persisted record carries the
  resolved tenant.
- **AC-4 — Tenant-context required.** A list / get / create
  call without a tenant context (and without an explicit
  override) returns the typed tenant-context-required error.
- **AC-5 — Disable preserves provisioning.** A
  `DisableConnection` call flips `LoginEnabled` and
  `DefaultLogin` to `false` but leaves
  `ProvisioningEnabled` and the connection's `Status`
  untouched when the record is also serving provisioning.
- **AC-6 — Connection runtime test (companion).** A
  `TestConnection` call carries the connection's tenant +
  key in the runtime metadata so the configured
  `AuthProvider` adapter can pick the right credential
  material (REQ-AUTH-061).

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `pk-modules/auth_management/features/auth_provider/handlers_test.go::TestListConnections_FiltersByPurpose`. |
| AC-2 | Test | `pk-modules/auth_management/features/auth_provider/handlers_test.go::TestDefaultConnection_UsesTenantPort` and `TestDefaultConnection_UsesTenantContextFallback`. |
| AC-3 | Test | `pk-modules/auth_management/features/auth_provider/handlers_test.go::TestCreateConnection_UsesTenantContextAndCatalog`. |
| AC-4 | Test | `pk-modules/auth_management/features/auth_provider/handlers_test.go::TestListConnections_RequiresTenantContextWhenNoOverride`. |
| AC-5 | Test | `pk-modules/auth_management/features/auth_provider/handlers_test.go::TestDisableConnection_PreservesProvisioningStatus`. |
| AC-6 | Test | `pk-modules/auth_management/features/auth_provider/handlers_test.go::TestConnection_UsesRuntimeWithConnectionMetadata`. |

## Edge cases & unhappy paths

- **Multiple default-login connections.** A tenant
  shouldn't have two records with `DefaultLogin=true` —
  the schema's uniqueness constraint prevents this; the
  service refuses a write that would create the
  duplicate.
- **Provider mismatch on update.** Editing a connection's
  provider type (OIDC → SAML) is refused; operators must
  delete and recreate.
- **Connection deletion with active sessions.** Deleting
  a connection does not invalidate sessions already
  minted from it; sessions live independently of the
  connection record once issued.
- **Tenant-archive ripple.** Connections on archived
  tenants are read-only — no list / create / update via
  this surface; operator-mediated maintenance only.

## Risk

- **Likelihood:** Medium — exercised at IdP-configuration
  cadence.
- **Impact:** High — a defective tenant scope would let
  one tenant's admin reconfigure another's SSO.
- **Mitigations:** Tenant-scope guard (AC-3 + AC-4),
  partial-disable safety (AC-5), purpose filter (AC-1).

## Implements (cross-cutting)

- **REQ-001 — Multi-tenant isolation.** AC-3 + AC-4 are
  the enforcement.
- **REQ-004 — Audit per mutation.** Each mutation emits
  the catalogued `auth.provider.linked` /
  `auth.provider.unlinked` event.
- **REQ-013 — Integration adapters isolated.** The
  connection record is the configuration handed to the
  `AuthProvider` adapter; the adapter never reads its
  own configuration.

## Compliance mapping

| Control | Coverage |
|---|---|
| SOC2 CC6.1 | AC-3 + AC-4 — tenant-scoped IdP-record management. |
| ISO27001 A.9.4 | AC-1 + AC-5 — controlled IdP catalogue. |

## Satisfied by

- `pk-modules/auth_management/features/auth_provider/handlers.go` —
  the admin-CRUD endpoints.
- `pk-modules/auth_management/features/auth_provider/auth_provider.go` —
  the connection-record types.
- `pk-modules/tenant_management/features/identity_connections/service.go` —
  the underlying repository.

## Related requirements

- [REQ-AUTH-006 — Auth provider umbrella](./REQ-AUTH-006-auth-provider.md)
- [REQ-AUTH-061 — Connection runtime test](./REQ-AUTH-061-connection-runtime-test.md)
- [REQ-TENANT-005 — Identity connections](./REQ-TENANT-005-identity-connections.md) — the data-owner of the records this CRUD surfaces.
