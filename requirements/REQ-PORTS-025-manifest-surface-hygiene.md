---
id: REQ-PORTS-025
title: "Module manifests may not re-declare the retired registrar surface after code has migrated (shrink-only ratchet)"
status: Proposed
date: 2026-07-02
slug: req-ports-025-manifest-surface-hygiene
category: governance
ears_pattern: unwanted-behaviour
verification_methods:
  - test
compliance: []
satisfied_by:
  adr: [ADR-0009]
  conventions: [C-14]
implements_cross_cutting: [REQ-002, REQ-016]
refines: REQ-PORTS-003
type: doc
tags: [requirement, governance, ports, manifests, ratchet]
module: platformkit_ports
feature: descriptor
capability: manifest_surface_hygiene
capability_kind: data_invariant
---

# REQ PORTS-025 — Manifest surface hygiene

Status: **Proposed** (2026-07-02)

## Statement

**If** a `module.manifest.yaml` under
`modules/platformkit-business-modules/*/` declares the retired
registrar surface (mentions `AdminRegistrar` or
`SettingsRegistrar`) and the module is not on the retired-surface
allowlist, **then** the manifest-hygiene gate **shall** fail the
build. The allowlist **shall** be shrink-only: entries may be
removed as manifests are cleaned, additions are forbidden, and a
stale entry — an allowlisted module whose manifest no longer
mentions the retired surface — **shall** itself fail the gate so
the allowlist stays honest. The allowlist is currently empty, so
any manifest mention of the retired registrar surface fails.

## Rationale

Module manifests are fleet truth projected from migrated code
(ADR-0048, the Go-authored catalog): downstream tooling — catalog
exports, composition validation, client overlays — trusts them as
an accurate description of what each module provides. A manifest
that still advertises `ports.AdminRegistrar` /
`ports.SettingsRegistrar` after the module's code moved to the
modern surface-contribution path is a second source of truth: it
tells the fleet a retired seam still exists, and consumers acting
on it wire against nothing.

The ratchet shape (shrink-only allowlist, mirroring the
code-level registrar-surface ratchet) is the mechanism
that makes the migration monotonic. Grandfathering existing debt
without permitting new debt is what lets the gate ship before the
cleanup finishes; the stale-entry check is what prevents the
allowlist from silently outliving the debt it excused. As of this
writing the allowlist has drained to empty — the gate is now a
hard prohibition.

## Acceptance criteria

- **AC-1** A `module.manifest.yaml` mentioning `AdminRegistrar`
  or `SettingsRegistrar` for a module not on the allowlist fails
  the gate with an actionable message naming the module and the
  ADR-0048 rationale.
- **AC-2** The allowlist is shrink-only and self-honest: an
  allowlisted module whose manifest no longer contains the retired
  strings is reported as a stale entry and fails the gate until
  removed.
- **AC-3** The allowlist is empty — every business-module
  manifest in the tree is currently free of the retired registrar
  surface, and any reintroduction fails immediately.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `modules/platformkit-business-modules/ports/manifest_hygiene_test.go::TestNoRetiredRegistrarManifestEntries` — the dirty-manifest branch. |
| AC-2 | Test | `modules/platformkit-business-modules/ports/manifest_hygiene_test.go::TestNoRetiredRegistrarManifestEntries` — the stale-allowlist branch of the same test. |
| AC-3 | Test | `modules/platformkit-business-modules/ports/manifest_hygiene_test.go::TestNoRetiredRegistrarManifestEntries` — `retiredRegistrarManifestAllowlist` is empty in source; the test enforces the resulting hard prohibition on every `*/module.manifest.yaml`. |

## Satisfied by

- [ADR 0009 — Ports-only cross-module communication](../adr/0009-ports-only-cross-module-communication.md) —
  the retired registrar surface is the pre-ports pattern this
  ratchet retires.
- ADR-0048 — Go-authored catalog and generated exports: manifests
  are projections of code, never independently authored truth
  (the decision the gate's error message cites).
- `modules/platformkit-business-modules/ports/manifest_hygiene_test.go` —
  the gate itself.

## Related requirements

- [REQ-PORTS-024 — Surface vocabulary authority](./REQ-PORTS-024-surface-vocabulary-authority.md) —
  the modern surface-contribution vocabulary modules migrated to.
- [REQ-006 — Forward-only migrations](./REQ-006-forward-only-migrations.md) —
  the sibling monotonicity discipline on the schema axis.

## References

- The code-level registrar-surface ratchet in the `ports` package —
  the counterpart (file budget, no new pre-ports consumers, retired
  ports stay retired) whose shrink-only
  discipline this manifest-layer gate mirrors.
