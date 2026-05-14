---
id: REQ-ADMIN-006
title: "Ecosystem search feature exposes a unified text search across modules' admin entities"
status: Proposed
date: 2026-05-07
slug: req-admin-006-ecosystem-search
category: governance
ears_pattern: ubiquitous
verification_methods: [test]
compliance: []
satisfied_by:
  adr: [ADR-0009]
  conventions: [C-04, C-14]
implements_cross_cutting: [REQ-001, REQ-002]
type: doc
tags: [requirement, feature, admin_management]
module: admin_management
feature: ecosystem_search
---

# REQ ADMIN-006 — Ecosystem search

Status: **Proposed** (2026-05-07)

## Statement

The ecosystem search feature **shall** expose a unified
admin-facing text search that returns results across every module
that has registered as a search contributor. Results **shall** be
tenant-scoped, ranked by relevance, and group by contributing
module so an operator can see at a glance which surface a hit came
from.

## Rationale

Operators navigate by name, not by URL — "show me everything that
mentions 'acme.bookings.demo'" should hit chat rooms, audit events,
mail items, and tenant settings without the operator knowing each
module's separate search endpoint exists. The contributor pattern
keeps the search loosely coupled — each module declares its
contribution, the unified surface aggregates.

## Acceptance criteria

- **AC-1** Each registered contributor's results include a
  module-id field for grouping.
- **AC-2** Results are tenant-scoped — a query in one tenant does
  not leak hits from another.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `pk-modules/admin_management/features/ecosystem_search/service_test.go::TestSearchHonorsTenantEnabledModules` covers grouping. |
| AC-2 | Test | `pk-modules/admin_management/features/ecosystem_search/service_test.go::TestSearchHonorsTenantEnabledModules` covers tenant scope. |

## Implements (cross-cutting)

- REQ-001 — multi-tenant isolation.
- REQ-002 — modules independently deployable.

## Satisfied by

- `admin_management/features/ecosystem_search/feature.go`
- `admin_management/features/ecosystem_search/contributors.go`,
  `helpers.go`, `service_test.go`
- `admin_management/features/ecosystem_search/handler.go`

## Related requirements

- [REQ-ADMIN-005 — Discovery](./REQ-ADMIN-005-discovery.md)
