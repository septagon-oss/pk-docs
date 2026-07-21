---
id: REQ-002
title: "Modules are independently deployable"
status: Active
date: 2026-05-06
slug: req-002-independently-deployable-modules
category: governance
ears_pattern: ubiquitous
verification_methods:
  - analysis
  - test
satisfied_by:
  adr: [ADR-0009, ADR-0017]
  conventions: [C-04]
type: doc
tags: [requirement, governance, modularity]
---

# REQ 002 — Modules are independently deployable

Status: **Active** (2026-05-06)

## Statement

The system **shall** permit any business module to be added to or removed
from a running PlatformKit deployment without source-code changes to
any other module. Cross-module dependencies **shall** flow only through
declared ports in `contracts/provides/`.

## Rationale

The product strategy is "one platform, many supported sets" — different
deployments ship different module mixes (minimal, core, default,
coworking, vertical-specific bundles). If `module_a` imports
`module_b`'s implementation, then a deployment that wants `module_a`
but not `module_b` is impossible without forking. The compile-time
coupling defeats the runtime composition.

The same property is what lets the same codebase ship as a single
monolith binary, a microservices mesh, or a per-client overlay. Every
coupling that lives at the import level forecloses one of those
topologies.

This requirement's `pk-modules` paths and catalog
checks apply to the full PlatformKit distribution. The public
`github.com/septagon-oss/pk-modules/pkg` repository is a smaller reference pack
that composes its exported packages directly; it does not maintain a second
tier or module-set catalog.

## Acceptance criteria

- **AC-1** No package under `pk-modules/<module>/`
  imports a Go package owned by a different business module's
  implementation. The only allowed cross-module imports are into
  `<other-module>/contracts/provides/` (the public port surface) and
  `<other-module>/contracts/v1/` where it exists.
- **AC-2** Any catalog subset of the module set successfully builds:
  removing any single module from the catalog still produces a
  buildable binary, with the missing module's optional ports
  resolving to nil-safe fallbacks rather than nil-pointer panics at
  boot.
- **AC-3** The typed `AuthoredCatalog` and `AuthoredModuleSets` declare every
  full-distribution module's tier, preset memberships, and named-set
  memberships. A module that is referenced by a preset or set but absent from
  the authored catalog (or vice versa) fails the contract-check; serialized
  YAML is never an authored input.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Analysis | `pk-core/analysis/importboundary/importboundary.go` defines the analyzer that rejects cross-module implementation imports during module precommit verification. |
| AC-2 | Test | `pk-apps/modulecatalog/catalog_test.go::TestPlanModuleOnlyDoesNotReEnableDisabledModule` and `pk-apps/modulecatalog/catalog_test.go::TestPlanIgnoresDisabledUnknownModuleKeys` exercise selective composition and explicit module removal. **Verification gap: a dedicated sweep that removes each module in turn and verifies the plan still composes is pending.** |
| AC-3 | Analysis | `make check-module-contracts` (`pk-modules/cmd/module-contract-check`). |

## Satisfied by

- [ADR 0009 — ports-only cross-module communication](../adr/0009-ports-only-cross-module-communication.md) —
  the architectural decision that forbids cross-module implementation
  imports.
- [ADR 0017 — Fx is the composition model](../adr/0017-fx-dependency-injection-as-composition.md) —
  the runtime mechanism that resolves the module set at boot.
- [Convention C-04 — Public contracts live away from their implementation](../conventions.md#c-04-public-contracts-live-away-from-their-implementation) —
  the discipline that keeps `contracts/provides/` import-safe.

## Compliance traceability

(None — this is a product / architectural property, not a regulatory
one.)

## Related requirements

- [REQ-001 — Multi-tenant isolation](./REQ-001-multi-tenant-isolation.md) —
  the persistence-side defence that complements module-level
  isolation.

## References

- `pk-modules/catalog/modulecontracts/authored_catalog.go`
  — the typed registry that names tier and preset membership for every
  full-distribution module.
- `pk-modules/catalog/modulecontracts/authored_module_sets.go`
  — typed named-set definitions that exercise the "compose any subset"
  property.
- [ADR 0048 — the catalog is Go-authored; serialized formats are generated exports](../adr/0048-go-authored-catalog-and-generated-exports.md)
  — catalog authority and repository-scope distinction.
