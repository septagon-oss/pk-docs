---
title: "ADR 0016: Apps compose from presets, not hand-maintained module lists"
status: Accepted
date: 2024-09-10
slug: adr-0016-module-sets-and-preset-composition
adr_topic: module-system
type: doc
tags: [adr, modules, presets, composition]
---

# ADR 0016 — Apps compose from presets, not hand-maintained module lists

Status: **Accepted** (2024-09-10)

> **Source-of-truth amendment — ADR 0048 (2026-06-11).** This ADR's
> preset/set composition decision remains accepted. ADR 0048 superseded its
> serialized authoring mechanism: module preset compatibility is authored in
> `catalog/modulecontracts/authored_catalog.go`, and named module sets are
> authored in `catalog/modulecontracts/authored_module_sets.go`.
> `module_contracts.yaml` and `module_sets.yaml` are on-demand generated
> exports only; neither is an authored input.
>
> The paths below are authorities in the full PlatformKit distribution. The
> public `github.com/septagon-oss/pk-modules/pkg` reference pack intentionally
> composes its small exported bundle directly and carries no parallel set
> catalog; see ADR 0048's repository-scope note.

## The problem

Downstream products don't compose applications from the full catalog
of individual modules. They pick a *shape* — "coworking SaaS",
"learning management", "internal admin". Each shape needs a
known-good collection of modules that ship together.

Without named collections, every app re-declares its module list by
hand, and every upgrade becomes an audit of which modules are
compatible with which. It works fine with two apps. It doesn't
scale to ten customer deployments with different shapes, because the
question "what does `coworking` mean this month?" has no single
answer.

We need named collections that are inspectable, versioned, and
opinionated about what belongs together.

## The decision

The catalog exposes two levels of abstraction above individual modules. Both
are typed Go values under
`modules/platformkit-business-modules/catalog/modulecontracts/`:

- **Presets** are typed labels that modules opt into through
  `ModuleContract.Compatibility.Presets`. A module declaring
  `[]Preset{PresetDefault, PresetCoworking}` is included
  whenever an app selects either preset. Presets are simple
  membership sets; they don't carry additional guarantees beyond
  "this module opted in."
- **Module sets** are curated `ModuleSet` values in
  `AuthoredModuleSets` with explicit guarantees.
  `assurance-core` includes only modules where
  `Tier == TierCoreCertified` AND `AssuranceEligible == true`.
  `client-default` is the supported-tier baseline for non-coworking
  clients. `saas-core` is the generic SaaS kernel. Sets can combine typed
  selectors with an explicit, compile-time-referenced module list.

Apps MUST compose from presets or sets, not from hand-maintained module lists.
The canonical business-module entry points are
`moduleregistry.BundleForPreset` and `moduleregistry.BundleForSet`; an
app-specific catalog may wrap those bundles with explicitly owned extension
bundles.

## What we gave up

- Coherence discipline. Preset and set definitions have to stay
  coherent. A module leaving a preset is a deprecation
  conversation; it can't be silent, and that discipline has a
  cost.
- Some first-contact friction. A new customer picks a preset or
  set before picking individual overrides. Mild up-front tax in
  exchange for upgrade-path simplicity later.

## What we kept

- One-line app composition. `preset: coworking` instead of
  enumerating every module by hand. Upgrades become "check that
  your preset still composes", not "audit every compatibility
  matrix by hand".
- Tier and preset governance reinforce each other. Downgrading a
  module from supported to experimental automatically removes it
  from supported-tier presets — CI catches it.
- Inspectable composition. `AuthoredModuleSets`, `BundleForSet`, and the
  module-set checks show exactly what a named set ships.

## How we enforce it

- **`check-module-sets`** (`cmd/module-set-check`) — loads
  `modulecontracts.Authored()` and `modulecontracts.AuthoredSets()`, then runs
  `Validate`, `ValidateConformance`, and `ValidateSupportedSets`. There is no
  YAML input. This is the cross-validator: every
  module referenced by a set exists, every preset-member claim is
  consistent with the catalog, no duplicate set names.
- **`catalog/modulecontracts/authored_test.go`** — verifies module IDs and
  archetypes, checks that every set reference resolves to an authored module,
  and pins key set properties.
- **`catalog/moduleregistry/bundle_test.go`** — proves every authored set is
  runtime-resolvable and that `BundleForSet` selects exactly its declared
  module IDs.
- **`check-module-capability-matrix`** — regenerates the capability
  matrix markdown and fails on drift. It's a symptom detector for
  preset/set drift — a module's ports or events moving shows up as
  a matrix diff — not a preset-coverage cross-validator. The
  coverage cross-validation is `check-module-sets`.
- **`check-dual-path-flows`** + **`check-dual-path-flows-strict`**
  — match the flow inventory baseline. A flow touching a module
  that's been removed from a preset's composition fails the
  baseline match.
- **`platformkit modules graph --impact <module>`** shows transitive dependency
  impact. Preset and set membership itself is resolved by the authored
  catalog and the bundle entry points above.
- **Serialized exports** — `make generate-catalog-exports` renders
  `module_contracts.yaml` and `module_sets.yaml` for release/docs consumers.
  The generated headers and ADR 0048 make them one-way projections.

## Alternatives we rejected

- **Hand-maintained module lists per app.** Works for two apps;
  doesn't scale to ten customer deployments with different shapes.
- **Single "everything" preset.** Loses the ability to ship a
  minimal tenant-only app or an assurance-only build.
- **Apps declare tier thresholds instead of presets.** Tempting
  ("give me all core-certified plus any supported that matches
  these domains") but too implicit — the declarative set name is
  easier to review.

## References

- `modules/platformkit-business-modules/catalog/modulecontracts/authored_catalog.go`
  — full-distribution module tier and preset membership.
- `modules/platformkit-business-modules/catalog/modulecontracts/authored_module_sets.go`
  — set definitions.
- `modules/platformkit-business-modules/cmd/module-contract-check` /
  `cmd/module-set-check` — CLI tools bundled in `make precommit`.
- `.claude/generated/module-sets.md` — human-readable rendering of
  the current sets.
- [ADR 0048 — the catalog is Go-authored; serialized formats are generated exports](./0048-go-authored-catalog-and-generated-exports.md)
  — superseding source-of-truth decision.
- Related:
  [ADR 0015 — every module declares one of three tiers](./0015-module-tiering.md)
  — the tier is the primary discriminator sets select on.
