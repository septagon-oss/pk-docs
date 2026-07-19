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

### Security and data protection (7)

| # | Decision | Guard |
|---|---|---|
| [0065](../adr/0065-reusable-application-secrets-use-versioned-aead-envelopes.md) | Reusable application secrets use versioned authenticated-encryption envelopes | Protected-store production constructor + envelope/keyring tests |
| [0066](../adr/0066-federated-identities-bind-verified-issuer-and-subject.md) | Federated identities bind verified issuer and subject, not mutable claims | Federated-directory constructor requirement + binding/race tests |
| [0067](../adr/0067-refresh-tokens-use-durable-single-use-families.md) | Refresh tokens use durable single-use families | Hash-only family ledger + transactional compare-and-swap + live access-session verifier |
| [0070](../adr/0070-interactive-browser-authentication-uses-durable-one-time-bound-proofs.md) | Interactive browser authentication uses durable one-time bound proofs | Opaque OIDC state + hash-only callback ledger + exact atomic consume + browser binding |
| [0071](../adr/0071-email-verification-uses-hash-only-proofs-and-owner-guarded-activation.md) | Email verification uses hash-only proofs and owner-guarded activation | Hash-only credential ledger + scanner-safe CSRF confirmation + exact user-owner CAS + atomic resend cooldown |
| [0072](../adr/0072-one-time-public-authentication-bearers-use-hash-only-scoped-ledgers.md) | One-time public authentication bearers use hash-only scoped ledgers | 256-bit unpredictability + exact-purpose digest scope + atomic single consume + irreversible plaintext cutovers |
| [0073](../adr/0073-runtime-a2ui-surfaces-cross-an-app-owned-signed-delivery-boundary.md) | Runtime A2UI surfaces cross an app-owned signed delivery boundary | Offline-root keyset + app signer finalizer + exact audience + durable native replay floors |

### Module system and composition (7)

| # | Decision | Guard |
|---|---|---|
| [0009](../adr/0009-ports-only-cross-module-communication.md) | Modules only talk through ports | `check-pkvet` + `importboundary` pkvet |
| [0015](../adr/0015-module-tiering.md) | Every module declares one of three tiers | `check-module-contracts` + `check-module-maturity` + `check-module-assurance-evidence` |
| [0016](../adr/0016-module-sets-and-preset-composition.md) | Apps compose from presets, not hand-maintained module lists | `check-module-sets` + `check-module-capability-matrix` |
| [0017](../adr/0017-fx-dependency-injection-as-composition.md) | Fx is the composition model | fx boot-time validation + `check-module-port-event-audit` + `check-module-deps` |
| [0021](../adr/0021-interface-contract-test-suites.md) | Interfaces with multiple implementations share a test suite | Test-compile verification per kit |
| [0028](../adr/0028-domain-owned-security-and-delivery-capabilities.md) | Domain modules own security decisions and delivery modules deliver messages | Ownership review + auth-owned coordinator tests |
| [0048](../adr/0048-go-authored-catalog-and-generated-exports.md) | The catalog is Go-authored; serialized formats are exports | Compiler + authored-catalog tests + `check-module-contracts` |

### Events and transport (2)

| # | Decision | Guard |
|---|---|---|
| [0018](../adr/0018-event-contracts-are-declared.md) | Every event has a declared contract | `platformkit verify module event-contracts` + `eventcontract` pkvet |
| [0019](../adr/0019-dual-path-transport-symmetry.md) | Every port works over HTTP and NATS | `check-dual-path-flows` + `check-dual-path-flows-strict` + per-module proxy tests |

### Design system (1)

| # | Decision | Guard |
|---|---|---|
| [0022](../adr/0022-pkds-cue-authored-design-system-pipeline.md) | The design system is CUE-authored end to end | `pkds lint` (10 rules) + `pkds check` CI gate + golden-file tests per emitter |

### Governance and traceability (2)

| # | Decision | Guard |
|---|---|---|
| [0029](../adr/0029-every-file-declares-its-purpose.md) | Every Go file declares its purpose with structured traceability | Workspace `check-file-purpose` + `check-traceability` |
| [0064](../adr/0064-file-purpose-traceability-is-a-blocking-workspace-invariant.md) | File-purpose traceability is a blocking workspace invariant | Exact-content debt ratchet + workspace root-coverage check |

## Conventions

Rules that follow mechanically from the decisions above.

| # | Rule | Authority |
|---|---|---|
| [C-01](../conventions.md#c-01-migrations-are-append-only) | Migrations are append-only | Implicit — SQL migration hygiene |
| [C-02](../conventions.md#c-02-one-module-one-instance) | One module, one instance | [ADR 0017](../adr/0017-fx-dependency-injection-as-composition.md) |
| [C-03](../conventions.md#c-03-features-own-their-routes) | Features own their routes | [ADR 0009](../adr/0009-ports-only-cross-module-communication.md), [ADR 0017](../adr/0017-fx-dependency-injection-as-composition.md) |
| [C-04](../conventions.md#c-04-public-contracts-live-away-from-their-implementation) | Public contracts live away from their implementation | [ADR 0009](../adr/0009-ports-only-cross-module-communication.md) |
| [C-05](../conventions.md#c-05-server-binaries-dont-ship-browsers-or-docker) | Server binaries don't ship browsers or Docker | Runtime hygiene |
| [C-06](../conventions.md#c-06-test-coverage-scales-with-tier) | Test coverage scales with tier | [ADR 0015](../adr/0015-module-tiering.md) |
| [C-07](../conventions.md#c-07-admin-ui-consumes-design-tokens-never-raw-colors) | Admin UI consumes design tokens, never raw colors | [ADR 0003](../adr/0003-component-token-extractor-pattern.md), [ADR 0004](../adr/0004-typed-design-token-dsl.md) |
| [C-08](../conventions.md#c-08-workspace-guards-emit-a-single-output-format) | Workspace guards emit one interoperable output contract | Cross-cutting tooling hygiene |
| [C-09](../conventions.md#c-09-runtime-startup-is-explicit-and-one-way) | Runtime startup is explicit and one-way | Runtime failure-boundary discipline |
| [C-10](../conventions.md#c-10-shared-builders-return-errors-not-panics) | Shared builders return errors, not panics | Recoverable-error discipline |
| [C-17](../conventions.md#c-17-reusable-application-secrets-use-versioned-aead-envelopes) | Reusable application secrets use versioned AEAD envelopes | [ADR 0065](../adr/0065-reusable-application-secrets-use-versioned-aead-envelopes.md) |
| [C-18](../conventions.md#c-18-federated-login-binds-stable-provider-subjects) | Federated login binds stable provider subjects | [ADR 0066](../adr/0066-federated-identities-bind-verified-issuer-and-subject.md) |
| [C-19](../conventions.md#c-19-refresh-bearers-have-one-durable-current-authority) | Refresh bearers have one durable current authority | [ADR 0067](../adr/0067-refresh-tokens-use-durable-single-use-families.md) |
| [C-20](../conventions.md#c-20-interactive-browser-authentication-uses-one-time-bound-proofs) | Interactive browser authentication uses one-time bound proofs | [ADR 0070](../adr/0070-interactive-browser-authentication-uses-durable-one-time-bound-proofs.md) |
| [C-21](../conventions.md#c-21-email-verification-bearers-are-hash-only-and-owner-guarded) | Email-verification bearers are hash-only and owner-guarded | [ADR 0071](../adr/0071-email-verification-uses-hash-only-proofs-and-owner-guarded-activation.md) |
| [C-22](../conventions.md#c-22-one-time-public-authentication-bearers-use-hash-only-scoped-ledgers) | One-time public authentication bearers use hash-only scoped ledgers | [ADR 0072](../adr/0072-one-time-public-authentication-bearers-use-hash-only-scoped-ledgers.md) |
| [C-23](../conventions.md#c-23-live-a2ui-delivery-has-one-app-owned-signed-boundary) | Live A2UI delivery has one app-owned signed boundary | [ADR 0073](../adr/0073-runtime-a2ui-surfaces-cross-an-app-owned-signed-delivery-boundary.md) |
| [C-14](../conventions.md#c-14-every-go-file-declares-its-purpose) | Every Go file declares its purpose | [ADR 0029](../adr/0029-every-file-declares-its-purpose.md), [ADR 0064](../adr/0064-file-purpose-traceability-is-a-blocking-workspace-invariant.md) |

## Decision-to-guard matrix

Machine-checked guards today:

- Cross-module imports — `check-pkvet`, `importboundary`
- Public contracts layout — `check-structure`, `contractvar`, `interopimport`, `accesscontract`
- Typed Tailwind classes — `cmd/guard-tokens`
- Silent errors — `safeerror`
- Module tier claims — `check-module-contracts`, `check-module-maturity`, `check-module-assurance-evidence`
- Preset composition — `check-module-sets`, `check-module-capability-matrix`
- Catalog source direction — typed authored catalog tests; serialized exports are one-way projections
- Event contracts — `platformkit verify module event-contracts`, `eventcontract`
- Dual-path flows — `check-dual-path-flows`, `check-dual-path-flows-strict`
- Reusable application secrets — protected-store constructors + versioned AEAD envelope/keyring tests
- Interactive browser authentication — opaque OIDC state + hash-only callback ledger + exact atomic consume + browser-binding/MFA continuation tests
- Email verification — hash-only consume + owner-guarded activation CAS + scanner-safe CSRF confirmation + sensitive delivery + atomic resend cooldown tests
- One-time public authentication bearers — purpose-scoped digest ledgers + atomic consume + scanner-safe browser flows + irreversible plaintext-cutover tests
- Live A2UI delivery — root/keyset/envelope golden chain + app-owned signing finalizer + durable replay/equivocation tests
- E2E build tags — `buildtags`
- Security/delivery ownership — review + package-local coordinator/provider tests
- Repo-split import bans — `repo-split-importcheck`
- Module fx wiring integrity — `check-module-port-event-audit`, `check-module-deps`
- Design-system correctness — `pkds lint` (10 rules)
- File-purpose traceability — workspace `check-file-purpose` exact-content debt ratchet

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
5. Add the new ADR to the tables above and, when accepted, to
   `.platformkit/docs.manifest.yaml` so federated navigation includes it.

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
