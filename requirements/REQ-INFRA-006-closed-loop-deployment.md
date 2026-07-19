---
id: REQ-INFRA-006
title: "Provision and upgrade execute as one serialized closed-loop lifecycle"
status: Active
date: 2026-07-15
slug: req-infra-006-closed-loop-deployment
category: availability
ears_pattern: event-driven
verification_methods: [test, inspection]
compliance: []
satisfied_by:
  adr: []
  conventions: []
implements_cross_cutting: [REQ-009, REQ-014]
type: doc
tags: [requirement, feature, infrastructure, provision, upgrade, orchestration]
module: infrastructure
feature: deployment_lifecycle
---

# REQ INFRA-006 — Provision and upgrade execute as one serialized closed-loop lifecycle

Status: **Active** (2026-07-15)

## Statement

**When** a stack is provisioned or upgraded, the platform **shall** hold one
stack-scoped lifecycle lock across discovery, apply, verification, promotion,
and any rollback. It shall report success only after apply and mandatory
verification complete and the verified baseline is promoted.

## Rationale

Independent "apply", "smoke test", and "record success" commands create
windows where concurrent operators can race or an unverified candidate can be
mistaken for the last known good deployment. A single control loop makes the
ordering and failure semantics executable.

Provision and upgrade have different cleanup needs, but neither may silently
skip a mandatory stage. The lifecycle result preserves applied, verified,
promoted, and rollback-attempted state so operators can see where it stopped.

## Acceptance criteria

- **AC-1** Provision and upgrade validate the request and require an executor;
  unsupported operations fail before apply.
- **AC-2** A successful lifecycle orders provider apply, request-derived
  verification, and verified-baseline promotion; `Promoted` is false until
  every required check is ready.
- **AC-3** Apply, verification, or promotion failure returns an error and
  invokes required cleanup or rollback. A failed provision is cleanup-required
  even in development.
- **AC-4** The concrete executor serializes the complete lifecycle per stack;
  another stack may proceed independently.
- **AC-5** A failed first provision destroys only a stack initialized and owned
  by that lifecycle attempt; a discovery/init race never destroys a foreign
  stack.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `infrastructure/platformkit-infra-pulumi/internal/contract/deployment_lifecycle_test.go::TestRunDeploymentLifecycleRequiresRollbackExecutorForProductionApplyFailure` |
| AC-2 | Test | `infrastructure/platformkit-infra-pulumi/internal/contract/deployment_lifecycle_test.go::TestRunDeploymentLifecycleProvisionVerifiesBeforeSuccess` |
| AC-3 | Test | `infrastructure/platformkit-infra-pulumi/internal/contract/deployment_lifecycle_test.go::TestRunDeploymentLifecycleCleansFailedDevelopmentProvision` |
| AC-4 | Test | `infrastructure/platformkit-infra-pulumi/internal/deployexec/lock_test.go::TestLifecycleLockSerializesSameStack` |
| AC-5 | Test | `infrastructure/platformkit-infra-pulumi/internal/deployexec/pulumi_test.go::TestRunFailedProvisionDestroysOnlyOwnedStack` and `infrastructure/platformkit-infra-pulumi/internal/deployexec/pulumi_test.go::TestRunStackInitRaceNeverDestroysForeignStack` |

## Implements (cross-cutting)

- **REQ-009** — the lifecycle result distinguishes operation, applied,
  promoted, verification, and rollback-attempted states.
- **REQ-014** — persistent apply or verification failure follows an explicit
  cleanup/rollback path and is never converted to success.

## Satisfied by

- `infrastructure/platformkit-infra-pulumi/internal/contract/deployment_lifecycle.go`.
- `infrastructure/platformkit-infra-pulumi/internal/deployexec/pulumi.go::Run`.
- `infrastructure/platformkit-infra-pulumi/internal/deployexec/lock.go`.

## Related requirements

- [REQ-INFRA-004 — Request-derived verification](./REQ-INFRA-004-request-derived-verification.md)
- [REQ-INFRA-005 — Deployment artifact identity](./REQ-INFRA-005-deployment-artifact-identity.md)
- [REQ-INFRA-007 — Verified baseline rollback](./REQ-INFRA-007-verified-baseline-rollback.md)
