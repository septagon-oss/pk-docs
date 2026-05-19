---
title: v0.0.0 Module Reference
slug: v0-0-0-module-reference
collection: docs
status: published
---

# v0.0.0 Module Reference

The OSS v0.0.0 ships **nine modules** under `pk-modules/pkg/`. Each
module declares the ports it needs and the ports it provides. This page
is the per-module reference: what it does, what it requires, what it
contributes.

The shape is uniform across all modules:

- **Provides:** Go interfaces other modules may depend on.
- **Requires:** Go interfaces this module needs in order to function.
- **Contributes:** registry contributions (admin sections, health
  checks, HTTP routes).
- **Default provider:** what the OSS ships out of the box.

## `tenant_management`

The root of every PlatformKit application. Every other module's data is
scoped to a `tenant_id`. Without `tenant_management`, nothing else
makes sense.

| Aspect | Value |
|--------|-------|
| Provides | `tenant.Lookup`, `tenant.Store` |
| Requires | nothing (foundational) |
| Contributes | `/api/v1/tenants` CRUD, admin entity "Tenant" |
| Default provider | SQLite-backed store |

## `user_management`

Users with a hard tenant boundary. Every user record carries a
`tenant_id`; cross-tenant queries are rejected by the store.

| Aspect | Value |
|--------|-------|
| Provides | `user.Lookup`, `user.Store`, `user.Hasher` |
| Requires | `tenant.Lookup` |
| Contributes | `/api/v1/users`, admin entity "User" |
| Default provider | SQLite store + SHA-256 hasher (replace in Pro) |

## `auth_management`

Sessions, login, and password verification. Calls `user.Lookup` and
`user.Hasher` from `user_management`; never touches the user store
directly.

| Aspect | Value |
|--------|-------|
| Provides | `auth.SessionStore`, `auth.Authenticator` |
| Requires | `user.Lookup`, `user.Hasher` |
| Contributes | `/api/v1/auth/sessions`, login admin page |
| Default provider | SQLite session store, cookie-based session ID |

## `api_key_management`

Server-to-server keys scoped to a tenant. Used by automation and by
the CLI in `pk-tools` when authenticating non-interactively.

| Aspect | Value |
|--------|-------|
| Provides | `apikey.Validator`, `apikey.Store` |
| Requires | `tenant.Lookup` |
| Contributes | `/api/v1/api-keys`, admin entity "APIKey" |
| Default provider | SQLite store, plain comparison (replace in Pro) |

## `content_management`

Generic typed content entities with CRUD. A reference of what the OSS
considers a "content module" — Pro typically replaces it with a
domain-specific one.

| Aspect | Value |
|--------|-------|
| Provides | `content.Store` |
| Requires | `tenant.Lookup` |
| Contributes | `/api/v1/content`, admin entity "Content" |
| Default provider | SQLite store |

## `notification_management`

Outbound notifications. The OSS provider is **in-process**: events go
into a queue that drains synchronously. Pro replaces this with a
durable outbox + worker.

| Aspect | Value |
|--------|-------|
| Provides | `notification.Sender`, `notification.Store` |
| Requires | `user.Lookup` |
| Contributes | `/api/v1/notifications`, admin entity "Notification" |
| Default provider | SQLite store, in-process sender |

## `audit_management`

Append-only audit log. Other modules call `audit.Recorder` to record
state-changing events; the log never deletes or rewrites rows.

| Aspect | Value |
|--------|-------|
| Provides | `audit.Recorder`, `audit.Reader` |
| Requires | nothing (foundational) |
| Contributes | `/api/v1/audit-events` (read-only), admin "Audit Log" |
| Default provider | SQLite append-only store |

## `health_management`

Aggregates per-module health probes into `/healthz` and `/ready`. Every
module that wants to report health implements `health.Probe` and
contributes it through the registry.

| Aspect | Value |
|--------|-------|
| Provides | `health.Aggregator` |
| Requires | nothing (foundational) |
| Contributes | `/healthz`, `/ready`, `/live` |
| Default provider | in-process aggregator |

## `admin_management`

The admin shell. Renders the sidebar from registry-contributed
sections and wires generic entity CRUD pages. Lives last in the
compose order because every other module contributes to it.

| Aspect | Value |
|--------|-------|
| Provides | `admin.Registrar`, `admin.PageRenderer` |
| Requires | nothing (consumes registry contributions) |
| Contributes | `/admin` HTML routes, login redirect |
| Default provider | server-rendered HTML using `pk-design` tokens |

## How modules are wired together

Every module's `Compose(registry)` is called exactly once. The
**registry** is the only object they share. Inter-module communication
at runtime happens through:

1. **Ports** for synchronous calls (one module imports the other's
   declared interface and gets a concrete provider via the registry).
2. **Audit + notifications** for asynchronous side-channels.
3. **Admin contributions** for UI composition.

Direct cross-package imports between modules are forbidden by the
`pk-core` architecture fitness tests. If you see one in a PR, treat it
as a bug.
