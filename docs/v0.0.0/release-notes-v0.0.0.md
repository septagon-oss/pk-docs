---
title: v0.0.0 Release Notes (user-facing)
slug: v0-0-0-release-notes
collection: docs
status: published
---

# v0.0.0 Release Notes

PlatformKit OSS `v0.0.0` is the **first public seed release** of the
modular Go SaaS backbone. It is shipped for inspection, early extension
work, and friendly testing — not for production traffic.

This page is the user-facing companion to the operator-oriented
`RELEASE_NOTES_V0_0_0.md` in this same repo. Where that doc focuses on
verification, this one focuses on **what you actually get** and **what
to expect from v0.0.1**.

## Highlights

- **Ten OSS repositories**, all permissively licensed, all green on
  `make verify`.
- **Nine composable modules** — tenant, user, auth, api-key, content,
  notification, audit, health, admin.
- **One runnable monolith** (`pk-apps/apps/starter-saas`) that boots on
  SQLite with `go run .`.
- **Public contracts** for module composition, security primitives,
  observability extractors, entity CRUD, and design tokens.
- **A `pk` CLI** with `doctor`, `verify`, and `explain modules`.
- **Five baseline CI workflows** per Go repo (build/test, staticcheck,
  CodeQL, dependency-review, release, baseline).

## What's in v0.0.0

### `pk-shared`

- Shared composition primitives (`Bundle`, `Flow`).
- ID helpers (`tid`, `uuid` wrappers).
- State machine helpers, hardened with defensive copies on read.

### `pk-core`

- Module composition (`Module`, `Registry`, `Bundle`).
- Entity CRUD HTTP handler with the generic `Store` interface.
- Authz, identity, mutation, observability, and design contracts.
- `infrastructure/config` Config struct + JSON loader + env overrides.
- Architecture fitness tests for cross-module boundaries.

### `pk-design`

- Design tokens, themes, component descriptors.
- Catalog primitives with deterministic duplicate-key behaviour.
- Block manifest fitness check.

### `pk-runtime`

- Lightweight host/readiness loop.
- Guarded HTTP routing.
- Health projection.

### `pk-testkit`

- Conformance helpers.
- Flow-test helpers with deterministic clocks.
- Empty-conformance-report regression fix.

### `pk-client`

- Typed client primitives.
- Rejects trailing JSON in responses (hardened).

### `pk-tools`

- `pk doctor` — repo hygiene checks.
- `pk verify` — module composition checks.
- `pk explain modules` — introspect a running registry.

### `pk-modules`

- The nine modules; see
  [Module Reference](./module-reference.md).
- Append-only audit log.
- SQLite default stores.
- Tenant validation wired through `user_management`.
- Tightened module-construction surfaces.

### `pk-apps`

- `apps/starter-saas` — runnable monolith composing all nine modules.
- `apps/platformkit-page` — the marketing/landing app.
- Workspace pinned to Go 1.26.

### `pk-docs`

- Public docs portal.
- This v0.0.0 documentation set.
- Release audit checklist.
- Filtered unsafe public links (hardening fix).

## What is **not** in v0.0.0

- A production-grade password hasher (SHA-256 default; replace).
- A durable, async notification outbox (in-process default).
- A real RBAC engine (coarse "is admin" only).
- A distributed rate limiter (per-process only).
- Audit log integrity beyond append-only convention.
- A Helm chart or container image for `starter-saas`.
- API stability guarantees outside `contracts/` packages.

## Coming in v0.0.1

Based on the v0.0.0 audit, v0.0.1 is expected to include:

1. **An Argon2id `Hasher` reference implementation** in `pk-core`.
2. **A durable outbox** in `notification_management`.
3. **`pk explain ports`** — show declared and satisfied ports for a
   running app.
4. **A first ADR-promoted RBAC contract**, replacing the v0.0.0
   "admin or not" check.
5. **Module-tier promotion**: at least two `experimental` modules
   moving to `supported`.
6. **A container image** for `starter-saas` and a corresponding
   minimal Helm chart in `pk-deploy`.
7. **A `dependency-review` allowlist** so day-zero contributors don't
   fail PR checks on transitive `go.mod` noise.
8. **Tighter SECURITY.md disclosure flow** — a single inbox + GPG key
   per repo.

## Upgrade notes (forward-looking)

- v0.0.0 modules embed cleanly. v0.0.1 will keep the `*Module` shape
  stable; any breaking option signature changes will get a thin
  compatibility shim for one release.
- Pro extensions are expected to track OSS tags one-for-one. We do not
  ship "OSS v0.0.0 + Pro v0.1.0" combos in v0.0.x — Pro v0.0.x always
  depends on OSS v0.0.x.

## Verification snapshot

This release was cut after:

- `make verify` green across all ten OSS repos.
- `govulncheck ./...` clean on Go repos.
- `npm audit --audit-level=moderate` clean on `pk-docs`.
- `go mod tidy -diff` clean.
- `gofmt` clean.
- `git diff --check` clean.
- The `repository-baseline` workflow is now active in every OSS repo.

See the full audit at `pk-docs/docs/V0_0_0_RELEASE_AUDIT.md`.
