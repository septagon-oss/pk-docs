---
id: REQ-ADMIN-001
title: "Admin feature derives the cross-module sidebar from each feature's declared AdminUI metadata"
status: Proposed
date: 2026-05-07
slug: req-admin-001-admin
category: governance
ears_pattern: ubiquitous
verification_methods: [test, inspection]
compliance: []
satisfied_by:
  adr: [ADR-0009]
  conventions: [C-04, C-14]
implements_cross_cutting: [REQ-002, REQ-016]
type: doc
tags: [requirement, feature, admin_management]
module: admin_management
feature: admin
---

# REQ ADMIN-001 — Admin

Status: **Proposed** (2026-05-07)

## Statement

The admin feature **shall** materialise the platform's admin
sidebar by walking the live FX module set, asking each feature
whose metadata declares an `AdminUI` block (with
`IncludeInSidebar: true`) what entries it contributes, and
composing those into a single `ModuleSurfaceContribution`. The
discovery + composition path **shall** be cached but
re-derivable; modules that register a dedicated
`AdminCapabilityProvider` take precedence so their
custom rendering does not double up with the auto-discovered
entries.

## Rationale

The admin sidebar is the cross-module composition point. Doing it
via "every feature declares its AdminUI metadata + the admin
module discovers and composes" means a new feature that ships an
admin section appears automatically — there is no hand-maintained
sidebar list to keep in sync. The de-duplication against
 dedicated providers lets the module-by-module admin
providers coexist with the auto-discovered surface during the
migration.

## Acceptance criteria

- **AC-1** Composition is FX-derived: `provider.go` walks the
  live module set via `discoveryService.DiscoverFeatures(ctx)`
  rather than reading a hand-maintained list. Adding a feature
  with `AdminUI` metadata surfaces it in the sidebar without any
  change to the admin feature.
- **AC-2** Modules whose admin is rendered by a dedicated
  `AdminCapabilityProvider` (registered through the platform's
  `adminRegistry`) are filtered out of the auto-discovery path so
  their custom render is the single source of truth for that
  module's sidebar entries.
- **AC-3** The composed `ModuleSurfaceContribution` is cached
  (`featureBasedAdminCache`) and invalidated when the registry
  reference changes (`SetAdminRegistry` increments
  `cacheVersion` and clears the cache).

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `pk-modules/admin_management/features/admin/provider_test.go::TestBuildSurfaceContributionFromPlansUsesExplicitSurfaceContracts` covers the discovery-driven composition. |
| AC-2 | Test | `pk-modules/admin_management/features/admin/provider_test.go::TestBuildSurfaceContributionFromPlansUsesExplicitSurfaceContracts` covers the registry-filter branch. |
| AC-3 | Inspection | `provider.go::SetAdminRegistry` and the `cacheMu` discipline — cache invalidation on registry change. |

## Implements (cross-cutting)

- REQ-002 — modules independently deployable (composition is
  declarative; modules opt in via metadata).
- REQ-016 — module composition is declarative via Fx (the
  underlying source of truth is the FX module set).

## Satisfied by

- `admin_management/features/admin/feature.go`
- `admin_management/features/admin/provider.go`,
  `provider_test.go`
- `admin_management/features/admin/permissions.go`

## Related requirements

- [REQ-ADMIN-002 — Dashboard](./REQ-ADMIN-002-dashboard.md) — the landing surface this composition powers.
- [REQ-ADMIN-005 — Discovery](./REQ-ADMIN-005-discovery.md) — the underlying discovery service.
