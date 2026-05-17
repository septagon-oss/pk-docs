---
title: v0.0.0 Implementation Plan
slug: implementation-plan
collection: docs
status: published
---

# v0.0.0 Implementation Plan

The first OSS release should be small, coherent, and hard to misunderstand.
It is not a full commercial platform release. It is the public kernel that
proves the PlatformKit architecture can be extended without private coupling.

## Release Objective

Ship a ten-repo backbone that lets a developer:

1. read the architecture and composability model
2. inspect the public block contracts
3. run tests and static checks locally
4. compose the example app
5. publish docs from source-owned content
6. understand where downstream/private extensions attach

## Completion Criteria

The release is ready when:

- every repo has a clean Apache-2.0 license policy
- every repo passes `make verify`
- Go repos pass `go test`, `go vet`, `staticcheck`, and `govulncheck`
- `pk-docs` passes Node tests, builds the public docs site, and publishes only
  release-ready docs
- `pk-core` and `pk-design` expose machine-readable block manifests
- block-manifest tests validate identity, ownership, status, and evidence
- release notes and release steps are published
- fresh-clone verification works in dependency order
- annotated `v0.0.0` tags are created only after remote CI is green

## Public Contract Priority

v0.0.0 should stabilize only the backbone:

- `pk-core/pkg/module`
- `pk-core/pkg/registry`
- `pk-core/pkg/authz`
- `pk-core/pkg/entity`
- `pk-core/pkg/mutation`
- `pk-core/pkg/observability`
- `pk-design/pkg/tokens`
- `pk-design/pkg/themes`
- `pk-design/pkg/components`
- `pk-design/pkg/catalog`
- `pk-runtime` host and guarded HTTP primitives
- `pk-testkit` conformance and flow-test primitives
- `pk-client` transport and error primitives

Everything else can be useful without being declared stable. The release should
say that clearly.

## Work Sequence

1. Finish the public release docs in `pk-docs`.
2. Align license policy across the ten repos.
3. Add executable block manifests for `pk-core` and `pk-design`.
4. Keep docs publishing scoped to release-ready OSS pages.
5. Run all local verification gates.
6. Push every repo to `septagon-oss`.
7. Confirm GitHub Actions in dependency order.
8. Run fresh-clone install/build checks.
9. Create annotated tags in dependency order.
10. Publish the docs site.

## Extension Principle

No v0.0.0 feature is accepted because it is convenient. A feature belongs in
the public backbone only when it makes a block more composable, safer to
replace, easier to audit, or easier to bind at runtime.

That is the quality bar.
