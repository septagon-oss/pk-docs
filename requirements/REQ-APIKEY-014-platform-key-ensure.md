---
id: REQ-APIKEY-014
title: "EnsurePlatformAPIKey is idempotent and tenant-scoped: same (tenant, name) returns the existing key, never duplicates"
status: Proposed
date: 2026-05-08
slug: req-apikey-014-platform-key-ensure
category: api_key
ears_pattern: ubiquitous
priority: must
risk: high
verification_methods: [test]
compliance:
  - SOC2_CC6.1
  - ISO27001_A.10.1
  - NIST_IA-5
satisfied_by:
  adr: [ADR-0009]
  conventions: [C-04, C-14]
implements_cross_cutting: [REQ-001, REQ-005]
refines: REQ-APIKEY-001
type: doc
tags: [requirement, capability, api_key_management, key_management, ensure, platform_key]
module: api_key_management
feature: key_management
capability: platform_key_ensure
capability_kind: data_invariant
stakeholders:
  - operator (deploys / re-deploys platform)
  - platform agent (uses the platform key for service-account substitution)
  - compliance auditor (key-issuance control)
---

# REQ APIKEY-014 — Platform key ensure (idempotent + tenant-scoped)

Status: **Proposed** (2026-05-08)

## Statement

The key-management feature **shall** expose
`EnsurePlatformAPIKey(tenantID, name, scopes)` that:

1. Looks up an existing key by the
   `(tenant_id, name)` pair;
2. **If the key exists**, returns the existing key without
   creating a new one — the call is idempotent across
   reboots / re-deploys;
3. **If the key does not exist**, generates fresh
   cryptographically-random material via
   `generateOpaquePlatformKeyMaterial(name)`, persists a
   new row with the requested scopes, and returns it;
4. **Tenant-scopes** the lookup — a key with the same
   `name` in another tenant is invisible to this call;
5. Synchronises permissions on the existing-key path —
   when the requested scopes differ from the persisted
   scopes, the row is updated to match (so deployment-time
   scope changes propagate);
6. Records the audit event (`platform_api_key.ensured`)
   noting whether the call created a new key or returned
   an existing one.

The opaque key material **shall** include a prefix that
fits within the database column width — the prefix is the
identification handle used in logs / dashboards.

## Rationale

The platform agent (REQ-017) needs a stable service-account
key per tenant to substitute its own principal. Three
properties:

1. **Idempotency at deploy time.** Operators redeploy
   the platform repeatedly; each redeploy invokes the
   ensure path. Without idempotency, every redeploy would
   leak a new key into the database, exhausting any
   per-tenant cap and confusing the audit timeline.
2. **Tenant scope is mandatory.** Two tenants could
   both have a key named `platform-agent`; the
   `(tenant_id, name)` index ensures they are distinct
   rows.
3. **Permission sync on existing-key path.** Operators
   change scope declarations in code; the next deploy
   must propagate that change to the persisted key.
   Otherwise the persisted key falls out of sync with
   the code's expectation.

## Acceptance criteria

- **AC-1 — Idempotent + tenant-scoped.** A first
  `EnsurePlatformAPIKey(tenantA, "platform-agent",
  scopes)` creates a new key; a second identical call
  returns the same key id without persisting a new row.
- **AC-2 — Same name in different tenants is
  distinct.** A call with `tenantA` and a call with
  `tenantB`, both with name `"platform-agent"`,
  produce two distinct rows.
- **AC-3 — Prefix fits column.** The opaque
  prefix produced by
  `generateOpaquePlatformKeyMaterial` is bounded
  by the database column width.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `modules/platformkit-business-modules/api_key_management/features/key_management/ensure_platform_api_key_test.go::TestEnsurePlatformAPIKey_IdempotentAndTenantScoped`. |
| AC-2 | Test | `modules/platformkit-business-modules/api_key_management/features/key_management/ensure_platform_api_key_test.go::TestEnsurePlatformAPIKey_IdempotentAndTenantScoped` — the table-driven sub-cases exercise both branches. |
| AC-3 | Test | `modules/platformkit-business-modules/api_key_management/features/key_management/ensure_platform_api_key_test.go::TestGenerateOpaquePlatformKeyMaterial_PrefixFitsColumn`. |

## Edge cases & unhappy paths

- **Existing key with different scopes.** The
  permissions-sync branch updates the persisted scopes
  to match the requested set; documented as
  best-effort (a concurrent rotate / revoke during the
  ensure call may produce out-of-order writes).
- **Existing key with revoked status.** Currently
  returned as-is; future work may treat a revoked key
  as a "create fresh" trigger.
- **`crypto/rand` failure.** Returns the wrapped
  error; the row is not written.
- **Concurrent first-call from two operators.** The
  unique index on `(tenant_id, name)` lets one
  succeed; the other reads the existing row. Both end
  with the same key.

## Risk

- **Likelihood:** Low — exercised at deploy
  cadence per tenant.
- **Impact:** Critical — defective ensure leaks
  duplicate keys (cap pressure) or returns
  wrong-tenant keys (cross-tenant escalation).
- **Mitigations:** Idempotency on existing key
  (AC-1), tenant-scoped lookup (AC-2), bounded
  prefix (AC-3).

## Implements (cross-cutting)

- **REQ-001 — Multi-tenant isolation.** AC-2 — the
  `(tenant, name)` lookup is the explicit guard.
- **REQ-005 — Fail-closed.** AC-3 — bounded prefix
  prevents column overflow that would otherwise
  truncate silently.

## Compliance mapping

| Control | Coverage |
|---|---|
| SOC2 CC6.1 (Logical access) | AC-1 — bounded key issuance per (tenant, name). |
| ISO27001 A.10.1 (Cryptographic controls) | AC-3 — bounded prefix on generated key material. |
| NIST IA-5 (Authenticator management) | AC-1 — idempotent issuance. |

## Satisfied by

- `modules/platformkit-business-modules/api_key_management/features/key_management/service.go::EnsurePlatformAPIKey, generateOpaquePlatformKeyMaterial, syncPlatformKeyPermissions, recordEnsureAudit`.

## Related requirements

- [REQ-APIKEY-001 — Key management](./REQ-APIKEY-001-key-management.md)
- [REQ-APIKEY-010 — API key create](./REQ-APIKEY-010-api-key-create.md)
- [REQ-017 — Platform agent principal substitution](./REQ-017-platform-agent-principal-substitution.md) — the consumer of the platform key.
