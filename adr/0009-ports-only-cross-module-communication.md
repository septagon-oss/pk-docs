---
title: "ADR 0009: Modules only talk through ports"
status: Accepted
date: 2024-06-10
slug: adr-0009-ports-only-cross-module-communication
adr_topic: module-system
type: doc
tags: [adr, modules, boundaries]
---

# ADR 0009 — Modules only talk through ports

Status: **Accepted** (2024-06-10)

## The problem

If `blog_management` imports `user_management` directly, we've
already lost. The two modules become co-deployed by construction.
We can't swap the user provider. We can't test `blog_management` in
isolation. We can't split the deployment across services without
unwinding the import graph. That's the distributed-monolith trap —
all of microservices' operational cost and none of the decoupling
benefit.

We've watched this happen elsewhere. The first direct import feels
harmless; the second feels like precedent. By the time anyone
notices, the graph is a knot.

## The decision

A module cannot import another module's package directly. Anything
under `pk-modules/<other_module>/...` is off-limits
— with two carved-out exceptions:

1. The other module's `contracts/` subtree is public. That's what
   contracts are for — see
   [Convention C-04 — public contracts live away from their implementation](../conventions.md#c-04-public-contracts-live-away-from-their-implementation).
2. Catalog wiring in `pk-modules/catalog/` and the
   composition layer in `platformkit-apps/modulecatalog/` can
   import any module's `NewModule()` — they exist precisely to
   compose the graph.

Everywhere else, cross-module calls go through an interface in
`pk-modules/ports/`, declared via
`standard.WithCategorizedDep` in the caller's `dependencies.go`.
The consumer imports the port; the app wires the implementation.

We're strict about this. One exception breeds ten.

## What we gave up

- Ergonomics. Wiring a new cross-module call takes more keystrokes
  than `import "../user_management"`.
- Short-term hacks. A bug that spans two modules can't be fixed
  with a cross-import shortcut. You extend the port or live with
  the bug.

## What we kept

- The option to deploy any module as its own service — see
  [ADR 0019](./0019-dual-path-transport-symmetry.md).
- Independent testability. A module's tests stand up without
  spinning up every module it talks to.
- A legible graph. `platformkit modules graph` reflects the real
  runtime dependency story, not just what happened to compile.

## How we enforce it

- **`check-pkvet`** — runs the module import-boundary analyzer in CI.
- **`importboundary` pkvet analyzer** — refuses cross-module direct imports
  and catches the subtler cases
  (type assertions on a cross-module concrete type,
  reflection-based access, etc.) that a plain import-grep would
  miss.
- **`platformkit-backend-kit/cmd/repo-split-importcheck`** —
  validates boundaries at the repo-split layer to prevent
  backend-kit ↔ business-modules leaks.

## References

- CLAUDE.md — Invariant #1: "No cross-module direct imports."
- `pk-modules` `check-pkvet` — the CI target.
- `pk-modules/ports/` — the canonical cross-module
  interface surface.
- Related:
  [Convention C-04 — public contracts live away from their implementation](../conventions.md#c-04-public-contracts-live-away-from-their-implementation).
