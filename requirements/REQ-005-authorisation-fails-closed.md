---
id: REQ-005
title: "Authorisation gates fail closed under transient errors"
status: Active
date: 2026-05-06
slug: req-005-authorisation-fails-closed
category: auth
ears_pattern: unwanted-behaviour
verification_methods:
  - test
compliance:
  - SOC2_CC6.1
satisfied_by:
  adr: []
  conventions: []
type: doc
tags: [requirement, auth, security]
---

# REQ 005 — Authorisation gates fail closed under transient errors

Status: **Active** (2026-05-06)

## Statement

**If** an authorisation gate (token revocation, tenant membership,
field-level permission, policy lookup, or repository tenant-scope
injection) cannot reach its backing store, **then** the system **shall**
reject the request, never permit it. Timeout, connection failure, or
unexpected error in the gate **shall** be treated as "deny".

## Rationale

The opposite posture — allowing requests when the gate can't be checked
— is how revoked credentials keep working through Redis outages, why
dropped tenant-membership checks expose customer A's data to customer
B, and why policy-frozen rollouts get bypassed during a database hiccup.
The discipline isn't a per-feature preference; it's the only correct
posture under the threat model the platform is designed for.

The cost of "fail closed" is operational: when a check fails its
backing store, legitimate users see auth errors. We accept that cost
because the alternative is silent compromise.

## Acceptance criteria

- **AC-1** The JWT middleware's revocation check returns 401 with
  header `X-Revocation-Check: error` when the revocation store is
  unreachable; the request is never allowed through.
- **AC-2** The tenant-membership verifier rejects the request when
  it returns any error, including timeout — the configured verifier
  has no "best effort" mode.
- **AC-3** The repository's `scopedDB` refuses to issue a query when
  the request has no resolvable tenant context and the entity is
  tenant-scoped.
- **AC-4** Policy-rollout gates (canary, freeze) treat repository
  errors as "frozen" — the canary cannot proceed without the gate
  reading clean.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `platformkit-backend-kit/security/authn/jwt_middleware_test.go::TestPassesRevocationCheck_FailsClosedOnStoreError` |
| AC-2 | Test | `platformkit-backend-kit/security/authn/jwt_middleware_tenant_test.go::TestPassesTenantMembership_RejectsOnVerifierError` |
| AC-3 | Test | `platformkit-backend-kit/core/entity/repository/gorm_security_test.go::TestScopedDB_RefusesUnscopedQuery` |
| AC-4 | Inspection | `pk-modules/auth_management/features/policy/service_rollout.go::IsFrozen` — repository read errors are treated as `frozen=true`. **Verification gap: a dedicated rollout-gate-fail-closed test is pending.** |

## Satisfied by

- `platformkit-backend-kit/security/authn/jwt_middleware_steps.go` —
  the JWT middleware's `passesRevocationCheck` and
  `passesTenantMembership` helpers that explicitly reject on store
  error.
- `pk-modules/auth_management/features/policy/service_rollout.go` —
  the rollout gate that treats backend errors as "frozen".
- `platformkit-backend-kit/core/entity/repository/gorm_authz.go` —
  `scopedDB`'s refusal to issue an unscoped query.

## Compliance traceability

- **SOC2_CC6.1** — logical access controls. Fail-closed gates are
  evidence for the access-control criterion under degraded
  conditions.

## Related requirements

- [REQ-001 — Multi-tenant isolation](./REQ-001-multi-tenant-isolation.md) —
  the persistence-layer fail-closed posture.

## References

- "Build Security In" — fail-closed defaults as a security
  invariant.
