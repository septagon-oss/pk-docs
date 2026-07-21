---
id: REQ-ADMIN-002
title: "Dashboard feature renders the admin landing page with module-contributed widgets and entity catalogue"
status: Proposed
date: 2026-05-07
slug: req-admin-002-dashboard
category: governance
ears_pattern: ubiquitous
verification_methods: [test]
compliance: []
satisfied_by:
  adr: [ADR-0009]
  conventions: [C-04, C-14]
implements_cross_cutting: [REQ-002, REQ-009]
type: doc
tags: [requirement, feature, admin_management]
module: admin_management
feature: dashboard
---

# REQ ADMIN-002 — Dashboard

Status: **Proposed** (2026-05-07)

## Statement

The dashboard feature **shall** render the admin landing page —
the first thing an admin sees on login — by composing
module-contributed widgets and the entity catalogue (every CRUD
entity each module has registered). Widget order and visibility
**shall** respect the requesting user's permission set.

## Rationale

The dashboard is the entry point — it should give an admin a
useful overview without them having to know which modules exist.
The discipline of "compose from registrations" mirrors REQ-ADMIN-001;
permission filtering keeps an admin from seeing widgets for surfaces
they cannot reach.

## Acceptance criteria

- **AC-1** Widgets render only for users whose permission set
  satisfies the widget's declared requirement.
- **AC-2** The entity catalogue lists every CRUD entity registered
  via the helper.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Inspection | Code review of `dashboard/handler.go` permission filtering. |
| AC-2 | Test | `pk-modules/admin_management/features/dashboard/entity_catalog_test.go::TestEntityCatalogBuilder_BuildUsesCanonicalModuleRoute`. |

## Implements (cross-cutting)

- REQ-002 — modules independently deployable.
- REQ-009 — observability (the dashboard surfaces health + activity rollups).

## Satisfied by

- `admin_management/features/dashboard/feature.go`
- `admin_management/features/dashboard/entity_catalog.go`,
  `entity_catalog_test.go`
- `admin_management/features/dashboard/handler.go`

## Related requirements

- [REQ-ADMIN-001 — Admin](./REQ-ADMIN-001-admin.md)
