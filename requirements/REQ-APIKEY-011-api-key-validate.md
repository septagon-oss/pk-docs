---
id: REQ-APIKEY-011
title: "API key validate hashes the presented token, refuses inactive keys, and tracks usage on the success path"
status: Proposed
date: 2026-05-08
slug: req-apikey-011-api-key-validate
category: api_key
ears_pattern: event-driven
priority: must
risk: critical
verification_methods: [test, analysis]
compliance:
  - SOC2_CC6.1
  - SOC2_CC6.7
  - ISO27001_A.9.4
  - NIST_IA-5
satisfied_by:
  adr: [ADR-0009]
  conventions: [C-04, C-14]
implements_cross_cutting: [REQ-001, REQ-003, REQ-005, REQ-009]
refines: REQ-APIKEY-001
type: doc
tags: [requirement, capability, api_key_management, key_management, validate]
module: api_key_management
feature: key_management
capability: api_key_validate
capability_kind: failure_mode
stakeholders:
  - HTTP / gRPC entry points (validate every request)
  - operator (incident triage on suspicious traffic)
  - compliance auditor (credential-validation control)
---

# REQ APIKEY-011 — API key validate

Status: **Proposed** (2026-05-08)

## Statement

**When** a caller invokes `Service.ValidateAPIKey(req)` with the
raw token submitted on a request, the key-management feature
**shall**:

1. Compute `sha256(req.Key)` and look up the row by
   `KeyHash`;
2. **If** no row matches — return
   `ValidateAPIKeyResponse{Valid: false}` with no
   side-effects;
3. **If** the matched key is not active (revoked, expired,
   suspended, rotated) — return
   `ValidateAPIKeyResponse{Valid: false}` with no
   side-effects;
4. **Else** spawn a usage-tracking goroutine on a
   `context.WithoutCancel(ctx)`-derived context that:
   a. Persists an `APIKeyUsage` row with the request's
      resource + action;
   b. Updates the key's `LastUsedAt` + `UsageCount`
      counter;
   c. Logs at Warn (with structured fields) on either
      write failure — **shall not** swallow with `_, _ =`;
5. Parse + normalise the persisted permissions and scopes
   through `authz.NormalizePermissionTokens`;
6. Increment `api_key.validated`;
7. Return `ValidateAPIKeyResponse{Valid: true, KeyID,
   TenantID, Permissions, Scopes, ExpiresAt, UserID?}`.

The validate path **shall not** disclose distinct error
shapes for "no such key" vs "inactive key" — both are
`Valid: false` to deny key-enumeration via response shape.

## Rationale

Validation runs on every request that bears an API key — call
volumes are 100× the create / rotate cadence. Three
disciplines:

1. **Hash-side lookup.** The DB index is on `KeyHash`; a
   constant-time string equality is sufficient because the
   hash is fixed-length. (Timing-safe equality on tokens
   themselves is not relevant here — the hash is the index
   key.)
2. **Detached usage-tracking context.** The HTTP request
   context cancels the moment the response is written;
   without `context.WithoutCancel`, the usage row would
   race with response completion and frequently be lost.
   The detached context preserves tracing + tenant scope
   while surviving the response cycle.
3. **Warn on tracking failure, do not swallow.** Quota
   accounting and rate-limit decisions depend on the usage
   row landing. A silent `_, _ =` would let quota drift
   without the operator noticing; the structured Warn log
   surfaces the discrepancy in dashboards.

The response shape collapses both failure cases — unknown key
and inactive key — to the same `Valid: false`. A different
shape would let an attacker probe "is this key real?" without
the key being usable.

## Acceptance criteria

- **AC-1 — Hash lookup.** A successful validate finds the
  key by computing `sha256(req.Key)` and querying by
  `KeyHash`; the raw token does not appear in the query.
- **AC-2 — Unknown key uniform refusal.** A token whose
  hash does not match any row returns
  `Valid: false` with no permissions / scopes / metadata.
- **AC-3 — Inactive key uniform refusal.** A revoked or
  expired key returns `Valid: false` indistinguishable in
  shape from the unknown-key case.
- **AC-4 — Usage tracked on success.** A successful
  validate persists an `APIKeyUsage` row (asynchronously)
  with the request's `Resource` + `Action` and updates
  the key's `LastUsedAt` + `UsageCount`.
- **AC-5 — Usage failure logs Warn, validate succeeds.**
  When the usage write fails, the validate response is
  still `Valid: true` (validation is the load-bearing
  decision), but a structured Warn log is emitted with
  the key id + error.
- **AC-6 — Response carries authz envelope.** A
  successful validate populates `Permissions`, `Scopes`,
  `KeyID`, `TenantID`, `ExpiresAt`, and `UserID` (when
  the key is user-bound).
- **AC-7 — Counter on success only.** `api_key.validated`
  increments only when the response is `Valid: true`.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Inspection | `service.go::ValidateAPIKey` lines 535–537 — `sha256.Sum256([]byte(req.Key))` + hex encode + List by `key_hash`. The adapter-level happy path is covered by `modules/platformkit-business-modules/api_key_management/features/key_management/api_key_validator_adapter_test.go::TestAPIKeyValidatorAdapter_ValidateAPIKeySuccessWithoutUser`. |
| AC-2 | Test | `modules/platformkit-business-modules/api_key_management/features/key_management/service_test.go::TestAPIKeyValidatorAdapter_InvalidKeyReturnsError` — the adapter surface returns the `Valid: false` envelope as a typed error; the inner-service uniform-refusal branch is at `service.go::ValidateAPIKey` lines 549–551. |
| AC-3 | Inspection | `service.go::ValidateAPIKey` lines 555–558 — `apiKey.IsActive()` gates the response; `service_test.go::TestAPIKey_IsActive_RevokedStatus` and `TestAPIKey_IsActive_ExpiredByTime` exercise the underlying state predicate. |
| AC-4 | Inspection | `service.go::ValidateAPIKey` lines 565–586 — `context.WithoutCancel` + `go func()` writes the `APIKeyUsage` row and updates `LastUsedAt` + `UsageCount`. Dedicated async-tracking test pending. |
| AC-5 | Inspection | `service.go::ValidateAPIKey` lines 573–576 and 582–585 — `s.logger.Warn(...)` on each spawned write failure. Dedicated tracking-failure log test pending. |
| AC-6 | Inspection | `service.go::ValidateAPIKey` return statement — the `ValidateAPIKeyResponse` carries `Valid`, `KeyID`, `TenantID`, `Permissions`, `Scopes`, `ExpiresAt`, optional `UserID`. The shape is the source of truth. |
| AC-7 | Inspection | `service.go::ValidateAPIKey` lines 603–605 — `s.metrics.Inc(...)` runs only after the active-and-permissions branch has resolved. Dedicated counter-on-success-only test pending. |

## Edge cases & unhappy paths

- **Empty token.** `sha256("")` produces a deterministic hash
  that will not match any row; the response is `Valid:
  false`. The service does not pre-check empty input — the
  hash-and-look-up path is correct by construction.
- **Token with whitespace.** Hashed verbatim; the canonical
  form is the trimmed token but trimming is the caller's
  responsibility (typically the HTTP middleware).
- **Permission-token validation failure on read.** A row
  whose persisted permissions cannot be normalised (a
  deprecated-format token) returns `Valid: false` rather than
  surfacing the malformation.
- **User-bound key with deleted user.** The key still
  validates if its own `Status` is active; the user
  resolution happens upstream. Operators should rotate +
  revoke when the user record is removed.
- **Tracking goroutine leaks on shutdown.** The detached
  context survives the request but a process shutdown
  cancels its parent; the goroutine completes its single
  write and exits.

## Risk

- **Likelihood:** High — every authenticated API request.
- **Impact:** Critical — a defective validate either lets
  unknown / revoked keys through, or denies legitimate ones.
- **Mitigations:** Hash-side lookup (AC-1) + uniform-refusal
  shape (AC-2 + AC-3) + Warn-on-tracking-failure (AC-5).

## Implements (cross-cutting)

- **REQ-001 — Multi-tenant isolation.** Validation returns
  the bound tenant; downstream gates use it.
- **REQ-003 — No account enumeration.** AC-2 + AC-3 deny
  shape-based probing.
- **REQ-005 — Fail-closed.** AC-2 + AC-3 default-deny on
  any non-happy path.
- **REQ-009 — Observability.** AC-5 + AC-7 — Warn on
  drift, counter on success.

## Compliance mapping

| Control | Coverage |
|---|---|
| SOC2 CC6.1 (Logical access) | AC-3 — inactive keys cannot authenticate. |
| SOC2 CC6.7 (Restrict information access) | AC-1 — hash lookup, raw token never persisted. |
| ISO27001 A.9.4 (Access control) | AC-3 + AC-7 — only verified-and-active keys are accepted. |
| NIST IA-5 (Authenticator management) | AC-3 — credential lifecycle states honoured at validate time. |

## Satisfied by

- `modules/platformkit-business-modules/api_key_management/features/key_management/service.go::ValidateAPIKey`.
- `modules/platformkit-business-modules/api_key_management/features/key_management/api_key_validator_adapter.go` — the `ports.APIKeyValidator` adapter wrapping this surface.

## Related requirements

- [REQ-APIKEY-001 — Key management](./REQ-APIKEY-001-key-management.md)
- [REQ-APIKEY-010 — API key create](./REQ-APIKEY-010-api-key-create.md) — the issuance pair.
- [REQ-APIKEY-012 — API key rotate + revoke](./REQ-APIKEY-012-api-key-rotate-revoke.md) — the lifecycle this validate consults.
- [REQ-APIKEY-013 — API key rate limit](./REQ-APIKEY-013-api-key-rate-limit.md) — the second gate the same key passes through.
- [REQ-AUTH-040 — Permission check](./REQ-AUTH-040-permission-check.md) — the consumer of the returned permission set.
