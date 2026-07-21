---
id: REQ-018
title: "Renderable entities must declare read permissions; the surface renderer fails closed on undeclared entities"
status: Active
date: 2026-05-08
slug: req-018-permission-coverage-fail-closed
category: auth
ears_pattern: ubiquitous
verification_methods: [test, inspection, analysis]
compliance:
  - SOC2_CC6.1
  - ISO27001_A.9.4
satisfied_by:
  adr: [ADR-0009]
  conventions: [C-04, C-14]
type: doc
tags: [requirement, governance, admin, permissions, fail-closed]
---

# REQ 018 — Permission coverage on renderable entities

Status: **Active** (2026-05-08)

## Statement

**When** the platform renders an entity through the surface
renderer, the system **shall** require an
`EntityReadPermissions` declaration produced by the entity's
owning module. Entities **shall** be visible only to principals
holding the read-token declared by their owner. The renderer
**shall** fail closed (return a typed permission-denied) for any
entity reached via a row source that has no matching
`EntityReadPermissions` declaration; the platform's boot
sequence **shall** detect the absence of such a declaration and
crash with a diagnostic naming the offending module rather than
shipping a binary that would surface a blanket 403 to a user.

## Rationale

The PlatformKit admin surface composes entities from many
producer modules into a single tenant-facing renderer. Without
this REQ, two failure modes are possible:

1. **Silent over-disclosure.** A new entity ships with row data
   but no permission declaration; the renderer would render it
   to every viewer regardless of role. This is the
   default-allow failure mode that REQ-005 (fail-closed)
   already prohibits in the abstract — REQ-018 is its concrete
   form for the renderer surface.
2. **Silent under-disclosure with no recourse.** The renderer
   sees no declaration, fails closed (the safe default), and
   returns 403 to every caller. Without the boot-time
   coverage check, operators discover this only when a user
   reports "I can't see X" — at which point the module owner
   has to debug a route they didn't realise was even being
   served.

The two-layer discipline (boot-time coverage validation +
runtime fail-closed) is the platform's renderer-side analogue
of REQ-005 (authorisation gates fail closed) and REQ-001
(multi-tenant isolation at every persistence boundary): no
implicit publishing of entity data, ever.

## Acceptance criteria

- **AC-1** Each entity registered as a renderable row source
  declares an `EntityReadPermissions` record in its owning
  module's `entity_permissions` fx group. The aggregator
  composes per-module declarations into a single
  `ports.PermissionResolver`.
- **AC-2** Boot fails fast with a diagnostic
  (`admin_management: <module>: <error>`) when a row source
  is registered without a matching `EntityReadPermissions`
  declaration, when two modules declare the same entity, or
  when a permission token is malformed.
- **AC-3** The surface renderer requires a non-nil
  `PermissionResolver` to be constructed; nil-resolver
  configurations are rejected at fx-graph build time, not at
  request time.
- **AC-4** A request whose principal lacks the declared
  read-token for an entity sees the typed permission-denied
  return; the renderer never falls back to "show anyway".
- **AC-5** A request reaching an entity via a row source whose
  permission declaration is missing (i.e. a configuration
  bug that escaped boot-time coverage validation) receives
  the same typed permission-denied — never the entity data.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Inspection | `pk-modules/admin_management/surface_renderer_provider.go::permissionResolverParams, newPlatformPermissionResolver` aggregates per-module `entity_permissions` declarations. Producers populate the group via their own `module.go` / `feature.go` wiring; the contract is exercised every time the platform boots. |
| AC-2 | Inspection | `pk-modules/admin_management/surface_renderer_provider.go::validatePlatformPermissionCoverage` calls `ports.ValidatePermissionCoverage` and returns a wrapped error that crashes the fx graph. |
| AC-3 | Inspection | `pk-modules/admin_management/surface_renderer_provider.go::newCompilerTierSurfaceRenderer` requires a `ports.PermissionResolver` parameter; a nil resolver causes the fx graph to refuse construction. |
| AC-4 | Test | The renderer's per-permission gate is exercised through the surface-renderer adaptive layer; per-module permission declarations are unit-tested at the producer module (e.g. `pk-modules/content_management/surface_row_source_test.go::TestArticleSurfaceRowSourceIncludesTypeColumn` exercises the column projection consumed by the gate). **Verification gap: a dedicated permission-denied-on-deny test against the renderer is pending.** |
| AC-5 | Inspection | The renderer's fail-closed default is the negative branch in `surfacerender.CompilerTierRenderer`. Boot-time coverage validation (AC-2) ensures this path is unreachable in a correctly-configured deployment, but the runtime guard remains. **Verification gap: a dedicated test that bypasses boot validation and asserts runtime fail-closed is pending.** |

## Implements (cross-cutting)

- **REQ-001 — Multi-tenant isolation.** The permission gate
  consumes the request's tenant context; cross-tenant reads
  cannot succeed without an explicit cross-tenant marker.
- **REQ-005 — Fail-closed.** Renderer-side concrete form of
  the same discipline.

## Compliance traceability

- **SOC2_CC6.1** — logical access controls. Entity-level read
  gating is the renderer's contribution to the control.
- **ISO27001_A.9.4** — information access restriction. The
  permission resolver is the platform's enforcement point.

## Satisfied by

- `pk-modules/admin_management/surface_renderer_provider.go` —
  resolver composition + boot-time coverage validation.
- `pk-modules/ports/permissions.go` —
  `EntityReadPermissions`, `AggregatePermissionResolver`, and
  `ValidatePermissionCoverage` primitives.
- Per-module `entity_permissions` group contributions in each
  business module that owns a renderable entity.

## Related requirements

- [REQ-001 — Multi-tenant isolation](./REQ-001-multi-tenant-isolation.md)
- [REQ-005 — Authorisation fails closed](./REQ-005-authorisation-fails-closed.md)
- [REQ-002 — Modules are independently deployable](./REQ-002-independently-deployable-modules.md) — the entity-permissions group is the module-boundary contract this REQ enforces.

## References

- `ADR-0009` — ports-only cross-module communication; the
  per-module permission declarations are the canonical port.
