---
title: "11 Risks and Technical Debt"
slug: architecture-11-risks-and-technical-debt
arc42_section: 11
collection: architecture
type: doc
tags: [architecture, arc42, risks, debt]
authoring: authored
---

# 11 — Risks and Technical Debt

Every ADR carries an honest "How we enforce it" section that lists
what's machine-checked today and what's still review-only. This
page aggregates those gaps into one place so operators and
auditors don't have to read the full ADR portfolio to know where the soft spots
are.

The principle the platform has consistently applied: **every
review rule should become a mechanical check over time**. This
page is the work list for that trajectory.

## Enforcement gaps (tracked follow-ups)

Ordered by the severity of the consequence if the rule silently
drifts. "High" means a missed enforcement can ship an incorrect
artifact; "medium" means a violation is visible in review but not
in CI; "low" means a policy gap.

### High — enforcement gaps on correctness-critical rules

| Gap | Consequence if it drifts | Rule | Proposed closure |
|---|---|---|---|
| Outbox adoption per producer | A `bus.Publish` call outside a transaction still works but loses the durability guarantee. | [ADR 0007](../adr/0007-transactional-outbox-for-event-delivery.md) | Producer-side analyzer: flag `bus.Publish` calls inside a module that declares an outbox dependency. |
| Subscriber idempotency | The at-least-once contract assumes subscriber idempotency; a non-idempotent subscriber receiving a duplicate corrupts its projection. | [ADR 0007](../adr/0007-transactional-outbox-for-event-delivery.md) | Contract-test helper in `pk-testkit` that exercises duplicate delivery against a subscriber's projection. |
| Transactional atomicity at the use-case level | A multi-entity use case that forgets to call `WithTransaction` ships with non-atomic writes. Per-use-case mock-tx test catches it if the test exists. | [ADR 0006](../adr/0006-transactional-atomicity-for-multi-entity-state.md) | Use-case-shape analyzer: identify use-case functions by naming convention / struct method set and check for tx wrapping. |
| `context.Background()` in request-path closures | Async work loses trace correlation; incidents become harder to debug. | [ADR 0008](../adr/0008-async-goroutine-context-semantics.md) | Targeted lint: "inside a `go func()` closure" + "caller has `ctx` in scope" ⇒ refuse `context.Background()`. |
| Fail-closed rule on contract opt-outs | A noop that silently grants permissions passes CI. One instance caught by reviewer pushback in 2026-04-13. | [ADR 0021](../adr/0021-interface-contract-test-suites.md) | Policy — not statically checkable. Mitigation: require an explicit `// justified: noop opts out because …` doc comment on non-conforming stubs, enforced by a lint. |

### Medium — structure/discipline gaps

| Gap | Consequence if it drifts | Rule | Proposed closure |
|---|---|---|---|
| Append-only migrations | An edited migration silently diverges environments. | [C-01](../conventions.md#c-01-migrations-are-append-only) | `check-migrations-append-only`: `git diff --name-only HEAD~<n>..HEAD` against `<module>/migrations/NNNN_*.sql` whose version appears in prior commits. |
| `module.NewSingleton` body shape | A module with `NewModule` written as a plain factory passes `check-structure`. | [C-02](../conventions.md#c-02-one-module-one-instance) | `pkvet` analyzer that inspects the body of `NewModule` and verifies the backing variable is `*module.Singleton[T]`. |
| Runtime single-instance assertion | A duplicate `NewModule` call today succeeds at boot with two parallel fx option bundles. | [C-02](../conventions.md#c-02-one-module-one-instance) | Runtime guard in `module.NewSingleton` that logs Error (or panics in dev) on a second initialisation. |
| Feature-owned route registration | A `huma.Register` call in `module.go` or `admin.go` compiles and runs. | [C-03](../conventions.md#c-03-features-own-their-routes) | Static analyzer that rejects `huma.Register` / `routing.Register` / `router.*` outside `<module>/features/<feature>/` source files. |
| `EndpointDefinition` ↔ `RegisterRoutes` drift | Declared endpoint metadata doesn't match actual registration. | [C-03](../conventions.md#c-03-features-own-their-routes) | Analyzer that cross-checks the declared `EndpointDefinition` list in `feature.go` against actual registration call sites in the same feature. |
| Contract package existence per interface | A new interface in `infrastructure/search/` ships without a matching `searchcontract/`. | [ADR 0021](../adr/0021-interface-contract-test-suites.md) | Analyzer that walks `interface` declarations and asserts a sibling `*contract/` package exists. |
| Provider wires the contract | A session-auth provider ships without importing `authcontract` and passes CI. | [ADR 0021](../adr/0021-interface-contract-test-suites.md) | Analyzer that walks production-provider packages and verifies the contract suite is wired. |
| fx app-level cross-module collision | A module that provides a type colliding with another module's provider fails at boot, not at merge. | [ADR 0017](../adr/0017-fx-dependency-injection-as-composition.md) | CI job that runs `fx.New` dry-run against every app × preset combination. |

### Low — operational + policy gaps

| Gap | Consequence if it drifts | Rule | Proposed closure |
|---|---|---|---|
| Tier-aware line-coverage thresholds | A `core-certified` module with one shallow test file passes `check-tests-floor`. | [C-06](../conventions.md#c-06-test-coverage-scales-with-tier) | Wire a coverage pass into CI; raise the gate to the `≥70% / ≥50%` per-tier thresholds described in C-06. |
| Per-feature test-file floor | A core-certified module with one module-level test and zero per-feature tests passes `check-tests-floor`. | [C-06](../conventions.md#c-06-test-coverage-scales-with-tier) | Counter that walks each `features/<feature>/` directory and enforces ≥1 `*_test.go` per feature on supported+ tiers. |
| Cross-repo `repo-split-importcheck` argument drift | Each server-producing repo wires its own `--forbid-prefix` list; a repo that forgets to add `go-rod` slips through. | [C-05](../conventions.md#c-05-server-binaries-dont-ship-browsers-or-docker) | CI target that prints and diffs the arguments across all server-producing repos. |
| `Raw()` in `ClassList` chains | Runtime-computed classes bypass the typed DSL. Reviewer-gated today. | [ADR 0004](../adr/0004-typed-design-token-dsl.md) | A PR-review gate is acceptable long-term; the warning exists precisely because runtime-computed content is sometimes legitimate. |
| Contract-skipping noop justification | A noop that deliberately opts out is expected to document *why*. Nothing enforces the doc comment. | [ADR 0021](../adr/0021-interface-contract-test-suites.md) | Lint that requires a `// justified:` comment on non-conforming stubs. |

## Known technical-debt surface

Distinct from enforcement gaps — these are known rough edges in
the code itself, not in the CI gates.

### Design system migration surface

PKDS ([ADR 0022](../adr/0022-pkds-cue-authored-design-system-pipeline.md))
shipped Phases 0-6 complete. Remaining work in Phase 5 is not
blocking Claude Design or mobile consumption but is worth
finishing:

- **`pkds emit figma`** — Figma push emitter. Existing `figmagen`
  path to retire.
- **`pkds emit tailwind`** — Tailwind config emitter. Would
  replace the current `adapters/tailwind/` generator.
- **`pkds emit react`** — React SDK emitter (`@pkds/react` npm
  package). Currently no React consumer; would unlock one.
- **`pkds emit ios`** — iOS Swift tokens. Mobile uses DTCG via the
  `W3CTokenStrategy` reader today; a native Swift-tokens emitter
  is a future requirement if a pure-Swift mobile app appears.

See [ADR 0022 Phase 5](../adr/0022-pkds-cue-authored-design-system-pipeline.md).

### Existing-path token overrides in handoff

The `pkds handoff receive` receiver accepts `token.override`
payloads only for net-new paths. Overrides of existing paths are
rejected with "hand-edit `semantic.cue`". Closing this gap requires
a writer that regenerates `semantic.cue` / `primitives.cue` from
IR (the component-side writer in `internal/cuewriter/` is the
pattern). Scoped out of v1 to ship the 95% use case first.

### Provider-wired contract retrofits

Not every existing provider under `pk-core/` and
the frontend kit's `` wires its interface contract suite.
Retrofitting happens opportunistically — no CI gate forces the
migration. The 26 interfaces indexed in
[ADR 0021](../adr/0021-interface-contract-test-suites.md) are the
inventory; about half are fully wired, the rest are in flight.

### Hand-refinement of auto-generated PKDS components

The 106 CUE component files under
the design system's `pkds/src/contracts/` were generated by
a one-time migration utility from the previous Storybook extraction
output. The migrator applied every mechanical audit fix (enum
dedup, icon enum typing, variant/tone split, default-false booleans,
deprecated-name rename, atom-overload reclassification). Three
components warrant hand-refinement pass:

- **Input** (currently reclassified to molecule via R005). A
  proper decomposition is `Input` atom (bare primitive) +
  `FormField` molecule (label, help text, error state, prefix,
  suffix slots).
- **Alert** (currently reclassified to molecule). Split into
  `Alert` atom (bare surface) + `AlertBanner` molecule (icon +
  title + body + dismiss).
- **SignatureModal / SignatureApproval / SignatureVerifier.**
  Collapse into a compound `Signature.*` API (Radix-style).

These refinements are not blocking — the current shape is correct
and passes lint — they're improvements to the public API shape.

### Observability blind spots

- **Outbox operational dashboards** — `outbox.pending`,
  `outbox.failed`, `outbox.next_attempt_at` distributions need
  Grafana panels and alert rules. ADR 0007 called this out; the
  metrics exist, the dashboards don't yet.
- **Dual-path asymmetry map** —
  `.claude/generated/module-sets.md` carries the current
  HTTP/EventBus asymmetry inventory from `check-dual-path-flows`,
  but there's no alert on it. A module that loses a NATS binding
  fails CI, but a module that ships with one missing to begin
  with shows up only in the inventory.

## Third-party dependency risks

- **fx (Uber).** The composition model depends on fx staying
  maintained. Uber has deprecated internal tooling in the past;
  fx's status is healthy at 2026-04 but the platform would need
  a contingency if upstream declined. Migration target would be
  Wire or a hand-rolled DI primitive; both are inferior but
  feasible.
- **Huma.** HTTP framework + OpenAPI generation. Active project;
  no immediate concern but a single-framework dependency is
  worth naming.
- **CUE.** PKDS depends on the CUE language and its Go runtime
  (`cuelang.org/go`). CUE is backed by Google and used by Istio
  and Dagger, but its v1 release is still pending. Worst case:
  freeze the CUE version and migrate to a JSON-Schema-based IR.
  The IR itself is already JSON, so migration would be mostly
  the authoring layer.
- **NATS (microservices topology).** The microservices topology's
  cross-module RPC rides NATS. NATS is battle-tested; the risk
  is operational (cluster ops, subject-naming drift) more than
  vendor.

## Compliance + legal risks

- **GDPR-style deletion cascades.** The retention system handles
  time-window deletion; ad-hoc "delete this specific user's data
  right now" requests require per-module cooperation. A single
  "right-to-be-forgotten" endpoint that coordinates cascade across
  modules is tracked but not implemented.
- **Audit trail signature provenance.** `audit-digital-signature`
  signs with a tenant-scoped key. The key rotation and escrow
  story is documented but not yet tooled for unattended
  compliance rotations.
- **Cross-jurisdiction data residency.** The per-tenant DB escape
  hatch supports this, but the default shared-DB topology doesn't
  have per-tenant residency controls.

## How to use this page

- **Before a release**, scan the "Enforcement gaps" table for any
  High-severity gap that has drifted in the release window.
- **Before an audit**, walk the "Compliance + legal risks" and
  confirm the tenant's exposure surface.
- **During architecture review**, ask whether any new decision
  introduces a new row here. Every row is honest about what
  we're trading off; a new decision should either close a row or
  explicitly accept a new one.
