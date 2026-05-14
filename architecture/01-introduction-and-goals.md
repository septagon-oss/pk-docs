---
title: "01 Introduction and Goals"
slug: architecture-01-introduction-and-goals
arc42_section: 1
collection: architecture
type: doc
tags: [architecture, arc42]
authoring: authored
---

# 01 — Introduction and Goals

## What PlatformKit is

PlatformKit is a modular SaaS framework. It ships a catalog of
business capabilities — authentication, tenancy, billing, content,
support, bookings, notifications, audit, roughly 47 modules as of
this writing — and composes them into running applications through
a typed dependency-injection graph.

The same modules compose two ways. A **monolith** runs every module
in one Go process with a shared database; a **microservices**
topology runs each module as its own deployable, with NATS-backed
RPC standing in for the in-process method calls of the monolith. The
application developer picks the topology; the modules don't change.

The project is built as a **workspace of 21 Go repositories**
(plus mobile and docs) that share contracts and conventions.
`platformkit-backend-kit` ships the runtime primitives (module
system, fx wiring, events, CRUD, observability).
`pk-modules` holds the 47 modules.
`platformkit-frontend-kit` renders HTML from Go with a controller-
based interaction layer. `platformkit-design-system` (via the
`pkds/` subpackage) owns tokens and component contracts authored in
CUE. `platformkit-apps` is where the modules get assembled into
running products.

## Who it's for

Three primary audiences, each with a different entry point:

**App developers.** Teams building a SaaS product who want to
compose a working application by selecting a **preset** (e.g.
`coworking`, `core`, `default`) rather than writing 400 lines of
`main.go`. They care that the module catalog is discoverable, that
tier labels are honest, and that upgrades are "check your preset"
rather than "audit every module."

**Module authors.** Engineers extending the catalog — adding a new
business capability, evolving an existing one. They care that the
module system is predictable (same file shape every time), that
cross-module communication is safe (ports, not imports), and that
their contract changes are visible (declared events, declared port
signatures, tracked migrations).

**Operators and integrators.** People running PlatformKit in
production, integrating with external systems, or auditing it for
compliance. They care about deployment topology, observability,
delivery guarantees, audit trails, and the tier claims that tell
them which modules carry the strongest posture.

## Top three quality goals

These are the quality attributes the architecture optimises for, in
order. When the architecture has to trade between them, this ordering
is the tie-breaker.

**1. Modularity — same modules, two topologies.** A module written
for the monolith must also run under microservices without code
changes. This is why every public port has both an HTTP binding and
a NATS binding
([ADR 0019](../adr/0019-dual-path-transport-symmetry.md)), why
modules talk only through ports
([ADR 0009](../adr/0009-ports-only-cross-module-communication.md)),
and why the app composition model is a typed fx graph
([ADR 0017](../adr/0017-fx-dependency-injection-as-composition.md))
rather than hand-wired `main.go`.

**2. Correctness under failure.** Distributed systems fail; the
architecture treats failure as the default case. Events cross the
DB/bus boundary atomically through an outbox
([ADR 0007](../adr/0007-transactional-outbox-for-event-delivery.md)).
Multi-entity writes are transactional
([ADR 0006](../adr/0006-transactional-atomicity-for-multi-entity-state.md)).
Errors propagate or log; they don't silently drop
([ADR 0005](../adr/0005-error-handling-discipline.md)). Async work
preserves its trace context
([ADR 0008](../adr/0008-async-goroutine-context-semantics.md)).

**3. Compliance posture honesty.** Integrators have to know what
they're signing up for. Modules declare a tier —
`core-certified`, `supported`, `experimental`
([ADR 0015](../adr/0015-module-tiering.md)) — and the tier claim is
mechanically cross-checked against the module's actual substance
(test coverage, migrations, evidence artifacts). A supported module
with no tests fails CI before anyone has to read it.

## Stakeholders

| Role | Cares about | Entry point |
|---|---|---|
| App developer | Preset composition, upgrade path, module catalog honesty | [04 Solution Strategy](./04-solution-strategy.md) → [05 Building Block View](./05-building-block-view.md) |
| Module author | Module anatomy, port/contract split, lifecycle hooks | CLAUDE.md at workspace root → [05](./05-building-block-view.md) → [09 ADR index](./09-architecture-decisions.md) |
| Frontend engineer | Interaction architecture, component token pipeline, design system | [ADR 0001](../adr/0001-interaction-architecture.md), [ADR 0004](../adr/0004-typed-design-token-dsl.md), [ADR 0022 PKDS](../adr/0022-pkds-cue-authored-design-system-pipeline.md) |
| Operator / SRE | Deployment topology, observability, delivery guarantees | [07 Deployment View](./07-deployment-view.md) → [11 Risks and Technical Debt](./11-risks-and-technical-debt.md) |
| Auditor / compliance | Tier claims, evidence generation, audit trails | [ADR 0015 module tiering](../adr/0015-module-tiering.md), [Convention C-06](../conventions.md#c-06-test-coverage-scales-with-tier), [10 Quality Requirements](./10-quality-requirements.md) |
| Designer | Design system pipeline, component contracts, Claude Design integration | [ADR 0022 PKDS](../adr/0022-pkds-cue-authored-design-system-pipeline.md) |

## Where to go next

- **I want to build an app** → [04 Solution Strategy](./04-solution-strategy.md), then `platformkit new project` in `platformkit-devtools`.
- **I want to write a module** → [05 Building Block View](./05-building-block-view.md), then CLAUDE.md at the workspace root.
- **I want to understand a specific decision** → [09 Architecture Decisions](./09-architecture-decisions.md).
- **I want to run it in production** → [07 Deployment View](./07-deployment-view.md).
- **I want a shape diagram** → [05](./05-building-block-view.md) has the repo and module topologies.
