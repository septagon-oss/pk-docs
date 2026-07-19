---
id: REQ-020
title: "Warm platform-owned interactions meet the percentile latency objective"
status: Active
date: 2026-07-19
slug: req-020-warm-platform-owned-interactions-meet-the-latency-objective
category: performance
ears_pattern: ubiquitous
verification_methods:
  - analysis
  - test
  - inspection
compliance: []
satisfied_by:
  adr: [ADR-0074]
  conventions: [C-24]
type: doc
tags: [requirement, performance, latency, observability, release, mobile]
---

# REQ 020 — Warm platform-owned interactions meet the percentile latency objective

Status: **Active** (2026-07-19)

## Statement

Under the declared warm normal-load profile, PlatformKit **SHALL** complete
platform-owned interactive responses and durable asynchronous acceptances with
p95 latency at or below 50 ms and p99 latency at or below 100 ms. Clients
**SHALL** target observable local pending feedback within 50 ms without waiting
for network work. External-provider/model execution, public-network transit,
and device paint **SHALL NOT** be represented as platform-owned server latency;
they **SHALL** remain separately observable. Promotion **SHALL** require passing
per-route evidence produced by the exact release candidate being promoted.

## Rationale

A latency promise is operationally useful only when its ownership and evidence
are explicit. Percentiles describe the normal and tail experience without
pretending every request has an absolute maximum. Segmenting external work,
network transit, and client paint prevents the server SLO from becoming either
an impossible promise or a place to hide latency the platform actually owns.
Binding the report to the promoted candidate prevents stale or nearby-build
evidence from authorizing a release.

## Acceptance criteria

- **AC-1** `interactive` and `async_acceptance` are the only bounded request
  classes in this contract. Each has p95 ≤ 50 ms and p99 ≤ 100 ms; streaming
  handler completion has no objective under this requirement.
- **AC-2** A valid warm run records the exact route manifest, objective, probe
  location, payload/data/load profile, warm-up count, concurrency, and at least
  100 measured requests per route. Routes are judged independently.
- **AC-3** `async_acceptance` returns HTTP 202 only after validation,
  authorization, idempotency handling, and a durable job/outbox commit. Queueing
  or completion work that can still be lost does not satisfy acceptance.
- **AC-4** Server evidence preserves normalized route, method, status, and
  response-class dimensions and exact 50 ms/100 ms histogram boundaries. Fast
  routes or statuses cannot mask a failing route through aggregation.
- **AC-5** Platform-owned persistence and messaging required for the bounded
  response remain inside the objective. External-provider/model execution,
  cross-region/public-network transit, cold-start intervals, client scheduling,
  and device paint are excluded from that server percentile and tracked as
  named separate segments.
- **AC-6** A client interaction commits visible local pending state before its
  first network wait and targets ≤ 50 ms input-to-pending feedback. Same-turn
  ordering or render-state tests do not claim physical device paint time; such
  a claim requires device performance evidence.
- **AC-7** The pre-promotion evidence set identifies the exact candidate digest,
  runtime configuration, route manifest, sample counts, and per-route results.
  Every declared release route passes both percentiles and its status/class
  contract, and the candidate digest is revalidated immediately before tags
  move. Evidence from another artifact cannot authorize promotion.
- **AC-8** Documentation, telemetry, and release reports describe percentile
  objectives and explicit exclusions. They do not state or imply that every
  request, external completion, Internet round trip, or device paint finishes
  within 50 ms.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1, AC-4 | Test | `core/platformkit-backend-kit/observability/latency/policy_test.go`, `observability/metrics/providers/middleware/middleware_latency_test.go`, and `observability/metrics/providers/otel/metrics_latency_test.go` |
| AC-2 | Test | `tooling/platformkit-tests/latency/gate_test.go` and `cmd/latency-gate/main_test.go` |
| AC-3 | Analysis + test | Route integration contracts prove the durable job/outbox write; the latency gate requires HTTP 202 for `async_acceptance` routes. |
| AC-5 | Inspection | `core/platformkit-backend-kit/docs/architecture/runtime_latency_slo.md`, OpenTelemetry spans, client round-trip reports, and queue/provider telemetry keep boundary segments distinct. |
| AC-6 | Test | `frontend/platformkit-frontend-kit` interaction-feedback tests and `product/platformkit-mobile/tests/mobile-runtime-source-contract.test.mjs` plus `local-interaction-feedback.rntl.test.tsx` |
| AC-7 | Test + inspection | `apps/platformkit-apps/.github/workflows/release.yml`, `scripts/tests/materialize-release-workspace.sh`, `config/latency-release.json`, and retained candidate latency/smoke evidence |
| AC-8 | Inspection | ADR 0074, Convention C-24, runtime latency documentation, and the latency-gate report schema |

## Satisfied by

- [ADR 0074 — Warm platform-owned latency is a release-gated percentile contract](../adr/0074-warm-platform-owned-latency-is-a-release-gated-percentile-contract.md)
- [Convention C-24 — Warm latency claims require segmented exact-candidate evidence](../conventions.md#c-24-warm-latency-claims-require-segmented-exact-candidate-evidence)
