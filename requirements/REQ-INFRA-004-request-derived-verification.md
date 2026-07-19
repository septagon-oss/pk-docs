---
id: REQ-INFRA-004
title: "Deployments are verified against checks derived from the exact request"
status: Active
date: 2026-07-15
slug: req-infra-004-request-derived-verification
category: availability
ears_pattern: event-driven
verification_methods: [test, inspection]
compliance: []
satisfied_by:
  adr: []
  conventions: []
implements_cross_cutting: [REQ-009, REQ-014, REQ-015]
type: doc
tags: [requirement, feature, infrastructure, deployment, verification, rollback]
module: infrastructure
feature: deployment_verification
---

# REQ INFRA-004 — Deployments are verified against checks derived from the exact request

Status: **Active** (2026-07-15)

## Statement

**When** provider changes have been applied, the deployment lifecycle **shall**
derive readiness checks from the same normalized deployment request, retry
them within a bounded policy, and require rollback when a mandatory check
fails in a protected environment.

## Rationale

An apply command confirms provider reconciliation, not application readiness.
A separately configured health check can also drift away from the routes and
domain actually deployed. Deriving the plan from the request binds the
verification target to the candidate whose success is being decided.

Protected environments need a stronger failure posture: a failed mandatory
probe cannot become a warning, and a missing rollback executor cannot be
treated as successful cleanup.

## Acceptance criteria

- **AC-1** Application deployments derive health, live, and smoke URLs from
  the request's domain and application paths; public sites derive entry and
  not-found checks; infrastructure-only blueprints require provider-state
  verification rather than an empty plan.
- **AC-2** Required checks are executed serially and retried up to the plan's
  positive `MaxAttempts`; readiness is true only when no required check
  remains failed.
- **AC-3** HTTP probes reject redirects and accept only 2xx responses.
- **AC-4** Failed required verification in production or staging marks
  rollback mandatory. Enforcing that decision without a rollback executor,
  or with a failed rollback, returns an error.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `infrastructure/platformkit-infra-pulumi/internal/contract/deployment_verification_test.go::TestBuildDeploymentVerificationPlanUsesRequestHealthContract` and `infrastructure/platformkit-infra-pulumi/internal/contract/deployment_verification_test.go::TestBuildDeploymentVerificationPlanUsesProviderStateForInfrastructureOnlyBlueprint` |
| AC-2 | Test | `infrastructure/platformkit-infra-pulumi/internal/contract/deployment_verification_test.go::TestRunDeploymentVerificationRetriesAndRequiresRollback` |
| AC-3 | Test | `infrastructure/platformkit-infra-pulumi/internal/deployexec/http_probe_test.go::TestHTTPProbeRejectsRedirects` and `infrastructure/platformkit-infra-pulumi/internal/deployexec/http_probe_test.go::TestHTTPProbeAcceptsOnlyTwoHundredResponses` |
| AC-4 | Test | `infrastructure/platformkit-infra-pulumi/internal/contract/deployment_verification_test.go::TestRunDeploymentVerificationRetriesAndRequiresRollback` |

## Implements (cross-cutting)

- **REQ-009** — every check records name, result, status code, message, and
  attempt count in the decision.
- **REQ-014** — transient failures receive bounded retries; persistent failures
  become rollback rather than false readiness.
- **REQ-015** — request-to-plan and plan-to-decision behavior are deterministic
  provider-neutral contracts.

## Satisfied by

- `infrastructure/platformkit-infra-pulumi/internal/contract/deployment_verification.go`.
- `infrastructure/platformkit-infra-pulumi/internal/deployexec/http_probe.go`.

## Related requirements

- [REQ-INFRA-005 — Reproducible deployment identity](./REQ-INFRA-005-deployment-artifact-identity.md)
- [REQ-INFRA-006 — Closed-loop deployment](./REQ-INFRA-006-closed-loop-deployment.md)
- [REQ-INFRA-007 — Verified baseline rollback](./REQ-INFRA-007-verified-baseline-rollback.md)
