---
id: REQ-PORTS-024
title: "The canonical surface vocabulary lives only in platformkit-ports/surface"
status: Proposed
date: 2026-07-02
slug: req-ports-024-surface-vocabulary-authority
category: governance
ears_pattern: ubiquitous
verification_methods:
  - test
  - inspection
compliance: []
satisfied_by:
  adr: [ADR-0009]
  conventions: [C-14]
implements_cross_cutting: [REQ-002]
refines: REQ-PORTS-001
type: doc
tags: [requirement, governance, ports, surface]
module: platformkit_ports
feature: contract
capability: surface_vocabulary_authority
capability_kind: inter_module_contract
---

# REQ PORTS-024 — Surface vocabulary authority

Status: **Proposed** (2026-07-02)

## Statement

The system **shall** keep the surface-contribution
vocabulary — targets, page patterns, component levels, routes,
nav sections, widgets, settings, page contracts, the
`surface.Provider` port, and the structural validators
(`ValidateContribution`, `ValidateContributionsGlobal`,
`NamespacedRouteID`) — in `platformkit-ports/surface`, the
design-authority repo. Consumers **shall** import that package
directly. Compatibility aliases, constant re-exports, validator
wrappers, and duplicate vocabulary in
`platformkit-shared/presentation` or
`platformkit-business-modules/ports` are prohibited.

Every `surface.Provider` implementation **shall** return a
contribution that is valid under `ValidateContribution`, stable
across repeated calls, and isolated from caller mutation
(mutating a returned value must not change what subsequent calls
return).

## Rationale

The surface vocabulary is the fleet-wide contract between every
business module and every rendering shell (admin chrome, app,
operator console). Two homes for it would mean two drifting
definitions of "what is a route contribution" — the exact
second-source-of-truth failure the platformkit-ports charter
exists to prevent. The ports repo is the design authority, and
forward-only direct imports keep that authority visible in every
consumer. Removing aliases and wrappers also prevents compatibility
paths from silently becoming permanent public APIs.

The provider behavioral contract (valid, stable, isolated) is what
lets shells cache and project contributions safely: a provider
whose result changes between calls, or leaks internal state to
caller mutation, would corrupt every registry built from it.

## Acceptance criteria

- **AC-1** The vocabulary types, the `surface.Provider` port with
  its authored contract, and the structural validators are defined
  only in `platformkit-ports/surface`.
- **AC-2** Canonical consumers import `platformkit-ports/surface`
  directly. AST retirement tests reject reintroduced declarations
  and uses of the removed shared-presentation and business-ports
  compatibility names.
- **AC-3** Every `surface.Provider` passes the conformance suite:
  its contribution validates, is stable across calls, and caller
  mutation of a returned contribution does not leak back into
  provider state.
- **AC-4** The structural validators reject malformed
  contributions — missing module id, duplicate/blank route ids,
  missing paths/titles/targets, unsupported targets, malformed
  widget and setting shapes, and global route-id collisions
  across modules.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Inspection | `core/platformkit-ports/surface/surface.go` (vocabulary + validators) and `core/platformkit-ports/surface/provider.go` (`Provider` + `ProviderContract`). |
| AC-2 | Test | `core/platformkit-shared/presentation/surface_alias_retirement_test.go` and `modules/platformkit-business-modules/ports/surface_vocabulary_retirement_test.go` scan declarations and import-qualified selectors so compatibility paths cannot return. |
| AC-3 | Test | `core/platformkit-ports/surface/surfacetest/surfacetest_test.go::TestStaticPassesProviderConformance` — runs `surfacetest.ProviderConformance` (validity, call stability, mutation isolation) against the reference `Static` provider. |
| AC-4 | Test | `core/platformkit-ports/surface/surfacetest/surfacetest_test.go::TestValidateContributionCatchesWidgetAndSettingShape` — validator rejection coverage for malformed shapes. |

## Satisfied by

- [ADR 0009 — Ports-only cross-module communication](../adr/0009-ports-only-cross-module-communication.md) —
  the discipline that puts shared vocabulary in the ports layer
  rather than in any consumer.
- `core/platformkit-ports/docs/ADR-0001-ports-charter.md` — the
  platformkit-ports charter (external ADR namespace; distinct
  from this registry's ADR-0001) that names the ports repo the
  design authority for cross-cutting seams.
- `core/platformkit-ports/surface/surfacetest/surfacetest.go::ProviderConformance` —
  the reusable behavioral suite every provider is held to.
- `core/platformkit-shared/presentation/surface_alias_retirement_test.go` —
  the forward-only retirement guard for the former presentation path.
- `modules/platformkit-business-modules/ports/surface_vocabulary_retirement_test.go` —
  the forward-only retirement guard for the former business-ports re-exports.

## Related requirements

- [REQ-002 — Independently deployable modules](./REQ-002-independently-deployable-modules.md) —
  modules describe surfaces as pure data; shells render them,
  keeping both sides independently deployable.
- [REQ-011 — Design tokens are the source of truth](./REQ-011-design-tokens-source-of-truth.md) —
  the sibling single-source-of-truth discipline on the styling
  axis.
- [REQ-PORTS-025 — Manifest surface hygiene](./REQ-PORTS-025-manifest-surface-hygiene.md) —
  the ratchet that keeps manifest projections honest as surfaces
  migrate.

## References

- `core/platformkit-ports/surface/surfacetest/surfacetest.go` —
  conformance suite + the reference `Static` provider (deep-copy
  semantics as the exemplar of mutation isolation).
