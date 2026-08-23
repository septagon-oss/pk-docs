---
title: Quickstart
slug: current-quickstart
collection: guides
group: Start here
order: 20
status: published
description: Run PlatformKit with one command, log in to the operator console, call the API, and create your first record — about fifteen minutes, no Docker, no database server.
---

# Quickstart

This guide takes you from nothing to a running multi-tenant backend with an
operator console and an API you have called yourself. Every command shows the
output you should see, so you always know whether you are on track.

The executable contract is the public
[`septagon-oss/platformkit`](https://github.com/septagon-oss/platformkit)
repository. Anything version-named elsewhere in these docs is historical.

![The PlatformKit operator console overview: a dark sidebar listing Tenant, Branding, Users, API keys, Content, Notifications, System health, and Audit log; the main panel reads "Know what is running. Operate what matters." with an Operational status badge.](../assets/screenshots/admin-overview.png "Where you will be in fifteen minutes: the operator console that ships with the starter, running on your machine.")

## What you need

| Requirement | Why | Check |
|---|---|---|
| **Go 1.26 or newer** | PlatformKit is a single Go binary | `go version` → `go version go1.26.x …` or later |
| Internet access on first run | Go downloads the modules once, then caches them | — |
| A free TCP port (8080 by default) | The server listens on loopback | `PORT=8090` changes it |

That is the whole list. **No Docker, no Node.js, no C compiler, no database
server.** The default starter uses SQLite through a pure-Go driver, so nothing
else has to be installed.

> [!TIP]
> Don't have Go? Install it from [go.dev/dl](https://go.dev/dl/) — it is a
> single download. On macOS `brew install go` also works.

## 1. Run it

The stable way, no clone required. `@latest` resolves the newest release
through the Go module proxy:

```bash
go run github.com/septagon-oss/platformkit@latest
```

Or clone when you want the source to read or extend:

```bash
git clone https://github.com/septagon-oss/platformkit
cd platformkit
go run .
```

The first run downloads and compiles dependencies (one to two minutes). After
that the process starts in well under a second and prints this banner:

```text
============================================================
 PlatformKit OSS
  listening:    http://127.0.0.1:8080
  admin UI:     http://127.0.0.1:8080/admin
  health:       http://127.0.0.1:8080/healthz
  OpenAPI:      http://127.0.0.1:8080/openapi/extensions.json
  local tenant: tenant_local
  local login:  operator@local.test / local-development-only
  modules:      10 composed (admin_management, health_management,
                tenant_management, user_management, audit_management,
                auth_management, api_key_management, content_management,
                notification_management, branding_management)
============================================================

  ⚠  DEVELOPMENT MODE — NOT SAFE TO EXPOSE
     • the local administrator password is built in and is
       RE-ASSERTED on every boot (a changed password reverts).
     • a local tenant + administrator are auto-seeded.
     For any real or network-exposed deployment set
     environment=production and seed.admin_password in config.yaml.
```

Three things to notice:

- **Ten modules composed.** Tenants, users, auth, API keys, audit, content,
  notifications, branding, admin, and health are all running in this one
  process.
- **A local tenant and login were seeded for you.** Keep the terminal open;
  you need those credentials in a moment.
- **The listener is loopback-only.** `127.0.0.1` means only your machine can
  reach it. That is deliberate — see [Going beyond localhost](#going-beyond-localhost).

A SQLite file named `pk.db` appears in the directory you ran from. Delete it
to start completely fresh.

> [!NOTE]
> **Different port?** `PORT=8090 go run github.com/septagon-oss/platformkit@latest`
> keeps everything on loopback but moves it to port 8090. Substitute your port
> in every URL below.

## 2. Look at the landing page

Open <http://127.0.0.1:8080/> in a browser.

![The PlatformKit landing page: a large serif headline "One process. Real product surface." with buttons "Open operator workspace" and "Inspect readiness", and a runtime manifest panel reading "10 modules composed".](../assets/screenshots/landing.png "The public landing page. It explains what is running without leaking credentials.")

This page is safe to show anyone: it describes the running surface but never
prints the login. The credentials only appear in your terminal.

## 3. Log in to the operator console

Click **Open operator workspace**, or go to <http://127.0.0.1:8080/admin>.
The tenant and email are prefilled; type the password from the banner:

| Field | Value |
|---|---|
| Tenant ID | `tenant_local` |
| Email | `operator@local.test` |
| Password | `local-development-only` |

![The operator login page: a dark left panel reading "Run the work. Keep the context." and a form with Tenant ID prefilled as tenant_local, Email prefilled as operator@local.test, an empty Password field, and a lime "Enter operator workspace" button.](../assets/screenshots/admin-login.png "The login form prefills the tenant and email for a development database.")

> [!NOTE]
> **Upgraded an older database?** It may keep an earlier tenant ID so that
> rows in your own modules are not orphaned. Use whatever tenant and email the
> startup banner printed — the banner is always right for *that* database.

### First login: name your workspace (or skip)

The first time an administrator signs in, the branding module asks for a
workspace name, brand colour, and logo. You can fill it in now or click
**Skip for now** — everything is editable later under **Admin → Branding**.

![The first-login setup page titled "Set up your workspace" with fields for workspace name, a brand colour choice between default palette and custom colour, a font select, a logo upload, and Save and "Skip for now" buttons.](../assets/screenshots/admin-first-login-branding.png "The one-time branding setup. Skipping is fine; it does not block anything.")

### You are in

After that you land on the overview. The sidebar is the map of the whole
starter — each entry is one of the ten modules.

![The operator console overview page after login, with the sidebar sections Workspace (Tenant, Branding), Access (Users, API keys), Publishing (Content), and Operations (Notifications, System health, Audit log), and a header showing user_operator on tenant_local with a Sign out button.](../assets/screenshots/admin-overview.png "The overview. The sidebar groups the ten modules into Workspace, Access, Publishing, and Operations.")

Click around — **Users** shows the seeded operator, **System health** shows
every module store reporting healthy, **Audit log** already contains your
login. The console is fully responsive; on a phone the sidebar folds into a
menu.

## 4. Call the API

Now do the same things from the command line. Open a second terminal and
leave the server running in the first.

### Check readiness (no login needed)

```bash
curl -fsS http://127.0.0.1:8080/ready
```

```json
{"status":"ok","checked_at":"2026-08-23T06:30:58Z","results":[{"id":"runtime.modules","module_id":"runtime","critical":true,"status":"ok","message":"module plan composed","duration":6292,"details":{"modules":"10"}}]}
```

`/healthz`, `/live`, and `/ready` are public so an orchestrator can probe them.
Everything under `/api/v1/` requires a credential.

### Log in and get a session

```bash
curl -sS -X POST http://127.0.0.1:8080/api/v1/auth/sessions \
  -H 'Content-Type: application/json' \
  -d '{
    "tenant_id": "tenant_local",
    "email": "operator@local.test",
    "password": "local-development-only"
  }'
```

```json
{
  "id": "uNsf4AniF9sBzs_QgSGAuwSZYCXCapG_6lW3UZtIL5o",
  "user_id": "user_operator",
  "tenant_id": "tenant_local",
  "issued_at": "2026-08-23T06:31:09Z",
  "expires_at": "2026-08-24T06:31:09Z"
}
```

The `id` is your **session token**. Yours will be a different random string.
Save it in a shell variable so you can paste it into the next commands:

```bash
SID='paste-the-id-value-here'
```

> [!TIP]
> One line, if you have `jq` installed:
> ```bash
> SID=$(curl -sS -X POST http://127.0.0.1:8080/api/v1/auth/sessions \
>   -H 'Content-Type: application/json' \
>   -d '{"tenant_id":"tenant_local","email":"operator@local.test","password":"local-development-only"}' | jq -r .id)
> ```

### Use the session as a bearer token

```bash
curl -fsS http://127.0.0.1:8080/api/v1/tenants \
  -H "Authorization: Bearer $SID"
```

```json
[{"id":"tenant_local","slug":"local","name":"Local Workspace","created_at":"2026-08-23T06:30:54Z","updated_at":"2026-08-23T06:30:54Z"}]
```

You only ever see *your* tenant. The API never asks "which tenant?" — it
derives it from the credential.

### See what "fail closed" looks like

Try the same call without the header:

```bash
curl -sS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8080/api/v1/tenants
```

```text
401
```

And try a malformed page size:

```bash
curl -sS -w "\nHTTP %{http_code}\n" "http://127.0.0.1:8080/api/v1/users?limit=-1" \
  -H "Authorization: Bearer $SID"
```

```text
invalid pagination: limit must be a positive integer
HTTP 400
```

Errors are short plain-text messages; the status code carries the meaning.
The [API contract](./api-contract.md) lists every rule.

## 5. Create something and watch it appear in the console

Create a content record. `kind`, `slug`, and `title` are required:

```bash
curl -sS -X POST http://127.0.0.1:8080/api/v1/content \
  -H "Authorization: Bearer $SID" \
  -H 'Content-Type: application/json' \
  -d '{"kind":"page","slug":"welcome","title":"Welcome","body":"Hello from PlatformKit"}'
```

```json
{
  "id": "1787466721729910452-tenant_local-welcome",
  "tenant_id": "tenant_local",
  "kind": "page",
  "slug": "welcome",
  "title": "Welcome",
  "body": "Hello from PlatformKit",
  "body_format": "markdown",
  "author_id": "user_operator",
  "created_at": "2026-08-23T06:32:01Z",
  "updated_at": "2026-08-23T06:32:01Z"
}
```

Notice what the server filled in for you: the `id`, the `tenant_id`, the
`author_id`, and the timestamps. You cannot set those from the body; the
server owns them.

Now refresh **Admin → Content** in the browser:

![The Content page in the operator console listing one record, "Welcome", of kind page and slug welcome, with Edit, Unpublish, and Delete actions, a filter box, and pagination controls.](../assets/screenshots/admin-content.png "The record you just created over the API, already manageable in the console.")

The same record, two surfaces — the JSON API and the operator console are
views of one tenant-scoped store. Every other module works the same way.

> [!IMPORTANT]
> Publishing the record (`POST …/content/{id}/publish`) flips its lifecycle
> state and the console shows it as published. It does **not** create a public
> web page — choosing a URL scheme, template, and audience is your product's
> job. [Runtime surfaces](./runtime-surfaces.md) explains exactly where each
> module stops.

That is the quickstart. You have run the starter, used the console, called the
API, and proven tenant scoping and server-owned identity with your own hands.

---

## Where to go next

| You want to… | Read |
|---|---|
| Understand the big picture before going further | [What is PlatformKit?](./overview.md) |
| Add your own module with routes, migrations, and tests | [Build a secure extension](./extensions.md) |
| Know every rule the API enforces, with status codes | [API contract](./api-contract.md) |
| Know what the starter does *not* do, on purpose | [Runtime surfaces](./runtime-surfaces.md) |
| Something did not match this page | [Troubleshooting](./troubleshooting.md) |

The rest of this page covers the knobs you will reach for soon after.

## Get the `platformkit` command

`go run …@latest` is fine for serving, but the CLI subcommands are handier with
a real binary on your `PATH`:

```bash
go install github.com/septagon-oss/platformkit@latest
platformkit version
```

```text
platformkit v0.15.1 (api 0.6.0, go1.26.0)
```

Running with no subcommand serves, so `platformkit` alone is the same as the
quickstart. Configuration precedence, lowest to highest: built-in defaults →
`config.yaml` → environment variables → flags.

```bash
platformkit --port 9090              # serve on another loopback port
platformkit modules --json           # the composed module list
platformkit openapi > openapi.json   # extension operations as OpenAPI 3.1
platformkit config init              # write a commented config.yaml
platformkit new app acme             # scaffold your own application
platformkit new module invoice       # add a tenant-scoped module to it
platformkit --help                   # every flag and environment variable
```

`modules` and `openapi` compose the real application against a throwaway
in-memory database, so they never create or migrate `pk.db`.

## Choose a database

SQLite is the zero-setup default: one file, no server, right for local
development and small single-node deployments. Point the driver at Postgres
when you are ready to deploy:

```yaml
# config.yaml — its presence selects production, which requires a password
database:
  driver: postgres
  dsn: "postgres://user:pass@host:5432/db?sslmode=require"
```

```bash
export PK_ADMIN_PASSWORD='a-long-random-secret'   # never put this in config.yaml
platformkit
```

The binary registers both drivers, so switching engines is configuration, not
a rebuild. Nine of the ten module stores have a real Postgres adapter, and both
adapter sets pass the *same* store conformance suite — tenant-scoped list,
tenant immutability on update, retired rows hidden — so a missing tenant
predicate fails a test on either engine.

> [!WARNING]
> **Known gap (v0.15):** the new branding module has no Postgres adapter yet.
> A Postgres deployment composes the other nine modules with stock chrome, and
> refuses to boot if branding seed values are configured — the gap is loud,
> not silent.

The admin password comes from the environment. The process applies
`PK_ADMIN_PASSWORD` after loading `config.yaml`, so the secret stays out of
your config, your git history, and your image layers.

## Going beyond localhost

Listening on a network interface requires an explicit address — `PORT` alone
never does it:

```bash
PK_HTTP_ADDR=0.0.0.0:8080 platformkit
```

> [!CAUTION]
> Never expose a development-mode instance. The development password is
> built in and re-asserted on every boot. For anything reachable by others,
> run `platformkit config init`, set `environment: production`, and supply
> `PK_ADMIN_PASSWORD`. A configured deployment fails closed without a strong
> password and never prints it.

## Make it your product

`platformkit new app <name>` writes a Go application that boots this starter
and is ready for your own modules — plus a container image, a Makefile whose
`verify` target is the same gate the kit holds itself to, and an agent pack
(`AGENTS.md`, `llms.txt`) that teaches an AI coding agent the rules for
extending it safely.

```bash
platformkit new app acme && cd acme
platformkit new module invoice
make verify        # go vet + go test -race, including the generated module's tests
go run .           # your app, your name on the console
```

Generated modules register themselves, so adding one never edits `main.go`.
Each ships tenant-scoped queries, per-route scope checks, canonical entity IDs,
append-only migrations, and a test that fails the moment tenant isolation
breaks — the same contract [Build a secure extension](./extensions.md)
describes for hand-written modules.

## What actually ships

The starter composes exactly these ten modules:

| Module | What it gives you | Admin page |
|---|---|---|
| `tenant_management` | Isolation in stores and request identity; read/update/delete of *your* tenant | Tenant |
| `user_management` | Tenant-scoped user records and password lifecycle | Users |
| `auth_management` | Browser sessions and bearer-session resolution | — (login page) |
| `api_key_management` | One-time plaintext keys with explicit machine scopes | API keys |
| `audit_management` | Append-only operational events and a query API | Audit log |
| `content_management` | Stored content with a draft → publish lifecycle | Content |
| `notification_management` | Tenant/user-scoped in-app notification records and subscriptions | Notifications |
| `branding_management` | Tenant logo and palette with WCAG-corrected derivation; first-login setup | Branding |
| `admin_management` | The responsive, schema-aware operator console itself | Overview |
| `health_management` | Module health plus runtime liveness/readiness and protected metrics | System health |

Product domains, public storefronts, billing, email delivery, mobile clients,
MCP servers, and vertical workflows are **not** implicit starter capabilities.
Add application-owned capabilities through the supported
[`starterapp.WithModules`](./extensions.md) seam.
