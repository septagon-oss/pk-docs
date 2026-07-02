---
id: REQ-TENANT-GATE-001
title: "Tenant mutations are classified into the three-tier change-management policy"
status: Active
date: 2026-05-10
slug: req-tenant-gate-001-tenant-three-tier-policy
category: governance
ears_pattern: ubiquitous
verification_methods:
  - test
satisfied_by:
  adr: []
  conventions: []
type: doc
tags: [requirement, tenancy, change-management]
---

# REQ TENANT-GATE-001 — Tenant mutations are classified into the three-tier change-management policy

Status: **Active** (2026-05-10)

## Statement

Every write operation exposed by `tenant_management` **shall** be
classified into one of three tiers and routed through the
`change_management` gate accordingly:

| Tier   | Examples                                              | Behaviour |
|--------|-------------------------------------------------------|-----------|
| Tier 1 | DeleteTenant, RemoveOwner, UpdateSecuritySettings, RaiseTenantLimits | `AutoApprove=false`; returns `apperrors.ApprovalRequired` until approval; logged in audit_trail on apply |
| Tier 2 | UpdateTenant (display), AddMember (non-owner), UpdateLimits (lower), CreateTenant, ArchiveTenant, RestoreTenant, workspace ops | `AutoApprove=true`; applied inline; logged in audit_trail |
| Tier 3 | ReconcileHostAliases, all reads | bypasses `change_management`; logged only when it mutates |

The classification **shall** be enforced by `tenantChangeProvider`'s
`GetChangeWorkflow(changeType)` returning the appropriate
`AutoApprove` flag per `ChangeType` discriminator
(e.g. `"Tenant.delete"`, `"TenantSettings.security"`,
`"TenantLimits.raise"`, `"TenantMember.remove.owner"`).

## Rationale

Tenant_management has 17 mutating operations. Without this
classification a single inattentive call can delete a tenant, raise
its limits, or remove an owner with no record. The three-tier policy
makes the friction proportional to blast radius — operators can
freely update display names (Tier 2) but cannot delete a tenant or
remove its last owner without approval (Tier 1).

## Acceptance criteria

- **AC-1** `tenant_management/change_provider.go` registers
  `tenantChangeProvider` and exposes the full set of `ChangeType`
  discriminators.
- **AC-2** Every Tier-1 producer method returns
  `apperrors.ApprovalRequired` when `change_management` is composed
  and no approval has been issued.
- **AC-3** Every Tier-2 producer method applies inline and emits
  `audit.change.tracked` via the producer's `ApplyChange` callback.
- **AC-4** The classification matrix is verified by
  `change_provider_test.go` with one assertion per `ChangeType`.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1, AC-4 | Test | `tenant_management/change_provider_test.go`. |
| AC-2, AC-3 | Test | `tenant_management/features/tenant_lifecycle/service_test.go`. |

## Satisfied by

- `modules/platformkit-business-modules/tenant_management/change_provider.go`
- `modules/platformkit-business-modules/tenant_management/features/tenant_lifecycle/`

## Related requirements

- [REQ-CHANGE-001](REQ-CHANGE-001-change-management-gate.md) — the
  framework this consumes.
- [REQ-001](REQ-001-multi-tenant-isolation.md) — tenant-isolation
  invariants that Tier-1 ops protect.
- [REQ-004](REQ-004-audit-event-per-mutation.md) — every tier emits
  the canonical audit event.

## References

- May 2026 tenant change-management gate landing.
