---
title: FAQ
slug: v0-2-0-faq
collection: docs
status: archived
---

> **Historical v0.2.0 documentation.** This page is retained for release research and is not the current OSS contract. Use `docs/current/` and the `septagon-oss/platformkit` README for current setup, credentials, routes, and capabilities.


# PlatformKit FAQ

Honest answers to the questions people ask first.

---

## Why not just use Supabase or Encore?

Supabase is a hosted Postgres + auth + storage product; Encore is a Go framework with its own cloud and infrastructure provisioning. PlatformKit is narrower and more local: it's the multi-tenant SaaS substrate — tenants, users, auth, audit, admin — as composable Go modules you clone and run with `go run .`, with no account, no cloud, and no Docker. If you want a managed backend-as-a-service or opinionated infra provisioning, those tools fit better. If you want the tenant/auth/admin layer as code you own and run on your own infrastructure, that's what this is.

## Why not just plain net/http + sqlc, or Buffalo?

You can, and for a single-tenant CRUD app you probably should. What you end up rebuilding by hand in each project is the substrate: tenant isolation in the data layer, a login flow, an audit trail, an admin screen, and the wiring between them. PlatformKit is that substrate already composed, with a port boundary so you can swap any piece. It is not a web MVC framework like Buffalo — there's no router opinion, no asset pipeline, and no generators-for-everything.

## Is this an open-core rug-pull waiting to happen?

The commitment is explicit and it's the most important line in the project: the boundary is drawn at the *provider*, never at the *contract*. Every public interface a module exposes stays in OSS under Apache-2.0, and Pro only plugs new implementations in behind those same interfaces. A Postgres-cluster store or enterprise SSO is a Pro provider behind the store/auth ports you already build against — nothing you write today gets re-typed against a closed API. See the open-core documentation for the full boundary.

## SQLite in production — really?

No. SQLite is the zero-setup *local default* so the first run needs no database, and it's genuinely fine for development and small deployments. For production at scale you swap your own store in behind the relevant module store interfaces (auth uses `WithSessionStore`); that's exactly what the port boundary is for. We state this plainly in the "What this is NOT" list rather than hiding it. (Pro adds Postgres-cluster and read-replica providers, but the interfaces are OSS and you can write your own.)

## Why dependency injection? Isn't that a lot of magic for Go?

It's there so modules can depend on interfaces (ports) and have the concrete type supplied at startup, instead of importing each other directly. That's what lets you replace one module's implementation without the change cascading, and add your own module the same way the nine built-ins are added. It is a real tradeoff — DI adds indirection, and if you dislike that style this won't change your mind — but it's what makes the compose-and-swap story a real property of the system rather than a slogan. You can read the wiring in `pk-apps/pkg/starterapp/app.go`.

## What's actually in Pro?

Hosted and cloud-scale providers: NATS/JetStream/Kafka event buses, Postgres-cluster and read-replica backends, and cloud secrets managers; plus enterprise identity (SCIM, SAML, SSO), vertical business modules, hosted observability, and a hosted control plane. All of it plugs in behind interfaces that live in OSS. Pro is where the operational and at-scale concerns are — not where the contracts are.

## What's the license?

Apache-2.0 for everything you clone and run: the contracts and ports, the default providers (SQLite, in-memory, stdlib, file-based), the security baseline, the reference admin UI, the starter app, the `pk` CLI, and the nine-module essentials pack. That's enough to build and run a multi-tenant SaaS backend on your own infrastructure with no further purchase. The license file is in the repository.

## How mature is this? It says v0.2.0.

It's early, and we say so: v0.2.0 — still expect APIs to move. Verified on Linux/x86_64, Go 1.26, and `modernc.org/sqlite v1.50.1`, on a fresh database. Things will move; pin a commit if you need stability today. The hero path — clone, `go run .`, a seeded admin and a healthy data layer — is verified green on a cold clone, but we won't pretend the surrounding surface is battle-tested. Tell us where it breaks.

## Who's behind it, and do you actually use it?

Septagon. We build PlatformKit and use it ourselves to ship multi-tenant products, which is why the substrate looks the way it does — it's the stuff we got tired of rebuilding. The OSS substrate is the same one our own work composes from; Pro is the hosted and at-scale layer on top.

## Nine CRUD modules isn't a "platform."

Agreed — nine CRUD modules wouldn't be. The claim isn't the count, it's the composition. Modules import *interfaces*, not each other's implementations (ports like `AdminRegistrar`, or a provider's published contract), and dependency injection supplies the concrete type at startup, so you can swap or add modules without edits cascading. The substrate is the tenant/auth/audit/admin boundary plus that compose-and-swap mechanism — the nine bundled modules are the reference implementations that prove it and give you a running app on the first command.

## Is the admin UI a real login?

Yes. `/admin` is behind a login wall: an unauthenticated visit returns a `303` redirect to `/admin/login`, a real login page that sets a session cookie. Sign in with the admin credentials (`admin@local.test` / `changeme` in development) and you land on the dashboard. The same credentials also authenticate against the multi-tenant auth API (`POST /api/v1/auth/sessions`), where the request body must include `tenant_id` (`tenant_acme`) or you'll get a `400`; that returns a session `id` you send back as `Authorization: Bearer <session-id>`. Nothing on `/admin` or `/api/v1/*` is reachable anonymously.

---

## Practical questions

### How do I add a module?

You add your own module the same way the nine built-ins are added: it's a self-contained package that declares its dependencies as ports (the interfaces it needs) and registers what it provides, and dependency injection wires it into the composed app at startup. It never imports another module's implementation — only interfaces. The nine bundled modules under the reference module pack are the working examples to follow.

### How do I use Postgres instead of SQLite?

SQLite is the default store provider, wired behind each store-backed module's store interface (for example, auth uses `WithSessionStore`; user, tenant, audit, content, api_key, and notification each take their own `WithStore`). To use Postgres you supply a store implementation behind that same interface and wire it in the client composition instead of the SQLite default — the modules that depend on the store don't change, because they depend on the interface, not on SQLite. A Postgres-cluster/read-replica provider is added in Pro, but the interfaces are OSS, so you can write or wire your own.

### Is it production-ready?

It's early — v0.2.0; expect APIs to move. The hero path is verified on a cold clone (Linux/x86_64, Go 1.26, fresh database), and the substrate is designed to run on your own infrastructure. Authentication is required and multi-tenant isolation is enforced, but the default SQLite store is for development and small deployments, not scale, and the broader surface is not battle-tested yet. For production, set `seed.admin_password`, swap your store in behind the relevant module store interfaces, and pin a commit. Read the "What this is NOT" section before you depend on it.
