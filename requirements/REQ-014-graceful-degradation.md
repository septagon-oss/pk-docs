---
id: REQ-014
title: "External calls degrade gracefully under transient failure"
status: Active
date: 2026-05-06
slug: req-014-graceful-degradation
category: availability
ears_pattern: event-driven
verification_methods:
  - test
  - analysis
compliance: []
satisfied_by:
  adr: [ADR-0005]
  conventions: []
type: doc
tags: [requirement, availability, resilience]
---

# REQ 014 — External calls degrade gracefully under transient failure

Status: **Active** (2026-05-06)

## Statement

**When** a call to an external dependency (database, cache, message
bus, third-party API, sibling microservice) fails or times out, the
system **shall**: (a) bound the failure with a configured
timeout / retry / circuit-breaker, (b) surface a typed error that
callers can match on, (c) emit a `*.failed` metric counter and a
structured log line, and (d) **shall not** swallow the failure as a
silent success.

## Rationale

A platform that hides external failures is a platform that propagates
them. A blocked-but-not-erroring SMS send becomes a tenant who never
hears back. A hung database call becomes an HTTP request that holds
the connection open until the goroutine pool runs dry and every
tenant's request starts to queue. Graceful degradation is the
mechanism that turns "external dependency is sick" into "this one
operation is sick" — bounding the blast radius at the call site.

Circuit breakers, retries, and bulkheads belong at the resilience
layer, not in every caller. The `resilience/` package provides
composable wrappers (`circuitbreaker/`, `retry/`, `ratelimiter/`,
`bulkhead/`) that the application wires onto specific operation
classes. Typed errors (with `IsTimeout` / `IsTransient`
discriminators) let upstream code decide whether to retry, fall back,
or fail — the wrapper does not pre-decide.

The metric+log discipline closes the loop with observability
(REQ-009): SREs need to see *which* dependency is failing, *how
often*, and *whether the breaker has opened*. Without those signals
the breaker is a silent gatekeeper that lets latency creep without
warning.

## Acceptance criteria

- **AC-1** Every external call goes through a resilience-wrapper
  provider when one is configured for that operation class. Direct
  `http.Get` / `db.Query` calls without a wrapper are an exception
  reviewed at PR time.
- **AC-2** Typed error returns expose `IsTimeout()` / `IsTransient()`
  / equivalent discriminators so upstream code can match without
  string-comparing error messages.
- **AC-3** Failure paths increment a `*.failed` metric counter
  scoped to the operation (e.g. `auth.login.failed`,
  `email.send.failed`) and emit a structured log line with the
  underlying error.
- **AC-4** Tests exercise the breaker open / half-open / closed
  state transitions and the retry budget for each configured
  policy.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Inspection | Code review of every external-call site for the resilience wrapper. _Verification gap: a `pkvet`-style analyzer that mechanically flags raw external calls is planned but not yet implemented._ |
| AC-2 | Inspection | `platformkit-backend-kit/resilience/providers/circuitbreaker/*_test.go` — breaker error-type coverage. _Verification gap: cited resource is not a Go test (pattern / non-Go); downgraded to inspection._ |
| AC-3 | Test | Service-level tests (e.g. `modules/platformkit-business-modules/notification_management/features/email_notifications/service_test.go::TestIsValidEmail`) that assert the failure-counter increments on a simulated provider error. |
| AC-4 | Inspection | `platformkit-backend-kit/resilience/providers/circuitbreaker/circuitbreaker_test.go` — open / half-open / closed transitions. _Verification gap: pending — cited evidence is prose / pattern / non-Go and cannot be auto-resolved._ |

## Satisfied by

- [ADR 0005 — Error-handling discipline](../adr/0005-error-handling-discipline.md) —
  the broader "no silent failures" posture this REQ specialises for
  external boundaries.
- `platformkit-backend-kit/resilience/providers/circuitbreaker/`,
  `resilience/providers/retry/`, `resilience/providers/ratelimiter/`,
  `resilience/providers/bulkhead/` — the composable wrappers.

## Related requirements

- [REQ-005 — Authorisation gates fail closed under transient errors](./REQ-005-authorisation-fails-closed.md) —
  the stricter posture for security-critical gates (deny rather than
  retry).
- [REQ-009 — Every operation produces traceable, measurable, and loggable signals](./REQ-009-observability-everywhere.md) —
  the telemetry that makes degradation observable.
- [REQ-013 — Third-party integration adapters isolate external API boundaries](./REQ-013-integration-adapters-isolated.md) —
  the boundary the wrappers sit at.

## References

- `platformkit-backend-kit/resilience/` — provider implementations.
- `platformkit-backend-kit/app/errors/` — typed error definitions with
  the discriminator predicates.
