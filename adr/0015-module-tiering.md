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

## The problem

PlatformKit's catalog spans many modules at different maturity
levels. Some are battle-tested — `user_management`, `auth_management`,
`tenant_management` — and carry strong operational guarantees.
Others are active areas of development — `agent_runtime`,
`web3_payments`, `device_management` — that ship real value but
aren't yet ready for an assurance posture.

Treating them uniformly is dishonest in both directions. Advertising
`web3_payments` with the same contract-review stability as
`auth_management` misleads integrators who adopt it expecting a
frozen surface. Treating `auth_management` as experimental
under-sells its stability and makes the compliance story weaker
than the code actually justifies.

We need an honest label on every module that integrators can act
on.

## The decision

Every module declares a tier in
`pk-modules/catalog/module_contracts.yaml`:

- **core-certified** — strongest compatibility posture,
  assurance-eligible (`assuranceEligible: true`), included in
  `minimal` / `core` presets, contract changes require
  ADR-equivalent review. Examples: `auth_management`,
  `audit_management`, `tenant_management`, `user_management`,
  `api_key_management`, `notification_management`.
- **supported** — production-ready, preset compatibility declared,
  safe for supported product composition,
  `assuranceEligible: false` unless it opts in. Examples:
  `booking_management`, `billing_management`, `content_management`,
  `file_management`.
- **experimental** — fast-moving, no preset inclusion, `notes:`
  field required documenting the churn expectation. Examples:
  `chat_management`, `device_management`, `execution_management`,
  `guardian_management`.

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
- Review overhead. Tier changes are catalog edits plus audit
  regeneration — cheap once the *conversation* happens, but the
  conversation itself has to happen.

## What we kept

- Honest integrator signal. A product team adopting
  `chat_management` sees `tier: experimental` and plans
  accordingly. A team integrating `auth_management` sees
  `core-certified` and gets the contract review to match.
- A proportional audit surface. Core-certified gets the highest
  posture; experimental trades that posture for velocity. The bar
  scales with the tier claim, not uniformly across the catalog.

## How we enforce it

- **`pk-modules/Makefile check-module-contracts`**
  — parses `module_contracts.yaml`, validates every module has a
  tier, validates tier-specific required fields (e.g. `notes` for
  experimental; `assuranceEligible` and `compatibility.presets`
  for supported/core-certified).
- **`check-module-maturity`
  (`scripts/check_module_maturity.sh`)** — verifies tier claims
  match module substance: supported modules must have non-empty
  `migrations/`, ≥3 test files, and a completed `docs/`
  directory; core-certified must additionally appear in
  `catalog/module_sets.yaml` under an assurance set.
- **`check-module-assurance-evidence`** — generates a machine-readable
  evidence matrix (`cmd/module-assurance-evidence-generate`)
  mapping each tier's required artifacts to the module's actual
  filesystem. Discrepancies fail CI.
- **`check-module-capability-matrix`** — regenerates
  `docs/architecture/MODULE_CAPABILITY_MATRIX.md` from live module
  metadata and fails on drift. It's a *symptom* detector for
  tier-claim drift, not a cross-validator on its own.
- **Generated workspace doc** — `.claude/generated/index.md` emits
  per-tier counts so drift is visible without running a check:
  `core-certified: 11, experimental: 9, supported: 27`.

## References

- `pk-modules/catalog/module_contracts.yaml` —
  source of truth.
- `pk-modules/cmd/module-assurance-evidence-generate`
  — evidence generator.
- Related:
  [ADR 0016 — apps compose from presets, not hand-maintained module lists](./0016-module-sets-and-preset-composition.md)
  — how tiers plug into preset composition.
- Related:
  [Convention C-06 — test coverage scales with tier](../conventions.md#c-06-test-coverage-scales-with-tier)
  — the tier-specific test requirements.
