---
title: Glossary
slug: current-glossary
collection: guides
group: Reference
order: 80
status: published
description: Plain-language definitions of the words these guides use — tenant, scope, session, API key, module, starter, seam, canonical segment, conformance suite, and the rest.
---

# Glossary

Short definitions, in the order you are likely to meet them. Each links to
the guide that explains it properly.

## Tenancy and identity

**Tenant** — The isolation unit. Every stored row belongs to exactly one
tenant, every request acts on behalf of exactly one tenant, and queries are
scoped by it. The development database seeds `tenant_local`.
→ [Quickstart](./quickstart.md#3-log-in-to-the-operator-console)

**Subject** — The user (or API-key owner) a request acts as. Together with the
tenant it is the *actor*. Resolved from the credential by
`portslib.RequestActor`; never read from the request body.
→ [Build a secure extension](./extensions.md)

**Principal** — The resolved credential with its capabilities, available in
the request context (`identity.PrincipalFromContext`). Answers
`HasScope("…")`.

**Session** — The credential a person gets by logging in: a random id returned
by `POST /api/v1/auth/sessions` (or set in the `pk_session` cookie by the
console). Sent as `Authorization: Bearer <id>`. Expires after 24 hours.
→ [API contract](./api-contract.md#sessions-people)

**API key** — The credential a machine gets: `pk_…`, shown once at issue time,
holding explicit scopes. Also sent as a bearer token. Cannot hold `admin` or
`console:access`.
→ [API contract](./api-contract.md#api-keys-machines)

**Scope / capability** — A named permission such as `content:read` or
`users:write`. Built-in resources define `<resource>:read` and
`<resource>:write`; modules declare their own in `APIKeyScopes`. `admin` and
`console:access` are reserved interactive capabilities.
→ [API contract](./api-contract.md#built-in-machine-scopes)

**Fail closed** — The default answer is "no": anonymous → `401`, missing scope
→ `403`, another tenant's id → `404`, malformed input → `400`. Nothing is
permitted by omission.
→ [API contract](./api-contract.md#the-shape-of-every-request)

**Server-owned identity** — Ids, tenant, author/owner, and timestamps are set
by the server on write. Values you send for them are ignored.

## Composition

**Module** — A Go package that owns one capability: a store on the shared
database, routes, declared scopes, embedded migrations, optional admin pages,
and tests. The starter composes ten; you add more.
→ [What is PlatformKit?](./overview.md)

**Starter (`starterapp`)** — The one canonical composition of the ten
reference modules, in `pk-apps/pkg/starterapp`. `go run .` in the
`platformkit` repository runs it.

**Front door** — The `septagon-oss/platformkit` repository: the domain-neutral
binary and CLI that runs the starter and pins the released set.

**Released set** — The repositories tagged and boot-tested together:
`platformkit`, `pk-apps`, `pk-modules`, `pk-core`, `pk-shared`, `pk-runtime`.
The only thing you depend on directly.
→ [What is PlatformKit?](./overview.md#how-the-repositories-fit-together)

**Seam (`starterapp.WithModules`)** — The one supported way to add your own
modules to the starter. They join the same database pool, identity perimeter,
admin, health, and OpenAPI discovery as the built-ins.
→ [Build a secure extension](./extensions.md)

**`ModuleEnv.DB`** — The starter's shared `*sql.DB` handed to your module.
SQLite or Postgres depending on configuration.

**`ModulePlugin`** — What your module returns: its id, `RegisterRoutes`,
`APIKeyScopes`, `OpenAPI` operations, and optional extras.

**Conformance suite** — The shared test suite every module store must pass on
both SQLite and Postgres: tenant-scoped list, tenant immutability on update,
retired rows hidden. A missing tenant predicate fails it on either engine.

**Append-only migration** — A SQL file embedded in the module, applied once
and recorded by filename, never edited after shipping. New changes are new
files.

## Surfaces and HTTP

**Perimeter** — The HTTP layer every `/api/v1` route sits behind: credential
resolution, the anonymous-mutation gate, the 1 MiB body cap, canonical-id
path decoding.
→ [API contract](./api-contract.md)

**Operator console / admin** — The server-rendered workspace at `/admin`,
built by `admin_management` from the design system. It is for operators, not
your end users.
→ [Runtime surfaces](./runtime-surfaces.md)

**Runtime surface** — Where a capability is reachable from: API, admin, public
page, health probe. The starter provides API + admin for stored records and
deliberately no end-user presentation.
→ [Runtime surfaces](./runtime-surfaces.md)

**Canonical segment (`id-<hex>`)** — How an entity id travels in a URL path:
the literal `id-` followed by the lowercase hex of the id's bytes. Raw ids
return `400`.
→ [API contract](./api-contract.md#entity-identifiers-in-paths)

**Slug** — A human-readable handle (`welcome`, `local`). Never hex-encoded;
used by routes that address things by name.

**Lifecycle** — A record's state transitions, such as content draft →
published → unpublished. Exposed as actions (`POST …/publish`) that return
`204`.

**Stored vs displayed** — A record being persisted and administered is not the
same as it being shown to end users. Bells, toasts, emails, and public pages
are product features you build.
→ [Runtime surfaces](./runtime-surfaces.md)

## Configuration and operation

**Development mode** — The zero-config default when no `config.yaml` is
present: loopback listener, SQLite, a seeded local tenant and administrator
with a built-in password. Never expose it.
→ [Quickstart](./quickstart.md#going-beyond-localhost)

**Production (fail-closed) configuration** — Selected by the presence of
`config.yaml`. Requires `PK_ADMIN_PASSWORD`; never prints the password.

**`PK_HTTP_ADDR` / `PORT`** — `PORT` moves the loopback listener; only an
explicit `PK_HTTP_ADDR` such as `0.0.0.0:8080` listens on a network interface.

**Probe routes** — `/healthz` (module health), `/live` (process liveness),
`/ready` (module plan composed). Public, for orchestrators.

**Audit event** — An append-only record of something that happened
(`auth.login_success`, `apikey.issued`, `content.published`, …), queryable
through `/api/v1/audit-events` and Admin → Audit log.

## Design system

**Token** — A named design value (`color.accent.default = #0f5d4e`) in
`pk-design`'s `themes.Default()`, rendered to `--pk-*` custom properties.
→ [Design system](./design-system.md#the-palette)

**Utility class** — A single-purpose CSS class (`bg-surface-brand`) produced by
the typed `tw` builder; its CSS is *emitted* from the declaration, never
scanned from source.

**Atom / molecule / organism** — The component tiers in `pk-ui`: primitives
(Button, Badge…), compositions (Table, Pagination…), and whole sections
(`DataGrid`).
→ [Design system](./design-system.md#atoms-molecules-organisms)

**Role variable (`--pk-role-*`)** — The indirection between utility classes
and theme tokens that lets a brand re-theme without touching class CSS.
