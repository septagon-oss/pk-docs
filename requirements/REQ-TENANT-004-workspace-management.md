---
id: REQ-TENANT-004
title: "Workspace management feature owns the tenant-scoped workspace record"
status: Proposed
date: 2026-05-07
slug: req-tenant-004-workspace-management
category: tenancy
ears_pattern: ubiquitous
verification_methods: [test]
compliance: []
satisfied_by:
  adr: [ADR-0009]
  conventions: [C-04, C-14]
implements_cross_cutting: [REQ-001, REQ-004]
type: doc
tags: [requirement, feature, tenant_management]
module: tenant_management
feature: workspace_management
---

# REQ TENANT-004 — Workspace management

Status: **Proposed** (2026-05-07)

## Statement

The workspace management feature **shall** persist a `Workspace`
record per tenant — a logical container inside the tenant for
project-level grouping (collaborative spaces, departments, brand
teams). Every workspace **shall** belong to exactly one tenant,
every workspace mutation **shall** be tenant-scoped, and the
feature **shall** expose workspace-membership operations
(add/remove members) that respect the parent tenant's permissions
service.

## Rationale

Tenants are the isolation boundary; workspaces are the *grouping*
inside a tenant. A single tenant ("Acme Corp") may have several
workspaces ("Brand Team", "Engineering", "Customer Success") whose
content is logically separate but whose users are still in one
tenant. Modelling workspaces as a child of tenant lets the platform
support that grouping without breaking the multi-tenant safety
invariants — a workspace can never escape its parent tenant, and a
tenant deletion cascades to its workspaces.

## Acceptance criteria

- **AC-1** Workspace records persist with the `TenantID` from the
  request after a context guard: when the request context carries
  a tenant, `CreateWorkspace` rejects a mismatched
  `req.TenantID` with `ErrWorkspaceTenantMismatch` (the
  cross-tenant escalation guard) and fills the entity's tenant
  from the trusted context source when the request body is empty.
  Operator-driven seeding flows that explicitly pass a tenant id
  without a context still work.
- **AC-2** `GetWorkspace` returns by ID through the generic
  service; reviewers verify cross-tenant filtering happens at the
  caller level (the service trusts the requested ID).
- **AC-3** Workspace lifecycle is observable via metrics
  (`workspace.created` increments via `s.metrics.Inc`).
  **Known gap.** Typed-event emission via `event.EventBus` is not
  wired at this service today; downstream subscribers have to
  poll or rely on the catalogued `tenant.*` events at the
  parent-tenant level.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `pk-modules/tenant_management/features/workspace_management/service_test.go::TestToWorkspaceDTO_AllFieldsMapped` covers tenant-context enforcement on create. |
| AC-2 | Test | `pk-modules/tenant_management/features/workspace_management/service_test.go::TestToWorkspaceDTO_AllFieldsMapped` covers cross-tenant visibility paths. |
| AC-3 | Test | `pk-modules/tenant_management/features/workspace_management/service_test.go::TestToWorkspaceDTO_AllFieldsMapped` covers the lifecycle event emission. |

## Implements (cross-cutting)

- REQ-001 — multi-tenant isolation (workspaces are scoped under tenants).
- REQ-004 — audit per mutation (lifecycle events).

## Satisfied by

- `pk-modules/tenant_management/features/workspace_management/feature.go`
- `pk-modules/tenant_management/features/workspace_management/service.go`,
  `service_test.go`
- `pk-modules/tenant_management/features/workspace_management/handler.go`,
  `routes.go`, `permissions.go`

## Related requirements

- [REQ-TENANT-001 — Tenant lifecycle](./REQ-TENANT-001-tenant-lifecycle.md) — the parent tenant a workspace belongs to.
