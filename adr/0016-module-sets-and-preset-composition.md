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

The catalog exposes two levels of abstraction above individual
modules, both declared under `pk-modules/catalog/`:

- **Presets** are labels that modules opt into. A module with
  `compatibility.presets: [default, coworking]` is included
  whenever an app selects either preset. Presets are simple
  membership sets; they don't carry additional guarantees beyond
  "this module opted in."
- **Module sets** are curated collections with explicit guarantees.
  `assurance-core` includes only modules where
  `tier: core-certified` AND `assuranceEligible: true`.
  `client-default` is the supported-tier baseline for non-coworking
  clients. `flagship-coworking` is the full coworking product
  surface. Sets can be derived from tier + preset selectors *or*
  explicitly enumerated.

Apps MUST compose from presets or sets, not from hand-maintained
module lists. The platform's two canonical apps
(`complete-saas-monolith` and `complete-saas-microservices`) both
use the `flagship-coworking` set.

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
- Inspectable composition. `platformkit modules graph --preset X`
  shows exactly what ships.

## How we enforce it

- **`check-module-sets`** (`cmd/module-set-check`) — loads
  `catalog/module_contracts.yaml` and `catalog/module_sets.yaml`,
  runs `catalog.Validate`, `ValidateConformance`, and
  `ValidateSupportedSets`. This is the cross-validator: every
  module referenced by a set exists, every preset-member claim is
  consistent with the catalog, no duplicate set names.
- **`check-module-capability-matrix`** — regenerates the capability
  matrix markdown and fails on drift. It's a symptom detector for
  preset/set drift — a module's ports or events moving shows up as
  a matrix diff — not a preset-coverage cross-validator. The
  coverage cross-validation is `check-module-sets`.
- **`check-dual-path-flows`** + **`check-dual-path-flows-strict`**
  — match the flow inventory baseline. A flow touching a module
  that's been removed from a preset's composition fails the
  baseline match.
- **`platformkit modules graph --preset <name>`** produces a visual
  dep graph per preset; `platformkit modules graph --impact <module>`
  shows the transitive effect of a module removal. Both live in
  `platformkit-devtools`.

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

- `pk-modules/catalog/module_contracts.yaml` —
  module → preset membership.
- `pk-modules/catalog/module_sets.yaml` — set
  definitions.
- `pk-modules/cmd/module-contract-check` /
  `cmd/module-set-check` — CLI tools bundled in `make precommit`.
- `.claude/generated/module-sets.md` — human-readable rendering of
  the current sets.
- Related:
  [ADR 0015 — every module declares one of three tiers](./0015-module-tiering.md)
  — the tier is the primary discriminator sets select on.
