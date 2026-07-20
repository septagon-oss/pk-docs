---
id: REQ-TENANT-002
title: "Member management feature declares the membership permission set and admin-UI surface"
status: Proposed
date: 2026-05-07
slug: req-tenant-002-member-management
category: tenancy
ears_pattern: ubiquitous
verification_methods: [inspection]
compliance: []
satisfied_by:
  adr: [ADR-0009]
  conventions: [C-04, C-14]
implements_cross_cutting: [REQ-001]
type: doc
tags: [requirement, feature, tenant_management]
module: tenant_management
feature: member_management
---

# REQ TENANT-002 — Member management

Status: **Proposed** (2026-05-07)

## Statement

The member management feature **shall** declare the permission set
for tenant-membership operations (invite, accept, remove, list) and
register the corresponding admin-UI entries, **but** the underlying
data path **shall** delegate to the user and tenant lifecycle boundaries. There
is no second authorization grant store in this feature: tenant membership and
identity-role metadata establish account context, while the governed
authorization provider answers what the member may do.

## Rationale

PlatformKit models "tenant membership" as a property of the user
record and tenant lifecycle boundary, not as an authorization rule inside the
member-management UI.
This keeps the data model normalized and avoids two-source-of-truth
drift (a row in `tenant_members` that does not match the user's
`TenantID` would be a referential integrity bug). The
member_management feature exists so that admin sidebars, RBAC
catalogues, and tenant-scoped queries can be reasoned about
semantically without reaching into the user-management module.

## Acceptance criteria

- **AC-1** This feature declares membership permissions
  (`featurePermissions()`) and routes (`featureEndpoints()` if
  any), but contains no entity definition, no repository, and no
  domain service.
- **AC-2** All tenant-member queries the admin UI issues resolve through
  DTO-only user/tenant contracts. Identity-role metadata may be displayed, but
  no member-management read or mutation can create an authorization grant.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Inspection | `tenant_management/features/member_management/` has 4 files: `feature.go`, `permissions.go`, `routes.go`, `e2e.go`. No `service.go`, no `repository.go`, no `entities/`. |
| AC-2 | Inspection | Code review of the admin-UI handlers that consume the `member_management` permissions: every list/get/invite/remove path resolves through DTO-only user/tenant contracts; authorization remains a live `authz.Decider` call. |

## Implements (cross-cutting)

- REQ-001 — multi-tenant isolation (the membership concept is the
  user's tenant scope).

## Satisfied by

- `tenant_management/features/member_management/feature.go`
- `tenant_management/features/member_management/permissions.go`,
  `routes.go`, `e2e.go`

## Related requirements

- [REQ-USER-001 — User](./REQ-USER-001-user.md) — the source of
  truth for "who is in this tenant".
- [REQ-AUTH-004 — Authorization catalog](./REQ-AUTH-004-permissions.md) —
  the provider-governed boundary for "what can this member do".
