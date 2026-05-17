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

- Review rule — reviewers reject any PR that modifies an
  already-committed migration file.
- Soft guard — `platformkit scaffold` emits fresh sequence numbers.
- Runbook — `pk-docs/sync/README.md` mirrors this
  discipline for doc sync for the same reason.
- Gap — no CI check yet; `check-migrations-append-only` (a
  `git diff --name-only HEAD~<n>..HEAD` guard) is tracked as a
  follow-up.

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

- `check-structure`
  (`platformkit-devtools/internal/modulechecks/structure.go`,
   invoked via `platformkit verify module structure`, wired as
  `make check-structure`) verifies every module declares
  top-level `NewModule`, `GetModule`, and `GetFeatures` in
  `module.go`. It does *not* inspect the body of `NewModule` or
  verify that the backing variable is a
  `*module.Singleton[T]` — a module could satisfy `check-structure`
  with `NewModule` written as a plain factory.
- Scaffolder seed — `platformkit scaffold module` emits the
  singleton shape.
- Gap — no analyzer enforces `module.NewSingleton` usage. A
  follow-up `pkvet` analyzer is tracked.
- Gap — no runtime assertion of single-instance. A duplicate
  `NewModule` call today would succeed at boot with two parallel
  fx option bundles. The convention prevents it; the runtime
  doesn't yet catch violators. Both gaps are explicit, not
  oversights.

**Motivating ADR.**
[ADR 0017 — Fx is the composition model](./adr/0017-fx-dependency-injection-as-composition.md).

---

## C-03 Features own their routes

Route registration inside a module uses the `FeatureBuilder` +
`RouteHandler[H]` helper pair from
`platformkit-backend-kit/app/module/helpers/`, scoped to the
feature package that owns the handler:

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
`RouteHandler[H]` shape correctly. When you add or rename an
endpoint, update both `feature.go`'s `EndpointDefinition` list and
`handler.go`'s `RegisterRoutes` body; drift is currently only
caught in review.

**How it's enforced.**

- Scaffolder seed — `platformkit scaffold module` and
  `platformkit scaffold feature` emit the correct shape.
- `check-feature-activation`
  (`pk-modules/scripts/check_feature_activation.sh`)
  enforces a *related* invariant: every directory under
  `<module>/features/` must be referenced from a module-root Go
  file. It says nothing about where route binding happens inside
  the feature.
- Not a guard here — `check-module-route-registration-audit`
  tracks the separate typed-routing migration
  (normalised/hybrid/manual classification), not route placement.
- Not a guard here — `check-module-capability-matrix` tracks
  per-module summaries, not individual routes.
- Gap — no static analyzer rejects `huma.Register(...)` /
  `routing.Register(...)` / `router.*(...)` calls outside
  `<module>/features/<feature>/` source files.
- Gap — no analyzer cross-checks the declared
  `EndpointDefinition` list against actual `huma.Register` call
  sites.

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

Implementation code lives outside `contracts/`. Cross-module port
declarations in `pk-modules/ports/` reference
contracts, not implementations: `ports.UserService` type-aliases
or re-declares
`user_management/contracts/provides.UserService`.

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
- `contractvar` pkvet analyzer
  (`platformkit-backend-kit/analysis/contractvar`) — flags
  cross-module exported interface variables that live outside
  `contracts/provides/`, enforcing that *contents* match the
  intended shape, not just the directory name.
- `interopimport` pkvet analyzer
  (`platformkit-backend-kit/analysis/interopimport`, wired through
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

- `platformkit-devtools/` — the CLI and build tooling.
- `platformkit-tests/` — cross-repo integration tests (browser
  E2E).

Any import of these packages from `platformkit-backend-kit`,
`pk-modules`, `platformkit-apps`,
`platformkit-agent-runtime`, `platformkit-shared`, or any other
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
`platformkit-devtools/`. Tests that need browsers or containers
live in `platformkit-tests/`, not beside the module they test.
Mild inconvenience; mitigated by the `platformkit-tests/flow/`
harness's per-module entry points.

**How it's enforced.**

- `platformkit-backend-kit/analysis/buildtags` (pkvet analyzer) —
  enforces that every test file under `tests/e2e/` or
  `tests/bdd/`, plus any file named `e2e.go`, carries a
  `//go:build e2e` constraint. This is the *necessary* condition
  for go-rod / chromedp to be excluded from default server
  builds. It does *not* by itself ban the imports in non-test
  files; that's the next guard.
- `platformkit-backend-kit/cmd/repo-split-importcheck` —
  parameterised tool that rejects imports matching a
  caller-supplied `--forbid-prefix` inside caller-supplied
  `--roots`. Server-producing repos wire it with
  `--forbid-prefix=github.com/go-rod` and
  `--forbid-prefix=github.com/docker/docker` in CI.
- Repo-split topology — `platformkit-devtools` and
  `platformkit-tests` are separate Go modules. Server repos
  don't list them as dependencies; `go mod tidy` in a server repo
  rejects an accidental cross-repo import at resolve time. The
  coarsest but strongest line of defence.
- Not a guard here — `runtime-boundary-check` enforces an
  *internal* tier-layering policy inside
  `platformkit-backend-kit`; it doesn't scan for go-rod / Docker
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

The intent, encoded in
`pk-modules/scripts/module_archetypes.csv` and
in the `check-module-maturity` /
`check-module-assurance-evidence` audits:

- **core-certified** — ≥1 test file per feature, integration
  tests for every exposed port method, BDD tests for public
  scenarios, meaningful line coverage across feature code.
- **supported** — ≥1 test file per feature, coverage for every
  happy-path per feature.
- **experimental** — at least a module smoke test; the `notes:`
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
If you add `tier: supported` to a module, it needs ≥1 test file
per feature and happy-path coverage — before CI will let the
catalog edit through. Demote the claim or add the tests.

**How it's enforced.**

- `check-tests-floor` —
  `pk-modules/Makefile` target →
  `platformkit verify module test-floor` →
  `platformkit-devtools/internal/modulechecks/test_floor.go`.
  Current enforcement is a flat floor: every module must ship ≥1
  `*_test.go` file. Exceptions live in
  `scripts/test_floor_allowlist.txt` with an `owner=` and
  `until=YYYY-MM-DD` field. Tier-specific line-coverage
  thresholds are NOT enforced by this script today.
- `check-module-maturity`
  (`scripts/check_module_maturity.sh`) — validates the tier claim
  in `module_contracts.yaml` against archetype expectations from
  `module_archetypes.csv`. Blocks a `supported` claim when the
  tested surface is thin.
- `check-module-assurance-evidence`
  (`scripts/generate_module_assurance_evidence.sh --check`) — for
  modules with `assuranceEligible: true`, verifies BDD and
  integration test directories exist and the generated evidence
  report matches what's on disk.
- Build-tag discipline — the `buildtags` pkvet analyzer keeps
  E2E opt-in by forcing `//go:build e2e` on `tests/e2e/` and
  `tests/bdd/` files (see
  [C-05](#c-05-server-binaries-dont-ship-browsers-or-docker)).
- Gap — no tier-aware line-coverage gate.
  `check-tests-floor` doesn't compute coverage percentages or
  cross-reference the tier. Raising the gate to enforce
  ≥70% / ≥50% per tier requires wiring a coverage pass into CI.
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
`platformkit-shared/lintreport` as the canonical implementation
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
booking_management/portal_handler.go:461:58: error: [design-tokens/tailwind-palette-color] raw Tailwind palette utility "border-red-300"; use border-border-* (ref: C-07)
```

Use the package's typed enums for shared severity, category, and
format names (`Severity`, `Category`, `Format`) instead of raw
strings at call sites. A rule's name is stable public API: keep it
kebab-case and deprecate rather than rename once CI consumers depend
on it.

**How it's enforced.**

- `platformkit-shared/lintreport` owns the standard renderers:
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
  `platformkit-backend-kit` for `go vet`-style static enforcement.

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

**Current examples.** `platformkit-backend-kit/core/scaffold/compose.go` now
returns errors for `BuildProject` and `GenerateProjectManifest`.

---

## C-14 Every Go file declares its purpose

Every `.go` file the workspace owns carries a leading comment block
that names the file's purpose and references at least one numbered
convention (`C-NN`) or ADR (`ADR-NNNN`) that motivates its existence.

The reference belongs in the first 30 lines of the file (after the
`package` declaration), in a comment of the form:

```go
package tenant_lifecycle

// service_audit.go owns audit-event recording for the tenant
// lifecycle service — extracted so service.go stays focused on
// the entity lifecycle.
//
// Convention: C-11 (complexity discipline), C-12 (audit-by-wrapping).
// ADR: 0030 (audit-wrapping pattern).
```

Two rules follow:

1. **The IDs are mandatory; the prose is optional.** A reader
   skimming the file should see at least one `C-NN` or `ADR-NNNN`
   in the leading comments. Free-text purpose lines on top of that
   are encouraged but not required by the guard.
2. **The reference must be real.** The guard validates that each
   referenced ID resolves to an entry in `conventions.md` or
   `adr/`. A typo or a stale ID fails the build.

**Why we do it this way.** Cohesion choices made today are invisible
to tomorrow's reader unless the file says so. The May 2026 complexity
sweep split nine 1000–2000-line files into 50+ siblings; the cohesion
behind each split lives in the commit messages, but a reader landing
in `gorm_authz.go` six months from now has no in-file signal that
the split was deliberate. Pinning a `C-NN` or `ADR-NNNN` to every
file pulls the rule from the registry into the file itself — and
makes the registry load-bearing rather than archival. A convention
nobody references is a candidate for retirement.

**When you're authoring a file.** Pick the closest matching `C-NN`
or `ADR-NNNN` from this document or `adr/`. If nothing matches, you
are either writing code that doesn't fit the existing house rules
(write a new convention or ADR first) or writing code that
genuinely belongs in an excluded category (generated, manifest,
migration, atom/molecule definition, `cmd/*` generator). Adding to
the exclusion allowlist is a deliberate one-line diff in
`.claude/check-file-purpose.yaml` that reviewers can reject; never
add `// nolint:check-file-purpose` inline.

**How it's enforced.**

- `check-file-purpose`
  (`platformkit-devtools/cmd/check-file-purpose/main.go`,
  invoked via `make check-file-purpose` at the workspace root and
  per repo). Walks every `.go` file under the workspace, applies
  the exclusion allowlist from `.claude/check-file-purpose.yaml`,
  and emits a pass/fail report. Failures name the missing file
  plus the closest matching convention.
- The exclusion allowlist is a deliberate inventory, not a wildcard
  list. New entries require a one-line diff that reviewers can
  reject.
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
- [CLAUDE.md](../../CLAUDE.md) — the agent guide. The invariants
  listed there are the same rules codified in this document.
- `pk-docs/architecture/overview.md` — cross-references
  each convention to the analyzer that enforces it.
