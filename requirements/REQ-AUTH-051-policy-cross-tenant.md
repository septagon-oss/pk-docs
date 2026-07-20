---
id: REQ-AUTH-051
title: "Policy validation refuses cross-tenant policy bodies and binds every policy to the request's tenant"
status: Proposed
date: 2026-05-08
slug: req-auth-051-policy-cross-tenant
category: auth
ears_pattern: ubiquitous
priority: must
risk: critical
verification_methods: [test]
compliance:
  - SOC2_CC6.1
  - ISO27001_A.9.4
satisfied_by:
  adr: [ADR-0009]
  conventions: [C-04, C-14]
implements_cross_cutting: [REQ-001, REQ-007]
refines: REQ-AUTH-005
type: doc
tags: [requirement, capability, auth_management, policy, cross-tenant]
module: auth_management
feature: policy
capability: cross_tenant_guard
capability_kind: failure_mode
stakeholders:
  - tenant administrator (proposing policy)
  - operator (cross-tenant write requires explicit operator credential)
  - compliance auditor (isolation evidence)
---

# REQ AUTH-051 — Policy cross-tenant guard

Status: **Proposed** (2026-05-08)

## Statement

Every policy body submitted as part of a change request
**shall** be normalised to the request's tenant id before
persistence: the `TenantID` field **shall** be set to the
request tenant, and the `Namespaces` set **shall** contain
exactly the request tenant. **If** a submitted policy body
declares a `TenantID` that does not match the change request's
tenant, the validation **shall** refuse the change request
with a typed cross-tenant error.

## Rationale

Policies live alongside the resources they govern; a policy
written for tenant A and accidentally bound to tenant B would
either deny tenant B's users access to their own resources or
grant tenant A's users access to tenant B's resources — both
catastrophic isolation breaches.

The two-step discipline (refuse mismatched + force-bind to
request tenant) handles both the malicious case (an operator
trying to escalate cross-tenant) and the accidental case (a
copy-paste leftover in a JSON policy body). The "refuse + bind"
shape is the safer default than "bind silently" — it surfaces
the operator's mistake at submit time rather than letting a
defective policy land in production.

Cross-tenant policies (operator-mediated, e.g. for a
platform-wide entitlement) flow through a different, explicit
code path with the `WithExpectedCrossTenantAccess` marker
(REQ-007); this REQ scopes to the regular tenant-administrator
surface.

## Acceptance criteria

- **AC-1 — Force-bind to request tenant.** A change-item whose
  policy body has an empty `TenantID` is normalised to the
  request's tenant id before persistence.
- **AC-2 — Refuse cross-tenant body.** A change-item whose
  policy body declares a `TenantID` matching neither the
  request tenant nor an empty value is refused with the
  typed cross-tenant error; the change request is rejected
  in its entirety.
- **AC-3 — Force-bind namespace set.** The persisted
  `Namespaces` set contains exactly the request tenant id;
  any other entries the body declared are stripped.
- **AC-4 — Operator-mediated cross-tenant.** The
  `WithExpectedCrossTenantAccess` operator path bypasses
  AC-2 with the explicit reason recorded in the audit row;
  this REQ scopes to the non-operator path.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `modules/platformkit-business-modules/auth_management/features/policy/policy_scope_test.go::TestValidatePolicyForTenantRequiresExplicitNamespaceAndTenant`. |
| AC-2 | Test | `modules/platformkit-business-modules/auth_management/features/policy/policy_scope_test.go::TestValidateChangeItemPoliciesRejectsCrossTenantPolicy`. |
| AC-3 | Test | `modules/platformkit-business-modules/auth_management/features/policy/policy_scope_test.go::TestValidatePolicyForTenantRequiresExplicitNamespaceAndTenant` asserts the namespaces. |
| AC-4 | Inspection | The operator code path lives outside this REQ; reviewers verify `service.go` does not mix the two surfaces. |

## Edge cases & unhappy paths

- **Empty namespace set.** A body without a Namespaces
  field is force-bound to `{request_tenant}`.
- **Capitalised tenant ids.** The platform stores tenant
  ids as canonical UUIDs; normalisation includes a
  case-insensitive compare so the trade is immune to
  case-skew.
- **Tenant-deactivated mid-flow.** A change submitted
  against a now-archived tenant is refused at the change
  service level; this REQ's normalisation runs after that
  pre-check.
- **Multiple change items per request.** Each item is
  normalised independently; one rejected item rejects the
  whole request (atomic).

## Risk

- **Likelihood:** Medium — exercised on every policy
  submission.
- **Impact:** Critical — a defective normalisation is a
  cross-tenant authz breach.
- **Mitigations:** Refuse-and-record posture (AC-2),
  force-bind ergonomic (AC-1 + AC-3), operator-explicit
  override (AC-4).

## Implements (cross-cutting)

- **REQ-001 — Multi-tenant isolation.** AC-1..AC-3 are the
  isolation enforcement at the policy layer.
- **REQ-007 — Explicit cross-tenant access.** AC-4 — every
  cross-tenant write is gated by the explicit reason marker.

## Compliance mapping

| Control | Coverage |
|---|---|
| SOC2 CC6.1 | AC-1..AC-3 — tenant-bound authorization data. |
| ISO27001 A.9.4 | AC-2 — cross-tenant access prevention. |

## Satisfied by

- `modules/platformkit-business-modules/auth_management/features/policy/service_policy_codec.go::normalizePolicyForTenant` —
  the normalisation primitive.
- `modules/platformkit-business-modules/auth_management/features/policy/service_policy_codec.go::normalizeChangeItemPolicies` —
  the per-item caller.

## Related requirements

- [REQ-AUTH-005 — Policy umbrella](./REQ-AUTH-005-policy.md)
- [REQ-AUTH-050 — Policy state machine](./REQ-AUTH-050-policy-state-machine.md)
- [REQ-007 — Explicit cross-tenant access](./REQ-007-explicit-cross-tenant-access.md) — the cross-cutting discipline AC-4 honours.
