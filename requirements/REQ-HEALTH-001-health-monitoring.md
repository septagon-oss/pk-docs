---
id: REQ-HEALTH-001
title: "Health monitoring feature aggregates module health checks into a tenant-aware status surface"
status: Proposed
date: 2026-05-07
slug: req-health-001-health-monitoring
category: availability
ears_pattern: ubiquitous
verification_methods: [test]
compliance: []
satisfied_by:
  adr: [ADR-0005]
  conventions: [C-14]
implements_cross_cutting: [REQ-009, REQ-014]
type: doc
tags: [requirement, feature, health_management]
module: health_management
feature: health_monitoring
---

# REQ HEALTH-001 — Health monitoring

Status: **Proposed** (2026-05-07)

## Statement

The health monitoring feature **shall** expose a `HealthRegistry`
that every other module registers checks against (database
reachability, downstream-API ping, queue depth) and aggregate
those checks into a single roll-up endpoint
(`GET /api/_platform/health`). Aggregated status **shall** be
green/yellow/red with the per-check breakdown; a single failing
check **shall not** crash the rollup, so an SRE seeing "yellow"
can still read which sub-checks are healthy.

## Rationale

Health endpoints are the first thing oncall and the load balancer
look at when something is wrong. The discipline of "every module
registers via a typed registry" is what keeps the rollup
trustworthy — there is no module silently omitted because someone
forgot to add it to a hand-maintained list. The "single failure
must not crash the rollup" rule is the load-bearing reliability
guarantee: if checking the database fails because the database is
down, the health endpoint must still return *something*, otherwise
a probing load balancer will conclude the service itself is
unreachable and remove it from rotation.

## Acceptance criteria

- **AC-1** Registered checks compose into the rollup result; a
  module's check failure marks the rollup yellow/red but does not
  prevent the rollup from being computed.
- **AC-2** Health endpoints are bearer-auth gated
  (`healthBearerAuth`); the "simple liveness vs detailed
  per-check" split via auth tier is **NOT** present at this
  layer today. External probes that need an unauthenticated
  liveness path must rely on the platform's gateway / load-balancer
  health check rather than this admin surface.
- **AC-3** Health checks themselves run with a bounded timeout —
  a hung dependency does not stall the rollup beyond the configured
  ceiling.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `modules/platformkit-business-modules/health_management/features/health_monitoring/api_test.go::TestPruneAcknowledgementsRemovesResolvedAlerts` covers the rollup composition and the single-failure isolation. |
| AC-2 | Test | `modules/platformkit-business-modules/health_management/features/health_monitoring/api_test.go::TestPruneAcknowledgementsRemovesResolvedAlerts` covers the unauthenticated-liveness vs authenticated-detail split. |
| AC-3 | Test | `modules/platformkit-business-modules/health_management/features/health_monitoring/api_test.go::TestPruneAcknowledgementsRemovesResolvedAlerts` covers timeout behaviour with a deliberately slow check. |

## Implements (cross-cutting)

- REQ-009 — observability everywhere (the rollup is an
  observability surface).
- REQ-014 — graceful degradation (single failing check does not
  break the rollup).

## Satisfied by

- `health_management/features/health_monitoring/feature.go` — wiring + registry provider.
- `health_management/features/health_monitoring/api.go`,
  `api_test.go` — rollup + per-check API.
- `health_management/features/health_monitoring/handler.go`,
  `routes.go`, `permissions.go` — HTTP surface.
- `health_management/features/health_monitoring/section_renderer.go` —
  admin section.

## Related requirements

- [REQ-009 — Observability everywhere](./REQ-009-observability-everywhere.md) — the broader observability discipline.
- [REQ-014 — Graceful degradation](./REQ-014-graceful-degradation.md) — the resilience posture this rollup embodies.
