---
id: REQ-CONTENT-014
title: "Category navigation tree builds an ordered hierarchy and rejects parent assignments that create cycles"
status: Proposed
date: 2026-05-08
slug: req-content-014-category-navigation
category: content
ears_pattern: ubiquitous
priority: must
risk: medium
verification_methods: [test]
compliance:
  - SOC2_CC8.1
  - ISO27001_A.18.1
satisfied_by:
  adr: [ADR-0009]
  conventions: [C-04, C-14]
implements_cross_cutting: [REQ-001, REQ-005]
refines: REQ-CONTENT-002
type: doc
tags: [requirement, capability, content_management, categories, navigation, tree]
module: content_management
feature: categories
capability: category_navigation
capability_kind: data_invariant
stakeholders:
  - tenant administrator (organises content)
  - public visitor (navigates by category)
  - content author (assigns articles to categories)
---

# REQ CONTENT-014 — Category navigation tree

Status: **Proposed** (2026-05-08)

## Statement

The categories feature **shall** expose two
operations:

1. **`BuildNavigationTree(contentType)`** —
   return a hierarchical
   `[]ports.ContentNavItem` tree built from
   the persisted category rows, optionally
   filtered to a content type. The tree
   **shall**:
   - Group categories by parent id (root =
     no parent);
   - Sort each level by the `Order` column
     ascending;
   - Recursively build child arrays;
2. **`ValidateParent(candidateID,
   candidateParentID)`** — refuse a parent
   assignment that would create a cycle.
   The check walks up the chain from
   `candidateParentID`; if it ever reaches
   `candidateID` (or hits a pre-existing
   cycle anywhere), the assignment is
   refused with the typed
   `ErrCategoryCycle`.

The validator **shall** also refuse
self-parent assignments (`candidateID ==
candidateParentID`).

## Rationale

Category trees are the public site's
navigation surface. Two properties:

1. **Cycle prevention is non-negotiable.** A
   cycle in the parent chain produces an
   infinite-recursion bug in the tree
   builder, and a malformed navigation menu
   in the UI. The validator runs before
   persistence; the recursive walk is
   bounded by row count so it cannot loop
   even if the persisted data already
   contains a cycle elsewhere.
2. **Ordered render is the UX
   contract.** Categories carry an `Order`
   column that the admin UI exposes for
   drag-to-reorder. The tree builder must
   honour the order at every level.

## Acceptance criteria

- **AC-1 — List delegates to generic
  service.** A `List(params)` call
  forwards to the wrapped CRUD service.
- **AC-2 — Build tree renders nested
  children.** A multi-level set of
  categories produces a tree whose
  children fields contain the
  appropriate sub-trees.
- **AC-3 — Build tree empty on no
  categories.** A tenant with zero
  category rows returns an empty tree.
- **AC-4 — Build tree handles nested
  children.** Three+ levels of nesting
  produce nested `Children` arrays
  recursively.
- **AC-5 — Build tree includes orphans.**
  Categories whose parent does not exist
  are included as root-level entries
  (the tree builder treats them as if
  they had no parent).
- **AC-6 — Build tree sorts by order.**
  Within a level, the children are
  ordered by `Order` ascending.
- **AC-7 — Build tree filters by
  content type.** A
  `BuildNavigationTree("blog")` returns
  only categories tagged with
  `contentType = blog`.
- **AC-8 — Build tree no filter returns
  all.** A `BuildNavigationTree("")`
  returns every category regardless of
  content type.
- **AC-9 — Build tree propagates list
  errors.** A CRUD-layer list failure
  returns the wrapped error.
- **AC-10 — Validate self-parent.** A
  `ValidateParent(id, id)` returns
  `ErrCategoryCycle`.
- **AC-11 — Validate transitive cycle.**
  A parent assignment that would create
  a multi-hop cycle is refused with
  `ErrCategoryCycle`.
- **AC-12 — Validate acyclic chain.** A
  parent assignment in a clean
  hierarchy succeeds.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `modules/platformkit-business-modules/content_management/features/categories/service_test.go::TestService_List_DelegatesToGeneric`. |
| AC-2 | Test | `modules/platformkit-business-modules/content_management/features/categories/service_test.go::TestService_BuildNavigationTree_Success`. |
| AC-3 | Test | `modules/platformkit-business-modules/content_management/features/categories/service_test.go::TestService_BuildNavigationTree_EmptyList`. |
| AC-4 | Test | `modules/platformkit-business-modules/content_management/features/categories/service_test.go::TestService_BuildNavigationTree_NestedChildren`. |
| AC-5 | Test | `modules/platformkit-business-modules/content_management/features/categories/service_test.go::TestService_BuildNavigationTree_OrphanedChildren`. |
| AC-6 | Test | `modules/platformkit-business-modules/content_management/features/categories/service_test.go::TestService_BuildNavigationTree_SortsByOrder`. |
| AC-7 | Test | `modules/platformkit-business-modules/content_management/features/categories/service_test.go::TestService_BuildNavigationTree_FiltersByContentType`. |
| AC-8 | Test | `modules/platformkit-business-modules/content_management/features/categories/service_test.go::TestService_BuildNavigationTree_NoContentTypeFilter`. |
| AC-9 | Test | `modules/platformkit-business-modules/content_management/features/categories/service_test.go::TestService_BuildNavigationTree_ListError`. |
| AC-10 | Test | `modules/platformkit-business-modules/content_management/features/categories/service_test.go::TestService_ValidateParent_RejectsSelfParent`. |
| AC-11 | Test | `modules/platformkit-business-modules/content_management/features/categories/service_test.go::TestService_ValidateParent_RejectsTransitiveCycle`. |
| AC-12 | Test | `modules/platformkit-business-modules/content_management/features/categories/service_test.go::TestService_ValidateParent_AcceptsAcyclicChain`. |

## Edge cases & unhappy paths

- **Pre-existing corruption.** If the
  persisted graph contains a cycle that
  doesn't pass through the candidate, the
  validator refuses anyway — the
  hierarchy is corrupt and any new
  assignment in the affected branch is
  unsafe.
- **Empty parent id.** Treated as "no
  parent" (root assignment); the validator
  short-circuits with nil.
- **Concurrent reparent.** Last-write-wins
  at the repository; two simultaneous
  reparents that would each be valid in
  isolation can produce a cycle. Future
  work: optimistic-locking on the
  repository write.
- **Performance on deep trees.** The
  validator walks at most `len(all)`
  steps; a 10k-row tenant produces a
  bounded walk.

## Risk

- **Likelihood:** Medium — every category
  reparent.
- **Impact:** Medium — a defective
  validator produces UI infinite-loop
  bugs.
- **Mitigations:** Bounded walk (visited
  set), self-parent rejection (AC-10),
  transitive cycle detection (AC-11).

## Implements (cross-cutting)

- **REQ-001 — Multi-tenant isolation.**
  Every category list is tenant-scoped.
- **REQ-005 — Fail-closed.** AC-10..AC-11
  refuse cycle-producing assignments.

## Compliance mapping

| Control | Coverage |
|---|---|
| SOC2 CC8.1 (Change management) | AC-10..AC-12 — controlled hierarchy mutations. |
| ISO27001 A.18.1 (Compliance) | AC-9 — repository errors propagate, never silently swallowed. |

## Satisfied by

- `modules/platformkit-business-modules/content_management/features/categories/service.go::List, BuildNavigationTree, ValidateParent, validateNoCycle`.

## Related requirements

- [REQ-CONTENT-002 — Categories umbrella](./REQ-CONTENT-002-categories.md)
- [REQ-CONTENT-010 — Article create](./REQ-CONTENT-010-article-create.md) — articles bind to categories.
