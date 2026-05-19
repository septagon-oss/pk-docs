---
title: v0.0.0 Security Baseline
slug: v0-0-0-security-baseline
collection: docs
status: published
---

# v0.0.0 Security Baseline

This page describes what `pk-core/pkg/security/*` provides **out of
the box**, what is intentionally minimal at v0.0.0, and what an
operator still owns. It is meant to be read end-to-end before deploying
PlatformKit OSS to any network you do not control.

## What `pk-core/pkg/security/*` provides

The OSS layer ships **contracts** plus **safe defaults** in nine
sub-packages:

| Package | Provides |
|---------|----------|
| `authn` | Authentication primitives: session and bearer contracts. |
| `authz` | Authorization primitives: permission, role, and gate contracts. |
| `cookies` | Hardened cookie helpers (Secure, HttpOnly, SameSite). |
| `cors` | A conservative CORS middleware (default: deny). |
| `csrf` | Double-submit-cookie CSRF middleware. |
| `headers` | Security-header middleware (HSTS, XCTO, frame-ancestors). |
| `identity` | The `identity.Subject` carrier on the request context. |
| `middlewarepolicy` | Compose middleware in a policy-driven, ordered way. |
| `passhash` | The `Hasher` interface plus a SHA-256 default. |
| `ratelimit` | A token-bucket interface plus a per-process default. |
| `signature` | HMAC signing helpers for webhooks and short-lived tokens. |

Every package exposes an **interface** plus a **reference
implementation**. The reference implementations are deliberately
simple. Pro and downstream distributions are expected to replace the
ones that matter for their threat model.

## Defaults that are safe for local dev

These defaults exist so the `starter-saas` boots without configuration.
They are **not** safe to expose to the public internet without review:

- **Password hasher: SHA-256.** Fast, deterministic, no salt. Replace
  with Argon2id, bcrypt, or scrypt before storing real user passwords.
- **Session IDs: 128-bit `crypto/rand`.** Sufficient entropy, but the
  default store has no rotation policy and no idle timeout.
- **CSRF cookie: `__Host-csrf`.** Correct flags, but the OSS does not
  ship a per-route opt-out list — every state-changing route requires
  the token, which can confuse machine clients without CSRF support.
- **Rate limiter: per-process in-memory.** Forgets state on restart and
  does nothing across replicas. Replace before horizontally scaling.
- **CORS: `Access-Control-Allow-Origin: <none>`.** Default is deny;
  enabling cross-origin requests is an explicit operator action.

## What the OSS does **not** ship

This is the surface area that v0.0.0 deliberately leaves to operators:

- **Secret storage.** Cookie keys, signing keys, and DB credentials
  must be supplied by the operator; the OSS reads them from `config.yaml`
  or environment variables and never tries to generate persistent keys
  silently on first boot.
- **Outbound TLS pinning.** Notification senders, when they grow beyond
  in-process delivery, will need real HTTPS client policy.
- **A real authorization graph.** The OSS contracts model
  permission/role checks, but v0.0.0 ships only a coarse "is this user
  an admin" gate. A real RBAC/ABAC engine is on the v0.0.1 roadmap.
- **Audit log integrity.** The audit table is append-only by
  convention but not yet hash-chained or signed; tampering at the DB
  level is not detected.
- **Brute-force lockouts.** The ratelimit interface is in place; the
  default does not implement per-account lockout. Pro implementations
  are expected to.

## What you still own

Even with a hardened Pro distribution, the following remain operator
responsibilities:

1. **Key material.** All long-lived secrets.
2. **TLS termination.** PlatformKit assumes it is behind a TLS-terminating
   load balancer; it does not listen on `:443`.
3. **Backup and restore of the audit log.** Audit data is regulatory
   evidence; protect it as such.
4. **Patch cadence.** `dependency-review.yml` and the CodeQL workflow
   flag known issues; merging fixes is your job.
5. **Multi-tenant isolation at the storage layer.** PlatformKit
   enforces tenancy at the application layer; at the DB layer you are
   still responsible for choosing the right isolation primitive (one
   schema per tenant, row-level security, etc.).

## How to harden a `starter-saas` deployment

In rough order of impact:

1. Replace the password hasher with Argon2id
   (see [Extension Guide](./extension-guide.md), Axis 1).
2. Move the session store to a database with rotation policies.
3. Enable HSTS via the `headers` middleware policy.
4. Put PlatformKit behind a reverse proxy that terminates TLS and
   strips `X-Forwarded-*` from untrusted sources.
5. Replace the in-memory rate limiter with a Redis-backed one.
6. Wire a real RBAC provider behind the `authz.Gate` interface.

Each of these is a provider swap — no fork required.

## Reporting a vulnerability

Each OSS repo ships a `SECURITY.md` describing the disclosure path.
Until a coordinated-disclosure pipeline is set up, please open a
**private security advisory** against the affected repo on GitHub.
