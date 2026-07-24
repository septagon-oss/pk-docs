---
title: "02 Architecture Constraints"
slug: architecture-02-architecture-constraints
arc42_section: 2
collection: architecture
type: doc
tags: [architecture, arc42, constraints]
authoring: authored
status: archived
---

> **Historical architecture source.** This narrative describes a larger downstream workspace and is not the current PlatformKit OSS runtime. Use `docs/current/` and verify executable claims against the public `septagon-oss` repositories.


# 02 — Architecture Constraints

The decisions in the ADRs aren't free choices in a vacuum — they're
choices made under the constraints listed here. If a constraint
changes, several ADRs downstream might need to change with it.

## Technical constraints

**Go 1.26 on the server side.** The workspace pins this via
`go.work`, and the module system takes advantage of post-1.21
features — notably `context.WithoutCancel`
([ADR 0008](../adr/0008-async-goroutine-context-semantics.md)). The
runtime isn't swappable to another language for server-side work;
the patterns in the backend kit (`module.NewSingleton`, the fx
options contract, the `crud.Repository[T]` generic) are Go-native.

**PostgreSQL as the canonical database.** Every migration is SQL,
applied in version order, append-only
([Convention C-01](../conventions.md#c-01-migrations-are-append-only)).
Per-tenant isolation is logical (tenant_id columns + row-level
security), not per-schema or per-DB. The outbox pattern
([ADR 0007](../adr/0007-transactional-outbox-for-event-delivery.md))
assumes Postgres-grade transaction semantics and the `gen_random_uuid()`
default. SQLite is not a supported production database.

**NATS for cross-module RPC in the microservices topology.**
Dual-path transport
([ADR 0019](../adr/0019-dual-path-transport-symmetry.md)) requires
that every port method work over HTTP *and* EventBus/NATS. The
monolith can run without NATS; microservices cannot. Subject-naming
discipline is part of the operational contract.

**Fx (Uber) for dependency injection.** See
[ADR 0017](../adr/0017-fx-dependency-injection-as-composition.md).
Module contribution is uniform (`ModuleOptions() fx.Option`) and
the graph is validated at boot, not at compile time. Wire or other
compile-time DI frameworks were considered and rejected.

**Huma for HTTP with OpenAPI.** Routes are registered via
`huma.Register` inside feature packages
([Convention C-03](../conventions.md#c-03-features-own-their-routes));
the OpenAPI document falls out of the registration automatically.

**Server-rendered HTML with HTMX + typed controllers, not a SPA.**
[ADR 0001](../adr/0001-interaction-architecture.md) establishes the
two-axis model: Go owns markup and server-driven composition, HTMX
handles server state transitions, and client JavaScript is limited
to ephemeral interaction state via a shared controller runtime.
Components compile to semantic Tailwind classes through a typed DSL
([ADR 0004](../adr/0004-typed-design-token-dsl.md)).

**Design system authored in CUE.** The `pkds/` subpackage of
the design system is the source of truth for every design
token, component contract, theme, experience, and icon
([ADR 0022](../adr/0022-pkds-cue-authored-design-system-pipeline.md)).
CUE evaluates at build time; emitters produce DTCG JSON, Storybook
stories, the Claude Design brand-context tarball, and mobile
tokens.

**Mobile is React Native / Expo.** `platformkit-mobile` consumes
the design system via a DTCG reader (`W3CTokenStrategy.ts`) that
expects a specific set of token paths (see
[03 System Scope and Context](./03-system-scope-and-context.md) for
the integration boundaries).

## Organisational constraints

**21 repositories, tied together by `go.work`.** The repo split is
deliberate: it enforces boundary hygiene by making certain imports
impossible at the Go module level. `pk-tools` and
`pk-testkit` carry the browser-automation and Docker SDK
dependencies; server-producing repos never can
([Convention C-05](../conventions.md#c-05-server-binaries-dont-ship-browsers-or-docker)).

**Multi-tenancy from day one.** Every row carries a `tenant_id`.
Every request carries a tenant context. There is no "single-tenant
mode" that skips the isolation; the architecture assumes N tenants
in the same database, and shortcuts taken for a single tenant
don't generalise.

**Self-hostable as the default deployment shape.** A customer must
be able to run the monolith on their own infrastructure with
minimal external dependencies. External services are optional
enhancements (Claude Design, Figma integration, a managed NATS
cluster for microservices) rather than hard requirements.

**Compliance posture is a shipped property.** A `core-certified`
module carries assurance-eligible evidence automatically via
`check-module-assurance-evidence`; this isn't an afterthought
stapled on for an audit, it's a continuous CI output. A customer
asking "show me the evidence that your audit module is
compliant" gets a machine-generated report.

## Regulatory and legal constraints

**GDPR-compliant data model.** Every entity that holds PII declares
it; audit trails are append-only; deletion cascades through the
retention policy in `audit_management`. The architecture doesn't
require GDPR (tenants in non-EU jurisdictions run it identically)
but it must *support* it without bolt-on work.

**Audit trail integrity.** State-changing operations in
core-certified modules emit audit events through the outbox, not
through `bus.Publish` directly
([ADR 0007](../adr/0007-transactional-outbox-for-event-delivery.md)).
The audit module is the canonical subscriber; its projections must
never disagree with the state they describe.

**Right-to-be-forgotten.** The retention-policy system in
`audit_management` applies tenant-specified retention windows to
both domain entities and their audit shadows. Per-entity retention
is supported; audit rows are trimmed at window expiry.

## Convention constraints (summary)

These aren't architectural *decisions* — they're the codified
rules that follow from the decisions. The full statement of each
lives in [`conventions.md`](../conventions.md); they're mentioned
here because they shape the architecture constraint landscape.

- [C-01](../conventions.md#c-01-migrations-are-append-only) — migrations never edited once committed.
- [C-02](../conventions.md#c-02-one-module-one-instance) — one module, one fx-registered instance, always.
- [C-03](../conventions.md#c-03-features-own-their-routes) — routes register inside the feature package.
- [C-04](../conventions.md#c-04-public-contracts-live-away-from-their-implementation) — `contracts/provides/` for public surface.
- [C-05](../conventions.md#c-05-server-binaries-dont-ship-browsers-or-docker) — server binaries stay lean.
- [C-06](../conventions.md#c-06-test-coverage-scales-with-tier) — test coverage matches the tier claim.

## What these constraints let us skip

A few things PlatformKit explicitly does not do, because the
constraints above make them unnecessary:

- **We don't run a service mesh.** Dual-path transport plus NATS
  handles cross-module RPC; we don't need sidecars for service
  discovery or mTLS between modules in the microservices topology.
- **We don't run per-tenant databases by default.** Logical
  isolation in a shared Postgres cluster is sufficient; per-tenant
  DBs are an escape hatch for outlier compliance cases, not the
  baseline.
- **We don't ship a GraphQL layer.** HTTP + Huma + the NATS
  transport cover every cross-module call; adding GraphQL would be
  a third transport to keep in sync with the other two.
