---
id: REQ-ADMIN-015
title: "Discovery route plans assemble per-feature landing routes from canonical entity routes and grouped menu items"
status: Proposed
date: 2026-05-08
slug: req-admin-015-discovery-route-plan
category: governance
ears_pattern: ubiquitous
priority: must
risk: medium
verification_methods: [test]
satisfied_by:
  adr: [ADR-0009]
  conventions: [C-04, C-14]
implements_cross_cutting: [REQ-002]
refines: REQ-ADMIN-005
type: doc
tags: [requirement, capability, admin_management, discovery, route_plan]
module: admin_management
feature: discovery
capability: discovery_route_plan
capability_kind: data_invariant
stakeholders:
  - module developer (registers feature entities)
  - admin shell (renders the menu)
  - operator (debugs missing menu items)
---

# REQ ADMIN-015 — Discovery route plans

Status: **Proposed** (2026-05-08)

## Statement

The discovery feature **shall** transform the registered
feature-entity catalog into a route plan that the admin shell
renders as the navigation menu. The plan **shall**:

1. Use the **canonical entity route** (the
   `module.entity` route shape) for every feature that does
   not declare a custom landing path;
2. Assign each plan a landing route + canonical section ids
   so the section renderer (REQ-ADMIN-008) resolves the
   right section on every navigation;
3. Use the table name as the **plural-title fallback**
   when the feature does not declare a plural title (e.g.,
   "Articles" from `articles` table);
4. **Group repeated module titles** when several plans
   share the same module — the resulting menu has one
   entry per module with grouped children;
5. Honour an explicit `menu_parent` declaration when the
   feature wants to nest under a different parent than its
   own module;
6. Build a standalone menu item using the landing-page
   route when the feature is a standalone surface (no
   entity catalog).

The transformation **shall** tolerate calls without a
context (`appcontext`) — the discovery service is invoked
both from the admin shell and from build-time tooling.

## Rationale

The route-plan abstraction is the boundary between
"feature registers entities" (producer) and "admin shell
shows menu" (consumer). Three properties:

1. **Canonical-route-by-default.** Without the canonical
   default, every feature would have to declare its own
   landing path — a recipe for inconsistency. The default
   keeps the URL convention predictable.
2. **Plural-title fallback to table name.** Operators
   shouldn't see "article" in the singular when the
   feature lists many; the table name is the universal
   fallback.
3. **Group-by-module reduces clutter.** A module with
   six features should produce one menu entry with six
   children, not six top-level entries.

## Acceptance criteria

- **AC-1 — Canonical entity route used.** A plan for a
  feature that has not declared a landing route uses the
  canonical `<module>/<entity>` route.
- **AC-2 — Plans build without a context.** The
  discovery service does not panic when called outside
  a request context.
- **AC-3 — Landing route + canonical section ids
  assigned.** Each plan's landing route and section
  ids match the section-renderer's resolution rules.
- **AC-4 — Plural-title fallback.** A feature without
  a plural title gets the table name as the menu
  label.
- **AC-5 — Repeated module titles grouped.** Several
  plans sharing the same module produce a single
  grouped menu entry with the children nested.
- **AC-6 — Explicit menu parent honoured.** A feature
  declaring `menu_parent: foo` nests under that
  parent rather than its own module.
- **AC-7 — Standalone menu item.** A feature with a
  landing-page route only (no entities) produces a
  standalone menu item.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `pk-modules/admin_management/features/discovery/service_test.go::TestBuildRoutePlanUsesCanonicalEntityRoute`. |
| AC-2 | Test | `pk-modules/admin_management/features/discovery/service_test.go::TestBuildRoutePlansDoesNotPanicWithoutContext`. |
| AC-3 | Test | `pk-modules/admin_management/features/discovery/service_test.go::TestBuildRoutePlanAssignsLandingRouteAndCanonicalSectionIDs`. |
| AC-4 | Test | `pk-modules/admin_management/features/discovery/service_test.go::TestFeatureEntityPluralTitleUsesTableNameAsPluralFallback`. |
| AC-5 | Test | `pk-modules/admin_management/features/discovery/service_test.go::TestBuildMenuItemsFromPlansGroupsRepeatedModuleTitles`. |
| AC-6 | Test | `pk-modules/admin_management/features/discovery/service_test.go::TestBuildMenuItemsFromPlansSupportsExplicitMenuParent`. |
| AC-7 | Test | `pk-modules/admin_management/features/discovery/service_test.go::TestBuildStandaloneMenuItemUsesLandingPageRoute`. |

## Edge cases & unhappy paths

- **Feature with zero entities and no landing.** Not
  surfaced in the menu (nothing to point at).
- **Conflicting menu_parent.** Resolved deterministically
  by registration order; the first declaration wins.
  Documented.
- **Module disabled for tenant.** Filtered upstream
  (in `BuildAdminAreas`); the discovery service does
  not gate.

## Risk

- **Likelihood:** Medium — boot-time + every menu
  refresh.
- **Impact:** Medium — defective route plans either
  hide features or create broken navigation.
- **Mitigations:** Canonical-route-by-default (AC-1),
  context-free callability (AC-2), per-feature test
  coverage on grouping (AC-5, AC-6).

## Implements (cross-cutting)

- **REQ-002 — Modules independently deployable.** The
  route-plan abstraction is the shape that lets each
  module register without coupling to the shell.

## Satisfied by

- `pk-modules/admin_management/features/discovery/service.go::BuildRoutePlan, BuildRoutePlans, BuildMenuItemsFromPlans, BuildStandaloneMenuItem`.

## Related requirements

- [REQ-ADMIN-005 — Discovery](./REQ-ADMIN-005-discovery.md)
- [REQ-ADMIN-008 — Profile](./REQ-ADMIN-008-profile.md)
- [REQ-002 — Modules independently deployable](./REQ-002-independently-deployable-modules.md)
