---
title: Releasing
slug: releasing
collection: docs
status: published
---

# Releasing

PlatformKit OSS releases are repo-scoped. The workspace is a convenience for
development; each child repo is the release artifact.

## Local Verification

Run this from every repo before pushing:

```bash
make verify
```

For Go repos, also run:

```bash
go mod tidy -diff
govulncheck ./...
git diff --check
```

For `pk-docs`, also run:

```bash
npm audit --audit-level=moderate
```

## Dependency Order

Release in this order:

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

## Local Replace Policy

During workspace development, Go modules may use local `replace` directives so
the repos can evolve together before tags exist.

Before a public tag:

1. confirm each module can build from a fresh clone
2. confirm any required sibling tag already exists
3. remove or justify local-only `replace` directives in the tagged module
4. run `go list -m all` and `go test ./...`

Local replaces are acceptable in development commits. Public release tags must
be consumable by someone who did not clone the workspace.

## Fresh-Clone Check

For each Go repo:

```bash
tmp="$(mktemp -d)"
git clone git@github.com:septagon-oss/<repo>.git "$tmp/<repo>"
cd "$tmp/<repo>"
git checkout v0.0.0
make verify
go list -m all
```

For `pk-docs`:

```bash
tmp="$(mktemp -d)"
git clone git@github.com:septagon-oss/pk-docs.git "$tmp/pk-docs"
cd "$tmp/pk-docs"
git checkout v0.0.0
npm ci
make verify
```

## Tagging

Create annotated tags only after remote CI is green:

```bash
git tag -a v0.0.0 -m "v0.0.0"
git push origin v0.0.0
```

Tags should be created in dependency order. If a downstream repo fails after an
upstream tag, fix the downstream repo. Do not move a published tag unless the
release is being formally withdrawn.

## Release Notes

Every release must say:

- what contract is stable enough to try
- what remains experimental
- how Pro/private extensions attach
- what verification was run
- what changed since the previous tag
