---
id: REQ-SAAS-003
title: "SaaS lifecycle execution is durable, resumable, and single-owner"
status: Active
date: 2026-07-15
slug: req-saas-003-durable-resumable-execution
category: data-durability
ears_pattern: unwanted-behaviour
verification_methods: [test, inspection]
compliance: []
satisfied_by:
  adr: []
  conventions: []
implements_cross_cutting: [REQ-009, REQ-014]
type: doc
tags: [requirement, feature, saas, idempotency, checkpoint, recovery]
module: platform
feature: saas_lifecycle
---

# REQ SAAS-003 — SaaS lifecycle execution is durable, resumable, and single-owner

Status: **Active** (2026-07-15)

## Statement

**If** a SaaS lifecycle execution is retried, interrupted, or concurrently
requested, **then** the platform **shall** use a durable checkpoint and the
request's idempotency identity to resume only incomplete steps, reject unsafe
key reuse, and prevent two workers from owning the same execution at once.

## Rationale

Lifecycle operations cross provider and module boundaries, so process
failure is expected rather than exceptional. Replaying already completed
billing, provisioning, export, or deletion effects can be expensive or
irreversible. A durable checkpoint turns retry into continuation.

The idempotency key alone is insufficient: it must be bound to immutable
request content, and distributed workers need an atomic lease so the same key
cannot execute concurrently.

## Acceptance criteria

- **AC-1** The execution store persists status, current and completed steps,
  request fingerprint, export manifest, lease state, timestamps, and the last
  error under tenant ID plus idempotency key.
- **AC-2** After a step failure, retrying the same request resumes with the
  first incomplete step; retrying a completed execution performs no further
  side effects.
- **AC-3** Reusing an idempotency key with a different immutable request
  fingerprint is rejected.
- **AC-4** A durable claimer atomically acquires and renews an execution lease;
  a competing worker receives `ErrSaaSLifecycleAlreadyRunning`.
- **AC-5** A generated tenant export manifest is persisted and reused across
  retries instead of invoking export contributors again.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `modules/platformkit-business-modules/tenant_management/features/tenant_lifecycle/saas_lifecycle_execution_repository_test.go::TestSaaSLifecycleExecutionStoreRoundTripsCheckpoint` |
| AC-2 | Test | `modules/platformkit-business-modules/ports/saas_lifecycle_test.go::TestSaaSLifecycleRunnerResumesAfterProviderFailure` |
| AC-3 | Test | `modules/platformkit-business-modules/ports/saas_lifecycle_test.go::TestSaaSLifecycleRunnerRejectsIdempotencyKeyReuse` |
| AC-4 | Test | `modules/platformkit-business-modules/ports/saas_lifecycle_test.go::TestSaaSLifecycleRunnerRejectsConcurrentExecution` |
| AC-5 | Test | `modules/platformkit-business-modules/tenant_management/features/tenant_lifecycle/saas_lifecycle_execution_repository_test.go::TestSaaSLifecycleExportHandlerPersistsAndReusesManifest` |

## Implements (cross-cutting)

- **REQ-009** — durable status, timestamps, current step, and last error make
  an execution diagnosable after the worker exits.
- **REQ-014** — transient provider and process failures resume from a stable
  checkpoint rather than corrupting the lifecycle.

## Satisfied by

- `modules/platformkit-business-modules/ports/saas_lifecycle.go::SaaSLifecycleRunner` — checkpointed orchestration and lease protocol.
- `modules/platformkit-business-modules/tenant_management/features/tenant_lifecycle/saas_lifecycle_execution_repository.go` — durable GORM execution store.
- `modules/platformkit-business-modules/tenant_management/features/tenant_lifecycle/saas_lifecycle_handlers.go` — export-manifest persistence and reuse.

## Related requirements

- [REQ-SAAS-001 — Governed lifecycle transitions](./REQ-SAAS-001-governed-lifecycle-transitions.md)
- [REQ-SAAS-002 — Commercial projection reconciliation](./REQ-SAAS-002-commercial-projection-reconciliation.md)

## References

- `product/platformkit-docs/adr/0049-commercial-readiness-remediation-program.md`
