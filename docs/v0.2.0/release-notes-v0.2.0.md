---
title: v0.2.0 Release Notes
slug: v0-2-0-release-notes
collection: docs
status: published
---

# v0.2.0 Release Notes

## v0.2.1 — security-review hardening (patch)

`v0.2.1` closes the findings of an adversarial review of v0.2.0. No cross-tenant
leak or auth bypass was found; these harden the surrounding controls:

- **Session ownership.** `GET`/`DELETE /api/v1/auth/sessions/{id}` now require
  the caller to own the session — closing an unauthenticated session-info
  oracle and cross-user forced logout.
- **Self-only notification reads.** A read returns only the caller's own
  notifications (bound to the authenticated user, not a client-supplied
  `user_id`) — closing a same-tenant cross-user IDOR.
- **Fail-closed seed default.** A config file that omits `environment` now
  defaults to `production` (requires `seed.admin_password`); the zero-config
  demo stays `development` and prints a loud DEVELOPMENT-MODE warning.
- **Tighter gate + admin.** The anonymous-mutation exemption is narrowed to the
  login endpoint only (anonymous logout is blocked); `/admin` admits only
  interactive session principals (API keys use the API, not the console);
  `/metrics` requires authentication; the public index page redacts admin
  credentials outside development.

Upgrade with `go get github.com/septagon-oss/pk-apps@v0.2.1` (front door:
`platformkit@v0.2.1`).

---

PlatformKit OSS `v0.2.0` is the **security release** of the modular Go SaaS
backbone. The starter now **requires authentication**, enforces
**multi-tenant isolation end to end**, puts `/admin` behind a **login wall**,
and **closes the seed password backdoor**. If you ran v0.1.0, read the
**Breaking changes** section before upgrading.

> **Upgrade note.** This is a breaking release. Store and service signatures
> now carry a `tenantID`, and every API caller must authenticate. Consume
> `v0.2.0` or later; the earlier `v0.1.0` starter was intentionally open and
> should not be exposed to any untrusted network. (The per-module
> `ModuleVersion` contract value intentionally stays `"0.0.0"` — it is a
> compose-pinning namespace, not the release version.)

## Security highlights

- **Authentication is required.** `/api/v1/*` rejects anonymous requests with
  `401`. Log in via `POST /api/v1/auth/sessions` (returns a session with an
  `id`) and send it back as `Authorization: Bearer <session-id>`; a session
  cookie works for the browser, and an **API key** authenticates the same way
  (`Authorization: Bearer <api-key>`, selecting its own tenant).
- **Multi-tenant isolation is enforced.** Every by-id operation — get / update
  / delete by `id`, password reset, publish, key revoke — is tenant-scoped. The
  tenant is derived from the authenticated principal, never from a query param
  or request body. A caller only ever sees or mutates its own tenant's data; a
  cross-tenant read or write by `id` returns `404`/denied.
- **`/admin` is behind a login wall.** An unauthenticated visit to `/admin`
  returns a `303` redirect to `/admin/login`, a real login page that sets a
  session cookie. Nothing on the admin surface is reachable anonymously.
- **The seed password backdoor is closed.** Admin credentials come from config
  (`seed.admin_email`, `seed.admin_password`). The demo `admin@local.test` /
  `changeme` pair is **development-only** and is **never re-asserted** on a
  later boot, so rotating or deactivating the seeded admin sticks. Production
  boots **require** `seed.admin_password`.
- **An enforced module-boundary test** guards tenant scoping so a regression
  that drops a `tenant_id` predicate fails CI.

## Breaking changes (from v0.1.0)

1. **Store and service signatures now carry `tenantID`.** By-id reads and
   mutations take the tenant from the request context / principal and apply a
   mandatory `tenant_id` predicate. Custom stores and callers built against the
   v0.1.0 signatures must be updated.
2. **API callers must authenticate.** Anonymous `/api/v1/*` requests that
   worked against the v0.1.0 starter now return `401`. Add a session bearer
   token, a session cookie, or an API key.
3. **`/admin` requires a session.** Direct access to admin routes now redirects
   to `/admin/login` instead of rendering the dashboard.
4. **`seed.admin_password` is required outside development.** A production boot
   that previously relied on the built-in `changeme` default now fails until
   the password is supplied in config.

## Also in v0.2.0

- **Twelve OSS repositories**, all Apache-2.0, all green on `make verify`.
- **One-command boot** still holds: `git clone
  https://github.com/septagon-oss/platformkit && cd platformkit && go run .`
  starts the full starter SaaS on `:8080` — no Docker, no CGO, no accounts.
- **Nine composable modules** — tenant, user, auth, api-key, content,
  notification, audit, health, admin.
- **Production-grade password hashing in OSS:** bcrypt by default, Argon2id
  available via `WithHasher`.
- **Login lockout** in the starter app: 5 failed attempts in 15 minutes locks
  the (tenant, identifier) pair for 15 minutes.
- **A `pk` CLI** with `doctor`, `verify`, and `explain modules`.
- **Baseline CI workflows** per Go repo (build/test, staticcheck, CodeQL,
  dependency-review, release, baseline).

## What is **not** in v0.2.0

- Fine-grained RBAC — authorization is still a coarse "is admin" notion on top
  of the now-enforced authentication and tenant isolation.
- A durable, async notification outbox (in-process default).
- A distributed rate limiter or lockout store (per-process only).
- Audit log integrity beyond append-only convention.
- A Helm chart or container image for the starter app.
- API stability guarantees outside published contract packages.

## Verification snapshot

This release was cut after, per repo:

- `make verify` green.
- `GOWORK=off go build ./...` and `GOWORK=off go test ./...` green from a clean
  clone (no workspace, default `GOPROXY`).
- A replace-directive guard confirming no `replace` in any published `go.mod`.
- `govulncheck ./...` clean on Go repos; `npm audit --audit-level=moderate`
  clean on `pk-docs`.
- A real front-door security smoke: clone, `go run .`, then `GET /healthz` →
  `200`, anonymous `GET /api/v1/tenants` → `401`, `GET /admin` → `303`,
  `POST /api/v1/auth/sessions` → `201`, and authenticated
  `GET /api/v1/tenants` → `200` returning only the caller's own tenant.
