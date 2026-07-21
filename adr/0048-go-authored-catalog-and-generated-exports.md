---
title: "ADR 0048: the catalog is Go-authored; serialized formats are generated exports"
status: Accepted
date: 2026-06-11
slug: adr-0048-go-authored-catalog
adr_topic: platform
type: doc
tags: [adr, platform, catalog, composition, contracts, codegen, modules]
---

# ADR 0048 — the catalog is Go-authored; serialized formats are generated exports

Status: **Accepted** (2026-06-11). Design reviewed adversarially by a
four-model council (Grok, Codex, DeepSeek, local) on 2026-06-11 as part of the
building-blocks essence review; the council unanimously identified
hand-authored composition YAML as the largest source of concept duplication
and weakest validation surface in the platform.

> **Repository scope.** The implementation paths in this decision refer to
> the full PlatformKit distribution's
> `pk-modules` repository. The public
> `github.com/septagon-oss/pk-modules` repository is a deliberately small
> reference module pack under `pkg/`; it does not mirror the full catalog and
> must not create a parallel YAML or CSV authority. Public consumers compose
> those reference packages explicitly. A downstream distribution that adopts
> catalog tiering or named sets should keep its typed catalog in its own
> composition repository and treat serialized catalog data as exports only.

## Context

The module catalog truth lived in hand-authored YAML and CSV
(`catalog/module_contracts.yaml`, `catalog/module_sets.yaml`,
`catalog/module_quality_policy.yaml`, `scripts/module_archetypes.csv`),
validated only by CI-time check binaries. A typo'd module ID survived until
`check-module-sets` ran. A projection generator
(`cmd/contracts-catalog-generate`) already emitted a Go struct literal from
the YAML — proof that the typed form is sufficient — but it pointed the wrong
way: Go code was demoted to a validator of strings. A duplicated
`module_contracts.yaml` copy embedded in pk-tools drifted
independently of the canonical one.

This contradicts the platform's essence: composition is a typed fx graph
(ADR 0017), dependencies are typed ports (ADR 0009), events are declared
contracts (ADR 0018) — yet the catalog that assembles all of them was
stringly-typed prose.

## Decision

Typed Go is the only hand-authored source of truth for catalog data:

1. `catalog/modulecontracts/authored_catalog.go` holds one exported
   `ModuleContract` var per module plus `AuthoredCatalog`.
   `authored_module_sets.go` holds `AuthoredModuleSets`; sets reference the
   per-module vars (via `moduleIDs(AdminManagement, ...)`), so membership
   errors are compile errors, not CI findings.
2. Archetype assignments move from CSV into a typed `Archetype` field on
   `ModuleContract`. The quality policy moves into
   `modulequality/authored_policy.go`.
3. No serialized catalog truth is checked into the repo at all.
   `cmd/catalog-export` renders YAML/JSON projections on demand, only where
   catalog data leaves the Go world (release artifacts, docs builds, external
   tooling). Because nothing serialized is checked in, there is no drift
   surface and no drift check — the compiler and `go test` are the guards.
4. Authored literals are pure data: struct literals only, no init-time logic,
   no conditionals. Validation/materialization code is the only interpreter —
   the same doctrine `platform.Define` (ADR 0047 lineage) applies to module
   descriptors.
5. Repos must not maintain hand-edited copies of catalog data. The devtools
   CLI consumes the `modulecontracts` Go package; its embedded YAML copies
   are deleted.

Validation lands in three tiers, each catching what the previous cannot:

- **Compile time** — module existence, tier/domain/capability/preset/archetype
  enums, set membership.
- **Test time** — graph closure, preset coherence, export round-trip
  (`go test`, replacing bespoke check scripts where possible).
- **Boot time** — fx graph materialization, fail-fast (unchanged).

## Consequences

- Compile-time validation of module existence, tiers, domains, presets, and
  archetypes; several catalog check scripts become ordinary `go test`s.
- Adding a module = adding a Go var + appending it to `AuthoredCatalog.Modules`
  (plus set membership where intended); the compiler and
  `catalog-export -check` enforce coherence.
- Non-Go consumers obtain serialized projections on demand
  (`catalog-export` at release/build time); there is no stable checked-in
  YAML path to drift, hand-edit, or police.
- The catalog and the future composition vocabulary (preset/set/bundle
  unification) now share one typed home, closing the council's
  "five names for one concept" finding.

## Rejected alternatives

- **Keep YAML as truth, strengthen CI checks.** Rejected: validation stays
  post-hoc; the compiler can never see string IDs; the devtools copy keeps
  drifting.
- **One unified YAML (`module_compositions.yaml`).** Rejected: unifies the
  vocabulary but keeps truth stringly-typed; the schema would be YAML-shaped
  rather than a Go type, against the platform's typed-composition essence.
- **Checked-in generated YAML with a drift check.** Initially planned,
  rejected on review: a checked-in generated file is still hand-editable,
  still needs drift policing, and the authored Go literal is equally
  diffable in review while also being compiler-checked. A workspace-wide
  consumer audit (2026-06-11) found no load-bearing reader of the YAML
  files that cannot invoke Go: three repo-local shell scripts (repointed),
  the release workflow (now generates at publish time), and prose.
