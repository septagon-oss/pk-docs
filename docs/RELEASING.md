---
title: Releasing
slug: releasing
collection: docs
status: published
---

# Releasing

PlatformKit OSS releases are repo-scoped. The workspace is a convenience for
**local development only**; each child repo is the release artifact and must be
consumable by someone who never cloned the workspace.

## Run Model (read first)

- **No `replace` in a published `go.mod`.** Modules resolve purely by version
  from the Go module proxy. Cross-repo development on disk is wired by the
  workspace `go.work` (`use ./pk-core`, …), **not** by `replace` directives. A
  published module that replaces a `github.com/septagon-oss/*` module — or uses
  any local-path replace (`./`, `../`, or absolute) — is broken for outsiders.
- **Ship `v0.2.0`, retract `v0.0.0`.** The old `v0.0.0` tags were cut with local
  `replace` directives baked in and can never resolve from the proxy. Each Go
  module's `go.mod` declares `retract v0.0.0 // broken: contained local replace
  directives`, so `go get` and `go list -m -versions` steer consumers to
  `v0.2.0+`. Never reuse or move `v0.0.0`.
- **Version namespaces.** The release is the git tag **`v0.2.0`**. The per-module
  `ModuleVersion` (port-contract value) stays **`0.0.0`** and is **not** bumped —
  bumping it breaks module-dependency compose, which pins `Version: "0.0.0"`.
- **Repo set.** 9 Go-module repos get a `v0.2.0` tag (below). The front-door
  repo `platformkit` is also tagged `v0.2.0`. `pk-docs` is a docs
  repo (this repo) — published, but **not** a Go module and **not** on the build
  train. `pk-deploy` releases independently; internal-only repos are excluded.

## Local Verification

Run this from every repo before pushing:

```bash
make verify
```

For Go repos, also build/test exactly as an outsider would — **no workspace
rescue** — and confirm there are no forbidden replaces:

```bash
GOWORK=off go build ./...
GOWORK=off go test ./...
go mod tidy -diff
govulncheck ./...
git diff --check

# Block-aware replace guard (catches single-line AND replace ( … ) block form):
go mod edit -json | jq -e '
  [ .Replace // [] | .[]
    | select((.Old.Path | startswith("github.com/septagon-oss/"))
             or (.New.Path | test("^(\\.|/|\\.\\.)"))) ] | length == 0
' >/dev/null || { echo "FAIL: forbidden replace in go.mod"; exit 1; }
```

For `pk-docs`:

```bash
npm audit --audit-level=moderate
```

## Dependency Order (leaf-first)

Tag and push in this layered order so each repo's dependencies already exist by
version when it is tagged:

1. **Layer 0 (leaves):** `pk-shared`, `pk-core`, `pk-design`, `pk-client`
2. **Layer 1:** `pk-runtime`, `pk-modules`, `pk-testkit`
3. **Layer 2:** `pk-tools`
4. **Layer 3:** `pk-apps`
5. **Layer 4 (front door, new repo):** `platformkit` (requires `pk-apps`)

`pk-docs` is not on this train; publish it when its content is final.

## Tagging

Create annotated `v0.2.0` tags on the merged `main` commit, only after CI is
green, in the dependency order above:

```bash
git tag -a v0.2.0 -m "PlatformKit OSS v0.2.0"
git push origin main
git push origin v0.2.0
```

The `v0.2.0` tag points at the `main` commit. `main` may advance afterward only
for post-tag docs/CI changes — that does not move the tag, and there is no
`HEAD == v0.2.0` requirement. **Published versions on the Go proxy are
immutable.** If a bad version reaches the proxy, cut `v0.1.1` — never move or
re-cut `v0.2.0`.

## Fresh-Clone Check

For each Go repo, resolve and build purely by version with no workspace:

```bash
tmp="$(mktemp -d)"
git clone https://github.com/septagon-oss/<repo>.git "$tmp/<repo>"
cd "$tmp/<repo>"
GOWORK=off go build ./...
GOWORK=off go test ./...
go list -m all
```

For the **front door**, do a real boot smoke (not a no-op build in an empty
module):

```bash
git clone https://github.com/septagon-oss/platformkit
cd platformkit
GOWORK=off go run . &  PID=$!; sleep 3
# Health is open; the API requires authentication and /admin is behind a login wall.
test "$(curl -s -o /dev/null -w '%{http_code}' http://localhost:8080/healthz)"        = 200
test "$(curl -s -o /dev/null -w '%{http_code}' http://localhost:8080/api/v1/tenants)" = 401
test "$(curl -s -o /dev/null -w '%{http_code}' http://localhost:8080/admin)"          = 303
SID="$(curl -s -X POST http://localhost:8080/api/v1/auth/sessions \
          -H 'Content-Type: application/json' \
          -d '{"tenant_id":"tenant_local","email":"operator@local.test","password":"local-development-only"}' \
        | jq -r .id)"
test "$(curl -s -o /dev/null -w '%{http_code}' http://localhost:8080/api/v1/tenants \
          -H "Authorization: Bearer $SID")" = 200
kill $PID
```

For `pk-docs`:

```bash
tmp="$(mktemp -d)"
git clone https://github.com/septagon-oss/pk-docs.git "$tmp/pk-docs"
cd "$tmp/pk-docs"
npm ci
make verify
```

## Release Notes

Every release must say:

- what contract is stable enough to try
- what remains experimental
- how Pro/private extensions attach
- what verification was run
- what changed since the previous tag
