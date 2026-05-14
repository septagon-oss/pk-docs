---
id: REQ-CONTENT-001
title: "Articles feature persists tenant-scoped articles with rich content rendering and docs-style overrides"
status: Proposed
date: 2026-05-07
slug: req-content-001-articles
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
feature: articles
---

# REQ CONTENT-001 — Articles

Status: **Proposed** (2026-05-07)

## Statement

The articles feature **shall** persist a tenant-scoped article
record (slug, title, body, status, locale) and render it through
the platform's content pipeline (prose stylesheet, link rewriting,
docs-style overrides). Reads from public surfaces **shall** scope
to published articles only; admin reads **shall** see drafts.
Inter-article link rewriting **shall** rewrite docs-style relative
links to absolute platform URLs at render time.

## Rationale

Articles back the marketing site, the docs surface, and the in-app
help system. The discipline of stylesheet-as-data + link-rewriting
keeps the content rendering identical across surfaces without each
consumer re-implementing it. Public/draft visibility is the
editorial safety: a half-written article cannot accidentally appear
on the public site.

## Acceptance criteria

- **AC-1** Published reads scope to published articles only;
  draft reads require an admin-tier permission.
- **AC-2** Docs-style links (`./other-article` or
  `/docs/foo/bar`) are rewritten to platform-canonical URLs at
  render time.
- **AC-3** Stylesheet rendering is deterministic — the same
  article + stylesheet pair produces byte-identical output.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Inspection | Code review of `community_journal_stylesheet.go` + handler scoping. |
| AC-2 | Test | `pk-modules/content_management/features/articles/docs_link_rewrite_test.go::TestRewriteAdrCrossLinks`. |
| AC-3 | Test | `pk-modules/content_management/features/articles/community_journal_stylesheet_test.go::TestFallbackCommunityJournalPageUsesPageScopedStylesheet` + `docs_override_service_test.go`. |

## Implements (cross-cutting)

- REQ-001 — multi-tenant isolation.
- REQ-004 — audit per mutation.

## Satisfied by

- `content_management/features/articles/feature.go`
- `content_management/features/articles/article_prose_stylesheet.go`,
  `community_journal_stylesheet.go`, `community_journal_stylesheet_test.go`
- `content_management/features/articles/docs_article_body.go`,
  `docs_content_override.go`, `docs_link_rewrite_test.go`,
  `docs_override_service_test.go`

## Related requirements

- [REQ-CONTENT-002 — Categories](./REQ-CONTENT-002-categories.md)
