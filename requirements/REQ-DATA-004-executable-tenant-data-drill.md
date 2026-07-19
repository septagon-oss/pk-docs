---
id: REQ-DATA-004
title: "Tenant-data governance is exercised through an executable provider-neutral drill"
status: Active
date: 2026-07-15
slug: req-data-004-executable-tenant-data-drill
category: data-durability
ears_pattern: event-driven
verification_methods: [test, inspection]
compliance: []
satisfied_by:
  adr: []
  conventions: []
implements_cross_cutting: [REQ-001, REQ-015]
type: doc
tags: [requirement, feature, data, drill, tenant-export, deletion, retention]
module: infrastructure
feature: data_lifecycle_drill
---

# REQ DATA-004 — Tenant-data governance is exercised through an executable provider-neutral drill

Status: **Active** (2026-07-15)

## Statement

**When** tenant-data governance assurance is evaluated, the platform **shall**
invoke the configured provider-neutral probe for every enabled tenant export,
tenant deletion, and retention-enforcement check and shall fail the readiness
decision if any required check cannot be demonstrated.

## Rationale

Export, deletion, and retention commonly live in different workers or cloud
services. A provider-neutral drill coordinates their evidence without moving
their implementation into the infrastructure contract. It also ensures that
a nominally configured control is not mistaken for an exercised control.

## Acceptance criteria

- **AC-1** A production-like drill invokes tenant-export, tenant-deletion, and
  retention probes as part of the complete required check set.
- **AC-2** A failed tenant-data probe or a missing required probe prevents a
  ready decision and preserves a diagnostic failure message.
- **AC-3** A probe that reports a different evidence kind than requested fails
  the requested tenant-data check rather than satisfying another check.
- **AC-4** The drill delegates its final decision to the common lifecycle gate,
  so manually supplied evidence and executable evidence have identical
  missing, failed, and warning semantics.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `infrastructure/platformkit-infra-pulumi/internal/contract/data_lifecycle_drill_test.go::TestRunDataLifecycleDrillRunsAllProductionChecks` |
| AC-2 | Test | `infrastructure/platformkit-infra-pulumi/internal/contract/data_lifecycle_drill_test.go::TestRunDataLifecycleDrillFailsClosedOnProviderFailure` |
| AC-3 | Inspection | `infrastructure/platformkit-infra-pulumi/internal/contract/data_lifecycle_drill.go::RunDataLifecycleDrill` validates each returned evidence kind against the requested kind. |
| AC-4 | Inspection | `infrastructure/platformkit-infra-pulumi/internal/contract/data_lifecycle_drill.go::RunDataLifecycleDrill` returns `EvaluateDataLifecycleGate(policy, evidence)`. |

## Implements (cross-cutting)

- **REQ-001** — the drill distinguishes tenant-data obligations from generic
  provider health.
- **REQ-015** — one deterministic contract is shared by all drill adapters and
  exercised without external provider dependencies in unit tests.

## Satisfied by

- `infrastructure/platformkit-infra-pulumi/internal/contract/data_lifecycle_drill.go::DataLifecycleProbe`.
- `infrastructure/platformkit-infra-pulumi/internal/contract/data_lifecycle_drill.go::RunDataLifecycleDrill`.

## Related requirements

- [REQ-DATA-002 — Tenant-data governance evidence gate](./REQ-DATA-002-tenant-data-governance-gate.md)
- [REQ-DATA-003 — Executable recovery drill](./REQ-DATA-003-executable-recovery-drill.md)
