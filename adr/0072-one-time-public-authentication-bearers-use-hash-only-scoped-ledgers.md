---
title: "ADR 0072: One-time public authentication bearers use hash-only scoped ledgers"
status: Accepted
date: 2026-07-18
slug: adr-0072-one-time-public-authentication-bearers-use-hash-only-scoped-ledgers
adr_topic: security
type: doc
tags: [adr, security, authentication, bearer, password-reset, magic-link, verification, callback, replay]
---

# ADR 0072 — One-time public authentication bearers use hash-only scoped ledgers

Status: **Accepted** (2026-07-18)

## The problem

Email verification, password reset, magic-link sign-in, and interactive
provider callbacks carry different payloads, but each crosses an
unauthenticated browser boundary with temporary authority. Persisting the raw
bearer turns database, backup, administration, queue, and observability access
into the ability to exercise that authority. A digest without exact scope,
expiry, and atomic consumption is also insufficient: it can still be replayed,
accepted for another purpose, or raced by concurrent requests.

Browser delivery adds another class of failure. Mail scanners and security
gateways open GET links automatically. Consuming a credential on GET therefore
converts automated inspection into a password change, account activation, or
session mutation. Provider callbacks cannot require a second human gesture,
but they can and must carry protocol-specific callback authority and a
short-lived browser binding.

Several generations of authentication code implemented these rules
independently. Without one common floor, a new flow can reintroduce plaintext
storage, weak entropy, purpose confusion, partial consumption, or a reversible
schema cutover even while the existing flows remain secure.

## The decision

Every PlatformKit-issued bearer that crosses a public authentication boundary
and is intended for one-time use has at least 256 bits of cryptographic
unpredictability. The normal construction is 32 bytes from a cryptographically
secure random source. A credential that must be reconstructed for safe resend
coalescing may instead use a domain-separated HMAC-SHA-256 under a secret of at
least 32 bytes and a unique random identifier. The derivation key is never
stored with the credential record.

Durable state stores only a SHA-256 digest of the complete presented bearer,
plus the exact tenant, purpose, subject or identity, bounded expiry, and
consumption state. Protocol flows add every authority dimension needed by that
protocol, such as provider, connection, issuer, audience, callback URL,
request ID, and browser-binding digest. The raw bearer is excluded from entity,
JSON, admin, CRUD, UI, MCP, notification, retry-job, audit, event, log, metric,
and error persistence.

Redemption hashes the complete presented value and performs one conditional
durable transition over the digest, exact scope, unexpired state, and
unconsumed state. A read followed by an unconditional update is not redemption
authority. When the bearer authorizes another durable mutation, consumption
and that mutation share one transaction whenever the participating owners can
join the same atomic boundary. Storage, scope, or transaction uncertainty
returns no authority.

For emailed browser flows, GET may validate shape or perform a read-only peek,
but it never consumes the bearer or performs the protected mutation. The user
submits an explicit state-changing POST. That POST is protected by the bearer
and, whenever ambient browser state or session swapping is relevant, by the
general CSRF policy or a purpose-specific browser proof. Automated OIDC and
SAML callbacks are the protocol exception to the explicit human POST: they
must instead prove exact callback authority, protocol evidence, one-time state,
and the browser binding before a platform session is created.

Emailed bearer delivery uses sensitive immediate content. Notification
persistence retains only a redacted, non-retryable intent, and each delivery
attempt has an identity that cannot cause notification idempotency to suppress
a newly authorized credential. Raw links do not enter durable work queues.

A plaintext-to-digest cutover is security-irreversible. Pending plaintext
authority is invalidated or discarded before its column or table is removed.
The down migration fails explicitly rather than recreating recoverable bearer
storage. Operators issue fresh post-cutover credentials.

## What we gave up

- Database inspection and durable notification retries cannot recover a raw
  one-time authentication credential.
- A scanner-opened email link cannot complete its protected action without an
  explicit user submission.
- Protocol callback handling requires durable one-time state and browser
  binding rather than relying on an integrity-only continuation.
- Security cutovers may invalidate pending credentials and require users to
  request fresh links.
- An unavailable atomic store denies redemption rather than falling back to a
  non-durable or read-then-write path.

## What we kept

- Public recovery and authentication flows remain usable without an existing
  authenticated session.
- Tenant-branded browser pages can render the server-supplied proof and action
  using ordinary no-JavaScript forms.
- Purpose-specific decisions remain authoritative: [ADR 0070](./0070-interactive-browser-authentication-uses-durable-one-time-bound-proofs.md)
  governs interactive-provider and magic-link browser binding, while
  [ADR 0071](./0071-email-verification-uses-hash-only-proofs-and-owner-guarded-activation.md)
  governs email-verification delivery and owner-guarded activation.
- Domain owners retain their lifecycle and credential boundaries; the common
  rule does not create a shared authentication god service.

## How we enforce it

- [Convention C-22](../conventions.md#c-22-one-time-public-authentication-bearers-use-hash-only-scoped-ledgers)
  defines the issuance, persistence, delivery, browser, redemption, and
  migration checklist.
- `auth_login_tokens` stores purpose-bound magic-link and password-reset
  digests. Its repository uses a versioned compare-and-swap, and its browser
  handlers keep GET read-only before the explicit mutation.
- Append-only migrations 020 and 022 establish one-time digest ledgers for
  provider callbacks and email verification. Migration 023 removes the unused
  plaintext password-reset table and refuses to recreate it on downgrade.
- Login-link supersession and reset-race tests, interactive-flow callback tests,
  email-verification repository/browser tests, sensitive-notification tests,
  and schema-retirement tests exercise the specialized applications.

## References

- [ADR 0006 — Multi-entity writes are atomic or they do not happen](./0006-transactional-atomicity-for-multi-entity-state.md)
- [ADR 0007 — Events go through the transactional outbox](./0007-transactional-outbox-for-event-delivery.md)
- [ADR 0009 — Modules only talk through ports](./0009-ports-only-cross-module-communication.md)
- [ADR 0070 — Interactive browser authentication uses durable one-time bound proofs](./0070-interactive-browser-authentication-uses-durable-one-time-bound-proofs.md)
- [ADR 0071 — Email verification uses hash-only proofs and owner-guarded activation](./0071-email-verification-uses-hash-only-proofs-and-owner-guarded-activation.md)
- [REQ AUTH-021 — Email verification](../requirements/REQ-AUTH-021-email-verification.md)
- [REQ AUTH-022 — Password reset](../requirements/REQ-AUTH-022-password-reset.md)
- [REQ AUTH-025 — Magic-link tenant self-enrollment](../requirements/REQ-AUTH-025-magic-link-self-enrollment.md)
