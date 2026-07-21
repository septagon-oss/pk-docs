---
title: "ADR 0004: Every Tailwind class goes through a typed DSL"
status: Accepted
date: 2026-04-17
slug: adr-0004-typed-design-token-dsl
adr_topic: ui-architecture
type: doc
tags: [adr, design-system, frontend]
---

# ADR 0004 — Every Tailwind class goes through a typed DSL

Status: **Accepted** (2026-04-17). Depends on
[ADR 0003](./0003-component-token-extractor-pattern.md) (`style.go` as
the canonical resolver location).

## The problem

PlatformKit has a rich typed token system in
the design system's `tokens` — themes, experiences, overlays,
module contributions, the full story. But the last mile, the
actual Tailwind utility strings that ship in the rendered HTML, was
handwritten. 79 component builders and
`adapters/frontend/defaults.go` each carried their own string
literals. Changing the visual language meant find-and-replace across
the workspace, and there was no type-checked contract connecting
"this button is primary" to the classes that made it look primary.

A single palette change touched dozens of files. A typo in
`"bg-surfaec-primary"` compiled and shipped. iOS and Android
renderers couldn't consume the same tokens because the "tokens"
were stringly-typed CSS.

## The decision

Every semantic token — colour, spacing, radius, z-layer, variant,
size, shape, state, typography, motion — is a named Go type with
`const` enum values. The DSL lives in
the design system's `tw/classes.go` and emits the final class
string via `.Compile()`. The mapping from enum to class literal
lives in exactly one file, `tw/compile.go`; nowhere else in the
workspace writes a Tailwind utility string.

The pipeline:

```
tokens → typed enums → tw DSL → utility classes → frontend defaults
       → style.go → builder.go → rendered HTML
        (guard-tokens allows raw literals only in tw/compile.go)
```

Six rules follow:

1. the design system's `tw` is the **single source of Tailwind
   class strings**. Every token has a typed representation and a
   compile step.
2. `tw/compile.go` is the **only authorised location** for Tailwind
   class literals. Every `Color → "bg-…"` mapping, every
   `Spacing → "px-…"` mapping lives here. Everywhere else in the
   workspace treats class strings as the opaque output of
   `.Compile()`.
3. `guard-tokens` enforces the invariant. It refuses Tailwind
   utility patterns in `.go` source outside `tw/compile.go` (with
   narrow migration allow-lists for code not yet converted). It also
   refuses string literals matching canonical variant names
   (`"primary"`, `"md"`, `"xs"`, `"pill"`) outside the typed
   constants.
4. Component token defaults build via the DSL. The
   `ButtonTokens.Base`, `ButtonTokens.Variants`, and every other
   component token in `adapters/frontend/defaults.go` are the
   output of `tw.New()...Compile()`. The emitted strings are
   byte-identical to what we shipped before — enforced by golden
   tests — so the Tailwind content scanner finds the same class
   inventory.
5. Components consume tokens through `style.go`
   (see [ADR 0003](./0003-component-token-extractor-pattern.md)).
   `style.go` holds the `XxxTokenExtractor`, the
   `resolveXxxStyle` function, and nothing else. Builder files call
   `resolveXxxStyle(opts)` — they never touch a Tailwind string.
6. Variants and sizes are typed. `tw.Variant` / `tw.Size` /
   `tw.Shape` / `tw.State` replace raw strings in builder arguments.
   Component-level re-exports stay as `core.ComponentVariant` for
   source compatibility during adoption, but `VariantPrimary`,
   `SizeMedium`, etc. are now anchored to the `tw` package.

Three surfaces see the token change atomically. Implementation —
components resolve via `style.go` + typed DSL. Design — the
`registry.ComponentDefinition` examples cite typed constants.
Showroom — Storybook regenerates story JSON from those typed
examples. When Button's `rounded` moves from `xl` to `2xl`, the
change lands in `adapters/frontend/defaults.go` and the next build
propagates it through Tailwind config, component CSS, and every
Storybook frame.

Migration is component by component. The reference is Button:

1. Migrate the token defaults in `adapters/frontend/defaults.go`.
   Replace the handwritten string for each token field with a
   `tw.New().…Compile()` helper. Add a byte-identical golden test
   (see `button_dsl_test.go`) so CI catches regressions.
2. Create/update `style.go` per ADR 0003 shape.
3. Rewrite `builder.go`'s `Build()` to extract opts, call
   `resolveXxxStyle`, and use `style.Classes` as the `html.Class(...)`
   argument. Zero Tailwind strings in builder.
4. Add `style_test.go` covering token-wired and default paths, every
   variant/size, disabled-opacity, extra-class append, and FullWidth.
5. Remove the component from `guard-tokens`'s migration allow-list.
6. Regenerate stories via `make storybook-generate-stories`.

## What we gave up

- A migration. 79 component builders to port; one per PR is fine
  but it's real work.
- Some indirection. A token change now touches a typed const and
  its compile mapping, not just the raw string.
- A small runtime cost. `ClassList.Compile()` runs once during
  package init — measured at ~50µs per component's default tokens.
  Zero per-request cost; tokens are cached at the module boundary.

## What we kept

- One place to change. Any utility-class refresh lands in
  `tw/compile.go`.
- Autocomplete plus compile-time validation on variants, sizes,
  colours. A typo like `"primry"` doesn't compile.
- Cross-platform portability. iOS and Android renderers can consume
  the same typed tokens by implementing a non-Tailwind compiler —
  the DSL is generic.
- Byte-identical output during migration. Storybook, the Tailwind
  content scanner, and downstream CSS all work unchanged because
  the emitted classes are the same.

## How we enforce it

- **`cmd/guard-tokens`** (linter) refuses:
  - Utility-class literals (`bg-*`, `text-*`, `border-*`, `ring-*`,
    `px-*`, `py-*`, `rounded-*`, `z-*`, `font-*`, …) in `.go` files
    outside `tw/compile.go`, with narrow allow-lists for
    in-migration code.
  - Canonical variant/size literal strings (`"primary"`, `"md"`,
    `"xs"`, `"pill"`) outside their defining constants.
  - `fmt.Sprintf` producing Tailwind classes outside `tw/compile.go`.
  - `Raw()` calls inside `ClassList` chains are a warning, not an
    error — runtime-computed content is legitimate but needs review.
- **Golden tests** (e.g. `button_dsl_test.go`) lock the emitted
  class output byte-for-byte, so a DSL regression fails at
  `go test`, not only at lint.
- **Contract tests** on typed enums ensure every `Variant` /
  `Size` / `Shape` value has a compile mapping — an orphaned enum
  value fails.

## References

- ADR 0003 — `style.go` as the canonical resolver location. This
  ADR extends it.
- the design system's `tw/classes_test.go` — DSL contract
  tests.
- the design system's `adapters/frontend/button_dsl_test.go`
  — the byte-identical output lock on the reference component.
- the frontend kit's `components/atoms/button/` — canonical
  migration reference.
- Related: [ADR 0022 — the design system is CUE-authored end to end](./0022-pkds-cue-authored-design-system-pipeline.md)
  — the upstream source that feeds the typed DSL after migration
  completes.
