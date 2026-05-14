---
title: "ADR 0031: Frontend components live in five strict atomic tiers with one-way imports and a registry that mirrors the filesystem"
status: Accepted
date: 2026-05-10
slug: adr-0031-atomic-component-tiers
adr_topic: frontend-architecture
type: doc
tags: [adr, frontend, components, atomic-design, governance]
---

# ADR 0031 — Frontend components live in five strict atomic tiers with one-way imports and a registry that mirrors the filesystem

Status: **Accepted** (2026-05-10)

## The problem

`platformkit-frontend-kit` ships ~100 reusable components. Without a
discipline, three failure modes appear within weeks:

1. **Tier inversion** — a "button" atom imports a "card" molecule for
   convenience, then the card can never be rebuilt without dragging
   the button along. Six months later every atom transitively depends
   on every organism and the dependency graph is a mat.
2. **Misclassification** — a piece of UI is filed under `atoms/` because
   it's *visually small*, even though it composes three sub-elements.
   The next developer searching for "where do reusable single-concern
   primitives live?" finds atoms that are actually molecules and
   loses trust in the categorisation.
3. **Silent drift between the registry and disk** — a developer adds
   `init() { registry.DefineComponent("Foo")... }` in a stray file or
   leaves an old directory behind after a rename. Storybook, Figma
   export, and the design-manifest parity check all silently disagree
   about whether `Foo` exists.

We already classify components into the canonical Brad-Frost atomic
tiers (atoms → molecules → organisms → templates → pages) on disk
under `platformkit-frontend-kit/components/<tier>/<name>/`. The
classification has been load-bearing in the codebase for over a year
— the registry has a `ComponentCategory` enum, the storybook
generator groups by tier, the Figma export reads tier from the
manifest. But the *rule* lived only as a JSON config
(`.platformkit/component_tier_rules.json`) and a pair of contract
tests. It had never been written down as a decision, so:

- new contributors had to reverse-engineer the model from the JSON
- "what does an atom mean here?" had no answer beyond "look at what's
  in `atoms/` today"
- there was no documented invariant that the on-disk tier and the
  registered `Category` must agree

This ADR codifies the model, names the invariants, and points to the
guards that enforce each one.

## The decision

Every reusable frontend component in `platformkit-frontend-kit/components/`
sits in exactly one of five tiers:

| Tier        | Path                         | Definition                                                                              | May import (component tiers) | May import (support)   |
|-------------|------------------------------|-----------------------------------------------------------------------------------------|------------------------------|------------------------|
| **atom**    | `components/atoms/<name>/`   | A single visual or interactive primitive with one concern. No composition.              | *(none)*                     | `base`                 |
| **molecule**| `components/molecules/<name>/` | A small composition of atoms forming a single reusable unit (e.g. `input` + `label`). | `atoms`                      | `base`                 |
| **organism**| `components/organisms/<name>/` | A self-contained section of UI composing molecules and atoms (e.g. nav, command palette). | `atoms`, `molecules`        | `base`                 |
| **template**| `components/templates/<name>/` | A page-shaped layout slot graph, no real content — defines where things go.            | `atoms`, `molecules`         | `base`, `layouts`      |
| **page**    | `components/pages/<name>/`   | A concrete composition of templates + organisms producing a renderable page.            | `atoms`, `molecules`, `organisms`, `templates` | `base`, `layouts` |

The rules above are normative. Their machine-readable form lives at
`platformkit-frontend-kit/.platformkit/component_tier_rules.json` and is
the source of truth for the contract tests. **If the table in this
ADR and the JSON disagree, the JSON wins until the ADR is updated.**

### Invariants

I1. **One-way imports.** A tier may only import the tiers listed in its
   row above. No cycles, no upward references, no jumping levels except
   where the table allows (pages may reach all four; templates may not
   reach organisms).

I2. **The directory IS the tier.** A component's tier is determined by
   its parent path under `components/`. There is no "actually a
   molecule but lives in atoms" — if it's under `atoms/`, it must
   behave as an atom.

I3. **The registry mirrors disk.** A component declared via
   `registry.DefineComponent(name).Category(registry.CategoryX)…` must
   sit under `components/<tier-matching-X>/<dir>/definition.go`. There
   is no other location for a definition. Conversely, every
   `components/<tier>/<name>/` directory must contain exactly one
   `definition.go` that registers a component whose `Category` matches
   the directory's tier.

I4. **The full catalog is reachable from one import.**
   `componentcatalog/zz_generated_component_imports.go` blank-imports
   every component package; this is regenerated by
   `cmd/storybook-server importsync`. Any package containing a
   `definition.go` must appear in the generated index.

### What belongs in which tier

The boundary that catches most misclassifications:

- An **atom** has no `<sub-component>/` siblings rendered as part of
  its body. `<button>`, `<input>`, `<icon>`, `<heading>` are atoms
  even though they may be heavily styled.
- A **molecule** is what you get when an atom needs *another* atom to
  be useful: `field` (label + input + helper-text), `breadcrumb`
  (icon + chevrons + links), `card` (heading + body + footer slots).
  If you can swap one of the inner atoms with a different one and the
  molecule still makes sense, it's a molecule.
- An **organism** is a self-contained section. The test:
  *could it stand alone in a Storybook page and read as a complete
  feature?* `app_header`, `data_grid`, `command_palette`, `kanban`.
- A **template** has no real content. It defines named slots and
  layout. If you find yourself writing copy or sample data, you are
  building a page, not a template.
- A **page** is the only tier that may render concrete domain data
  through a registered surface manifest.

### The relationship to existing concepts

- **Surface manifests (ADR-0002)**: pages and templates are surfaced
  by manifests. Atoms/molecules/organisms are not.
- **Token DSL (ADR-0004)**: every tier consumes design tokens. Tokens
  themselves are not components and do not belong in this hierarchy.
- **PKDS pipeline (ADR-0022)**: PKDS owns tokens + the Figma
  ComponentSet schema. The atomic tier of a registered component is
  carried into PKDS via the `Category` field on `ComponentSpec`.
- **File-purpose declarations (ADR-0029)**: every Go file in a
  component package carries its `// C-NN` or `// ADR-NNNN` reference;
  this ADR is one of the targets such files may cite when they
  motivate a tier-specific split.

## Enforcement

| Invariant | Guard | Location |
|---|---|---|
| **I1** import direction | `component-tier-boundaries` (existing) | `component_tier_contract_test.go` → `TestComponentTierImportBoundaries` |
| **I2/I3** category matches tier | `component-category-matches-tier` (new — this ADR) | `component_atomic_membership_test.go` → `TestComponentRegisteredCategoryMatchesDirectoryTier` |
| **I3** every dir registers, no stray definitions | `component-registry-filesystem-parity` (new — this ADR) | `component_atomic_membership_test.go` → `TestComponentDefinitionsLiveOnlyInTierDirectories` |
| **I3** definition.go exists in every tier dir | `component-definition-contracts` (existing) | `component_definition_contract_test.go` |
| **I4** generated import index is complete | `component-definition-contracts` (existing) | covered by the same test suite |
| Tier roots have implementation | `component-tier-boundaries` (existing) | `TestComponentTierPackagesContainImplementation` |

All five run in the `fast`, `pr`, `ui-hardening`, `full`, and
`nightly` lanes via `make guard-fast` (etc.) and are catalogued in
`platformkit-frontend-kit/.platformkit/guards/ui-hardening.yaml`.

## Adding a new tier

Adding a sixth tier (e.g. `widgets`) is a deliberate ADR-amending
decision. The mechanical change is small (add a row to
`component_tier_rules.json`), but it touches the storybook generator,
the Figma export, the PKDS pipeline, and every CLAUDE.md mention of
the model. Don't slip a new tier in via PR.

## Risks

- **The category-matches-tier check parses Go AST.** Test cost is
  one-off file walk + parse; on the current ~100-component tree it
  runs in <100 ms locally. If the catalog grows past 1000 components
  we'll cache the AST or move detection into a build-time generator.
- **Renaming a tier (e.g. atoms → primitives) is a four-place
  change** — JSON, ADR, registry enum, generated imports.
  Renames should land in a single PR with all four updated together.
- **The "what is an atom" judgement is not machine-checkable.** No
  test catches a multi-concern atom that lives in one Go file with no
  imports. PR review remains the backstop for tier *quality*; the
  guards only enforce tier *placement*.
