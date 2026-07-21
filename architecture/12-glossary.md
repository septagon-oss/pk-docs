---
title: "12 Glossary"
slug: architecture-12-glossary
arc42_section: 12
collection: architecture
type: doc
tags: [architecture, arc42, glossary]
authoring: authored
---

# 12 — Glossary

Terms PlatformKit uses with specific meaning. If a word has a
generic software-engineering meaning plus a PlatformKit-specific
one, the PlatformKit meaning is the one here.

## A

**ADR — Architecture Decision Record.** A single file describing
a decision that had alternatives a reasonable team could have
picked. Each ADR carries "the problem", "the decision", "what we
gave up", "what we kept", "how we enforce it". Index at
[09](./09-architecture-decisions.md). Contrasted with
*convention*.

**Admin shell.** The canonical administrative UI container
rendered by the frontend kit's `components/organisms/admin_shell`.
Business modules contribute surface metadata — routes, labels,
capabilities — and the shell composes them.

**arc42.** The architecture-documentation template this
directory follows. Twelve sections, canonical numbering. See
[`index.md`](./index.md).

**Assurance-eligible.** A module flag
(`assuranceEligible: true`) that a core-certified module may
opt into. Triggers the evidence-generation audit
(`check-module-assurance-evidence`). See
[ADR 0015](../adr/0015-module-tiering.md).

**At-least-once delivery.** The outbox contract: every enqueued
event is delivered at least once to subscribers; subscribers are
responsible for idempotency. See
[ADR 0007](../adr/0007-transactional-outbox-for-event-delivery.md).

## B

**Brand context.** The `brand-context.tgz` tarball PKDS emits for
Claude Design, containing `brand.json`, DTCG `tokens.json`, 106
component JSON files, and 55 icon SVGs. See
[ADR 0022](../adr/0022-pkds-cue-authored-design-system-pipeline.md).

**Business module.** A self-contained vertical slice under the full
distribution's `pk-modules/<name>/`: DB schema,
domain logic, HTTP API, admin UI, and declared contracts. The public
`pk-modules/pkg/<name>` packages are smaller reference implementations of the
same boundary. Synonym of *module* when no ambiguity with fx's or Go's use of
the word.

## C

**Catalog.** Typed `ModuleContract` and `ModuleSet` values under the full
distribution's `catalog/modulecontracts/`. They own module identity, tier,
preset membership, and named sets. The public `pk-modules/pkg` reference pack
does not duplicate this catalog. See
[ADR 0048](../adr/0048-go-authored-catalog-and-generated-exports.md).

**Claude Design.** Anthropic's AI design tool (launched
2026-04-17) that consumes a PlatformKit `brand-context.tgz` as
its brand context and produces handoff bundles that PKDS applies
via `pkds handoff receive`. Integration via
the design system's `pkds/internal/emit/claudedesign` and
`internal/handoff/`.

**Contract (cross-module).** The interfaces a module exposes to
the rest of the platform. Lives in `<module>/contracts/provides/`
alongside module-level constants in `<module>/contracts/`. Other
modules import the contract; they do not import the
implementation. See
[C-04](../conventions.md#c-04-public-contracts-live-away-from-their-implementation).

**Contract test suite.** A `*contract/` package exporting
`RunXTests(t, factory)` that every implementation of an
interface runs against its own factory. See
[ADR 0021](../adr/0021-interface-contract-test-suites.md).

**Convention.** A rule that follows mechanically from an ADR
with no meaningful alternative. Lives in
[`conventions.md`](../conventions.md). Contrasted with *ADR*.

**Core-certified.** The strongest module tier — strongest
compatibility posture, assurance-eligible, included in `minimal`
/ `core` presets. See [ADR 0015](../adr/0015-module-tiering.md).

**CUE.** The configuration language PKDS authors its source in.
See [ADR 0022](../adr/0022-pkds-cue-authored-design-system-pipeline.md).

## D

**DTCG.** Design Tokens Community Group — the W3C draft standard
for portable design tokens. PKDS emits DTCG-compliant JSON with
`$value`, `$type`, `$description`, and `{alias}` references.

**Dual-path transport.** The requirement that every public port
method work over both HTTP and EventBus/NATS with identical
shapes. See
[ADR 0019](../adr/0019-dual-path-transport-symmetry.md).

## E

**Emitter (PKDS).** A Go package under
the design system's `pkds/internal/emit/<target>/` that
implements `Emit(ir pkds.IR) (Artifact, error)` for one
downstream target (claude-design, mobile, storybook, etc.).

**Event contract.** A declared event schema via
`standard.WithEvent(topic, description, schema)`. Emitting an
undeclared event is a CI failure. See
[ADR 0018](../adr/0018-event-contracts-are-declared.md).

**Event bus.** The interface `event.EventBus` provided by
`pk-core/app/event`. In-process in the monolith;
NATS-backed in microservices.

**Experimental.** The fast-moving module tier. No preset
inclusion, `notes:` field required documenting churn expectation.
See [ADR 0015](../adr/0015-module-tiering.md).

## F

**Feature.** A cohesive unit inside a module —
`<module>/features/<feature>/`. Owns its routes, handlers, and
(optionally) admin surfaces. See
[C-03](../conventions.md#c-03-features-own-their-routes).

**Feature builder.** `helpers.NewFeatureBuilder(...)` +
`RouteHandler[H]` — the backend-kit helpers that declare a
feature's metadata and register its handler with fx.

**fx (Uber).** The dependency-injection framework PlatformKit
uses. `fx.Provide`, `fx.Invoke`, `fx.Hook`, `fx.In`. See
[ADR 0017](../adr/0017-fx-dependency-injection-as-composition.md).

## G

**Generic handler.** `api.GenericHandler[T]` — the backend-kit
handler that provides automatic CRUD route handlers (GET list,
GET :id, POST, PUT :id, DELETE :id) for any entity type.

## H

**Handoff bundle.** A `pkds.handoff.v1` JSON payload from an
external design tool (typically Claude Design) proposing
token/component changes. Applied via `pkds handoff receive`.

**HTMX.** The server-state-transition library used as the default
mechanism for partial page rerenders. See
[ADR 0001](../adr/0001-interaction-architecture.md).

**Huma.** The Go HTTP framework PlatformKit uses. Auto-generates
OpenAPI from `huma.Register(api, operation, handler)` calls.

## I

**Idempotent subscriber.** A bus subscriber whose effect is the
same whether a message is delivered once or many times. Required
by the outbox's at-least-once contract. See
[ADR 0007](../adr/0007-transactional-outbox-for-event-delivery.md).

**IR (PKDS).** Intermediate representation. The output of
`pkds compile` — a typed in-memory structure that every PKDS
emitter reads. Persisted as JSON under `pkds/dist/ir/`.

## L

**Lint rule (PKDS).** One of the 10 rules under
`pkds/internal/lint/rules/`. Each rule checks one invariant and
emits findings with severity (error, warning, info). See
[ADR 0022](../adr/0022-pkds-cue-authored-design-system-pipeline.md).

## M

**Manifest (outbox).** `manifest.json` in `pkds/dist/ir/` —
records content hashes, schema version, git SHA, and a lineage
record of every source file that contributed. See
[ADR 0022](../adr/0022-pkds-cue-authored-design-system-pipeline.md).

**Module.** See *business module*.

**Module binding.** A NATS-backed port proxy in
`platformkit-module-bindings/` that satisfies a port interface
for the microservices topology. E.g.
`UserBoundaryServiceNATSClient` satisfies `ports.UserBoundaryService`.

**Module set.** A curated collection of modules with explicit
guarantees. E.g. `assurance-core` selects `tier: core-certified
AND assuranceEligible: true`. See
[ADR 0016](../adr/0016-module-sets-and-preset-composition.md).

**Monolith.** The `complete-saas-monolith` deployment topology —
one binary, all modules in-process, one database.

## N

**NATS.** The event bus + microservices RPC transport. Subject
naming convention: `<tenant>.<module>.<event-type>`.

## O

**Outbox.** The `internal/outbox/` primitive that writes events
to `outbox_events` in the same transaction as domain state,
drained by a worker to the bus. See
[ADR 0007](../adr/0007-transactional-outbox-for-event-delivery.md).

## P

**PKDS.** PlatformKit Design System — the `pkds/` subpackage of
the design system that is the single source of truth
for every design token, component contract, theme, experience,
and icon. See
[ADR 0022](../adr/0022-pkds-cue-authored-design-system-pipeline.md).

**pkvet.** `pk-core/cmd/pkvet` — the aggregated
`go vet` analyzer bundle for PlatformKit. Runs via
`make check-pkvet`. Hosts `safeerror`, `importboundary`,
`contractvar`, `interopimport`, `accesscontract`,
`eventcontract`, `buildtags`.

**Port.** An interface in the full distribution's
`pk-modules/ports/` that cross-module calls flow
through. A module's provider contract lives in `contracts/provides/`. Public
reference packages expose their OSS-facing interfaces from the package itself.
See
[ADR 0009](../adr/0009-ports-only-cross-module-communication.md).

**Preset.** A typed named membership label in a module's
`ModuleContract.Compatibility.Presets`. Full-distribution apps resolve presets
through the authored Go catalog; serialized YAML is an export only. See
[ADR 0016](../adr/0016-module-sets-and-preset-composition.md).

**Provider.** (a) A business module that exposes a port for
other modules to consume. (b) An implementation of a
backend-kit interface (e.g. `cache.Cache`'s memory provider,
Redis provider, noop provider).

## R

**Repo-split.** The workspace's 58-repo topology. Enforced
boundary between server-producing repos and dev/test repos that
carry heavy dependencies. See
[C-05](../conventions.md#c-05-server-binaries-dont-ship-browsers-or-docker).

**Route handler.** `helpers.RouteHandler[H]` — the feature-builder
primitive that registers an HTTP handler as an fx provider and
schedules its `RegisterRoutes(api huma.API)` call at boot.

## S

**Singleton (module).** `module.NewSingleton(createFn)` — the
one-time initialiser that memoises a module instance. See
[C-02](../conventions.md#c-02-one-module-one-instance).

**Supported.** The production-ready module tier. Not
assurance-eligible by default; safe for supported product
composition. See [ADR 0015](../adr/0015-module-tiering.md).

**Surface manifest.** The typed contract describing a concrete
app surface's composition — shell profile, route inventory,
navigation, page-pattern selections. See
[ADR 0002](../adr/0002-surface-manifests-and-shell-profiles.md).

## T

**Tenant.** A customer organisation. Every row carries a
`tenant_id`. Every request resolves a tenant via the
`tenant_management` middleware.

**Tier.** `core-certified` / `supported` / `experimental`.
Declared as a typed `Tier` in the full distribution's authored Go catalog. The
public reference pack does not maintain a parallel tier catalog. See
[ADR 0015](../adr/0015-module-tiering.md).

**Tone.** The semantic-intent axis of a component's styling
(neutral, brand, success, warning, danger, info). Distinct from
**variant**, which is the stylistic axis (primary, secondary,
outline, ghost, link). See
[ADR 0022](../adr/0022-pkds-cue-authored-design-system-pipeline.md)
R003.

**Typed Tailwind DSL.** The the design system's `tw/`
package that compiles typed token values to Tailwind utility
strings. Every utility class in the platform comes from this DSL.
See [ADR 0004](../adr/0004-typed-design-token-dsl.md).

## V

**Variant.** The stylistic axis of a component's styling
(primary, secondary, outline, ghost, link). Distinct from
**tone**. See entry for *tone*.

## W

**`WithoutCancel`.** `context.WithoutCancel(parent)` (Go 1.21+).
Returns a context that inherits values but detaches cancellation.
Request-path goroutines that outlive the response use this. See
[ADR 0008](../adr/0008-async-goroutine-context-semantics.md).

**`WithTransaction`.** `repo.WithTransaction(ctx, fn)` —
`crud.Repository[T]`'s primitive that runs `fn` inside a DB
transaction and propagates the tx through `ctx`. See
[ADR 0006](../adr/0006-transactional-atomicity-for-multi-entity-state.md).
