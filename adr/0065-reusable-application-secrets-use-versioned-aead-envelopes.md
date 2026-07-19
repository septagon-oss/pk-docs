---
title: "ADR 0065: Reusable application secrets use versioned authenticated-encryption envelopes"
status: Accepted
date: 2026-07-17
slug: adr-0065-reusable-application-secrets-use-versioned-aead-envelopes
adr_topic: security
type: doc
tags: [adr, security, cryptography, secrets, key-rotation]
---

# ADR 0065 — Reusable application secrets use versioned authenticated-encryption envelopes

Status: **Accepted** (2026-07-17)

## The problem

PlatformKit stores a small class of secrets that must later be recovered by the
application, such as a user's TOTP seed. Hashing is correct for passwords,
backup codes, and bearer tokens because those values only need comparison, but
it cannot serve a TOTP verifier that must calculate the next code. Treating
database or volume encryption as sufficient leaves every recoverable secret in
plaintext to a SQL read leak, an over-privileged operator, or a copied backup.

We also had no shared answer for rotation. A bare ciphertext column says
nothing about its algorithm, key, scope, or migration state. Changing a key
could therefore lock out every enrolled user, while permissive handling of an
older storage format could silently keep plaintext rows forever.

## The decision

We encrypt every reusable application secret at the persistence-adapter
boundary with a versioned authenticated-encryption envelope. Business services
may handle plaintext only in memory; repositories receive an envelope carrying
the schema version that unambiguously selects its algorithm, key identifier,
nonce, and ciphertext. Associated data binds the ciphertext to its domain and
owning tenant or identity so a valid row cannot be transplanted to another
principal.

Production uses a dedicated, explicitly configured 256-bit active key and a
bounded previous-key ring. Development may derive a domain-separated key from
an existing local secret only when the normalized effective environment is
exactly `development`; staging and production require a dedicated key.
Reads fail closed on malformed, unauthenticated, unknown-key, wrong-owner, or
forbidden unwrapped values. Rotation deploys readers before writers, rewraps old
envelopes, proves the old-key count is zero, and only then removes a previous
key.

Values that never need recovery remain one-way hashed. Encryption is not a
substitute for hashing passwords, recovery codes, API keys, or bearer tokens.

## What we gave up

- Deployments must manage a dedicated key and keep previous keys during a
  measured rotation window.
- Plaintext-to-envelope upgrades need an explicit rewrite or fail-safe
  re-enrolment plan; a schema migration alone cannot invent key material.
- Persistence adapters carry cryptographic responsibility instead of relying
  on a transparent database column type that does not currently exist.

## What we kept

- Provider-neutral storage: the envelope can move through Postgres, backups,
  and exports without making those systems plaintext authorities.
- Cryptographic context binding: copying ciphertext between users or tenants
  fails authentication.
- Forward evolution: version and algorithm fields allow a deliberate future
  cipher migration rather than format guessing.
- Rotation without a flag day: active and previous key identifiers make mixed
  read windows explicit and testable.

## How we enforce it

- [Convention C-17](../conventions.md#c-17-reusable-application-secrets-use-versioned-aead-envelopes)
  defines the mechanical envelope, configuration, and migration rules.
- `auth_management/features/authentication/totp_secret_protector.go` and its
  tests are the first governed implementation. Production two-factor wiring
  rejects a persistence store that does not advertise protected-secret storage.
- `REQ-AUTH-003` verifies ciphertext opacity, associated-data binding,
  tamper rejection, production key requirements, and key rotation.
- Gap — the AES-GCM/keyring mechanics also exist in the tenant lifecycle export
  adapter. Once both formats settle, extract the common primitive into a
  provider-neutral `internal/secretbox` package and add a static check for raw
  writes to fields classified as reusable secrets.

## References

- [ADR 0005 — No silent failures in production paths](./0005-error-handling-discipline.md)
- [ADR 0009 — Modules only talk through ports](./0009-ports-only-cross-module-communication.md)
- [REQ AUTH-003 — Two-factor authentication](../requirements/REQ-AUTH-003-twofactor.md)
- [Convention C-17](../conventions.md#c-17-reusable-application-secrets-use-versioned-aead-envelopes)
