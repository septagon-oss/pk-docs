---
id: REQ-AUDIT-011
title: "Audit query exposes filter + summary; integrity verify checks every signed row in a time range"
status: Proposed
date: 2026-05-08
slug: req-audit-011-audit-query-integrity
category: audit
ears_pattern: ubiquitous
priority: must
risk: high
verification_methods: [test]
compliance:
  - SOC2_CC7.1
  - SOC2_CC7.2
  - ISO27001_A.12.4.2
  - ISO27001_A.12.4.3
satisfied_by:
  adr: [ADR-0009]
  conventions: [C-04, C-14]
implements_cross_cutting: [REQ-001, REQ-004, REQ-009]
refines: REQ-AUDIT-001
type: doc
tags: [requirement, capability, audit_management, audit_trail, query, integrity]
module: audit_management
feature: audit_trail
capability: audit_query_integrity
capability_kind: failure_mode
stakeholders:
  - operator (incident triage, evidence pull)
  - compliance auditor (integrity verification)
  - admin UI (audit-trail browser)
---

# REQ AUDIT-011 — Audit query and integrity verify

Status: **Proposed** (2026-05-08)

## Statement

The audit-trail feature **shall** expose three read paths and
one integrity primitive:

1. **`GetAuditEvent(id)`** — fetch a single row by id; the
   result includes the `metadata["signature"]` field if the
   row was signed at write-time.
2. **`QueryAuditEvents(filter)`** — return rows matching
   the supplied `AuditFilter` (resource type, action, time
   range, severity, outcome, tag set, actor, tenant).
3. **`GetAuditSummary(filter)`** — return aggregate
   counts (total events, by severity, by outcome, by
   resource type) for the same filter shape.
4. **`VerifyIntegrity(from, to)`** — fetch every row
   whose `OccurredAt` falls in `[from, to]` via
   `repository.GetByTimeRange`, recompute each row's
   HMAC signature using the configured signing key, and
   return an error listing every row whose stored
   `metadata["signature"]` does not match the recomputed
   value. **If** no signing key is configured, return the
   typed `audit signing key not configured` error so the
   caller knows verification was not performed.

`VerifyEventIntegrity(evt)` is the per-row primitive used
by `VerifyIntegrity` and exposed for ad-hoc forensic checks.

## Rationale

The audit ledger has two consumer modes — query (operators
and the admin UI) and integrity verification (compliance
auditors). Three properties:

1. **Filter shape is the consumer contract.** The
   `AuditFilter` struct is the documented surface; new
   filter dimensions are added there and propagate to
   summary + query through the same shape. Repository-side
   query construction lives in
   `modules/platformkit-business-modules/audit_management/features/audit_trail/repository.go`;
   the service is a thin pass-through.
2. **Integrity verify is *over a time range*.** The
   audit table grows unbounded; verifying every row would
   take hours. The time-range gate lets operators verify a
   recent window (last hour, last day) cheaply, and lets
   compliance pull a quarter or year in their own
   schedule.
3. **`VerifyEventIntegrity` returns true for unsigned
   rows.** If no signing key was configured at write-time,
   the row carries no signature and the verifier cannot
   make a tamper claim — returning false would falsely
   accuse every pre-signing-era row. The "no key configured
   means we cannot verify" branch in `VerifyIntegrity`
   surfaces this clearly to the caller.

## Acceptance criteria

- **AC-1 — Get by id returns the row.** A
  `GetAuditEvent(id)` for a persisted id returns the row
  with all populated fields; a missing id returns the
  repository's `ErrNotFound`.
- **AC-2 — Query honours filter.** A
  `QueryAuditEvents(AuditFilter{ResourceType: "User",
  Severity: AuditSeverityCritical})` returns only rows
  matching both clauses; an empty filter returns the
  global recent set.
- **AC-3 — Summary aggregates match query.** A
  `GetAuditSummary(filter)` returns counts whose total
  equals `len(QueryAuditEvents(filter))` for the same
  filter; per-severity / per-outcome buckets sum to the
  total.
- **AC-4 — Verify catches tampered rows.** A
  `VerifyIntegrity(from, to)` over a range that includes
  a row whose `Action` was edited post-persist returns
  the typed error listing the tampered row's id; rows
  whose signature still matches are silent.
- **AC-5 — Verify fails fast without signing key.** A
  service constructed without `WithSigningKey` returns
  `audit signing key not configured` from
  `VerifyIntegrity`; no time-range fetch is issued.
- **AC-6 — Per-row verify is true for unsigned rows.**
  `VerifyEventIntegrity(unsigned_row)` returns `true`
  when the service's signing key is empty (we cannot
  witness what was not configured).
- **AC-7 — Span coverage.** Every read path opens a
  `audit_service.<Method>` span via the injected tracer.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `modules/platformkit-business-modules/audit_management/features/audit_trail/service_test.go::TestGetAuditEvent_Success`, `TestGetAuditEvent_NotFound`, `TestGetAuditEvent_RepositoryError`. |
| AC-2 | Test | `modules/platformkit-business-modules/audit_management/features/audit_trail/service_test.go::TestQueryAuditEvents_Success`, `TestQueryAuditEvents_Error`, `TestQueryAuditEvents_EmptyResult`. The filter pass-through is by inspection of `service.go::QueryAuditEvents`. |
| AC-3 | Test | `modules/platformkit-business-modules/audit_management/features/audit_trail/service_test.go::TestGetAuditSummary_Success` and `TestGetAuditSummary_Error`. The total-equals-len-of-query invariant is by inspection of the repository implementation (filter parity is the source of truth). |
| AC-4 | Test | `modules/platformkit-business-modules/audit_management/features/audit_trail/service_test.go::TestSigningKey_DetectsTampering` exercises the per-event signature mismatch path that `VerifyIntegrity` aggregates over a time range. The time-range traversal is by inspection of `service.go::VerifyIntegrity` lines 254–276. |
| AC-5 | Inspection | `service.go::VerifyIntegrity` lines 254–257 — `if len(s.signingKey) == 0 { return ... "audit signing key not configured" }` returns before the repository call. Dedicated test pending. |
| AC-6 | Test | `modules/platformkit-business-modules/audit_management/features/audit_trail/service_test.go::TestSigningKey_NoKeySkipsVerification` — `VerifyEventIntegrity` returns `true` when the signing key is empty. |
| AC-7 | Inspection | `service.go::GetAuditEvent, QueryAuditEvents, GetAuditSummary, VerifyIntegrity` — each opens with `s.tracer.StartSpan`. |

## Edge cases & unhappy paths

- **Empty time range.** `from == to` (or `from > to`)
  returns an empty result set; no error.
- **Repository fetch failure during verify.** The wrapped
  error surfaces; the caller cannot distinguish "tampered"
  from "repository down". Operators should retry after
  health-checking the DB.
- **Filter that asks for archived events.** A filter with
  `metadata.archived == true` returns archived rows; the
  archive flag is metadata, not a separate table.
- **Very large time ranges.** Verify pulls every row in
  range into memory; for compliance windows of a year
  this can be expensive. Documented; future work pages
  the verification.
- **Signing key rotation.** A row signed with the old key
  is verified false against the new key. Operators
  rotating the key must run an offline re-sign pass on
  historical rows or treat the rotation point as a
  verification boundary.
- **Filter resource type field collision.** The compliance
  check (REQ-AUDIT-013) uses
  `filter.ResourceType = complianceTags[0]` which can
  unexpectedly narrow the result if the tag also appears
  as a resource type — documented quirk.

## Risk

- **Likelihood:** Medium — read paths exercised by admin
  UI, integrity by compliance pull.
- **Impact:** High — a defective query loses operator
  time; a defective verify produces false-clean
  compliance reports.
- **Mitigations:** Filter parity between query and summary
  (AC-3), explicit "no key" error on verify (AC-5),
  span-wrapped trace coverage (AC-7).

## Implements (cross-cutting)

- **REQ-001 — Multi-tenant isolation.** Indirect — the
  filter carries tenant id where required.
- **REQ-004 — Audit per mutation.** Indirect — this REQ
  is the read-side complement.
- **REQ-009 — Observability.** AC-7 — span coverage.

## Compliance mapping

| Control | Coverage |
|---|---|
| SOC2 CC7.1 (System operations) | AC-2 + AC-3 — operators have a queryable ledger. |
| SOC2 CC7.2 (System monitoring) | AC-2 — incident-time evidence retrieval. |
| ISO27001 A.12.4.2 (Protection of log information) | AC-4 + AC-6 — tamper detection over the signed window. |
| ISO27001 A.12.4.3 (Administrator and operator logs) | AC-2 — admin-action filterable by actor / role. |

## Satisfied by

- `modules/platformkit-business-modules/audit_management/features/audit_trail/service.go::GetAuditEvent, QueryAuditEvents, GetAuditSummary, VerifyIntegrity, VerifyEventIntegrity, signEvent`.
- `modules/platformkit-business-modules/audit_management/features/audit_trail/repository.go` — the underlying repository.

## Related requirements

- [REQ-AUDIT-001 — Audit trail](./REQ-AUDIT-001-audit-trail.md)
- [REQ-AUDIT-010 — Audit record](./REQ-AUDIT-010-audit-record.md) — the write path that produces the rows queried here.
- [REQ-AUDIT-012 — Audit retention + cleanup](./REQ-AUDIT-012-audit-retention-cleanup.md)
- [REQ-AUDIT-013 — Compliance check](./REQ-AUDIT-013-compliance-check.md) — the consumer of the query path.
