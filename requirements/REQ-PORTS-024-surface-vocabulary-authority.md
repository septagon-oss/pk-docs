---
id: REQ-PORTS-024
title: "The canonical surface vocabulary lives only in pk-ui/surface"
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
tags: [requirement, governance, oss, ui, surface]
module: platformkit_ui
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
`NamespacedRouteID`) — in the OSS
`github.com/septagon-oss/pk-ui/surface` package. The rich
`PageContract` — presenter, template, slots, Storybook reference,
and design artifacts — **shall** also have this one authority.
Consumers **shall** use that exact type. Duplicate structs, enum
copies, conversion functions, flattened projections, and validator
wrappers in `platformkit-ports`, `pk-shared/presentation`,
`platformkit-frontend-kit`, or `pk-modules/ports` are prohibited.
Exact type aliases for pervasive shell vocabulary are permitted
only when they introduce no second type or behavior.

Every `surface.Provider` implementation **shall** return a
contribution that is valid under `ValidateContribution`, stable
across repeated calls, and isolated from caller mutation
(mutating a returned value must not change what subsequent calls
return).

## Rationale

The surface vocabulary is the fleet-wide contract between every
business module and every rendering shell (admin chrome, app,
operator console). It is reusable outside the proprietary product,
so placing it in a private ports repository reverses the intended
dependency direction. Two homes would mean two drifting definitions
of both route contribution and page composition.

The OSS UI pillar is therefore the authority. PlatformKit extends it
with concrete shells, renderers, business contributions, and
application wiring. Forward-only direct use keeps that authority
visible, while removing adapters and flattened models prevents
compatibility paths from silently becoming permanent APIs.

The provider behavioral contract (valid, stable, isolated) is what
lets shells cache and project contributions safely: a provider
whose result changes between calls, or leaks internal state to
caller mutation, would corrupt every registry built from it.

## Acceptance criteria

- **AC-1** The vocabulary types, rich `PageContract`, the
  `surface.Provider` contract, cloning, and structural validators are
  defined only in `pk-ui/surface`.
- **AC-2** Canonical consumers use `pk-ui/surface` directly.
  Architecture tests reject OSS-to-private dependency reversal,
  frontend dependencies on private backend/business/ports layers,
  and reintroduced compatibility models.
- **AC-3** Every `surface.Provider` passes the conformance suite:
  its contribution validates, is stable across calls, and caller
  mutation of a returned contribution does not leak back into
  provider state.
- **AC-4** The structural validators reject malformed
  contributions — missing module id, duplicate/blank route ids,
  missing paths/titles/targets, unsupported targets, malformed
  widget and setting shapes, inconsistent route/page targets or
  patterns, incomplete page contracts, and global route-id
  collisions across modules.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Inspection | `overlays/septagon-oss-workspace/pk-ui/surface/contribution.go`, `provider.go`, and `admin.go`. |
| AC-2 | Test | `pk-ui/architecture_test.go`, `platformkit-frontend-kit/dependency_boundary_test.go`, and `pk-modules/ports/surface_vocabulary_retirement_test.go`. |
| AC-3 | Test | `pk-ui/surface/surfacetest/surfacetest_test.go::TestStaticPassesProviderConformance` — runs `surfacetest.ProviderConformance` (validity, call stability, mutation isolation) against the reference `Static` provider. |
| AC-4 | Test | `pk-ui/surface/page_contract_test.go` plus the surface and surfacetest validator suites. |

## Satisfied by

- [ADR 0009 — Ports-only cross-module communication](../adr/0009-ports-only-cross-module-communication.md) —
  the discipline that puts shared vocabulary in the ports layer
  rather than in any consumer.
- `pk-ui/REPO_CHARTER.md` — the OSS ownership and downstream
  extension rule.
- `pk-ui/surface/surfacetest/surfacetest.go::ProviderConformance` —
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

- `pk-ui/surface/surfacetest/surfacetest.go` —
  conformance suite + the reference `Static` provider (deep-copy
  semantics as the exemplar of mutation isolation).
