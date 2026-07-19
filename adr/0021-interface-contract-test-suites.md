---
title: "ADR 0021: Interfaces with multiple implementations share a test suite"
status: Accepted
date: 2026-04-13
slug: adr-0021-interface-contract-test-suites
adr_topic: quality-assurance
type: doc
tags: [adr, testing, interfaces, providers]
---

# ADR 0021 — Interfaces with multiple implementations share a test suite

Status: **Accepted** (2026-04-13)

## The problem

PlatformKit ships a lot of interfaces with more than one
implementation. `cache.Cache` has memory, Redis, mock, and middleware
providers under `platformkit-backend-kit/infrastructure/cache/providers/`.
Frontend service registries can accept app-owned implementations in addition
to the concrete providers shipped by frontend-kit. `FieldRenderer` has
per-type renderers (boolean, date, number, select, text,
semantic, status, composite) registered by priority.

Every implementation needs verification. Ad-hoc tests per
provider produce three failure modes we've already seen in
production:

- **Drift between implementations.** A new provider ships without
  matching an existing `Clear()` behaviour. Callers that swap
  providers at boot hit latent bugs that only surface under a
  specific ordering of operations.
- **Stubs that claim the interface while masking enforcement.** A
  noop `HasPermission(_, _) bool { return true }` compiles
  against the interface — and in production silently grants all
  permissions. An ad-hoc per-provider test file never catches this
  because each author asserts what their provider *should* do, not
  what the interface *requires*.
- **No shared definition of "correct".** When a reviewer asks
  "does this provider satisfy the contract?", the answer is
  whatever the author thought at the time. Across many interfaces
  in the workspace, that's untenable.

Every one of these is a trust failure that only shows up in
production.

## The decision

Every interface in `platformkit-backend-kit`,
`platformkit-frontend-kit`, or `platformkit-shared` that has (or
could have) more than one implementation SHOULD ship a sibling
`*contract/` package with a behavioural test suite. Every new
production-facing provider SHOULD wire the suite from its own
`_test.go` file. Existing providers without wired contracts get
remediated opportunistically — no retroactive CI gate forces the
migration.

The canonical shape, from the existing `cachecontract` suite:

```go
// platformkit-backend-kit/infrastructure/cache/cachecontract/cache_contract.go
package cachecontract

// CacheFactory produces a fresh cache.Cache instance. Each subtest
// calls the factory so state-mutating tests do not bleed into
// each other.
type CacheFactory func() cache.Cache

func RunCacheTests(t *testing.T, newCache CacheFactory) {
    t.Helper()
    t.Run("SetAndGet", func(t *testing.T) { testCacheSetAndGet(t, newCache()) })
    t.Run("TTLExpiry", func(t *testing.T) { testCacheTTLExpiry(t, newCache()) })
    t.Run("ConcurrentSetGet", func(t *testing.T) { testCacheConcurrentSetGet(t, newCache()) })
    // … 13 more subtests
}
```

Each provider wires the suite in a single-function test file:

```go
// platformkit-backend-kit/infrastructure/cache/providers/memory/contract_test.go
func TestMemoryCacheContract(t *testing.T) {
    cachecontract.RunCacheTests(t, func() cache.Cache {
        c := NewMemoryCacheWithConfig(MemoryCacheConfig{
            GCInterval: 50 * time.Millisecond,
            MaxEntries: 1000,
        })
        t.Cleanup(func() { _ = c.Close() })
        return c
    })
}
```

Five rules keep the pattern honest:

1. **One `*contract/` package per interface**, colocated with the
   interface definition. Naming: `<interface-package-name>contract`
   (e.g. `cache` → `cachecontract`, `auth` → `authcontract`,
   `fields` → `fieldscontract`).
2. **Factory-returning tests, not shared instances.** Every
   `t.Run` constructs a fresh provider via the factory callback so
   state-mutating tests don't interfere.
3. **Tests describe the interface's invariants, not any provider's
   implementation details.** "Set-then-Get returns the set value"
   is an invariant. "Redis uses RESP3 framing" is not.
4. **Fail-closed behaviour is asserted.** An auth contract that
   doesn't verify "fresh service starts unauthenticated" allows a
   synthetic provider to mask missing enforcement.
5. **Production providers must conform; test doubles stay in tests.** A
   production-facing provider cannot opt out of the shared contract by
   returning success-shaped zero values. Test-only doubles belong in
   `_test.go` files or dedicated test-support packages. Runtime factories
   require an exact registered provider name and return an error for missing
   or unknown names; they never substitute a silent provider.

Adjacent patterns that live in `*contract/` directories but are
NOT this pattern (out of scope):

- `platformkit-backend-kit/analysis/accesscontract` and
  `analysis/eventcontract` — `go/analysis` linters that enforce
  architectural rules statically.
- `platformkit-backend-kit/observability/logger/providercontract` —
  shared fx constructor parameter struct (`Params` with `fx.In`).
- `platformkit-backend-kit/pwa/providercontract` — an interface +
  DTO declaration package (a `NotificationService` interface
  declared separately from its implementations to avoid an import
  cycle). An interface that *could* gain a behavioural contract
  suite but currently ships without one.
- `platformkit-backend-kit/internal/runtimecontract` — generates
  and diffs a serialised API contract (OpenAPI-style) across
  revisions. Not an interface behavioural suite.
- `platformkit-shared/presentation/componentcontract` — validates
  the component spec catalog.
- `pk-modules/tests/ui_contract` — `go test`
  files that assert module UI authoring conventions across the
  repo (canonical prefixes, page container usage, etc.).

## What we gave up

- A maintenance surface. Adding a method to an interface now
  requires adding a test to the contract package. This is the
  point, but it's visible cost.
- Repeated construction overhead. Factory-returning tests multiply
  provider construction cost — a provider with expensive
  initialisation (a Redis round-trip, say) runs that cost per
  subtest. Mitigated by scoping expensive setup to integration
  tests; contract suites run against in-memory or mock providers
  by default.
- Uniform adoption. Not every existing provider wires the contract
  yet. The pattern is the accepted target; retrofitting happens
  opportunistically, not under a CI gate.

## What we kept

- Interface drift caught at `go test`. Adding a method to `Cache`
  without updating the contract is a compile error in the suite.
  Adding a provider that doesn't satisfy existing tests fails the
  test. Both block merge.
- A clear definition of done for new providers. "Implement the
  interface, wire the contract, pass" is the checklist. Reviewers
  know what to look for.
- Living documentation. A reader unfamiliar with `FieldRenderer`
  can read `fieldscontract/field_contract.go` and see exactly what
  the interface promises.
- Distinct test layers. Contract tests assert interface-level
  invariants, not end-to-end behaviour. A cache provider that
  passes `cachecontract` can still have a production bug that
  only manifests under real load; that's what `//go:build integration`
  suites are for. The layers don't collapse.

## How we enforce it

- **Test-compile verification (for providers that wire the
  contract).** A provider test file that calls the contract suite
  fails at `go test ./...` / `go vet ./...` compile time if the
  contract package's exported signatures no longer match what the
  provider imports. `go build` alone doesn't catch this because
  it doesn't compile `_test.go` files. Which `make` targets
  exercise this varies per kit: `platformkit-backend-kit`'s
  `make precommit` runs `test`, and `platformkit-shared`'s runs
  `verify → test`; `platformkit-frontend-kit`'s `make precommit`
  runs `verify → guard-pr test-js` and does NOT chain to
  `test-go`, so contract-test compile regressions there surface
  only when `make test-go`, `make test`, or the reusable Go CI
  workflow explicitly invokes `go test`. No cross-kit gate
  currently normalises this.
- **Gap — no repo-wide CI gate requiring contract packages to
  exist.** A new interface in `infrastructure/search/` could ship
  without a matching `searchcontract/`. An analyzer walking
  `interface` declarations and asserting a sibling `*contract/`
  package exists would close this. Tracked as follow-up.
- **Gap — no check that every production provider wires the
  contract.** A session-auth provider could ship without the
  `authcontract` import and pass CI. The convention is visible in
  review but not enforced mechanically.
  [Convention C-06 — test coverage scales with tier](../conventions.md#c-06-test-coverage-scales-with-tier)'s
  `check-tests-floor` enforces only a per-business-module
  `≥1 *_test.go` floor and does NOT cover backend-kit or
  frontend-kit provider directories where most contract suites
  live.
- **Frontend provider selection is mechanically fail-closed.**
  `platformkit-frontend-kit/providers.Registry.Require` rejects missing,
  non-canonical, and unregistered names. Every canonical frontend service
  factory delegates to that resolver and propagates its error. The
  repository-level `service_provider_contract_test.go` verifies those
  failure modes, confirms real providers construct successfully, and scans
  the production service tree so retired noop packages cannot return.

## References

- Reference implementations:
  - `platformkit-backend-kit/infrastructure/cache/cachecontract/cache_contract.go`
    — 16 subtests covering TTL expiry, overwrite, concurrency,
    special-character keys, large values, zero-TTL, nil context,
    stats/health.
  - `platformkit-backend-kit/resilience/resiliencecontract/resilience_contract.go`
    — multi-interface contract with a separate state-transition
    suite.
  - `platformkit-frontend-kit/services/auth/authcontract/auth_contract.go`
    — fail-closed identity contract with the factory-per-subtest
    pattern.
  - `platformkit-frontend-kit/service_provider_contract_test.go` and
    `providers/registry_test.go` — forward-only provider-selection evidence:
    exact registered names, explicit construction errors, real provider
    construction, and source ratchets against retired pretend providers.
- Full inventory of interface behavioural contract packages (26
  as of 2026-04-13; verified via grep for `^func Run[A-Z]` in
  `*contract/` directories):
  - Backend-kit (13): `app/event/eventcontract`,
    `app/localization/localizationcontract`,
    `app/module/modulecontract`,
    `app/validator/validatorcontract`,
    `core/crud/crudcontract`,
    `infrastructure/cache/cachecontract`,
    `infrastructure/filesystem/fscontract`,
    `infrastructure/jobs/jobscontract`,
    `infrastructure/search/searchcontract`,
    `observability/logger/loggercontract`,
    `observability/metrics/metricscontract`,
    `observability/tracing/tracingcontract`,
    `resilience/resiliencecontract`.
  - Frontend-kit (13): `i18ncontract`,
    `icons/iconcontract`,
    `renderer/builders/builderscontract`,
    `renderer/fields/fieldscontract`,
    `renderer/renderercontract`,
    `services/auth/authcontract`,
    `services/dialogs/dialogcontract`,
    `services/notification/notificationcontract`,
    `services/storage/storagecontract`,
    `services/theme/themecontract`,
    `services/toast/toastcontract`,
    `services/user/usercontract`,
    `services/validation/validationcontract`.
- Related:
  [ADR 0005 — no silent failures](./0005-error-handling-discipline.md)
  — the fail-closed discipline the contracts support.
- Related:
  [ADR 0009 — modules only talk through ports](./0009-ports-only-cross-module-communication.md)
  — the interfaces these suites validate.
- Related:
  [Convention C-04 — public contracts live away from their implementation](../conventions.md#c-04-public-contracts-live-away-from-their-implementation)
  — where business-module public contracts live. This ADR covers
  infrastructure/renderer/service interfaces, which live next to
  their implementations rather than in `contracts/provides/`.
- Related:
  [Convention C-06 — test coverage scales with tier](../conventions.md#c-06-test-coverage-scales-with-tier)
  — the per-business-module test-file floor, which doesn't apply
  to the provider directories this ADR covers.
