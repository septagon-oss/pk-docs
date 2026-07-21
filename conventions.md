---
title: "PlatformKit Conventions"
slug: conventions
type: doc
tags: [conventions, house-rules, discipline]
---

# PlatformKit Conventions

This is the house-rules page. Every clause here is a rule that
follows mechanically from an architectural decision recorded in
`adr/` — no meaningful alternative, just the right way to hold the
line. Edit this file to change a convention; edit the motivating
ADR if the underlying decision needs to change.

> **Why this file exists.** An ADR describes a fork in the road. A
> convention describes the rule of the road you took. Rules of the
> road that have no alternatives don't belong in the ADR index —
> they belong in a conventions doc that maps 1:1 to the analyzers
> that enforce them.

## Index

- [C-01 Migrations are append-only](#c-01-migrations-are-append-only)
- [C-02 One module, one instance](#c-02-one-module-one-instance)
- [C-03 Features own their routes](#c-03-features-own-their-routes)
- [C-04 Public contracts live away from their implementation](#c-04-public-contracts-live-away-from-their-implementation)
- [C-05 Server binaries don't ship browsers or Docker](#c-05-server-binaries-dont-ship-browsers-or-docker)
- [C-06 Test coverage scales with tier](#c-06-test-coverage-scales-with-tier)
- [C-07 Admin UI consumes design tokens, never raw colors](#c-07-admin-ui-consumes-design-tokens-never-raw-colors)
- [C-08 Workspace guards emit a single output format](#c-08-workspace-guards-emit-a-single-output-format)
- [C-09 Runtime startup is explicit and one-way](#c-09-runtime-startup-is-explicit-and-one-way)
- [C-10 Shared builders return errors, not panics](#c-10-shared-builders-return-errors-not-panics)
- [C-17 Reusable application secrets use versioned AEAD envelopes](#c-17-reusable-application-secrets-use-versioned-aead-envelopes)
- [C-18 Federated login binds stable provider subjects](#c-18-federated-login-binds-stable-provider-subjects)
- [C-19 Refresh bearers have one durable current authority](#c-19-refresh-bearers-have-one-durable-current-authority)
- [C-20 Interactive browser authentication uses one-time bound proofs](#c-20-interactive-browser-authentication-uses-one-time-bound-proofs)
- [C-21 Email-verification bearers are hash-only and owner-guarded](#c-21-email-verification-bearers-are-hash-only-and-owner-guarded)
- [C-22 One-time public authentication bearers use hash-only scoped ledgers](#c-22-one-time-public-authentication-bearers-use-hash-only-scoped-ledgers)
- [C-23 Live A2UI delivery has one app-owned signed boundary](#c-23-live-a2ui-delivery-has-one-app-owned-signed-boundary)
- [C-24 Warm latency claims require segmented exact-candidate evidence](#c-24-warm-latency-claims-require-segmented-exact-candidate-evidence)
- [C-14 Every Go file declares its purpose](#c-14-every-go-file-declares-its-purpose)

---

## C-01 Migrations are append-only

Once a migration file has been committed under
`<module>/migrations/NNNN_description.{up,down}.sql`, its content
is frozen. Corrections happen by adding a new migration with a
higher sequence number — never by editing the old one.

The pattern for correcting a prior migration's mistake:

1. Add `NNNN+k_describe_the_correction.up.sql` that `ALTER`s /
   `UPDATE`s / backfills as needed.
2. Document in the new migration's comment block which prior
   version it corrects and why.
3. Leave the prior migration untouched.

**Why we do it this way.** The migration runner records versions,
not checksums. Editing a committed migration after it has been
applied in any environment — local dev, staging, production —
silently diverges that environment's schema from every other
environment's. The discipline is unconditional: it holds even for
migrations no environment has applied yet, because dev and staging
checkouts can diverge the moment one of them re-runs an edited
version. Discipline beats correctness-by-accident.

**When you're writing a migration.** Never edit a migration file in
place. Always add a new one. The scaffolder (`platformkit scaffold`
CLI) emits the next `NNNN+1_*.sql` automatically, so scaffolded
work doesn't collide with itself.

**How it's enforced.**

- The module workspace's `check-migrations-append-only` gate compares the
  branch against its merge base and rejects modified, deleted, or renamed
  migration files as part of pre-merge verification.
- Workspace write guards and the tracked pre-commit guard reject the same
  operations before CI; in the public repos the rule is enforced in review
  and by per-repo CI checks.
- `platformkit scaffold` emits fresh sequence numbers so the normal authoring
  path starts compliant.

**Motivating ADRs.** Data-durability hygiene. Related:
[ADR 0005 — no silent failures](./adr/0005-error-handling-discipline.md),
[ADR 0007 — events go through the outbox](./adr/0007-transactional-outbox-for-event-delivery.md)
(whose authoring surfaced the hazard this convention prevents).

---

## C-02 One module, one instance

Every business module uses `module.NewSingleton(createFn)` to
memoise its instance:

```go
var moduleInstance = module.NewSingleton(createModuleWithFeatures)

func NewModule() module.Module { return moduleInstance.GetAndRegister() }
func GetModule() module.Module { return moduleInstance.Get() }
```

`NewModule()` is called exactly once per app — in the catalog.
Every other reference (introspection, admin registration, test
scaffolding) goes through `GetModule()`.

**Why we do it this way.** A module instance isn't just a bag of
services. It carries fx option aggregation, admin-registry
registrations, migration embed state, and MCP metadata that has to
stay consistent across the app. Two "instances of the same module"
would race to register the same admin section and produce two
parallel fx graphs fighting each other at boot. The fix is a plain
`sync.Once` with registration bookkeeping; `module.NewSingleton`
wraps that so every module uses the same pattern.

**When you're editing a module.** The scaffolder emits the
singleton boilerplate; new modules inherit it automatically. When
introspecting an existing module from a test or a tool, always use
`GetModule()` — never call `NewModule()` twice, even if it looks
innocent.

**How it's enforced.**

- The module workspace's `check-structure` gate (invoked via
  `platformkit verify module structure`, wired as
  `make check-structure`) verifies every module declares
  top-level `NewModule`, `GetModule`, and `GetFeatures` in
  `module.go`.
- The `singletonpattern` pkvet analyzer inspects business-module roots and
  rejects module types that lack a package-level `*module.Singleton[T]`.
- Scaffolder seed — `platformkit scaffold module` emits the
  singleton shape.
- Runtime registration is idempotent for the same singleton instance;
  `TryGetAndRegister` returns an error for a different instance with the same
  module name and `GetAndRegister` surfaces that contract violation as a
  panic. The registry therefore does not silently accept parallel module
  instances.

**Motivating ADR.**
[ADR 0017 — Fx is the composition model](./adr/0017-fx-dependency-injection-as-composition.md).

---

## C-03 Features own their routes

Route registration inside a module uses the `FeatureBuilder` +
`RouteHandler[H]` helper pair from the module kit's `helpers`
package in `pk-core`, scoped to the feature package that owns the
handler:

```go
// <module>/features/<feature>/feature.go
func NewFeature() module.Feature {
    b := helpers.NewFeatureBuilder("content_management", module.FeatureMetadata{...})
    helpers.RouteHandler[*Handler](b, NewHandler)
    b.Service("ArticleService", "1.0.0", ...).
        Endpoints(
            module.EndpointDefinition{Method: "POST", Path: "/api/v1/content/articles", Description: "Create"},
            module.EndpointDefinition{Method: "GET",  Path: "/api/v1/content/articles", Description: "List"},
        )
    return b.Build()
}

// <module>/features/<feature>/handler.go
func (h *Handler) RegisterRoutes(api huma.API) {
    huma.Register(api, huma.Operation{...}, h.CreateArticle)
    huma.Register(api, huma.Operation{...}, h.ListArticles)
}
```

Two discipline rules follow:

1. **The module root doesn't register routes.** `module.go`,
   `admin.go`, `invocations.go`, and `providers.go` never call
   `huma.Register`, `routing.Register`, or `router.*` directly.
2. **The feature's declared `EndpointDefinition` list matches the
   handler's `RegisterRoutes` body.** The list is metadata
   (surfaced to tooling and docs); the `RegisterRoutes` body is
   the actual binding. Drift between the two is a
   feature-authoring bug.

**Why we do it this way.** A feature's contribution has to be
legible by reading its own package — `feature.go` for metadata and
declaration, `handler.go` for registration and behaviour. Routes
that live at the module root decouple handlers from the feature
that owns them; moving a feature between modules becomes a
multi-file edit. With the convention, moving a feature between
modules is a directory copy that carries its routes with it.

**When you're adding a feature.** Use the scaffolder
(`platformkit scaffold feature`) — it emits the `FeatureBuilder` +
`RouteHandler[H]` shape correctly. `feature.go` is the single source of truth
for `EndpointDefinition` metadata; route binding remains in the feature-owned
handler where Huma registration is required. Do not duplicate endpoint lists
in `routes.go`, `handler.go`, contracts, or the module root.

**How it's enforced.**

- The `featureroute` pkvet analyzer rejects route-registration calls outside
  feature packages and rejects `EndpointDefinition` values or helper lists
  outside `<module>/features/<feature>/feature.go`. Its dated allowlist is
  wired by business-modules `check-pkvet`.
- `check-feature-activation` verifies every feature directory is referenced
  from module-root assembly.
- Scaffolder templates emit the feature-owned shape.
- Gap — Huma operation bodies and endpoint metadata are different artifacts;
  no analyzer performs a full call-graph equivalence proof between them.

**Motivating ADRs.**
[ADR 0009 — modules only talk through ports](./adr/0009-ports-only-cross-module-communication.md),
[ADR 0017 — Fx is the composition model](./adr/0017-fx-dependency-injection-as-composition.md).

---

## C-04 Public contracts live away from their implementation

Every module exposes its public surface via two packages:

- `<module>/contracts/provides/` — interface types other modules
  are allowed to import. Contains only interface declarations,
  type aliases, and value-only types. Has no imports of the
  module's implementation.
- `<module>/contracts/` — module-level constants (`ModuleName`,
  `ModuleDescription`, `ModuleVersion`, `ModuleBasePath`)
  re-exported from one source so metadata stays consistent.

Implementation code lives outside `contracts/`. Cross-module boundaries
either import an owner module's public contract or use neutral,
boundary-owned DTOs. The user boundary follows the latter model:
`ports.UserBoundaryReader` returns `porttypes.UserDTO` and never aliases
`user_management` persistence entities.

**Why we do it this way.** ADR 0009 requires cross-module calls to
go through interfaces. *Where* those interfaces live determines
whether consumers have to import implementation code to use them.
If `user_management.UserService` sits next to the struct that
implements it, any consumer importing the interface transitively
pulls in the whole module — which defeats the boundary.

Splitting the public surface into a contract package that compiles
independently of the implementation is what makes ADR 0009's
boundary actually hold.

**When you're adding a cross-module capability.** Create the
interface in `contracts/provides/`, implement it in the module's
regular package tree, and add an adapter if the signatures
diverge. The three-location overhead is the price of the
boundary.

**How it's enforced.**

- `check-structure` — requires every module to have a
  `contracts/provides/` directory and a `contracts/providers.go`
  file. Missing either fails CI.
- The `contractvar` pkvet analyzer (workspace tooling) — flags
  cross-module exported interface variables that live outside
  `contracts/provides/`, enforcing that *contents* match the
  intended shape, not just the directory name.
- The `interopimport` pkvet analyzer (wired through
  `check-pkvet`) — rejects cross-module imports that reach into a
  module's non-contract packages.
- `accesscontract` pkvet analyzer — audits cross-module calls for
  contract presence; rejects bypasses. Exempt edges live in
  `scripts/module_access_allowlist.txt` with a required expiry
  date.
- Not a guard here — `check-module-doc-contract` is scoped to
  Diataxis documentation manifests, not to `contracts/provides/`
  layout.

**Motivating ADR.**
[ADR 0009 — modules only talk through ports](./adr/0009-ports-only-cross-module-communication.md).

---

## C-05 Server binaries don't ship browsers or Docker

`go-rod`, `docker/docker`, and any similar "runs the outside
world" SDK may appear ONLY in:

- `pk-tools/` — the CLI and build tooling.
- `pk-testkit/` — cross-repo integration tests (browser
  E2E).

Any import of these packages from `pk-core`, `pk-modules`,
`pk-apps`, `pk-shared`, the agent runtime, or any other
repo that produces server binaries is a build failure.

Non-test files that need browser-like behaviour (HTML parsing,
cookie jars) use purpose-built libraries: `net/http/cookiejar`,
`golang.org/x/net/html`, `chromedp/cdproto` for WebSocket-level
CDP without the full browser.

**Why we do it this way.** PlatformKit servers run as lean Go
binaries (~45 MB typical) in hosting environments that don't have
Chrome, Docker, or the 200 MB+ of dependencies those tools drag
in. `go-rod` alone adds ~60 MB of headless-chromium descriptors.
The `docker/docker` SDK adds static-init storms at startup and an
unnecessary attack surface (Docker client code + permission
probes) for code that has no legitimate need to inspect its host.

Soft discipline via code review was insufficient — historically a
module accidentally imported `docker/docker` through a deeply
transitive test helper, and the resulting server image was 10×
the expected size before anyone noticed. The transitive case is
exactly what human review can't catch fast enough.

**When you're writing dev tooling.** Put it in
`pk-tools/`. Tests that need browsers or containers
live in `pk-testkit/`, not beside the module they test.
Mild inconvenience; mitigated by the flow harness's per-module
entry points in `pk-testkit`.

**How it's enforced.**

- The `buildtags` pkvet analyzer (workspace tooling) —
  enforces that every test file under `tests/e2e/` or
  `tests/bdd/`, plus any file named `e2e.go`, carries a
  `//go:build e2e` constraint. This is the *necessary* condition
  for go-rod / chromedp to be excluded from default server
  builds. It does *not* by itself ban the imports in non-test
  files; that's the next guard.
- `repo-split-importcheck` (workspace tooling) —
  parameterised tool that rejects imports matching a
  caller-supplied `--forbid-prefix` inside caller-supplied
  `--roots`. Server-producing repos wire it with
  `--forbid-prefix=github.com/go-rod` and
  `--forbid-prefix=github.com/docker/docker` in CI.
- Repo-split topology — `pk-tools` and
  `pk-testkit` are separate Go modules. Server repos
  don't list them as dependencies; `go mod tidy` in a server repo
  rejects an accidental cross-repo import at resolve time. The
  coarsest but strongest line of defence.
- Not a guard here — `runtime-boundary-check` enforces an
  *internal* tier-layering policy inside
  `pk-core`; it doesn't scan for go-rod / Docker
  imports.
- Gap — no single CI target prints the guard wiring for each
  server repo. Each repo's `make precommit` wires its own
  `repo-split-importcheck` arguments; cross-repo drift wouldn't
  be noticed until it fired.

**Motivating ADRs.** Repo-level boundary hygiene. Related:
[ADR 0009 — modules only talk through ports](./adr/0009-ports-only-cross-module-communication.md)
(module-level boundaries).

---

## C-06 Test coverage scales with tier

The intent is joined from three typed authorities and their audits:

- `catalog/modulecontracts/authored_catalog.go` declares each module's tier
  and archetype;
- `catalog/modulequality/authored_policy.go` declares the tier- and
  archetype-aware maturity floors;
- `check-module-maturity` and `check-module-assurance-evidence` compare those
  claims with live repository evidence.

These authorities and targets describe the full PlatformKit
module distribution. The public
`github.com/septagon-oss/pk-modules/pkg` reference pack has no parallel tier
catalog; its packages keep their tests beside the implementation and are
verified by that repository's own `make verify`.

- **core-certified** — ≥1 test file per feature, integration
  tests for every exposed port method, BDD tests for public
  scenarios, meaningful line coverage across feature code.
- **supported** — ≥1 test file per feature, coverage for every
  happy-path per feature.
- **experimental** — at least a module smoke test; the `Notes`
  field in the contract must acknowledge the posture.

Test files are colocated with code (`*_test.go` beside the
package). E2E suites use `//go:build e2e` so the default
`go test` stays fast. Integration tests use
`//go:build integration` and require a local DB + Redis.

**Why we do it this way.** ADR 0015 establishes tier labels; this
convention records the testing half of their contract. A module
claiming `supported` with zero tests is lying about its
production posture. Tier granularity is the whole point of the
system — a single global floor would either force experimental
modules to meet the bar (slowing iteration) or permit the lie.

**When you're claiming a tier.** The claim isn't aspirational.
If you change a module's `Tier` to `TierSupported` in
`authored_catalog.go`, it needs the supported evidence before CI will let the
catalog edit through. Demote the claim or add the tests.

**How it's enforced.**

- `check-tests-floor` — a module-workspace make target backed by
  `platformkit verify module test-floor`.
  Current enforcement is a flat floor: every module must ship ≥1
  `*_test.go` file. Exceptions live in
  `scripts/test_floor_allowlist.txt` with an `owner=` and
  `until=YYYY-MM-DD` field. Tier-specific line-coverage
  thresholds are NOT enforced by this script today.
- `check-module-maturity`
  (`scripts/check_module_maturity.sh`) — runs
  `cmd/module-maturity-check`, which loads
  `modulecontracts.Authored()` and `modulequality.AuthoredPolicy()`. Archetype
  comes from the typed `ModuleContract`; policy comes from
  `modulequality/authored_policy.go`. It joins those values with live
  manifest, feature, route, permission, integration, and test-file evidence
  and blocks a tier claim when the measured surface is too thin.
- `check-module-assurance-evidence`
  (`scripts/generate_module_assurance_evidence.sh --check`) — reads
  `AuthoredCatalog` and `AuthoredModuleSets`, validates the
  `assurance-core` selector/membership relationship, and verifies that the
  generated evidence report and its hashed inputs match the authored state.
- `test-with-coverage` + `check-tier-coverage` — generate a Go coverage
  profile and enforce the checked-in per-module no-regression ratchet.
  `check-tier-coverage-strict` applies the stated 70% core-certified / 50%
  supported thresholds; experimental remains reported with no minimum.
- Build-tag discipline — the `buildtags` pkvet analyzer keeps
  E2E opt-in by forcing `//go:build e2e` on `tests/e2e/` and
  `tests/bdd/` files (see
  [C-05](#c-05-server-binaries-dont-ship-browsers-or-docker)).
- Gap — the tier-aware coverage command is not part of the default
  `verify-modules` chain. Both coverage make targets skip when
  `coverage.out` is absent, and the strict 70% / 50% thresholds are opt-in;
  callers must run `test-with-coverage` (ratchet) or generate the profile and
  invoke `check-tier-coverage-strict` explicitly.
- Gap — no per-feature test-file requirement. A core-certified
  module with one module-level test file and zero per-feature
  tests passes `check-tests-floor` today.

**Motivating ADR.**
[ADR 0015 — every module declares one of three tiers](./adr/0015-module-tiering.md).

---

## C-07 Admin UI consumes design tokens, never raw colors

Business-module admin UI must express color through semantic token
classes (`bg-surface-*`, `text-fg-*`, `border-border-*`,
`ring-ring-*`) or through CSS variables that resolve to those
tokens. Raw hex literals, Tailwind palette utilities, Tailwind
arbitrary color utilities, and inline literal color styles do not
belong in admin rendering code.

**Why we do it this way.** ADR 0003 moved visual fallback logic into
token-aware style resolution, and ADR 0004 made the typed token DSL
the source of Tailwind utility strings. Admin UI that bypasses those
layers cannot be themed reliably, cannot inherit tenant overlays, and
silently forks PlatformKit's visual language.

**When you're authoring a UI file.** Use semantic classes for
surface, foreground, border, and focus-ring colors. If a context
cannot consume CSS variables safely, put the fallback in a named
constant with an attached palette-shade comment such as
`// brand-600`. For graceful-degradation maps, pair `Token:` CSS
variable references with `Fallback:` hex values rather than scattering
raw colors through render code.

**How it's enforced.**

- `pk-modules/scripts/ui_guard -mode=tokens` flags
  raw hex literals, Tailwind palette color utilities, Tailwind
  arbitrary color utilities, and inline `Attr("style", ...)` literal
  color declarations in UI files.
- Temporary exceptions live in
  `pk-modules/scripts/ui_token_allowlist.txt` with
  owner, expiry, and reason metadata. Stale paths fail the guard.
- The guard permits the ADR 0003 fallback-constant exemption and the
  Token/Fallback graceful-degradation pattern, but those exemptions
  are intentionally narrow.
- The guard emits findings per the workspace guard output contract;
  see [C-08](#c-08-workspace-guards-emit-a-single-output-format).

**Motivating ADRs.**
[ADR 0003 — every component resolves its styles through style.go](./adr/0003-component-token-extractor-pattern.md),
[ADR 0004 — every Tailwind class goes through a typed DSL](./adr/0004-typed-design-token-dsl.md).

---

## C-08 Workspace guards emit a single output format

Every PlatformKit guard emits findings in a single, interoperable
shape so editor quickfix lists, GitHub Code Scanning, and ad-hoc
`grep` pipelines can consume the same stream. New guards must use
`pk-shared/lintreport` as the canonical implementation
rather than formatting their own output.

**Why we do it this way.** Static-analysis output is public
infrastructure. Editors need file, line, and column; GitHub Actions
needs workflow commands; Code Scanning needs SARIF; local automation
often wants JSON-Lines. When every guard emits the same `Violation`
shape through one shared renderer, downstream tools can route,
deduplicate, and archive findings without tool-specific parsers.

**When you're authoring a new guard.** Model every finding as
`lintreport.Violation` and render through `lintreport.Print`. Support
`-format=default|github|json|sarif`; `default` is the GCC-style line
format, `github` is GitHub Actions annotations, `json` is
JSON-Lines, and `sarif` is SARIF 2.1.0 for Code Scanning. Implement
`-list-rules` through `lintreport.PrintCatalog`, and register every
rule in `lintreport.Tool.Rules`.

```
content_management/portal_handler.go:461:58: error: [design-tokens/tailwind-palette-color] raw Tailwind palette utility "border-red-300"; use border-border-* (ref: C-07)
```

Use the package's typed enums for shared severity, category, and
format names (`Severity`, `Category`, `Format`) instead of raw
strings at call sites. A rule's name is stable public API: keep it
kebab-case and deprecate rather than rename once CI consumers depend
on it.

**How it's enforced.**

- `pk-shared/lintreport` owns the standard renderers:
  `default` (GCC-style), `github` (Actions), `json` (JSON-Lines),
  and `sarif` (Code Scanning).
- `lintreport.Tool.Rules` is the rule catalog used by `--list-rules`
  and SARIF `tool.driver.rules`; every new guard must populate it.
- Existing workspace guards are migrated one at a time. Guards that
  still hand-roll formatters are temporary exceptions, not new
  precedent.

**Standard labels.**

- *severity* — `error` (currently the only level; `warning` reserved).
- *category* — `design-tokens`, `interactions`, `module-boundary`,
  `guard-internal`. New categories must be added next to the rule
  that needs them, not invented per finding.
- *rule* — kebab-case, stable across releases. Rule names are part of
  the public CI contract; rename via deprecation.
- *ref* — convention or ADR identifier (`C-07`, `ADR-0001`,
  `ADR-0009`). Empty when the rule is purely internal hygiene
  (`stale-allowlist-path`, `read-failure`).

**Motivating ADRs.** Cross-cutting tooling hygiene; no single ADR owns
this convention. It exists so ADR-backed guards can report findings
through the same workspace contract.

---

## C-09 Runtime startup is explicit and one-way

Runtime entrypoints should keep shutdown and process semantics in `main`
and move construction + orchestration into functions that return `error`.
A canonical runtime shell looks like:

```go
func main() {
    if err := run(); err != nil {
        fmt.Fprintf(os.Stderr, "startup failed: %v\n", err)
        os.Exit(1)
    }
}

func run() error {
    // assemble dependencies
    // start server/workers
    // return errors instead of calling os.Exit/log.Fatal/Fatal logger
}
```

This convention applies to:

- application and service binaries,
- example servers,
- and command-line tools with a `run`/`execute` entrypoint.

**Why we do it this way.** `main` is the single edge where process
termination occurs. Helper functions can be tested and reused; `main`
remains thin, deterministic, and predictable.

**When you touch a startup path.** Return startup and serve errors from
that helper. Treat `http.ErrServerClosed` as non-fatal. Surface non-fatal
runtime failures to logs/observers and return them from `run`.

**How it’s enforced.**

- New code review expectation for runtime and example packages.
- `main.go` ownership in CI reviews: binaries should have one top-level
  failure boundary and no process-termination helper calls (`os.Exit`,
  `log.Fatal`) below it.
- Gap — no static analyzer enforces this repo-wide yet. The follow-up is
  to add one `runtime-startup-boundary` check in
  `pk-core` for `go vet`-style static enforcement.

---

## C-10 Shared builders return errors, not panics

Factory/helper functions that validate configuration, serialize state,
or derive generated outputs should return `(T, error)` when a recoverable
error is possible. Only true programming errors (bad type arguments,
contract violations that indicate impossible call sites) should panic.

Prefer:

```go
func BuildProject(cfg ComposeConfig) (ProjectResult, error)
```

over:

```go
func BuildProject(cfg ComposeConfig) ProjectResult // and panic inside
```

**Why we do it this way.** Panics in shared helpers escape into callers
that may already be prepared to report structured failures. Returning an
error gives the caller control over logging, wrapping, and user-facing
surface.

**When adding a builder-style helper.** Define the result type and error
return first, then bubble failures to the closest orchestration point.

**How it’s enforced.**

- `pkvet` analyzers should flag helper functions that call `panic` on
  ordinary operational errors and suggest an error return.
- Review gate for core generators and CLI tools: avoid panic-on-formatting
  failures in common-path helper functions.

**Current examples.** `pk-core`'s scaffold composer (`core/scaffold/compose.go`)
now returns errors for `BuildProject` and `GenerateProjectManifest`.

---

## C-17 Reusable application secrets use versioned AEAD envelopes

A secret the application must recover later is encrypted at the persistence
adapter with a versioned authenticated-encryption envelope. Plaintext may exist
only for the bounded in-memory operation that needs it. It must not enter an
entity projection, durable event, log, metric label, job payload, or API response
other than the intentional one-time enrollment response.

Every envelope records a schema version that unambiguously selects its
algorithm, a non-secret key identifier, fresh cryptographic nonce, and
ciphertext with its authentication tag. The AEAD associated data includes a
stable PlatformKit domain plus the owning identity, tenant, or aggregate
identifier. A ciphertext copied to another owner must fail to open even when
both rows use the same key.

**Key discipline.** Every non-development environment requires a dedicated,
explicitly configured 256-bit active key. It may not silently derive one from
JWT, database, or other cross-protocol credentials. Development may use a
documented domain-separated derivation so local bootstrap stays self-contained.
Readers may accept a bounded previous-key ring for rotation; writers always use
the active key. Unknown, duplicate, weak, or malformed keys fail startup.

**Rotation and historical data.** Deploy key-capable readers before changing the
active writer key. Keep the old key as previous, rewrap every old-key envelope,
verify the remaining count is zero, then remove it. Plaintext compatibility is
an explicit migration mode, never format guessing: production either rewrites
through an audited optimistic update or rejects/clears the plaintext state and
requires re-enrollment. A rollback must not reintroduce plaintext writers.

**Choose hashing when recovery is unnecessary.** Passwords, backup codes,
bearer tokens, and API keys remain one-way hashes with the appropriate salt or
pepper. Encrypting them would create an avoidable decryption capability.

**How it's enforced.**

- Production constructors for reusable-secret stores require a protected-store
  capability and reject plaintext-only adapters.
- Unit and integration tests cover randomized sealing, plaintext opacity,
  tamper and wrong-owner rejection, active/previous key behavior, production
  configuration failure, and append-only migration integrity.
- Code review rejects raw secret assignment into persistent entities or durable
  payloads. Gap — a workspace analyzer for classified reusable-secret fields is
  still to be added after the shared `internal/secretbox` extraction.

**Motivating ADR.**
[ADR 0065 — reusable application secrets use versioned authenticated-encryption envelopes](./adr/0065-reusable-application-secrets-use-versioned-aead-envelopes.md).

---

## C-18 Federated login binds stable provider subjects

OIDC and SAML callbacks identify a principal by an immutable durable tuple:
tenant, normalized protocol, stable tenant-owned connection key, verified
issuer or SAML entity ID, and signed stable subject. Email, username, display
name, group claims, and other mutable attributes are never repeat-login keys.
SAML transient NameIDs are not linkable identities.

**First link.** A canonical provider-verified email is used only for global
collision detection. The adapter serializes the exact subject and canonical
email, then creates an identity with no roles, permissions, or tenant
membership only when no account owns the address. If an account already owns
it, the callback fails with a link-required conflict. A separately
authenticated proof-of-possession flow or explicit audited administrator
operation must create that binding. Identity creation and binding commit in
one atomic transaction.

**Repeat login.** Resolve the binding before reading email and return its exact
platform identity. Provider claims do not rewrite the platform profile or
account status. If the provider runtime supplies a platform identity ID and
the business boundary cannot reload that exact active identity, authentication
fails; it does not fall back to an email lookup.

**Uniqueness and change.** One exact subject tuple maps to one platform user,
and one user has at most one subject for a tenant/provider/connection. Issuer,
entity-ID, connection-key, and subject changes require an explicit audited
migration or relink. Provider constructors reject directories that cannot
atomically persist and resolve these bindings.

**How it's enforced.**

- The provider-neutral `FederatedDirectory` contract requires exact-subject
  resolution and atomic first link.
- Append-only auth migrations enforce exact-key and per-user/connection
  uniqueness; the production adapter uses subject and global-email locks.
- OIDC/SAML and business tests cover mutable-email repeat login,
  existing-account collision, concurrent first links, conflicting bindings, and
  authoritative-ID failure without email fallback.

**Motivating ADR.**
[ADR 0066 — federated identities bind verified issuer and subject, not mutable claims](./adr/0066-federated-identities-bind-verified-issuer-and-subject.md).

---

## C-19 Refresh bearers have one durable current authority

Every remembered session has one durable refresh-token family and exactly one
currently redeemable generation. Persistence stores a one-way 32-byte digest,
never the raw bearer. Redemption locks the family, verifies its exact
user/tenant/session/generation binding, and replaces the digest and generation
with one atomic compare-and-swap inside the same transaction as session
activity, audit intent, and event publication.

Rotation is mandatory. A missing, expired, revoked, mismatched, or stale family
fails closed. A stale generation or digest revokes the family and session as
suspected reuse. A cache lookup, get-then-set sequence, process mutex, or JWT
signature alone is not redemption authority. Storage uncertainty never emits a
credential.

Logout durably revokes the session and family. Cache blacklist entries are
defence in depth only. Every PlatformKit token explicitly marked `type=access`
is checked against its exact active durable session and active user on each
request, so a cache outage or eviction cannot resurrect it. Typeless
development-preview and separately governed external credentials are outside
this session-family contract.

Pre-migration raw refresh-token columns are removed through an append-only,
security-irreversible migration. The migration invalidates existing bearers
instead of copying them; rollback must not restore recoverable bearer storage.

**How it's enforced.**

- The family-store contract requires durable transactions, row locking, and
  generation-plus-digest compare-and-swap; production composition fails when
  these capabilities are absent.
- Database constraints require one family per session, unique fixed-length
  current digests, positive generations, and complete terminal revocation
  metadata.
- Service, race, and middleware tests cover exactly-one-winner redemption,
  reuse revocation, cache independence, storage failure, logout, and live
  session/user enforcement.

**Motivating ADR.**
[ADR 0067 — refresh tokens use durable single-use families](./adr/0067-refresh-tokens-use-durable-single-use-families.md).

---

## C-20 Interactive browser authentication uses one-time bound proofs

An OIDC or SAML browser login has two independent proofs: provider protocol
material and a cryptographically random 256-bit browser binding. At start, the
service writes one durable flow row containing only SHA-256 digests of the
complete OIDC `state` or SAML `RelayState` and the browser binding, plus the
exact tenant ID, normalized provider, stable connection key, expiry, and
consumption state. Raw protocol material remains confined to the redirect and
callback protocol channel, and the raw binding remains confined to its browser
cookie; neither enters durable rows, entities, admin/CRUD/MCP projections,
logs, metrics, audits, events, or jobs.

OIDC `state` and SAML `RelayState` each use a randomized, purpose-bound
`pkps:v1` AES-256-GCM envelope with a distinct purpose, never a readable signed
claim set. OIDC protects the nonce, PKCE verifier, redirect, bounded
issue/expiry times, tenant, connection subject, configured issuer, and client
audience. SAML protects the required tenant, connection, authentication-request
ID, absolute ACS URL, issue/expiry times, configured issuer, connection subject
and audience, plus an optional return target. Its issue-to-expiry interval is
at most five minutes plus the explicit 30-second clock-skew allowance.

Completion authenticates and decrypts the protocol-specific envelope, then
requires all mandatory fields, bounded time and issuer/subject/audience claims,
the exact connection, and callback tenant/provider/connection authority. SAML
also requires the callback ACS authority to equal the protected absolute ACS
URL, before assertion parsing. Tampered, malformed, wrong-purpose, and
signed-readable JWT continuations fail closed without a compatibility fallback.
This is a deliberate security cutover: a prior readable continuation may be
invalidated in flight for no more than its former five-minute lifetime.

The callback consumes that row with one conditional durable update matching
both digests, every authority field, unexpired state, and `consumed_at IS NULL`.
Consumption occurs before provider completion. Exactly one callback wins; a
mismatch does not burn another flow. A missing or non-durable store, storage
error, absent or ambiguous cookie, expired row, or authority mismatch fails
closed without calling the provider or creating a platform session.

Flow cookies are host-only, `HttpOnly`, scoped to the provider callback path,
and bounded by the durable flow expiry. OIDC uses `SameSite=Lax` and adds
`Secure` over HTTPS. SAML HTTP-POST uses `SameSite=None; Secure`; non-local
deployed SAML login fails when HTTPS cannot be proven. Loopback-only
development may use Lax over HTTP because browsers reject `None` without
`Secure`, but that exception must not be admitted in a deployed environment.
Terminal success or denial clears the flow cookie.

A local-MFA continuation retains the browser-binding digest, flow reference,
tenant/provider/connection tuple, verified platform identity reference, return
target, and bounded expiry. It compares the presented binding in constant time,
revalidates the exact tuple, and is itself single-use. It never calls the
provider again or creates tenant membership, a platform session, audit state,
or auth events before local MFA succeeds. Provider `acr`, `amr`, and similarly
named metadata are not local-MFA evidence.

Provider adapters may hold exchange credentials only in bounded local memory
while verifying the provider response. OIDC ID/access/refresh bearers, raw SAML
assertions, and other upstream session credentials must not appear in the
provider-neutral session result, PlatformKit session fields or metadata,
entities, logs, events, audits, metrics, or jobs. Platform session persistence
uses a fresh platform-owned opaque reference.

A magic-link confirmation uses the corresponding browser gate before token
lookup. A successful, non-mutating GET creates a separate 256-bit nonce in a
host-only, `HttpOnly`, Lax cookie and matching hidden form field. The POST
validates their shape and constant-time equality; when present, `Origin` must
equal the request origin and `Sec-Fetch-Site` must be `same-origin`. The nonce
is retained through a local-MFA form, cleared on success or terminal denial,
and never substitutes for the mailed token's durable single-use authority.
Confirmation responses are non-cacheable, suppress referrers, and deny framing.

Credential-login forms consume the response-authoritative CSRF token from the
middleware request context. A safe first load renders the newly issued cookie
value; after valid mutation the middleware rotates before handler execution and
the error page renders that exact replacement. Default and custom auth-page
renderers must put the supplied value in a hidden `csrf_token` field, so the
login contract remains correct without JavaScript and never reuses a stale
request token.

**How it's enforced.**

- The interactive-flow schema constrains 32-byte digests, exact supported
  providers, non-empty connections, bounded expiry, and one unique state
  digest; the store uses one authority-complete conditional update.
- `interactive_flow_security_test.go` exercises mismatch-without-burning,
  concurrent single consumption, expiry, outage, raw-material opacity, SAML
  RelayState, registration failure, and provider-error consumption.
- `interactive_flow_browser_security_test.go` exercises protocol-specific
  cookie attributes, insecure SAML rejection, cross-browser denial, concurrent
  tabs, cleanup, and MFA browser continuity. Magic-link confirmation tests
  cover nonce pairing, origin/fetch-site rejection, and scanner-safe GET.
- `security/protectedstate/codec_test.go`, OIDC begin/authority tests, SAML
  `TestBeginAuthentication_BuildsRedirectFlowWithProtectedRelayState`, and
  `TestValidateSAMLRelayStateAuthorityRequiresExactConnectionAndCallbackMetadata`
  exercise opaque randomized state, purpose separation, bounded claim
  validation, tamper and malformed-input rejection, no readable signed
  fallback, and exact callback authority before assertion parsing.
- Provider-adapter tests reject bearer-valued provider-neutral session fields
  and metadata projections; OIDC completion returns a fresh 256-bit reference
  after discarding exchange credentials.
- Core CSRF context tests and auth
  `TestLoginPageCSRFSupportsNoJavaScriptFirstLoadAndRotatedErrorRender` plus
  `TestLoginFlavorReceivesResponseAuthoritativeCSRFToken` pin first-load,
  rotation, no-JavaScript, and custom-renderer behavior.

**Motivating ADR.**
[ADR 0070 — interactive browser authentication uses durable one-time bound proofs](./adr/0070-interactive-browser-authentication-uses-durable-one-time-bound-proofs.md).

---

## C-21 Email-verification bearers are hash-only and owner-guarded

An email-verification token is account-activation authority. Generate 32
random bytes, expose the hexadecimal bearer only to the in-memory delivery
link and browser confirmation exchange, and persist only its SHA-256 digest.
Raw tokens and URLs do not belong in database columns, notification rows,
template data, retry jobs, entities, admin/CRUD/MCP projections, logs, metrics,
audits, or events.

Issuance deletes the prior pending record and creates its replacement in one
transaction. A notification carrying the link is marked sensitive and uses a
tracking identity unique to that exact credential. Pre-cutover plaintext
authority is invalidated rather than copied into the digest model, and the
security-irreversible migration never recreates a raw-token column.

The emailed GET is read-only. It may validate token shape and render a form,
but only a CSRF-protected POST consumes the credential. The form uses the
response-authoritative middleware token and works without JavaScript. The page
is non-cacheable, uses `Referrer-Policy: no-referrer`, denies framing, and
removes the bearer from URLs and terminal output after submission. Custom auth
flavors preserve the host-supplied token, CSRF token, exact form action, and
confirmation state; none of those fields becomes independent authority.

Consumption is one tenant-scoped conditional update over digest, expiry, and
unconsumed state. User activation occurs inside the same transaction through a
narrow owner-provided compare-and-swap requiring the exact tenant, user,
canonical email, pending status, unverified state, and non-deleted row. Do not
replace this with a cacheable read plus a generic update. A suspended,
inactive, deleted, changed-email, active, or previously verified account fails
closed, and the verification consume rolls back.

The successful audit and canonical typed `user.email.verified` event share the
same transaction. Runtime publication, feature metadata, and generated catalog
use the typed contract's name, version, and payload schema; underscore and dot
variants are not aliases.

Public resend applies an atomic cooldown before account lookup. The key is a
tuple of the exact tenant and the SHA-256 digest of the canonical email, never
the raw address. A wired shared cache must implement atomic set-if-absent;
outage or unsupported capability prevents mutation. A process-local locked
fallback is acceptable only when no cache is wired and must be documented as
single-replica. Limited, unknown, verified, eligible, and failed requests keep
one opaque public response, and a suppressed request performs no lookup,
rotation, or delivery.

**When you're editing email verification.**

- Treat any new field containing the raw token, URL, body, or template data as
  a credential leak until proved otherwise.
- Keep registration as verification-record owner and user management as user-
  lifecycle owner; cross the boundary only through the narrow activation port.
- Add predicates to the owner's compare-and-swap when eligibility tightens;
  never pre-read and assume the row remains eligible.
- Keep GET safe and POST explicit. Do not add a compatibility route that
  mutates on link open.
- Apply abuse control before all account-state branches and preserve identical
  public responses.
- Add a new append-only migration for schema changes. Never restore recoverable
  bearer material in a down migration.

**How it's enforced.**

- Migration and schema-boundary tests reject raw-token persistence and retired
  authentication ownership of `email_verifications`.
- Repository and user-owner store tests prove exact tenant/email/status
  predicates, ambient-transaction participation, rollback, expiry, replay, and
  concurrent single-winner behavior.
- Browser tests exercise scanner GET, CSRF failure, no-JavaScript POST, security
  headers, and post-confirmation bearer removal; renderer-contract inspection
  verifies host-supplied custom-flavor payload propagation.
- Notification tests require sensitive inline delivery and credential-unique
  tracking identities.
- Cache-provider and resend tests prove atomic cooldown, concurrency, fail-
  closed shared-cache errors, and zero side effects while suppressed.
- Typed event-contract and catalog tests reject `user.email_verified` drift.

**Motivating ADR.**
[ADR 0071 — email verification uses hash-only proofs and owner-guarded activation](./adr/0071-email-verification-uses-hash-only-proofs-and-owner-guarded-activation.md).

---

## C-22 One-time public authentication bearers use hash-only scoped ledgers

A PlatformKit-issued bearer that crosses a public authentication boundary and
is intended for one-time use has at least 256 bits of cryptographic
unpredictability. Prefer 32 random bytes from a cryptographically secure
source. Resend-coalesced credentials may use a domain-separated HMAC-SHA-256
under a secret of at least 32 bytes and a unique random identifier; never store
the derivation key beside the credential record.

Persist only SHA-256 of the complete presented bearer. Bind that digest to the
exact tenant, purpose, subject or identity, bounded expiry, and consumption
state. Add every authority field the protocol needs. Raw values do not belong
in entities, JSON, admin, CRUD, UI, MCP, notification rows, template data,
retry jobs, audits, events, logs, metrics, or durable errors.

Consume with one conditional durable transition over digest, exact scope,
expiry, and unconsumed state. Never authorize from a read followed by an
unconditional update. Join consumption to the protected durable mutation when
the participating owners share an atomic boundary; otherwise order the consume
before the irreversible side effect and document the fail-safe tradeoff.

An emailed GET is read-only. It may validate shape or peek at pending state,
then renders an explicit POST. Protect the POST with the bearer and with CSRF
or a purpose-specific browser binding whenever ambient browser state or
session swapping matters. Provider callbacks that cannot require a human POST
instead prove exact protocol callback authority, one-time state, and browser
binding before creating a platform session.

Sensitive email delivery is immediate and persists only a redacted,
non-retryable intent. A plaintext cutover invalidates or discards pending
authority, removes the raw column or table, and fails explicitly on downgrade.

**When you're adding or changing a one-time authentication proof.**

- Write down every authority dimension before designing the persistence row.
- Treat the raw credential and every URL containing it as secret material.
- Keep safe GET separate from state-changing POST for emailed browser links.
- Add concurrency, expiry, purpose-confusion, tenant-mismatch, scanner, raw-
  material, and storage-outage tests appropriate to the flow.
- Use a new append-only migration for a cutover and never restore plaintext
  bearer storage in its down migration.

**How it's enforced.**

- Provider-callback, login-link, password-reset, and email-verification tests
  prove their specialized digest, scope, expiry, and single-consume rules.
- Notification tests reject bearer persistence and deferred sensitive delivery.
- Migration tests reject recoverable plaintext downgrades and retired raw-token
  tables or columns.
- Purpose-specific [C-20](#c-20-interactive-browser-authentication-uses-one-time-bound-proofs)
  and [C-21](#c-21-email-verification-bearers-are-hash-only-and-owner-guarded)
  add stricter callback-binding and activation rules.

**Motivating ADR.**
[ADR 0072 — one-time public authentication bearers use hash-only scoped ledgers](./adr/0072-one-time-public-authentication-bearers-use-hash-only-scoped-ledgers.md).

---

## C-23 Live A2UI delivery has one app-owned signed boundary

Every live renderable A2UI document is a complete signed runtime envelope.
Shared code constructs and signs it atomically. Modules return an in-process
complete replacement intent; the composed app validates that intent, binds the
exact request audience and a fresh durable revision, signs it, and clears the
intent before serialization. Do not add a public unsigned constructor,
sign-later helper, patch, raw complete-spec response, or pre-populated action
replacement path.

Keep the root private key offline. Configure the online leaf, root-signed
current/next/revoked keyset, root public key, bounded validity policy, native-app
audience map, and PostgreSQL revision authority explicitly. Never generate or
substitute signing material at startup. Encode uint64 revisions as positive
decimal JSON strings.

Native app identity is distinct from the active client slug. Resolve the
bundle/package ID from the server's native-app profile and permit only declared
client slugs. Bind platform, bundle/package, active tenant, environment, and
response origin into the signature. Request headers select configured policy;
they do not supply values copied into signed authority.

Verify the pinned root, keyset signature/revision/expiry/revocation, leaf
signature, canonical spec and extension hashes, schema, screen, exact audience,
protocol versions, validity window, app bounds, and revision before decoding or
rendering. Advance keyset and per-audience/per-screen/per-canonical-route floors atomically in
durable native secure storage. Live mode has no memory fallback and does not
restore decoded unsigned surface snapshots.

Top-level action extensions may carry non-rendering protocol data only. Any
manifest, navigation, theme, screen, component tree, or renderer-contract
change belongs inside the signed replacement envelope. Reject unknown
top-level action-response fields.

**When you're adding or changing live A2UI delivery.**

- Start from [REQ 019](./requirements/REQ-019-live-a2ui-delivery-is-signed-and-replay-resistant.md)
  and identify the exact app, client, tenant, environment, and origin audience.
- Add the native-app/client allowlist and root/leaf material to explicit
  environment configuration; never add a generated fallback.
- Preserve one app finalizer for home, surface, and action replacement paths.
- Add Go/TypeScript golden, tamper, wrong-audience, expiry, revocation, replay,
  restart, equivocation, storage-failure, and app-version tests.
- Rotate with current/next/revoked keyset state and an app/server overlap
  window. Removing old trust early is a deliberate fail-closed cutover.

**How it's enforced.**

- Shared retirement ratchets reject reintroduction of unsigned constructors,
  sign-later APIs, and patch types.
- App signer/config/route tests prove explicit boot material, exact audience,
  trusted replacement finalization, and public root-signed keyset bootstrap.
- Native golden and transport tests prove verification-before-decode, strict
  action responses, durable replay floors, and process-restart resistance.

**Motivating ADR.**
[ADR 0073 — runtime A2UI surfaces cross an app-owned signed delivery boundary](./adr/0073-runtime-a2ui-surfaces-cross-an-app-owned-signed-delivery-boundary.md).

---

## C-24 Warm latency claims require segmented exact-candidate evidence

Explicitly enroll bounded work in the checked-in release manifest and classify
it as `interactive` or `async_acceptance` before measuring it. Both enrolled
classes use p95 ≤ 50 ms and p99 ≤ 100 ms under the declared warm profile.
Evaluate each normalized route and status independently; never average a
release decision across unrelated routes. HTTP 202 alone is only a wire-level
diagnostic label, not enrollment or durability evidence. Streaming handler
completion and bulk-ingress round trips have no objective under this convention.

An asynchronous acceptance is complete only after validation, authorization,
idempotency handling, and the durable job or outbox commit. HTTP 202 without a
durable boundary is not acceptance. Provider, model, conversion, notification,
and other unbounded work completes outside the request and keeps separate queue,
execution, and provider telemetry. Multipart ingestion, page counting, source
upload, scanning, or other size-bound preprocessing before HTTP 202 is bulk
ingress and stays outside bounded enrollment until redesigned around an early
durable handoff.

The current checked-in release manifest contains no `async_acceptance` route.
In particular, the PDF-import 202 path can ingest up to 1 GiB, count pages,
upload the source, and create a draft before queueing. It is not enrolled and
does not support a current 50 ms/100 ms acceptance claim.

Keep measurement ownership explicit. Platform-owned persistence and messaging
needed for the bounded response stay inside the server percentile. External or
model completion, public-network transit, cold-start intervals, client runtime
scheduling, and device paint do not. Track those as named separate segments;
never use their exclusion to relax platform-owned work or use a server
histogram to claim network or device-paint latency.

Publish local pending state before the first network wait and target observable
feedback within 50 ms. A same-turn ordering or pending-render test is valid
deterministic evidence for the client contract, but it is not a wall-clock
device-paint measurement.

**When you're adding or changing a bounded route or client interaction.**

- Declare the request class, expected status, exact request inputs, and durable
  boundary where applicable. Do not enroll a full bulk-
  upload round trip as bounded merely because it returns HTTP 202.
- Preserve normalized route, method, status, and class labels and the exact
  50 ms/100 ms histogram boundaries.
- Add the route to the checked-in release manifest when it is release-critical;
  use at least 100 measured requests and enough warm-up requests to exercise
  every measured connection.
- Name excluded provider, queue, network, and client-paint segments separately.
- Commit visible pending state before transport and reserve paint-time claims
  for device performance evidence.

**How it's enforced.**

- Backend policy, middleware, OpenTelemetry, and slow-request tests preserve
  the request classes, objectives, dimensions, and exact bucket boundaries.
- The reusable latency gate rejects under-sampled manifests, invalid response
  classes/statuses, per-route percentile failures, redirects, timeouts, and
  unreadable responses.
- The release workflow boots the digest-pinned candidate, validates and retains
  its per-route latency report, and rechecks the evidenced digest immediately
  before promotion. A report from another artifact cannot move release tags.
- Frontend and native tests prove pending state precedes transport and is
  visibly rendered without promoting that ordering proof into a paint claim.

**Motivating ADR.**
[ADR 0074 — warm platform-owned latency is a release-gated percentile contract](./adr/0074-warm-platform-owned-latency-is-a-release-gated-percentile-contract.md).

---

## C-14 Every Go file declares its purpose

Every governed hand-authored `.go` file the workspace owns carries a leading
comment block that names the file's purpose and contains all three structured
traceability roles as exactly three adjacent `//` comment lines in this order:

- `Implements:` or `Validates:` with a registered `REQ-NNN`,
  `REQ-{OWNER}-NNN`, or `PKBM-{MODULE}-REQ-NNN`;
- `Per:` with a registered `ADR-NNNN`; and
- `Discipline:` with registered `C-14`.

The header belongs within the first 100 physical lines measured from the start
of the file. It may appear before or after `package`, but must precede imports
or other declarations. For example:

```go
package tenant_lifecycle

// service_audit.go owns audit-event recording for the tenant
// lifecycle service — extracted so service.go stays focused on
// the entity lifecycle.
//
// Implements: REQ-004 (audit event per mutation).
// Per: ADR-0007 (transactional outbox for event delivery).
// Discipline: C-14 (file purpose declaration).
```

Two rules follow:

1. **All three roles are mandatory; concise purpose prose is expected.** Tests
   use `Validates:` for the requirement role. A stray ID mention, an ADR-only
   comment, a compact one-line triplet, reordered roles, or prose inserted
   between role lines does not satisfy the guard.
2. **Every reference must be real.** The guard validates requirement, ADR, and
   convention IDs against the configured registries. A typo, stale ID, or
   invented owner prefix fails the gate.

**Why we do it this way.** Cohesion choices made today are invisible
to tomorrow's reader unless the file says so. The May 2026 complexity
sweep split nine 1000–2000-line files into 50+ siblings; the cohesion
behind each split lives in the commit messages, but a reader landing
in `gorm_authz.go` six months from now has no in-file signal that
the split was deliberate. Pinning the complete requirement/ADR/C-14 triplet to
every file pulls its authority from the registries into the file itself — and
makes those registries load-bearing rather than archival. Authority nobody
references is a candidate for retirement.

**When you're authoring a file.** Cite the requirement the implementation
satisfies (or the test validates), the ADR that governs the design, and C-14.
If no real requirement or decision fits, stop and resolve the authority gap
rather than inventing an ID. Hand-authored tests, migration embed wrappers,
commands, and generator implementations are governed. Generated-looking
filenames are not exclusions; only Go's canonical pre-package
`// Code generated ... DO NOT EDIT.` marker proves generated provenance.
Adding a non-source directory to the checker's reviewed exclusion
configuration is a deliberate diff; inline suppression is unsupported.

**How it's enforced.**

- `check-file-purpose` (workspace tooling, invoked via
  `make check-file-purpose` at the workspace root and per repo where
  exposed). Walks every `.go` file under configured roots, verifies those
  roots cover every root `go.work` member and every discovered standalone
  owned `go.mod` module, applies explicit exclusions, and fails for
  incomplete roles or unknown IDs. The workspace-root target is canonical.
- The exclusion allowlist is a deliberate inventory, not a wildcard
  list. New entries require a one-line diff that reviewers can
  reject.
- C-14 adoption debt is zero. The checker has no baseline file or
  compatibility path; every regression is corrected at the source
  (see [ADR 0064](./adr/0064-file-purpose-traceability-is-a-blocking-workspace-invariant.md)).
- Gap — a sibling check that inverts the question (every `C-NN`
  and `ADR-NNNN` must have at least one file referencing it) is
  tracked as a follow-up. Conventions with zero references are
  candidates for retirement.

**Motivating ADR.**
[ADR 0029 — every Go file declares its purpose](./adr/0029-every-file-declares-its-purpose.md).

---

## References

- [ADR 0000 — template](./adr/0000-template.md) — the authoring
  shape new ADRs follow.
- The workspace agent guide carries the same invariants codified in
  this document, phrased for AI coding agents.
- `pk-docs/architecture/overview.md` — cross-references
  each convention to the analyzer that enforces it.
