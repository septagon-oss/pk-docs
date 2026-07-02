---
id: REQ-TENANT-001
title: "Tenant lifecycle feature owns tenant creation, host-alias resolution, and deletion"
status: Proposed
date: 2026-05-07
slug: req-tenant-001-tenant-lifecycle
category: tenancy
ears_pattern: ubiquitous
verification_methods: [test, inspection]
compliance: [SOC2_CC6.1, ISO27001_A.9.4]
satisfied_by:
  adr: [ADR-0009]
  conventions: [C-04, C-14]
implements_cross_cutting: [REQ-001, REQ-004, REQ-007]
type: doc
tags: [requirement, feature, tenant_management]
module: tenant_management
feature: tenant_lifecycle
---

# REQ TENANT-001 — Tenant lifecycle

Status: **Proposed** (2026-05-07)

## Statement

The tenant lifecycle feature **shall** own the persistent record
for every tenant on the platform — creation, archival, deletion,
and the catalogue of host aliases that resolve a request URL to a
tenant id. Every host-alias lookup **shall** be deterministic
(same hostname → same tenant), and every lifecycle mutation
**shall** emit a typed event so downstream modules can react
(audit anchors actor metadata to tenant id, billing closes
subscriptions on archive, search re-indexes on rename).

## Rationale

Tenant identity is the root of the multi-tenant isolation
discipline (REQ-001) — every other module consults "what tenant am
I in?" before reading or writing a single row. The host-alias
table is the production resolver: a request to
`acme.example.com` finds the `acme` tenant via this feature, and
`appcontext.SetTenantInContext` carries the resolved id through
the rest of the stack. Without a deterministic resolver, two
hostnames could ambiguously resolve to two tenants, which is the
worst-case isolation breach.

Lifecycle events are how dependent modules stay consistent without
polling. A tenant archive emits `tenant.archived`, which billing
subscribes to so it can close active subscriptions, and which
search subscribes to so it can drop the tenant's indexed
documents. Polling instead would impose a fan-in load and a
recovery-window during which stale data is visible.

## Acceptance criteria

- **AC-1** Tenant create / update / delete operations are audited
  and emit typed events (`tenant.created`, `tenant.updated`,
  `tenant.deleted`) with the actor and the tenant id. The catalog
  also defines `tenant.member.added`, `tenant.member.removed`, and
  `tenant.settings.updated` for sub-aspect mutations.
- **AC-2** Host-alias resolution is deterministic: the same
  hostname returns the same tenant id (or "not found") on every
  call, regardless of order.
- **AC-3** Archival is non-destructive: `ArchiveTenant` flips the
  status to `archived` so the row stays queryable through
  cross-tenant admin paths but is rejected by the public host
  resolver (`ResolveTenantByHost`). `RestoreTenant` flips the
  status back to `active` and clears `ArchivedAt`. **Known gap.**
  An enforced second-phase hard-delete with a retention window is
  not implemented at the service level today; the inherited
  generic-CRUD `Delete` is reachable directly without the
  intermediate archival check.
- **AC-4** Host-alias creation rejects collisions: a hostname
  that already maps to a tenant cannot be re-mapped to a
  different one without first un-mapping the original.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `modules/platformkit-business-modules/tenant_management/features/tenant_lifecycle/service_test.go::TestIsTenantActive` covers create / archive / delete and asserts the corresponding events are published. |
| AC-2 | Test | `modules/platformkit-business-modules/tenant_management/features/tenant_lifecycle/tenant_domain_alias_repository_test.go::TestReconcile_InsertsNewHosts` exercises the alias-lookup paths against the in-memory repository. |
| AC-3 | Test | `modules/platformkit-business-modules/tenant_management/features/tenant_lifecycle/service_test.go::TestIsTenantActive` covers the `ArchiveTenant` → `RestoreTenant` round-trip; the hard-delete-after-retention guard is the documented gap. |
| AC-4 | Test | `modules/platformkit-business-modules/tenant_management/features/tenant_lifecycle/tenant_domain_alias_repository_test.go::TestReconcile_InsertsNewHosts` covers alias-collision rejection. |

## Implements (cross-cutting)

- REQ-001 — multi-tenant isolation (the resolver underwrites every
  downstream tenant scope).
- REQ-004 — audit per mutation (AC-1).
- REQ-007 — explicit cross-tenant access (lifecycle operations
  performed by platform operators are explicitly cross-tenant and
  recorded as such).

## Satisfied by

- `modules/platformkit-business-modules/tenant_management/features/tenant_lifecycle/feature.go` — wiring.
- `modules/platformkit-business-modules/tenant_management/features/tenant_lifecycle/service.go`,
  `service_test.go`, `service_child_entities.go` — domain logic.
- `modules/platformkit-business-modules/tenant_management/features/tenant_lifecycle/tenant_domain_alias_repository.go`,
  `tenant_domain_alias_repository_test.go` — host-alias resolver.
- `modules/platformkit-business-modules/tenant_management/features/tenant_lifecycle/handler.go`,
  `routes.go`, `permissions.go` — HTTP surface.
- `modules/platformkit-business-modules/tenant_management/features/tenant_lifecycle/section_renderer.go` —
  admin section rendering.

## Related requirements

- [REQ-TENANT-002 — Member management](./REQ-TENANT-002-member-management.md)
- [REQ-TENANT-003 — Onboarding](./REQ-TENANT-003-onboarding.md)
- [REQ-TENANT-005 — Identity connections](./REQ-TENANT-005-identity-connections.md)
