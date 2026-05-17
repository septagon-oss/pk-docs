---
title: v0.0.0 Release Audit
slug: v0-0-0-release-audit
collection: docs
status: published
---

# v0.0.0 Release Audit

Date: 2026-05-17

## Scope

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

## Current Decision

The OSS repos are now suitable for a release-candidate push. The remaining
release gates are external publication gates: push, remote CI, fresh-clone
verification, and annotated tags.

Do not create irreversible public tags until those gates are complete.

## Passed Local Gates

- `make verify` passes in all ten OSS repos.
- Go repos pass `go test`, `go vet`, and `staticcheck` through their Makefiles.
- `pk-core` and `pk-design` run race-sensitive fitness checks through their
  verification targets.
- `pk-docs` passes Node tests and builds the public docs site.
- `govulncheck ./...` reports no vulnerabilities in Go repos.
- `npm audit --audit-level=moderate` reports zero vulnerabilities in `pk-docs`.
- `go mod tidy -diff` is clean across Go repos.
- `gofmt` is clean across OSS Go source.
- `git diff --check` is clean.
- Conflict-marker scan is clean.
- The published docs set excludes source material that has not been rewritten
  for the OSS split.

## Resolved Release Risks

### License policy

All ten repos use Apache-2.0. This gives the platform backbone a consistent
copyright and patent-grant model.

### Public docs scope

The docs builder publishes release-ready OSS docs from `docs/` by default.
Older ADR, architecture, and requirements source material remains in the repo
for rewrite work, but it is not presented as the v0.0.0 public contract unless a
page explicitly opts in with `status: published`.

### Composability evidence

`pk-core` defines the composability model, block and chain model, and
composability audit. `pk-core` and `pk-design` also expose machine-readable
block manifests with executable tests for identity, ownership, status, and
evidence links.

### Release process

Release notes and release steps are documented in this docs site. The tag order
and fresh-clone checks are explicit.

## Remaining External Gates

1. Push all `main` branches to `septagon-oss`.
2. Set upstream tracking for each repo.
3. Confirm every GitHub Actions workflow is green.
4. Run fresh-clone build/install checks in dependency order.
5. Create annotated `v0.0.0` tags in dependency order.
6. Publish the docs site.

## Tag Order

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

## Coverage Notes

Strong areas:

- `pk-core/pkg/authz`
- `pk-core/pkg/entity`
- `pk-core/pkg/module`
- `pk-core/pkg/mutation`
- `pk-core/pkg/registry`
- `pk-core/pkg/observability`
- `pk-design/pkg/tokens`
- `pk-design/pkg/themes`
- `pk-design/pkg/components`
- `pk-design/pkg/catalog`

Areas to deepen after v0.0.0:

- `pk-client` retry and transport error matrices
- `pk-tools` TUI interaction states
- `pk-runtime` guarded HTTP negative paths
- `pk-testkit` failure diagnostics and examples
- `pk-apps` larger app-composition examples

These are not blockers for a seed release as long as the release notes do not
overstate stability.
