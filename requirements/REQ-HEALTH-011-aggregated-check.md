---
id: REQ-HEALTH-011
title: "Aggregated health check evaluates every module and rolls up the worst-status as the platform overall"
status: Proposed
date: 2026-05-08
slug: req-health-011-aggregated-check
category: health
ears_pattern: ubiquitous
priority: must
risk: medium
verification_methods: [test]
compliance:
  - SOC2_CC7.2
  - ISO27001_A.16.1
satisfied_by:
  adr: [ADR-0009]
  conventions: [C-04, C-14]
implements_cross_cutting: [REQ-009, REQ-014]
refines: REQ-HEALTH-001
type: doc
tags: [requirement, capability, health_management, health_monitoring, aggregate]
module: health_management
feature: health_monitoring
capability: aggregated_check
capability_kind: data_invariant
stakeholders:
  - operator (sees rolled-up status)
  - SRE (alerts on degraded / unhealthy)
  - load balancer (consumes liveness probe)
---

# REQ HEALTH-011 — Aggregated health check

Status: **Proposed** (2026-05-08)

## Statement

The health-monitoring feature **shall** expose
`CheckAll(ctx)` that:

1. Iterates every registered provider;
2. Invokes each provider's `CheckHealth(ctx)`
   to collect the per-module results;
3. **Prepends the module id** to each check
   name so cross-module name collisions are
   disambiguated (e.g.,
   `auth_management.database` not just
   `database`);
4. **Rolls up overall status** by the
   worst-status rule:
   - Any `unhealthy` → overall `unhealthy`;
   - Any `degraded` (without unhealthy) →
     overall `degraded`;
   - Otherwise → `healthy`;
5. Honours `ctx.Cancelled()` — when the
   caller's context is canceled, the
   in-progress checks finish and the
   aggregator returns;
6. Returns `healthy` for an empty registry
   (no modules registered = nothing to
   complain about).

`CheckModule(moduleID)` **shall** be the
single-module variant; `GetAggregatedStatus`
returns the rolled-up status with per-module
counts and a timestamp.

## Rationale

Aggregated health is the platform's "is the
system up?" gauge. Three properties:

1. **Module-id name prefix.** Two modules
   could each call their database check
   `database`; without the prefix the operator
   dashboard would conflate them. The prefix
   is the disambiguation discipline.
2. **Worst-status wins.** A user-facing
   "platform is healthy" gauge that masks an
   `unhealthy` module in some dark corner is
   misleading. The roll-up rule preserves the
   bad signal.
3. **Empty registry is healthy.** A fresh
   deployment with zero registered modules
   should not report unhealthy; the
   "nothing to complain about" semantic is
   the explicit no-op.

## Acceptance criteria

- **AC-1 — All healthy.** When every module
  reports `healthy`, the aggregate is
  `healthy`.
- **AC-2 — Mixed healthy + unhealthy.** When
  any module reports `unhealthy`, the
  aggregate is `unhealthy` regardless of
  the rest.
- **AC-3 — Degraded does not override
  unhealthy.** A module with `degraded`
  alongside an `unhealthy` module produces
  `unhealthy` overall.
- **AC-4 — Only-degraded sets aggregate
  degraded.** A run with only `degraded`
  reports (no unhealthy) sets the aggregate
  to `degraded`.
- **AC-5 — Module-id prepended.** Each
  per-module result has its check name
  prefixed with the module id.
- **AC-6 — Empty check name uses module-id
  alone.** A check with no name (just a
  module-level "is the module up?" probe)
  surfaces with the module id as the
  full name.
- **AC-7 — Empty registry healthy.** A
  registry with zero providers returns
  `healthy`.
- **AC-8 — CheckModule returns single
  module.** A `CheckModule(moduleID)`
  returns only that module's results;
  unknown module returns the typed
  unknown-module error.
- **AC-9 — Aggregated status counts
  modules.** `GetAggregatedStatus` returns
  per-status module counts (healthy,
  degraded, unhealthy).
- **AC-10 — Aggregated status all
  healthy.** When every module is
  healthy, the count map shows
  `healthy = N, degraded = 0, unhealthy =
  0`.
- **AC-11 — Aggregated status only
  degraded.** When the worst is degraded,
  the overall is `degraded` (mirrors
  AC-4).
- **AC-12 — Timestamp set on aggregate.**
  Every aggregated result carries a
  `Timestamp` field.
- **AC-13 — Cancelled context.** When the
  caller's context is canceled mid-check,
  the aggregate completes the in-progress
  checks and returns.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `modules/platformkit-business-modules/health_management/registry_test.go::TestCheckAllAllHealthy`. |
| AC-2 | Test | `modules/platformkit-business-modules/health_management/registry_test.go::TestCheckAllMixedHealthyAndUnhealthy`. |
| AC-3 | Test | `modules/platformkit-business-modules/health_management/registry_test.go::TestCheckAllDegradedDoesNotOverrideUnhealthy`. |
| AC-4 | Test | `modules/platformkit-business-modules/health_management/registry_test.go::TestCheckAllOnlyDegradedSetsDegradedOverall`. |
| AC-5 | Test | `modules/platformkit-business-modules/health_management/registry_test.go::TestCheckAllPrependsModuleIDToCheckNames`. |
| AC-6 | Test | `modules/platformkit-business-modules/health_management/registry_test.go::TestCheckAllEmptyNameUsesModuleIDAlone`. |
| AC-7 | Test | `modules/platformkit-business-modules/health_management/registry_test.go::TestCheckAllEmptyRegistryReturnsHealthy`. |
| AC-8 | Test | `modules/platformkit-business-modules/health_management/registry_test.go::TestCheckModuleReturnsResultsForSpecificModule` and `TestCheckModuleReturnsErrorForUnknownModule`. |
| AC-9 | Test | `modules/platformkit-business-modules/health_management/registry_test.go::TestGetAggregatedStatusCountsModulesByStatus`. |
| AC-10 | Test | `modules/platformkit-business-modules/health_management/registry_test.go::TestGetAggregatedStatusAllHealthy`. |
| AC-11 | Test | `modules/platformkit-business-modules/health_management/registry_test.go::TestGetAggregatedStatusDegradedOnlySetsDegradedOverall`. |
| AC-12 | Test | `modules/platformkit-business-modules/health_management/registry_test.go::TestGetAggregatedStatusTimestampIsSet`. |
| AC-13 | Test | `modules/platformkit-business-modules/health_management/registry_test.go::TestCheckAllWithCancelledContext`. |

## Edge cases & unhappy paths

- **Provider panics.** Recover at the
  registry boundary; surface the panic as
  unhealthy. (Implemented by inspection;
  dedicated panic-recovery test pending.)
- **Concurrent provider register during
  check.** The check uses a snapshot of
  registered providers; new registrations
  do not race into the in-progress
  aggregate.
- **Slow provider.** Timed by the
  caller's context; a hung provider
  blocks until the caller cancels.
- **Adapter compatibility.** The
  `ports_adapter` layer
  (`ports_adapter_test.go`) exercises the
  cross-package contract.

## Risk

- **Likelihood:** High — every operator
  poll.
- **Impact:** Medium — defective
  aggregation either hides incidents or
  cries wolf.
- **Mitigations:** Worst-status roll-up
  (AC-2, AC-3), module-id prefixing
  (AC-5), empty-registry healthy (AC-7).

## Implements (cross-cutting)

- **REQ-009 — Observability.** Aggregate
  health is the platform's primary health
  metric.
- **REQ-014 — Graceful degradation.**
  `degraded` status is the "still
  serving but watch" signal.

## Compliance mapping

| Control | Coverage |
|---|---|
| SOC2 CC7.2 (System monitoring) | AC-1..AC-13 — operator-facing platform health. |
| ISO27001 A.16.1 (Incident management) | AC-2 — unhealthy detection drives incident response. |

## Satisfied by

- `modules/platformkit-business-modules/health_management/registry.go::CheckAll, CheckModule, GetAggregatedStatus`.
- `modules/platformkit-business-modules/health_management/ports_adapter.go::PortHealthProviderAdapter, HealthPortsAdapter`.

## Related requirements

- [REQ-HEALTH-001 — Health monitoring umbrella](./REQ-HEALTH-001-health-monitoring.md)
- [REQ-HEALTH-010 — Health registry](./REQ-HEALTH-010-health-registry.md)
- [REQ-HEALTH-012 — Alert derivation](./REQ-HEALTH-012-alert-derivation.md)
