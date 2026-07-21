---
id: REQ-TENANT-040
title: "Workspace management binds workspaces to the request tenant context, refuses cross-tenant body overrides, and counts every transition"
status: Proposed
date: 2026-05-08
slug: req-tenant-040-workspace-management
category: tenant
ears_pattern: ubiquitous
priority: must
risk: high
verification_methods: [test]
compliance:
  - SOC2_CC6.1
  - SOC2_CC8.1
  - ISO27001_A.18.1.3
satisfied_by:
  adr: [ADR-0009]
  conventions: [C-04, C-14]
implements_cross_cutting: [REQ-001, REQ-009]
refines: REQ-TENANT-004
type: doc
tags: [requirement, capability, tenant_management, workspace, lifecycle]
module: tenant_management
feature: workspace
capability: workspace
capability_kind: state_machine
stakeholders:
  - tenant administrator (creates workspaces)
  - operator (archives stale workspaces)
  - end-user (consumes workspace-scoped data)
---

# REQ TENANT-040 — Workspace management

Status: **Proposed** (2026-05-08)

## Statement

The workspace feature **shall** expose:

1. **`CreateWorkspace(req)`** — refuse a request whose
   `TenantID` body field does not match the tenant
   resolved from the request context (cross-tenant
   escalation guard); fill the body's `TenantID` from
   the context when the body field is empty;
2. **`UpdateWorkspace(id, req)`** — apply a sparse
   partial DTO (each pointer field is honoured only when
   non-nil; nil leaves the column untouched);
3. **`ArchiveWorkspace(id)`** — set
   `Status = WorkspaceStatusArchived` + stamp
   `ArchivedAt = now`; preserves the row;
4. **`RestoreWorkspace(id)`** — set
   `Status = WorkspaceStatusActive`; reverses archive;
5. **`DeleteWorkspace(id)`** — hard delete via the
   underlying CRUD service.

Each successful transition **shall** increment the matching
metric: `workspace.created`, `workspace.updated`,
`workspace.archived`, `workspace.restored`,
`workspace.deleted`.

The `toWorkspaceDTO` mapper **shall** populate every field of
the DTO from the entity; the caller never sees a partially-
populated workspace.

## Rationale

Workspaces are the within-tenant grouping primitive (e.g.,
"Engineering team" + "Marketing team" within one tenant).
Three properties:

1. **Tenant-pin from context.** REQ-001 enforcement at
   the workspace surface — a tenant-A admin must not be
   able to send a body with `TenantID: tenantB` and
   create a workspace under another tenant. The context
   is the only trustworthy source.
2. **Sparse update + status flips preserve data.** Same
   discipline as REQ-TENANT-011 (tenant update + archive)
   — the partial-DTO and read-mutate-write status flip
   keep every other column intact.
3. **Per-transition metrics.** Operators' workspace
   throughput dashboards rely on per-state counters;
   a single generic counter would lose the lifecycle
   shape.

## Acceptance criteria

- **AC-1 — Default visibility private.** A
  `CreateWorkspace` without `Visibility` set persists
  with `Visibility = WorkspaceVisibilityPrivate`.
- **AC-2 — Explicit visibility honoured.** A request
  with `Visibility: public` persists with the
  caller-supplied value.
- **AC-3 — Reject cross-tenant body override.** A
  `CreateWorkspace` whose `TenantID` differs from the
  request-context tenant returns
  `ErrWorkspaceTenantMismatch` and does not persist.
- **AC-4 — Fill tenant from context when body
  empty.** A `CreateWorkspace` with empty
  `TenantID` is filled from the request-context
  tenant before persistence.
- **AC-5 — Update sparse partial.** A
  `UpdateWorkspace` with only `Name` set leaves
  `Description`, `Visibility`, `Icon`, `Metadata`
  untouched.
- **AC-6 — Update only-name.** A name-only update
  produces a row whose other columns are unchanged
  from the pre-image.
- **AC-7 — Update visibility.** A
  `UpdateWorkspace` flipping `Visibility` from
  private to public persists the new value.
- **AC-8 — Update metadata replaced.** When the
  request supplies `Metadata`, the persisted map
  replaces the prior map (no merge).
- **AC-9 — Archive sets status + timestamp.** A
  `ArchiveWorkspace` flips
  `Status = Archived` and stamps `ArchivedAt`.
- **AC-10 — Restore reactivates.** A
  `RestoreWorkspace` flips `Status = Active`.
- **AC-11 — Per-transition metric increments.**
  Each successful transition (`Create`, `Archive`,
  `Restore`, `Delete`) increments its dedicated
  counter.
- **AC-12 — DTO mapper populates every field.** A
  populated entity round-trips through
  `toWorkspaceDTO` with every field mirrored.
- **AC-13 — Create error propagation.** A
  CRUD-layer create error returns the wrapped
  error.
- **AC-14 — Get error propagation.** A
  CRUD-layer get error returns the wrapped error.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `pk-modules/tenant_management/features/workspace/service_test.go::TestService_CreateWorkspace_DefaultVisibilityPrivate`. |
| AC-2 | Test | `pk-modules/tenant_management/features/workspace/service_test.go::TestService_CreateWorkspace_ExplicitVisibility`. |
| AC-3 | Test | `pk-modules/tenant_management/features/workspace/service_test.go::TestService_CreateWorkspace_RejectsCrossTenantBodyOverride`. |
| AC-4 | Test | `pk-modules/tenant_management/features/workspace/service_test.go::TestService_CreateWorkspace_FillsTenantFromContextWhenBodyEmpty`. |
| AC-5 | Test | `pk-modules/tenant_management/features/workspace/service_test.go::TestService_UpdateWorkspace_NilFieldsIgnored`. |
| AC-6 | Test | `pk-modules/tenant_management/features/workspace/service_test.go::TestService_UpdateWorkspace_OnlyNameUpdated`. |
| AC-7 | Test | `pk-modules/tenant_management/features/workspace/service_test.go::TestService_UpdateWorkspace_VisibilityChanged`. |
| AC-8 | Test | `pk-modules/tenant_management/features/workspace/service_test.go::TestService_UpdateWorkspace_MetadataReplaced`. |
| AC-9 | Test | `pk-modules/tenant_management/features/workspace/service_test.go::TestService_ArchiveWorkspace_SetsArchivedStatus` and `TestService_ArchiveWorkspace_SetsArchivedAt`. |
| AC-10 | Test | `pk-modules/tenant_management/features/workspace/service_test.go::TestService_RestoreWorkspace_SetsActiveStatus`. |
| AC-11 | Test | `pk-modules/tenant_management/features/workspace/service_test.go::TestService_CreateWorkspace_IncrementsMetric`, `TestService_ArchiveWorkspace_IncrementsMetric`, `TestService_RestoreWorkspace_IncrementsMetric`, `TestService_DeleteWorkspace_IncrementsMetric`. |
| AC-12 | Test | `pk-modules/tenant_management/features/workspace/service_test.go::TestToWorkspaceDTO_AllFieldsMapped`. |
| AC-13 | Test | `pk-modules/tenant_management/features/workspace/service_test.go::TestService_CreateWorkspace_ErrorPropagation`. |
| AC-14 | Test | `pk-modules/tenant_management/features/workspace/service_test.go::TestService_GetWorkspace_ErrorPropagation`. |

## Edge cases & unhappy paths

- **Empty Visibility but non-empty body.** The
  default-private branch (AC-1) applies before the
  explicit-visibility branch (AC-2).
- **Concurrent archive + restore.** Last-write-wins
  on the row.
- **Update of an archived workspace.** Currently
  allowed (the update touches columns; status
  remains).
- **Delete on workspace with members.** The
  underlying CRUD service decides cascade vs block;
  operators should archive first.

## Risk

- **Likelihood:** Medium — every workspace
  lifecycle transition.
- **Impact:** High — cross-tenant body override
  (AC-3) is the explicit privilege-escalation guard.
- **Mitigations:** Tenant-pin (AC-3, AC-4), sparse
  update (AC-5..AC-8), per-transition metrics
  (AC-11).

## Implements (cross-cutting)

- **REQ-001 — Multi-tenant isolation.** AC-3, AC-4
  are the explicit guards.
- **REQ-009 — Observability.** AC-11 — counters
  per transition.

## Compliance mapping

| Control | Coverage |
|---|---|
| SOC2 CC6.1 (Logical access) | AC-3 — cross-tenant escalation refused. |
| SOC2 CC8.1 (Change management) | AC-9, AC-10 — controlled archive / restore. |
| ISO27001 A.18.1.3 (Records management) | AC-9 — archive preserves the workspace row. |

## Satisfied by

- `pk-modules/tenant_management/features/workspace/service.go::CreateWorkspace, UpdateWorkspace, ArchiveWorkspace, RestoreWorkspace, DeleteWorkspace, ListWorkspaces, toWorkspaceDTO, ErrWorkspaceTenantMismatch`.

## Related requirements

- [REQ-TENANT-004 — Workspace management](./REQ-TENANT-004-workspace-management.md)
- [REQ-TENANT-010 — Tenant create](./REQ-TENANT-010-tenant-create.md)
- [REQ-TENANT-011 — Tenant update + archive](./REQ-TENANT-011-tenant-update-archive.md)
- [REQ-001 — Multi-tenant isolation](./REQ-001-multi-tenant-isolation.md)
