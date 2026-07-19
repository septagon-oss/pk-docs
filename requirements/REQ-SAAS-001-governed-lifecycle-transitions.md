---
id: REQ-SAAS-001
title: "SaaS tenant lifecycle transitions are governed by one fail-closed policy"
status: Active
date: 2026-07-15
slug: req-saas-001-governed-lifecycle-transitions
category: tenancy
ears_pattern: ubiquitous
verification_methods: [test, inspection]
compliance: []
satisfied_by:
  adr: []
  conventions: []
implements_cross_cutting: [REQ-001, REQ-014]
type: doc
tags: [requirement, feature, saas, lifecycle, tenancy]
module: platform
feature: saas_lifecycle
---

# REQ SAAS-001 — SaaS tenant lifecycle transitions are governed by one fail-closed policy

Status: **Active** (2026-07-15)

## Statement

The platform **shall** govern every tenant's commercial lifecycle through one
canonical transition policy spanning provisioning, trial, active service,
payment failure, grace, suspension, archive, deletion, and the terminal
deleted state. Invalid, unknown, no-op, or incompletely composed transitions
**shall** fail before lifecycle side effects begin.

## Rationale

A SaaS tenant is projected into several independently owned modules. If API
handlers, provider webhooks, and background jobs each invent transitions,
those projections can disagree about whether a tenant should be billed,
entitled, or allowed access. A single policy makes the lifecycle decision
portable across every entry point.

Failing before execution is important because a missing step handler is not a
harmless omission. It can leave an apparently active tenant without
entitlements, or delete tenant records before an export is captured.

## Acceptance criteria

- **AC-1** The canonical state set includes `provisioning`, `trialing`,
  `active`, `past_due`, `grace`, `suspended`, `archived`, `deleting`, and
  terminal `deleted`.
- **AC-2** Unknown source states, disallowed edges, and same-state requests are
  rejected; a deleted tenant cannot return to an active state.
- **AC-3** Initial activation executes provisioning, plan assignment,
  entitlements, metering, billing reconciliation, and access enforcement in
  that order. A move to `deleting` executes export before deletion.
- **AC-4** The runner validates that every step selected by the transition has
  exactly one composed handler before it executes any handler.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Inspection | `modules/platformkit-business-modules/ports/saas_lifecycle.go::SaaSLifecycleState` defines the canonical state vocabulary. |
| AC-2 | Test | `modules/platformkit-business-modules/ports/saas_lifecycle_test.go::TestSaaSLifecycleTransitionPolicy` |
| AC-3 | Test | `modules/platformkit-business-modules/ports/saas_lifecycle_test.go::TestSaaSLifecycleTransitionPolicy` |
| AC-4 | Test | `modules/platformkit-business-modules/ports/saas_lifecycle_test.go::TestSaaSLifecycleRunnerRejectsMissingComposedStep` |

## Implements (cross-cutting)

- **REQ-001** — every lifecycle execution is identified by tenant and keeps
  tenant-owned effects within composed module handlers.
- **REQ-014** — transient provider failure is handled by the resumable
  execution contract refined in REQ-SAAS-003.

## Satisfied by

- `modules/platformkit-business-modules/ports/saas_lifecycle.go` — canonical
  states, transitions, ordered steps, and composition validation.
- `modules/platformkit-business-modules/tenant_management/features/tenant_lifecycle/saas_lifecycle_handlers.go` — tenant-owned step adapters.
- `modules/platformkit-business-modules/billing_management/features/subscriptions/saas_lifecycle_handlers.go` — billing-owned lifecycle projection.

## Related requirements

- [REQ-SAAS-002 — Commercial projections reconcile as ordered lifecycle steps](./REQ-SAAS-002-commercial-projection-reconciliation.md)
- [REQ-SAAS-003 — Lifecycle execution is durable, resumable, and single-owner](./REQ-SAAS-003-durable-resumable-execution.md)

## References

- `product/platformkit-docs/adr/0049-commercial-readiness-remediation-program.md`
