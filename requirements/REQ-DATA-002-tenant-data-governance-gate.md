---
id: REQ-DATA-002
title: "Production tenant-data readiness requires export, deletion, and retention evidence"
status: Active
date: 2026-07-15
slug: req-data-002-tenant-data-governance-gate
category: data-durability
ears_pattern: state-driven
verification_methods: [test, inspection]
compliance: []
satisfied_by:
  adr: []
  conventions: []
implements_cross_cutting: [REQ-001, REQ-007]
type: doc
tags: [requirement, feature, data, tenant-export, deletion, retention]
module: infrastructure
feature: data_lifecycle
---

# REQ DATA-002 — Production tenant-data readiness requires export, deletion, and retention evidence

Status: **Active** (2026-07-15)

## Statement

**While** an environment is production-like, the platform **shall not** report
data-lifecycle readiness unless tenant export, tenant deletion, and retention
enforcement evidence is present and passing under a policy with a positive
retention period.

## Rationale

Tenant off-boarding is not complete merely because an account is disabled.
Operators need evidence that tenant-scoped data can be exported, deletion can
be demonstrated, and the configured retention policy is actively enforced.
Without one gate, each subsystem can claim success while the end-to-end data
obligation remains incomplete.

## Acceptance criteria

- **AC-1** Production and staging policies require tenant-export,
  tenant-deletion, and retention-enforcement checks and reject a non-positive
  retention period.
- **AC-2** A missing or failed required tenant-data check prevents readiness
  and reports the check as a failure.
- **AC-3** Passing evidence for all required tenant-data checks contributes to
  readiness only when every item is current, environment-matched, and bound to
  both an immutable reference and a valid SHA-256 artifact digest.
- **AC-4** Development's default policy does not pretend that production-only
  tenant-data evidence has been collected.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `infrastructure/platformkit-infra-pulumi/internal/contract/data_lifecycle_test.go::TestDefaultProductionDataLifecyclePolicyRequiresRecoveryEvidence` |
| AC-2 | Inspection | `infrastructure/platformkit-infra-pulumi/internal/contract/data_lifecycle.go::EvaluateDataLifecycleGate` evaluates every policy-required check and accumulates missing or failed evidence. |
| AC-3 | Test | `infrastructure/platformkit-infra-pulumi/internal/contract/data_lifecycle_test.go::TestDataLifecycleGateAcceptsCompleteVerifiableEvidence` |
| AC-4 | Test | `infrastructure/platformkit-infra-pulumi/internal/contract/data_lifecycle_test.go::TestDevelopmentDataLifecyclePolicyDoesNotPretendToBeProduction` |

## Implements (cross-cutting)

- **REQ-001** — export and deletion evidence are explicitly tenant-data
  controls rather than unscoped infrastructure assertions.
- **REQ-007** — tenant-data lifecycle work is named explicitly in evidence,
  making elevated cross-tenant operations auditable by the surrounding system.

## Satisfied by

- `infrastructure/platformkit-infra-pulumi/internal/contract/data_lifecycle.go::DefaultDataLifecyclePolicy`.
- `infrastructure/platformkit-infra-pulumi/internal/contract/data_lifecycle.go::EvaluateDataLifecycleGate`.

## Related requirements

- [REQ-DATA-001 — Recovery evidence gate](./REQ-DATA-001-recovery-evidence-gate.md)
- [REQ-DATA-004 — Executable tenant-data drill](./REQ-DATA-004-executable-tenant-data-drill.md)
