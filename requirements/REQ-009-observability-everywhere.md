---
id: REQ-009
title: "Every operation produces traceable, measurable, and loggable signals"
status: Active
date: 2026-05-06
slug: req-009-observability-everywhere
category: governance # availability/performance baseline for runtime operations
ears_pattern: ubiquitous
verification_methods:
  - analysis
  - inspection
compliance:
  - SOC2_CC7.2
  - ISO27001_A.12.4
satisfied_by:
  adr: [ADR-0005]
  conventions: []
type: doc
tags: [requirement, governance, observability, compliance, availability, performance]
---

# REQ 009 — Every operation produces traceable, measurable, and loggable signals

Status: **Active** (2026-05-06)

## Statement

Every server-side request handler, scheduled job, async consumer, and
durable state mutation **SHALL** emit at least one structured log line,
one trace span, and one metric counter; failure paths **SHALL** include
the supplied error in the log line and increment a `*.failed` counter.

## Rationale

Uniform telemetry is the operational floor, not a stretch goal. During
an incident, responders need a single path from "what failed" to
"where, for whom, and how often" without reverse-engineering each
module's local logging style. PlatformKit already standardizes this
shape through `appcontext.WithLogger`, `observability/tracing`, and
`observability/metrics`; this REQ turns that implementation tendency
into a mandatory platform property.

The same baseline is required for SLO management and rollout safety.
Availability and performance are governed through measurable behaviour,
not anecdotes: saturation trends, error-rate spikes, and regressions
must be detectable per operation. The `metrics.Inc("foo.failed", ...)`
pattern visible across services provides a stable failure signal for
alerting, canary evaluation, and automated rollback decisions.

Audit and compliance reviews also depend on telemetry uniformity.
`observability/guardrail` and structured logging conventions make error
paths inspectable, while trace and metric continuity make controls
repeatable across modules. Without this floor, reviews become
service-by-service exceptions instead of evidence that the platform as a
whole is operated under one discipline.

## Acceptance criteria

- **AC-1** Every HTTP/API request path enters handler code with
  request-scoped trace identifiers and logger context wired through
  `appcontext` (`SetRequestInContext` plus `WithLogger`) so trace and
  log signals are emitted from the same operation context.
- **AC-2** Every durable state mutation path emits at least one metric
  increment through `observability/metrics` (for example `metrics.Inc`)
  so operation volume and outcomes remain measurable.
- **AC-3** Every failure path emits a structured log line that includes
  the supplied error and increments a `*.failed` metric counter.
- **AC-4** `observability/*/providers/noop/` implementations exist for
  logger, tracing, and metrics so a deployment does not hard-fail when
  telemetry exporters are intentionally stripped by SRE.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Inspection | Code-review checklist over `platformkit-backend-kit/infrastructure/middleware/context_enrichment.go` and `platformkit-backend-kit/security/authz/middleware/huma_logger_middleware.go`: request context carries trace IDs and logger via `appcontext` before handlers execute. |
| AC-2 | Inspection | Code-review checklist over durable mutation services (for example `modules/platformkit-business-modules/tenant_management/features/tenant_lifecycle/service.go`, `modules/platformkit-business-modules/user_management/features/user/service_crud.go`): each mutation path includes at least one `metrics.Inc(...)` call. |
| AC-3 | Inspection | Code-review checklist over failure paths (for example `modules/platformkit-business-modules/auth_management/features/authentication/login_service.go`, `modules/platformkit-business-modules/notification_management/features/email_notifications/service.go`): failure branch logs error fields and increments a `*.failed` counter. |
| AC-4 | Test | `platformkit-backend-kit/observability/logger/providers/noop/contract_test.go::TestNoOpLoggerContract`, `platformkit-backend-kit/observability/tracing/providers/noop/contract_test.go::TestNoOpTracerContract`, and `platformkit-backend-kit/observability/metrics/providers/noop/contract_test.go::TestNoOpMetricsContract` validate noop providers under `observability/*/providers/noop/`. |

## Satisfied by

- [ADR 0005 — Error-handling discipline](../adr/0005-error-handling-discipline.md) —
  failure handling is explicit and observable rather than silent,
  including mandatory error-signal emission.
- `platformkit-backend-kit/observability/logger/providers/noop/`,
  `platformkit-backend-kit/observability/tracing/providers/noop/`, and
  `platformkit-backend-kit/observability/metrics/providers/noop/` —
  noop-provider pattern that keeps modules operational when telemetry
  backends are absent.

## Compliance traceability

- **SOC2_CC7.2** — monitoring and anomaly detection require consistent
  logs, traces, and metrics across operations.
- **ISO27001_A.12.4** — event logging and monitoring controls require
  reliable operational telemetry.
