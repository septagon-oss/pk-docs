---
title: PlatformKit OSS v0.2.0 Overview
slug: v0-2-0-overview
collection: docs
status: archived
---

> **Historical v0.2.0 documentation.** This page is retained for release research and is not the current OSS contract. Use `docs/current/` and the `septagon-oss/platformkit` README for current setup, credentials, routes, and capabilities.


# PlatformKit OSS v0.2.0 Overview

`v0.2.0` is the security release of PlatformKit OSS: the starter now
**requires authentication** across the API and admin, and enforces
**multi-tenant isolation** end to end. It is a
**Go-native modular SaaS backbone** released under an open-core model:
the OSS layer is permissively licensed (Apache-2.0) and ships everything
required to stand up a real multi-tenant application; the Pro layer
(released separately) embeds the OSS modules and adds harder, more
opinionated implementations of policy, identity, billing, deployment,
and assurance.

This page is the canonical landing point for someone who has just heard
of PlatformKit and wants to know what is actually in the box at v0.2.0.

## What ships in v0.2.0

PlatformKit OSS v0.2.0 is **twelve repositories** that compose into one
runnable application:

| Repo | Role |
|------|------|
| [`platformkit`](https://github.com/septagon-oss/platformkit) | The front door: `git clone` + `go run .` boots the full starter SaaS. |
| `pk-shared` | Small shared primitives: composition, flows, state machines, IDs. |
| `pk-core` | The framework rules: module composition, registries, authz/entity/mutation/observability contracts, security primitives. |
| `pk-design` | Design tokens, themes, component descriptors, and design contribution catalogs. |
| `pk-runtime` | Host/readiness, guarded HTTP routing, request context, health projection. |
| `pk-testkit` | Conformance and API flow-test helpers. |
| `pk-modules` | The nine OSS business modules (see below). |
| `pk-client` | Typed client primitives. |
| `pk-tools` | The `pk` CLI: doctor, verify, explain modules. |
| `pk-apps` | Runnable compositions, including the `starter-saas` monolith. |
| `pk-deploy` | Vendor-neutral deployment control-plane kernel (releases independently). |
| `pk-docs` | This documentation portal plus module-doc composition. |

## The nine-module pack

`pk-modules` ships **nine modules** which compose into a working
multi-tenant SaaS the moment you wire them up in `pk-apps`:

1. `tenant_management` — tenants, tenancy boundaries.
2. `user_management` — users with tenant scoping.
3. `auth_management` — sessions, login, password hashing.
4. `api_key_management` — server-to-server keys.
5. `content_management` — generic content entities with CRUD.
6. `notification_management` — outbound notifications.
7. `audit_management` — append-only audit log.
8. `health_management` — readiness/liveness aggregation.
9. `admin_management` — admin sidebar + entity CRUD UI.

Every module follows the same shape: a `*Module` struct, declared ports,
declared admin/health contributions, and a `Compose` function that the
catalog calls.

## The open-core model

The OSS layer defines **contracts** (Go interfaces) and **reference
implementations** for them. The Pro layer is expected to:

- embed `*Module` constructors from `pk-modules` (no fork),
- supply harder providers behind the OSS interfaces (e.g. a
  Postgres-backed store, enterprise SSO, a real notification fan-out),
- and add wholly new modules that depend only on declared contracts.

The boundary is drawn at the *provider*, never at the *contract*: every
public interface stays in OSS. This is described in detail in
[Open Core](./open-core.md).

## Where to start

- If you want to run something **right now**, jump to the
  [Quickstart](./quickstart.md).
- If you want to understand the **shape** of PlatformKit before touching
  code, read the [API Reference](./api-reference.md) and [Architecture](./architecture.md) — or browse the
clickable [Module Map](./module-map/README.md) to navigate the nine modules
and the ports that connect them.
- If you want to build your own module or swap a provider, start with
  [Add a Module](./add-a-module.md) and [Open Core](./open-core.md).
- If you are auditing security, read
  [Security Baseline](./security-baseline.md).
- To change ports, timeouts, or the database, see
  [Configuration](./configuration.md).
- For the full v0.2.0 change list, see
  [Release Notes v0.2.0](./release-notes-v0.2.0.md).

## What v0.2.0 is **not**

- Not production-ready out of the box. Some OSS providers are
  intentionally simple references (e.g. SQLite storage, in-process
  notification delivery). Pro and downstream distributions are expected
  to replace them behind the same contracts.
- Not API-stable. Anything not in a published contract package is
  subject to change before v1.0.
- Not feature-complete. Future releases will tighten the public surface
  and promote modules from `experimental` to `core-certified`.
