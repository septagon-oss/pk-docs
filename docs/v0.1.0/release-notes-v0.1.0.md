---
title: v0.1.0 Release Notes
slug: v0-1-0-release-notes
collection: docs
status: published
---

# v0.1.0 Release Notes

PlatformKit OSS `v0.1.0` is the **first public release** of the modular
Go SaaS backbone. It is shipped for inspection, early extension work,
and friendly testing — not yet for production traffic.

> **Note on v0.0.0:** earlier `v0.0.0` tags were cut with local
> `replace` directives baked in and can never resolve from the Go module
> proxy. Every module retracts `v0.0.0`; always consume `v0.1.0` or
> later. (The per-module `ModuleVersion` contract value intentionally
> stays `"0.0.0"` — it is a compose-pinning namespace, not the release
> version.)

## Highlights

- **Twelve OSS repositories**, all Apache-2.0, all green on
  `make verify`.
- **One-command boot:** `git clone
  https://github.com/septagon-oss/platformkit && cd platformkit &&
  go run .` starts the full starter SaaS on `:8080` — no Docker, no
  CGO, no accounts.
- **Nine composable modules** — tenant, user, auth, api-key, content,
  notification, audit, health, admin.
- **Public contracts** for module composition, security primitives,
  observability extractors, entity CRUD, and design tokens.
- **Production-grade password hashing in OSS:** bcrypt by default,
  Argon2id available via `WithHasher`.
- **Login lockout** in the starter app: 5 failed attempts in 15 minutes
  locks the account for 15 minutes.
- **A `pk` CLI** with `doctor`, `verify`, and `explain modules`.
- **Baseline CI workflows** per Go repo (build/test, staticcheck,
  CodeQL, dependency-review, release, baseline).

## What's in v0.1.0

### `platformkit` (front door)

- A thin `main` over `pk-apps/pkg/starterapp`: clone and `go run .`
  boots the identical OSS monolith.
- First-boot seed: tenant `acme` (id `tenant_acme`) and admin login
  `admin@local.test` / `changeme`, stored in `./pk.db` (SQLite).

### `pk-shared`

- Shared composition primitives (`Bundle`, `Flow`).
- ID helpers and state machine helpers, hardened with defensive copies
  on read.

### `pk-core`

- Module composition (`Module`, `Registry`, `Bundle`).
- Entity CRUD HTTP handler with the generic `Store` interface.
- Authz, identity, mutation, event, observability, and design contracts.
- Security primitives: `passhash` (bcrypt, Argon2id), cookies,
  signatures, headers, rate limiting, CSRF, CORS.
- Architecture fitness tests for cross-module boundaries.

### `pk-design`

- Design tokens, themes, component descriptors.
- Catalog primitives with deterministic duplicate-key behaviour.

### `pk-runtime`

- Lightweight host/readiness loop (`/live`, `/ready`).
- Guarded HTTP routing, request context, health projection.

### `pk-testkit`

- Conformance helpers, API test helpers, and flow-test helpers with
  deterministic clocks.

### `pk-client`

- Typed client primitives; rejects trailing JSON in responses.

### `pk-tools`

- `pk doctor` — repo hygiene checks.
- `pk verify` — module composition checks.
- `pk explain modules` — introspect a running registry.

### `pk-modules`

- The nine modules; see [Module Reference](./module-reference.md).
- Append-only audit log, SQLite default stores, tenant validation wired
  through `user_management`.

### `pk-apps`

- `pkg/starterapp` — the importable starter application the front door
  wraps: config, first-boot seed, serve loop, login lockout policy.
- `apps/starter-saas` — runnable monolith composing all nine modules.
- Toolchain pinned to Go 1.26.

### `pk-deploy`

- Vendor-neutral deployment control-plane kernel: signed pull-based
  jobs, worker loop, executor registry, evidence bundles, Prometheus
  text exposition. Releases independently of the module train.

### `pk-docs`

- This documentation portal: quickstart, architecture, add-a-module,
  configuration, security baseline, and reference pages.

## What is **not** in v0.1.0

- A durable, async notification outbox (in-process default).
- A real RBAC engine (coarse "is admin" only).
- A distributed rate limiter (per-process only).
- Audit log integrity beyond append-only convention.
- A login wall on the `/admin` dashboard (it ships open — see the
  [Security Baseline](./security-baseline.md)).
- A Helm chart or container image for the starter app.
- API stability guarantees outside published contract packages.

## Coming in v0.2.0

1. A durable outbox in `notification_management`.
2. `pk explain ports` — show declared and satisfied ports for a running
   app.
3. A first ADR-promoted RBAC contract, replacing the "admin or not"
   check.
4. Module-tier promotion: at least two `experimental` modules moving to
   `supported`.
5. A container image for the starter app and a corresponding minimal
   chart in `pk-deploy`.

## Verification snapshot

This release was cut after, per repo:

- `make verify` green.
- `GOWORK=off go build ./...` and `GOWORK=off go test ./...` green from
  a clean clone (no workspace, default `GOPROXY`).
- A replace-directive guard confirming no `replace` in any published
  `go.mod`.
- `govulncheck ./...` clean on Go repos; `npm audit
  --audit-level=moderate` clean on `pk-docs`.
- A real front-door smoke: clone, `go run .`, then `GET /healthz` →
  200, `GET /api/v1/tenants` → 200, `POST /api/v1/auth/sessions` → 201.
