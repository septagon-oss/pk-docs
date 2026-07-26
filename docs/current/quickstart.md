---
title: Current Quickstart
slug: current-quickstart
collection: guides
status: published
---

# Current quickstart

This is the current runnable PlatformKit OSS path. The executable contract is
the public [`septagon-oss/platformkit`](https://github.com/septagon-oss/platformkit)
repository; version-named documentation elsewhere in this repository is
historical.

## Requirements

- Go 1.26 or newer
- no Docker, Node.js, C compiler, or external database for the default starter
- Postgres only when you choose the production profile (see
  [Choose a database](#choose-a-database))

## Clone and run

```bash
git clone https://github.com/septagon-oss/platformkit
cd platformkit
GOWORK=off go run .
```

A fresh database starts the domain-neutral nine-module starter with SQLite and
a loopback-only listener at `127.0.0.1:8080`.

```text
local tenant: tenant_local
local login:  operator@local.test / local-development-only
```

These are development credentials. A configured or non-development deployment
fails closed without a strong `seed.admin_password`, and it does not print the
password. An upgraded database can retain an older durable tenant ID to avoid
orphaning extension rows; use the tenant and email printed by that database's
startup banner.

`PORT=8090 go run .` changes the port while remaining on loopback. Listening on
a network interface requires an explicit address:

```bash
PK_HTTP_ADDR=0.0.0.0:8080 GOWORK=off go run .
```

## Confirm readiness and authenticate

```bash
curl -fsS http://127.0.0.1:8080/ready

curl -sS -X POST http://127.0.0.1:8080/api/v1/auth/sessions \
  -H 'Content-Type: application/json' \
  -d '{
    "tenant_id": "tenant_local",
    "email": "operator@local.test",
    "password": "local-development-only"
  }'
```

The login response's `id` is a bearer session:

```bash
curl -fsS http://127.0.0.1:8080/api/v1/tenants \
  -H 'Authorization: Bearer YOUR_SESSION_ID'
```

Open `http://127.0.0.1:8080/admin` for the operator console. The public landing
page does not expose credentials.

## Choose a database

SQLite is the zero-setup default: one file, no server, correct for local
development and small single-node deployments. Point the driver at Postgres when
you are ready to deploy:

```yaml
# config.yaml — its presence selects production, which requires a password
database:
  driver: postgres
  dsn: "postgres://user:pass@host:5432/db?sslmode=require"
```

```bash
export PK_ADMIN_PASSWORD='a-long-random-secret'   # never put this in config.yaml
go run .
```

The binary registers both drivers, so switching engines is configuration, not a
rebuild. This is not a DSN swap dressed up as support: every module store has a
real Postgres adapter, and both adapter sets pass the *same* store conformance
suite — tenant-scoped list, tenant immutability on update, retired rows hidden —
so a missing tenant predicate fails a test on either engine. The Postgres
profile uses a real connection pool; SQLite keeps a single connection because it
is a single-writer engine.

The admin password comes from the environment. The process applies
`PK_ADMIN_PASSWORD` after loading `config.yaml`, so the secret stays out of your
config, your git history, and your image layers.

## The CLI

Running with no subcommand serves, so the quickstart above never changes.
Configuration precedence, lowest to highest: built-in defaults → `config.yaml`
→ environment variables → flags.

```bash
platformkit new app acme            # scaffold your own application
platformkit new module invoice      # add a tenant-scoped module to it
platformkit config init             # commented config.yaml template
platformkit version --json
platformkit modules --json          # the composed module list
platformkit openapi > openapi.json  # the OpenAPI document
```

`modules` and `openapi` compose the real application against a throwaway
in-memory database, so they never create or migrate a deployment database.

## Make it your product

`platformkit new app <name>` writes a Go application that boots this starter and
is ready for your own modules — plus a container image, a Makefile whose
`verify` target is the same gate the kit holds itself to, and an agent pack
(`AGENTS.md`, `llms.txt`) that teaches an AI coding agent the rules for
extending it safely.

```bash
platformkit new app acme && cd acme
platformkit new module invoice
make verify        # go vet + go test -race, including the generated module's tests
go run .           # your app, your name on the console
```

Generated modules register themselves, so adding one never edits `main.go`. Each
ships tenant-scoped queries, per-route scope checks, canonical entity IDs,
append-only migrations, and a test that fails the moment tenant isolation
breaks — the same contract [Extensions](./extensions.md) describes for
hand-written modules.

## What actually ships

The starter composes nine modules: tenant, user, authentication, API key,
audit, content, notification, admin, and health. Product domains, public
storefronts, billing, email delivery, mobile clients, MCP servers, and vertical
workflows are not implicit starter capabilities. Add application-owned
capabilities through the supported
[`starterapp.WithModules`](./extensions.md) seam.

