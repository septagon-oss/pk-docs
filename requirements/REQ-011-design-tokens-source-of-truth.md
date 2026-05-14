---
id: REQ-011
title: "Design tokens are the single source of truth for visual semantics"
status: Active
date: 2026-05-06
slug: req-011-design-tokens-source-of-truth
category: governance # UX consistency and visual-semantic discipline
ears_pattern: unwanted-behaviour
verification_methods:
  - analysis
  - inspection
compliance: []
satisfied_by:
  adr: [ADR-0003, ADR-0004, ADR-0022]
  conventions: [C-07]
type: doc
tags: [requirement, governance, design-system, ux, theming]
---

# REQ 011 — Design tokens are the single source of truth for visual semantics

Status: **Active** (2026-05-06)

## Statement

**If** a UI component requires a color, spacing, typography, radius,
shadow, or motion value, **then** it **shall** reference a registered
design token from `platformkit-design-system/tokens/` or
`platformkit-shared/tokens/` and **shall not** use a literal hex code,
raw `px`/`rem`, `rgb(...)`, or named CSS color in component rendering
code. Tenant-overlay branding **shall** flow through the same token
registry and overlay pipeline.

## Rationale

Literal visual values scattered through component code create a UX that
drifts by default. Two buttons that are both intended to be
"primary" can end up with different shades, different corner radii, and
different spacing simply because one file copied an older literal and
another used a new one. Central token definitions in
`platformkit-design-system/tokens/` and shared token contracts in
`platformkit-shared/tokens/` prevent this drift by forcing all visual
semantics through named, reviewable primitives.

Tenant branding depends on the same invariant. PlatformKit overlays are
supposed to remap semantic intent (brand, surface, foreground, spacing,
focus, motion) without rewriting component code. When components bypass
tokens and hardcode literals, tenant overlays cannot reliably apply and
customers get partial or broken theming. Token-driven components,
including `platformkit-frontend-kit/components/atoms/*` that consume
token-provided style props, preserve a single branding pipeline.

Accessibility evidence also requires a finite semantic surface. Contrast
analysis, reduced-motion audits, and typography consistency checks are
tractable when values come from registered token categories; they are
not tractable when every file can introduce ad-hoc literals. Enforcing
token usage turns accessibility from manual sampling into a repeatable,
whole-catalog review process.

## Acceptance criteria

- **AC-1** `golangci-lint` integration or `guard-tokens` flags any
  literal hex value, `rgb(...)` value, or named CSS color usage in
  component rendering code.
- **AC-2** All admin shell renderers consume visual semantics through
  `theme.Tokens` rather than raw color/spacing/typography literals.
- **AC-3** Tenant overlays apply only through the registered overlay
  pipeline; component code does not implement tenant-specific visual
  literals directly.
- **AC-4** The design-system catalog enumerates every available token
  category (including color, spacing, typography, radius, shadow, and
  motion) from the shared token registry.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Analysis | `platformkit-frontend-kit/cmd/guard-tokens` (via direct invocation or `golangci-lint` integration) rejects literal hex/rgb/named-color usage in component code. |
| AC-2 | Inspection | Code-review checklist over admin shell renderers confirms style consumption via `theme.Tokens` only. |
| AC-3 | Inspection | Code-review checklist over tenant branding paths confirms overlays are applied through `platformkit-design-system/overlays/` and the registered token pipeline. |
| AC-4 | Inspection | Design-system catalog review confirms token categories are fully enumerated from `platformkit-design-system/tokens/` and `platformkit-shared/tokens/`. |

## Satisfied by

- [ADR 0003 — Every component resolves its styles through `style.go`](../adr/0003-component-token-extractor-pattern.md) — establishes token-aware style resolution seams per component.
- [ADR 0004 — Every Tailwind class goes through a typed DSL](../adr/0004-typed-design-token-dsl.md) — enforces typed token-to-class compilation and blocks ad-hoc utility literals.
- [ADR 0022 — The design system is CUE-authored end to end](../adr/0022-pkds-cue-authored-design-system-pipeline.md) — defines the registry and emitter pipeline that keeps tokens authoritative across targets.
- [Convention C-07 — Admin UI consumes design tokens, never raw colors](../conventions.md#c-07-admin-ui-consumes-design-tokens-never-raw-colors) — reviewer and guard discipline for admin UI code.
