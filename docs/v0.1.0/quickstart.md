---
title: Quickstart
slug: v0-1-0-quickstart
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
# Health — returns 200. /healthz reports seven data/session checks; admin and
# health are composed modules without SQLite stores.
curl -s http://localhost:8080/healthz
# → {"status":"healthy"}

# List tenants — returns the seeded Acme Inc tenant.
curl -s http://localhost:8080/api/v1/tenants
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

The seeded values are `tenant_acme` / `admin@local.test` / `changeme`. They are
created (and repaired) on every boot, so a half-finished first run can't strand
the login.

## Honest caveat: `/admin` is an open dashboard

The admin UI at `/admin` is **not** behind a login wall today. The seeded
`admin@local.test` / `changeme` credentials authenticate against the **auth API**
(`POST /api/v1/auth/sessions`), not an admin login screen. Anyone who can reach
the port can open `/admin`. That is fine for local development; put it behind
your own auth before exposing it.

## Gotchas

- **Port 8080 busy?** The front door binds `:8080` and ships no config file. To
  change it, run the full starter in pk-apps (`pk-apps/apps/starter-saas`, which
  reads `http.addr` from its `config.yaml`) or change the address in the
  wrapper's `main.go`.
- **First build is slow, then fast.** The first `go run` downloads modules and
  compiles (tens of seconds). After that, startup is about two seconds.
- **Reset to a clean slate.** The SQLite file `pk.db` is created in the working
  directory and is gitignored. Delete it to reset; the seed rebuilds a clean
  tenant and admin user on the next boot.

## Verified scope

This path is verified on Linux/x86_64, Go 1.26, `modernc.org/sqlite v1.50.1`,
the default `/admin` base path, and a fresh database. This is an early release
(v0.1.0 — our first public release; expect APIs to move); pin a commit if you
need stability today.

---

Next → [add-a-module.md](add-a-module.md) — build your own module the same way
the nine built-ins are built.
