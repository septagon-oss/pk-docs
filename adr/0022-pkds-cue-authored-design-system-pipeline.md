---
title: "ADR 0022: The design system is CUE-authored end to end"
status: Accepted
date: 2026-04-23
slug: adr-0022-pkds-cue-authored-design-system-pipeline
adr_topic: design-system
type: doc
tags: [adr, design-system, frontend, tokens, claude-design, figma, cue]
---

# ADR 0022 — The design system is CUE-authored end to end

Status: **Accepted** (2026-04-23)

## The problem

The design-system pipeline had three sources of truth in three
languages and shipped broken contracts to every downstream consumer.

Tokens were authored as Go structs in
`platformkit-design-system/tokens/*.go` and rendered to W3C DTCG
via `adapters/w3c`. Component contracts were authored as TypeScript
component code in `platformkit-frontend-kit`, then *extracted* into
`stories.json` by Storybook autogen, compiled into
`shared.ComponentSpec` values by
`adapters/figma/figmagen`, and packaged by `adapters/claudedesign`.
Themes, experiences, and icons each had their own Go packages with
their own conventions.

That shape produced concrete defects we can name from a 2026-04-23
audit against the tarball actually shipping to Claude Design:

1. Button's `size` enum shipped nine aliased values
   (`xs`, `sm`, `small`, `md`, `medium`, `lg`, `large`, `xl`,
   `2xl`) because the TypeScript source carried both an older
   `_size` prop and the canonical `size` prop, and Storybook's extractor
   merged them silently.
2. Button's `variant` enum mixed stylistic options (`primary`,
   `secondary`, `outline`, `ghost`, `link`) with semantic tones
   (`success`, `warning`, `error`, `info`). `error` and `danger`
   both existed.
3. Input declared 25 props including `label`, `helpText`,
   `errorText`, `prefix`, `suffix`, and was categorised as an atom.
   Its own description told callers "Prefer Checkbox, Radio,
   Toggle, Slider, FileUpload when those dedicated interaction
   models are available" — a written admission that the atom was
   overloaded.
4. Alert (8 props, including `title` + `message` + `icon` +
   `dismissible`) was also categorised as an atom.
5. `Breadcrumb` + `Breadcrumbs`, `Header` + `AppHeader`,
   `Footer` + `AppFooter` shipped as distinct components with
   identical purpose and near-identical previews.
6. `icon: string` was the declared type on 20+ components with no
   reference to the 55-glyph icon vocabulary. Typos rendered
   nothing silently.
7. The DTCG token file used correct `$value` / `$type` wrappers but
   had no `$description`, no `$schema` reference, no
   primitive-layer aliases — semantic tokens carried raw hex
   instead of referencing a primitive palette.
8. There was no IR-level changelog between exports, no manifest
   recording which source files contributed which outputs, and no
   contract lint that could fail a build on any of the above.

These weren't review failures. They were architectural. No amount of
more careful authorship in the old pipeline would have prevented a
Storybook extractor from silently merging two enums, or stopped a
human-authored TypeScript component from drifting away from its
intended atomic boundary. The extraction step was the bug.

Two adjacent forces closed the decision window:

- **Claude Design** (Anthropic, launched 2026-04-17) became a
  first-class consumer and published the `brand-context.tgz`
  ingest contract. The artifact we hand it had to be indisputably
  correct.
- **Figma Variables + Code Connect** had stabilised around W3C
  DTCG (Design Tokens Community Group) as the portable format. Our
  output was DTCG-*shaped* but not DTCG-*complete*.

## The decision

Introduce **PKDS** (PlatformKit Design System), a new subpackage of
`platformkit-design-system` that is the single source of truth for
every design token, component contract, theme, experience, and
icon.

Five load-bearing choices:

1. **CUE is the authoring language.** Tokens, components, themes,
   experiences, and validation rules are all authored as `.cue`
   files under `platformkit-design-system/pkds/src/`. CUE is
   declarative, typed, composable, supports first-class constraints
   and aliases, treats values and types uniformly, and emits JSON,
   JSON Schema, Go, and TypeScript via its standard toolchain.
   Used by Istio, Dagger, kpt.
2. **Three-layer tokens with aliases.** Primitive
   (`color.primitive.blue.600 = "rgb(37 99 235)"`) → Semantic
   (`color.surface.brand = primitive.blue.600`) → Component
   (`button.primary.bg = surface.brand`). Every layer emits valid
   DTCG; aliases use DTCG `{reference}` syntax.
3. **Component contracts are authored, not extracted.** Each
   component is a `.cue` file under
   `pkds/src/contracts/<category>/<name>.cue`. Props, variants,
   slots, tones, and category are declared explicitly with full
   validation. Storybook extraction is retired from the
   Claude Design and Figma paths. (It may remain as an internal
   consumer of the IR but is no longer upstream of it.)
4. **Emitters are pure functions, isolated per target.**
   `pkds/emitters/<target>/` holds one package per target
   (`claudedesign`, `figma`, `storybook`, `tailwind`, `ios`,
   `react`). Each exposes `Emit(ir pkds.IR) (Artifact, error)`
   and imports nothing from any other emitter. Adding a new
   target is a new package; modifying one target never risks
   another.
5. **Correctness is CI-enforced.** `pkds check` runs `compile`,
   `lint`, and every emitter's golden-file test. Lint rules
   encode atomic-design constraints (atom prop count ≤ 12, no
   duplicate canonical names, variant and tone on separate axes,
   icon props typed against `iconcatalog.Names()`, enum values
   free of aliases). Every PR passes `pkds check` before merge.

The IR layer under `pkds/dist/ir/` is the published contract
between authoring and emission. It contains DTCG tokens,
per-component JSON, JSON Schemas for every IR type, and
`manifest.json` carrying content hashes, schema versions, git SHA,
and a lineage record of which source files contributed which
outputs. Every emission is reproducible from
`{git SHA, ir manifest}`.

## What we gave up

- A new toolchain dependency (CUE) in CI and local dev.
  Mitigated by a single `make pkds-install` target and a pinned
  CUE version.
- A one-time migration cost: roughly four weeks of phased work to
  port tokens, 108 component contracts, themes, and experiences,
  and to retire `figmagen`-for-Claude-Design and the Storybook
  extraction pipeline upstream.
- Two sources of truth during migration. The existing Go `tokens/`
  package and the new CUE sources coexist through the cutover.
  Mitigated by golden-file parity tests that hold the DTCG output
  byte-identical — ADR 0004's precedent.
- A learning surface. Contributors learn CUE. Mitigated by scoping
  authorship to a small number of maintainers initially and
  auto-generating `.cue` scaffolds via
  `pkds scaffold component --name X`.

## What we kept

- One authoring language for tokens, components, themes, and
  experiences.
- Mechanical impossibility for every audit defect listed above.
  Enum aliases fail compile. Atom prop count is a hard rule.
  Duplicate canonical names fail compile. Untyped `icon` fails
  compile.
- Complete DTCG output — primitive/semantic/component layers with
  aliases, `$description` on every token, `$schema` reference,
  content-hashed manifest.
- Decoupled emitters. Adding a Kotlin or Web Components target is
  ~200 lines and cannot break any other target.
- Reproducibility. Every emission is deterministic, versioned,
  diffable. `pkds diff v1..v2` produces structured changelogs.
- Bidirectional handoff. Claude Design's published return-path
  schema lands as an overlay against CUE source — AI-proposed
  changes enter the same validation pipeline as human-authored
  ones.
- Lineage + observability. `manifest.json` records which source
  files contributed which output bytes, enabling forensic-grade
  debugging.

## How we enforce it

Guard rules codified in `pkds lint`:

- No component may declare an enum with aliased values
  (`["sm","small"]` fails).
- No component may declare `icon` as type `string`; must reference
  the enum `#IconName` generated from `iconcatalog.Names()`.
- No component may declare both `variant` and a variant value that
  belongs on the `tone` axis (`danger`/`success`/`warning`/`info`
  are `tone`, not `variant`).
- No two components may share a canonical `Name`.
- Atom category is capped at 12 props (Input, Alert, etc. must be
  reclassified or decomposed).
- Every optional boolean prop must declare a `default`.
- Token `$value` must be either a primitive literal or a DTCG
  alias reference; semantic-layer tokens may not carry raw hex.
- Every emission must include a `manifest.json` with content
  hash, schema version, and git SHA.

## Migration phases

Each phase has a binary exit criterion. Each phase is
independently mergeable; each can be rolled back without blocking
the rest.

1. **Phase 0 — Scaffold.** ✅ shipped. `pkds/` subpackage with
   directory layout, Go CLI skeleton exposing `compile`, `lint`,
   `emit`, `check`, `diff`, `scaffold`, `handoff`. Zero coupling
   to existing adapters.
2. **Phase 1 — Tokens in CUE.** ✅ shipped. Port `tokens/*.go` to
   `pkds/src/tokens/*.cue` as primitive + semantic + component
   layers with `$description`. Golden-file parity test vs current
   `brand-context/tokens/tokens.json`.
3. **Phase 2 — Contract linter.** ✅ shipped. Encode the rules
   above. Paired fixtures — a "clean" IR passes every rule; a
   "dirty" IR replays each defect from the 2026-04-23 audit. No
   secondary importer — PKDS has a single authoring path (CUE) and
   the linter operates only on compiled IR.
4. **Phase 3 — Components in CUE.** ✅ shipped. Port the 108
   components; fix every defect while porting. `pkds lint` passes
   on the full catalog.
5. **Phase 4 — Retire extraction.** ✅ shipped.
   `claude-design-export` CLI retired; Storybook-extraction path
   deleted upstream of Claude Design.
6. **Phase 5 — Remaining emitters.** ✅ shipped for
   `claude-design`, `mobile`, `storybook`. `figma`, `tailwind`,
   `react`, `ios` remain follow-ups, each a new package under
   `pkds/emitters/`.
7. **Phase 6 — Bidirectional handoff.** ✅ shipped.
   `pkds handoff receive --in=bundle.json` parses a
   `pkds.handoff.v1` JSON bundle, validates it structurally,
   applies every change to a copy of the compiled IR, runs the
   full lint suite, and — only when every gate passes and
   `--write` is set — re-emits the affected CUE files under
   `src/contracts/`. Dry-run is the default. Supported `kind`
   values: `token.override` (net-new paths only), `component.add`,
   `component.update`, `component.propAdd`,
   `component.variantAdd`. The receiver refuses any bundle that
   would introduce a lint-rule violation, preserving every
   correctness invariant the ADR guard rules encode.

## Alternatives we rejected

- **TypeScript + TypeBox.** Attractive because the frontend-kit
  team already writes TypeScript and TypeBox gives typed runtime
  schemas. Rejected because (a) component contracts are the
  symptom — keeping them in the same language as component
  implementations preserves drift; (b) TypeBox has no first-class
  alias or constraint model — token aliasing would stay manual;
  (c) it adds a Node.js runtime dependency to the pipeline.
- **JSON Schema hand-authored.** Attractive because it's the
  output every consumer already understands. Rejected because
  hand-written JSON Schema is painful, doesn't compose, and
  offers no primitive-to-semantic alias story for tokens.
- **TypeSpec (Microsoft).** Attractive as a typed schema language
  with broad backing. Rejected because it's purpose-built for
  API/protocol definitions and lacks CUE's constraint and
  value-as-type semantics.
- **Go-native typed DSL** (extend the current `tokens/` package
  with components, themes, etc.). Attractive — keeps the stack in
  one language. Rejected because every future emitter would still
  need Go, and the workspace-wide goal of emitting Swift, Kotlin,
  and Tailwind JS artifacts makes a language-neutral IR
  non-negotiable. Also: Go doesn't express token aliases or
  semantic constraints cleanly without reflection.
- **Do nothing — fix defects in place.** Shortest path to a clean
  `brand-context.tgz`. Rejected because the extraction-based
  pipeline will reintroduce the class of defect on the next
  component added, the next Storybook upgrade, or the next
  contract change. A one-time fix against an uncorrectable source
  of truth is a patch, not an architecture.

## References

- [ADR 0003 — every component resolves its styles through style.go](./0003-component-token-extractor-pattern.md)
  — preserved; PKDS emits into the same extractor seam.
- [ADR 0004 — every Tailwind class goes through a typed DSL](./0004-typed-design-token-dsl.md)
  — preserved; the DSL is now fed by PKDS-emitted tokens.
- W3C Design Tokens Community Group Format Module (Editor's
  Draft).
- CUE language specification — <https://cuelang.org>.
- `platformkit-design-system/adapters/claudedesign/` (retired) —
  the file-based adapter PKDS's `claude-design` emitter
  superseded.
- `platformkit-design-system/adapters/figma/figmagen/` — the
  Figma-push compiler; PKDS's `figma` emitter will supersede it
  in the remaining Phase 5 work.
- 2026-04-23 audit findings — the concrete defect list that
  motivated this ADR.
