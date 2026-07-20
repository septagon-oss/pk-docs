---
id: REQ-AUTH-040
title: "Permission checks delegate one exact tenant-scoped decision and fail closed"
status: Proposed
date: 2026-07-20
slug: req-auth-040-permission-check
category: auth
ears_pattern: unwanted-behaviour
priority: must
risk: critical
verification_methods: [test, inspection]
compliance: [SOC2_CC6.1, SOC2_CC6.3, ISO27001_A.9.4, NIST_AC-3]
satisfied_by:
  adr: [ADR-0009, ADR-0061]
  conventions: [C-04, C-14, C-21]
implements_cross_cutting: [REQ-001, REQ-005]
refines: REQ-AUTH-004
type: doc
tags: [requirement, capability, auth_management, authorization, topaz]
module: auth_management
feature: permissions
capability: check_permission
capability_kind: failure_mode
---

# REQ AUTH-040 — Governed permission decision

Status: **Proposed** (2026-07-20)

## Statement

`Service.CheckPermission(ctx, principalID, tenantID, permission)` **shall**
require a concrete tenant and principal, parse the canonical
`resource:action` token, select the authenticated user or API-key principal
kind from trusted request context, and delegate exactly one
`authz.Decision{Subject, Action, Resource, Tenant}` to the configured
`authz.Decider`. Missing or malformed input, an ineligible account, a denied
verdict, unavailable activation evidence, or a provider error **shall never**
produce allow.

## Rationale

The application must not reinterpret provider policy. Exact decision tuples
keep policy semantics centralized, make tenant boundaries reviewable, and
prevent stale SQL roles or JWT claims from becoming an accidental fallback.
Returning `false` alongside operational errors preserves fail-closed behavior
even in callers that inspect the boolean first.

## Acceptance criteria

- **AC-1 — Exact tuple.** A valid request forwards the canonical typed subject,
  action, resource, and explicit tenant unchanged to the decider.
- **AC-2 — Concrete scope.** Empty and unscoped tenant IDs, empty principals,
  malformed permission tokens, and subject-set principals are rejected before
  provider evaluation.
- **AC-3 — Trusted principal kind.** A verified API-key request evaluates as
  `api_key:<id>`; otherwise the service evaluates `user:<id>`. Body-supplied
  identity cannot change the authenticated principal kind.
- **AC-4 — Provider failures deny.** A decider error returns `(false, err)` and
  no local repository, role claim, wildcard matcher, or cached grant is
  consulted as fallback.
- **AC-5 — Account ceiling.** A matching authenticated guest/inactive user is
  denied before the provider call.
- **AC-6 — Stable semantics.** Repeated identical tuples against unchanged,
  freshly attested provider state return the provider's same verdict.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `modules/platformkit-business-modules/auth_management/features/permissions/service_crosstenant_test.go::TestCheckPermissionDelegatesExactPrincipalAndTenantToGovernedProvider`. |
| AC-2 | Test | `modules/platformkit-business-modules/auth_management/features/permissions/service_test.go::TestService_GetUserRolesRequiresConcreteTenant`, permission-token tests in `core/platformkit-backend-kit/security/authz/permission_tokens_test.go`, and Topaz canonical-input tests. |
| AC-3 | Test | `modules/platformkit-business-modules/auth_management/features/permissions/service_test.go::TestService_CheckPermission_APIKeyPrincipalUsesGovernedDecisionPlane`. |
| AC-4 | Test | `modules/platformkit-business-modules/auth_management/features/permissions/session_evaluator_topaz_test.go::TestSessionPermissionEvaluatorDeciderErrorsFailClosed`. |
| AC-5 | Test | `modules/platformkit-business-modules/auth_management/features/permissions/service_crosstenant_test.go::TestCheckPermissionGuestCeilingSkipsPrivilegedBindings`. |
| AC-6 | Test | `modules/platformkit-business-modules/auth_management/features/permissions/req_auth_004_test.go::TestCheckPermissionIsDeterministic`. |

## Edge cases & unhappy paths

- Topaz may return deny normally; deny is not converted into an operational
  error.
- Missing or stale policy-release attestation closes the Topaz decision gate
  before an allow can reach the caller.
- API-key permissions stored on the credential cap what can be requested, but
  the live governed decision remains authoritative at enforcement time.

## Compliance mapping

| Control | Coverage |
|---|---|
| SOC2 CC6.1 / CC6.3 | AC-1..AC-6 — centralized, tenant-scoped logical access enforcement. |
| ISO27001 A.9.4 | AC-2, AC-4, AC-5 — invalid or unavailable authority denies. |
| NIST AC-3 | AC-1..AC-6 — explicit policy enforcement through one decision seam. |

## Satisfied by

- `core/platformkit-ports/authz.Decider`
- `core/platformkit-integrations/topaz`
- `modules/platformkit-business-modules/auth_management/features/permissions/service.go`
- `modules/platformkit-business-modules/auth_management/features/permissions/session_evaluator.go`

## Related requirements

- [REQ-AUTH-004 — Authorization catalog](./REQ-AUTH-004-permissions.md)
- [REQ-AUTH-005 — Policy control plane](./REQ-AUTH-005-policy.md)
- [REQ-005 — Fail-closed authorization](./REQ-005-authorisation-fails-closed.md)
- [REQ-PORTS-014 — Authorization contract](./REQ-PORTS-014-authorization-contract.md)
