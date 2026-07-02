---
id: REQ-016
title: "Module composition is declarative via Fx"
status: Active
date: 2026-05-06
slug: req-016-fx-composition-declarative
category: governance
ears_pattern: ubiquitous
verification_methods:
  - analysis
  - test
compliance: []
satisfied_by:
  adr: [ADR-0017]
  conventions: [C-02, C-09]
type: doc
tags: [requirement, governance, composition]
---

# REQ 016 — Module composition is declarative via Fx

Status: **Active** (2026-05-06)

## Statement

Module wiring **shall** be expressed as Fx providers, invocations, and
module-helper builders — never as ad-hoc constructors imported and
called from `main()`. Each business module **shall** register exactly
one `fx.Module` via `module.NewSingleton` plus a `NewModule()` /
`GetModule()` pair. The runtime **shall** fail closed when a required
port is missing from the assembled graph, and **shall** surface
optional-port misses as nil-safe fallbacks (e.g. a noop adapter).

## Rationale

Declarative composition is what makes the same codebase compile to a
single monolith binary, a microservices mesh, or a per-client
overlay topology. If module wiring were a chain of imperative
`module_a.New(module_b.New(...))` calls in `main()`, every
deployment shape would be a different `main.go` to maintain. With
Fx the module set is data — `catalog.Register(...)` entries — and
the runtime materialises whatever subset the deployment configures.

The singleton discipline (Convention C-02) protects the graph from
double-wiring. A module instantiated twice would race to register
the same admin sidebar section, double-emit migrations, and produce
two parallel FX option bundles fighting at boot.
`module.NewSingleton` wraps the `sync.Once` so every module follows
the same shape; the `check-structure` analyzer flags any module that
doesn't.

Failing closed on missing required dependencies (Convention C-09)
means a deployment that forgot to register `tenant_management` does
not silently boot in a half-broken state. Optional dependencies
resolve through nil-safe fallbacks so a deployment that does not
need notifications (e.g. an e2e test rig) does not need to scaffold
a notification-management module just to satisfy an import.

## Acceptance criteria

- **AC-1** Every business module declares `NewModule()` and
  `GetModule()` accessors backed by `module.NewSingleton`. The
  `check-structure` analyzer enforces this.
- **AC-2** `main()` does not construct module instances directly.
  It calls into a single application-bootstrap path
  (`fx.New(...).Run()` or equivalent) that consumes the catalog.
- **AC-3** Required vs optional dependencies are declared in each
  module's `dependencies.go` via
  `standard.WithCategorizedDep(... required bool ...)`. The
  contract-check analyzer fails the build if a declared required
  dep is unsatisfied.
- **AC-4** The assembled FX graph is introspectable at runtime via
  the platform catalog API
  (`GET /api/_platform/modules`,
  `GET /api/_platform/graph`).

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Analysis | `make check-structure` (`platformkit-devtools/internal/modulechecks/structure.go`) — verifies every module declares `NewModule`, `GetModule`, and `GetFeatures`. |
| AC-2 | Inspection | Code review checklist: `platformkit-apps/complete-saas-monolith/main.go` is the canonical reference; new entrypoints follow the same shape. |
| AC-3 | Analysis | `make check-module-deps` (catalog contract check) — fails on unresolved required deps. |
| AC-4 | Test | `modules/platformkit-business-modules/catalog/runtimecatalog/catalog_test.go::TestPlanSkipsWarningOnlyHTTPRouting` exercises `Plan()` against subsets of the registered modules. |

## Satisfied by

- [ADR 0017 — Fx is the composition model](../adr/0017-fx-dependency-injection-as-composition.md) —
  the architectural decision establishing FX as the universal wiring
  primitive.
- [Convention C-02 — One module, one instance](../conventions.md#c-02-one-module-one-instance) —
  the singleton discipline.
- [Convention C-09 — Runtime startup is explicit and one-way](../conventions.md#c-09-runtime-startup-is-explicit-and-one-way) —
  the fail-closed boot rule.

## Related requirements

- [REQ-002 — Modules are independently deployable](./REQ-002-independently-deployable-modules.md) —
  the higher-level property this composition mechanism realises.

## References

- `platformkit-backend-kit/app/module/` — module-helper builders.
- `modules/platformkit-business-modules/catalog/` — registry + presets.
- `platformkit-apps/complete-saas-monolith/main.go` — reference
  bootstrap.
