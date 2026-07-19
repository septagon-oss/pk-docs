---
id: REQ-DATA-001
title: "Production recovery readiness requires complete passing evidence"
status: Active
date: 2026-07-15
slug: req-data-001-recovery-evidence-gate
category: availability
ears_pattern: state-driven
verification_methods: [test, inspection]
compliance: []
satisfied_by:
  adr: []
  conventions: []
implements_cross_cutting: [REQ-014, REQ-015]
type: doc
tags: [requirement, feature, data, backup, restore, disaster-recovery]
module: infrastructure
feature: data_lifecycle
---

# REQ DATA-001 — Production recovery readiness requires complete passing evidence

Status: **Active** (2026-07-15)

## Statement

**While** an environment is production-like, the platform **shall not** report
data-lifecycle readiness unless its recovery policy is valid and evidence for
encrypted backup, restore, and disaster recovery is present and passing.

## Rationale

A configured backup is not evidence that data can be recovered. Operators
need one decision that distinguishes declared intent from demonstrated backup,
restore, and disaster-recovery capability before a production or staging
release is considered ready.

The gate is provider-neutral so evidence may come from database snapshots,
object storage, or a failover runner without changing the policy contract.

## Acceptance criteria

- **AC-1** A production-like default policy requires backup, restore, and
  disaster-recovery checks and declares positive recovery-point and
  recovery-time objectives with `RTO >= RPO`.
- **AC-2** Missing or failed required recovery evidence makes the readiness
  decision fail closed and identifies each failed check.
- **AC-3** Complete passing recovery evidence contributes to a ready decision
  only when every item is current, environment-matched, and bound to both an
  immutable reference and a valid SHA-256 artifact digest.
- **AC-4** Development does not claim production assurance: its default policy
  has no production-only recovery evidence requirement.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `infrastructure/platformkit-infra-pulumi/internal/contract/data_lifecycle_test.go::TestDefaultProductionDataLifecyclePolicyRequiresRecoveryEvidence` |
| AC-2 | Test | `infrastructure/platformkit-infra-pulumi/internal/contract/data_lifecycle_test.go::TestDefaultProductionDataLifecyclePolicyRequiresRecoveryEvidence` |
| AC-3 | Test | `infrastructure/platformkit-infra-pulumi/internal/contract/data_lifecycle_test.go::TestDataLifecycleGateAcceptsCompleteVerifiableEvidence` |
| AC-4 | Test | `infrastructure/platformkit-infra-pulumi/internal/contract/data_lifecycle_test.go::TestDevelopmentDataLifecyclePolicyDoesNotPretendToBeProduction` |

## Implements (cross-cutting)

- **REQ-014** — recovery failure becomes a release-gate failure rather than a
  silent degraded state.
- **REQ-015** — the provider-neutral policy and decision are deterministic and
  executable in shared tests.

## Satisfied by

- `infrastructure/platformkit-infra-pulumi/internal/contract/data_lifecycle.go::DataLifecyclePolicy`.
- `infrastructure/platformkit-infra-pulumi/internal/contract/data_lifecycle.go::EvaluateDataLifecycleGate`.

## Related requirements

- [REQ-DATA-002 — Tenant data governance readiness](./REQ-DATA-002-tenant-data-governance-gate.md)
- [REQ-DATA-003 — Executable recovery drill](./REQ-DATA-003-executable-recovery-drill.md)

## References

- `product/platformkit-docs/adr/0049-commercial-readiness-remediation-program.md`
