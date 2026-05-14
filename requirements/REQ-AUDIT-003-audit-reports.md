---
id: REQ-AUDIT-003
title: "Audit reports feature aggregates trail records into compliance-shaped rollups"
status: Proposed
date: 2026-05-07
slug: req-audit-003-audit-reports
category: audit
ears_pattern: ubiquitous
verification_methods: [inspection]
compliance: [SOC2_CC7.2, ISO27001_A.12.4]
satisfied_by:
  adr: [ADR-0007]
  conventions: [C-14]
implements_cross_cutting: [REQ-004, REQ-009]
type: doc
tags: [requirement, feature, audit_management]
module: audit_management
feature: audit_reports
---

# REQ AUDIT-003 — Audit reports

Status: **Proposed** (2026-05-07)

## Statement

The audit reports feature **shall** generate compliance-shaped
rollups over the audit trail (per-tenant access summaries,
per-actor activity profiles, per-resource change histories) and
expose them through admin endpoints with role-restricted access.
Reports **shall** be parameterisable by time range and tenant;
generation **shall** stream rather than buffer when the result set
is large enough to exceed the configured memory budget.

## Rationale

Auditors and security officers do not query the raw trail row by
row — they ask "summarise privileged changes by Acme staff for
Q1". The reports feature exists so those queries do not require
re-implementation in every consumer. Streaming output keeps the
service stable when a year-over-year report touches millions of
rows; buffering would OOM the report process under realistic load.

## Acceptance criteria

- **AC-1** Reports are listable via
  `handler.go::ListReports`, retrievable via `GetReport`, and
  downloadable via `DownloadReport`.
- **AC-2** New reports can be generated on demand
  (`GenerateReport`) or scheduled
  (`ScheduleReport`).
- **AC-3** Routes are admin-permission gated through
  `featurePermissions()`.

## Known gaps

- **Streaming output is not visible in the handler shape.** My
  prior draft claimed "reports stream their output rather than
  buffering". The actual handlers are list/get/download — the
  streaming concern, if it exists, lives in the underlying
  `ports.AuditService`.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Inspection | `pk-modules/audit_management/features/audit_reports/handler.go::ListReports, GetReport, DownloadReport` — the three read paths. The underlying generation path is exercised by `pk-modules/audit_management/features/audit_trail/service_test.go::TestGenerateAuditReport_Success`, `TestGenerateAuditReport_QueryError`, `TestGenerateAuditReport_EmptyEvents`, `TestGenerateAuditReport_ActorAndResourceAggregation`. **Verification gap: feature-local handler tests pending.** |
| AC-2 | Inspection | `pk-modules/audit_management/features/audit_reports/handler.go::GenerateReport, ScheduleReport`. **Verification gap: dedicated handler tests pending.** |
| AC-3 | Inspection | `pk-modules/audit_management/features/audit_reports/permissions.go::featurePermissions` — admin-permission gating list. Discipline enforced by code review; dedicated permission-route test pending. |

## Implements (cross-cutting)

- REQ-004 — audit per mutation (the source records are audit events).
- REQ-009 — observability (the reports themselves emit completion metrics).

## Satisfied by

- `audit_management/features/audit_reports/feature.go`
- `audit_management/features/audit_reports/handler.go`
- `audit_management/features/audit_reports/routes.go`,
  `permissions.go`

## Related requirements

- [REQ-AUDIT-001 — Audit trail](./REQ-AUDIT-001-audit-trail.md) — the source of the report's input.
