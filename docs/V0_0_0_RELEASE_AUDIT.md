# PlatformKit OSS v0.0.0 Release Audit

Date: 2026-05-17

Scope:

- `pk-core`
- `pk-design`
- `pk-shared`
- `pk-modules`
- `pk-apps`
- `pk-runtime`
- `pk-testkit`
- `pk-tools`
- `pk-client`
- `pk-docs`

## Decision

The OSS repos are mechanically healthy, but v0.0.0 should not be tagged until
the release blockers below are resolved.

The codebase is ready for a remote CI dry run. It is not yet ready for a public
v0.0.0 tag set.

## Passed Gates

- `make verify` passes in all ten OSS repos.
- Go repos pass `go test`, `go vet`, and `staticcheck` through their Makefiles.
- `pk-core` and `pk-design` run race checks through `make verify`; `pk-core`
  also includes observability in its fitness target.
- `pk-docs` passes Node tests and builds 186 documentation pages.
- `govulncheck ./...` reports no vulnerabilities in Go repos.
- `npm audit --audit-level=moderate` reports zero vulnerabilities in
  `pk-docs`.
- `go mod tidy -diff` is clean across Go repos.
- `gofmt` is clean across OSS Go source.
- `git diff --check` is clean.
- Conflict-marker scan is clean.
- Public `septagon-dev` references were removed from OSS docs/social links.

## Release Blockers

### 1. Repositories are not release-published

All repos have `septagon-oss` origins, but local branches do not have upstream
tracking configured, no remote CI result has been observed, and no `v0.0.0`
tags exist.

Required before release:

- push all `main` branches
- set upstream tracking
- confirm every GitHub Actions workflow is green
- create annotated `v0.0.0` tags in dependency order
- confirm `go install` / `go get` works from fresh clones where applicable

Suggested tag order:

1. `pk-core`
2. `pk-shared`
3. `pk-design`
4. `pk-runtime`
5. `pk-testkit`
6. `pk-modules`
7. `pk-client`
8. `pk-tools`
9. `pk-apps`
10. `pk-docs`

### 2. License policy is inconsistent

Most repos use Apache-2.0. `pk-runtime` and `pk-testkit` currently use MIT.

This may be intentional, but it must be explicit before v0.0.0. Mixed licensing
is not automatically wrong; unexplained mixed licensing is a public-release
risk.

Required before release:

- choose one policy: uniform Apache-2.0, uniform MIT, or documented mixed
  licensing
- align `LICENSE`, README badges/text, and contribution language accordingly
- add a short licensing note if the policy remains mixed

### 3. Public docs still describe internal-era architecture in places

The new OSS backbone is ten repos, but some docs still describe the older
internal 21-repo workspace and implementation migration plan.

High-risk files:

- `architecture/05-building-block-view.md`
- `docs/IMPLEMENTATION_PLAN.md`
- older ADRs and requirements that reference private repo names as if they are
  the current public contract

Required before release:

- add a clear "archival context" label where earlier architecture is retained
  intentionally
- create a current OSS building-block view for the ten-repo backbone
- make the docs homepage route readers to the OSS model first

### 4. Composability and chainability audits are defined but not executable

`pk-core` now defines:

- composability
- a mathematical composition model
- blocks and chains
- a composability audit framework

Those documents are valuable, but only `pk-core` has partial executable fitness
coverage. The full audit is not yet automated across all public block surfaces.

Required before release:

- add at least one machine-readable block manifest or generated equivalent
- add an executable audit for public block identity and ownership
- add registry algebra checks for every public contribution registry
- add chainability checks for request/job/event/MCP-style flows as they are
  introduced

### 5. Go module release strategy is not documented

Several repos depend on sibling OSS repos through `require v0.0.0` plus local
`replace` directives for workspace development.

This can be workable, but v0.0.0 needs a documented release process so fresh
consumers and CI do not rely on local workspace layout.

Required before release:

- document whether `replace` directives remain in tagged modules
- prove fresh-clone builds in tag order
- document the dependency graph and tag order

## Important Non-Blocking Gaps

### Coverage is uneven

Strong areas:

- `pk-core/pkg/authz`: 90.4%
- `pk-core/pkg/entity`: 91.9%
- `pk-core/pkg/module`: 84.7%
- `pk-core/pkg/mutation`: 85.8%
- `pk-core/pkg/observability/guardrail`: 100.0%
- `pk-core/pkg/observability/health`: 92.1%
- `pk-core/pkg/observability/metrics`: 96.7%
- `pk-core/pkg/observability/tracing`: 100.0%
- `pk-design`: 80-92% across packages
- `pk-shared/pkg/flowdef`: 93.3%
- `pk-shared/pkg/statemachine`: 89.6%

Thin areas:

- `pk-client`: 51.7%
- `pk-tools/pkg/tui`: 53.6%
- `pk-tools/pkg/cliapp`: 61.5%
- `pk-runtime`: 66-73%
- `pk-testkit`: 57-64%
- `pk-modules/pkg/homepage/overlay`: 57.6%
- `pk-apps` examples are smoke-level only

v0.0.0 can ship with uneven coverage if it is declared as an initial seed, but
the adapter/runtime/testkit repos need more negative-path coverage before a
stronger public stability claim.

### Release notes are missing

Before tagging, add a concise v0.0.0 release note that explains:

- what is stable enough to try
- what is intentionally experimental
- how OSS relates to Pro/private PlatformKit
- which repos are seed packages versus core contracts

### Root workspace is not a release artifact

`septagon-oss-workspace` has a useful README but is not itself a Git repo. That
is fine, but release instructions must make clear that each child repo is the
artifact.

## Composability Readiness By Repo

| Repo | Current status | Gap |
|---|---|---|
| `pk-core` | Strongest. Defines core grammar and fitness tests. | Needs executable block manifest/audit coverage beyond hand-authored docs. |
| `pk-design` | Strong token/theme/component/catalog model. | Needs explicit mapping to composability scorecard and design-block manifests. |
| `pk-shared` | Useful primitives for composition/flows/state machines. | `pkg/composition` remains a maintainability hotspot; needs clearer release contract boundaries. |
| `pk-modules` | Demonstrates module pack concept. | Too small to prove real module-block anatomy beyond examples. |
| `pk-apps` | Proves repos compile together. | Still examples, not a full app composition contract. |
| `pk-runtime` | Good lightweight runtime seed. | License mismatch; needs more chainability/evidence around guarded HTTP projection. |
| `pk-testkit` | Good conformance/flow-test seed. | License mismatch; needs stronger coverage and examples showing release consumers how to use it. |
| `pk-tools` | Good CLI/TUI seed. | Needs actual `platformkit` command surface and release install story. |
| `pk-client` | Hardened client primitives. | Needs broader transport/error/retry tests and public usage examples. |
| `pk-docs` | Builds and hosts real content. | Needs OSS-first architecture narrative and release notes. |

## Recommended v0.0.0 Checklist

1. Resolve license policy for `pk-runtime` and `pk-testkit`.
2. Rewrite or clearly label stale internal-era docs.
3. Add v0.0.0 release notes.
4. Add a short `RELEASING.md` or release section covering tag order and local
   `replace` policy.
5. Push all repos and confirm remote CI.
6. Run fresh-clone install/build tests.
7. Create annotated `v0.0.0` tags in dependency order.
8. Publish a public docs build from `pk-docs`.

## Current Assessment

The code is clean enough for a release candidate branch push.

It is not clean enough for an irreversible public v0.0.0 tag because the
release mechanics, license story, and OSS-first architecture narrative are not
yet resolved.
