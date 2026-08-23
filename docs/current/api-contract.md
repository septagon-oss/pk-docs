---
title: API contract
slug: current-api-contract
collection: guides
group: Reference
order: 50
status: published
description: Every rule the built-in API enforces — authentication, scopes, tenant resolution, input validation, status codes, canonical entity ids in paths, and the full endpoint list — with real requests and responses.
---

# API contract

The public starter's built-in API is **tenant-scoped and fail-closed**. This
page is the complete list of rules it enforces, what each one looks like from
the outside, and why it exists. Everything here was exercised against a
running starter; the responses are real.

The canonical operation document is
[`pk-apps/api/openapi.yaml`](https://github.com/septagon-oss/pk-apps/blob/main/api/openapi.yaml).
Application extensions publish their aggregate operation metadata at
`/openapi/extensions.json`.

## The shape of every request

![Request lifecycle with five gates: who are you (401), may you (403), which tenant (404 for another tenant's id), is it well-formed (400 or 413), then do the work (2xx). Only POST /api/v1/auth/sessions is open without a credential.](../assets/diagrams/request-lifecycle.svg "Each gate fails closed; the status code tells you which one stopped you.")

| Status | Meaning | Typical cause |
|---|---|---|
| `200` / `201` | OK / created | success; body is JSON |
| `204` | done, no body | lifecycle actions such as publish, unpublish, mark read, log out, delete |
| `400` | invalid input | unknown JSON field, trailing JSON value, negative `offset`, non-positive `limit`, non-canonical `{id}`, missing required field, unknown or reserved API-key scope |
| `401` | no usable credential | missing or invalid bearer/cookie, wrong password |
| `403` | credential lacks the capability | API key without the needed `<resource>:read/write` scope; a machine credential touching its own owner user |
| `404` | not found | id does not exist — *or belongs to another tenant* |
| `405` | method not allowed | wrong verb on a known route |
| `409` | uniqueness conflict | duplicate slug, email, or username in the tenant |
| `413` | body too large | request body over 1 MiB |
| `429` | throttled | too many failed logins |

Error responses are **plain text**, not JSON. The status code carries the
semantics; the body is a short human-readable reason:

```text
invalid pagination: limit must be a positive integer
forbidden: users:read scope required
content: not found
auth: invalid credentials
```

## The rules

- **Anonymous API access returns `401`.** The only open route under `/api/v1`
  is `POST /api/v1/auth/sessions` (log in). `/healthz`, `/live`, `/ready`,
  `/`, and `/openapi/extensions.json` are public by design.
- **An authenticated credential without the required capability returns `403`.**
- **Tenant and subject come from the verified credential**, not from JSON or
  query parameters. Body-supplied `tenant_id`, `user_id`, and `author_id`
  fields are ignored on writes.
- **Cross-tenant identifiers resolve as not found** (`404`) rather than
  revealing that another tenant's resource exists.
- **Mutating JSON bodies reject** unknown fields, malformed input, trailing
  values, and bodies over 1 MiB.
- **Pagination** uses a positive `limit` and a non-negative `offset`;
  malformed or negative values return `400`.
- **API-key scopes** must be a built-in capability or a scope declared by an
  application module. Typos and interactive-only scopes are rejected at issue
  time.
- **User creation defaults `active` to true.** On update, omitting `active`
  preserves its current value.
- **A machine credential with `users:write` cannot modify or delete its own
  credential-owning user**; that requires the interactive `admin` scope.
- **An entity identifier travels in a path as one canonical opaque segment.**
  A segment that is not canonical returns `400`, not `404`: the request is
  malformed rather than pointing at something absent.

## Two kinds of credential

![Sessions versus API keys: both are bearer tokens in the Authorization header; a session belongs to a person who logged in and carries their capabilities (the seeded operator has admin and console:access); an API key belongs to a machine, is shown once as pk_…, and holds explicit scopes only — never admin.](../assets/diagrams/credentials.svg "Same header, different holders, different powers.")

### Sessions (people)

```bash
curl -sS -X POST http://127.0.0.1:8080/api/v1/auth/sessions \
  -H 'Content-Type: application/json' \
  -d '{"tenant_id":"tenant_local","email":"operator@local.test","password":"local-development-only"}'
```

```json
{"id":"uNsf4AniF9sBzs_QgSGAuwSZYCXCapG_6lW3UZtIL5o","user_id":"user_operator","tenant_id":"tenant_local","issued_at":"2026-08-23T06:31:09Z","expires_at":"2026-08-24T06:31:09Z"}
```

Send the `id` as `Authorization: Bearer <id>`. The browser login page sets the
same session in a `pk_session` cookie, which works equally. `tenant_id` and
`password` are required; identify the user by `email` or `username`.
`DELETE /api/v1/auth/sessions/{id}` logs out (owner only).

The seeded interactive administrator has the reserved `admin` and
`console:access` capabilities, which is why it can do everything in the
examples below.

### API keys (machines)

```bash
curl -sS -X POST http://127.0.0.1:8080/api/v1/api-keys \
  -H "Authorization: Bearer $SID" -H 'Content-Type: application/json' \
  -d '{"name":"ci-reader","scopes":["content:read"]}'
```

```json
{"plaintext":"pk_Nihj-rWojYBwY-5qd7bmL2BgruNfmlV2_sOCNCpZg3s","key":{"id":"trAaNhhr3lpTj4CI","tenant_id":"tenant_local","user_id":"user_operator","name":"ci-reader","prefix":"Nihj-rWojYBw","scopes":["content:read"],"created_at":"2026-08-23T06:31:23Z"}}
```

The `plaintext` is shown **once**. Store it; only the `prefix` is kept
server-side. Use it exactly like a session:

```bash
curl -sS http://127.0.0.1:8080/api/v1/content \
  -H "Authorization: Bearer pk_Nihj-rWojYBwY-5qd7bmL2BgruNfmlV2_sOCNCpZg3s"     # 200, the content list

curl -sS -w "\nHTTP %{http_code}\n" http://127.0.0.1:8080/api/v1/users \
  -H "Authorization: Bearer pk_Nihj-rWojYBwY-5qd7bmL2BgruNfmlV2_sOCNCpZg3s"
```

```text
forbidden: users:read scope required
HTTP 403
```

Optional `ttl_seconds` sets an expiry. Revoke with `DELETE /api/v1/api-keys/{id}`.

### Built-in machine scopes

| Resource | Read | Write |
|---|---|---|
| API keys | `api-keys:read` | `api-keys:write` |
| Audit events | `audit:read` | — (append-only; written by the system) |
| Content | `content:read` | `content:write` |
| Metrics (`/metrics`) | `metrics:read` | — |
| Notifications | `notifications:read` | `notifications:write` |
| Tenants | `tenants:read` | `tenants:write` |
| Users | `users:read` | `users:write` |

Application modules add their own (`invoices:read`, `reservations:write`, …)
by declaring them in `APIKeyScopes` — see
[Build a secure extension](./extensions.md#3-the-ten-rules-and-what-breaks-if-you-skip-one).

`admin` and `console:access` are **interactive-only**. API keys cannot request
them:

```text
apikey: scope "admin" is reserved for interactive authorization
HTTP 400
```

A typo is caught the same way, with the allowed list in the message:

```text
apikey: unknown scope "contnet:read"; allowed scopes: api-keys:read, api-keys:write, audit:read, content:read, content:write, metrics:read, notifications:read, notifications:write, tenants:read, tenants:write, users:read, users:write
HTTP 400
```

## Entity identifiers in paths

Wherever a route contains `{id}`, the value is the canonical segment produced
by `pk-shared/pkg/pathsegment` — the literal prefix `id-` followed by the
lowercase-hex encoding of the identifier's bytes.

![Three steps: the identifier as returned by the API, its lowercase hex bytes, and the id- prefix joined to make one opaque path segment; raw ids, uppercase hex, and percent-escapes return 400.](../assets/diagrams/canonical-id.svg "The identifier is hex-encoded and prefixed so it is always exactly one path segment.")

Encoding the identifier rather than passing it raw means an identifier
containing a slash, a percent escape, or a control character cannot change
which route a request resolves to. Decoding fails closed: raw identifiers,
uppercase hex, percent escapes, and non-canonical aliases are all rejected, so
an entity is reachable by exactly one spelling.

`pk-client` does this for you. Direct callers encode with
`pathsegment.EncodeOpaqueID`, or in any language by hex-encoding the
identifier's UTF-8 bytes and prefixing `id-`:

```bash
ID='1787466721729910452-tenant_local-welcome'
SEGMENT="id-$(printf '%s' "$ID" | od -An -tx1 | tr -d ' \n')"
echo "$SEGMENT"
```

```text
id-313738373436363732313732393931303435322d74656e616e745f6c6f63616c2d77656c636f6d65
```

```bash
curl -sS "http://127.0.0.1:8080/api/v1/content/$SEGMENT" -H "Authorization: Bearer $SID"   # 200
curl -sS -w "\nHTTP %{http_code}\n" "http://127.0.0.1:8080/api/v1/content/$ID" -H "Authorization: Bearer $SID"
```

```text
entity id must be one canonical opaque path segment: expected "id-<lowercase hex of the id's bytes>" (encode with pk-shared/pkg/pathsegment.EncodeOpaqueID, or use pk-client)
HTTP 400
```

Slugs are not identifiers and are never encoded — a route that addresses
something by slug, such as a public page, keeps it readable.

## Endpoints

Every route below is under the same perimeter; "scope" is what an API key
needs, and the interactive `admin` capability passes all of them. `{id}` is
always a [canonical segment](#entity-identifiers-in-paths).

### Sessions

| Method | Path | Does | Scope |
|---|---|---|---|
| `POST` | `/api/v1/auth/sessions` | Log in; returns a session | — (public) |
| `GET` | `/api/v1/auth/sessions/{id}` | Read a session's metadata (owner only) | any credential |
| `DELETE` | `/api/v1/auth/sessions/{id}` | Log out — revoke a session (owner only) | any credential |

### Tenants

| Method | Path | Does | Scope |
|---|---|---|---|
| `GET` | `/api/v1/tenants` | List tenants visible to the caller (your own) | `tenants:read` |
| `GET` | `/api/v1/tenants/{id}` | Get your tenant | `tenants:read` |
| `PUT` | `/api/v1/tenants/{id}` | Update your tenant (`slug`, `name`) | `tenants:write` |
| `DELETE` | `/api/v1/tenants/{id}` | Delete your tenant | `tenants:write` |
| `POST` | `/api/v1/tenants` | Create a tenant — **not available in OSS**; provisioning is out of band | — |

### Users

| Method | Path | Does | Scope |
|---|---|---|---|
| `GET` | `/api/v1/users` | List users in the caller's tenant (`limit`, `offset`) | `users:read` |
| `POST` | `/api/v1/users` | Create a user (`email`, `username` required; `display_name`, `password`, `active`) | `users:write` |
| `GET` | `/api/v1/users/{id}` | Get a user | `users:read` |
| `PUT` | `/api/v1/users/{id}` | Update a user; omitted `active` is preserved | `users:write` |
| `DELETE` | `/api/v1/users/{id}` | Delete a user | `users:write` |

### API keys

| Method | Path | Does | Scope |
|---|---|---|---|
| `GET` | `/api/v1/api-keys` | List the tenant's keys (prefixes only) | `api-keys:read` |
| `POST` | `/api/v1/api-keys` | Issue a key bound to the caller (`name` required; `scopes`, `ttl_seconds`) | `api-keys:write` |
| `DELETE` | `/api/v1/api-keys/{id}` | Revoke a key | `api-keys:write` |

### Audit

| Method | Path | Does | Scope |
|---|---|---|---|
| `GET` | `/api/v1/audit-events` | Query the tenant's append-only audit trail (`limit`, `offset`) | `audit:read` |

### Content

| Method | Path | Does | Scope |
|---|---|---|---|
| `GET` | `/api/v1/content` | List content in the tenant | `content:read` |
| `POST` | `/api/v1/content` | Create content (`kind`, `slug`, `title` required; `body`, `body_format`) | `content:write` |
| `GET` | `/api/v1/content/{id}` | Get content | `content:read` |
| `PUT` | `/api/v1/content/{id}` | Update content | `content:write` |
| `DELETE` | `/api/v1/content/{id}` | Delete content | `content:write` |
| `POST` | `/api/v1/content/{id}/publish` | Publish (sets `published_at`); `204` | `content:write` |
| `POST` | `/api/v1/content/{id}/unpublish` | Unpublish; `204` | `content:write` |

### Notifications

| Method | Path | Does | Scope |
|---|---|---|---|
| `GET` | `/api/v1/notifications` | List the caller's own notifications | `notifications:read` |
| `POST` | `/api/v1/notifications` | Create a notification for the caller (`title`, `body` required; `category`, `severity`, `data`) | `notifications:write` |
| `POST` | `/api/v1/notifications/{id}/read` | Mark one of the caller's notifications read; `204` | `notifications:write` |
| `POST` | `/api/v1/notification-subscriptions` | Subscribe the caller to a `category`/`channel` | `notifications:write` |
| `DELETE` | `/api/v1/notification-subscriptions/{id}` | Remove one of the caller's subscriptions | `notifications:write` |

### Branding

| Method | Path | Does | Scope |
|---|---|---|---|
| `GET` | `/api/v1/branding` | Read the tenant's branding profile | any tenant credential |
| `POST` | `/api/v1/branding` | Save or skip branding setup — the admin page's form endpoint (multipart; `action=save` or `skip`); responds `303` back to the admin page, not JSON | any tenant credential |
| `GET` | `/api/v1/branding/logo` | Serve the tenant's logo bytes | any tenant credential |

### Runtime (no authentication)

| Method | Path | Does |
|---|---|---|
| `GET` | `/healthz` | Aggregate module health |
| `GET` | `/live` | Process liveness |
| `GET` | `/ready` | Readiness snapshot (module plan composed) |
| `GET` | `/metrics` | `expvar` process and module metrics — **`metrics:read` or admin required** |
| `GET` | `/openapi/extensions.json` | Validated OpenAPI 3.1 document of application-module operations |

> [!NOTE]
> The OSS starter does not expose a tenant-provisioning API. `POST
> /api/v1/tenants` is documented so clients fail predictably; creating
> tenants is an out-of-band concern for the deployment that owns the database.

## A complete worked example

Log in, create a record, address it canonically, publish it, and read the
audit trail — exactly what the [Quickstart](./quickstart.md) does, in one
block you can paste:

```bash
B=http://127.0.0.1:8080
SID=$(curl -sS -X POST $B/api/v1/auth/sessions -H 'Content-Type: application/json' \
  -d '{"tenant_id":"tenant_local","email":"operator@local.test","password":"local-development-only"}' | jq -r .id)

ID=$(curl -sS -X POST $B/api/v1/content -H "Authorization: Bearer $SID" -H 'Content-Type: application/json' \
  -d '{"kind":"page","slug":"welcome","title":"Welcome","body":"Hello"}' | jq -r .id)

SEG="id-$(printf '%s' "$ID" | od -An -tx1 | tr -d ' \n')"
curl -sS -X POST "$B/api/v1/content/$SEG/publish" -H "Authorization: Bearer $SID" -w "publish → %{http_code}\n"
curl -sS "$B/api/v1/audit-events?limit=3" -H "Authorization: Bearer $SID" | jq '.[].action'
```

```text
publish → 204
"auth.login_success"
"content.created"
"content.published"
```
