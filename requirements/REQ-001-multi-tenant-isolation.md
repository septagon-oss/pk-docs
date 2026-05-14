---
id: REQ-001
title: "Multi-tenant isolation at every persistence boundary"
status: Active
date: 2026-05-06
slug: req-001-multi-tenant-isolation
category: tenancy
ears_pattern: unwanted-behaviour
verification_methods:
  - test
  - analysis
compliance:
  - SOC2_CC6.1
  - ISO27001_A.9.4
satisfied_by:
  adr: [ADR-0009]
  conventions: [C-04]
type: doc
tags: [requirement, tenancy, security]
---

# REQ 001 — Multi-tenant isolation at every persistence boundary

Status: **Active** (2026-05-06)

## Statement

**If** a query is issued against a tenant-scoped table or document, **then**
the persistence layer **shall not** resolve any row whose `tenant_id`
differs from the request context's tenant, **unless** the context carries
an explicit cross-tenant access marker as defined by REQ-007.

## Rationale

PlatformKit is a multi-tenant SaaS framework: every paying client runs
their data in the same database alongside every other client. A bug
that quietly resolves a row to the wrong tenant doesn't fail loudly —
it presents another tenant's data to the requester as if it were their
own. That is the worst possible failure mode: silent data exposure that
the system reports as success.

The requirement has to hold at the persistence boundary, not at the
HTTP edge. Multiple code paths land in the same repository — JSON APIs,
HTML form handlers, NATS bridges, batch jobs, admin tools — and any of
them can fail to scope the query. The defence has to be local to the
SQL layer so a missing scope upstream doesn't reach production data.

Enterprise tenants and SOC 2 auditors require demonstrable evidence of
this property. "It's enforced at the handler" is not sufficient evidence
under CC6.1; the persistence-layer enforcement is what passes the
review.

## Acceptance criteria

- **AC-1** A `SELECT` against a tenant-scoped table issued through the
  GormTable repository emits `WHERE tenant_id = $context_tenant_id` to
  the database when the context carries no cross-tenant marker.
- **AC-2** A `SELECT`, `UPDATE`, or `DELETE` issued with a context that
  has neither a tenant ID nor an explicit cross-tenant marker is
  rejected with `errors.ErrCodeUnauthorized` before any SQL is sent.
- **AC-3** When the context carries a cross-tenant marker
  (`appcontext.WithExpectedCrossTenantAccess`), the same query proceeds
  but the session-injected `platformkit.cross_tenant_access` setting is
  set to `true` so the audit trail captures the transition.
- **AC-4** The `tenant_id` value seen by the database is the value
  resolved from the request context — never the raw JWT claim, never
  a default. JWT claims are validated against the membership verifier
  (REQ-007 / ADR-0009) before being promoted to the persistence
  context.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `platformkit-backend-kit/core/entity/repository/gorm_security_test.go::TestScopedDB_AppliesTenantFilter` |
| AC-2 | Test | `platformkit-backend-kit/core/entity/repository/gorm_security_test.go::TestScopedDB_RejectsMissingTenantContext` |
| AC-3 | Test | `platformkit-backend-kit/core/entity/repository/gorm_tenant_test.go::TestScopedDB_HonoursCrossTenantMarker` |
| AC-4 | Test | `pk-modules/auth_management/features/authentication/service_test.go::TestAuthenticate_UsesCrossTenantLookupBeforeTenantMembershipResolution` exercises the membership-verification path; cross-tenant probing is rejected before session minting. **Verification gap: a dedicated tenant-override-without-membership test is pending.** |
| AC-2 | Analysis | `make check-module-deps` (run from `pk-modules`) — rejects business-module → business-module implementation imports that would bypass the tenant scope. |

## Satisfied by

- [ADR 0009 — ports-only cross-module communication](../adr/0009-ports-only-cross-module-communication.md) —
  prevents one module from reading another's database directly, which
  would bypass the scope.
- [Convention C-04 — Public contracts live away from their implementation](../conventions.md#c-04-public-contracts-live-away-from-their-implementation) —
  the discipline that keeps `contracts/provides/` import-safe so the
  scope is not bypassed.
- `platformkit-backend-kit/core/entity/repository/gorm_authz.go` — the
  GORM session-context injection that puts `platformkit.tenant_id` on
  every connection, plus the role and field-permission propagation
  that complements it.

## Compliance traceability

- **SOC2_CC6.1** — logical access controls. This REQ is the
  persistence-layer evidence for the multi-tenant access-control
  criterion.
- **ISO27001_A.9.4** — information access restriction. The
  cross-tenant marker (REQ-007) plus this REQ provide the
  segregation evidence.

## Related requirements

- [REQ-007 — Cross-tenant access is explicit and labelled](./REQ-007-explicit-cross-tenant-access.md) —
  the labelled escape hatch this REQ provides for.
- [REQ-005 — Authorisation gates fail closed under transient errors](./REQ-005-authorisation-fails-closed.md) —
  the broader fail-closed posture (e.g. unscoped queries are rejected).

## References

- May 2026 tenant-overlay cross-pollination defence-in-depth refactor
  (commit history under `tenant_management/features/tenant_lifecycle/`).
- `auth_management/features/authentication/login_resolution.go` —
  representative caller pattern.
