---
id: REQ-ADMIN-016
title: "Job monitoring admin surface gates mutations on jobs:manage, audits every mutation, and degrades gracefully"
status: Proposed
date: 2026-07-02
slug: req-admin-016-job-monitoring-admin
category: governance
ears_pattern: event-driven
priority: must
risk: medium
verification_methods: [test, inspection]
compliance:
  - SOC2_CC6.1
  - SOC2_CC7.2
satisfied_by:
  adr: [ADR-0009]
  conventions: [C-14]
implements_cross_cutting: [REQ-004, REQ-005, REQ-014]
refines: REQ-ADMIN-007
type: doc
tags: [requirement, capability, admin_management, job_monitoring, operator]
module: admin_management
feature: job_monitoring
capability: job_monitoring_admin
capability_kind: failure_mode
stakeholders:
  - operator (inspects and manages background jobs)
  - compliance auditor (traces who cancelled/rescheduled/retried a job)
  - lean compositions (boot without audit_management wired)
---

# REQ ADMIN-016 — Job monitoring admin

Status: **Proposed** (2026-07-02)

## Statement

The job-monitoring feature **shall** give admins payload-free visibility into
background jobs — overview stats, the scheduled-jobs list, and job
history rendered from `jobs.ExecutionInspector.ListExecutions` — on
pages gated by the `jobs:view` permission, and **shall** expose
three mutation endpoints: cancel
(`POST /admin/jobs/api/scheduled/{id}/cancel`), reschedule
(`POST .../scheduled/{id}/reschedule`, form field `execute_at` in
RFC3339), and retry (`POST /admin/jobs/api/history/{id}/retry`).

**When** a mutation endpoint is invoked, the handler **shall**:

1. Re-check `jobs:manage` inside the handler — independent of the
   upstream page-level gate — and respond `403` without touching
   the scheduler or emitting an audit event when the permission
   is missing;
2. Validate input before acting (missing job id → `400`;
   non-RFC3339 `execute_at` → `400` with the scheduler untouched;
   retry of a job whose original is no longer listed → `404`
   rather than fabricating a payload);
3. Delegate to the scheduler (`Cancel`, `Reschedule`, or provider-native
   `RedriveExecution` for retry). Redrive **shall not** expose or reconstruct
   the original payload outside the scheduler backend;
4. Emit one structured audit event per attempt — action
   `job.cancel` / `job.reschedule` / `job.retry`, resource type
   `job`, resource id, actor from the request context, outcome
   `success` or `failure` with the error captured — regardless of
   whether the scheduler call succeeded.

**Where** no `ports.AuditRecorder` is composed (lean builds,
test rigs), mutation endpoints **shall** still function with the
audit emit as a no-op; production wiring supplies the recorder as
an optional fx dependency from audit_management.

## Rationale

Job mutations are operator superpowers: a cancelled billing run or
a re-enqueued email blast has tenant-visible blast radius. Two
disciplines carry the weight, and both are failure-mode shaped —
hence `capability_kind: failure_mode`. The in-handler `jobs:manage`
re-check means a misconfigured admin router cannot open the
mutation surface: the gate rides with the handler, and denial is
total (no scheduler call, no audit row, plain `403`). The
audit-per-attempt rule means both outcomes are on the ledger — a
failed cancel is as interesting to an incident responder as a
successful one.

Audit emission is deliberately best-effort at the call site
(errors swallowed; the recorder optional): failing an operator's
action because audit storage hiccupped would double-degrade the
incident they are responding to. Durability is the recorder's
concern (REQ-004 / ADR-0007), not this handler's.

## Acceptance criteria

- **AC-1 — Permission gating.** A mutation request without
  `jobs:manage` receives `403`; the scheduler is not invoked and
  no audit event is emitted. Read pages require `jobs:view`
  (enforced by the admin page gate; list rendering additionally
  hides row action menus from operators without `jobs:manage`).
- **AC-2 — Audit trail.** Every executed mutation emits exactly
  one audit event carrying the action (`job.cancel` /
  `job.reschedule` / `job.retry`), resource type `job`, the job
  id, and the outcome — `success` on a clean scheduler call,
  `failure` with the error message when the scheduler errors.
- **AC-3 — Nil-audit tolerance.** With no audit recorder wired,
  mutations still execute against the scheduler and respond
  normally.
- **AC-4 — Input validation before action.** A reschedule with a
  non-RFC3339 `execute_at` returns `400` and never reaches the
  scheduler.
- **AC-5 — Retry requires an archived execution.** Retry invokes
  `RedriveExecution` for the tenant-scoped archived execution without
  exposing its payload. A missing execution returns `404`; any non-archived
  execution returns `409`; neither case schedules anything.
- **AC-6 — Read surface degrades gracefully.** Overview stats and
  the scheduled/history lists render from the scheduler; listing
  errors and empty result sets render empty/error states rather
  than failing the page.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `modules/platformkit-business-modules/admin_management/features/job_monitoring/handler_test.go::TestCancelDeniesWithoutPermission` (403 + scheduler untouched + zero audit events). Manage-only action menus: Inspection — `handler.go::serveScheduledList` / `serveHistoryList` `canManage` branches. |
| AC-2 | Test | `modules/platformkit-business-modules/admin_management/features/job_monitoring/handler_test.go::TestCancelHappyPathEmitsAudit` (success outcome), `TestCancelPropagatesSchedulerError` (failure outcome), `TestRescheduleHappyPath` and `TestRetryHappyPath` (per-action events + metadata). |
| AC-3 | Test | `modules/platformkit-business-modules/admin_management/features/job_monitoring/handler_test.go::TestHandlerWithoutAuditRecorderStillFunctions`. |
| AC-4 | Test | `modules/platformkit-business-modules/admin_management/features/job_monitoring/handler_test.go::TestRescheduleRejectsBadExecuteAt`. |
| AC-5 | Test | `modules/platformkit-business-modules/admin_management/features/job_monitoring/handler_test.go::TestRetryHappyPath` and `TestRetryReturnsNotFoundWhenOriginalMissing`. |
| AC-6 | Inspection | `modules/platformkit-business-modules/admin_management/features/job_monitoring/handler.go::serveOverviewStats, serveScheduledList, serveHistoryList` — error and empty branches render `ui.EmptyState` / degraded stats. Dedicated render tests pending. |

## Edge cases & unhappy paths

- **Anonymous actor.** With no user id in context the audit event
  records actor type `admin` with an empty actor id; a user in
  context records actor type `user` with the id.
- **Audit recorder errors.** Swallowed by design
  (`_ = h.audit.RecordAuditEvent(...)`) — the operator action's
  outcome is decided by the scheduler, not by audit storage.
- **History is scheduler-dependent.** The current scheduler does
  not persist completed executions; the history view shows the
  latest scheduler records and says so in-page.
- **Retry lookup window.** The original is located by walking the
  most recent 200 scheduled entries — a long-evicted job is
  legitimately `404`.

## Risk

- **Likelihood:** Medium — exercised whenever operators manage
  background jobs.
- **Impact:** Medium — an open mutation gate lets any admin-panel
  user cancel platform jobs; a missing trail blinds incident
  review.
- **Mitigations:** In-handler re-check (AC-1),
  audit-per-attempt (AC-2), validate-before-act (AC-4, AC-5).

## Implements (cross-cutting)

- **REQ-004 — Audit event per mutation.** AC-2 — one catalogued
  event per job mutation attempt.
- **REQ-005 — Authorisation fails closed.** AC-1 — the handler
  re-checks the permission itself; denial is total.
- **REQ-014 — Graceful degradation.** AC-3 + AC-6 — optional
  recorder and error-tolerant rendering.

## Compliance mapping

| Control | Coverage |
|---|---|
| SOC2 CC6.1 (Logical access controls) | AC-1 — mutation surface is permission-gated at the handler. |
| SOC2 CC7.2 (System monitoring) | AC-2 — job mutations are attributable on the audit ledger. |

## Satisfied by

- `modules/platformkit-business-modules/admin_management/features/job_monitoring/handler.go::RegisterRoutes, handleCancel, handleReschedule, handleRetry, recordJobAudit`.
- `modules/platformkit-business-modules/admin_management/features/job_monitoring/feature.go::NewFeature` —
  admin pages, endpoint metadata, and the fx wiring that injects
  the required scheduler + optional audit recorder.
- `modules/platformkit-business-modules/admin_management/features/job_monitoring/routes.go` —
  route metadata pointer (endpoint truth lives in feature.go).

## Related requirements

- [REQ-ADMIN-007 — Job monitoring](./REQ-ADMIN-007-job-monitoring.md) —
  the feature umbrella this capability narrows to the shipped
  gate/audit/degradation behaviour.
- [REQ-AUDIT-010 — Audit record](./REQ-AUDIT-010-audit-record.md) —
  the pipeline that persists the events AC-2 emits.
- [REQ-018 — Permission coverage fail-closed](./REQ-018-permission-coverage-fail-closed.md) —
  the platform-wide discipline the in-handler re-check instances.
