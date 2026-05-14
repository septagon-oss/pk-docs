---
title: "09 Architecture Decisions"
slug: architecture-09-architecture-decisions
arc42_section: 9
collection: architecture
type: doc
tags: [architecture, arc42, adr, conventions]
authoring: authored
---

# 09 — Architecture Decisions

This is the index. Every decision PlatformKit has made that had a
real alternative lives in `adr/`. Every rule that follows
mechanically from one of those decisions lives in
[`conventions.md`](../conventions.md). Both are linked from here
with one-line summaries.

If you're looking for *why* the architecture is shaped this way —
the causal chain — the five pillars in
[04 Solution Strategy](./04-solution-strategy.md) give you the
skeleton, and the ADRs below give you the meat.

## The Core ADRs

Grouped by area. Each entry: the title (the decision sentence), the
CI/lint/runtime guard that enforces it, and the ADR file.

### Frontend architecture (4)

| # | Decision | Guard |
|---|---|---|
| [0001](../adr/0001-interaction-architecture.md) | We organise UI behaviour on two axes | `check-ui-interactions` + review |
| [0002](../adr/0002-surface-manifests-and-shell-profiles.md) | Product composition is a typed contract, not app glue | Surface-manifest test suite |
| [0003](../adr/0003-component-token-extractor-pattern.md) | Every component resolves its styles through `style.go` | `guard-tokens` + per-component `style_test.go` |
| [0004](../adr/0004-typed-design-token-dsl.md) | Every Tailwind class goes through a typed DSL | `check-ui-tokens` + `cmd/guard-tokens` |

### Runtime reliability (4)

| # | Decision | Guard |
|---|---|---|
| [0005](../adr/0005-error-handling-discipline.md) | No silent failures in production paths | `safeerror` pkvet + review |
| [0006](../adr/0006-transactional-atomicity-for-multi-entity-state.md) | Multi-entity writes are atomic or they don't happen | Per-use-case mock-tx test |
| [0007](../adr/0007-transactional-outbox-for-event-delivery.md) | Events go through the outbox, not straight to the bus | Three-layer `event_id` defence + 18-test contract suite |
| [0008](../adr/0008-async-goroutine-context-semantics.md) | Background work keeps its tracing and loses its deadline | Review + trace-correlation audit |

### Module system and composition (6)

| # | Decision | Guard |
|---|---|---|
| [0009](../adr/0009-ports-only-cross-module-communication.md) | Modules only talk through ports | `check-pkvet` + `importboundary` pkvet |
| [0015](../adr/0015-module-tiering.md) | Every module declares one of three tiers | `check-module-contracts` + `check-module-maturity` + `check-module-assurance-evidence` |
| [0016](../adr/0016-module-sets-and-preset-composition.md) | Apps compose from presets, not hand-maintained module lists | `check-module-sets` + `check-module-capability-matrix` |
| [0017](../adr/0017-fx-dependency-injection-as-composition.md) | Fx is the composition model | fx boot-time validation + `check-module-port-event-audit` + `check-module-deps` |
| [0021](../adr/0021-interface-contract-test-suites.md) | Interfaces with multiple implementations share a test suite | Test-compile verification per kit |
| [0028](../adr/0028-domain-owned-security-and-delivery-capabilities.md) | Domain modules own security decisions and delivery modules deliver messages | Ownership review + auth-owned coordinator tests |

### Events and transport (2)

| # | Decision | Guard |
|---|---|---|
| [0018](../adr/0018-event-contracts-are-declared.md) | Every event has a declared contract | `platformkit verify module event-contracts` + `eventcontract` pkvet |
| [0019](../adr/0019-dual-path-transport-symmetry.md) | Every port works over HTTP and NATS | `check-dual-path-flows` + `check-dual-path-flows-strict` + per-module proxy tests |

### Design system (1)

| # | Decision | Guard |
|---|---|---|
| [0022](../adr/0022-pkds-cue-authored-design-system-pipeline.md) | The design system is CUE-authored end to end | `pkds lint` (10 rules) + `pkds check` CI gate + golden-file tests per emitter |

## The 6 conventions

Rules that follow mechanically from the decisions above.

| # | Rule | Authority |
|---|---|---|
| [C-01](../conventions.md#c-01-migrations-are-append-only) | Migrations are append-only | Implicit — SQL migration hygiene |
| [C-02](../conventions.md#c-02-one-module-one-instance) | One module, one instance | [ADR 0017](../adr/0017-fx-dependency-injection-as-composition.md) |
| [C-03](../conventions.md#c-03-features-own-their-routes) | Features own their routes | [ADR 0009](../adr/0009-ports-only-cross-module-communication.md), [ADR 0017](../adr/0017-fx-dependency-injection-as-composition.md) |
| [C-04](../conventions.md#c-04-public-contracts-live-away-from-their-implementation) | Public contracts live away from their implementation | [ADR 0009](../adr/0009-ports-only-cross-module-communication.md) |
| [C-05](../conventions.md#c-05-server-binaries-dont-ship-browsers-or-docker) | Server binaries don't ship browsers or Docker | Runtime hygiene |
| [C-06](../conventions.md#c-06-test-coverage-scales-with-tier) | Test coverage scales with tier | [ADR 0015](../adr/0015-module-tiering.md) |

## Decision-to-guard matrix

Machine-checked guards today:

- Cross-module imports — `check-pkvet`, `importboundary`
- Public contracts layout — `check-structure`, `contractvar`, `interopimport`, `accesscontract`
- Typed Tailwind classes — `cmd/guard-tokens`
- Silent errors — `safeerror`
- Module tier claims — `check-module-contracts`, `check-module-maturity`, `check-module-assurance-evidence`
- Preset composition — `check-module-sets`, `check-module-capability-matrix`
- Event contracts — `platformkit verify module event-contracts`, `eventcontract`
- Dual-path flows — `check-dual-path-flows`, `check-dual-path-flows-strict`
- E2E build tags — `buildtags`
- Security/delivery ownership — review + package-local coordinator/provider tests
- Repo-split import bans — `repo-split-importcheck`
- Module fx wiring integrity — `check-module-port-event-audit`, `check-module-deps`
- Design-system correctness — `pkds lint` (10 rules)

Review-only or tracked-as-gap guards (see
[11 Risks and Technical Debt](./11-risks-and-technical-debt.md)):

- Migrations append-only ([C-01](../conventions.md#c-01-migrations-are-append-only)) — needs git-diff CI check.
- `module.NewSingleton` body inspection ([C-02](../conventions.md#c-02-one-module-one-instance)) — `check-structure` only verifies function shape.
- Route registration outside feature package ([C-03](../conventions.md#c-03-features-own-their-routes)) — review-only today.
- Transactional atomicity at the use-case level ([ADR 0006](../adr/0006-transactional-atomicity-for-multi-entity-state.md)) — per-use-case mock-tx test, no static analyzer.
- `context.Background()` in request-path closures ([ADR 0008](../adr/0008-async-goroutine-context-semantics.md)) — review-only.
- Outbox adoption ([ADR 0007](../adr/0007-transactional-outbox-for-event-delivery.md)) — no producer-side analyzer.
- Subscriber idempotency ([ADR 0007](../adr/0007-transactional-outbox-for-event-delivery.md)) — no contract-test helper.
- Tier-aware line-coverage thresholds ([C-06](../conventions.md#c-06-test-coverage-scales-with-tier)) — floor is flat `≥1 test file`.
- Per-feature test-file floor ([C-06](../conventions.md#c-06-test-coverage-scales-with-tier)) — not counted today.
- Cross-repo `repo-split-importcheck` drift ([C-05](../conventions.md#c-05-server-binaries-dont-ship-browsers-or-docker)) — each repo wires its own arguments.

## How to add a new decision

Question: **does this have an alternative a reasonable team could
have picked?**

### If yes — add an ADR

1. Copy `adr/0000-template.md` to
   `adr/00NN-short-slug.md` with the next free number.
2. Title is the decision sentence, not a category
   (`We chose X` / `Events go through the outbox`).
3. Fill in the five sections: **The problem** (narrative, not
   bullets), **The decision** (declarative), **What we gave up**
   (honest costs), **What we kept** (real benefits), **How we
   enforce it** (every analyzer, every gap).
4. Link to motivating commits, related ADRs, related conventions.
5. Add the new ADR to the tables above.

### If no — add a convention

1. Pick the next `C-NN` number.
2. Add to [`conventions.md`](../conventions.md) with the
   canonical shape: rule statement + code example + **Why we do
   it this way** + **When you're editing X** + **How it's
   enforced** + **Motivating ADR**.
3. Cite the motivating ADR explicitly — a convention without a
   parent decision is a sign it's really an ADR in disguise.
4. Add the new convention to the tables above.

## Superseded and retired decisions

- ADR 0010 — Migrations are append-only. Retired (2026-04-24);
  content lives in [Convention C-01](../conventions.md#c-01-migrations-are-append-only).
- ADR 0011 — Module singleton pattern. Retired; now
  [Convention C-02](../conventions.md#c-02-one-module-one-instance).
- ADR 0012 — Features own their routes. Retired; now
  [Convention C-03](../conventions.md#c-03-features-own-their-routes).
- ADR 0013 — Contracts live in `contracts/provides/`. Retired;
  now [Convention C-04](../conventions.md#c-04-public-contracts-live-away-from-their-implementation).
- ADR 0014 — Runtime boundary (no browser or Docker in server
  binaries). Retired; now
  [Convention C-05](../conventions.md#c-05-server-binaries-dont-ship-browsers-or-docker).
- ADR 0020 — Test coverage floor by tier. Retired; now
  [Convention C-06](../conventions.md#c-06-test-coverage-scales-with-tier).

ADR numbers are preserved with gaps — the migration didn't
renumber anything, so externally-cited ADR numbers continue to
resolve.
