---
id: REQ-AUDIT-014
title: "Audit data export produces CSV and JSON envelopes; default format is JSON; retention metadata is preserved in the export"
status: Proposed
date: 2026-05-08
slug: req-audit-014-export-formats
category: audit
ears_pattern: ubiquitous
priority: must
risk: medium
verification_methods: [test]
compliance:
  - SOC2_CC7.2
  - ISO27001_A.18.1.3
  - GDPR_Art_20
satisfied_by:
  adr: [ADR-0009]
  conventions: [C-04, C-14]
implements_cross_cutting: [REQ-009]
refines: REQ-AUDIT-001
type: doc
tags: [requirement, capability, audit_management, audit_trail, export, format]
module: audit_management
feature: audit_trail
capability: audit_export
capability_kind: data_invariant
stakeholders:
  - compliance auditor (consumes exports)
  - operator (runs ad-hoc exports for incident response)
  - tenant administrator (data-portability request)
---

# REQ AUDIT-014 — Audit data export

Status: **Proposed** (2026-05-08)

## Statement

The audit-trail feature **shall** expose
`ExportAuditData(exportType, format, filter)` that:

1. Queries the matching audit events via the same filter
   shape as `QueryAuditEvents` (REQ-AUDIT-011);
2. Renders the result in the requested `format`:
   - **`json`** — structured envelope including the
     event array + retention-policy metadata;
   - **`csv`** — canonical column order, one row per
     event, escaping per RFC 4180;
   - **default (empty `format`)** — JSON envelope;
3. Includes the configured retention policy in the
   export metadata so the consumer can reason about
   the data's lifetime;
4. Falls back to a sensible default-retention block
   when the runtime retention is unconfigured.

The export **shall** propagate query errors as wrapped
errors and **shall** produce a valid (parseable) document
even when the result set is empty.

## Rationale

Audit exports are the platform's contribution to
compliance evidence pulls and tenant data-portability
requests. Three properties:

1. **Two formats, no third.** JSON for programmatic
   consumers, CSV for spreadsheet-driven
   compliance reviews. Adding more would expand the
   contract without serving a known consumer.
2. **Default-to-JSON, not-empty.** An empty `format`
   parameter is a likely caller bug, not an
   intentional omission; defaulting to JSON keeps
   the consumer working.
3. **Retention metadata in the envelope.** A
   compliance auditor reading an export must know
   how long the source rows are retained; embedding
   the policy inline is the documented contract.

## Acceptance criteria

- **AC-1 — JSON export.** A
  `ExportAuditData(_, "json", filter)` returns a
  parseable JSON envelope.
- **AC-2 — CSV export.** A
  `ExportAuditData(_, "csv", filter)` returns a
  parseable CSV document with the canonical column
  order.
- **AC-3 — Default format is JSON.** A call with
  empty `format` returns the JSON envelope.
- **AC-4 — Query error wrapped.** A repository
  error returns a wrapped error; the partial
  document is not produced.
- **AC-5 — Empty events.** A filter that matches
  zero events still produces a valid document
  (empty array / header-only CSV).
- **AC-6 — Retention policy in export.** The
  envelope's metadata block carries the configured
  retention policy.
- **AC-7 — Retention fallback.** When retention is
  not configured, the metadata carries the
  documented fallback policy.
- **AC-8 — Multiple events in CSV.** A filter
  matching N events produces N rows + header.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `pk-modules/audit_management/features/audit_trail/service_test.go::TestExportAuditData_JSON`. |
| AC-2 | Test | `pk-modules/audit_management/features/audit_trail/service_test.go::TestExportAuditData_CSV`. |
| AC-3 | Test | `pk-modules/audit_management/features/audit_trail/service_test.go::TestExportAuditData_DefaultFormat`. |
| AC-4 | Test | `pk-modules/audit_management/features/audit_trail/service_test.go::TestExportAuditData_QueryError`. |
| AC-5 | Test | `pk-modules/audit_management/features/audit_trail/service_test.go::TestExportAuditData_EmptyEvents`. |
| AC-6 | Test | `pk-modules/audit_management/features/audit_trail/service_test.go::TestExportAuditData_RetentionPolicyInExport`. |
| AC-7 | Test | `pk-modules/audit_management/features/audit_trail/service_test.go::TestExportAuditData_RetentionPolicyFallback`. |
| AC-8 | Test | `pk-modules/audit_management/features/audit_trail/service_test.go::TestExportAuditData_CSV_MultipleEvents`. |

## Edge cases & unhappy paths

- **Unknown format.** Treated as JSON (AC-3); the
  caller's typo doesn't break the export.
- **Very large filter (millions of rows).** The
  current implementation loads everything into
  memory; large-export streaming is a documented
  follow-up.
- **CSV with embedded commas / quotes / newlines in
  data.** Escaped per RFC 4180; the consumer can
  parse with any conformant library.
- **Concurrent export calls.** Each call is
  independent; no global state.

## Risk

- **Likelihood:** Low — exercised on compliance
  pulls + tenant data-portability requests.
- **Impact:** Medium — defective export produces
  invalid documents the auditor cannot consume.
- **Mitigations:** Two-format contract (AC-1,
  AC-2), default-to-JSON (AC-3), retention
  metadata embedded (AC-6, AC-7).

## Implements (cross-cutting)

- **REQ-009 — Observability.** Exports are the
  primary externalisation surface for the audit
  ledger.

## Compliance mapping

| Control | Coverage |
|---|---|
| SOC2 CC7.2 (System monitoring) | AC-6 — retention metadata inline. |
| ISO27001 A.18.1.3 (Records management) | AC-1, AC-2 — auditable export formats. |
| GDPR Art. 20 (Data portability) | AC-2 — CSV export for end-user data-portability. |

## Satisfied by

- `pk-modules/audit_management/features/audit_trail/service.go::ExportAuditData`.

## Related requirements

- [REQ-AUDIT-001 — Audit trail](./REQ-AUDIT-001-audit-trail.md)
- [REQ-AUDIT-011 — Audit query + integrity](./REQ-AUDIT-011-audit-query-integrity.md)
- [REQ-AUDIT-012 — Audit retention + cleanup](./REQ-AUDIT-012-audit-retention-cleanup.md)
