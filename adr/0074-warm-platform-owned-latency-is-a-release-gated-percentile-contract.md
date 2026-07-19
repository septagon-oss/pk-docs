---
title: "ADR 0074: Warm platform-owned latency is a release-gated percentile contract"
status: Accepted
date: 2026-07-19
slug: adr-0074-warm-platform-owned-latency-is-a-release-gated-percentile-contract
adr_topic: performance
type: doc
tags: [adr, performance, latency, observability, release, mobile]
---

# ADR 0074 — Warm platform-owned latency is a release-gated percentile contract

Status: **Accepted** (2026-07-19)

## The problem

“Respond in 50 ms” is useful only when the measured work, percentile, runtime
state, load profile, and release artifact are explicit. As an unqualified
maximum it is false: cold starts, Internet distance, external providers, model
inference, device scheduling, and isolated outliers are not controlled by one
server request budget. Averaging unrelated routes is equally misleading because
a high-volume fast route can hide a slow release-critical path.

The platform nevertheless needs a demanding, executable latency objective.
Interactive work owned by PlatformKit should feel immediate, unbounded work
should leave the request through a durable boundary, and a release should not
be promoted on evidence produced by a different build. Client feedback also
needs its own contract so a UI does not wait for a network round trip before it
acknowledges an interaction.

## The decision

PlatformKit uses a warm, percentile-based latency contract for routes that are
explicitly declared as platform-owned bounded work:

| Class | Objective | Completion boundary |
|---|---|---|
| Declared `interactive` | p95 ≤ 50 ms and p99 ≤ 100 ms | The platform-owned synchronous operation completes and returns its bounded response. |
| Declared `async_acceptance` | p95 ≤ 50 ms and p99 ≤ 100 ms | The bounded request is validated, authorized, made idempotent, and committed to its durable job or outbox boundary before HTTP 202. Later execution is outside this budget. |
| Local pending feedback | target ≤ 50 ms | The client commits an observable pending state without waiting for network discovery, transport, or server completion. |

HTTP 202 is a wire-level signal, not automatic enrollment in this contract and
not proof of durability. Runtime metrics may classify a 202 response as
`async_acceptance` for diagnosis, but a latency claim additionally requires an
explicit bounded-route declaration, an integration contract proving the
durable boundary, and inclusion in the release manifest. Multipart upload,
request-body ingestion, page counting, virus scanning, or similar size-bound
preprocessing is bulk ingress, not a bounded acceptance merely because the
eventual response is 202.

These are percentile objectives, not a hard maximum for every request. A warm
measurement starts only after the exact candidate is ready and its declared
connections have been exercised. It uses the checked-in bounded-route set,
the manifest's exact request inputs, concurrency and timeout, a warm-up batch
that primes the client pool, and at least 100 measured requests per route.
Every route is evaluated independently.

Platform-owned work required to produce the bounded response remains inside the
server objective, including calls to platform-owned persistence or messaging
needed for completion or durable acceptance. The following segments are not
silently charged to, or used to relax, that objective:

- external-provider and model execution after durable acceptance;
- bulk request-body ingress and preprocessing performed before acceptance;
- cross-region or public-Internet transit outside server processing;
- client runtime scheduling and physical device paint after pending state is
  committed; and
- cold-start and overload intervals outside the declared warm normal-load
  profile.

Those excluded segments remain separately observable. Provider/model spans,
queue wait and completion duration, client-observed round trip, cold-start
readiness, and client commit-to-paint measurements retain their own names and
dimensions. The server histogram never becomes a proxy for network distance or
device paint, and same-turn pending-state tests never become a fabricated
wall-clock paint claim.

The current PDF-import 202 endpoint is deliberately not enrolled. It can read a
multipart body up to 1 GiB, count PDF pages, upload the source, create a draft,
and only then enqueue work and respond. Its full ingress round trip cannot
honestly satisfy the 50 ms/100 ms bounded-acceptance objective. It needs a
separate bulk-ingress measurement and a redesigned early durable handoff before
it can be proposed for bounded-route enrollment. The checked-in release
manifest currently contains zero `async_acceptance` routes, so this decision
makes no present claim that an existing HTTP 202 meets the bounded objective.

Release promotion requires passing evidence from the exact candidate being
promoted. The release workflow boots the digest-pinned candidate, binds its
candidate identity and checked-in load configuration into the complete evidence
set, warms and measures every declared release route, retains the per-route
report, and fails if any route exceeds
either percentile or violates its response class/status contract. Immediately
before promotion it verifies that the candidate tag still resolves to the
evidenced digest. Evidence from another commit, image, architecture, runtime
configuration, or extrapolated environment cannot authorize promotion.

Long-lived streaming responses have no handler-completion objective under this
decision. A future stream-setup or time-to-first-byte claim needs its own named
metric and evidence rather than borrowing the bounded-response histogram.

## What we gave up

- We do not publish “all requests finish within 50 ms” or treat one successful
  local run as a universal latency guarantee.
- Release evidence takes time and must be repeated for the exact candidate;
  results from a nearby build cannot be reused.
- Unbounded provider, model, conversion, or delivery work must use a durable
  asynchronous design even when synchronous implementation would be simpler.
- Large uploads and other bulk ingress cannot borrow the 202 label to claim the
  bounded-acceptance objective.
- A deterministic same-turn client test proves ordering and visible pending
  state, not physical device paint time; a paint claim requires device evidence.

## What we kept

- A strict p95/p99 objective for the platform-owned work users and operators can
  improve directly.
- Per-route evidence, so fast health endpoints cannot hide a slow interactive
  or durable-acceptance route.
- Separate end-to-end and external-segment measurements for diagnosing latency
  beyond the server boundary.
- Immediate local feedback even when transport, provider, or completion latency
  is necessarily longer.

## How we enforce it

- [REQ 020](../requirements/REQ-020-warm-platform-owned-interactions-meet-the-latency-objective.md)
  defines the measurable cross-layer acceptance criteria.
- [Convention C-24](../conventions.md#c-24-warm-latency-claims-require-segmented-exact-candidate-evidence)
  defines the mechanical measurement and release-evidence rules.
- `core/platformkit-backend-kit/observability/latency` owns the request classes,
  p95/p99 objectives, local-feedback target, and exact histogram boundaries;
  middleware and OpenTelemetry tests preserve route/status/class dimensions.
  The wire-level 202 class remains diagnostic; release-manifest enrollment is
  the conformance authority.
- `tooling/platformkit-tests/cmd/latency-gate` primes the client pool, requires
  at least 100 samples per route, measures routes independently, and emits a
  fail-closed machine-readable report.
- `apps/platformkit-apps/config/latency-release.json` declares the release route
  set. The release workflow runs it against the digest-pinned candidate,
  validates the report before promotion, retains the evidence, and rechecks the
  candidate digest immediately before moving release tags.
- Frontend controller tests and native runtime tests prove that visible pending
  state is committed before transport; a device paint claim remains a separate
  performance-test obligation.
- Route-level Prometheus recording and alert rules preserve p95 and p99 by
  normalized route, status, and response class rather than aggregating away a
  regression.

## References

- [ADR 0005 — Error handling discipline](./0005-error-handling-discipline.md)
- [ADR 0008 — Async goroutine context semantics](./0008-async-goroutine-context-semantics.md)
- [ADR 0055 — Observability correlation spine and durable decisions](./0055-observability-correlation-spine-and-durable-decisions.md)
- [REQ 009 — Every operation is observable](../requirements/REQ-009-observability-everywhere.md)
- `core/platformkit-backend-kit/docs/architecture/runtime_latency_slo.md`
- `tooling/platformkit-tests/docs/latency-gate.md`
