---
title: "ADR 0017: Fx is the composition model"
status: Accepted
date: 2026-04-19
slug: adr-0017-fx-dependency-injection-as-composition
adr_topic: module-system
type: doc
tags: [adr, fx, dependency-injection, app-composition]
---

# ADR 0017 — Fx is the composition model

Status: **Accepted** (2026-04-19)

## The problem

A PlatformKit app is an assembly of modules, repositories,
services, handlers, and infrastructure adapters. Hand-wiring
`main.go` in the style of early-Go apps would produce 400+ lines
of constructor calls per app — and give us no way to enforce that
the dependencies actually resolve. Every refactor that added a new
dep would ripple through every `main.go` in the workspace.

We needed a composition model that validated the graph at boot,
kept module contributions uniform, and didn't require us to invent
our own lifecycle primitives. Uber's fx framework already does all
three, at scale, at Uber.

## The decision

Every module and feature expresses its wiring through fx
primitives:

- **`fx.Provide(NewX)`** for services, repositories, adapters.
- **`fx.Invoke(fn)`** for startup-time side effects — admin
  registration, event subscription, migration registration.
- **`fx.Hook{OnStart, OnStop}`** for graceful lifecycle — worker
  goroutines, cache warming, scheduler registration.
- **`fx.In` struct tags** for optional dependencies
  (`optional:"true"`).

Apps compose with `fx.New(<options...>)` where `<options...>`
expands from the selected preset/set via `catalog.Options(preset)`.
The resulting graph is validated at boot; missing required
dependencies fail fast with a clear error.

Modules do NOT construct their own `fx.App` — the app layer owns
that. Modules only declare what they contribute.

## What we gave up

- Compile-time dep safety. fx is dynamic; some dependency mistakes
  are caught only at boot. Wire or code generation would catch more
  statically. We trade that for flexibility and for the lifecycle
  hooks fx ships.
- Error clarity on the bad days. fx graph errors at boot can be
  cryptic — a missing optional dep cascades into unclear "missing
  type" messages. `platformkit app up --verbose` and the
  backend-kit fx-logger shim smooth the worst of it.

## What we kept

- App boot is a single graph resolution. Missing deps are caught at
  startup, not at runtime under load.
- Uniform module contribution. Every module exposes the same shape
  (`ModuleOptions() fx.Option`), so apps compose without knowing
  module implementation details.
- Clean test composition. `fxtest.New(t, <options>)` builds an app
  for integration tests with whatever subset the test needs —
  mocking becomes "provide a mock implementation", not "rewire
  the whole graph".

## How we enforce it

- **Boot-time validation (the primary guard).** `fx.New` fails the
  process with a clear error if any required dependency cannot be
  provided, if a provider is missing, or if there's a type cycle.
  An app with a broken graph cannot start. This is fx's built-in
  check; PlatformKit relies on it intentionally rather than adding
  a static shim.
- **`check-module-port-event-audit`**
  (`pk-modules/scripts/generate_module_port_event_audit.sh --check`)
  — static audit that each module's declared port dependencies in
  `dependencies.go` correspond to ports actually consumed in the
  module's features, and that declared events correspond to emit
  sites. Surfaces "declared but unused" and "used but undeclared"
  drift in review.
- **`check-module-deps`** — validates the dependency graph
  generated from DI signatures against
  `scripts/module_dependencies.generated.json`. Drift means
  `dependencies.go` no longer matches what fx actually wires.
- **Gap.** No static analyzer over the assembled `fx.App` option
  list. A module that provides a type whose name collides with
  another module's, or an `fx.Invoke` with a side effect that
  contradicts another module's, fails only at boot. fx's
  diagnostics cover this, but CI doesn't re-run `fx.New` ahead of
  merge for every app × preset combination.
- **Not a guard here.** `runtime-boundary-check`,
  `runtime-capability-check`, and `runtime-release-policy-check`
  (all in `platformkit-backend-kit/cmd/`) enforce backend-kit's
  internal tier/capability/release-policy model over its own source
  tree. They do *not* inspect app-level fx graphs in
  `platformkit-apps` or business-module composition. An earlier
  revision of this ADR cited them incorrectly.

## Alternatives we rejected

- **Hand-wired DI.** Workable at small scale; infeasible at the
  platform's module count.
- **Wire (Google).** Compile-time DI that generates wiring code.
  Strong correctness guarantees. Rejected because the generator
  adds a build step, and the "module contributes options" shape is
  harder to express than fx's runtime registration.
- **Service locator.** Single global registry, services look
  themselves up. Silent at boot — a missing dep surfaces only on
  the first method call, not on startup.
- **Roll our own DI.** Tempting when framework choice feels fraught.
  Rejected because fx is battle-tested at Uber's scale and the
  lifecycle hooks are the non-trivial part we'd otherwise
  reinvent.

## References

- Uber fx: <https://uber-go.github.io/fx/>.
- `platformkit-backend-kit/app/appcontext/` — the context-propagation
  layer fx apps use.
- Related:
  [Convention C-02 — one module, one instance](../conventions.md#c-02-one-module-one-instance)
  — the module singleton this graph composes.
- Related:
  [ADR 0009 — modules only talk through ports](./0009-ports-only-cross-module-communication.md)
  — the contract boundaries fx providers honour.
