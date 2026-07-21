---
id: REQ-SAAS-002
title: "Commercial projections reconcile as ordered SaaS lifecycle steps"
status: Active
date: 2026-07-15
slug: req-saas-002-commercial-projection-reconciliation
category: data-durability
ears_pattern: event-driven
verification_methods: [test, inspection]
compliance: []
satisfied_by:
  adr: []
  conventions: []
implements_cross_cutting: [REQ-001, REQ-016]
type: doc
tags: [requirement, feature, saas, billing, entitlements, access]
module: platform
feature: saas_lifecycle
---

# REQ SAAS-002 — Commercial projections reconcile as ordered SaaS lifecycle steps

Status: **Active** (2026-07-15)

## Statement

**When** a SaaS lifecycle transition is accepted, the platform **shall**
reconcile every required commercial projection through ordered,
module-owned handlers. Ordinary state changes shall reconcile billing,
entitlements, and access; initial activation shall additionally provision the
tenant, assign its plan, and initialize metering.

## Rationale

Tenant state is not a substitute for the billing, entitlement, metering, and
access records maintained by their owning modules. Those records must move as
one governed operation while preserving module boundaries. Otherwise a
payment recovery could update billing without restoring access, or a
suspension could block access while metering continues incorrectly.

The ordered step contract exposes the coordination policy without granting
one business module direct access to another module's repositories.

## Acceptance criteria

- **AC-1** Initial activation orders `provisioning`, `plan_assignment`,
  `entitlements`, `metering`, `billing_reconciliation`, then
  `access_enforcement`.
- **AC-2** A non-initial, non-deletion transition orders billing
  reconciliation before entitlement and access enforcement.
- **AC-3** Billing's subscription projection recognizes only lifecycle states
  consistent with the stored subscription status; mismatches remain work for
  the reconciliation handler rather than being treated as complete.
- **AC-4** Each side effect is reached through a composed step handler owned
  by the responsible module, not through cross-module repository access.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `pk-modules/ports/saas_lifecycle_test.go::TestSaaSLifecycleTransitionPolicy` |
| AC-2 | Inspection | `pk-modules/ports/saas_lifecycle.go::SaaSLifecycleStepsForTransition` |
| AC-3 | Test | `pk-modules/billing/features/subscriptions/saas_lifecycle_handlers_test.go::TestSubscriptionMatchesLifecycleState` |
| AC-4 | Inspection | `pk-modules/ports/saas_lifecycle.go::SaaSLifecycleStepHandler` and the lifecycle handlers in `tenant_management` and `billing`. |

## Implements (cross-cutting)

- **REQ-001** — the request and every projection operation remain scoped to
  one tenant identifier.
- **REQ-016** — module-owned handlers are supplied through composition rather
  than constructed across module boundaries.

## Satisfied by

- `pk-modules/ports/saas_lifecycle.go::SaaSLifecycleStepsForTransition`.
- `pk-modules/billing/features/subscriptions/saas_lifecycle_handlers.go`.
- `pk-modules/tenant_management/features/tenant_lifecycle/saas_lifecycle_handlers.go`.

## Related requirements

- [REQ-SAAS-001 — Governed lifecycle transitions](./REQ-SAAS-001-governed-lifecycle-transitions.md)
- [REQ-SAAS-003 — Durable lifecycle execution](./REQ-SAAS-003-durable-resumable-execution.md)
