---
title: Starter SaaS Tutorial (v0.0.0)
slug: v0-0-0-starter-saas-tutorial
collection: docs
status: published
---

# Starter SaaS Tutorial

This is the canonical "run it first" path for PlatformKit OSS v0.0.0.
The `starter-saas` app at `pk-apps/apps/starter-saas` boots a runnable
PlatformKit application with all nine OSS modules, a SQLite store, and
default credentials. It exists so you can see a real, composed system
running before you write any code.

## Prerequisites

- Go 1.22 or newer (the OSS go.mod files pin a recent toolchain).
- `git`.
- A free TCP port — by default `:8080`.
- No external services. The default store is a local SQLite file.

## Step 1 — clone the workspace

```bash
git clone https://github.com/septagon-oss/septagon-oss-workspace
cd septagon-oss-workspace/pk-apps/apps/starter-saas
```

The OSS workspace is a Go workspace (`go.work` at the root). The
`starter-saas` directory is a regular Go module inside it — running
`go run .` works without any further configuration.

## Step 2 — run

```bash
go run .
```

The first build takes 30-60 seconds while Go fetches dependencies and
compiles the nine modules. Subsequent runs are near-instant.

On a successful boot you will see a banner like:

```
PlatformKit Starter SaaS
  admin: http://localhost:8080/admin
  default credentials: admin@local.test / changeme
  api:   http://localhost:8080/api/v1
```

The SQLite file lives at `./starter-saas.db`. Delete it to start over
with a fresh tenant and admin user.

## Step 3 — explore the admin UI

Open `http://localhost:8080/admin` in a browser. You should see:

- A **sidebar** with sections contributed by each module: Tenants,
  Users, Audit Log, Content, Notifications, API Keys.
- A **dashboard** with widgets contributed by `admin_management`,
  `health_management`, and `audit_management`.
- A **login form** if you log out.

Log in with `admin@local.test / changeme`. The user lives inside the
`Acme Inc` tenant; switching tenant is a stretch goal for v0.0.1.

## Step 4 — explore the API

```bash
curl http://localhost:8080/api/v1/tenants | jq
curl http://localhost:8080/api/v1/users?tenant_id=acme | jq
curl http://localhost:8080/healthz | jq
curl http://localhost:8080/metrics  | jq
```

The CRUD endpoints follow the OSS API contracts described in
`pk-core/pkg/entity/crud`. Health and metrics live at the runtime
level and are described in
[Observability Guide](./observability-guide.md).

## Step 5 — read the composition

The whole composition fits in one file:
`pk-apps/apps/starter-saas/app.go`. The interesting structure is:

```go
modules := []pkcore.ModuleID{
    "tenant_management",
    "user_management",
    "auth_management",
    "api_key_management",
    "content_management",
    "notification_management",
    "audit_management",
    "health_management",
    "admin_management", // last, because everyone contributes to it
}

bundle := pkmodule.NewBundle(
    tenant.New(...).Compose,
    user.New(...).Compose,
    auth.New(...).Compose,
    // ... and so on
)
```

`buildApp` opens **one** shared `*sql.DB` over the SQLite file and builds
every data module on it: each module's store is created with `sqlite.New(db)`
and passed in via `WithStore(...)`, alongside the shared admin/health
registrars (auth takes the handle directly via `WithSQLiteDB(db)`). They all
share the single connection pool, so the schema each store creates at
construction is visible to every later query — the fresh-database first-run
guarantee. There is no hidden wiring, and no module opens its own pool.

## Step 6 — change something

The fastest "I've understood the model" exercise:

1. Open `app.go` and **remove** `content_management` from the bundle
   plus its admin registration.
2. Run `go run .`. The app boots; the Content sidebar entry vanishes
   from the admin UI.
3. Add it back.

Because every module owns its registry contributions, removing one is
the same as removing one line from a slice. Nothing else cares.

## Step 7 — swap a provider

Try this swap (it is the same swap we use as the canonical
Pro extension example):

1. In `app.go`, find the call to `user.New(...)`.
2. Add an option `user.WithHasher(myHasher{})` where `myHasher` is a
   five-line implementation of the `user.Hasher` interface that just
   wraps Go's `crypto/sha256`.
3. Run `go test ./...` — the `user_management` tests will still pass
   because they test against the interface, not the SHA-256 default.

This is the entire Pro provider-swap pattern, exercised in dev.

## Where to go next

- Read [Extension Guide](./extension-guide.md) for the three legitimate
  extension axes.
- Read [Module Reference](./module-reference.md) for what each module
  provides and requires.
- Read [Architecture](./architecture.md) for the framework formula.

## Common issues

| Symptom | Fix |
|---------|-----|
| `bind: address already in use` | Another process holds `:8080`. Set `HTTP_PORT=8081 go run .`. |
| `database is locked` | A previous `go run .` is still running. Kill it. |
| `unauthorized` on every API call | Most CRUD requires a session cookie. Log in via `/admin` first, or pass a session header you obtained from `POST /api/v1/auth/sessions`. |
| `module catalog conflict` | Two modules tried to register the same ID. Inspect the panic — it names the offender. |
