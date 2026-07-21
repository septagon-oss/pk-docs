---
id: REQ-TENANT-005
title: "Identity connections feature owns the tenant-scoped IdP catalogue"
status: Proposed
date: 2026-05-07
slug: req-tenant-005-identity-connections
category: tenancy
ears_pattern: ubiquitous
verification_methods: [test]
compliance: [SOC2_CC6.1, ISO27001_A.9.4]
satisfied_by:
  adr: [ADR-0009]
  conventions: [C-04, C-14]
implements_cross_cutting: [REQ-001, REQ-004, REQ-013]
type: doc
tags: [requirement, feature, tenant_management]
module: tenant_management
feature: identity_connections
---

# REQ TENANT-005 — Identity connections

Status: **Proposed** (2026-05-07)

## Statement

The identity connections feature **shall** persist tenant-owned
`TenantIdentityConnection` records (OIDC, SAML, SCIM
provisioner) and expose them through a stable contract
(`provides.TenantIdentityConnectionService`) that the
authentication and admin UIs consume. Every read and write
**shall** be tenant-scoped; default-connection lookups
(`GetDefaultTenantIdentityConnection`) **shall** return the record
flagged for the requested purpose (login vs provisioning) or
nothing.

## Rationale

This feature sits at the contract boundary between
tenant_management (which owns the data model) and the auth
provider feature in auth_management (which renders + admins
the connections through `REQ-AUTH-006`). Splitting ownership keeps
data ownership inside tenant_management — the table belongs to
this module and the GORM entity definition lives here — while
letting the admin UI live in auth_management where the rest of
the IdP-related flows are. The provides interface is the line
across which neither side reaches.

## Acceptance criteria

- **AC-1** Reads and writes are tenant-scoped — calls without a
  tenant context fail closed.
- **AC-2** A default-purpose lookup returns at most one record per
  (tenant, purpose) pair; a tenant can have multiple OIDC
  connections but only one is the default for `login`.
- **AC-3** The provides interface (`provides.TenantIdentityConnectionService`)
  is the only surface other modules import; the entity type and
  repository stay internal.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `pk-modules/tenant_management/features/identity_connections/service_test.go::TestCreateIdentityConnection_Success` covers tenant-scoped CRUD. |
| AC-2 | Test | `pk-modules/tenant_management/features/identity_connections/service_test.go::TestCreateIdentityConnection_Success` covers default-flag mutual exclusion per (tenant, purpose) pair. |
| AC-3 | Inspection | Module-contract check (`make check-module-contracts`) verifies that consumers (auth_management) import only `pk-modules/tenant_management/contracts/provides`, never `pk-modules/tenant_management/entities` or `pk-modules/tenant_management/features/identity_connections` directly. |

## Implements (cross-cutting)

- REQ-001 — multi-tenant isolation (AC-1).
- REQ-004 — audit per mutation (connection-lifecycle events).
- REQ-013 — integration adapters isolated (the connection record is
  the configuration handed to the chosen `AuthProvider` adapter).

## Satisfied by

- `pk-modules/tenant_management/features/identity_connections/feature.go`
- `pk-modules/tenant_management/features/identity_connections/service.go`,
  `service_test.go`
- `pk-modules/tenant_management/features/identity_connections/handler.go`,
  `routes.go`, `permissions.go`

## Related requirements

- [REQ-AUTH-006 — Auth provider](./REQ-AUTH-006-auth-provider.md) — the admin / runtime side that consumes these records.
- [REQ-AUTH-007 — SCIM provisioning](./REQ-AUTH-007-scim-provisioning.md) — uses provisioning-flagged connections.
