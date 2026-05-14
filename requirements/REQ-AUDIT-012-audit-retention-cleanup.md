---
id: REQ-AUDIT-012
title: "Audit retention archives or deletes rows older than the configured horizon, never silently"
status: Proposed
date: 2026-05-08
slug: req-audit-012-audit-retention-cleanup
category: audit
ears_pattern: ubiquitous
priority: must
risk: high
verification_methods: [test]
compliance:
  - SOC2_CC7.2
  - ISO27001_A.18.1.3
  - GDPR_Art_5
satisfied_by:
  adr: [ADR-0009]
  conventions: [C-04, C-14]
implements_cross_cutting: [REQ-004, REQ-005, REQ-009, REQ-010]
refines: REQ-AUDIT-001
type: doc
tags: [requirement, capability, audit_management, audit_trail, retention, cleanup]
module: audit_management
feature: audit_trail
capability: audit_retention_cleanup
capability_kind: state_machine
stakeholders:
  - operator (manages retention budget)
  - compliance auditor (data-retention policy)
  - data-protection officer (GDPR storage limitation)
---

# REQ AUDIT-012 — Audit retention and cleanup

Status: **Proposed** (2026-05-08)

## Statement

The audit-trail feature **shall** expose two retention
operations and one configuration source:

1. **`ArchiveAuditEvents(filter)`** — query rows matching
   the filter, mark each with
   `metadata.archived = true` and
   `metadata.archivedAt = now`, and persist via the
   repository's `Update`. **Shall** continue past
   per-row failures (logged at Error) and report
   total / archived counts at completion;
2. **`CleanupExpiredEvents(ctx)`** — when retention is
   enabled, invoke the repository's optional
   `DeleteOlderThan(cutoff time.Time)` method (probed via
   interface assertion) to hard-delete rows older than
   `now - retention.DefaultDays`. **If** the repository
   does not implement the deleter, log Warn and return
   `nil` (do not panic);
3. **`RetentionSettings`** — provided by
   `ProvideRetentionSettings(cfg, log)` from
   environment-bound configuration, carrying
   `Enabled bool` and `DefaultDays int`. The default
   when `DefaultDays <= 0` is `defaultRetentionDays`
   (the source of truth).

The cleanup job **shall** be wired into the platform's
scheduler via `CleanupJobHandler` so it runs on a
configurable cadence; manual invocation through this
service is supported for forensic / one-off operations.

## Rationale

Audit rows are the densest log surface on the platform —
every business mutation produces one. Three properties:

1. **Archive ≠ delete.** Archiving marks the row in
   metadata but preserves it; queries that want the
   archived set can filter by metadata. Hard-delete is the
   storage-budget pressure-relief; both have legitimate
   use.
2. **Retention is configuration-driven.** Different
   compliance regimes mandate different floors (SOX = 7
   years, GDPR = "no longer than necessary"). The
   `RetentionSettings.DefaultDays` is the single tunable;
   per-tenant overrides live in the tenant settings table
   and are out of scope here.
3. **Optional repository capability.** Not every
   repository backend supports cheap time-bounded delete
   (e.g. JSON-file fixture repos). The interface-assertion
   check (`ok :=
   s.repository.(interface{DeleteOlderThan ...})`) is the
   probe; missing capability degrades cleanly without
   panicking.

The archive path's "continue past per-row failures" is a
deliberate choice: a single bad row should not abort the
entire batch. Operators see the per-row Error log and the
final tally; they can investigate the failures while the
batch already made progress.

## Acceptance criteria

- **AC-1 — Archive marks rows + persists.** A successful
  `ArchiveAuditEvents(filter)` updates each matching row's
  `metadata.archived = true` and
  `metadata.archivedAt` is set; the count is logged at
  Info.
- **AC-2 — Archive continues past per-row errors.** When
  one row's update fails, the operation logs the error
  (with the offending row id) and continues with the
  next; the final count reflects the actual archive
  count, not the requested count.
- **AC-3 — Archive emits counter on completion.**
  `audit.events.archived` increments once per
  `ArchiveAuditEvents` call (regardless of per-row
  failures).
- **AC-4 — Cleanup respects `Enabled` flag.** A
  `CleanupExpiredEvents` call against a service whose
  `retention.Enabled = false` returns `nil` after an
  Info log; no DB write is issued.
- **AC-5 — Cleanup uses optional deleter.** When the
  repository implements
  `DeleteOlderThan(ctx, time)`, cleanup invokes it with
  `cutoff = now - DefaultDays`.
- **AC-6 — Cleanup degrades on unsupported repository.**
  When the repository does not implement
  `DeleteOlderThan`, cleanup logs Warn and returns
  `nil`; no panic.
- **AC-7 — Default-days fallback.** When
  `retention.DefaultDays <= 0`, the cutoff is computed
  with `defaultRetentionDays` (the package constant).

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `pk-modules/audit_management/features/audit_trail/service_test.go::TestArchiveAuditEvents_Success` (mark-and-persist) and `TestArchiveAuditEvents_EmptyResults`. |
| AC-2 | Test | `pk-modules/audit_management/features/audit_trail/service_test.go::TestArchiveAuditEvents_PartialUpdateFailure` and `TestArchiveAuditEvents_QueryError`. |
| AC-3 | Inspection | `service.go::ArchiveAuditEvents` lines 450–452 — `s.metrics.Inc(ctx, "audit.events.archived", nil)` runs after the per-row loop regardless of per-row failures. Dedicated counter-increment test pending. |
| AC-4 | Test | `pk-modules/audit_management/features/audit_trail/service_test.go::TestCleanupExpiredEvents_RetentionDisabled` — Info log + nil return when `Enabled = false`. |
| AC-5 | Test | `pk-modules/audit_management/features/audit_trail/service_test.go::TestCleanupExpiredEvents_RepositorySupportsRetention` and `TestCleanupExpiredEvents_DeleteOlderThanError`. |
| AC-6 | Inspection | `service.go::CleanupExpiredEvents` lines 467–472 — `_, ok := s.repository.(interface{DeleteOlderThan ...})` probe; `if !ok` Warn-logs and returns nil. Dedicated unsupported-repo test pending. |
| AC-7 | Test | `pk-modules/audit_management/features/audit_trail/service_test.go::TestCleanupExpiredEvents_FallbackRetentionDays`. |

## Edge cases & unhappy paths

- **Empty filter.** `ArchiveAuditEvents` with an empty
  filter archives every row in the table; expensive but
  legal. Operators should pass a time-range filter.
- **Already-archived row.** Idempotent; the metadata flag
  flips again with a new `archivedAt` timestamp.
- **Cleanup during retention transition.** Lowering
  `DefaultDays` causes the next cleanup to delete a
  larger window; documented operator hazard. Audit
  exports should be taken before a retention reduction.
- **Cleanup race with insert.** The cutoff is computed at
  call time; rows inserted *during* the cleanup are
  newer than the cutoff and untouched.
- **Repository transactional semantics.** The cleanup
  delete is a single `DeleteOlderThan` call —
  transactional semantics are the repository's
  responsibility. Partial deletes on failure are bounded
  by the repository's own transaction handling.

## Risk

- **Likelihood:** Low — exercised on retention cadence
  (typically nightly).
- **Impact:** High — a defective cleanup either deletes
  too much (audit-loss) or too little (storage pressure).
- **Mitigations:** Archive-then-delete two-phase pattern
  (AC-1 + AC-5), explicit Enabled flag (AC-4),
  optional-deleter probe (AC-6), per-row tolerance in
  archive (AC-2).

## Implements (cross-cutting)

- **REQ-004 — Audit per mutation.** Indirect — this REQ
  governs the *retention* of those audit rows.
- **REQ-005 — Fail-closed.** AC-4 + AC-6 default to
  no-op rather than partial action when configuration is
  missing.
- **REQ-009 — Observability.** AC-3 — counter; per-row
  failure logs.
- **REQ-010 — Configuration environment-bound.**
  Retention settings come from the environment-bound
  config, never source.

## Compliance mapping

| Control | Coverage |
|---|---|
| SOC2 CC7.2 (System monitoring) | AC-1 — archived rows still queryable for forensic review. |
| ISO27001 A.18.1.3 (Records management) | AC-1 + AC-5 — controlled retention with archive-then-delete pattern. |
| GDPR Art. 5 (Storage limitation) | AC-5 + AC-7 — bounded retention with configurable default. |

## Satisfied by

- `pk-modules/audit_management/features/audit_trail/service.go::ArchiveAuditEvents, CleanupExpiredEvents`.
- `pk-modules/audit_management/features/audit_trail/retention.go::ProvideRetentionSettings, RetentionSettings`.
- `pk-modules/audit_management/features/audit_trail/cleanup.go::CleanupJobHandler` — the scheduler entry.

## Related requirements

- [REQ-AUDIT-001 — Audit trail](./REQ-AUDIT-001-audit-trail.md)
- [REQ-AUDIT-010 — Audit record](./REQ-AUDIT-010-audit-record.md) — the write path whose output this REQ retires.
- [REQ-AUDIT-011 — Audit query + integrity](./REQ-AUDIT-011-audit-query-integrity.md) — query path that may target archived rows.
- [REQ-010 — Configuration environment-bound](./REQ-010-configuration-environment-bound.md)
