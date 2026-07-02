---
id: REQ-AUTH-005
title: "Policy feature evaluates ABAC rules within tenant scope and labels every cross-tenant decision"
status: Proposed
date: 2026-05-06
slug: req-auth-005-policy
category: auth
ears_pattern: ubiquitous
verification_methods: [test, inspection]
compliance: [SOC2_CC6.1, ISO27001_A.9.4]
satisfied_by:
  adr: [ADR-0009]
  conventions: [C-04, C-14]
implements_cross_cutting: [REQ-001, REQ-004, REQ-005, REQ-007]
type: doc
tags: [requirement, feature, auth_management]
module: auth_management
feature: policy
---

# REQ AUTH-005 — Policy

Status: **Proposed** (2026-05-06)

## Statement

The policy feature **shall** evaluate attribute-based access rules
against a (subject, action, resource, environment) tuple. Evaluation
**shall** default-deny when any input is missing or any attribute
fails to resolve. Policies that span tenants **shall** be labelled
explicitly (REQ-007) and audited as cross-tenant decisions.

## Rationale

Policy engines that "best-effort" their way through missing context
silently expand authorisation surface. The default-deny posture keeps
unknown-state decisions safe. Cross-tenant policy is rare and
high-risk: every such decision is a potential isolation breach if not
labelled, so the audit trail must show the platform knew it was
crossing the boundary.

## Acceptance criteria

- **AC-1** Policy evaluation with any unresolved attribute returns
  `denied` and emits `policy.evaluation.denied{reason: missing_attr}`.
- **AC-2** Policy mutations (create, update, delete) are
  tenant-scoped, audited, and reject any policy whose scope crosses
  tenants without an explicit `WithExpectedCrossTenantAccess` reason
  (REQ-007).
- **AC-3** A policy evaluation with the same inputs at the same
  point in time returns the same outcome (deterministic).
- **AC-4** Cross-tenant policy decisions emit
  `policy.evaluation.cross_tenant{reason}` audit rows that include
  the source tenant, the target tenant, and the recorded reason
  string.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `modules/platformkit-business-modules/auth_management/features/policy/service_test.go::TestValidateChangeItem` + `TestValidateChangeItemDeleteRequiresIdentity` cover the input-validation branch (delete without an identity is rejected, create requires effect + id). The change-management state machine itself (draft → submitted → approved → canary → promoted) returns typed errors at every transition; full state-machine coverage is tracked as a follow-up gap. |
| AC-2 | Test | `modules/platformkit-business-modules/auth_management/features/policy/policy_scope_test.go::TestNormalizeChangeItemPolicies_RejectsCrossTenantPolicy` — a policy whose `TenantID` does not match the change-request's tenant is rejected before persistence. |
| AC-3 | Inspection | `service_policy_codec.go::normalizePolicyForTenant` is a pure function over its inputs; `TestNormalizePolicyForTenant_BindsNamespaceAndTenant` shows that for a given `(policy, tenantID)` it produces a stable result. The state-machine transitions are guarded by typed pre-conditions on the request status (see `service.go` Submit/Approve/StartCanary/Promote/Rollback signatures); reviewers verify no clock-time-dependent outcomes outside the documented expiring-grants path. |
| AC-4 | Test | `modules/platformkit-business-modules/auth_management/features/policy/service_test.go::TestPublishPolicyEvent` proves the event-bus publish path emits a typed event with the request id, tenant, and actor. The cross-tenant-specific audit (`policy.evaluation.cross_tenant{reason}`) is currently emitted indirectly via the same publish path with the rejection reason in payload; a dedicated cross-tenant audit test is tracked as a follow-up. |

## Implements (cross-cutting)

- REQ-001 — multi-tenant isolation.
- REQ-004 — audit per mutation.
- REQ-005 — fail-closed default.
- REQ-007 — explicit cross-tenant access.

## Satisfied by

- `modules/platformkit-business-modules/auth_management/features/policy/feature.go`
- `modules/platformkit-business-modules/auth_management/features/policy/service.go`,
  `service_events.go`, `service_test.go`
- `modules/platformkit-business-modules/auth_management/features/policy/policy_scope_test.go`
- `modules/platformkit-business-modules/auth_management/features/policy/repository.go`,
  `entities.go`
- `modules/platformkit-business-modules/auth_management/features/policy/handler.go`, `routes.go`,
  `permissions.go`

## Related requirements

- [REQ-AUTH-004 — Permissions](./REQ-AUTH-004-permissions.md) — the lower-level capability check this feature composes.
- [REQ-007 — Explicit cross-tenant access](./REQ-007-explicit-cross-tenant-access.md)
