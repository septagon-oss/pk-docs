---
id: REQ-ADMIN-012
title: "Admin permission resolver composes per-module declarations and fails closed when ownership is duplicated"
status: Proposed
date: 2026-05-08
slug: req-admin-012-permission-resolver
category: auth
ears_pattern: ubiquitous
priority: must
risk: critical
verification_methods: [test, analysis]
compliance:
  - SOC2_CC6.1
  - ISO27001_A.9.4
satisfied_by:
  adr: [ADR-0009]
  conventions: [C-04, C-14]
implements_cross_cutting: [REQ-001, REQ-005]
refines: REQ-ADMIN-001
type: doc
tags: [requirement, capability, admin_management, permissions, resolver]
module: admin_management
feature: admin
capability: permission_resolver
capability_kind: failure_mode
stakeholders:
  - module developer (declares per-entity permissions)
  - operator (debugs permission-denied incidents)
  - compliance auditor (read-control evidence)
---

# REQ ADMIN-012 — Admin permission resolver wiring

Status: **Proposed** (2026-05-08)

## Statement

The admin-management feature **shall** compose every per-module
`EntityReadPermissions` declaration into a single
`ports.PermissionResolver` at fx-graph build time. The wiring
**shall**:

1. Aggregate every declaration registered into the
   `entity_permissions` fx group;
2. Refuse the graph build when two modules declare the same
   entity (ownership ambiguity is a configuration bug);
3. Refuse the graph build when a permission token is
   malformed;
4. Run `ValidatePermissionCoverage` at boot, crashing the
   composition with a typed error
   (`admin_management: <module>: <error>`) when a row source
   is registered without a matching `EntityReadPermissions`
   declaration.

The runtime renderer (REQ-018) **shall** still fail closed on
any entity reached without a declaration; the boot-time check
prevents that path being reachable in a correctly-configured
deployment.

## Rationale

Permission coverage is the platform's "no silent over-disclosure"
guarantee. Three properties:

1. **Aggregation by group.** Producer modules contribute
   declarations through the `entity_permissions` fx group;
   the consumer (admin renderer) reads only the aggregate.
   This keeps the producer/consumer contract narrow and
   dependency-free between modules.
2. **Duplicate ownership = boot failure.** If two modules
   claim the same entity, the platform cannot decide which
   permission applies — silently picking either one would
   mask the configuration bug. Refusing the graph build
   surfaces the bug immediately.
3. **Coverage validation at boot, fail-closed at runtime.**
   The two-layer discipline means a configuration bug is a
   deploy-time diagnostic (operator-facing) rather than a
   runtime 403 (user-facing). The runtime gate remains as
   defence-in-depth.

## Acceptance criteria

- **AC-1 — Resolver composes across modules.** A graph
  with multiple modules contributing different
  `EntityReadPermissions` produces a single resolver
  whose lookup honours every declaration.
- **AC-2 — Duplicate ownership refused.** A graph with
  two modules declaring the same entity produces a
  fx-graph build error before the application starts.
- **AC-3 — Coverage validator passes when complete.** A
  graph where every registered row source has a
  matching `EntityReadPermissions` declaration boots
  successfully.
- **AC-4 — Coverage validator fails closed on gap.** A
  graph with a row source registered but no matching
  `EntityReadPermissions` declaration produces the
  typed `admin_management: <module>: <error>`
  diagnostic at boot.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `modules/platformkit-business-modules/admin_management/permission_wiring_test.go::TestPermissionResolverWiringComposesAcrossModules`. |
| AC-2 | Test | `modules/platformkit-business-modules/admin_management/permission_wiring_test.go::TestPermissionResolverWiringRejectsDuplicateOwnership`. |
| AC-3 | Test | `modules/platformkit-business-modules/admin_management/permission_wiring_test.go::TestPermissionCoverageValidatorPassesWhenComplete`. |
| AC-4 | Test | `modules/platformkit-business-modules/admin_management/permission_wiring_test.go::TestPermissionCoverageValidatorFailsClosedOnGap`. |

## Edge cases & unhappy paths

- **Modules with zero entities.** Allowed; they
  contribute nothing to the resolver.
- **Permission token typo.** Rejected at
  resolver-construction time via
  `ports.NewAggregatePermissionResolver` validation.
- **Duplicate non-overlapping declarations from the
  same module.** The resolver de-dups within a module's
  own contribution; ambiguity is only across modules.
- **Late-registration after fx graph builds.** Not
  supported; declarations must be present at graph build
  time.

## Risk

- **Likelihood:** Low — exercised at every boot.
- **Impact:** Critical — a missed declaration is a
  silent over-disclosure (REQ-018).
- **Mitigations:** Boot-time coverage validation
  (AC-3, AC-4), duplicate-ownership refusal (AC-2),
  REQ-018 runtime fail-closed as defence-in-depth.

## Implements (cross-cutting)

- **REQ-001 — Multi-tenant isolation.** The resolver
  consumes the request's tenant context.
- **REQ-005 — Fail-closed.** AC-2, AC-4 — refused at
  boot rather than serving incorrectly.

## Compliance mapping

| Control | Coverage |
|---|---|
| SOC2 CC6.1 (Logical access) | AC-1, AC-3 — entity-level read gating. |
| ISO27001 A.9.4 (Access control) | AC-2, AC-4 — configuration-time enforcement. |

## Satisfied by

- `modules/platformkit-business-modules/admin_management/surface_renderer_provider.go::newPlatformPermissionResolver, validatePlatformPermissionCoverage`.
- `modules/platformkit-business-modules/ports/permissions.go::EntityReadPermissions, NewAggregatePermissionResolver, ValidatePermissionCoverage`.

## Related requirements

- [REQ-ADMIN-001 — Admin](./REQ-ADMIN-001-admin.md)
- [REQ-018 — Renderable entities declare read permissions](./REQ-018-permission-coverage-fail-closed.md) — the runtime fail-closed counterpart.
- [REQ-001 — Multi-tenant isolation](./REQ-001-multi-tenant-isolation.md)
