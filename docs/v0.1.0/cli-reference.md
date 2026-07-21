---
title: v0.1.0 CLI Reference
slug: v0-1-0-cli-reference
collection: docs
status: published
---

# v0.1.0 CLI Reference

`pk` is the PlatformKit OSS developer CLI, shipped in
[`pk-tools`](https://github.com/septagon-oss/pk-tools) at `cmd/pk`. It has
exactly **three verbs** in v0.1.0:

| Command | What it does |
|---------|--------------|
| `pk doctor` | Checks that your dev environment can build and run PlatformKit. |
| `pk verify` | Runs `go vet ./...` then `go test ./...` in the current module. |
| `pk explain modules` | Prints the nine-module OSS catalog (with `--json`). |

> **There is no `pk scaffold` verb in v0.1.0.** Code generation exists as a Go
> *library* (`pk-tools/pkg/scaffold`), not a CLI command. The manual path for
> creating a module is documented in [Add a module](./add-a-module.md).

## Install

Requires Go 1.26+.

```bash
go install github.com/septagon-oss/pk-tools/cmd/pk@v0.1.0
```

or run it straight from a clone:

```bash
git clone https://github.com/septagon-oss/pk-tools
cd pk-tools
go run ./cmd/pk doctor
```

## `pk doctor`

Runs four environment probes and prints one line per check. Failures don't
abort later checks; the command exits non-zero if any check failed.

| Check | What it verifies |
|-------|------------------|
| `Go version >= 1.26` | The toolchain that built `pk` is go1.26 or newer (parsed from `runtime.Version()`). |
| `modernc.org/sqlite pure-Go driver available` | The **current working directory's Go module** declares `modernc.org/sqlite` as a dependency (via `go list -m`). Expect a failure when you run doctor outside a PlatformKit app module — that is by design. |
| `:8080 port free for starter-saas` | Port 8080 can be bound (the starter's default listen address). |
| `GOPATH writable` | A temp file can be created under `GOPATH` (or `~/go`), a proxy for `go install` working. |

Sample output (inside a starter app checkout, port free):

```
[OK] Go version >= 1.26: go1.26.2
[OK] modernc.org/sqlite pure-Go driver available: modernc.org/sqlite v1.x.y
[OK] :8080 port free for starter-saas: free
[OK] GOPATH writable: /home/you/go
doctor: all checks passed
```

On failure the line flips to `[FAIL] ...` and the command exits with
`doctor reported failures; see above`.

`pk doctor` takes no flags.

## `pk verify`

Runs, in the current working directory:

1. `go vet ./...`
2. `go test ./...`

Both must succeed for a zero exit. The underlying `go` output streams through
verbatim, book-ended by progress markers:

```
[RUN] go vet ./...
[OK] go vet passed
[RUN] go test ./...
ok      example.com/my-saas    0.412s
[OK] go test passed
```

`pk verify` takes no flags; it always targets the module you are standing in.

## `pk explain modules`

Prints the OSS essentials pack. The metadata is sourced from each module
package's public constants (`ModuleID`, `ModuleName`, `ModuleDescription`,
`ModuleVersion`), so it cannot drift from the code:

```
$ pk explain modules
PlatformKit OSS module catalog (v0.1.0):
  tenant_management         Tenant Management — Tenant CRUD, tenant context propagation, and isolation contracts.
  user_management           User Management — Tenant-scoped user CRUD with pluggable password hashing.
  auth_management           Auth Management — Session-cookie login flow on top of user_management.
  api_key_management        API Key Management — Tenant-scoped API key issuance, verification, and revocation.
  audit_management          Audit Management — Append-only tenant-scoped audit event log.
  health_management         Health Management — Aggregates module health checks and serves /healthz.
  notification_management   Notification Management — In-app notifications with pluggable channels and per-user subscriptions.
  content_management        Content Management — Tenant-scoped pages, posts, and snippets with markdown/HTML bodies.
  admin_management          Admin Management — Pluggable admin shell that hosts the registered pages of other modules.

Port wiring details: see each module's Compose() and the pk-modules README.
```

### `--json`

```bash
pk explain modules --json
```

emits an array of objects with `id`, `name`, `description`, and `version`
fields. Note that `version` is each module's declared port-contract version —
`"0.0.0"` in this release — not the v0.1.0 release tag (see the note in the
[Module Reference](./module-reference.md)).

`pk explain` with no subcommand prints help; `modules` is its only subcommand
in v0.1.0.

## What else is in pk-tools

The repo also ships library packages you can build your own CLIs on:
`pkg/cliapp` (cobra root assembly, JSON output helpers), `pkg/tui`
(terminal-aware status lines and tables, `NO_COLOR`-aware), and
`pkg/scaffold` (the governed code generators mentioned above). None of these
add verbs to `pk`.

## Related pages

- [Quickstart](./quickstart.md) — you don't need `pk` to boot the starter.
- [Testing Guide](./testing-guide.md) — what `pk verify` runs, and what
  pk-testkit adds on top.
