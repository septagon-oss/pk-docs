---
id: REQ-DATA-003
title: "Recovery assurance is exercised through an executable provider-neutral drill"
status: Active
date: 2026-07-15
slug: req-data-003-executable-recovery-drill
category: availability
ears_pattern: event-driven
verification_methods: [test, inspection]
compliance: []
satisfied_by:
  adr: []
  conventions: []
implements_cross_cutting: [REQ-014, REQ-015]
type: doc
tags: [requirement, feature, data, drill, restore, disaster-recovery]
module: infrastructure
feature: data_lifecycle_drill
---

# REQ DATA-003 — Recovery assurance is exercised through an executable provider-neutral drill

Status: **Active** (2026-07-15)

## Statement

**When** recovery assurance is evaluated, the platform **shall** invoke a
provider-neutral probe for every enabled backup, restore, and
disaster-recovery check and shall feed the returned evidence into the same
fail-closed readiness decision used by the release gate.

## Rationale

A checklist can be marked complete without exercising recovery. The drill
contract forces policy to become execution while keeping cloud- and
database-specific commands behind a small adapter. Using the same evaluator
for collected evidence and executable drills prevents the two paths from
acquiring different readiness semantics.

## Acceptance criteria

- **AC-1** The drill invokes exactly one probe check for every check enabled by
  the validated policy, including backup, restore, and disaster recovery in a
  production-like environment.
- **AC-2** A missing probe is a hard failure whenever the policy requires any
  check; a provider-reported failure prevents readiness.
- **AC-3** Evidence returned for a different kind than requested is converted
  into failed evidence for the requested kind.
- **AC-4** A policy with no enabled checks, such as the development default,
  may complete without a probe but does not claim production evidence.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `infrastructure/platformkit-infra-pulumi/internal/contract/data_lifecycle_drill_test.go::TestRunDataLifecycleDrillRunsAllProductionChecks` |
| AC-2 | Test | `infrastructure/platformkit-infra-pulumi/internal/contract/data_lifecycle_drill_test.go::TestRunDataLifecycleDrillFailsClosedOnProviderFailure` |
| AC-3 | Inspection | `infrastructure/platformkit-infra-pulumi/internal/contract/data_lifecycle_drill.go::RunDataLifecycleDrill` replaces a mismatched result with explicit failed evidence. |
| AC-4 | Test | `infrastructure/platformkit-infra-pulumi/internal/contract/data_lifecycle_drill_test.go::TestRunDataLifecycleDrillDoesNotRequireProbeForDevelopment` |

## Implements (cross-cutting)

- **REQ-014** — provider failures produce a deterministic failed decision.
- **REQ-015** — one shared drill contract makes recovery testing repeatable
  across provider adapters.

## Satisfied by

- `infrastructure/platformkit-infra-pulumi/internal/contract/data_lifecycle_drill.go::DataLifecycleProbe`.
- `infrastructure/platformkit-infra-pulumi/internal/contract/data_lifecycle_drill.go::RunDataLifecycleDrill`.

## Related requirements

- [REQ-DATA-001 — Recovery evidence gate](./REQ-DATA-001-recovery-evidence-gate.md)
- [REQ-DATA-004 — Executable tenant-data drill](./REQ-DATA-004-executable-tenant-data-drill.md)
