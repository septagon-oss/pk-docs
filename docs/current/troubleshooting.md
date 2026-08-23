---
title: Troubleshooting
slug: current-troubleshooting
collection: guides
group: Reference
order: 70
status: published
description: The things that most often go wrong in the first hour — port clashes, old Go versions, passwords that "don't work", 400s and 403s from the API — each with the exact message you will see and the fix.
---

# Troubleshooting

Each entry starts with what you actually see on screen, so you can match it
by eye. If your problem is not here,
[open a docs issue](https://github.com/septagon-oss/pk-docs/issues/new) with
the command you ran and the output — the message is usually enough to fix both
your problem and this page.

## Starting the server

### `go: cannot find main module` or `package … is not in std`

You ran `go run .` outside the cloned directory. Either `cd platformkit`
first, or use the clone-free form:

```bash
go run github.com/septagon-oss/platformkit@latest
```

### `go.mod requires go >= 1.26`

Your Go is too old. Install the current release from
[go.dev/dl](https://go.dev/dl/) and check `go version` prints `go1.26` or
later.

### `go: inconsistent vendoring` or unexpected workspace errors

You cloned PlatformKit inside a directory that has a `go.work` file. Run it
outside the workspace:

```bash
GOWORK=off go run .
```

### `platformkit: listen: listen tcp 127.0.0.1:8080: bind: address already in use`

Something else owns port 8080. Pick another loopback port:

```bash
PORT=8090 go run github.com/septagon-oss/platformkit@latest
```

…and use `8090` in every URL.

### The banner prints, but a browser on another machine cannot connect

That is the default. The listener is loopback-only until you ask for more:

```bash
PK_HTTP_ADDR=0.0.0.0:8080 platformkit
```

Before you do, read [Going beyond localhost](./quickstart.md#going-beyond-localhost)
— a development instance has a built-in password and must not be exposed.

### `seed.admin_password is required when environment is "production"`

A `config.yaml` is present, which means production, which requires a real
password. Supply it through the environment, never in the file:

```bash
export PK_ADMIN_PASSWORD='a-long-random-secret'
platformkit
```

If you only wanted a local development run, delete or rename `config.yaml`.

### The server starts but the banner shows a different tenant ID or email

You are running against a database that was created by an older release and
upgraded. It keeps its durable tenant and user IDs so rows in your own modules
are not orphaned. **Use exactly what the banner prints** — it is always right
for that `pk.db`. To start fresh, stop the server and delete `pk.db`.

## Logging in

### "Invalid credentials" in the console with the documented password

Check, in order:

1. Is the **Tenant ID** field `tenant_local` (or whatever your banner says)?
   The login is scoped by tenant.
2. Did you change the password through the console earlier? In development
   mode the built-in password is re-asserted on every restart, so restart the
   server and try `local-development-only` again.
3. Are you pointing at the right port? Two servers on two ports have two
   separate databases.

### After logging in I land on "Set up your workspace" instead of the overview

That is the branding module's first-login setup — expected on a fresh
database. Fill it in or click **Skip for now**; either way it is recorded and
you will not be asked again. It is editable later under **Admin → Branding**.

### `429` from `POST /api/v1/auth/sessions`

Login is throttled after repeated failures. Wait a minute and retry with the
right password.

## Calling the API

Match the status code first, then the message.

| You see | It means | Fix |
|---|---|---|
| `401` with no body | No usable credential | Send `Authorization: Bearer <session id or pk_ key>`; make sure the session has not expired (24 h) or been revoked |
| `auth: invalid credentials` (`401`) | Wrong tenant, email/username, or password | Use the banner's values; the tenant must match the user |
| `forbidden: <scope> scope required` (`403`) | Your API key lacks that scope | Issue a key with the scope, or use an admin session |
| `invalid JSON: json: unknown field "…"` (`400`) | A field the schema does not know — often a typo, or a field the server owns like `tenant_id` | Remove it; server-owned fields are set for you |
| `invalid JSON: request body must contain exactly one JSON value` (`400`) | Trailing content after the JSON object | Send exactly one JSON value |
| `content: kind is required` (`400`) | Required field missing | `kind`, `slug`, `title` are required for content; `title`, `body` for notifications; `email`, `username` for users; `name` for API keys |
| `invalid pagination: limit must be a positive integer` (`400`) | `limit` ≤ 0 or not a number | Use a positive `limit` and a non-negative `offset` |
| `entity id must be one canonical opaque path segment …` (`400`) | You put the raw id in the path | Hex-encode it and prefix `id-` — see [entity identifiers in paths](./api-contract.md#entity-identifiers-in-paths) |
| `apikey: unknown scope "…"; allowed scopes: …` (`400`) | Typo in a scope, or the module that declares it is not composed | Pick from the allowed list in the message |
| `apikey: scope "admin" is reserved for interactive authorization` (`400`) | API keys cannot hold `admin` or `console:access` | Use a session for interactive work; give keys resource scopes |
| `… not found` (`404`) | The id does not exist in **your** tenant | Another tenant's id deliberately looks identical to a missing one |
| `413` | Body over 1 MiB | Send less; upload binaries through a purpose-built route (the branding logo form, for example) |

### I created a notification but nothing appeared in the app

Correct — the starter stores and administers notifications; it does not
render a bell, toast, or email. See
[Runtime surfaces](./runtime-surfaces.md#where-notification-creation-lands).

### I published content but there is no public page

Also correct, for the same reason:
[Runtime surfaces](./runtime-surfaces.md#where-content-creation-lands).

## Building your own module

### `make verify` fails on a fresh `platformkit new app`

Check `go version` ≥ 1.26 and that you are inside the generated directory.
The generated tests need no network and no database server; if they fail on
a clean scaffold, please
[open an issue on platformkit](https://github.com/septagon-oss/platformkit/issues/new)
with the output.

### My module's routes return `403` even with a valid API key

The perimeter resolved the key (so it is not `401`), but your handler checks a
scope the key does not hold. Two things to verify:

1. The scope is declared in `ModulePlugin.APIKeyScopes` (otherwise keys
   cannot be issued with it).
2. The handler calls `portslib.RequestActor` *and* checks
   `principal.HasScope("admin") || principal.HasScope("<yours>")`.

See [the ten rules](./extensions.md#3-the-ten-rules-and-what-breaks-if-you-skip-one).

### My by-id route returns `400` for ids that exist

You are comparing the raw id. Decode the path with
`portslib.EntityIDFromPath(r.URL.Path, "/api/v1/<resource>")` as the generated
module does; callers must send the canonical `id-<hex>` segment.

## Still stuck?

- [Troubleshooting a docs mismatch](https://github.com/septagon-oss/pk-docs/issues/new)
  — if this site said one thing and the software did another, that is a docs
  bug we want to hear about.
- [PlatformKit discussions](https://github.com/septagon-oss/platformkit/discussions)
  for questions.
- [Security policy](https://github.com/septagon-oss/platformkit/blob/main/SECURITY.md)
  for anything sensitive — please do not open a public issue for those.
