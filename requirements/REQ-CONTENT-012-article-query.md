---
id: REQ-CONTENT-012
title: "Article query supports lookup by slug, list of published, and per-locale filtering for the public surface"
status: Proposed
date: 2026-05-08
slug: req-content-012-article-query
category: content
ears_pattern: ubiquitous
priority: must
risk: medium
verification_methods: [test]
compliance:
  - SOC2_CC6.7
  - ISO27001_A.13.2
satisfied_by:
  adr: [ADR-0009]
  conventions: [C-04, C-14]
implements_cross_cutting: [REQ-001]
refines: REQ-CONTENT-001
type: doc
tags: [requirement, capability, content_management, articles, query]
module: content_management
feature: articles
capability: article_query
capability_kind: data_invariant
stakeholders:
  - public visitor (reads articles by URL)
  - admin UI (lists articles)
  - subscriber (RSS / Atom)
---

# REQ CONTENT-012 — Article query

Status: **Proposed** (2026-05-08)

## Statement

The articles feature **shall** expose three read
paths the public surface depends on:

1. **`GetBySlug(tenantID, slug)`** — find the
   article whose `(tenant_id, slug)` matches;
   return the typed entity when found,
   `(nil, ErrNotFound)` when missing;
2. **`ListPublished(tenantID, params)`** — return
   articles whose `Status = published` for the
   tenant, ordered by `PublishedAt` desc;
3. **`ListPublishedByLocale(tenantID, locale,
   params)`** — variant of `ListPublished` that
   adds the locale filter, used by locale-aware
   public surfaces (per-language blog index,
   localised docs).

The public-handler surface (REQ-CONTENT-014)
**shall** consume these read paths to render
the per-tenant content site.

## Rationale

Public-surface read paths are the highest-volume
consumers of article data; correctness here
shows up immediately to visitors. Three
properties:

1. **Slug-as-URL contract.** The slug is the
   stable URL identifier for an article;
   GetBySlug is the canonical lookup. Lookups
   by id are admin-only.
2. **Published-only on the public list.**
   Drafts must not leak to the public surface.
   The `Status = published` filter is the
   load-bearing gate; tests verify the filter
   returns only published rows.
3. **Locale parity with create.** Articles
   declared their locale at create time
   (REQ-CONTENT-010 AC-8); the locale-aware
   list is the read-side counterpart.

## Acceptance criteria

- **AC-1 — Get by slug returns the article.**
  A `GetBySlug(tenantID, slug)` for a
  persisted article returns the typed entity.
- **AC-2 — Get by slug not-found.** A
  `GetBySlug` against a missing slug returns
  `(nil, ErrNotFound)`.
- **AC-3 — List published filters correctly.**
  A `ListPublished(tenantID, ...)` returns
  only articles whose `Status = published`;
  drafts are excluded.
- **AC-4 — List published by locale.** A
  `ListPublishedByLocale(tenantID, "pt", ...)`
  returns only `published` articles whose
  locale matches `pt`.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `modules/platformkit-business-modules/content_management/features/articles/service_test.go::TestService_GetBySlug_Found`. |
| AC-2 | Test | `modules/platformkit-business-modules/content_management/features/articles/service_test.go::TestService_GetBySlug_NotFound`. |
| AC-3 | Test | `modules/platformkit-business-modules/content_management/features/articles/service_test.go::TestService_ListPublished_FiltersCorrectly`. |
| AC-4 | Test | `modules/platformkit-business-modules/content_management/features/articles/service_test.go::TestService_ListPublishedByLocale_FiltersCorrectly`. |

## Edge cases & unhappy paths

- **Slug case-sensitivity.** Slugs are
  persisted lower-case at create time;
  lookup matches are case-sensitive at the
  DB layer (the slug helper normalises
  upstream).
- **Cross-tenant slug collision.** Two
  tenants can have the same slug; the
  lookup is tenant-scoped so each tenant's
  visitor sees only their own article.
- **Empty params.** Defaults to the
  per-deployment page size; the underlying
  CRUD service caps the upper bound.
- **Pagination across pages.** The
  pagination helpers
  (`docs_pagination_test.go`) cover
  multi-page traversal end-to-end:
  `TestListAllPublishedDocs_SinglePage`,
  `TestListAllPublishedDocs_PaginatesPastPageSize`,
  `TestListAllPublishedDocs_StopsOnShortBatch`,
  `TestListAllPublishedDocs_ErrorOnLaterPage`,
  `TestListAllPublishedDocs_CircuitBreaker`.

## Risk

- **Likelihood:** High — every public read.
- **Impact:** Medium — defective filter
  leaks drafts; defective lookup breaks
  inbound URLs.
- **Mitigations:** Status filter (AC-3),
  locale filter (AC-4), tenant scope on
  every read.

## Implements (cross-cutting)

- **REQ-001 — Multi-tenant isolation.**
  Every read path is tenant-scoped.

## Compliance mapping

| Control | Coverage |
|---|---|
| SOC2 CC6.7 (Restrict information access) | AC-3 — drafts excluded from public surface. |
| ISO27001 A.13.2 (Information transfer) | AC-3 — only published content delivered to public visitors. |

## Satisfied by

- `modules/platformkit-business-modules/content_management/features/articles/service.go::GetBySlug, ListPublished, ListPublishedByLocale`.
- `modules/platformkit-business-modules/content_management/features/articles/docs_pagination.go::ListAllPublishedDocs` — the pagination harness.

## Related requirements

- [REQ-CONTENT-001 — Articles umbrella](./REQ-CONTENT-001-articles.md)
- [REQ-CONTENT-010 — Article create](./REQ-CONTENT-010-article-create.md)
- [REQ-CONTENT-011 — Article publish lifecycle](./REQ-CONTENT-011-article-publish-lifecycle.md)
- [REQ-CONTENT-013 — RSS feed](./REQ-CONTENT-013-rss-feed.md)
