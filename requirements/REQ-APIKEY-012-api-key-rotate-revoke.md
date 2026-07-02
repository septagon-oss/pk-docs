---
id: REQ-APIKEY-012
title: "API key rotate creates a fresh credential and links the predecessor; revoke flips status without deleting"
status: Proposed
date: 2026-05-08
slug: req-apikey-012-api-key-rotate-revoke
category: api_key
ears_pattern: event-driven
priority: must
risk: high
verification_methods: [test]
compliance:
  - SOC2_CC6.1
  - SOC2_CC6.7
  - ISO27001_A.9.4.3
  - NIST_IA-5
satisfied_by:
  adr: [ADR-0009]
  conventions: [C-04, C-14]
implements_cross_cutting: [REQ-001, REQ-004, REQ-009]
refines: REQ-APIKEY-001
type: doc
tags: [requirement, capability, api_key_management, key_management, rotate, revoke]
module: api_key_management
feature: key_management
capability: api_key_rotate_revoke
capability_kind: state_machine
stakeholders:
  - tenant administrator (rotates on schedule)
  - operator (incident-driven revoke)
  - compliance auditor (key-rotation policy)
---

# REQ APIKEY-012 — API key rotate + revoke

Status: **Proposed** (2026-05-08)

## Statement

The key-management feature **shall** expose two lifecycle
transitions and one terminal operation:

1. **`RotateAPIKey(keyID)`** — read the existing key, build a
   `CreateAPIKeyRequest` from its name (`+ " (rotated)"`),
   description, rate / burst / quota / period, user-binding,
   permissions, and scopes, invoke `CreateAPIKey` to mint
   the replacement, then mark the old key
   `Status = APIKeyStatusRotated` and set its `RotatedFrom`
   pointer to the new key's id. Increment `api_key.rotated`.
   Emit the catalogued `api_key.rotated` event with both
   ids in the payload.
2. **`RevokeAPIKey(keyID, reason)`** — read the key, set
   `Status = APIKeyStatusRevoked`, persist, increment
   `api_key.revoked`. Emit the catalogued `api_key.revoked`
   event with the supplied `reason`.
3. **`DeleteAPIKey(keyID)`** — hard delete via the generic
   CRUD service. Reserved for cleanup of test fixtures or
   demo keys; production keys **shall** be revoked rather
   than deleted to preserve audit lineage.

The rotate path **shall** copy permissions, scopes, and
user-binding verbatim — operators rotate to refresh secret
material without touching authorisation surface.

## Rationale

Rotate and revoke are the credential-lifecycle's two
fundamentally different motivations:

1. **Rotate is hygiene; preserve everything except the secret.**
   Scheduled rotation should not require re-applying
   permissions. The "(rotated)" suffix in the name +
   `RotatedFrom` pointer creates an unambiguous timeline; the
   old key is left as `Rotated` rather than deleted so any
   client that hasn't picked up the new token yet gets a
   typed-failure (validate returns `Valid: false`) instead
   of a silent success against a dangling row.
2. **Revoke is incident response; preserve nothing except the
   audit trail.** A leaked key is taken out of service
   immediately by status flip; the row stays so the audit
   ledger can join against it for forensics.
3. **Delete is reserved for fixtures.** A key with usage rows
   cannot be cleanly hard-deleted; the FK in the usage
   table either cascades (losing forensic data) or blocks
   (operator confusion). Production keys go through revoke.

The rotate→old-status flip is intentionally a separate write
from the new key's create — if the new-key create succeeds and
the old-status flip fails, the operator has *both* keys live
temporarily. That is the safer failure mode (no auth outage)
and the wrapped error makes the discrepancy visible.

## Acceptance criteria

- **AC-1 — Rotate creates new + flips old.** A successful
  `RotateAPIKey` produces a new active key carrying the same
  permissions / scopes / user-binding, and the old key now
  has `Status == APIKeyStatusRotated` with
  `RotatedFrom = new_key_id`.
- **AC-2 — Rotate copies authorization fields verbatim.**
  The new key's `Permissions` and `Scopes` (after
  re-normalisation through
  `authz.NormalizePermissionTokens`) match the old key's
  persisted values.
- **AC-3 — Rotate emits the catalogued event.** The
  `api_key.rotated` event payload carries both
  `oldKeyId` and `newKeyId` and the issuing tenant id.
- **AC-4 — Revoke flips status without deleting row.**
  After `RevokeAPIKey`, the row exists with
  `Status == APIKeyStatusRevoked`; the
  `api_key.revoked` event carries the supplied `reason`.
- **AC-5 — Revoked keys fail validate.** A subsequent
  `ValidateAPIKey` against the revoked token returns
  `Valid: false` (REQ-APIKEY-011 AC-3 closes the loop).
- **AC-6 — Delete hard-removes.** `DeleteAPIKey`
  removes the row; subsequent reads return the
  repository's `ErrNotFound`. Documented as fixture-only.
- **AC-7 — Counters increment per transition.** Rotate
  bumps `api_key.rotated`; revoke bumps `api_key.revoked`;
  delete bumps `api_key.deleted` (via the underlying
  generic CRUD's instrumentation).

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Inspection | `service.go::RotateAPIKey` lines 443–528 — fetches old, builds `CreateAPIKeyRequest` from old fields, calls `CreateAPIKey`, flips old `Status = APIKeyStatusRotated` with `RotatedFrom = newID`. Dedicated rotation-link test pending. |
| AC-2 | Inspection | `service.go::RotateAPIKey` lines 470–485 — old `Permissions` and `Scopes` are unmarshalled, normalised through `authz.NormalizePermissionTokens`, and re-applied to the new key. Dedicated permission-copy test pending. |
| AC-3 | Inspection | `service.go::RotateAPIKey` lines 510–525 — `event.NewEventWithContext("api_key.rotated", ...)` carries `oldKeyId` + `newKeyId` in payload. Dedicated event-emission test pending. |
| AC-4 | Inspection | `service.go::RevokeAPIKey` lines 625–664 — `apiKey.Status = APIKeyStatusRevoked` + `eventBus.Publish` of `api_key.revoked` with `reason`. Dedicated test pending. |
| AC-5 | Inspection | `service.go::ValidateAPIKey` lines 555–558 — `apiKey.IsActive()` returns false for `APIKeyStatusRevoked`; `service_test.go::TestAPIKey_IsActive_RevokedStatus` covers the predicate. The end-to-end revoke→validate-fail sequence is gap-tracked. |
| AC-6 | Inspection | `service.go::DeleteAPIKey` lines 667–679 — `s.apiKeyService.Delete(ctx, keyID.String())` hard-removes via the underlying generic CRUD service. |
| AC-7 | Inspection | `service.go::RotateAPIKey` line 494 — `s.metrics.Inc(ctx, "api_key.rotated", nil)`; `RevokeAPIKey` line 641 — `api_key.revoked` counter. Dedicated counter assertions pending. |

## Edge cases & unhappy paths

- **Rotate on already-rotated key.** The repository allows
  the read; the new-key create succeeds; the old-key
  `RotatedFrom` is overwritten with the *latest* rotation.
  The rotation chain is not deeply traversable — only the
  immediate predecessor is recorded.
- **Rotate fails between new-create and old-flip.** Two
  active keys exist; the operator sees the wrapped error
  `mark old key %s as rotated: %w` and can manually flip
  the old key.
- **Revoke on already-revoked key.** Idempotent at the
  repository layer; the metric still increments and the
  event still emits (the `reason` may be different).
- **Revoke on rotated key.** Allowed; a rotated-then-revoked
  key shows both states in the audit ledger via the
  `Status` history (where supported by the persistence
  layer).
- **Delete with usage rows.** Repository may cascade or
  block — operators are expected to revoke instead.
- **Concurrent rotate and revoke.** Last-write-wins; the
  status field can land as either `Rotated` or `Revoked`.

## Risk

- **Likelihood:** Medium — scheduled rotation +
  incident-driven revokes.
- **Impact:** Critical — a key that rotates without the new
  token reaching the client causes auth outage; a key that
  fails to revoke leaves a leaked credential live.
- **Mitigations:** Two-step rotate that prefers transient
  dual-active over auth outage (AC-1), status-flip revoke
  that preserves audit lineage (AC-4), validate-side
  refusal for non-active states (AC-5).

## Implements (cross-cutting)

- **REQ-001 — Multi-tenant isolation.** Indirect — the
  rotate copies the tenant binding; revoke preserves it.
- **REQ-004 — Audit per mutation.** AC-3 + AC-4 emit the
  catalogued events.
- **REQ-009 — Observability.** AC-7 — counters per
  transition.

## Compliance mapping

| Control | Coverage |
|---|---|
| SOC2 CC6.1 (Logical access) | AC-4 — revoked keys removed from access. |
| SOC2 CC6.7 (Restrict information access) | AC-3 + AC-4 — every lifecycle change auditable. |
| ISO27001 A.9.4.3 (Password management system) | AC-1 — credential rotation primitive. |
| NIST IA-5 (Authenticator management) | AC-1 + AC-4 — rotation + revocation lifecycle controls. |

## Satisfied by

- `modules/platformkit-business-modules/api_key_management/features/key_management/service.go::RotateAPIKey, RevokeAPIKey, DeleteAPIKey`.

## Related requirements

- [REQ-APIKEY-001 — Key management](./REQ-APIKEY-001-key-management.md)
- [REQ-APIKEY-010 — API key create](./REQ-APIKEY-010-api-key-create.md)
- [REQ-APIKEY-011 — API key validate](./REQ-APIKEY-011-api-key-validate.md) — the consumer that refuses non-active keys.
