---
id: REQ-CONTENT-002
title: "Categories feature persists tenant-scoped article taxonomies"
status: Proposed
date: 2026-05-07
slug: req-content-002-categories
category: tenancy
ears_pattern: ubiquitous
verification_methods: [test]
compliance: []
satisfied_by:
  adr: [ADR-0009]
  conventions: [C-04, C-14]
implements_cross_cutting: [REQ-001, REQ-004]
type: doc
tags: [requirement, feature, content_management]
module: content_management
feature: categories
---

# REQ CONTENT-002 — Categories

Status: **Proposed** (2026-05-07)

## Statement

The categories feature **shall** persist tenant-scoped category
records (slug, name, parent, locale) used to organise articles
(REQ-CONTENT-001) into a navigation tree. Reads from public
surfaces **shall** scope to published categories with at least one
published article; admin reads see all.

## Rationale

Categories are the navigation surface — without them, a docs
section looks like a flat dump of pages. The discipline of
"published with at least one published article" is what keeps the
site's IA honest under partial publication.

## Acceptance criteria

- **AC-1** `Service::List` returns the persisted category records
  through the generic CRUD path; filter / pagination params are
  honoured.
- **AC-2** `Service::BuildNavigationTree(contentType)` returns a
  hierarchical tree by parent reference; a `contentType` filter
  scopes the tree to one content vertical.
- **AC-3** `Service::ValidateParent(candidateID, parentID)` rejects
  parent assignments that would create a cycle, returning
  `ErrCategoryCycle`. The walk uses a visited-set bound by row
  count so even a pre-existing corrupt graph cannot loop the
  validator.

## Known gaps

- **Public-vs-admin visibility is not service-enforced.**
  Reviewers verify the upstream HTTP layer scopes by status
  before calling into this service.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `modules/platformkit-business-modules/content_management/features/categories/service_test.go::TestService_List_DelegatesToGeneric`. |
| AC-2 | Test | `modules/platformkit-business-modules/content_management/features/categories/service_test.go::TestService_BuildNavigationTree_Success`, `TestService_BuildNavigationTree_NestedChildren`, `TestService_BuildNavigationTree_FiltersByContentType`, `TestService_BuildNavigationTree_NoContentTypeFilter`, `TestService_BuildNavigationTree_SortsByOrder`. |
| AC-3 | Test | `modules/platformkit-business-modules/content_management/features/categories/service_test.go::TestService_ValidateParent_RejectsSelfParent`, `TestService_ValidateParent_RejectsTransitiveCycle`, `TestService_ValidateParent_AcceptsAcyclicChain`. |

## Implements (cross-cutting)

- REQ-001 — multi-tenant isolation.
- REQ-004 — audit per mutation.

## Satisfied by

- `content_management/features/categories/feature.go`
- `content_management/features/categories/entity.go`,
  `service_test.go`
- `content_management/features/categories/handler.go`,
  `permissions.go`

## Related requirements

- [REQ-CONTENT-001 — Articles](./REQ-CONTENT-001-articles.md) — the records this taxonomy organises.
