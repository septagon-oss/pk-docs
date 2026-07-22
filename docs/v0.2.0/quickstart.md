---
title: Quickstart
slug: v0-2-0-quickstart
collection: docs
status: published
---

# Quickstart

**How do I run it right now?**

PlatformKit is an open-source Go backend for multi-tenant SaaS. This page gets a
seeded, running app on your machine. One language, one command, no containers.

## What you need

- **Go 1.26 or newer.** Check with `go version`.
- That is the whole list. No CGO (no C compiler), no npm or Node, no Docker, no
  external database. The default store is SQLite via a pure-Go driver
  (`modernc.org/sqlite`), so the first run needs nothing but Go.

## Run it

```bash
git clone https://github.com/septagon-oss/platformkit
cd platformkit
go run .
```

That is it. The first run downloads a handful of Go modules and compiles the
app, so expect tens of seconds the first time. Subsequent starts take about two
seconds.

### What each step does

- `git clone …` pulls the thin front-door wrapper; the first `go run .` downloads
  the PlatformKit modules by version from the proxy.
- `cd platformkit` puts you at the repo root.
- `go run .` builds and runs the starter app. On boot it opens a local
  SQLite file (`pk.db` in the working directory), creates the tables, seeds one
  tenant and one admin user, composes nine modules, and serves HTTP on `:8080`.

## What you should see

A startup banner like this:

```
============================================================
 starter-saas — PlatformKit OSS monolith
  listening:    http://localhost:8080
  admin UI:     http://localhost:8080/admin
  health:       http://localhost:8080/healthz
  metrics:      http://localhost:8080/metrics
  default login: admin@local.test / changeme
  modules:      9 composed (admin_management, health_management, tenant_management, user_management, audit_management, auth_management, api_key_management, content_management, notification_management)
============================================================
```

Open `http://localhost:8080/admin` in a browser. You get a server-rendered
admin dashboard with a sidebar and entity links.

### Check it from another shell

```bash
# Health — no auth required. Returns 200. /healthz reports seven data/session
# checks; admin and health are composed modules without SQLite stores.
curl -s http://localhost:8080/healthz
# → {"status":"healthy"}
```

The `/api/v1/*` API **requires authentication**. An anonymous request is
rejected:

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8080/api/v1/tenants
# → 401
```

So log in first to get a session id, then send it as a bearer token:

```bash
# Log in — returns a session whose "id" is your bearer token.
SID=$(curl -s -X POST http://localhost:8080/api/v1/auth/sessions \
  -H 'Content-Type: application/json' \
  -d '{"tenant_id":"tenant_acme","email":"admin@local.test","password":"changeme"}' \
  | jq -r .id)

# List tenants — authenticated. Returns only the caller's own tenant.
curl -s http://localhost:8080/api/v1/tenants -H "Authorization: Bearer $SID"
# → [{"id":"tenant_acme","slug":"acme","name":"Acme Inc",...}]
```

### Log in against the auth API

PlatformKit is multi-tenant, so login requires the tenant. The `tenant_id` field
is **not optional** — omit it and you get a `400`.

```bash
curl -s -X POST http://localhost:8080/api/v1/auth/sessions \
  -H 'Content-Type: application/json' \
  -d '{"tenant_id":"tenant_acme","email":"admin@local.test","password":"changeme"}'
# → 201 Created, returns a session for the seeded admin user
```

The response carries a session `id`; send it back as
`Authorization: Bearer <session-id>` on every `/api/v1/*` call (a session cookie
also works in the browser). An **API key** authenticates the same way —
`Authorization: Bearer <api-key>`, and the key selects its own tenant.
Isolation is enforced: every by-id operation is tenant-scoped, so you only ever
see or mutate your own tenant's data, and a cross-tenant id returns `404`.

The seeded **development** values are `tenant_acme` / `admin@local.test` /
`changeme`. In development mode the seed is self-repairing: the demo password is
re-asserted on every boot (change it and it reverts — the startup banner warns
you about exactly this), which is why development mode must never be exposed to
a network. Production boots require an explicit `seed.admin_password` in config,
never re-assert it afterwards, and refuse to start without one — only
`environment: development` may use the built-in demo password (see
[Configuration](./configuration.md)).

## `/admin` is behind a login wall

The admin UI at `/admin` is **gated**. Visiting it while unauthenticated returns
a `303` redirect to `/admin/login`, a real login page that sets a session
cookie. Sign in with the admin credentials (`admin@local.test` / `changeme` in
development) and you land on the dashboard. Nothing on `/admin` or `/api/v1/*`
is reachable anonymously.

## Gotchas

- **Port 8080 busy?** Set the port with an env var — no code edit:
  `PORT=8090 go run .` (or `PK_HTTP_ADDR=127.0.0.1:8090 go run .` to bind a
  specific interface). The full starter in pk-apps also reads `http.addr` from
  its `config.yaml`.
- **First build is slow, then fast.** The first `go run` downloads modules and
  compiles (tens of seconds). After that, startup is about two seconds.
- **Reset to a clean slate.** The SQLite file `pk.db` is created in the working
  directory and is gitignored. Delete it to reset; the seed rebuilds a clean
  tenant and admin user on the next boot.

## Verified scope

This path is verified on Linux/x86_64, Go 1.26, `modernc.org/sqlite v1.50.1`,
the default `/admin` base path, and a fresh database. This is an early release
(current: v0.2.2 — see the [release notes](./release-notes-v0.2.0.md); expect
APIs to move); pin a tag if you need stability today.

---

Next → the [API Reference](api-reference.md) (OpenAPI spec included) or
[add-a-module.md](add-a-module.md) — build your own module the same way
the nine built-ins are built.
