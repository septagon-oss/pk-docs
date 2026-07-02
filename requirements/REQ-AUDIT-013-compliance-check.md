---
id: REQ-AUDIT-013
title: "Audit compliance check evaluates events against typed checks and emits a scored report"
status: Proposed
date: 2026-05-08
slug: req-audit-013-compliance-check
category: audit
ears_pattern: ubiquitous
priority: should
risk: medium
verification_methods: [test]
compliance:
  - SOC2_CC7.4
  - ISO27001_A.18.2
satisfied_by:
  adr: [ADR-0009]
  conventions: [C-04, C-14]
implements_cross_cutting: [REQ-004, REQ-009]
refines: REQ-AUDIT-001
type: doc
tags: [requirement, capability, audit_management, audit_trail, compliance]
module: audit_management
feature: audit_compliance
capability: compliance_check
capability_kind: failure_mode
stakeholders:
  - compliance auditor (evidence pulls)
  - operator (continuous compliance dashboard)
---

# REQ AUDIT-013 — Audit compliance check

Status: **Proposed** (2026-05-08)

## Statement

The audit-trail feature **shall** expose
`PerformComplianceCheck(checkType, complianceTags)` that:

1. Constructs a typed `AuditComplianceCheck` carrying the
   requested type, tag set, performer ("system"), and
   environment ("default");
2. Builds an `AuditFilter` whose `ResourceType` is the
   first compliance tag (current shape; multi-tag
   filtering is a documented future);
3. Queries the repository for matching events;
4. Iterates each event applying a per-`checkType`
   evaluator:
   - **`severity_audit`** — flags critical events
     missing `ActorID`;
   - **`completeness`** — flags events with empty
     `ResourceType` or `Action`;
   - **`retention`** — flags events older than the
     configured retention horizon
     (`retention.DefaultDays`, falling back to
     `defaultRetentionDays`);
   - **default / unknown** — generic check (events
     exist for the tags);
5. Computes a status of `compliant` /
   `partial` / `non-compliant` and a `Score` in
   `[0, 100]` based on `(total - failed) / total`;
6. Populates `Violations`, `Details.checkedAt`,
   `Details.totalEvents`, `Details.failedEvents`,
   `Details.checkType`;
7. Increments `audit.compliance.check` and returns the
   populated result.

The check **shall** tolerate a context-cancellation
error from the repository as a Warn (not Error)
condition — but in either case the wrapped error is
returned to the caller so the report is not silently
empty.

## Rationale

Compliance checks are the bridge between the raw event
ledger and an auditor's evidence package. Three
properties:

1. **Typed evaluators.** Hard-coding the three checks
   (severity audit, completeness, retention) keeps the
   evaluator deterministic and testable. Adding a check
   means adding a `case` in the switch + a test —
   reviewable in one PR rather than a configuration file
   that drifts.
2. **Score in `[0, 100]`.** The operator-facing
   continuous-compliance dashboard reads the score
   directly; a binary "pass / fail" loses the gradient
   that lets operators see compliance drift before it
   becomes a violation.
3. **Single-tag filter today, multi-tag tomorrow.** The
   current shape (`filter.ResourceType =
   complianceTags[0]`) reflects today's repository
   filter; the documented quirk is that tag-only
   filtering is not yet exposed. Future work extends
   the filter shape and the check uses the broader
   surface.

The `severity_audit` check expresses the platform's hard
floor: every critical event must have a named actor.
Without it the audit ledger cannot answer "who did the
incident-grade thing?", which is the fundamental SOC2
question.

## Acceptance criteria

- **AC-1 — Severity audit flags missing actor.** A
  `PerformComplianceCheck("severity_audit", ["User"])`
  over a set that contains a critical event with empty
  `ActorID` returns `Status="non-compliant"` (or
  partial) with the offending event id in
  `Violations`.
- **AC-2 — Completeness flags empty fields.** A
  `PerformComplianceCheck("completeness", ["User"])`
  over a set that contains an event with empty
  `ResourceType` or `Action` returns the offending
  event id in `Violations`.
- **AC-3 — Retention flags old events.** A
  `PerformComplianceCheck("retention", ["User"])` over
  events older than the configured retention horizon
  returns the violations with the event ids; the cutoff
  is `now - retention.DefaultDays` (or
  `defaultRetentionDays` when zero).
- **AC-4 — Score reflects ratio.** When 8 of 10
  events fail, the score is `20.0` (or `(10-8)/10 *
  100`); when 0 fail, the score is `100.0` and status
  is `compliant`.
- **AC-5 — Details include audit metadata.** The
  returned `AuditComplianceCheck.Details` has
  `checkedAt` (timestamp), `totalEvents` (int),
  `failedEvents` (int), and `checkType` (string).
- **AC-6 — Counter increments per call.**
  `audit.compliance.check` increments once per call,
  regardless of result.
- **AC-7 — Repository error wrapped + log differentiated.**
  A repo `Query` error is returned wrapped as
  `compliance check failed: %w`; a context-cancel
  variant logs Warn instead of Error before the same
  return.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `modules/platformkit-business-modules/audit_management/features/audit_trail/service_test.go::TestPerformComplianceCheck_SeverityAudit_Compliant`, `TestPerformComplianceCheck_SeverityAudit_NonCompliant`, `TestPerformComplianceCheck_SeverityAudit_Partial`. |
| AC-2 | Test | `modules/platformkit-business-modules/audit_management/features/audit_trail/service_test.go::TestPerformComplianceCheck_Completeness`. |
| AC-3 | Test | `modules/platformkit-business-modules/audit_management/features/audit_trail/service_test.go::TestPerformComplianceCheck_Retention` and `TestPerformComplianceCheck_RetentionFallbackDays`. |
| AC-4 | Inspection | `service.go::PerformComplianceCheck` lines 382–396 — score = `(total - failed) / total * 100`; `TestPerformComplianceCheck_SeverityAudit_Partial` exercises the partial branch end-to-end. |
| AC-5 | Test | `modules/platformkit-business-modules/audit_management/features/audit_trail/service_test.go::TestPerformComplianceCheck_DetailsPopulated`. |
| AC-6 | Inspection | `service.go::PerformComplianceCheck` lines 404–406 — `s.metrics.Inc(ctx, "audit.compliance.check", nil)` runs at the end of the function. Dedicated counter test pending. |
| AC-7 | Test | `modules/platformkit-business-modules/audit_management/features/audit_trail/service_test.go::TestPerformComplianceCheck_QueryError` — wrapped error; the Warn-vs-Error-log differentiation is by inspection of lines 339–344. |

## Edge cases & unhappy paths

- **Empty event set.** Total = 0; status =
  `compliant`; score = 100. (Documented: vacuous
  pass; consumers should also check `totalEvents > 0`.)
- **Unknown check type.** Falls into the default branch
  (no per-event evaluation); the score is computed over
  zero failures. Downstream: returns `compliant`. A
  future improvement is to refuse unknown types.
- **Multi-tag filter.** Currently uses only
  `complianceTags[0]`; additional tags are surfaced in
  the result's tag list but do not narrow the query.
- **Retention horizon mid-roll.** Operators changing
  `DefaultDays` between a write and a check may see
  different results across runs; expected.
- **Context canceled.** The wrapped error returns; the
  dashboard surfaces a partial view rather than a
  zero.

## Risk

- **Likelihood:** Low — exercised on compliance pulls
  (quarterly / annually) + dashboard refresh.
- **Impact:** Medium — a defective check produces a
  false-clean compliance report; counterbalanced by the
  external auditor's own re-check.
- **Mitigations:** Hard-coded evaluators (AC-1..AC-3),
  numeric score (AC-4), full details object (AC-5).

## Implements (cross-cutting)

- **REQ-004 — Audit per mutation.** Indirect — this REQ
  is the read-side compliance assertion against the
  ledger.
- **REQ-009 — Observability.** AC-6 — counter on every
  evaluation.

## Compliance mapping

| Control | Coverage |
|---|---|
| SOC2 CC7.4 (Security incidents) | AC-1 — actor identification on critical events. |
| ISO27001 A.18.2 (Information security reviews) | AC-3 + AC-4 — periodic compliance check with score. |

## Satisfied by

- `modules/platformkit-business-modules/audit_management/features/audit_trail/service.go::PerformComplianceCheck`.
- `modules/platformkit-business-modules/audit_management/features/audit_compliance/feature.go` — UI surface for compliance reports.

## Related requirements

- [REQ-AUDIT-001 — Audit trail](./REQ-AUDIT-001-audit-trail.md)
- [REQ-AUDIT-004 — Audit compliance umbrella](./REQ-AUDIT-004-audit-compliance.md)
- [REQ-AUDIT-010 — Audit record](./REQ-AUDIT-010-audit-record.md) — the write path that produces the events evaluated here.
- [REQ-AUDIT-011 — Audit query + integrity](./REQ-AUDIT-011-audit-query-integrity.md) — the query layer this check builds on.
