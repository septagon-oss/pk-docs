---
title: "08 Cross-cutting Concepts"
slug: architecture-08-cross-cutting-concepts
arc42_section: 8
collection: architecture
type: doc
tags: [architecture, arc42, cross-cutting]
authoring: authored
---

# 08 — Cross-cutting Concepts

Concerns every module inherits. Each subsection summarises the
concept and points to the ADR or convention where the decision is
authoritative. Don't paraphrase the ADR here — the ADR is the
authority; this section is the index into it.

## Error handling

**The rule.** Every error in a production code path either
propagates to the caller or logs at an appropriate level with
enough context for an operator to reconcile.
`_ = err`, `_, _ = fn(...)`, silent `continue` on decode failure —
none of these are permitted outside narrowly scoped cases.

**Log level is semantic.** Error is for compliance failures and
state-drift conditions. Warn is for lost informational events and
engaged fallbacks. Info is normal operation.

**`panic` is scoped.** Permitted in `init`, config validation, and
`Must*` helpers. Request-path code returns wrapped errors that the
handler translates to HTTP 500.

**Authority.**
[ADR 0005 — no silent failures in production paths](../adr/0005-error-handling-discipline.md).

**Enforcement.** `safeerror` pkvet analyzer (bundled into
`make check-pkvet`) plus review discipline.

## Transactional atomicity

**The rule.** Any use case that performs more than one
`Create`/`Update`/`Delete` whose atomicity affects correctness
wraps the work in `repo.WithTransaction(ctx, fn)`. Downstream
service calls inside the same logical operation inherit the tx
through `ctx` propagation.

**Why not best-effort rollback?** "Atomicity by convention plus
logging" isn't atomicity — concurrent reads during the Create
window see the transient state. Uniqueness constraints fire
against half-states. Audit trails record the half-state.

**Authority.**
[ADR 0006 — multi-entity writes are atomic or they don't happen](../adr/0006-transactional-atomicity-for-multi-entity-state.md).

**Enforcement.** Per-use-case mock-tx test that injects a
`crud.Repository[T]` stub recording whether `WithTransaction` was
called. Reference shape in
`tenant_management/features/tenant_lifecycle/usecases/onboard_tenant_tx_test.go`.

## Event delivery (the outbox)

**The rule.** Producers write the event to the `outbox_events`
table *in the same transaction* as the domain state change. A
separate worker drains the outbox to the bus with at-least-once
delivery. Subscribers are idempotent.

**Why not `bus.Publish` directly?** A straight
`repo.Update(...)` + `bus.Publish(...)` is a dual write. If the
bus publish fails, the event is lost but the state is persisted.
Downstream subscribers never learn about the change, and nothing
durable captures the intent to publish.

**Three-layer defence against empty `event_id`.** Postgres column
default `gen_random_uuid()` + application fallback in
`Service.Enqueue` + worker refusal in `publishOne`. An INSERT via
backfill tooling or manual SQL can't bypass the id discipline.

**Authority.**
[ADR 0007 — events go through the outbox, not straight to the bus](../adr/0007-transactional-outbox-for-event-delivery.md).

**Enforcement.** 18-test contract suite on the outbox primitive
itself. Producer adoption is per-module, opportunistic — tracked
as a gap in
[11 Risks and Technical Debt](./11-risks-and-technical-debt.md).

## Async context

**The rule.** Goroutines fired from a request handler that outlive
the response use `context.WithoutCancel(ctx)` — not
`context.Background()`, not the raw `ctx`.

**Why.** `context.Background()` drops the trace id, tenant id,
and user id that the request built up; log correlation dies. The
raw `ctx` cancels when the HTTP response completes, microseconds
after the goroutine starts.

**Scope.** Applies to async notifications, fire-and-forget usage
writes, and post-commit event publishes (until the producer
migrates to the outbox). Does *not* apply to fx lifecycle-scoped
workers (they're rooted in `context.Background()` by design) or
to genuinely parent-less cleanup goroutines.

**Authority.**
[ADR 0008 — background work keeps its tracing and loses its deadline](../adr/0008-async-goroutine-context-semantics.md).

**Enforcement.** Review rule today. A targeted lint combining
"inside a `go func()` closure" with "caller function has `ctx` in
scope" would catch the pattern; tracked as follow-up.

## Event contract declarations

**The rule.** Every event a module emits is declared via
`standard.WithEvent(topic, description, schema)`. Emitting an
undeclared event is a CI failure.

**Why.** The event bus isn't a compiler. A typo in a field name
is a silent drop on the subscriber side; a renamed field looks
fine to the producer and disappears to everyone else. Declarations
are the source of truth that the manifest, the capability matrix,
subscriber-side codegen, and the lint rule all read.

**Authority.**
[ADR 0018 — every event has a declared contract](../adr/0018-event-contracts-are-declared.md).

**Enforcement.** `platformkit verify module event-contracts`
(declaration side) + `eventcontract` pkvet analyzer (emit side).
Together they're the mandatory pair — declare without emit, or emit
without declare, fails CI.

## Dual-path transport symmetry

**The rule.** Every public port method is reachable through both
HTTP and EventBus/NATS with identical request/response shapes.

**Why.** Monolith and microservices compose from the same modules;
a port that works only over HTTP breaks microservices
deployability; a port that works only over the bus breaks the
monolith's synchronous call sites.

**Authority.**
[ADR 0019 — every port works over HTTP and NATS](../adr/0019-dual-path-transport-symmetry.md).

**Enforcement.** `check-dual-path-flows` (presence parity) +
`check-dual-path-flows-strict` (shape parity) +
`platformkit-module-bindings/` per-module proxy tests.

## Design system

**The rule.** Every design token, component contract, theme,
experience, and icon is authored in CUE under
`platformkit-design-system/pkds/src/`. Every consumer (Claude
Design, mobile, Storybook, Tailwind, future Figma/iOS/React)
receives its artifact from a pure emitter function that reads the
compiled IR.

**Why.** The pre-PKDS pipeline had three sources of truth in three
languages — Go for tokens, TypeScript (via Storybook extraction)
for components, YAML for themes. The extraction step produced
observable defects: the Button `size` enum shipped with nine
aliased values because Storybook merged `_size` and `size`
silently; Input declared 25 props because TypeScript extraction
didn't know an atom shouldn't. The 2026-04-23 audit catalogued
eight structural defects. PKDS makes every one of them
mechanically impossible through contract linting.

**Authority.**
[ADR 0022 — the design system is CUE-authored end to end](../adr/0022-pkds-cue-authored-design-system-pipeline.md).

**Enforcement.** `pkds lint` (10 rules), `pkds check` (CI gate),
golden-file tests per emitter, `TestAuditReplay` forensic fixture.

**Upstream of PKDS.** The typed Tailwind DSL
([ADR 0004](../adr/0004-typed-design-token-dsl.md)) and the
`style.go` resolver pattern
([ADR 0003](../adr/0003-component-token-extractor-pattern.md))
are preserved — PKDS emits into the same surface the DSL expects.

## Interaction architecture (frontend)

**The rule.** Server-rendered Go owns markup, props, accessibility,
and server-driven composition. HTMX owns server state transitions.
Client JavaScript is limited to ephemeral interaction state
(open/closed, keyboard, focus, browser preferences) through a
shared controller runtime. Only interactive organisms and pages
hydrate as islands.

**Authority.**
[ADR 0001 — we organise UI behaviour on two axes](../adr/0001-interaction-architecture.md).

**Companion decision.**
[ADR 0002 — product composition is a typed contract, not app glue](../adr/0002-surface-manifests-and-shell-profiles.md) — the surface
manifest and shell profile contracts that let modules contribute UI
portably.

**Enforcement.** Review rules today (no raw `onclick`, no inline
behaviour blobs). A registry analyzer is tracked for the "declared
behaviour metadata" requirement.

## Component style resolution

**The rule.** Every component that consumes design tokens splits
into `style.go` (class-string resolution) and `builder.go`
(composition only, zero class-string literals). Token types live in
the design system; components consume them through
`resolveXxxStyle`.

**Authority.**
[ADR 0003 — every component resolves its styles through style.go](../adr/0003-component-token-extractor-pattern.md).

**Enforcement.** `cmd/guard-tokens` lint rules plus
`style_test.go` per tokenised component.

## Module singleton discipline

**The rule.** Every business module uses `module.NewSingleton` to
memoise its instance; `NewModule()` is called exactly once per app
(in the catalog), and `GetModule()` is the read-only accessor
everywhere else.

**Authority.**
[Convention C-02 — one module, one instance](../conventions.md#c-02-one-module-one-instance).

## Tier posture

**The rule.** Every module declares a tier (`core-certified`,
`supported`, `experimental`) in the full distribution's typed
`catalog/modulecontracts/authored_catalog.go`. The claim is mechanically
cross-checked against the module's actual substance (migrations, tests,
evidence). The public `pk-modules/pkg` reference pack does not duplicate the
tier catalog; serialized catalog formats are generated exports only.

**Authority.**
[ADR 0015 — every module declares one of three tiers](../adr/0015-module-tiering.md).
See also
[ADR 0048 — the catalog is Go-authored](../adr/0048-go-authored-catalog-and-generated-exports.md).

**Enforcement.** `check-module-contracts`,
`check-module-maturity`, `check-module-assurance-evidence`.

## Contract test suites

**The rule.** Interfaces with multiple implementations ship a
sibling `*contract/` package exporting `RunXTests(t, factory)`.
Each production-facing provider wires the suite from its own
`_test.go`. Deliberately non-conforming stubs opt out explicitly
and document why.

**Authority.**
[ADR 0021 — interfaces with multiple implementations share a test suite](../adr/0021-interface-contract-test-suites.md).

**Enforcement.** Test-compile verification + per-kit `make test`
targets. Gap: no repo-wide CI gate requiring contract packages to
exist for new interfaces.

## What connects the concepts

Reading this section end to end, one pattern emerges: **every
cross-cutting concern is a mechanical gate, not a review policy**.
We don't ask "did the author think about error handling?" — we ask
"does the `safeerror` analyzer pass?" We don't ask "is this
module's event declared?" — we ask "does `eventcontract` pass?"

The places where we *do* rely on review — WithoutCancel in
goroutines, outbox adoption, subscriber idempotency — are
explicitly labelled as gaps in the corresponding ADRs and tracked
in [11 Risks and Technical Debt](./11-risks-and-technical-debt.md).
The goal is to collapse each review rule into a mechanical check
over time.
