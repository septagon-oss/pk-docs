---
title: v0.2.0 Module Reference
slug: v0-2-0-module-reference
collection: docs
status: archived
---

> **Historical v0.2.0 documentation.** This page is retained for release research and is not the current OSS contract. Use `docs/current/` and the `septagon-oss/platformkit` README for current setup, credentials, routes, and capabilities.


# v0.2.0 Module Reference

PlatformKit OSS v0.2.0 ships **nine modules** under `pk-modules/pkg/`. Each
module is a self-contained Go package: an entity, a persistence store with a
default SQLite implementation, a `NewModule(opts ...Option)` constructor, an
HTTP handler mountable via `RegisterRoutes(mux *http.ServeMux)`, and optional
admin/health registration. Modules never import each other's concrete types —
they consume the interfaces declared in each module's `ports.go` and the shared
contracts in `pk-modules/pkg/portslib` (`portslib.AdminRegistrar`,
`portslib.HealthRegistrar`, `portslib.NotificationChannel`).

For a visual, navigable view of how these modules connect, see the
[Module Map](./module-map/README.md).

The shape is uniform across all modules:

- **Provides:** the Go interfaces this module exposes (declared in
  `pkmodule.WithProvides` inside `Compose()`).
- **Requires:** interfaces this module consumes. `RequiresPort` deps are
  mandatory; `OptionalPort` deps degrade gracefully when absent.
- **Options:** the functional options accepted by `NewModule`.
- **HTTP surface:** the canonical routes published by `RegisterRoutes`.
- **Admin:** the page and sidebar entry the module registers when an
  `AdminRegistrar` is wired.

A note on version strings: every module declares `ModuleVersion = "0.0.0"` —
this is the *port contract version* used by `pkmodule.Provide[T](ModuleVersion)`
and is distinct from the v0.2.0 release tag.

## `tenant_management` (`pk-modules/pkg/tenant`)

The root of the composition. Every other module's data is scoped to a
`tenant_id`.

| Aspect | Value |
|--------|-------|
| Provides | `tenant.TenantService`, `tenant.TenantContextProvider` |
| Requires | `portslib.AdminRegistrar` (optional), `portslib.HealthRegistrar` (optional) |
| Options | `WithStore`, `WithAdminRegistrar`, `WithHealthRegistrar`, `WithSQLiteDSN`, `WithSQLiteDriver` |
| HTTP surface | `/api/v1/tenants` — `GET` list, `GET /{id}`, `POST` (409 on duplicate slug), `PUT /{id}`, `DELETE /{id}` |
| Admin | page `/admin/tenants` ("Tenants"), entity CRUD for `Tenant` |

`tenant.TenantIsolationEnforcer` is also declared in `ports.go` as the contract
Pro persistence layers implement; the OSS module does not provide it.

## `user_management` (`pk-modules/pkg/user`)

Tenant-scoped users with password credentials. The default password hasher is
**bcrypt** (`passhash.NewBcrypt(passhash.DefaultCost)`); override with
`WithHasher`.

| Aspect | Value |
|--------|-------|
| Provides | `user.UserService`, `user.UserBoundaryReader` |
| Requires | `tenant.TenantService` (optional), `portslib.AdminRegistrar` (optional), `portslib.HealthRegistrar` (optional) |
| Options | `WithStore`, `WithHasher`, `WithTenantService`, `WithAdminRegistrar`, `WithHealthRegistrar`, `WithSQLiteDSN`, `WithSQLiteDriver` |
| HTTP surface | `/api/v1/users` — `GET` list, `GET /{id}`, `POST`, `PUT /{id}`, `DELETE /{id}` |
| Admin | page `/admin/users` ("Users"), entity CRUD for `User` |

`user.UserService` also carries `SetPassword` / `VerifyPassword` (used by the
first-boot seed) and lookups by email/username. `user.UserBoundaryReader` is
the read-only port consumed by auth and notification.
`user.UserBoundaryRoleManager` exists as a placeholder port — roles are minimal
in v0.2.0.

## `auth_management` (`pk-modules/pkg/auth`)

Session-cookie login flow on top of `user_management`. Sessions are 256-bit
`crypto/rand` IDs with a default TTL of 24 hours (`WithSessionTTL` to change).
`NewModule` **fails** without a `WithLoginPolicy` and a `WithUserReader` — both
are mandatory.

| Aspect | Value |
|--------|-------|
| Provides | `auth.AuthService` |
| Requires | `user.UserBoundaryReader` (**required**), `audit.AuditEmitter` (optional), `portslib.AdminRegistrar` (optional), `portslib.HealthRegistrar` (optional) |
| Options | `WithSessionStore`, `WithUserReader`, `WithHasher`, `WithLoginPolicy`, `WithSessionTTL`, `WithAuditEmitter`, `WithAdminRegistrar`, `WithHealthRegistrar`, `WithSQLiteDB`, `WithSQLiteDSN`, `WithSQLiteDriver` |
| HTTP surface | `/api/v1/auth/sessions` — `POST` login (201 → `Session` JSON; 400 bad request, 401 invalid credentials, 403 inactive user, 429 policy denied), `GET /{id}` validate, `DELETE /{id}` logout (204) |
| Admin | page `/admin/auth` ("Authentication"), entity CRUD for `Session` |

The login body is `{"tenant_id": "...", "email": "...", "username": "...",
"password": "..."}` — `tenant_id`, `password`, and one of `email`/`username`
are required.
`auth.LoginPolicy` (`AllowLogin` / `RecordFailure` / `RecordSuccess`) is the
hook hosts use for lockout and rate limiting; the starter app's implementation
is described in the [Security Baseline](./security-baseline.md).

## `api_key_management` (`pk-modules/pkg/apikey`)

Server-to-server keys scoped to a tenant.

| Aspect | Value |
|--------|-------|
| Provides | `apikey.APIKeyService`, `apikey.APIKeyAuthenticator` |
| Requires | `audit.AuditEmitter` (optional), `portslib.AdminRegistrar` (optional), `portslib.HealthRegistrar` (optional) |
| Options | `WithStore`, `WithHasher`, `WithAuditEmitter`, `WithAdminRegistrar`, `WithHealthRegistrar`, `WithSQLiteDSN`, `WithSQLiteDriver` |
| HTTP surface | `/api/v1/api-keys` — `POST` issue (`{"tenant_id","user_id","name","scopes","ttl_seconds"}` → 201 `{"plaintext","key"}`), `GET ?tenant_id=...` list, `DELETE /{id}` revoke. No `GET` by id. |
| Admin | page `/admin/api-keys` ("API keys"), entity CRUD for `APIKey` |

`APIKeyAuthenticator.Middleware()` returns an `http` middleware that attaches
an `identity.Principal` to the request context on a valid bearer token.

## `content_management` (`pk-modules/pkg/content`)

Generic typed content with a publish/unpublish lifecycle.

| Aspect | Value |
|--------|-------|
| Provides | `content.ContentService`, `content.ContentReader`, `content.ContentPublisher` |
| Requires | `tenant.TenantService` (optional), `audit.AuditEmitter` (optional), `portslib.AdminRegistrar` (optional), `portslib.HealthRegistrar` (optional) |
| Options | `WithStore`, `WithTenantService`, `WithAuditEmitter`, `WithAdminRegistrar`, `WithHealthRegistrar`, `WithSQLiteDSN`, `WithSQLiteDriver` |
| HTTP surface | `/api/v1/content` — `GET` list (`tenant_id`, `kind`, `limit`, `offset` query params), `POST`, `GET /{id}`, `PUT /{id}`, `DELETE /{id}`, `POST /{id}/publish`, `POST /{id}/unpublish` |
| Admin | page `/admin/content` ("Content"), entity CRUD for `Content` |

## `notification_management` (`pk-modules/pkg/notification`)

In-app notifications with pluggable channels and per-user subscriptions. The
built-in `in_app` channel (which persists to the store) always runs first;
additional channels register via `WithChannel`. `Severity` is restricted to
`info`, `warning`, `critical`.

| Aspect | Value |
|--------|-------|
| Provides | `notification.NotificationService` |
| Requires | `user.UserBoundaryReader` (optional), `audit.AuditEmitter` (optional), `portslib.AdminRegistrar` (optional), `portslib.HealthRegistrar` (optional) |
| Options | `WithStore`, `WithChannel`, `WithEventBus`, `WithUserReader`, `WithAuditEmitter`, `WithAdminRegistrar`, `WithHealthRegistrar`, `WithSQLiteDSN`, `WithSQLiteDriver` |
| HTTP surface | `/api/v1/notifications` — `GET ?user_id=&limit=&offset=`, `POST` create, `POST /{id}/read` (204); `/api/v1/notification-subscriptions` — `POST` subscribe, `DELETE /{id}` unsubscribe |
| Admin | page `/admin/notifications` ("Notifications"), entity CRUD for `Notification` |

See the [Events Guide](./events-guide.md) for what `WithEventBus` does — and
does not yet do — in v0.2.0.

## `audit_management` (`pk-modules/pkg/audit`)

Append-only, tenant-scoped audit log. Auth, api_key, content, and notification
all accept an `audit.AuditEmitter`; the helper
`audit.EmitterFor(svc, tenantID, actor, severity)` pre-binds provenance so
callers only pass `(action, resource, details)`.

| Aspect | Value |
|--------|-------|
| Provides | `audit.AuditService`, `audit.AuditReader` |
| Requires | `portslib.AdminRegistrar` (optional), `portslib.HealthRegistrar` (optional) |
| Options | `WithStore`, `WithAdminRegistrar`, `WithHealthRegistrar`, `WithSQLiteDSN`, `WithSQLiteDriver` |
| HTTP surface | `/api/v1/audit-events` — `GET` query (`tenant_id`, `actor`, `action`, `since`/`until` in RFC3339, `limit`; malformed values → 400), `POST` record |
| Admin | page `/admin/audit` ("Audit log"), entity CRUD for `Event` |

## `health_management` (`pk-modules/pkg/health`)

Aggregates registered health checkers into `/healthz`. It is the canonical
provider of `portslib.HealthRegistrar`, which bridges to the pk-core
`health.Registrar` (`pk-core/pkg/observability/health`).

| Aspect | Value |
|--------|-------|
| Provides | `portslib.HealthRegistrar`, `health.HealthService` |
| Requires | `portslib.AdminRegistrar` (optional) |
| Options | `WithRegistry`, `WithAdminRegistrar` |
| HTTP surface | `/healthz` — JSON aggregate; unhealthy → 503, healthy/degraded → 200 |
| Admin | page `/admin/health` ("Health") — no entity CRUD |

`/live` and `/ready` are **not** provided by this module — they are pk-runtime
host endpoints. See the [Observability Guide](./observability-guide.md).

## `admin_management` (`pk-modules/pkg/admin`)

The pluggable admin shell. Implements `portslib.AdminRegistrar` through its
embedded `Shell` and renders server-side HTML.

| Aspect | Value |
|--------|-------|
| Provides | `portslib.AdminRegistrar` |
| Requires | nothing (consumes registrations from other modules) |
| Options | `WithTitle` (default "PlatformKit Admin"), `WithBasePath` (default `/admin`) |
| HTTP surface | mounted at `BasePath()`: home page, registered custom pages matched by full path (e.g. `/admin/tenants`), and generated entity routes `<basePath>/<moduleID>/<entity>`, `.../new`, `.../<id>` (list, create form, edit form — the pages call each module's API path via fetch) |

In the starter app the shell is **behind a login wall** — an unauthenticated
visit to `/admin` redirects to `/admin/login`. See the
[Security Baseline](./security-baseline.md) before exposing it.

## How modules are wired together

There is no runtime service locator. The host application (see
`pk-apps/pkg/starterapp`) does plain constructor injection:

1. Construct `admin` and `health` first, and pass their registrars
   (`adminMod.Registrar()`, `healthMod.Registrar()`) into every later module
   via `WithAdminRegistrar` / `WithHealthRegistrar`.
2. Construct data modules in dependency order, handing ports across module
   boundaries (`user.WithTenantService(tenantMod.Service())`,
   `auth.WithUserReader(userMod.Service())`,
   `content.WithAuditEmitter(auditEmitter)`, …).
3. Collect each module's `Compose()` into a `pkmodule.NewBundle` and run
   `pkmodule.NewCatalog().Add(bundle).Build()` — the catalog validates that
   every `RequiresPort` is satisfied by some `Provide` and topologically sorts
   the plan. A missing required port is a **boot-time error**, not a runtime
   surprise.

Direct cross-package imports of another module's concrete types are the bug to
look for in review; the only sanctioned surface is `ports.go` plus `portslib`.
For a worked example of building and composing your own module, see
[Add a module](./add-a-module.md).
