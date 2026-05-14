---
id: REQ-CONTENT-010
title: "Article create renders markdown to HTML at write-time, preserves Mermaid fences, and enforces a locale"
status: Proposed
date: 2026-05-08
slug: req-content-010-article-create
category: content
ears_pattern: event-driven
priority: must
risk: medium
verification_methods: [test]
compliance:
  - SOC2_CC7.2
  - ISO27001_A.18.1
satisfied_by:
  adr: [ADR-0009]
  conventions: [C-04, C-14]
implements_cross_cutting: [REQ-001, REQ-009]
refines: REQ-CONTENT-001
type: doc
tags: [requirement, capability, content_management, articles, create, markdown]
module: content_management
feature: articles
capability: article_create
capability_kind: data_invariant
stakeholders:
  - content author (creates blog posts, docs)
  - tenant administrator (publishes content)
  - operator (debugs render failures)
---

# REQ CONTENT-010 — Article create

Status: **Proposed** (2026-05-08)

## Statement

**When** a caller invokes
`Service.CreateArticle(req)`, the articles feature
**shall**:

1. Validate that `req.Locale` is non-empty (the
   article must declare its locale at write-time
   for the published-list filter and the RSS feed);
2. Generate a slug from the title when
   `req.Slug` is empty, otherwise preserve the
   caller's slug verbatim;
3. Render the markdown source to HTML at write
   time and store both fields side-by-side
   (`Content` for raw, `RenderedHTML` for the
   pre-rendered output);
4. Preserve Mermaid fence blocks (` ```mermaid `)
   in the rendered output so the client-side
   diagram runtime can interpret them at display
   time — Mermaid fences are not collapsed to
   `<pre>` blocks;
5. Persist the row with the supplied `Status`
   when explicit (e.g., `published`); default to
   `draft` when blank;
6. Persist tags and metadata maps verbatim;
7. Refuse with the typed validation error when
   the `Content` is empty.

## Rationale

Articles are the platform's content surface for
docs, blog posts, and marketing copy. Rendering
markdown at write-time (rather than read-time)
trades disk for CPU savings on every page-render
and keeps the rendered output consistent across
the article's lifetime even if the markdown
renderer changes. Three properties:

1. **Locale required.** Multi-locale tenants
   filter articles per request locale; an
   article without a locale would be invisible
   to the locale-aware reader. The
   write-time refusal is the discipline.
2. **Mermaid passthrough.** Diagrams are
   client-side rendered; collapsing the fence
   to a `<pre>` block would lose the diagram.
   The renderer-level branch is the documented
   carve-out.
3. **Slug stability.** A caller-supplied slug is
   the URL contract; auto-generation is for
   the convenience case (no caller-supplied
   slug), but renaming a slug changes the URL
   and breaks inbound links.

## Acceptance criteria

- **AC-1 — Happy path persists + renders.** A
  successful `CreateArticle` persists the row
  with `Content` (raw markdown) and
  `RenderedHTML` (pre-rendered output) populated.
- **AC-2 — Caller slug preserved.** A
  caller-supplied `Slug` is persisted verbatim;
  no auto-generation overrides it.
- **AC-3 — Markdown rendered at write-time.**
  The `RenderedHTML` field carries the rendered
  output; subsequent reads do not re-render.
- **AC-4 — Mermaid fence preserved.** A
  ` ```mermaid` block in the source is preserved
  in the rendered output so the client-side
  diagram runtime can render it.
- **AC-5 — Empty content refused.** A request
  with empty `Content` returns the typed
  validation error.
- **AC-6 — Tags persisted.** Tags supplied as a
  string slice are persisted as JSON.
- **AC-7 — Status preserved when explicit.** A
  request with `Status = published` persists
  with `published`; an empty status defaults to
  `draft`.
- **AC-8 — Locale required.** A request with
  empty `Locale` returns the typed
  `locale required` error.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `pk-modules/content_management/features/articles/service_test.go::TestService_CreateArticle_Success`. |
| AC-2 | Test | `pk-modules/content_management/features/articles/service_test.go::TestService_CreateArticle_PreservesExistingSlug`. |
| AC-3 | Test | `pk-modules/content_management/features/articles/service_test.go::TestService_CreateArticle_MarkdownRendering`. |
| AC-4 | Test | `pk-modules/content_management/features/articles/service_test.go::TestMarkdownRenderer_PreservesMermaidFenceLanguage`. |
| AC-5 | Test | `pk-modules/content_management/features/articles/service_test.go::TestService_CreateArticle_EmptyContent`. |
| AC-6 | Test | `pk-modules/content_management/features/articles/service_test.go::TestService_CreateArticle_WithTags`. |
| AC-7 | Test | `pk-modules/content_management/features/articles/service_test.go::TestService_CreateArticle_PreservesStatus`. |
| AC-8 | Test | `pk-modules/content_management/features/articles/service_test.go::TestService_CreateArticle_RequiresLocale`. |

## Edge cases & unhappy paths

- **Slug generation collision.** The
  auto-generator produces deterministic slugs
  from titles; two articles with the same title
  produce the same slug; the repository's
  uniqueness constraint catches the duplicate.
- **Markdown rendering failure.** Rendering
  errors propagate as wrapped errors; the row
  is not persisted.
- **Locale normalisation.** The
  `OptionalNormalizedContentLocale` helper
  lower-cases and trims; verified by
  `TestOptionalNormalizedContentLocale`.
- **Slug helper coverage.** `TestService_GenerateSlug`
  exercises the auto-generation path.
- **Cross-tenant collisions.** The slug
  uniqueness is per-tenant; two tenants can
  have the same slug.

## Risk

- **Likelihood:** Medium — exercised on every
  content authoring action.
- **Impact:** Medium — defective rendering
  produces broken pages; defective slug
  generation breaks URL contracts.
- **Mitigations:** Write-time rendering (AC-3),
  Mermaid passthrough (AC-4), locale
  enforcement (AC-8).

## Implements (cross-cutting)

- **REQ-001 — Multi-tenant isolation.** Every
  article is tenant-scoped via the request
  context.
- **REQ-009 — Observability.** The CRUD
  service's tracing wraps every create.

## Compliance mapping

| Control | Coverage |
|---|---|
| SOC2 CC7.2 (System monitoring) | AC-1 — every article has a persisted record. |
| ISO27001 A.18.1 (Compliance with legal requirements) | AC-7 — controlled status lifecycle. |

## Satisfied by

- `pk-modules/content_management/features/articles/service.go::CreateArticle, GenerateSlug`.

## Related requirements

- [REQ-CONTENT-001 — Articles umbrella](./REQ-CONTENT-001-articles.md)
- [REQ-CONTENT-011 — Article publish lifecycle](./REQ-CONTENT-011-article-publish-lifecycle.md)
- [REQ-CONTENT-012 — Article query](./REQ-CONTENT-012-article-query.md)
- [REQ-CONTENT-013 — RSS feed](./REQ-CONTENT-013-rss-feed.md)
