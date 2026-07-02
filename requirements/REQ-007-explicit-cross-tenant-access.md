---
id: REQ-007
title: "Cross-tenant access is explicit and labelled"
status: Active
date: 2026-05-06
slug: req-007-explicit-cross-tenant-access
category: tenancy
ears_pattern: state-driven
verification_methods:
  - test
  - inspection
compliance:
  - SOC2_CC6.1
  - ISO27001_A.12.4
satisfied_by:
  adr: [ADR-0009]
  conventions: []
type: doc
tags: [requirement, tenancy, audit]
---

# REQ 007 — Cross-tenant access is explicit and labelled

Status: **Active** (2026-05-06)

## Statement

**While** a code path needs to read or write across tenant boundaries
(e.g. login lookup before the tenant is known, platform-admin operations,
audit reviews), the request context **shall** be stamped with an
explicit cross-tenant marker carrying a non-empty string label that
names the reason. The persistence layer **shall** admit the cross-tenant
query only when the marker is present; the audit boundary **shall**
record the label on the audit row.

## Rationale

REQ-001 gives the platform tenant isolation by default. Several
legitimate flows have to step outside that default:

- **Login lookup** — email-to-user happens before the tenant is known,
  because the user record is the source of the tenant.
- **Platform admin operations** — operators provisioning new tenants
  or moving users between tenants need cross-tenant reach by definition.
- **Showroom/demo flows** — seeded demo accounts may belong to a
  platform-tenant ID different from the request host.
- **Audit reads** — auditors investigating an incident need to see
  events across the tenants relevant to the investigation.

A blanket cross-tenant "off switch" would defeat REQ-001. The discipline
is finer-grained: each legitimate cross-tenant access declares itself
with a label that ends up in the audit trail. The system admits the
access; the trail proves it was intentional.

## Acceptance criteria

- **AC-1** `appcontext.WithExpectedCrossTenantAccess(ctx, "<reason>")`
  is the only path that opens cross-tenant reads at the repository
  layer. The reason argument is mandatory; a build-time check rejects
  empty-string callers.
- **AC-2** Every call site of `WithExpectedCrossTenantAccess` carries
  a short, scannable reason that names the flow
  (`"auth.login.user_lookup"`, `"audit.cross_tenant_review"`).
- **AC-3** When the marker is present, the repository's session-context
  injection sets `platformkit.cross_tenant_access=true` on the
  database connection; per-query warning logs are demoted to debug
  so labelled access doesn't flood the security WARN channel.
- **AC-4** The audit boundary records the supplied reason on the
  audit row associated with the cross-tenant operation. A reviewer
  scanning a year of audit data can produce a complete list of
  cross-tenant access flows by aggregating reason labels.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `platformkit-backend-kit/app/appcontext/cross_tenant_test.go::TestWithExpectedCrossTenantAccess_RejectsEmptyReason` |
| AC-2 | Inspection | Code-review checklist + planned `pkvet` analyzer that flags empty-string reason calls. |
| AC-3 | Test | `platformkit-backend-kit/core/entity/repository/gorm_tenant_test.go::TestScopedDB_HonoursCrossTenantMarker` |
| AC-4 | Inspection | The cross-tenant reason propagates from the request context to the audit row through the standard enrichment path documented in REQ-AUDIT-010 AC-1. **Verification gap: a dedicated `TestAuditEvent_CarriesCrossTenantReason` covering the field-propagation path is pending.** |

## Satisfied by

- [ADR 0009 — Ports-only cross-module communication](../adr/0009-ports-only-cross-module-communication.md) —
  the architectural decision that frames the persistence boundary
  this REQ fortifies.
- `platformkit-backend-kit/app/appcontext/cross_tenant.go` — the
  labelled marker API.
- `platformkit-backend-kit/core/entity/repository/gorm_authz.go` —
  the persistence-layer honour of the marker.
- `modules/platformkit-business-modules/auth_management/features/authentication/login_service.go`,
  `login_resolution.go`, `login_2fa.go` — representative callers.

## Compliance traceability

- **SOC2_CC6.1** — logical access controls. The labelled escape hatch
  is part of the segregation evidence.
- **ISO27001_A.12.4** — logging and monitoring. Reason labels on
  cross-tenant audit rows are the searchable evidence.

## Related requirements

- [REQ-001 — Multi-tenant isolation](./REQ-001-multi-tenant-isolation.md) —
  the default this REQ provides the labelled escape hatch for.
- [REQ-004 — Audit event per mutation](./REQ-004-audit-event-per-mutation.md) —
  the trail that records the labelled accesses.

## References

- May 2026 tenant-overlay cross-pollination defence-in-depth refactor.
