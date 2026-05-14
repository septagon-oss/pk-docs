---
id: REQ-ADMIN-003
title: "Default CRUD renderer feature provides the generic list/edit pages every CRUD-tagged entity uses"
status: Proposed
date: 2026-05-07
slug: req-admin-003-default-crud-renderer
category: governance
ears_pattern: ubiquitous
verification_methods: [test]
compliance: []
satisfied_by:
  adr: [ADR-0009]
  conventions: [C-04, C-14]
implements_cross_cutting: [REQ-002, REQ-011]
type: doc
tags: [requirement, feature, admin_management]
module: admin_management
feature: default_crud_renderer
---

# REQ ADMIN-003 — Default CRUD renderer

Status: **Proposed** (2026-05-07)

## Statement

The default CRUD renderer feature **shall** provide the generic
admin list-and-edit pages that every entity registered with the
`crud` feature flag uses. Renders **shall** reflect the entity's
field metadata (widget, category, validation, readonly status)
without per-entity templating. Modules that need a bespoke
renderer **shall** opt out by registering a `CustomRenderer` on
their feature builder.

## Rationale

Every business module ships entities; without a default renderer,
each module would re-implement the list-table and edit-form
templates. The discipline of metadata-driven rendering keeps a
single source of truth and saves the per-module boilerplate. The
opt-out path is what lets a module that needs a special UI do
that without forking the renderer.

## Acceptance criteria

- **AC-1** A `crud`-tagged entity renders correctly through the
  default renderer using only its field metadata.
- **AC-2** A module that registers a `CustomRenderer` overrides the
  default for its entities.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `pk-modules/admin_management/features/default_crud_renderer/renderer_test.go::TestRenderOverviewPageUsesLandingSurface`. |
| AC-2 | Inspection | Code review of the override-resolution path. |

## Implements (cross-cutting)

- REQ-002 — modules independently deployable.
- REQ-011 — design tokens (renders against the platform token system).

## Satisfied by

- `admin_management/features/default_crud_renderer/feature.go`
- `admin_management/features/default_crud_renderer/renderer.go`,
  `renderer_test.go`
- `admin_management/features/default_crud_renderer/permissions.go`

## Related requirements

- [REQ-ADMIN-001 — Admin](./REQ-ADMIN-001-admin.md) — the admin shell that consumes this renderer.
