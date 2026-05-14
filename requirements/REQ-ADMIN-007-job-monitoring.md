---
id: REQ-ADMIN-007
title: "Job monitoring feature surfaces background-job state and run history to operators"
status: Proposed
date: 2026-05-07
slug: req-admin-007-job-monitoring
category: governance
ears_pattern: ubiquitous
verification_methods: [inspection]
compliance: []
satisfied_by:
  adr: [ADR-0009]
  conventions: [C-14]
implements_cross_cutting: [REQ-009, REQ-014]
type: doc
tags: [requirement, feature, admin_management]
module: admin_management
feature: job_monitoring
---

# REQ ADMIN-007 — Job monitoring

Status: **Proposed** (2026-05-07)

## Statement

The job monitoring feature **shall** expose admin pages that
display the registered background jobs (cron jobs, queue
consumers), their current state (idle, running, failed), the last
run's outcome, and the next scheduled run. Operators **shall** be
able to trigger an immediate run and inspect the per-job logs.

## Rationale

Background jobs are invisible by default — an operator who does
not know a job exists cannot confirm it is running. The discipline
of "every registered job appears here" mirrors REQ-ADMIN-005:
a discovered surface, not a hand-curated list. Operator-triggered
runs are the operational lever that lets an SRE re-run a failed
nightly without redeploying.

## Acceptance criteria

- **AC-1** Every registered job appears in the monitoring view
  with state and last-run outcome.
- **AC-2** Operator-triggered runs are audited with the actor and
  the trigger reason.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Inspection | Coverage gap — no `*_test.go` exists for `job_monitoring`; reviewers verify the live-job lookup path. |
| AC-2 | Inspection | Coverage gap; reviewers verify the trigger-audit wiring. |

## Implements (cross-cutting)

- REQ-009 — observability (job state is observable).
- REQ-014 — graceful degradation (failed jobs are visible, not silent).

## Satisfied by

- `admin_management/features/job_monitoring/feature.go`
- `admin_management/features/job_monitoring/handler.go`
- `admin_management/features/job_monitoring/permissions.go`,
  `routes.go`

## Related requirements

- [REQ-009 — Observability everywhere](./REQ-009-observability-everywhere.md)
