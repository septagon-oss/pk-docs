---
title: "ADR 0071: Email verification uses hash-only proofs and owner-guarded activation"
status: Accepted
date: 2026-07-18
slug: adr-0071-email-verification-uses-hash-only-proofs-and-owner-guarded-activation
adr_topic: security
type: doc
tags: [adr, security, authentication, email-verification, registration, bearer, csrf, transaction]
---

# ADR 0071 — Email verification uses hash-only proofs and owner-guarded activation

Status: **Accepted** (2026-07-18)

## The problem

An email-verification URL is a bearer credential. Persisting its raw token in
the verification table, a notification body, template data, retry payload,
log, or generic entity projection lets database and operations access become
account-activation authority. A read followed by separate verification and
user updates also permits concurrent redemption and partial commits.

Activation has a second authority hazard. A verification record describes the
user and email that were pending when the credential was issued; it does not
authorize reactivating a user who has since been suspended, deleted, verified,
moved to another tenant, or changed to another email. A cacheable user read
followed by a generic partial update can miss precisely those intervening
changes.

Email security scanners routinely open links before the recipient does. A GET
that consumes the credential therefore activates accounts without an explicit
user action. Public resend endpoints add enumeration, mail-bombing, concurrent
rotation, and stale-delivery risks when each request immediately replaces the
current credential.

## The decision

Registration owns one tenant-scoped email-verification authority. Issuance
creates 32 random bytes, returns the 64-character hexadecimal bearer only to
the in-memory delivery attempt, and stores only its SHA-256 digest, exact user,
canonical email, expiry, and consumption state. The digest is excluded from
JSON, admin, CRUD, UI, and MCP projections. There is at most one live pending
record per tenant and user. Replacement invalidation and creation share one
transaction.

Verification consumes the digest with one conditional durable update over the
exact tenant, unexpired state, and `verified_at IS NULL`. Within that same
ambient transaction, user management—not registration—performs one
tenant-scoped compare-and-swap requiring the exact user ID, canonical email,
`pending` status, `email_verified=false`, and a non-deleted row. Only that
statement may transition the user to `active` and verified. A changed email,
suspension, inactivity, deletion, prior verification, cross-tenant context, or
missing transaction fails closed and rolls credential consumption back.

Audit intent and the typed `user.email.verified` event commit in the same
mutation boundary. The event name, version, and payload schema come from one
typed contract used by runtime publication and catalog projection.

The emailed GET never mutates state. It validates only the public token shape
and renders a confirmation form containing the bearer and the middleware's
response-authoritative CSRF token. The exact POST `/verify-email` route is
covered by the general CSRF policy and performs redemption. Confirmation
responses are non-cacheable, suppress referrers, deny framing, work without
JavaScript, and never copy the bearer into a post-confirmation URL, log, or
terminal response.

Verification mail is a sensitive inline delivery. Notification persistence
stores a redacted, non-retryable intent rather than the raw text, HTML, URL, or
template data. Every newly issued credential has a distinct delivery tracking
identity so notification idempotency cannot suppress a replacement and leave
the user holding only an invalidated link.

The unauthenticated resend operation applies one atomic cooldown keyed by the
exact tenant and SHA-256 digest of the canonical email before account lookup,
state branching, credential rotation, or delivery. Suppressed, unknown,
already verified, eligible, and internally failed requests retain the same
public response. A wired shared cache that cannot prove atomic
set-if-absent, or whose operation fails, blocks the resend side effect; it does
not silently bypass the deployment-wide gate.

The raw-token schema cutover is security-irreversible. Historical pending
credentials are randomized and invalidated before the plaintext column is
dropped, because old persisted notification rows may still contain their URLs.
Users request a new post-cutover link rather than carrying readable authority
forward.

## What we gave up

- Pending verification links issued before the cutover stop working and must be
  resent.
- A suspended, inactive, deleted, changed-email, or already-active user cannot
  be reactivated by an old verification message; recovery needs an explicit
  owner-controlled lifecycle operation.
- Link opening is no longer sufficient. The recipient performs one explicit
  CSRF-protected confirmation, including when JavaScript is disabled.
- Sensitive verification deliveries cannot rely on durable raw-body retries.
  A failed attempt is replaced by a fresh credential after the cooldown.
- Rapid repeated resend requests are coalesced even when a user believes the
  first message was lost.
- Deployments with a configured but non-atomic or unavailable shared cache do
  not perform resend side effects until the abuse-control authority recovers.

## What we kept

- Email verification remains a simple public registration flow and requires no
  authenticated session before proof.
- Tenant-branded auth flavors can render the confirmation surface from the
  host-supplied token, CSRF token, form action, and state.
- The user module retains ownership of user lifecycle invariants while auth
  retains ownership of identity-proof credentials.
- Notification delivery remains delegated through the notification port; only
  the security classification and persistence policy change.
- Operators retain structured failure logs, audit state, and a canonical typed
  event without exposing the bearer or public account state.

## How we enforce it

- [Convention C-21](../conventions.md#c-21-email-verification-bearers-are-hash-only-and-owner-guarded)
  defines the mechanical issuance, delivery, browser, consume, activation, and
  resend rules.
- Append-only migration 022 invalidates pre-cutover pending records, hashes
  terminal history, constrains digest shape and uniqueness, and drops the raw
  token column. Its down migration fails explicitly.
- Registration's verification repository performs conditional digest consume
  and proves it joined the ambient transaction. User management publishes only
  the narrow `UserEmailVerificationActivator` compare-and-swap port.
- Authentication no longer owns an `EmailVerification` entity or generic
  service; a regression scan prevents AutoMigrate from recreating the raw
  column.
- Browser tests prove scanner-safe GET, CSRF rejection, no-JavaScript form
  submission, response hardening, and bearer removal after success. The
  renderer contract carries the host-supplied bearer, response-authoritative
  CSRF token, exact action, and confirmation state to tenant flavors.
- Repository, activation-store, transaction, race, migration, notification,
  resend-cooldown, and event-contract tests cover exact tenant/email/status
  authority, concurrent single winners, rollback, delivery confidentiality,
  and catalog/runtime name parity.

## References

- [ADR 0006 — Multi-entity writes are atomic or they do not happen](./0006-transactional-atomicity-for-multi-entity-state.md)
- [ADR 0007 — Events go through the transactional outbox](./0007-transactional-outbox-for-event-delivery.md)
- [ADR 0009 — Modules only talk through ports](./0009-ports-only-cross-module-communication.md)
- [ADR 0028 — Domain modules own security and delivery capabilities](./0028-domain-owned-security-and-delivery-capabilities.md)
- [ADR 0070 — Interactive browser authentication uses durable one-time bound proofs](./0070-interactive-browser-authentication-uses-durable-one-time-bound-proofs.md)
- [REQ AUTH-021 — Email verification](../requirements/REQ-AUTH-021-email-verification.md)
- [REQ AUTH-024 — Resend verification](../requirements/REQ-AUTH-024-resend-verification.md)
- [Convention C-21](../conventions.md#c-21-email-verification-bearers-are-hash-only-and-owner-guarded)
