---
title: "ADR 0067: Refresh tokens use durable single-use families"
status: Accepted
date: 2026-07-18
slug: adr-0067-refresh-tokens-use-durable-single-use-families
adr_topic: security
type: doc
tags: [adr, security, authentication, refresh-token, session, revocation, replay]
---

# ADR 0067 — Refresh tokens use durable single-use families

Status: **Accepted** (2026-07-18)

## The problem

A cache blacklist cannot prove that a refresh token is current. A cache write
can fail, an entry can be evicted, and a read followed by a write is not an
atomic redemption boundary. Two replicas can consequently accept the same
long-lived bearer concurrently, and logout can appear successful while a
stolen refresh token still mints a new access token.

Storing a raw refresh token on the session row creates a second problem: any
database, administration, CRUD, MCP, or debugging projection that reaches the
row can disclose a reusable bearer. Treating rotation as optional preserves
both hazards indefinitely.

## The decision

Every remembered PlatformKit session owns one durable refresh-token family.
The database stores only the SHA-256 digest of the one currently redeemable
token, its monotonically increasing generation, exact user/tenant/session
binding, expiry, and terminal revocation metadata. Raw bearer material is
returned once to the caller and never enters an entity, event, audit payload,
log, metric label, or durable row.

Redemption first verifies the JWT algorithm, signature, registered time
claims, issuer, audience, purpose, family, generation, user, tenant, and
session claims. It then locks the family and session inside one durable
transaction, compares the presented digest in constant time, and revalidates
current account, tenant-membership, guest-ceiling, and role state. The next
access token and refresh bearer are returned only after a generation-and-digest
compare-and-swap and the session activity, audit intent, and event commit.
Exactly one concurrent redemption can win.

A validly signed token whose family is missing, revoked, expired, mismatched,
or no longer current is denied. A stale generation or digest is treated as
reuse: the whole family and bound session are durably revoked. Storage or
eligibility uncertainty returns no credential. Rotation is mandatory; the
former compatibility switch cannot weaken this rule.

Logout and logout-everywhere revoke both the durable session and its family in
the mutation boundary. Cache JTI and invalidation markers remain immediate
defence in depth, never authorization authority. For platform tokens whose
purpose is `access`, the request middleware revalidates the exact durable
session and active user on every request; cache loss therefore cannot make a
revoked session valid again.

The migration from raw session tokens is intentionally security-irreversible.
Existing refresh bearers are invalidated and users perform a fresh remembered
login. A rollback must not restore a raw bearer column or delete revocation
authority.

## What we gave up

- Refresh-token rotation can no longer be disabled for compatibility or
  availability.
- A deployment without transactional durable storage cannot issue remembered
  sessions.
- Reuse detection is deliberately strict: a duplicate delivery can revoke the
  family even when one concurrent request already rotated it successfully.
- The migration signs out pre-migration remembered sessions instead of copying their
  raw bearer material into the new model.
- Every platform access-token request performs authoritative session and user
  checks in addition to signature and cache checks.

## What we kept

- Access tokens remain short-lived signed JWTs and can be parsed locally before
  the authoritative session check.
- Cache-backed JTI revocation still provides fast rejection and cross-replica
  propagation when available.
- Tenant switching remains an explicit new-session operation; refresh cannot
  change the tenant bound to its family.
- Audit and domain-event publication stay inside the existing transactional
  mutation/outbox boundary.

## How we enforce it

- [Convention C-19](../conventions.md#c-19-refresh-bearers-have-one-durable-current-authority)
  makes durable hash-only compare-and-swap authority mandatory.
- `auth_management/migrations/019_create_durable_refresh_token_families.up.sql`
  removes the raw session bearer column and creates constrained family state.
- Auth-management startup rejects a missing durable family store or atomic
  session mutation boundary.
- Store and service tests cover digest opacity and length, exact binding,
  concurrent redemption, replay revocation, storage failure, account and
  membership revalidation, logout, and cache independence.
- Backend authentication middleware tests cover inactive, mismatched, missing,
  and unavailable durable access-session state on every request.

## References

- [ADR 0006 — Multi-entity writes are atomic or they do not happen](./0006-transactional-atomicity-for-multi-entity-state.md)
- [ADR 0007 — Events go through the transactional outbox](./0007-transactional-outbox-for-event-delivery.md)
- [REQ AUTH-011 — Refresh-token redemption](../requirements/REQ-AUTH-011-refresh-token.md)
- [REQ AUTH-012 — Logout](../requirements/REQ-AUTH-012-logout.md)
- [Convention C-19](../conventions.md#c-19-refresh-bearers-have-one-durable-current-authority)
