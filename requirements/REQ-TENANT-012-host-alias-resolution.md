---
id: REQ-TENANT-012
title: "Host-alias resolution maps a request host to its tenant; archived tenants are refused at the public surface"
status: Proposed
date: 2026-05-08
slug: req-tenant-012-host-alias-resolution
category: tenant
ears_pattern: event-driven
priority: must
risk: high
verification_methods: [test]
compliance:
  - SOC2_CC6.1
  - SOC2_CC6.7
  - ISO27001_A.13.1.3
satisfied_by:
  adr: [ADR-0009]
  conventions: [C-04, C-14]
implements_cross_cutting: [REQ-001, REQ-005, REQ-007]
refines: REQ-TENANT-001
type: doc
tags: [requirement, capability, tenant_management, tenant_lifecycle, host_alias, routing]
module: tenant_management
feature: tenant_lifecycle
capability: host_alias_resolution
capability_kind: failure_mode
stakeholders:
  - platform routing layer (every public request)
  - tenant administrator (configures vanity domain)
  - operator (overlay seeder)
---

# REQ TENANT-012 — Host-alias resolution and reconciliation

Status: **Proposed** (2026-05-08)

## Statement

**When** the platform routing layer asks
`TenantService.ResolveTenantByHost(host)`, the tenant lifecycle
feature **shall** consult the normalised
`tenant_domain_aliases` table and:

1. Return the matching active tenant when an alias resolves to a
   tenant whose `Status == Active`;
2. Return `(nil, nil)` (a clean "miss") when there is no alias,
   when the alias points to a deleted tenant, or when the
   referenced tenant is archived / suspended;
3. Never return an inactive tenant to the public surface, even
   if a stale alias still points to it.

`ListHostAliases(tenantID)` **shall** return every alias row
owned by the tenant (including aliases owned by inactive
sources) with the `source` provenance preserved.

`ReconcileHostAliases(tenantID, source, hosts)` **shall** be
transactional, scoped to the (tenant, source) pair, and **shall
not** overwrite rows owned by a different tenant or source —
collisions **shall** be reported in the returned
`HostAliasReconcileReport.Collisions`. The `source` argument
**shall** be normalised (trim + lower-case) and validated
against `entities.AllTenantDomainAliasSources` before any DB
write; an invalid source returns an error before reading the DB.

## Rationale

Host resolution is the substrate for tenant context — every
public request runs through it. Three load-bearing properties:

1. **Active-only on the public surface.** A vanity domain that
   was archived three months ago must not keep rendering the
   archived tenant's brand. Treating archived tenants as a
   miss lets the routing layer fall back cleanly (default
   tenant, 404, or explicit candidate) without a separate
   "is the tenant alive?" check at every consumer.
2. **Provenance preservation.** Aliases are owned by a
   *source* (overlay seeder, admin UI, vanity-domain wizard,
   tenant migration). Letting the seeder overwrite the
   admin-UI's manual edits silently would erase operator
   intent. The reconcile boundary is `(tenant, source)`; rows
   from another source are never touched.
3. **Validate-before-write.** A typo in `source` would create
   a parallel ownership namespace that the reconciler can
   never reach (the seeder asks for source `"overlay"`; a
   typo creates a row with source `"overlap"`; the next
   reconcile run cannot prune it). Failing fast on
   `IsValid()` is the cheap insurance.

The collision report is the operator's signal: it lists hosts
that another (tenant, source) pair claims, so the reconciler can
log them at Warn and continue rather than blocking the entire
batch on the first conflict.

## Acceptance criteria

- **AC-1 — Active-tenant happy path.** A `ResolveTenantByHost`
  call against a host whose alias points to an active tenant
  returns the tenant DTO.
- **AC-2 — Archived tenant returns clean miss.** A
  `ResolveTenantByHost` against an alias pointing to an
  archived tenant returns `(nil, nil)` — the public surface
  cannot reach the tenant via this path.
- **AC-3 — Suspended tenant returns clean miss.** Same as
  AC-2 for `Status == Suspended`.
- **AC-4 — Stale alias returns clean miss.** A
  `ResolveTenantByHost` whose alias points to a tenant id
  that no longer resolves returns `(nil, nil)`; the
  reconciler is responsible for cleaning the row.
- **AC-5 — List preserves provenance.** `ListHostAliases`
  returns all aliases owned by the tenant including the
  `source` field; the order is repository-defined.
- **AC-6 — Reconcile is `(tenant, source)`-scoped.** Calling
  `ReconcileHostAliases(t, "overlay", [...])` does not
  modify rows owned by `(t, "admin_ui")`; rows owned by a
  different tenant are surfaced in `Collisions` and never
  rewritten.
- **AC-7 — Source validation precedes DB read.** A reconcile
  call with an invalid source (typo, empty, wrong case after
  normalisation) returns an error before any tenant read or
  alias write.
- **AC-8 — Tenant existence verified.** Reconcile reads the
  tenant row and refuses with a `tenant <id> not found` error
  if the tenant does not exist; this prevents dangling alias
  rows.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Inspection | `service_hosts.go::ResolveTenantByHost` lines 41–73 — fetches the alias, reads the tenant, returns it only when `Status == Active`. Dedicated service-level test pending; the alias-resolution path is exercised end-to-end through `tests/e2e` smoke flows. |
| AC-2 | Inspection | `service_hosts.go::ResolveTenantByHost` lines 63–71 — explicit `tenant.Status != TenantStatusActive` returns `(nil, nil)`. Dedicated test pending. |
| AC-3 | Inspection | Same branch as AC-2 — Suspended falls into the non-Active arm. |
| AC-4 | Inspection | `service_hosts.go::ResolveTenantByHost` lines 56–62 — `tenant == nil` returns `(nil, nil)`. |
| AC-5 | Inspection | `service_hosts.go::ListHostAliases` lines 76–96 — the `Source` field is preserved verbatim from the row. |
| AC-6 | Test | `modules/platformkit-business-modules/tenant_management/features/tenant_lifecycle/tenant_domain_alias_repository_test.go::TestReconcile_NeverOverwritesManualRow`, `TestReconcile_NeverStealsHostFromDifferentTenant`, `TestReconcile_OwnedRowsAreTouchedNotReinserted`, `TestReconcile_PrunesOwnedRowsNotInDesiredSet`, `TestReconcile_EmptyDesiredSet_PrunesAllOwnedLeavesOthersAlone`, `TestReconcile_InsertsNewHosts`, `TestReconcile_DeduplicatesAndNormalizesHosts`. |
| AC-7 | Inspection | `service_hosts.go::ReconcileHostAliases` lines 116–122 — `IsValid()` check + empty-source guard before any DB read. Dedicated test pending. |
| AC-8 | Inspection | `service_hosts.go::ReconcileHostAliases` lines 128–134 — explicit tenant-existence check before alias write. Dedicated test pending. |

## Edge cases & unhappy paths

- **Repository nil.** When the tenant service is constructed
  without a host-alias repository, all three methods degrade
  cleanly: `Resolve` returns `(nil, nil)`, `List` returns
  `(nil, nil)`, `Reconcile` returns the configuration error.
- **Empty host string.** Treated as no match (the
  normalisation in the alias repository treats empty as a
  miss).
- **Case sensitivity.** Hosts are normalised to lower-case at
  alias-write time and at resolve-time; an upper-case query
  resolves to the same row as the lower-case canonical form.
- **Reconcile with empty `hosts` slice.** Removes every
  alias for the (tenant, source) pair; the report shows the
  pruned count.
- **Cross-source conflict.** Reconcile asks for host
  `acme.io` for source `overlay`, but the row is already
  owned by `(acme, admin_ui)`. The collision is reported,
  the existing row is preserved, and the operator is
  expected to log + escalate.
- **Race against archive.** Archive flips status; the next
  resolve call (post-archive) returns a miss. In-flight
  responses already routed to the archived tenant complete
  normally — there is no mid-request eviction.

## Risk

- **Likelihood:** High — every public request asks this.
- **Impact:** Critical — a defective resolver leaks one
  tenant's brand under another tenant's domain or keeps an
  archived tenant serving traffic.
- **Mitigations:** Active-only gate (AC-1..AC-4), source-scoped
  reconcile (AC-6..AC-7), tenant-existence verification
  (AC-8). The DB CHECK constraint on alias source is the
  belt-and-suspenders backup.

## Implements (cross-cutting)

- **REQ-001 — Multi-tenant isolation.** AC-1..AC-4 enforce
  active-tenant scope at the routing entry.
- **REQ-005 — Fail-closed.** AC-2..AC-4 default-deny when the
  tenant is not in a state that should serve traffic.
- **REQ-007 — Resilient routing.** The alias table is the
  single index between hosts and tenants — every node uses
  the same resolution path.

## Compliance mapping

| Control | Coverage |
|---|---|
| SOC2 CC6.1 (Logical access) | AC-2..AC-4 — inactive tenants do not appear at the public surface. |
| SOC2 CC6.7 (Restrict information access) | AC-6 — provenance-preserving reconciliation prevents source-spoofing. |
| ISO27001 A.13.1.3 (Segregation in networks) | AC-1 — host-based segregation between tenants. |

## Satisfied by

- `modules/platformkit-business-modules/tenant_management/features/tenant_lifecycle/service_hosts.go::ResolveTenantByHost, ListHostAliases, ReconcileHostAliases`.
- `modules/platformkit-business-modules/tenant_management/features/tenant_lifecycle/tenant_domain_alias_repository.go` — the underlying repository.
- `modules/platformkit-business-modules/tenant_management/entities/tenant.go::AllTenantDomainAliasSources` — the source enum.

## Related requirements

- [REQ-TENANT-001 — Tenant lifecycle](./REQ-TENANT-001-tenant-lifecycle.md)
- [REQ-TENANT-011 — Tenant update + archive](./REQ-TENANT-011-tenant-update-archive.md) — produces the archived state this resolver gates on.
- [REQ-AUTH-010 — Login credentials](./REQ-AUTH-010-login-credentials.md) — login-flow tenant resolution shares this surface upstream.
