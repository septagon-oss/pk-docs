---
title: "ADR 0015: Every module declares one of three tiers"
status: Accepted
date: 2024-09-10
slug: adr-0015-module-tiering
adr_topic: module-system
type: doc
tags: [adr, modules, governance, tiering]
---

# ADR 0015 — Every module declares one of three tiers

Status: **Accepted** (2024-09-10)

> **Source-of-truth amendment — ADR 0048 (2026-06-11).** This ADR's
> three-tier governance decision remains accepted. ADR 0048 superseded only
> its storage and enforcement mechanism: tier, assurance, preset, notes, and
> archetype fields are authored as typed `ModuleContract` values in
> `catalog/modulecontracts/authored_catalog.go`. `module_contracts.yaml` is an
> on-demand generated export, never an authored input or a checked-in source
> of truth.
>
> The path below is the authority in the full PlatformKit distribution. The
> public `github.com/septagon-oss/pk-modules/pkg` reference pack intentionally
> has no duplicate tier catalog; see ADR 0048's repository-scope note.

## The problem

PlatformKit's catalog spans many modules at different maturity
levels. Some are battle-tested — `user_management`, `auth_management`,
`tenant_management` — and carry strong operational guarantees.
The original 2024 inventory also contained active areas of development that
shipped real value without being ready for an assurance posture. Their names
and current tiers are deliberately left to the authored catalog rather than
frozen into this ADR.

Treating them uniformly is dishonest in both directions. Advertising an
experimental module with the same contract-review stability as
`auth_management` misleads integrators who adopt it expecting a
frozen surface. Treating `auth_management` as experimental
under-sells its stability and makes the compliance story weaker
than the code actually justifies.

We need an honest label on every module that integrators can act
on.

## The decision

Every module's `ModuleContract` in
`modules/platformkit-business-modules/catalog/modulecontracts/authored_catalog.go`
declares exactly one typed `Tier` value:

- **core-certified** — strongest compatibility posture,
  assurance-eligible (`AssuranceEligible: true`), included in
  `minimal` / `core` presets, contract changes require
  ADR-equivalent review.
- **supported** — production-ready, preset compatibility declared,
  safe for supported product composition,
  `AssuranceEligible: false` unless it opts in.
- **experimental** — fast-moving, no preset inclusion, `Notes`
  field required documenting the churn expectation.

The tier names and their meaning are stable; the live membership is not copied
into this ADR. Read `AuthoredCatalog.Modules` for the current assignment.

The rule that makes the tiers load-bearing: **tier claims aren't
aspirational**. They must match the module's actual substance.
Supported modules ship migrations, tests, and a non-trivial feature
set. Experimental modules may ship with just a contract and one
feature, but they must *say* so.

## What we gave up

- Tier drift risk. A supported module can degrade (test coverage
  falls, contracts break) without a formal demotion conversation.
  The mechanical guards catch some signals; they can't catch
  "philosophical drift" where the claim and the code diverge
  slowly.
- Review overhead. Tier changes are typed catalog edits plus evidence
  regeneration — cheap once the *conversation* happens, but the conversation
  itself has to happen.

## What we kept

- Honest integrator signal. A product team adopting
  `chat_management` sees `tier: experimental` and plans
  accordingly. A team integrating `auth_management` sees
  `core-certified` and gets the contract review to match.
- A proportional audit surface. Core-certified gets the highest
  posture; experimental trades that posture for velocity. The bar
  scales with the tier claim, not uniformly across the catalog.

## How we enforce it

- **`make check-module-contracts` in
  `modules/platformkit-business-modules/`** — runs
  `cmd/module-contract-check` over `modulecontracts.Authored()`, validates the
  typed catalog against the module tree, validates conformance, and compares
  authored contracts with instantiated runtime manifests. There is no YAML
  input.
- **`check-module-maturity`
  (`scripts/check_module_maturity.sh`)** — loads
  `modulecontracts.Authored()` and `modulequality.AuthoredPolicy()`. It joins
  the contract's typed tier and archetype with live manifests, tests,
  features, routes, permissions, and integration metadata, then rejects
  claims that do not meet the current typed policy.
- **`check-module-assurance-evidence`** — generates a machine-readable
  evidence matrix (`cmd/module-assurance-evidence-generate`)
  from `AuthoredCatalog` and `AuthoredModuleSets`, verifies the
  `assurance-core` selector and membership, and fails when the checked evidence
  report or its hashed inputs drift.
- **`check-module-capability-matrix`** — regenerates
  `docs/architecture/MODULE_CAPABILITY_MATRIX.md` from live module
  metadata and fails on drift. It's a *symptom* detector for
  tier-claim drift, not a cross-validator on its own.
- **Generated workspace docs** — `.claude/generated/index.md` projects
  per-tier counts so drift is visible without duplicating mutable counts in
  this ADR.
- **Serialized exports** — `make generate-catalog-exports` renders
  `module_contracts.yaml` and `module_sets.yaml` to the requested output
  directory for non-Go consumers. Those files are disposable projections and
  are never edited to change a tier.

## References

- `modules/platformkit-business-modules/catalog/modulecontracts/authored_catalog.go`
  — full-distribution typed tier and compatibility authority.
- `modules/platformkit-business-modules/catalog/modulequality/authored_policy.go`
  — typed maturity policy authority.
- `modules/platformkit-business-modules/cmd/module-assurance-evidence-generate`
  — evidence generator.
- [ADR 0048 — the catalog is Go-authored; serialized formats are generated exports](./0048-go-authored-catalog-and-generated-exports.md)
  — superseding source-of-truth decision.
- Related:
  [ADR 0016 — apps compose from presets, not hand-maintained module lists](./0016-module-sets-and-preset-composition.md)
  — how tiers plug into preset composition.
- Related:
  [Convention C-06 — test coverage scales with tier](../conventions.md#c-06-test-coverage-scales-with-tier)
  — the tier-specific test requirements.
