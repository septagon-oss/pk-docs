---
title: v0.2.0 Security Baseline
slug: v0-2-0-security-baseline
collection: docs
status: published
---

# v0.2.0 Security Baseline

This page describes what `pk-core/pkg/security/*` provides **out of the box**,
what the starter app actually wires, what is intentionally minimal at v0.2.0,
and what an operator still owns. Read it end-to-end before deploying
PlatformKit OSS to any network you do not control.

## What `pk-core/pkg/security/*` provides

The security layer ships contracts plus safe defaults in **eleven**
sub-packages:

| Package | Provides |
|---------|----------|
| `authn` | `RequireAuth` middleware: rejects requests whose context carries no authenticated `identity.Principal`. |
| `authz` | Authorization primitives over principals (permission checks on the request identity). |
| `cookies` | Central cookie profiles by `Kind` (`KindSession`, `KindCSRF`, …) with enforced HttpOnly/SameSite flags; `cookies.Write`, `cookies.Name`. |
| `cors` | Exact-match origin-allowlist CORS middleware. An empty allowlist admits nothing — deny is the default. |
| `csrf` | Double-submit-cookie CSRF middleware (`_csrf` cookie via `cookies.KindCSRF`, `X-CSRF-Token` header, per-path `ExemptPaths`). |
| `headers` | Security-header middleware: HSTS (default max-age 1 year), `X-Frame-Options: DENY`, referrer policy, CSP with per-request nonces (`NonceFromContext`). |
| `identity` | The `identity.Principal` carrier: `ContextWithPrincipal`, `PrincipalFromContext`, `IdentityResolver`, scope checks. |
| `middlewarepolicy` | `Chain(mws...)` — ordered middleware composition. |
| `passhash` | The `Hasher` interface plus **Argon2id** (`NewArgon2id`, `Argon2idDefaults`) and **bcrypt** (`NewBcrypt`, `DefaultCost`) implementations. |
| `ratelimit` | `Limiter` interface, per-process in-memory `TokenBucket`, HTTP `Middleware`, and `ClientIPKey` keying. |
| `signature` | `Signer` interface with an `HMACSigner` (HMAC-SHA256, minimum 32-byte key) for webhooks and short-lived tokens. |

Every package exposes an interface plus a reference implementation. The
reference implementations are deliberately simple; downstream distributions
replace the ones that matter for their threat model.

## Defaults the starter app actually wires

These are the concrete choices in `pk-apps/pkg/starterapp` (the same graph the
front door `github.com/septagon-oss/platformkit` runs):

- **Authentication is enforced.** The starter gates its surfaces on an
  authenticated `identity.Principal`: `/api/v1/*` rejects an anonymous request
  with `401`, and `/admin` redirects an unauthenticated visit to `/admin/login`
  with `303`. A caller authenticates with a **session bearer token**
  (`Authorization: Bearer <session-id>` from `POST /api/v1/auth/sessions`), a
  **session cookie** (set by the admin login page), or an **API key**
  (`Authorization: Bearer <api-key>`, which selects its own tenant). Nothing on
  the API or admin surface is reachable anonymously.
- **Tenant isolation is enforced.** The tenant is derived from the
  authenticated principal — never from a query param or request body — and
  every by-id store query carries a mandatory `tenant_id` predicate. A caller
  only ever sees or mutates its own tenant's data; a cross-tenant read or write
  by `id` returns `404`/denied. This is covered by an enforced module-boundary
  test.
- **Password hasher: bcrypt at `passhash.DefaultCost`.** Both
  `user_management` and `auth_management` default to bcrypt when no
  `WithHasher` is supplied. Argon2id is available in the same package if you
  prefer it — it is a one-option swap.
- **Session IDs: 256-bit `crypto/rand`,** URL-safe encoded, default TTL 24
  hours (`auth.WithSessionTTL` to shorten). The SQLite session store supports
  revocation (`Revoke`, `RevokeByUser`) but has no rotation policy or idle
  timeout.
- **Seed admin from config, no re-asserted default.** Admin credentials come
  from config (`seed.admin_email`, `seed.admin_password`). The demo
  `admin@local.test` / `changeme` pair is a **development-only** default; it is
  seeded once and **never re-asserted** on a later boot, so rotating or
  deactivating the seeded account sticks. A production boot **requires**
  `seed.admin_password` — there is no built-in default password outside
  development.
- **Login lockout: yes, it ships.** The starter app implements
  `auth.LoginPolicy` in `login_policy.go`: **5 failed attempts within a
  15-minute window lock the (tenant, identifier) pair for 15 minutes.** The
  tracker is bounded at 8192 tracked identifiers; at saturation it fails
  closed (new identifiers are temporarily denied rather than tracked
  unboundedly). Lockout state is in-memory and per-process — it resets on
  restart and does not coordinate across replicas.
- **Audit trail on security events.** Auth, api_key, content, and notification
  receive an `audit.AuditEmitter` bound to the seed tenant and a synthetic
  `system` actor, so security-relevant actions land in the append-only audit
  log.
- **Rate limiter, CSRF, CORS, and security-header middleware are *available*
  but not installed on the starter mux.** The starter enforces authentication
  and tenant isolation, but leaves these transport hardening middlewares as an
  operator/composition decision.

## What the OSS does **not** ship

- **Secret storage.** DB DSNs, signing keys, and the seed admin password come
  from `config.yaml` or your own wrapper code — see
  [Configuration](./configuration.md).
- **A rich authorization graph.** Authentication and tenant isolation are
  enforced, but the authorization model is still coarse — a "is admin" notion
  rather than fine-grained RBAC. A richer ADR-promoted RBAC contract remains on
  the roadmap.
- **Audit log integrity.** The audit table is append-only by convention, not
  hash-chained or signed; DB-level tampering is not detected.
- **A distributed rate limiter or lockout store.** Both the token bucket and
  the login lockout are per-process and in-memory.
- **Outbound TLS policy.** Notification channels beyond in-app delivery are a
  downstream concern.

## What you still own

1. **Key material** — all long-lived secrets, including the seed admin password
   (`seed.admin_password`).
2. **TLS termination.** PlatformKit assumes a TLS-terminating reverse proxy in
   front; it does not listen on `:443`.
3. **Backup and restore of `pk.db`**, including the audit log — treat audit
   data as regulatory evidence.
4. **Patch cadence.** Each repo runs CodeQL and dependency review in CI;
   merging fixes is your job.
5. **A distributed rate limiter / lockout store** before you run multiple
   replicas — the shipped token bucket and login lockout are per-process.
6. **Fine-grained authorization.** Authentication and tenant isolation are
   enforced for you, but RBAC is still coarse; add the permission checks your
   product needs on top.

## How to harden a starter deployment

In rough order of impact:

1. Put the app behind a reverse proxy that terminates TLS (see the
   [Deployment Guide](./deployment-guide.md)).
2. Set a strong `seed.admin_password` (required outside development) and rotate
   the seeded account. Two sharp edges remain: there is no HTTP
   password-change endpoint at v0.2.0 (`PUT /api/v1/users/{id}` updates profile
   fields, never the hash — passwords change through `UserService.SetPassword`
   in Go code), so to retire the seeded login create your own admin user and
   deactivate the seeded one (`"active": false` via
   `PUT /api/v1/users/user_admin` or in wrapper code); inactive users are
   refused login with `403`. The seed does **not** re-assert the default
   password, so a deactivation or rotation sticks across boots.
3. Wire `headers.Middleware` and `csrf.Middleware` into your mux if you serve
   browsers.
4. Add `ratelimit.Middleware` with `ClientIPKey` in front of the auth API —
   the shipped lockout is per-identifier, not per-IP.
5. Swap bcrypt for Argon2id if your threat model calls for it
   (`passhash.NewArgon2id(passhash.Argon2idDefaults())`).
6. Replace the in-memory `LoginPolicy` with a shared store before running
   multiple replicas.

Each of these is a provider or middleware swap — no fork required.

## Reporting a vulnerability

Report security issues **privately by email to `security@septagon.dev`** — do
not open a public GitHub issue. Include a description, reproduction steps, and
the affected repo/version. Fixes land on `main`; there is no LTS window at
v0.2.0, so pin a commit if you need stability and watch the repos for security
updates.
