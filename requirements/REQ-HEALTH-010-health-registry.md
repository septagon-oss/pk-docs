---
id: REQ-HEALTH-010
title: "Health registry registers per-module providers, rejects invalid module ids, and aggregates checks across the platform"
status: Proposed
date: 2026-05-08
slug: req-health-010-health-registry
category: health
ears_pattern: ubiquitous
priority: must
risk: medium
verification_methods: [test]
compliance:
  - SOC2_CC7.2
  - ISO27001_A.16.1
satisfied_by:
  adr: [ADR-0009]
  conventions: [C-04, C-14]
implements_cross_cutting: [REQ-009]
refines: REQ-HEALTH-001
type: doc
tags: [requirement, capability, health_management, health_monitoring, registry]
module: health_management
feature: health_monitoring
capability: health_registry
capability_kind: data_invariant
stakeholders:
  - operator (monitors platform health)
  - module developer (registers provider)
  - SRE (consumes aggregated status)
---

# REQ HEALTH-010 — Health registry

Status: **Proposed** (2026-05-08)

## Statement

The health-monitoring feature **shall** expose a
`HealthRegistry` that:

1. **Starts empty** — a fresh registry has zero
   providers;
2. **`RegisterProvider(moduleID, provider)`** —
   accept a provider with a non-empty module id;
   refuse the registration with a typed error
   when the module id is empty / invalid;
3. **`UnregisterProvider(moduleID)`** — remove
   the named provider; return the typed error
   when the module is not registered;
4. **`GetProvider(moduleID)`** — fetch the
   registered provider for a module;
5. **`GetAllHealthChecks()`** — aggregate every
   provider's health-check definitions across
   modules.

The registry **shall** be the single source of
truth for module-health discovery; provider
registration happens at module-init time via the
`ports.HealthRegistrar` contract.

## Rationale

Health registries are the platform's
self-monitoring surface. Three properties:

1. **Empty-on-construction.** A registry that
   pre-populates would mask wiring errors. The
   empty start makes "did this module
   register?" testable directly.
2. **Module-id validation.** An empty module id
   is a wiring bug — it would silently allow
   the provider to register under no name and
   never be queryable. Validating fast surfaces
   the bug at startup.
3. **Aggregation as the platform-wide
   read.** The aggregate-checks view is what
   the operator dashboard renders; without it,
   each module would have to be queried
   individually.

## Acceptance criteria

- **AC-1 — Empty on construction.**
  `NewHealthRegistry()` returns a registry
  with zero providers.
- **AC-2 — Register and get.** A
  `RegisterProvider(moduleID, p)` followed by
  `GetProvider(moduleID)` returns the same
  provider.
- **AC-3 — Reject invalid module id.** A
  `RegisterProvider("", p)` returns the
  typed invalid-module-id error; the
  provider is not registered.
- **AC-4 — Unregister.** A
  `UnregisterProvider(moduleID)` removes the
  registration; subsequent `GetProvider`
  returns the not-registered error.
- **AC-5 — Unregister unknown.** A
  `UnregisterProvider("not-registered")`
  returns the typed unknown-module error.
- **AC-6 — Aggregate checks across modules.**
  `GetAllHealthChecks()` returns the union of
  every registered provider's checks.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `modules/platformkit-business-modules/health_management/registry_test.go::TestNewHealthRegistryStartsEmpty`. |
| AC-2 | Test | `modules/platformkit-business-modules/health_management/registry_test.go::TestRegisterAndGetProvider`. |
| AC-3 | Test | `modules/platformkit-business-modules/health_management/registry_test.go::TestRegisterProviderRejectsInvalidModuleID`. |
| AC-4 | Test | `modules/platformkit-business-modules/health_management/registry_test.go::TestUnregisterProvider`. |
| AC-5 | Test | `modules/platformkit-business-modules/health_management/registry_test.go::TestUnregisterProviderReturnsErrorForUnknownModule`. |
| AC-6 | Test | `modules/platformkit-business-modules/health_management/registry_test.go::TestGetAllHealthChecksAggregatesAcrossModules`. |

## Edge cases & unhappy paths

- **Concurrent register / unregister.**
  Internal locking handles concurrent access;
  the read paths see a consistent snapshot.
- **Provider that errors at init.** The
  registration succeeds; check execution
  surfaces the error (REQ-HEALTH-011).
- **Duplicate register.** The second
  registration overwrites the first;
  documented as last-writer-wins.
- **Module-id case sensitivity.** Stored
  verbatim; lookups are case-sensitive.
- **Provider with no checks.** Allowed; the
  aggregate result includes a zero-check
  entry for the module.

## Risk

- **Likelihood:** Low — exercised at startup
  and on operator dashboards.
- **Impact:** Medium — defective registry
  hides modules from the operator view.
- **Mitigations:** Module-id validation
  (AC-3), unregister-unknown error (AC-5),
  empty-start invariant (AC-1).

## Implements (cross-cutting)

- **REQ-009 — Observability.** The registry
  is the discovery surface for
  health-check observability.

## Compliance mapping

| Control | Coverage |
|---|---|
| SOC2 CC7.2 (System monitoring) | AC-6 — platform-wide health visibility. |
| ISO27001 A.16.1 (Management of incidents) | AC-6 — operator-facing health surface. |

## Satisfied by

- `modules/platformkit-business-modules/health_management/registry.go::HealthRegistry, RegisterProvider, UnregisterProvider, GetProvider, GetAllHealthChecks`.

## Related requirements

- [REQ-HEALTH-001 — Health monitoring umbrella](./REQ-HEALTH-001-health-monitoring.md)
- [REQ-HEALTH-011 — Aggregated health check](./REQ-HEALTH-011-aggregated-check.md)
- [REQ-HEALTH-012 — Alert derivation](./REQ-HEALTH-012-alert-derivation.md)
