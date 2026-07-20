---
id: REQ-AUTH-005
title: "Policy changes activate only after an immutable provider release is observed and verified"
status: Proposed
date: 2026-07-20
slug: req-auth-005-policy
category: auth
ears_pattern: event-driven
priority: must
risk: critical
verification_methods: [test, inspection]
compliance: [SOC2_CC6.1, ISO27001_A.9.4]
satisfied_by:
  adr: [ADR-0009, ADR-0061]
  conventions: [C-04, C-14, C-21]
implements_cross_cutting: [REQ-001, REQ-004, REQ-005, REQ-007]
type: doc
tags: [requirement, feature, auth_management, policy, topaz, release]
module: auth_management
feature: policy
---

# REQ AUTH-005 — Governed policy control plane

Status: **Proposed** (2026-07-20)

## Statement

The policy feature **shall** own a tenant- and environment-scoped change
workflow and immutable version history. A promotion or rollback **shall**
compile the exact approved snapshot for the configured provider target,
persist a durable desired release, publish an immutable artifact, activate it,
inspect the live runtime, verify exact projection and bundle identities, and
only then commit the policy version active. Any missing component, ambiguous
scope, stale transition, publication failure, activation mismatch, or
incomplete runtime attestation **shall** keep authorization fail closed.

## Rationale

“Saved,” “published,” and “serving decisions” are different states. Treating
them as synonyms lets mutable tags, partial rollouts, or stale provider data
masquerade as active policy. A durable desired-versus-observed controller makes
the transition resumable and proves which immutable bundle every decision
replica loaded.

## Acceptance criteria

- **AC-1 — Governed writes only.** Generic CRUD writes and default seeders
  cannot mutate policy rows; changes pass through draft, submit, approve,
  rollout, and promotion/rollback transitions.
- **AC-2 — Exact scope.** Policy snapshots, transition bindings, and releases
  carry one canonical tenant and environment. Mixed, missing, or foreign scope
  is rejected before external side effects.
- **AC-3 — Deterministic projection.** The provider compiler produces the same
  canonical projection identity for the same immutable snapshot and rejects
  duplicate IDs, wildcard usersets, unresolved usersets, and cross-tenant
  policies.
- **AC-4 — Published is not active.** Release state records publication,
  activation inspection, verification, and commit separately; active status
  requires exact observed projection digest, bundle digest, policy path,
  directory model identity, and replica attestation.
- **AC-5 — Resumable reconciliation.** Startup and periodic reconciliation
  resume durable pending work, repair active drift, and cannot let a stale
  worker overwrite a newer generation.
- **AC-6 — One runtime gate.** Topaz allows are returned only while the loaded
  release matches fresh durable activation evidence. Evidence loss or change
  closes the gate before and after the provider decision.
- **AC-7 — Auditable transitions.** Approved lifecycle transitions and final
  activation publish typed outbox events bound to their exact request,
  rollout, version, tenant, and environment.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `modules/platformkit-business-modules/auth_management/features/policy/repository_guard_test.go::TestGovernedPolicyStoreBlocksEveryDirectWrite` and `feature_exposure_test.go::TestGovernedPolicyEntitiesExposeNoGenericWriteSurface`. |
| AC-2 | Test | `modules/platformkit-business-modules/auth_management/features/policy/policy_scope_test.go::TestValidatePolicyForTenantRequiresExplicitNamespaceAndTenant`, `projection_source_test.go`, and `service_release_commit_test.go::TestPolicyReleaseTransitionValidatorLocksAndChecksExactPendingRows`. |
| AC-3 | Test | `core/platformkit-integrations/topaz/policy_compiler_test.go::TestPolicyCompilerIsDeterministic` plus its cross-tenant, duplicate, userset, and canonical-envelope rejection cases. |
| AC-4 | Test | `modules/platformkit-business-modules/auth_management/features/policy/release_store_test.go::TestPolicyReleaseStoreSeparatesPublishedFromInspectedActive` and `core/platformkit-ports/authz/policy_release_test.go::TestPolicyActivationMatchesDesiredRelease`. |
| AC-5 | Test | `core/platformkit-integrations/platformkit/authz/register_test.go::TestStartupReconcileResumesPublishedReleaseWithoutRepublishing`, `TestPeriodicReconcileRepairsDriftFromActiveRelease`, and release-store CAS tests. |
| AC-6 | Test | `core/platformkit-integrations/topaz/policy_decision_gate_test.go::TestEngineRejectsPreexistingAllowUntilExactFreshActivation` and `TestEngineRejectsAllowWhenAttestedReleaseChangesDuringDecision`. |
| AC-7 | Test | `modules/platformkit-business-modules/auth_management/features/policy/release_store_test.go::TestPolicyReleaseStoreRollsBackActiveTransitionWhenOutboxEnqueueFails` and reconciler activation-event tests. |

## Implements (cross-cutting)

- REQ-001 — exact tenant/environment fencing.
- REQ-004 — durable, typed lifecycle evidence.
- REQ-005 — every unknown or stale state denies.
- REQ-007 — foreign-target events are ignored before snapshot reads or writes.

## Satisfied by

- `modules/platformkit-business-modules/auth_management/features/policy`
- `core/platformkit-ports/authz`
- `core/platformkit-integrations/topaz`
- `core/platformkit-integrations/platformkit/authz`

## Related requirements

- [REQ-AUTH-004 — Authorization catalog](./REQ-AUTH-004-permissions.md)
- [REQ-AUTH-040 — Governed permission decision](./REQ-AUTH-040-permission-check.md)
- [REQ-PORTS-014 — Authorization contract](./REQ-PORTS-014-authorization-contract.md)
