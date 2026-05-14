---
id: REQ-TENANT-011
title: "Tenant update applies a sparse partial DTO; archive flips status without deleting the row"
status: Proposed
date: 2026-05-08
slug: req-tenant-011-tenant-update-archive
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
implements_cross_cutting: [REQ-001, REQ-004, REQ-009]
refines: REQ-TENANT-001
type: doc
tags: [requirement, capability, tenant_management, tenant_lifecycle, update, archive]
module: tenant_management
feature: tenant_lifecycle
capability: tenant_update_archive
capability_kind: state_machine
stakeholders:
  - operator (renames / re-domains a tenant)
  - tenant administrator (edits tenant profile)
  - compliance auditor (off-boarding control)
---

# REQ TENANT-011 — Tenant update, archive, and restore

Status: **Proposed** (2026-05-08)

## Statement

The tenant lifecycle feature **shall** expose three mutation
operations:

1. **`UpdateTenant(tenantID, req)`** — apply the sparse partial
   DTO. Each pointer field (`Name`, `Type`, `Status`, `Logo`,
   `Domain`, `Description`, `Metadata`) is honored only if
   non-nil; nil pointers leave the corresponding column
   untouched. On success, increment `tenant.updated`.
2. **`ArchiveTenant(tenantID)`** — read the row, set
   `Status = TenantStatusArchived`, persist. The row remains
   queryable through cross-tenant admin paths but **shall be**
   refused by `ResolveTenantByHost` (REQ-TENANT-012).
3. **`RestoreTenant(tenantID)`** — read the row, set
   `Status = TenantStatusActive`, clear `ArchivedAt`, persist.

`DeleteTenant(tenantID)` performs a hard delete via the
generic CRUD service and increments `tenant.deleted`. Operators
**shall** prefer `ArchiveTenant` for any tenant with historical
audit / billing / member data; hard delete is reserved for
cancellations within the cooling-off window.

## Rationale

Tenants accumulate deep cross-module state — audit rows,
sessions, billing entries, content, members. Three pressures
shape this surface:

1. **Sparse update is the only safe edit shape.** A tenant
   record carries fields edited from many places (admin UI
   rename, ops domain swap, API metadata patch). A
   "replace-the-row" surface would let any caller blow away
   a field they didn't even see; the pointer-or-nil DTO
   forces explicit intent per field.
2. **Archive ≠ delete.** Once a tenant has produced audit
   rows, deleting it leaves orphaned references in compliance
   exports. Archive flips status only — the row remains
   joinable from audit / billing exports while public traffic
   is refused.
3. **Restore reverses archive cleanly.** `ArchivedAt` is
   cleared on restore so downstream consumers cannot get
   confused by a tenant that is "active" but still timestamped
   as archived. The two fields move together.

The three operations form a small state machine —
`active ↔ archived` (round-trippable) and `active → deleted`
(terminal, hard delete). Update edits attributes within the
active state and is forbidden once a tenant is fully deleted
(repository returns `ErrNotFound`).

## Acceptance criteria

- **AC-1 — Sparse update honours nil semantics.** An
  `UpdateTenantRequest` with only `Name` set leaves
  `Type`, `Status`, `Logo`, `Domain`, `Description`,
  `Metadata` untouched on the persisted row.
- **AC-2 — Update increments metric.** A successful update
  increments `tenant.updated`; an error skips the metric.
- **AC-3 — Archive flips status, preserves data.** After
  `ArchiveTenant`, the row's `Status == TenantStatusArchived`
  and every other column (members, settings, host aliases) is
  unchanged.
- **AC-4 — Restore re-activates and clears `ArchivedAt`.**
  `RestoreTenant` sets `Status = Active` and `ArchivedAt =
  nil`; the metric counterpart is the underlying repository's,
  not a tenant-level metric.
- **AC-5 — Delete increments metric + hard-removes.**
  `DeleteTenant` calls the generic delete (a hard remove,
  including from list queries) and increments
  `tenant.deleted`.
- **AC-6 — Update on missing tenant returns wrapped not-found.**
  All four operations return
  `fmt.Errorf("…: %w", err)` when the underlying repository
  returns `ErrNotFound`, preserving error-Is checking.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `pk-modules/tenant_management/features/tenant_lifecycle/service_test.go::TestUpdateTenant_PartialUpdate` and `TestUpdateTenant_Success` — assert unset pointer fields leave columns untouched. |
| AC-2 | Inspection | `service.go::UpdateTenant` lines 176–178 — `s.metrics.Inc(ctx, "tenant.updated", nil)` is gated on `err == nil`. Dedicated metric-on-failure test pending. |
| AC-3 | Test | `pk-modules/tenant_management/features/tenant_lifecycle/service_test.go::TestArchiveTenant_Success` — asserts `Status` flips to `TenantStatusArchived`. |
| AC-4 | Test | `pk-modules/tenant_management/features/tenant_lifecycle/service_test.go::TestRestoreTenant_Success` — asserts `Status` flips back to `TenantStatusActive` and `ArchivedAt` is cleared. |
| AC-5 | Test | `pk-modules/tenant_management/features/tenant_lifecycle/service_test.go::TestDeleteTenant_Success` and `TestDeleteTenant_Error`. The metric increment is by inspection at `service.go::DeleteTenant` lines 187–189. |
| AC-6 | Test | `pk-modules/tenant_management/features/tenant_lifecycle/service_test.go::TestUpdateTenant_NotFound` and `TestArchiveTenant_NotFound` — wrapped not-found propagation. The remaining mutations (Restore, Delete) propagate via the same wrap-on-`GetByID`-error pattern (inspection of `service.go`). |

## Edge cases & unhappy paths

- **Update during archive.** Editing an archived tenant is
  permitted (operators may edit the archive metadata before
  full delete). The status field can be touched alongside
  other fields if the caller intends a hand-rolled restore.
- **Domain collision on update.** A `Domain` change to a
  value already owned by another tenant produces a
  uniqueness error from the repository; the service propagates
  it. Cross-tenant domain reassignment is operator-mediated
  via the host-alias reconciler (REQ-TENANT-012).
- **Concurrent archive + update.** Last-write-wins. The
  archive write does not overwrite a same-instant
  description edit because it reads → mutates → writes,
  so a racing description change is lost. Documented;
  out-of-band ops should drain in-flight admin sessions
  before archive.
- **Delete on a tenant with members.** The repository's
  cascade rules decide; the service does not pre-empt or
  warn. Operators should archive first.
- **Restore on a never-archived tenant.** The operation is a
  no-op-with-write — `Status` was already `Active` and
  `ArchivedAt` was already `nil`. The audit ledger records
  the no-op.

## Risk

- **Likelihood:** Medium — operator-driven; exercised on rename
  / domain swap / off-boarding.
- **Impact:** High — a defective archive that lets a dormant
  tenant keep serving public traffic is a data-leak vector.
- **Mitigations:** Status-only archive (AC-3) + host resolver
  refusing inactive tenants (REQ-TENANT-012) + sparse update
  semantics (AC-1).

## Implements (cross-cutting)

- **REQ-001 — Multi-tenant isolation.** AC-3 — archive is the
  isolation-by-state mechanism.
- **REQ-004 — Audit per mutation.** Indirect — the underlying
  generic CRUD service's audit hooks fire on each persist.
- **REQ-009 — Observability.** AC-2 + AC-5 — counters per
  operation.

## Compliance mapping

| Control | Coverage |
|---|---|
| SOC2 CC6.1 (Logical access) | AC-3 — archived tenant cannot serve traffic. |
| SOC2 CC8.1 (Change management) | AC-1 — partial updates auditable per-field. |
| ISO27001 A.18.1.3 (Records management) | AC-3 + AC-5 — soft-delete preserves audit lineage; hard delete reserved for cooling-off cancellations. |

## Satisfied by

- `pk-modules/tenant_management/features/tenant_lifecycle/service.go::UpdateTenant, ArchiveTenant, RestoreTenant, DeleteTenant`.

## Related requirements

- [REQ-TENANT-001 — Tenant lifecycle](./REQ-TENANT-001-tenant-lifecycle.md)
- [REQ-TENANT-010 — Tenant create](./REQ-TENANT-010-tenant-create.md)
- [REQ-TENANT-012 — Host alias resolution](./REQ-TENANT-012-host-alias-resolution.md) — the public-traffic gate that consumes the archived-status flag.
