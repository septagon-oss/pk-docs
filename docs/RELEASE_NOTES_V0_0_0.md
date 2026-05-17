---
title: v0.0.0 Release Notes
slug: release-notes-v0-0-0
collection: docs
status: published
---

# v0.0.0 Release Notes

`v0.0.0` is the first seed release of the PlatformKit OSS backbone. It is meant
for inspection, experimentation, and early extension work.

## What Is Included

- `pk-core`: module composition, registries, authz contracts, entity
  descriptors, mutation gates, and observability contracts.
- `pk-design`: design tokens, themes, component descriptors, and design
  contribution catalogs.
- `pk-shared`: small shared primitives for composition, flows, state machines,
  and identifiers.
- `pk-runtime`: host/readiness, guarded HTTP routing, request context, and
  health projection.
- `pk-testkit`: conformance and API flow-test helpers.
- `pk-modules`: small example modules that prove the public contracts.
- `pk-apps`: runnable compositions that prove the repos can work together.
- `pk-tools`: CLI/TUI primitives.
- `pk-client`: typed client primitives.
- `pk-docs`: public docs portal, release docs, and module-doc composition.

## Stable Enough To Try

- Core module metadata, ports, bundles, catalogs, and composition.
- Registry contribution catalogs with deterministic duplicate-key behavior.
- Entity, authz, mutation, and observability contracts.
- Design token/theme/component/catalog primitives.
- Runtime host/readiness and guarded HTTP primitives.
- Testkit flow and conformance helpers.

## Experimental

- The exact CLI command surface.
- Large module packs.
- Full generated docs from module bundles.
- Deep app examples.
- Release automation around tags and docs publication.

## Extension Model

Downstream distributions should extend the OSS backbone by adding:

- concrete providers
- runtime adapters
- vertical modules
- branded client overlays
- hosted workflows
- deployment targets
- commercial policy and billing modules

Those extensions should depend on public contracts rather than copying core
semantics.

## Verification

Local release-candidate verification includes:

- `make verify` across all ten repos
- Go tests, vet, and staticcheck through repo Makefiles
- race-sensitive fitness checks in `pk-core` and `pk-design`
- `govulncheck ./...` for Go repos
- `npm audit --audit-level=moderate` for `pk-docs`
- `go mod tidy -diff`
- `gofmt`
- `git diff --check`
- conflict-marker scan

Remote CI and fresh-clone checks are required before tags are created.
