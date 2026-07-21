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

Under the declared warm normal-load profile, every route explicitly enrolled as
a bounded platform-owned interactive response or bounded durable asynchronous
acceptance **SHALL** complete with p95 latency at or below 50 ms and p99 latency
at or below 100 ms. Clients
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

- **AC-1** Explicitly enrolled `interactive` and `async_acceptance` routes are
  the only bounded request classes in this contract. Each has p95 ≤ 50 ms and
  p99 ≤ 100 ms. HTTP 202 alone does not enroll a route or prove durability;
  streaming completion and bulk-ingress round trips have no objective under
  this requirement.
- **AC-2** A valid warm run uses the exact checked-in gate configuration:
  base URL, objective, warm-up count, measured-request count, concurrency,
  timeout, and each route's method/path/class/status plus optional request
  inputs. The report records the actual probe base URL, timestamp, measurement
  kind, sample counts, and per-route results; routes are judged independently.
- **AC-3** A route enrolled as `async_acceptance` returns HTTP 202 only after
  validation, authorization, idempotency handling, and a durable job/outbox
  commit. Queueing or completion work that can still be lost does not satisfy
  acceptance, and a generic wire-level 202 classification is only diagnostic.
  The current release manifest enrolls no `async_acceptance` route and therefore
  makes no current latency claim for an existing HTTP 202.
- **AC-4** Server evidence preserves normalized route, method, status, and
  response-class dimensions and exact 50 ms/100 ms histogram boundaries. Fast
  routes or statuses cannot mask a failing route through aggregation.
- **AC-5** Platform-owned persistence and messaging required for the bounded
  response remain inside the objective. External-provider/model execution,
  bulk request-body ingestion/preprocessing, cross-region/public-network
  transit, cold-start intervals, client scheduling, and device paint are
  excluded from that server percentile and tracked as named separate segments.
  A route doing bulk work before HTTP 202 remains outside bounded enrollment
  until it is redesigned around an early durable handoff.
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
  request, every HTTP 202, bulk ingress, external completion, Internet round
  trip, or device paint finishes within 50 ms.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `pk-core/observability/latency/policy_test.go::TestBoundedRequestObjectivesStayAtThePlatformLatencyFloor` |
| AC-2 | Test | `tooling/pk-testkit/latency/gate_test.go::TestRunRequiresEnoughSamplesForP99Evidence` |
| AC-2 | Analysis | `tooling/pk-testkit/latency/gate.go`, `pk-apps/config/latency-release.json` |
| AC-3 | Analysis | `tooling/pk-testkit/latency/gate.go`, `pk-apps/config/latency-release.json`, `pk-modules/collectibles/features/upload/pdf_import.go` |
| AC-4 | Test | `pk-core/observability/metrics/providers/otel/metrics_latency_test.go::TestHTTPRequestHistogramHasExactLatencyObjectiveBoundaries` |
| AC-5 | Inspection | `pk-core/docs/architecture/runtime_latency_slo.md`, `pk-modules/collectibles/features/upload/pdf_import.go` |
| AC-6 | Analysis | the frontend kit's `assets/js/controllers/core/async_action_controller.test.mjs`, `product/platformkit-mobile/tests/mobile-runtime-source-contract.test.mjs`, `product/platformkit-mobile/tests/local-interaction-feedback.rntl.test.tsx` |
| AC-7 | Analysis | `pk-apps/.github/workflows/release.yml`, `pk-apps/scripts/tests/materialize-release-workspace.sh`, `pk-apps/config/latency-release.json` |
| AC-8 | Inspection | `product/platformkit-docs/adr/0074-warm-platform-owned-latency-is-a-release-gated-percentile-contract.md`, `product/platformkit-docs/conventions.md`, `pk-core/docs/architecture/runtime_latency_slo.md` |

## Satisfied by

- [ADR 0074 — Warm platform-owned latency is a release-gated percentile contract](../adr/0074-warm-platform-owned-latency-is-a-release-gated-percentile-contract.md)
- [Convention C-24 — Warm latency claims require segmented exact-candidate evidence](../conventions.md#c-24-warm-latency-claims-require-segmented-exact-candidate-evidence)
