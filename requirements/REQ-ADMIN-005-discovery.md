---
id: REQ-ADMIN-005
title: "Discovery feature exposes the runtime catalog of registered modules and their endpoints"
status: Proposed
date: 2026-05-07
slug: req-admin-005-discovery
category: governance
ears_pattern: ubiquitous
verification_methods: [test]
compliance: []
satisfied_by:
  adr: [ADR-0017]
  conventions: [C-14]
implements_cross_cutting: [REQ-016]
type: doc
tags: [requirement, feature, admin_management]
module: admin_management
feature: discovery
---

# REQ ADMIN-005 — Discovery

Status: **Proposed** (2026-05-07)

## Statement

The discovery feature **shall** expose admin endpoints that return
the runtime catalog of registered modules, their endpoint
declarations, their permission sets, and their dependency graph.
The data **shall** be derived from the live FX assembly rather than
a hand-maintained list, so a freshly-deployed module appears in
discovery output without a separate registration step.

## Rationale

Discovery is the operator's "what does this build contain?"
surface — invaluable when an incident lands and the on-caller
needs to know which modules are wired, which depend on which, and
which endpoints exist. Deriving from the FX assembly is the
load-bearing property: a stale discovery view defeats the point.

## Acceptance criteria

- **AC-1** The discovery endpoint reflects the live FX module set;
  adding a module to the catalog makes it visible without code
  changes to discovery itself.
- **AC-2** Per-module output includes endpoints, permissions, and
  declared dependencies.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `pk-modules/admin_management/features/discovery/service_test.go::TestBuildRoutePlanUsesCanonicalEntityRoute` covers live-derived catalog reads. |
| AC-2 | Test | `pk-modules/admin_management/features/discovery/service_test.go::TestBuildRoutePlanUsesCanonicalEntityRoute` covers the per-module output shape. |

## Implements (cross-cutting)

- REQ-016 — module composition is declarative (discovery reads from the FX graph).

## Satisfied by

- `admin_management/features/discovery/feature.go`
- `admin_management/features/discovery/service.go`,
  `service_test.go`
- `admin_management/features/discovery/permissions.go`,
  `routes.go`

## Related requirements

- [REQ-ADMIN-006 — Ecosystem search](./REQ-ADMIN-006-ecosystem-search.md)
