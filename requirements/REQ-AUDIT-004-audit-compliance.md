---
id: REQ-AUDIT-004
title: "Audit compliance feature runs configured compliance checks against the audit trail and surfaces violations"
status: Proposed
date: 2026-05-07
slug: req-audit-004-audit-compliance
category: compliance
ears_pattern: ubiquitous
verification_methods: [inspection]
compliance: [SOC2_CC7.2, ISO27001_A.12.4]
satisfied_by:
  adr: [ADR-0007]
  conventions: [C-14]
implements_cross_cutting: [REQ-004]
type: doc
tags: [requirement, feature, audit_management]
module: audit_management
feature: audit_compliance
---

# REQ AUDIT-004 — Audit compliance

Status: **Proposed** (2026-05-07)

## Statement

The audit compliance feature **shall** expose admin endpoints for
running the configured compliance checks against the audit trail
(`completeness`, `severity_audit`, `retention` are the catalogued
defaults at `defaultComplianceCheckTypes`) and surfacing the
violations each run produces. Operators can list checks
(`/api/v1/audit/compliance`), trigger a single check on demand
(`/api/v1/audit/compliance/checks`), and list outstanding
violations.

## Rationale

Compliance frameworks (SOC 2 CC7.2, ISO 27001 A.12.4) require
operators to demonstrate they actively monitor their audit-trail
discipline. The "checks + violations" shape gives an operator a
queryable surface for "what compliance gaps exist right now?"
rather than a static report.

## Acceptance criteria

- **AC-1** Listing checks runs the configured set and returns
  per-check status; `RunCheck` triggers a single check on demand.
- **AC-2** `ListViolations` surfaces unresolved violations from
  the most recent runs.
- **AC-3** Routes are admin-permission gated through
  `featurePermissions()`.

## Known gaps

- **Retention enforcement is not visible at this feature.** My
  prior draft claimed retention purges + tenant-scoped export.
  The actual feature is the compliance-check + violations surface;
  retention work happens elsewhere (`audit_trail/cleanup.go` for
  the time-window purge, `audit_trail/retention.go`). Reviewers
  consult REQ-AUDIT-001 for the persistence-side retention
  posture.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Inspection | `audit_compliance/handler.go::ListChecks` (line 113) + `RunCheck` (line 126); `defaultComplianceCheckTypes` lists the catalogue. |
| AC-2 | Inspection | `audit_compliance/handler.go::ListViolations` (line 144). |
| AC-3 | Inspection | `audit_compliance/permissions.go::featurePermissions()` declares the admin permissions wired into the routes. |

## Implements (cross-cutting)

- REQ-004 — audit per mutation (this feature reads the audit
  trail and surfaces compliance posture).

## Satisfied by

- `audit_management/features/audit_compliance/feature.go`
- `audit_management/features/audit_compliance/handler.go`
- `audit_management/features/audit_compliance/routes.go`,
  `permissions.go`

## Related requirements

- [REQ-AUDIT-001 — Audit trail](./REQ-AUDIT-001-audit-trail.md) — the persistence layer this feature inspects.
