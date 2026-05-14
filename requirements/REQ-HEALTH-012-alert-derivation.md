---
id: REQ-HEALTH-012
title: "Alert derivation surfaces non-healthy checks and prunes acknowledgements once the underlying alert resolves"
status: Proposed
date: 2026-05-08
slug: req-health-012-alert-derivation
category: health
ears_pattern: ubiquitous
priority: should
risk: medium
verification_methods: [test]
compliance:
  - SOC2_CC7.3
  - SOC2_CC7.4
  - ISO27001_A.16.1
satisfied_by:
  adr: [ADR-0009]
  conventions: [C-04, C-14]
implements_cross_cutting: [REQ-009, REQ-014]
refines: REQ-HEALTH-001
type: doc
tags: [requirement, capability, health_management, health_monitoring, alert]
module: health_management
feature: health_monitoring
capability: alert_derivation
capability_kind: state_machine
stakeholders:
  - operator (acknowledges alerts)
  - SRE (consumes alert feed)
---

# REQ HEALTH-012 — Alert derivation

Status: **Proposed** (2026-05-08)

## Statement

The health-monitoring feature **shall** expose
two alert-management primitives:

1. **`DeriveAlerts(checks,
   acknowledgements)`** — produce the
   current alert set by:
   - Including every check whose status is
     not `healthy` (i.e. `degraded` or
     `unhealthy`);
   - Decorating the alert with any
     active acknowledgement that matches
     the check (so the operator UI can
     show "ack'd by X at Y" instead of
     re-prompting);
2. **`PruneAcknowledgements(checks,
   acknowledgements)`** — remove
   acknowledgements whose underlying check
   has resolved (returned to `healthy`),
   so the ack feed doesn't accumulate
   stale entries.

The pair forms a stateless transformation:
the inputs are the current check state and
the persisted acknowledgement set; the
outputs are the alert list and the pruned
acknowledgement list.

## Rationale

Alerts are the operator's actionable
distillation of the health surface. Two
properties:

1. **Non-healthy = alert.** The platform
   should not alert on healthy modules;
   the filter is the explicit gate.
2. **Acknowledgements are
   resolution-bound.** An acknowledgement
   for a degraded check that has now
   recovered is stale; the prune step
   removes it so the operator UI doesn't
   show "old ack'd alerts" forever.

## Acceptance criteria

- **AC-1 — Alerts include non-healthy
  checks + acknowledgements.** A
  `DeriveAlerts(checks,
  acknowledgements)` returns one alert
  per non-healthy check, decorated with
  any matching acknowledgement.
- **AC-2 — Prune removes resolved
  acknowledgements.** A
  `PruneAcknowledgements(checks,
  acknowledgements)` returns the input
  acknowledgement list minus entries
  whose underlying check is now
  `healthy`.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `pk-modules/health_management/features/health_monitoring/api_test.go::TestDeriveAlertsIncludesNonHealthyChecksAndAcknowledgements`. |
| AC-2 | Test | `pk-modules/health_management/features/health_monitoring/api_test.go::TestPruneAcknowledgementsRemovesResolvedAlerts`. |

## Edge cases & unhappy paths

- **Acknowledgement for unknown check.**
  Currently retained (the acknowledgement
  is data, the check might re-appear
  later). Documented; future work may
  expire dangling acks after a window.
- **Multiple acks for one check.**
  Currently surfaced verbatim; the UI
  may dedupe. The data layer is the
  source of truth.
- **Empty inputs.** Returns empty
  alerts / pruned acks; no error.
- **Stale check timestamp.** Out of
  scope here; the freshness gate is
  the aggregator's concern.

## Risk

- **Likelihood:** High — every
  operator dashboard render.
- **Impact:** Medium — defective
  filters either spam alerts or hide
  them.
- **Mitigations:** Stateless
  transformation (testable in
  isolation), explicit non-healthy
  filter (AC-1), prune-on-resolve
  (AC-2).

## Implements (cross-cutting)

- **REQ-009 — Observability.** The
  alert feed is the operator's primary
  signal.
- **REQ-014 — Graceful degradation.**
  `degraded` checks surface as alerts
  without taking down the platform.

## Compliance mapping

| Control | Coverage |
|---|---|
| SOC2 CC7.3 (Detection) | AC-1 — non-healthy detection. |
| SOC2 CC7.4 (Incidents) | AC-1 — alert feed. |
| ISO27001 A.16.1 (Incident management) | AC-2 — resolution tracking. |

## Satisfied by

- `pk-modules/health_management/features/health_monitoring/api.go::DeriveAlerts, PruneAcknowledgements`.

## Related requirements

- [REQ-HEALTH-001 — Health monitoring umbrella](./REQ-HEALTH-001-health-monitoring.md)
- [REQ-HEALTH-010 — Health registry](./REQ-HEALTH-010-health-registry.md)
- [REQ-HEALTH-011 — Aggregated health check](./REQ-HEALTH-011-aggregated-check.md)
