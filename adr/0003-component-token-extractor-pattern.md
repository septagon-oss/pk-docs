---
title: "ADR 0003: Every component resolves its styles through style.go"
status: Accepted
date: 2024-03-04
slug: adr-0003-component-token-extractor-pattern
adr_topic: ui-architecture
type: doc
tags: [adr, design-system, frontend]
---

# ADR 0003 — Every component resolves its styles through `style.go`

Status: **Accepted** (2024-03-04). Supersedes the earlier in-builder
`TokenExtractor` approach after a round of refactor experience made
the case for separation of concerns.

## The problem

Every component in `platformkit-frontend-kit` used to hardcode
Tailwind strings into its builder — `"bg-surface-primary"`,
`"z-50"`, `"h-5 w-5"` wired directly into the render. That produced
four real problems, not theoretical ones.

Client customisation was impossible beyond the global theme. A
client who wanted different modal padding, a different table-stripe
colour, or a different z-index layer had to fork the builder. The
design system had tokens — rich `XxxTokens` structs in
`platformkit-design-system/adapters/frontend/types.go` — but no
builder read them. Even the frontend kit's own molecules pulled from
hardcoded strings. Some atoms *declared* `TokenExtractor` variables
but never called `base.ExtractTokens`; the tokens looked wired and
weren't. And z-index drifted: `z-50` appeared 29 times across 13
files, representing six distinct semantic layers (modal, popover,
sticky, tooltip, and two more).

We tried the obvious first fix — embed `TokenExtractor` calls inside
`builder.go`. It worked, but it made the builder 30% styling logic
and 70% composition, and it made the styling logic untestable in
isolation. Asserting on a single token override meant rendering the
full HTML tree and diffing it.

## The decision

Every component that consumes design-system tokens splits into two
Go files:

- **`style.go`** — owns all class-string resolution. Declares the
  `TokenExtractor`, the resolved `xxxStyle` struct, the
  `defaultXxxStyle` fallback literal, and the `resolveXxxStyle`
  function.
- **`builder.go`** — owns composition only. Zero hardcoded class
  literals. Calls `resolveXxxStyle` once at the top of `Build()` and
  threads the resolved struct through render helpers.

Tests split the same way: `style_test.go` for resolver tests (fast,
no rendering) and `builder_test.go` for rendering tests.

The structural rules:

- Every component that consumes tokens has a `style.go`. No
  exceptions.
- `builder.go` never contains a class-string literal. Every
  `html.Class(...)` call references a field on the resolved
  `xxxStyle` struct. Constants for non-rendering attributes
  (`data-component="modal"`) are fine.
- `defaultXxxStyle` is the single source of truth for fallbacks. No
  scattered `if ... { return "z-50" }` in helper methods.
- Z-index always flows through `c.ZIndexClass(layer, fallback)`.
  Never hardcode `z-NN` in `defaultXxxStyle`.
- Helper methods take `s xxxStyle` as a parameter. They never call
  `resolveXxxStyle` again — `Build()` resolves once, threads it
  down.
- Token types live in the design system. A new component's tokens
  get added to `platformkit-design-system/adapters/frontend/types.go`
  first, defaults populated in `defaults.go`, then a type alias
  `type X = designfrontend.X` lands in
  `platformkit-frontend-kit/renderer/theme/tokens.go`.

Exemptions (intentional, not cracks in the rule):

- **`definition.go`** — design-time metadata for Storybook/Figma.
  Raw Tailwind inside `registry.DesignFrame(...)` is intentional.
- **`e2e.go`** — selector files use raw class strings to find DOM
  elements.
- **Email templates and CSS-variable-unsafe contexts** — hex colours
  permitted, but must be named constants with a comment citing the
  palette shade they mirror (`emailAccent = "#2563eb" // brand-600`).

A reference implementation lives at
`platformkit-frontend-kit/components/molecules/modal/{style.go, builder.go, style_test.go}`.

## What we gave up

- File count. Every tokenised component doubles its Go files.
- One extra import per builder.
- A growing `xxxStyle` struct per component. That's the truthful
  surface area — it should grow.

## What we kept

- Concerns separated. `builder.go` answers "what to render";
  `style.go` answers "what classes to apply".
- Resolver tests that don't render HTML. A token override is a
  struct-field assertion, not an HTML snapshot.
- One refactor target for visual changes. Touch `style.go`, not 30
  builders.
- Auditable theme swaps. `defaultXxxStyle` is a struct literal; a
  theme diff is a struct-literal diff.
- A lint surface that actually works. The rule — raw classes in
  `style.go` only — is mechanical, not subjective.
- AI/codegen friendliness. A generator that emits two files of known
  shape produces consistent output.

## How we enforce it

- **`platformkit-frontend-kit/cmd/guard-tokens`** — lint rule that
  flags token-aware class resolution outside a `style.go` file. The
  specific violations it catches:
  - Raw `z-NN` Tailwind classes in `builder.go` (allowed only in
    `style.go` `defaultXxxStyle` positions).
  - Hex-colour literals in component class strings (with the
    documented-fallback-constant exemption).
  - `TokenExtractor` variables declared in `builder.go` (must move
    to `style.go`).
  - Hardcoded class strings in `Class(...)` calls inside
    `builder.go` (must reference resolved style fields).
- **`style_test.go` per component** — each tokenised component ships
  a byte-identical-output test lock so resolver regressions fail a
  unit test, not just a lint.
- **`pk-modules/Makefile check-ui-atomic`** —
  verifies atomic/molecule/organism layering isn't violated
  (related discipline).
- **Contract tests** (`XxxContract` packages) assert both
  token-present and token-absent paths.

## References

- `platformkit-design-system/adapters/frontend/types.go` — token
  struct definitions.
- `platformkit-design-system/adapters/frontend/defaults.go` —
  default values.
- `platformkit-design-system/overlays/` — client/tenant overlay
  pipeline.
- `platformkit-frontend-kit/components/base/component.go` —
  `TokenExtractor`, `ExtractTokens`, `ComponentTokenSet`,
  `ZIndexClass`.
- `platformkit-frontend-kit/renderer/theme/tokens.go` — type
  aliases.
- `platformkit-frontend-kit/components/molecules/modal/` — the
  canonical reference implementation.
- `platformkit-frontend-kit/cmd/guard-tokens/main.go` — lint rules.
- `platformkit-frontend-kit/docs/TOKEN_MIGRATION_GUIDE.md` — the
  step-by-step migration walkthrough.
- Related: [ADR 0004 — every Tailwind class goes through a typed DSL](./0004-typed-design-token-dsl.md)
  — what feeds the `defaultXxxStyle` literal.
