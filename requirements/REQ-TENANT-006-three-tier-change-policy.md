---
id: REQ-TENANT-006
title: "Tenant mutations are classified into the three-tier change-management policy"
status: Active
date: 2026-05-10
slug: req-tenant-006-three-tier-change-policy
category: governance
ears_pattern: ubiquitous
verification_methods:
  - test
satisfied_by:
  adr: []
  conventions: []
implements_cross_cutting: [REQ-001, REQ-004, REQ-005]
type: doc
tags: [requirement, tenancy, change-management]
module: tenant_management
feature: three_tier_change_policy
---

# REQ TENANT-006 — Tenant mutations are classified into the three-tier change-management policy

Status: **Active** (2026-05-10)

## Statement

Every write operation exposed by `tenant_management` **shall** be
classified into one of three tiers and routed through the
`change_management` gate accordingly:

| Tier   | Examples                                              | Behaviour |
|--------|-------------------------------------------------------|-----------|
| Tier 1 | DeleteTenant, RemoveOwner, UpdateSecuritySettings, RaiseTenantLimits | `AutoApprove=false`; returns the typed pending-approval error until approval; persists the gate decision in a `ChangeRecord` |
| Tier 2 | UpdateTenant (display), AddMember (non-owner), UpdateLimits (lower), CreateTenant, ArchiveTenant, RestoreTenant, workspace ops | `AutoApprove=true`; applies inline and persists an applied `ChangeRecord` |
| Tier 3 | ReconcileHostAliases, all reads | bypasses `change_management`; producer-owned metrics/events remain responsible for observable mutations |

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
- **AC-2** Every Tier-1 producer method returns the typed pending-approval
  error when no approval has been issued. Change management is mandatory for
  every composition that includes tenant_management.
- **AC-3** Every Tier-2 producer method routes through the gate and
  applies inline when its classified workflow has `AutoApprove=true`.
- **AC-4** The classification matrix is verified by
  `change_provider_test.go` with one assertion per `ChangeType`.
- **AC-5** Missing change-management wiring fails closed before every
  governed tenant side effect; no public mutation path calls an applier
  directly.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `modules/platformkit-business-modules/tenant_management/change_provider_test.go::TestProviderClaimsTenantEntityTypes`. |
| AC-2 | Test | `modules/platformkit-business-modules/tenant_management/features/tenant_lifecycle/service_change_routing_test.go::TestDeleteTenantTier1ReturnsPendingApprovalError`. |
| AC-3 | Test | `modules/platformkit-business-modules/tenant_management/features/tenant_lifecycle/service_change_routing_test.go::TestArchiveTenantStampsTier2ChangeType`. |
| AC-4 | Test | `modules/platformkit-business-modules/tenant_management/change_provider_test.go::TestTier1ClassificationRequiresApproval` and `modules/platformkit-business-modules/tenant_management/change_provider_test.go::TestTier2ClassificationAutoApproves`. |
| AC-5 | Test | `modules/platformkit-business-modules/tenant_management/features/tenant_lifecycle/service_change_routing_test.go::TestGovernedTenantMutationsFailClosedWithoutChangeService` proves missing gate wiring never falls through to a direct mutation. |

## Satisfied by

- `modules/platformkit-business-modules/tenant_management/change_provider.go`
- `modules/platformkit-business-modules/tenant_management/features/tenant_lifecycle/`

## Related requirements

- [REQ-CHANGE-001](REQ-CHANGE-001-change-management-gate.md) — the
  framework this consumes.
- [REQ-001](REQ-001-multi-tenant-isolation.md) — tenant-isolation
  invariants that Tier-1 ops protect.
- [REQ-004](REQ-004-audit-event-per-mutation.md) — producer-owned
  mutation paths retain their normal audit obligations independently
  of the gate's `ChangeRecord` ledger.

## References

- May 2026 tenant change-management gate landing.
