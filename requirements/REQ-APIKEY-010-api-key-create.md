---
id: REQ-APIKEY-010
title: "API key create generates random material, stores only the SHA-256 hash, and pins the tenant from the request context"
status: Proposed
date: 2026-05-08
slug: req-apikey-010-api-key-create
category: api_key
ears_pattern: event-driven
priority: must
risk: critical
verification_methods: [test, analysis]
compliance:
  - SOC2_CC6.1
  - SOC2_CC6.7
  - ISO27001_A.9.4.3
  - ISO27001_A.10.1
  - NIST_IA-5
satisfied_by:
  adr: [ADR-0009]
  conventions: [C-04, C-14]
implements_cross_cutting: [REQ-001, REQ-003, REQ-004, REQ-009]
refines: REQ-APIKEY-001
type: doc
tags: [requirement, capability, api_key_management, key_management, create]
module: api_key_management
feature: key_management
capability: api_key_create
capability_kind: data_invariant
stakeholders:
  - tenant administrator (provisions integration credentials)
  - operator (rotation + issuance)
  - compliance auditor (key-issuance control)
---

# REQ APIKEY-010 — API key create

Status: **Proposed** (2026-05-08)

## Statement

**When** a caller invokes `Service.CreateAPIKey(req)`, the
key-management feature **shall**:

1. Generate `s.config.KeyLength` bytes of cryptographically
   random material via `crypto/rand`;
2. Concatenate `s.config.KeyPrefix` + the base64-URL-encoded
   random bytes to form the user-visible token (the only time
   the full token is observable);
3. Compute `sha256(token)` and persist only the hex-encoded
   hash in `KeyHash`; the raw token **shall not** be written
   to any persistent store;
4. Extract a short prefix (`KeyPrefix + first 6 chars`) for
   display + identification;
5. **Pin** `apiKey.TenantID` from the authenticated context
   (`GetTenantIDFromContext`) — the request body's
   `TenantID` is **not** trusted; a missing tenant context
   returns the typed `no authenticated tenant in context`
   error before any DB write;
6. Apply the optional fields (`UserID`, `ExpiresIn`,
   `RateLimit`, `BurstLimit`, `QuotaLimit`, `QuotaPeriod`)
   when present; defaults come from the service config when
   absent;
7. Normalise + serialise `Permissions` and `Scopes` through
   `authz.NormalizePermissionTokens`; persist as JSON;
8. Return a `*APIKeyResponse` carrying both the persisted
   `*APIKey` (for the metadata) and the *raw* full token
   (for one-time display); subsequent reads return only the
   metadata.

## Rationale

API keys are bearer credentials — they bypass interactive auth,
they're long-lived, and they are typically copied into CI / CD
configs that the operator does not control. Three load-bearing
properties:

1. **Hash-only persistence.** Storing the raw token is a
   credential-leak vector at every layer (DB backups, snapshot
   exports, replication streams, BI dashboards). The hash is
   one-way; even a full DB dump cannot be replayed without the
   live token.
2. **Tenant from context, not body.** Trusting the request body
   would let a tenant-A admin create a key bound to tenant B —
   a cross-tenant privilege escalation against any deployment
   whose `api_keys` table is not registered with
   `WithTenantScoping`. The authenticated context is the only
   trustworthy source.
3. **Permissions normalised at write-time.** Tokens are
   normalised through `authz.NormalizePermissionTokens` so a
   key written with `users.read` is equivalent to one written
   with a canonical `users:read` token — the governed decision seam
   (REQ-AUTH-040) receives one unambiguous resource/action pair.

The full token is returned exactly once; subsequent reads
expose only the prefix. Operators who lose the token must
rotate (REQ-APIKEY-011) — there is no recovery path.

## Acceptance criteria

- **AC-1 — Random + prefixed + hashed.** A `CreateAPIKey`
  call produces a token of the form
  `<KeyPrefix><base64-url-32-bytes>`; only the hex-encoded
  SHA-256 of that token is persisted in `KeyHash`.
- **AC-2 — Tenant from context, not body.** A call from a
  context whose tenant id is `tenantA` produces a key with
  `TenantID == tenantA`; the request body's `TenantID` field
  (if any) is **ignored**.
- **AC-3 — Missing tenant context refused.** A call from a
  context with no resolvable tenant returns
  `no authenticated tenant in context` and writes nothing.
- **AC-4 — Defaults from config.** Fields not supplied by
  the request (`RateLimit`, `BurstLimit`, `QuotaPeriod`)
  are populated from the service config; this is the
  documented per-deployment policy surface.
- **AC-5 — Permissions normalised + persisted.** A request
  with mixed-case permission tokens persists the lower-case
  canonical form (verified by reading the row back).
- **AC-6 — Response carries one-time token + metadata.**
  `*APIKeyResponse` contains the full token in its `Token`
  field; the contained `*APIKey` carries only the hash and
  metadata.
- **AC-7 — Audit + counter on success.** A successful
  create increments the `api_key.created` counter and emits
  the catalogued `api_key.created` event with the resulting
  id + tenant.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Inspection | `service.go::CreateAPIKey` lines 161–171 — `crypto/rand.Read`, base64-URL encoding, `sha256.Sum256` over the full token, hex-encoded `KeyHash`. The platform-key analogue is exercised by `ensure_platform_api_key_test.go::TestGenerateOpaquePlatformKeyMaterial_PrefixFitsColumn`; dedicated `CreateAPIKey` random-and-hash test pending. |
| AC-2 | Inspection | `service.go::CreateAPIKey` lines 182–198 — `apiKey.TenantID = authnTenantID` after the context read; the request body's `TenantID` is never assigned to the entity. Dedicated cross-tenant-pin test pending. |
| AC-3 | Inspection | `service.go::CreateAPIKey` lines 183–185 — `if authnTenantID == ""` returns the typed error before any DB write. Dedicated test pending. |
| AC-4 | Inspection | `service.go::CreateAPIKey` lines 192–225 — `apiKey.RateLimit = s.config.DefaultRateLimit` etc. when the request-body field is nil. Dedicated defaults-from-config test pending. |
| AC-5 | Inspection | `service.go::CreateAPIKey` lines 228–238 — `authz.NormalizePermissionTokens` is the canonicaliser; the platform-key path's normalisation is exercised by `ensure_platform_api_key_test.go::TestEnsurePlatformAPIKey_IdempotentAndTenantScoped`. |
| AC-6 | Inspection | `service.go::CreateAPIKey` return statement — the response carries the full token; subsequent reads (`GetAPIKey`, `ListAPIKeys`) return only the `*APIKey` metadata. The shape is the source of truth. |
| AC-7 | Inspection | `service.go::CreateAPIKey` event-publish lines — the catalogued `api_key.created` event is emitted via `event.PublishBestEffort`. Dedicated event-emission test pending. |

## Edge cases & unhappy paths

- **`crypto/rand` failure.** A `rand.Read` failure returns
  the wrapped error; the row is not written.
- **Permission-token validation failure.** An unknown or
  malformed permission token returns the wrapped
  validation error before persistence.
- **Concurrent create with same name.** The repository's
  uniqueness on `(tenant_id, name)` (where applicable)
  surfaces; the service does not pre-check.
- **Negative or zero `ExpiresIn`.** Currently treated as
  "never expires" (no `ExpiresAt` set) when nil; an
  explicit zero-duration would set `ExpiresAt = now`
  (immediate expiry). Documented quirk.
- **Quota fields supplied but rate-limit missing.**
  Defaults from config fill the gap; the resulting row is
  internally consistent.

## Risk

- **Likelihood:** Medium — every integration onboarding.
- **Impact:** Critical — a leaked key bypasses interactive
  auth entirely.
- **Mitigations:** Hash-only persistence (AC-1) + tenant
  pinning (AC-2 + AC-3) + permission-normalisation
  (AC-5). The one-time-display response (AC-6) ensures the
  raw token is observable only at issuance.

## Implements (cross-cutting)

- **REQ-001 — Multi-tenant isolation.** AC-2 + AC-3 are the
  enforcement.
- **REQ-003 — No account enumeration.** Indirect — the
  hashed-storage discipline means a DB read cannot reverse
  to a usable token.
- **REQ-004 — Audit per mutation.** AC-7 — catalogued
  event.
- **REQ-009 — Observability.** AC-7 — counter.

## Compliance mapping

| Control | Coverage |
|---|---|
| SOC2 CC6.1 (Logical access) | AC-2 — every key bound to its issuing tenant. |
| SOC2 CC6.7 (Restrict information access) | AC-1 — hash-only persistence prevents replay from backups. |
| ISO27001 A.9.4.3 (Password management system) | AC-1 — credential storage uses one-way hashing. |
| ISO27001 A.10.1 (Cryptographic controls) | AC-1 — SHA-256 storage hash, `crypto/rand` material generation. |
| NIST IA-5 (Authenticator management) | AC-1 + AC-7 — provisioning + accountability. |

## Satisfied by

- `modules/platformkit-business-modules/api_key_management/features/key_management/service.go::CreateAPIKey`.
- `modules/platformkit-business-modules/api_key_management/features/key_management/service.go::GetTenantIDFromContext` — context resolution helper.
- `platformkit-backend-kit/api/auth/authz` — permission-token normalisation.

## Related requirements

- [REQ-APIKEY-001 — Key management](./REQ-APIKEY-001-key-management.md)
- [REQ-APIKEY-011 — API key validate](./REQ-APIKEY-011-api-key-validate.md) — the consumer that recomputes the hash.
- [REQ-APIKEY-012 — API key rotate + revoke](./REQ-APIKEY-012-api-key-rotate-revoke.md) — the lifecycle transitions for issued keys.
- [REQ-APIKEY-013 — API key rate limit](./REQ-APIKEY-013-api-key-rate-limit.md) — the per-key throttle this surface configures.
