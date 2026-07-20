---
id: REQ-AUTH-004
title: "Authorization catalog remains descriptive while governed providers own every grant and decision"
status: Proposed
date: 2026-07-20
slug: req-auth-004-permissions
category: auth
ears_pattern: ubiquitous
verification_methods: [test, analysis]
compliance: [SOC2_CC6.1, ISO27001_A.9.4]
satisfied_by:
  adr: [ADR-0009, ADR-0061]
  conventions: [C-04, C-14, C-21]
implements_cross_cutting: [REQ-001, REQ-004, REQ-005]
type: doc
tags: [requirement, feature, auth_management, authorization, topaz]
module: auth_management
feature: permissions
---

# REQ AUTH-004 — Authorization catalog

Status: **Proposed** (2026-07-20)

## Statement

The permissions feature **shall** expose the canonical permission-token and
identity-role catalogs needed for discovery, but those catalogs **shall not**
act as authorization grant stores. Every authorization outcome **shall** be
obtained through the provider-neutral `authz.Decider` contract with one exact
subject, action, resource, and tenant. Authorization relationships **shall** be
managed through the configured directory provider; SQL role metadata, session
role claims, and UI state shall never imply a grant.

## Rationale

A catalog answers “what may be requested”; it does not answer “who may do it.”
Keeping that boundary explicit prevents a second, silently divergent RBAC
engine from emerging beside Topaz. It also lets the Admin UI and the provider's
own console operate on the same directory data and optimistic-concurrency
contract.

## Acceptance criteria

- **AC-1 — One decision authority.** Production permission checks delegate the
  exact tuple to `platformkit-ports/authz.Decider`; no SQL role-permission
  matcher or role-claim shortcut may return allow.
- **AC-2 — Descriptive catalogs only.** The Admin permission surface is
  read-only and clearly identifies policy and directory management as the
  grant authority. It exposes no role-permission matrix or grant mutation.
- **AC-3 — No local grant schema.** Current code and seeds do not read or write
  `permissions` or `role_permissions`; the forward migration retires both
  tables without a compatibility path.
- **AC-4 — Shared directory state.** Admin directory reads and writes use
  `authz.DirectoryManager`, exact active-tenant object IDs, and ETags. A write
  made in Topaz Console is therefore visible in Admin UI, and a stale Admin UI
  write conflicts instead of overwriting it.
- **AC-5 — Authentication ceilings precede authorization.** Guest/inactive
  account state denies before the provider is consulted, so a stale directory
  relation cannot revive an ineligible principal.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `modules/platformkit-business-modules/auth_management/features/permissions/service_crosstenant_test.go::TestCheckPermissionDelegatesExactPrincipalAndTenantToGovernedProvider` and `session_evaluator_topaz_test.go::TestSessionPermissionEvaluatorUsesGovernedDecider`. |
| AC-2 | Test | `modules/platformkit-business-modules/auth_management/features/permissions/ui_test.go::TestPermissionsAdminContentIsReadOnly` and `admin_route_authorization_test.go::TestPermissionHandlerDoesNotOwnLegacyStandaloneAdminPage`. |
| AC-3 | Test | `modules/platformkit-business-modules/auth_management/features/policy/migration_integrity_test.go::TestPolicySchemaRetirementIsForwardOnly`; repository-wide guards reject active references to the retired grant tables. |
| AC-4 | Test | `modules/platformkit-business-modules/auth_management/features/authentication/stats_handler_directory_test.go::TestDirectoryObjectsAreConstrainedToActiveTenant` covers exact tenant scoping; shared write/delete controls and Topaz ETag conflicts have adjacent focused tests. |
| AC-5 | Test | `modules/platformkit-business-modules/auth_management/features/permissions/session_evaluator_test.go::TestSessionPermissionEvaluatorGuestCeilingRunsBeforeDecisionPlane`. |

## Implements (cross-cutting)

- REQ-001 — exact tenant scope on every directory and decision operation.
- REQ-004 — governed mutations retain auditable policy/directory evidence.
- REQ-005 — missing context, provider errors, and stale identity state deny.

## Satisfied by

- `core/platformkit-ports/authz`
- `core/platformkit-integrations/topaz`
- `modules/platformkit-business-modules/auth_management/features/permissions`
- `modules/platformkit-business-modules/auth_management/features/authentication/stats_handler.go`

## Related requirements

- [REQ-AUTH-005 — Policy control plane](./REQ-AUTH-005-policy.md)
- [REQ-AUTH-040 — Governed permission decision](./REQ-AUTH-040-permission-check.md)
- [REQ-PORTS-014 — Authorization contract](./REQ-PORTS-014-authorization-contract.md)
