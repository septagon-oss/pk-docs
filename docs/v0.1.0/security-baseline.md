---
title: v0.1.0 Security Baseline
slug: v0-1-0-security-baseline
collection: docs
status: published
---

# v0.1.0 Security Baseline

This page describes what `pk-core/pkg/security/*` provides **out of the box**,
what the starter app actually wires, what is intentionally minimal at v0.1.0,
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

- **Password hasher: bcrypt at `passhash.DefaultCost`.** Both
  `user_management` and `auth_management` default to bcrypt when no
  `WithHasher` is supplied. (Earlier documentation described a SHA-256
  default; that is not what v0.1.0 ships.) Argon2id is available in the same
  package if you prefer it — it is a one-option swap.
- **Session IDs: 256-bit `crypto/rand`,** URL-safe encoded, default TTL 24
  hours (`auth.WithSessionTTL` to shorten). The SQLite session store supports
  revocation (`Revoke`, `RevokeByUser`) but has no rotation policy or idle
  timeout.
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
  but not installed on the starter mux.** The starter serves its API and admin
  shell without these middlewares; wiring them is an operator/composition
  decision.

## The open `/admin` caveat

**The admin dashboard ships without a login wall.** `/admin` and the
`/api/v1/*` CRUD APIs are unauthenticated in the v0.1.0 starter. The seeded
credentials (`admin@local.test` / `changeme`, tenant `tenant_acme`)
authenticate against the *auth API* (`POST /api/v1/auth/sessions`) — nothing
enforces a session on the admin routes yet. Do not expose the port to an
untrusted network without putting your own authentication in front (reverse
proxy auth, network isolation, or your own middleware). See the
[release notes](./release-notes-v0.1.0.md) for the roadmap on this.

## Tenant isolation is NOT complete in v0.1.0 — read this

**Do not put multiple tenants' real data in the v0.1.0 starter and rely on it
to keep them apart.** Tenant scoping is applied only on lookups where the
tenant is part of the natural key (list, get-by-slug, get-by-email, uniqueness
checks). **Operations by primary key — get/update/delete by `id`, password
reset, publish, key revoke — are not tenant-scoped**: they resolve a row by
`id` alone. Combined with the unauthenticated mux above, the starter derives no
tenant from an authenticated principal, and the one list endpoint that filters
by tenant reads `tenant_id` from the request's query string. In practice a
caller who can reach the port and knows or guesses a row `id` can read or
mutate another tenant's row.

This is a starter/reference limitation, not a design most deployments should
ship. Before running multi-tenant data through it you must: put an
authentication + authorization gate in front of every route, derive the tenant
from the authenticated principal (never from a query param or request body),
and add a mandatory `AND tenant_id = ?` predicate to every by-`id` store query.
Until you do, treat the starter as single-tenant.

## What the OSS does **not** ship

- **Secret storage.** DB DSNs and signing keys come from `config.yaml` or your
  own wrapper code. Note: **the starter reads no environment variables at
  all** — see [Configuration](./configuration.md).
- **A real authorization graph.** The contracts model principal/permission
  checks, but v0.1.0 has only a coarse "is admin" notion. A first
  ADR-promoted RBAC contract is on the v0.2.0 roadmap.
- **Audit log integrity.** The audit table is append-only by convention, not
  hash-chained or signed; DB-level tampering is not detected.
- **A distributed rate limiter or lockout store.** Both the token bucket and
  the login lockout are per-process and in-memory.
- **Outbound TLS policy.** Notification channels beyond in-app delivery are a
  downstream concern.

## What you still own

1. **Key material** — all long-lived secrets.
2. **TLS termination.** PlatformKit assumes a TLS-terminating reverse proxy in
   front; it does not listen on `:443`.
3. **Authentication in front of `/admin`** until a login wall ships.
4. **Backup and restore of `pk.db`**, including the audit log — treat audit
   data as regulatory evidence.
5. **Patch cadence.** Each repo runs CodeQL and dependency review in CI;
   merging fixes is your job.
6. **Tenant isolation.** v0.1.0 does **not** fully isolate tenants on its own
   (see the section above); scoping by-`id` operations to the authenticated
   tenant is work you must do before trusting it with multi-tenant data.

## How to harden a starter deployment

In rough order of impact:

1. Put the app behind a reverse proxy that terminates TLS and gates `/admin`
   (see the [Deployment Guide](./deployment-guide.md)).
2. Neutralize the seeded account. Be aware of two sharp edges: there is no
   HTTP password-change endpoint in v0.1.0 (`PUT /api/v1/users/{id}` updates
   profile fields, never the hash — passwords change only through
   `UserService.SetPassword` in Go code), and the first-boot seed
   **re-asserts** `admin@local.test` / `changeme` on every boot if the
   advertised password stops verifying. What the seed does *not* touch on an
   existing user is the `active` flag — so create your own admin user, then
   deactivate the seeded one (`"active": false` via `PUT /api/v1/users/user_admin`
   or in wrapper code); inactive users are refused login with 403.
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
v0.1.0, so pin a commit if you need stability and watch the repos for security
updates.
