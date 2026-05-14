---
id: REQ-AUDIT-001
title: "Audit trail feature persists every recorded event with tamper-evident metadata"
status: Proposed
date: 2026-05-07
slug: req-audit-001-audit-trail
category: audit
ears_pattern: ubiquitous
verification_methods: [test, inspection]
compliance: [SOC2_CC7.2, ISO27001_A.12.4]
satisfied_by:
  adr: [ADR-0007]
  conventions: [C-14]
implements_cross_cutting: [REQ-001, REQ-004, REQ-007]
type: doc
tags: [requirement, feature, audit_management]
module: audit_management
feature: audit_trail
---

# REQ AUDIT-001 — Audit trail

Status: **Proposed** (2026-05-07)

## Statement

The audit trail feature **shall** persist every audit event the
platform records (mutations, security-relevant decisions,
cross-tenant accesses) with the actor, the tenant, the timestamp,
the affected resource, and a typed action label. Reads **shall**
be tenant-scoped and filterable by actor, action, time range, and
resource. Records **shall** be append-only at the table level;
operator-driven cleanup (REQ-AUDIT retention) **shall** purge by
time-window via the dedicated cleanup path, not by ad-hoc DELETE.

## Rationale

The audit trail is the platform's compliance witness: SOC 2 CC7.2
("system operations") and ISO 27001 A.12.4 ("logging and
monitoring") require that every privileged action leaves a record
that survives both the actor and the affected resource.
Tamper-evidence at the database level — append-only writes, no
in-place updates — is what makes the trail trustworthy under
incident response, when the question "who saw this row, when?"
must be answered from the persisted record alone.

Filterability is the operational concern: an auditor or SRE asking
"show me all delete operations on user X over the last 30 days"
must have a fast, indexed path; without it the trail is
write-only-in-practice and adds load without adding insight.

## Acceptance criteria

- **AC-1** The repository exposes `Create` for new events and
  `Cleanup` for retention purging. An `Update` method exists for
  metadata-only mutations (e.g. archived-flag), but **core signed
  fields are protected at the database level by an immutability
  trigger** (the application code does not enforce
  append-only-ness — the trigger does). Deletion is not permitted
  through the application surface.
- **AC-2** Reads are tenant-scoped: a query without a tenant
  context returns nothing, and queries with the wrong tenant
  return events for that tenant only.
- **AC-3** Filter combinations (actor + action + time-range +
  resource) compose into a single SQL query rather than fanning
  out into multiple round-trips, so the index path stays
  predictable under load.
- **AC-4** Cross-tenant audit records (REQ-007) are visible to
  platform-operator queries with the explicit
  `WithExpectedCrossTenantAccess` reason but invisible to ordinary
  tenant-scoped reads.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Mixed | `audit_management/features/audit_trail/repository.go` (lines 42-58) — exposes `Create`, `Update` (metadata-only with the documented immutability comment), and an explicit "Delete is not permitted" stance. The DB-level immutability trigger is the load-bearing enforcement; reviewers verify the migration that installs it. `repository_test.go` covers Create + retention paths. |
| AC-2 | Test | `pk-modules/audit_management/features/audit_trail/repository_test.go::TestGormAuditRepository_Delete_ReturnsImmutableError` covers tenant-scoped reads and the wrong-tenant deny path. |
| AC-3 | Test | `pk-modules/audit_management/features/audit_trail/handler_filter_test.go::TestBuildAuditFilter_ExtendedFields` covers the combined-filter query path; `service_test.go` covers the service-level composition. |
| AC-4 | Inspection | Code review of `repository.go`: cross-tenant queries route through the platform-operator code path and the standard tenant scope is preserved for non-operators. |

## Implements (cross-cutting)

- REQ-001 — multi-tenant isolation (AC-2, AC-4).
- REQ-004 — audit per mutation (this feature *is* the audit
  surface; downstream modules' mutations land here).
- REQ-007 — explicit cross-tenant access (AC-4).

## Satisfied by

- `audit_management/features/audit_trail/feature.go` — wiring.
- `audit_management/features/audit_trail/repository.go`,
  `repository_test.go` — append-only persistence.
- `audit_management/features/audit_trail/cleanup.go` — retention
  purge (its own audit event).
- `audit_management/features/audit_trail/handler.go`,
  `handler_filter_test.go` — query surface.
- `audit_management/features/audit_trail/section_renderer.go`,
  `section_renderer_test.go` — admin section.
- `pk-modules/audit_management/features/audit_trail/service_test.go`,
  `table_handler_test.go` — service + table coverage.

## Related requirements

- [REQ-AUDIT-002 — Audit events](./REQ-AUDIT-002-audit-events.md) —
  the typed-event vocabulary this trail records.
- [REQ-AUDIT-003 — Audit reports](./REQ-AUDIT-003-audit-reports.md) —
  the higher-level rollups built on top of this trail.
- [REQ-AUDIT-004 — Audit compliance](./REQ-AUDIT-004-audit-compliance.md) —
  retention + export controls.
