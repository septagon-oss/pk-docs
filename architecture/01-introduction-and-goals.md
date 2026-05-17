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

PlatformKit is an open-core foundation for modular SaaS products.
Its core is intentionally small: it defines how modules identify
themselves, declare dependencies, publish contracts, contribute
registries, expose policy metadata, describe entities, guard
mutations, attach design contributions, and prove behavior.

Product capability lives in modules. Customer-specific and
market-specific workflows live in apps. Pro/private distributions
extend the same public contracts instead of redefining the semantics
behind them.

The goal is not to pack every feature into core. The goal is to make
the important boundaries hard to get wrong. A module should be able
to add domain logic, UI contributions, design tokens, translations,
authz policy, entity descriptors, requirement-backed tests, and
runtime metadata without importing another module's implementation
or changing the host.

The OSS repos form the public backbone:

- `pk-core` defines modules, catalogs, dependency declarations,
  registries, authz vocabulary, entities, and mutation gates.
- `pk-design` defines renderer-neutral design tokens, themes,
  component descriptors, and contribution catalogs.
- `pk-shared` holds reusable contracts such as composition cells,
  flow definitions, state machines, and contract metadata.
- `pk-runtime` hosts composed module plans through small HTTP,
  request, health, and host contracts.
- `pk-testkit` proves module/runtime conformance and
  requirement-to-flow coverage without choosing a browser or CI
  provider.
- `pk-modules` contains the starter OSS module pack and the patterns
  community modules should follow.
- `pk-apps` composes modules into runnable applications.
- `pk-client` and `pk-tools` carry client and developer workflows
  around the same contracts.
- `pk-docs` records the requirements, decisions, architecture, and
  federation model that keep the ecosystem aligned.

## Who it's for

Four primary audiences, each with a different entry point:

**Product teams.** Teams building a SaaS product who want to start
from a trusted foundation instead of rebuilding tenancy, authz,
auditability, design contracts, and test harnesses from scratch.
They care that modules compose cleanly, that upgrades are reviewable,
and that private extensions can build on the OSS base without
semantic drift.

**Module authors.** Engineers extending the catalog — adding a new
business capability, evolving an existing one. They care that the
module system is predictable, that cross-module communication is
safe, and that their contract changes are visible through declared
ports, registries, events, requirements, and tests.

**Framework maintainers.** Engineers responsible for keeping core
small, stable, and extensible. They care that registries are
deterministic, contracts are narrow, validation fails early, and
new primitives earn their place by improving composition rather than
adding convenience to core.

**Operators and auditors.** People running PlatformKit in production,
integrating it with external systems, or reviewing it for compliance.
They care about deployment topology, observability, tenant isolation,
authorization posture, audit trails, and evidence that requirements
are actually tested.

## Top three quality goals

These are the quality attributes the architecture optimises for, in
order. When the architecture has to trade between them, this ordering
is the tie-breaker.

**1. Extensibility with enforceable boundaries.** Core stays small
because extension points are explicit. Modules compose through
catalogs, typed dependency declarations, public contracts,
registries, and contribution manifests; they do not reach into each
other's implementation packages
([ADR 0009](../adr/0009-ports-only-cross-module-communication.md)).
When in doubt, PlatformKit adds a contract or validator before it
adds a feature to core.

**2. Trustworthy safety defaults.** Tenant isolation, authorization,
mutation gates, audit evidence, and operational health must fail
closed or fail visibly. Events cross the DB/bus boundary atomically
through an outbox
([ADR 0007](../adr/0007-transactional-outbox-for-event-delivery.md)).
Multi-entity writes are transactional
([ADR 0006](../adr/0006-transactional-atomicity-for-multi-entity-state.md)).
Errors propagate or log; they don't silently drop
([ADR 0005](../adr/0005-error-handling-discipline.md)). Async work
preserves its trace context
([ADR 0008](../adr/0008-async-goroutine-context-semantics.md)).

**3. Evidence-driven developer experience.** The platform should feel
good because it is explicit, deterministic, and easy to verify. A
requirement names the promise, an ADR explains the decision, a
convention makes the discipline mechanical, and tests or generated
evidence prove the claim. Module tiers are only useful when the claim
is cross-checked against tests, migrations, contracts, and evidence
([ADR 0015](../adr/0015-module-tiering.md)).

## Stakeholders

| Role | Cares about | Entry point |
|---|---|---|
| Product team | App composition, module catalog, extension path | [04 Solution Strategy](./04-solution-strategy.md) → [05 Building Block View](./05-building-block-view.md) |
| Module author | Module anatomy, ports, registries, requirements, tests | [05](./05-building-block-view.md) → [09 ADR index](./09-architecture-decisions.md) |
| Framework maintainer | Core boundary, registry semantics, compatibility posture | [04](./04-solution-strategy.md), the `pk-core` open-core boundary docs |
| Frontend and design-system engineer | Token pipeline, theme layering, component contracts | [ADR 0004](../adr/0004-typed-design-token-dsl.md), [ADR 0022 PKDS](../adr/0022-pkds-cue-authored-design-system-pipeline.md) |
| Operator / SRE | Deployment topology, observability, delivery guarantees | [07 Deployment View](./07-deployment-view.md) → [11 Risks and Technical Debt](./11-risks-and-technical-debt.md) |
| Auditor / compliance | Tier claims, evidence generation, audit trails | [ADR 0015 module tiering](../adr/0015-module-tiering.md), [Convention C-06](../conventions.md#c-06-test-coverage-scales-with-tier), [10 Quality Requirements](./10-quality-requirements.md) |
| Community contributor | Public contracts, docs federation, contribution standards | [Requirements](../requirements/README.md), [Conventions](../conventions.md) |

## Where to go next

- **I want to build an app** → [04 Solution Strategy](./04-solution-strategy.md), then the runnable examples in `pk-apps`.
- **I want to write a module** → [05 Building Block View](./05-building-block-view.md), then the starter patterns in `pk-modules`.
- **I want to extend core** → [04 Solution Strategy](./04-solution-strategy.md), then the `pk-core` extensibility fitness rubric.
- **I want to understand a specific decision** → [09 Architecture Decisions](./09-architecture-decisions.md).
- **I want to run it in production** → [07 Deployment View](./07-deployment-view.md).
- **I want a shape diagram** → [05](./05-building-block-view.md) has the repo and module topologies.
