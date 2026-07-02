---
id: REQ-TENANT-030
title: "Identity-connection CRUD validates provider+usage compatibility and enforces tenant ownership on every read"
status: Proposed
date: 2026-05-08
slug: req-tenant-030-identity-connection-crud
category: tenant
ears_pattern: ubiquitous
priority: must
risk: high
verification_methods: [test]
compliance:
  - SOC2_CC6.1
  - ISO27001_A.9.4
  - ISO27001_A.10.1
satisfied_by:
  adr: [ADR-0009]
  conventions: [C-04, C-14]
implements_cross_cutting: [REQ-001, REQ-004, REQ-013]
refines: REQ-TENANT-005
type: doc
tags: [requirement, capability, tenant_management, identity_connection, sso, scim]
module: tenant_management
feature: identity_connections
capability: identity_connection_crud
capability_kind: inter_module_contract
stakeholders:
  - tenant administrator (configures SSO + SCIM)
  - operator (tenant-side debugging)
  - auth_provider feature (consumer of records)
---

# REQ TENANT-030 — Identity-connection CRUD

Status: **Proposed** (2026-05-08)

## Statement

The identity-connections feature **shall** be the data-owner of
the `IdentityConnection` rows that the auth-provider catalogue
(REQ-AUTH-060) surfaces. The CRUD surface **shall**:

1. **Create** — normalise the provider name (case-insensitive
   alias resolution) and status, derive the `connection_key`
   from `req.Key` or `req.Name`, refuse a duplicate
   `(tenant_id, connection_key)` pair, validate the
   provider+usage matrix (`validateUsage`), and persist the
   row;
2. **Read by id** — fetch by id, **refuse cross-tenant** by
   comparing `connection.TenantID` to the supplied
   `tenantID` argument, returning `ErrNotFound` when the
   pair does not match;
3. **Read by key** — find by `(tenant_id, connection_key)`;
   return `(nil, nil)` on miss (probe semantics for the
   admin UI);
4. **List** — return every connection for the tenant, apply
   the optional `IdentityConnectionFilter` (provider /
   status / login / provisioning toggles), sort and paginate
   the in-memory result;
5. **Update** — fetch + tenant-scope check + apply the sparse
   partial DTO (string-pointer-or-nil semantics) + re-validate
   the resulting provider+usage matrix + persist;
6. **Delete** — fetch + tenant-scope check + delete + emit
   the `tenant.identity_connection.deleted` counter;
7. **GetDefaultIdentityConnection(tenantID, purpose)** —
   return the one connection with the matching
   `DefaultLogin` or `DefaultProvisioning` flag set, or
   `(nil, nil)` if none.

Each successful mutation **shall** increment the matching
`tenant.identity_connection.{created,updated,deleted}` counter.

## Rationale

Identity connections are the keys to a tenant's identity
provider — get them wrong and the platform sends the wrong
SAML metadata, picks the wrong OIDC redirect, or routes a
SCIM webhook to the wrong tenant. Three load-bearing
disciplines:

1. **Tenant-scope on every read by id.** `GetByID` alone is
   not enough; a request that knows the connection id (e.g.
   the URL parameter) but is in a different tenant context
   must be refused. The pattern is `fetch + compare tenant +
   refuse` — REQ-001 enforcement.
2. **Provider+usage matrix is meaningful.** A SCIM provider
   cannot serve `LoginEnabled=true` (SCIM has no interactive
   login flow); a `local` provider cannot serve
   `ProvisioningEnabled=true` (local accounts are not
   provisioned externally). `validateUsage` is the single
   source of truth for these constraints, applied at create
   and at update.
3. **Default-flag uniqueness is repository-enforced.** The
   `(tenant_id, default_login)` and
   `(tenant_id, default_provisioning)` partial-unique
   constraints prevent two records from being default
   simultaneously; the service does not pre-check, the
   repository raises.

The list-side filtering and pagination are deliberately
in-memory: identity-connections per tenant are O(10) at most,
so a full fetch + filter is cheaper than a parameterised query
and avoids the SQL-injection surface that dynamic filters bring.

## Acceptance criteria

- **AC-1 — Create normalises + dedupes.** A `CreateIdentityConnection`
  call with `req.Provider="OIDC"` persists with the
  canonical lower-case provider; a duplicate
  `(tenant_id, connection_key)` returns the typed
  already-exists error.
- **AC-2 — Get by id refuses cross-tenant.** A
  `GetIdentityConnection(tenantA, connID_in_tenantB)` returns
  the typed not-found error, not the connection.
- **AC-3 — Get by key returns nil on miss.** A
  `GetIdentityConnectionByKey(t, "missing")` returns
  `(nil, nil)`, never an error.
- **AC-4 — List filter + pagination.** A list call applies
  the matching filter slice, sorts (default by name asc,
  honours filter sort hints), and paginates the in-memory
  result.
- **AC-5 — Update re-validates the matrix.** An
  `UpdateIdentityConnection` that flips
  `ProvisioningEnabled=true` on a `local` provider returns
  the validation error; the row is unchanged.
- **AC-6 — Update enforces tenant scope.** An
  `UpdateIdentityConnection(tenantA, connID_in_tenantB, …)`
  returns the typed not-found error.
- **AC-7 — Delete enforces tenant scope.** A
  `DeleteIdentityConnection(tenantA, connID_in_tenantB)`
  returns the typed not-found error.
- **AC-8 — Default lookup honours purpose.** A
  `GetDefaultIdentityConnection(t, login)` returns the one
  record with `DefaultLogin=true`; the same call with
  `provisioning` returns the one with
  `DefaultProvisioning=true` (or `(nil, nil)` if none).

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `modules/platformkit-business-modules/tenant_management/features/identity_connections/service_test.go::TestCreateIdentityConnection_Success` (canonical-form persistence) and `TestCreateIdentityConnection_RejectsUnsupportedUsage` (provider+usage matrix gate). The dedupe path is by inspection of `service.go::CreateIdentityConnection` lines 63–69; dedicated dedupe-collision test pending. |
| AC-2 | Inspection | `service.go::GetIdentityConnection` lines 113–115 — the `connection.TenantID != tenantID` check returns the typed not-found error. Dedicated cross-tenant-refuse test pending. |
| AC-3 | Inspection | `service.go::GetIdentityConnectionByKey` lines 124–132 — `(nil, nil)` on `isNotFoundError`. Dedicated probe-semantics test pending. |
| AC-4 | Test | `modules/platformkit-business-modules/tenant_management/features/identity_connections/service_test.go::TestListIdentityConnections_FiltersByPurpose` covers the filter branch; the in-memory pagination is by inspection of `service.go::paginateBounds`. |
| AC-5 | Inspection | `service.go::UpdateIdentityConnection` lines 232–234 — `validateUsage` is re-applied with the post-mutation field set. Dedicated re-validation test pending. |
| AC-6 | Inspection | `service.go::UpdateIdentityConnection` lines 175–177 — same `connection.TenantID != tenantID` guard as AC-2. Dedicated test pending. |
| AC-7 | Inspection | `service.go::DeleteIdentityConnection` lines 252–254 — same tenant-scope guard before delete. Dedicated test pending. |
| AC-8 | Test | `modules/platformkit-business-modules/tenant_management/features/identity_connections/service_test.go::TestGetDefaultIdentityConnection_NotFound` covers the miss path; the purpose-routing branch is by inspection of `service.go::GetDefaultIdentityConnection` lines 264–290. |

## Edge cases & unhappy paths

- **Empty key + empty name.** `normalizeConnectionKey("","")`
  returns the empty string; the create call refuses with
  `identity connection key is required`.
- **Provider alias.** Variations like `oidc`, `OIDC`,
  `OpenIDConnect` resolve through `normalizeProvider`; an
  unknown provider returns the typed validation error.
- **Status alias.** `active` / `Active` / `ACTIVE` all
  resolve to the canonical lower-case form; unknown
  statuses are refused.
- **Default-flag collision on create.** A second create
  with `DefaultLogin=true` for the same tenant violates
  the partial-unique constraint; the repository raises and
  the service propagates.
- **Concurrent default-flag move.** Last-write-wins; the
  uniqueness constraint serialises the writes.
- **Empty filter slice.** A `Filter` that is non-nil but
  has every slice empty returns the unfiltered list; the
  matcher treats empty slices as "no clause".
- **Delete of an in-use connection.** The connection table
  is the parent; downstream sessions / SCIM jobs that
  reference the deleted row by id surface as orphaned.
  Operators should disable login + provisioning before
  deletion (REQ-AUTH-060 AC-5 supports the disable path).

## Risk

- **Likelihood:** Medium — every IdP onboarding and edit.
- **Impact:** Critical — a connection bound to the wrong
  tenant routes another tenant's users through the wrong
  IdP.
- **Mitigations:** Per-read tenant-scope check (AC-2, AC-6,
  AC-7), provider+usage matrix validation (AC-1, AC-5),
  unique-constraint-as-truth on key + default flags.

## Implements (cross-cutting)

- **REQ-001 — Multi-tenant isolation.** AC-2 / AC-6 / AC-7
  are the explicit guards.
- **REQ-004 — Audit per mutation.** Each successful
  mutation emits the catalogued
  `auth.provider.{linked,unlinked}` event upstream and
  records the metric.
- **REQ-013 — Integration adapters isolated.** The
  connection record is the configuration handed to the
  `AuthProvider` adapter; the adapter never reads its own
  configuration.

## Compliance mapping

| Control | Coverage |
|---|---|
| SOC2 CC6.1 (Logical access) | AC-2 / AC-6 / AC-7 — tenant-scoped IdP-record management. |
| ISO27001 A.9.4 (System and application access control) | AC-1 + AC-5 — validated configuration of identity providers. |
| ISO27001 A.10.1 (Cryptographic controls) | AC-1 — `CredentialReference` field carries pointer to secret material; this surface never reads the secret. |

## Satisfied by

- `modules/platformkit-business-modules/tenant_management/features/identity_connections/service.go::CreateIdentityConnection, GetIdentityConnection, GetIdentityConnectionByKey, ListIdentityConnections, UpdateIdentityConnection, DeleteIdentityConnection, GetDefaultIdentityConnection`.

## Related requirements

- [REQ-TENANT-005 — Identity connections umbrella](./REQ-TENANT-005-identity-connections.md)
- [REQ-AUTH-060 — Auth-provider catalogue](./REQ-AUTH-060-auth-provider-catalogue.md) — the consumer that surfaces these records as the admin CRUD surface.
- [REQ-AUTH-061 — Connection runtime test](./REQ-AUTH-061-connection-runtime-test.md) — the test harness that exercises the configured adapter using these records.
