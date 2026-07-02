---
id: REQ-PORTS-024
title: "The canonical surface vocabulary lives in platformkit-ports/surface; presentation names remain compatible type aliases"
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
type: doc
tags: [requirement, governance, ports, surface]
---

# REQ PORTS-024 — Surface vocabulary authority

Status: **Proposed** (2026-07-02)

## Statement

The system **shall** keep the canonical surface-contribution
vocabulary — targets, page patterns, component levels, routes,
nav sections, widgets, settings, page contracts, the
`surface.Provider` port, and the structural validators
(`ValidateContribution`, `ValidateContributionsGlobal`,
`NamespacedRouteID`) — in `platformkit-ports/surface`, the
design-authority repo. The historical `presentation.*` names in
`platformkit-shared/presentation` **shall** be preserved as pure
type aliases (`type X = surface.Y`) and constant re-exports over
the canonical types, so every existing consumer keeps full type
identity across the rename; new code imports
`platformkit-ports/surface` directly.

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
exists to prevent. Moving the vocabulary to the ports repo makes
the design authority own it; keeping `presentation.*` as *aliases*
(not copies) means the migration is a rename, not a fork: a
`presentation.ModuleSurfaceContribution` **is** a
`surface.Contribution` at the type level, so no consumer breaks
and no conversion shims accumulate.

The provider behavioral contract (valid, stable, isolated) is what
lets shells cache and project contributions safely: a provider
whose result changes between calls, or leaks internal state to
caller mutation, would corrupt every registry built from it.

## Acceptance criteria

- **AC-1** The vocabulary types, the `surface.Provider` port with
  its authored contract, and the structural validators are defined
  in `platformkit-ports/surface`; no canonical definition remains
  in `platformkit-shared/presentation`.
- **AC-2** `presentation.*` surface names are Go type aliases
  (`=`) and constant re-exports of the `surface` package —
  full type identity, zero conversion code — and the two helper
  functions (`NamespacedRouteID`,
  `ValidateSurfaceContribution[sGlobal]`) delegate directly.
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
| AC-2 | Inspection | `core/platformkit-shared/presentation/surface_contract.go` — every declaration is a `type X = surface.Y` alias, a constant re-export, or a one-line delegation; the file compiles against the canonical types, so drift is a compile error. |
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
- `core/platformkit-shared/presentation/surface_contract.go` —
  the compatibility layer.

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
