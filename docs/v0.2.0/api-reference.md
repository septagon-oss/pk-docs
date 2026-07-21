---
title: v0.2.0 API Reference
slug: v0-2-0-api-reference
collection: docs
status: published
---

# API Reference

The starter's HTTP API is described by a machine-readable OpenAPI 3.0 document
that lives next to the code and is **bound to it by a conformance test** —
`openapi_conformance_test.go` boots the app and walks every declared
operation, so the spec cannot silently drift from the implementation.

- **Spec:** [`pk-apps/api/openapi.yaml`](https://github.com/septagon-oss/pk-apps/blob/main/api/openapi.yaml)
  ([raw](https://raw.githubusercontent.com/septagon-oss/pk-apps/main/api/openapi.yaml))

## Use it

```bash
# Swagger UI against your local starter (spec fetched from GitHub):
docker run --rm -p 8081:8080 \
  -e SWAGGER_JSON_URL=https://raw.githubusercontent.com/septagon-oss/pk-apps/main/api/openapi.yaml \
  swaggerio/swagger-ui
# → http://localhost:8081, point "servers" at http://localhost:8080

# Or import the raw URL into Postman / Insomnia / your client generator.
```

Every generated client still needs the auth flow: `POST /api/v1/auth/sessions`
returns a session whose `id` is your bearer token (see the
[Quickstart](./quickstart.md) for the copy-paste curl version).

## Conventions (the five rules the whole API follows)

1. **Auth everywhere.** Only login is anonymous. Send
   `Authorization: Bearer <session-id-or-api-key>`; the browser session
   cookie (`pk_session`) works equally.
2. **The server owns identity.** Your tenant and user come from your
   credentials. Body-supplied `tenant_id` / `user_id` / `author_id` are
   ignored on writes.
3. **Cross-tenant reads as not found.** Every by-id operation is
   tenant-scoped (and, for notifications and subscriptions, user-scoped);
   someone else's ID responds `404`.
4. **Errors are plain text; the status carries the meaning.** `400` invalid
   input, `401` bad credentials, `404` not found, `405` method not allowed,
   `409` uniqueness conflict, `413` body over 1 MiB, `429` login throttled.
5. **JSON is snake_case** — except the notification module, whose fields are
   Go-cased (`ID`, `Title`, …) in v0.2.x. Documented in the spec; a future
   major will align it.

## Endpoints at a glance

| Method | Path | What | Success |
|--------|------|------|---------|
| POST | `/api/v1/auth/sessions` | Log in (the only anonymous endpoint) | 201 |
| GET | `/api/v1/auth/sessions/{id}` | Read your own session | 200 |
| DELETE | `/api/v1/auth/sessions/{id}` | Log out (owner only, idempotent) | 204 |
| GET | `/api/v1/tenants` | List your tenant | 200 |
| POST | `/api/v1/tenants` | **Always 403** — provisioning is a platform op | 403 |
| GET/PUT/DELETE | `/api/v1/tenants/{id}` | Your own tenant only | 200/200/204 |
| GET/POST | `/api/v1/users` | List / create users in your tenant | 200/201 |
| GET/PUT/DELETE | `/api/v1/users/{id}` | By-id user ops, tenant-scoped | 200/200/204 |
| GET/POST | `/api/v1/api-keys` | List / issue keys (issued to *you*) | 200/201 |
| DELETE | `/api/v1/api-keys/{id}` | Revoke, tenant-scoped | 204 |
| GET | `/api/v1/audit-events` | Query your tenant's trail (writes → 405) | 200 |
| GET/POST | `/api/v1/content` | List / create content (author = you) | 200/201 |
| GET/PUT/DELETE | `/api/v1/content/{id}` | By-id content ops, tenant-scoped | 200/200/204 |
| POST | `/api/v1/content/{id}/publish` · `/unpublish` | Publication toggle | 204 |
| GET/POST | `/api/v1/notifications` | Your own notifications only | 200/201 |
| POST | `/api/v1/notifications/{id}/read` | Mark your own read | 204 |
| POST | `/api/v1/notification-subscriptions` | Subscribe yourself | 201 |
| DELETE | `/api/v1/notification-subscriptions/{id}` | Your own subscription only | 204 |
| GET | `/healthz` · `/ready` | Health (open) | 200 |
| GET | `/live` | Liveness (open) | 204 |

Request/response schemas, query parameters, and every declared error status
are in the spec itself.

Related: [Quickstart](./quickstart.md) · [Module Reference](./module-reference.md) · [Module Map](./module-map/README.md) · [Security Baseline](./security-baseline.md)
