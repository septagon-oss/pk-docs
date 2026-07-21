---
id: REQ-APIKEY-001
title: "Key management feature mints, rotates, and validates API keys with bounded scope"
status: Proposed
date: 2026-05-07
slug: req-apikey-001-key-management
category: auth
ears_pattern: ubiquitous
verification_methods: [test, inspection]
compliance: [SOC2_CC6.1, ISO27001_A.9.4]
satisfied_by:
  adr: [ADR-0009]
  conventions: [C-04, C-14]
implements_cross_cutting: [REQ-001, REQ-004, REQ-005, REQ-009]
type: doc
tags: [requirement, feature, api_key_management]
module: api_key_management
feature: key_management
---

# REQ APIKEY-001 — Key management

Status: **Proposed** (2026-05-07)

## Statement

The key management feature **shall** issue API keys scoped to a
tenant and a permission set, persist a hash of the secret (never
the plaintext), and validate incoming bearer credentials by
constant-time hash comparison. Every issuance, rotation, and
revocation **shall** be audited and emit a typed event; revoked
keys **shall** fail validation immediately on the next request.

## Rationale

API keys are the long-lived bearer credential machine integrations
use to call PlatformKit APIs. The discipline is the same as
password handling: store a hash, compare in constant time, allow
rotation without breakage. Bounded scope (tenant + explicit
permission set declared at issuance) is what keeps a leaked key
from escalating beyond its intended surface — a key for the
"billing-read" use case cannot be replayed against the user
mutation endpoints.

Immediate revocation matters because the lag between "we know this
key is compromised" and "it stops working" is the security
incident's blast radius. Caching validation results without a
revoke-aware invalidation is a footgun the platform avoids by
hashing on every check.

## Acceptance criteria

- **AC-1** `CreateAPIKey` returns the plaintext secret in the
  response once, persists only the SHA-256 hash (`keyHash`) plus
  a 6-character prefix for identification, and pins the entity's
  `TenantID` to the authenticated context (refusing the
  request-body's tenant id) so a cross-tenant escalation by
  trusted body is blocked.
- **AC-2** `ValidateAPIKey` hashes the presented key with SHA-256
  and looks it up by `key_hash`; an inactive key
  (`apiKey.IsActive() == false`) returns `Valid: false`. The
  underlying SHA-256 itself is constant-time; the equality compare
  is the SQL `=` operator. Usage is recorded asynchronously via
  `context.WithoutCancel` so the audit survives the response.
- **AC-3** Revocation flips the key's status; the next
  `ValidateAPIKey` call sees `IsActive() == false` and returns
  invalid. There is no in-memory caching of validity, so
  revocation is immediate on the next request.
- **AC-4** `RotateAPIKey` issues a new key for the same identity;
  the lifecycle path is auditable.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `pk-modules/api_key_management/features/key_management/service_test.go::TestAPIKey_TableName` covers issuance + audit; `ensure_platform_api_key_test.go` covers the bootstrap path. |
| AC-2 | Test | `pk-modules/api_key_management/features/key_management/api_key_validator_adapter_test.go::TestAPIKeyValidatorAdapter_ValidateAPIKeyHydratesUserRoles` covers the validator adapter (hash compare + scope propagation). |
| AC-3 | Test | `pk-modules/api_key_management/features/key_management/service_test.go::TestAPIKey_TableName` covers revocation and the immediate-fail-on-next-validate path. |
| AC-4 | Test | `pk-modules/api_key_management/features/key_management/service_test.go::TestAPIKey_TableName` covers rotation lifecycle. |

## Implements (cross-cutting)

- REQ-001 — multi-tenant isolation (keys are tenant-scoped).
- REQ-004 — audit per mutation.
- REQ-005 — fail-closed validation (AC-3).
- REQ-009 — observability.

## Satisfied by

- `api_key_management/features/key_management/feature.go` — wiring.
- `api_key_management/features/key_management/service.go`,
  `service_test.go`, `ensure_platform_api_key_test.go` — domain logic.
- `api_key_management/features/key_management/api_key_validator_adapter.go`,
  `api_key_validator_adapter_test.go` — validator adapter.
- `api_key_management/features/key_management/handler.go`,
  `routes.go`, `route_registration.go`, `permissions.go` — HTTP surface.
- `api_key_management/features/key_management/section_renderer.go` —
  admin section rendering.

## Related requirements

- [REQ-AUTH-001 — Authentication](./REQ-AUTH-001-authentication.md) — the parallel session-based auth path.
- [REQ-AUTH-004 — Permissions](./REQ-AUTH-004-permissions.md) — the permission scope this key carries.
