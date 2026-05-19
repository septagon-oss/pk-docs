---
title: PlatformKit OSS v0.0.0 Overview
slug: v0-0-0-overview
collection: docs
status: published
---

# PlatformKit OSS v0.0.0 Overview

`v0.0.0` is the first public seed release of PlatformKit OSS. It is a
**Go-native modular SaaS backbone** released under an open-core model:
the OSS layer is permissively licensed and ships everything required to
stand up a real multi-tenant application; the Pro layer (released
separately) embeds the OSS modules and adds harder, more opinionated
implementations of policy, identity, billing, deployment, and assurance.

This page is the canonical landing point for someone who has just heard
of PlatformKit and wants to know what is actually in the box at v0.0.0.

## What ships in v0.0.0

PlatformKit OSS v0.0.0 is **ten repositories** that compose into one
runnable application:

| Repo | Role |
|------|------|
| `pk-shared` | Small shared primitives: composition, flows, state machines, IDs. |
| `pk-core` | The framework rules: module composition, registries, authz/entity/mutation/observability contracts. |
| `pk-design` | Design tokens, themes, component descriptors, and design contribution catalogs. |
| `pk-runtime` | Host/readiness, guarded HTTP routing, request context, health projection. |
| `pk-testkit` | Conformance and API flow-test helpers. |
| `pk-modules` | The nine OSS business modules (see below). |
| `pk-client` | Typed client primitives. |
| `pk-tools` | The `pk` CLI: doctor, verify, explain modules. |
| `pk-apps` | Runnable compositions, including the `starter-saas` monolith. |
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
- supply harder providers behind the OSS interfaces (e.g. an Argon2id
  hasher, a per-tenant rate limiter, a real notification fan-out),
- and add wholly new modules that depend only on declared contracts.

This is described in detail in the
[Extension Guide](./extension-guide.md).

## Where to start

- If you want to run something **right now**, jump to
  the [Starter SaaS tutorial](./starter-saas-tutorial.md).
- If you want to understand the **shape** of PlatformKit before touching
  code, read [Architecture](./architecture.md).
- If you are building a Pro extension, start with the
  [Extension Guide](./extension-guide.md).
- If you are auditing security, read
  [Security Baseline](./security-baseline.md).
- For the full v0.0.0 change list and what's coming in v0.0.1, see
  [Release Notes v0.0.0](./release-notes-v0.0.0.md).

## What v0.0.0 is **not**

- Not production-ready out of the box. The OSS providers are
  intentionally simple references (e.g. SHA-256 password hashing, in-process
  notification delivery). Pro and downstream distributions are expected to
  replace them.
- Not API-stable. Anything not in `contracts/` is subject to change.
- Not feature-complete. v0.0.1 will tighten the public surface and
  promote modules from `experimental` to `core-certified`.
