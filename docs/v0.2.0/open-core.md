---
title: Open Core
slug: v0-2-0-open-core
collection: docs
status: published
---

# Open core

**What's free vs paid, and will you rug-pull me?**

PlatformKit is **Apache-2.0**. The thing you clone and run is the whole
substrate, not a trial slice. You can build and run a multi-tenant SaaS backend
on your own infrastructure with nothing but the open-source code.

Septagon makes PlatformKit and uses it. A commercial Pro tier exists. The
boundary between OSS and Pro is drawn deliberately, and the rest of this page
states exactly where it sits.

## What's free vs what Pro adds

| OSS owns (Apache-2.0, the whole substrate) | Pro adds (commercial) |
|---|---|
| All public contracts and ports | Hosted and cloud-scale **providers** behind those same ports |
| Default providers with zero setup: SQLite, in-memory, stdlib, file-based | NATS / JetStream / Kafka event buses |
| Security baseline: CSRF, CORS, security headers, password hashing, signed cookies, rate-limiting, signature verification | Postgres-cluster and read-replica database backends |
| The reference admin UI | Cloud secrets managers |
| The starter app | Enterprise identity: SCIM, SAML, enterprise SSO |
| The `pk` CLI (`doctor`, `verify`, `explain`) | Vertical business modules |
| The nine-module essentials pack (tenant, user, auth, api_key, audit, content, notification, health, admin) | Hosted observability backends |
| The module/catalog composition system and the port boundary itself | A hosted control plane |

The short version: **OSS is the substrate and the default (local-scale)
providers. Pro is where the hosted and at-scale operational providers live.**

## The commitment: the boundary is at the provider, never the contract

This is the part that decides whether you can trust the project, so it is the
part stated most precisely.

Every public interface a module exposes lives in OSS and stays in OSS. Pro never
moves a contract out of open source. What Pro does is plug new *implementations*
in **behind those same interfaces**:

- A Postgres-cluster store goes behind the same store interface the SQLite store
  already satisfies.
- An enterprise SSO provider goes behind the same auth port the OSS auth module
  already uses.
- A NATS event bus goes behind the same event model OSS defines.

Because the seam is an interface, **nothing in Pro requires you to re-type your
code against a closed API.** The contracts you build against today do not move.
If you write a module against `tenant.TenantService` or implement the `store.Store`
interface today, that code keeps compiling whether the concrete provider behind
it is the OSS SQLite default or a Pro Postgres cluster. You are not building on a
trapdoor.

This is the same boundary the architecture already enforces for you: modules
depend only on interfaces, so swapping a provider is a wiring change, not a
rewrite. See [architecture.md](architecture.md). Pro is "more providers behind
the ports you already use," not "a different shape you have to migrate to."

## What this isn't

- It is not an open-core teaser where the OSS build is missing the load-bearing
  parts. The nine modules run, the admin UI renders, login works, health checks
  pass — on a fresh clone, with no paid component. See [quickstart.md](quickstart.md).
- It is not a relicensing trap on the contracts. The interfaces are the
  published, stable surface and they are Apache-2.0.
- It is early (v0.2.0; expect APIs to move). Things will move while the project finds its feet. That
  is a maturity caveat, not a licensing one — pin a commit if you need stability
  today.

---

See also: [quickstart.md](quickstart.md) to run the OSS substrate,
[add-a-module.md](add-a-module.md) to build on the ports, [architecture.md](architecture.md)
for how the port boundary works.
