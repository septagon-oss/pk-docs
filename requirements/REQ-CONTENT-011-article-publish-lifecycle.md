---
id: REQ-CONTENT-011
title: "Article publish stamps PublishedAt; unpublish reverts to draft and clears the timestamp"
status: Proposed
date: 2026-05-08
slug: req-content-011-article-publish-lifecycle
category: content
ears_pattern: state-driven
priority: must
risk: medium
verification_methods: [test]
compliance:
  - SOC2_CC8.1
  - ISO27001_A.18.1
satisfied_by:
  adr: [ADR-0009]
  conventions: [C-04, C-14]
implements_cross_cutting: [REQ-001, REQ-004]
refines: REQ-CONTENT-001
type: doc
tags: [requirement, capability, content_management, articles, publish, unpublish]
module: content_management
feature: articles
capability: article_publish_lifecycle
capability_kind: state_machine
stakeholders:
  - content author (toggles publish state)
  - tenant administrator (controls live content)
  - subscriber (consumes published feeds)
---

# REQ CONTENT-011 — Article publish lifecycle

Status: **Proposed** (2026-05-08)

## Statement

The articles feature **shall** expose three
publish-lifecycle operations:

1. **`PublishArticle(articleID)`** — read the
   article, set `Status = published`, stamp
   `PublishedAt = now`, and persist;
2. **`UnpublishArticle(articleID)`** — read the
   article, set `Status = draft`, clear
   `PublishedAt`, persist;
3. **`UpdateArticle(articleID, req)`** — apply
   the sparse partial DTO; when
   `req.Content` is non-nil, re-render the
   markdown to HTML so the cached
   `RenderedHTML` matches the new source.

`PublishArticle` against a missing article
returns the wrapped not-found error.
`UnpublishArticle` is the inverse and returns
the article to the draft state.

## Rationale

Publish-lifecycle is the gate between
authoring and audience exposure. Three
properties:

1. **PublishedAt as the timeline anchor.**
   The published-list filter and the RSS feed
   both consult `PublishedAt`. Without it,
   articles cannot be ordered by
   publication date or filtered to "live"
   content.
2. **Unpublish as a reversible state.**
   Mistakes happen (accidentally published,
   pulled for review). Unpublish lets the
   author take the article off the public
   feed without deleting it; subsequent
   re-publishing stamps a fresh timestamp.
3. **Re-render on content update.** The
   pre-rendered HTML must match the source.
   Updates that touch `Content` re-render at
   write time (mirroring REQ-CONTENT-010
   AC-3).

## Acceptance criteria

- **AC-1 — Publish stamps timestamp.** A
  `PublishArticle(id)` against a draft
  article sets `Status = published` and
  `PublishedAt = now`.
- **AC-2 — Publish on missing article.** A
  `PublishArticle` against a non-existent id
  returns the wrapped not-found error.
- **AC-3 — Unpublish reverts state.** An
  `UnpublishArticle(id)` flips
  `Status = draft` and clears `PublishedAt`.
- **AC-4 — Update sparse partial.** An
  `UpdateArticle` with only some fields set
  leaves the rest of the row untouched.
- **AC-5 — Update content re-renders
  markdown.** When `req.Content` is non-nil,
  the `RenderedHTML` field is regenerated.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `pk-modules/content_management/features/articles/service_test.go::TestService_PublishArticle_SetsPublishedAt`. |
| AC-2 | Test | `pk-modules/content_management/features/articles/service_test.go::TestService_PublishArticle_NotFound`. |
| AC-3 | Test | `pk-modules/content_management/features/articles/service_test.go::TestService_UnpublishArticle_RevertsToDraft`. |
| AC-4 | Test | `pk-modules/content_management/features/articles/service_test.go::TestService_UpdateArticle_PartialFields`. |
| AC-5 | Test | `pk-modules/content_management/features/articles/service_test.go::TestService_UpdateArticle_ContentReRendersMarkdown`. |

## Edge cases & unhappy paths

- **Republish.** A
  `PublishArticle` against an
  already-published article re-stamps
  `PublishedAt`; the timeline records the
  re-publication.
- **Unpublish on a draft.** Idempotent;
  `Status` is already draft, `PublishedAt`
  is already nil. The persist still happens.
- **Update of slug.** Allowed (it changes
  the URL); the repository's uniqueness
  constraint catches collisions.
- **Concurrent publish + update.**
  Last-write-wins; the audit ledger
  captures the actual transitions.

## Risk

- **Likelihood:** Medium — every authoring
  workflow.
- **Impact:** Medium — defective publish
  exposes drafts; defective unpublish
  leaves retracted content live.
- **Mitigations:** Status flip in single
  write (AC-1, AC-3), re-render on update
  (AC-5).

## Implements (cross-cutting)

- **REQ-001 — Multi-tenant isolation.**
  Every operation is tenant-scoped.
- **REQ-004 — Audit per mutation.** Each
  publish / unpublish emits the catalogued
  event.

## Compliance mapping

| Control | Coverage |
|---|---|
| SOC2 CC8.1 (Change management) | AC-1, AC-3 — controlled publication. |
| ISO27001 A.18.1 (Compliance) | AC-3 — retraction primitive. |

## Satisfied by

- `pk-modules/content_management/features/articles/service.go::PublishArticle, UnpublishArticle, UpdateArticle`.

## Related requirements

- [REQ-CONTENT-010 — Article create](./REQ-CONTENT-010-article-create.md)
- [REQ-CONTENT-012 — Article query](./REQ-CONTENT-012-article-query.md)
- [REQ-CONTENT-013 — RSS feed](./REQ-CONTENT-013-rss-feed.md)
