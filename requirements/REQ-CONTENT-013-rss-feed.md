---
id: REQ-CONTENT-013
title: "RSS feed renders valid XML for the published-article set with proper field escaping"
status: Proposed
date: 2026-05-08
slug: req-content-013-rss-feed
category: content
ears_pattern: ubiquitous
priority: should
risk: low
verification_methods: [test]
compliance:
  - ISO27001_A.18.1
satisfied_by:
  adr: [ADR-0009]
  conventions: [C-04, C-14]
implements_cross_cutting: [REQ-001]
refines: REQ-CONTENT-001
type: doc
tags: [requirement, capability, content_management, articles, rss, feed]
module: content_management
feature: articles
capability: rss_feed
capability_kind: data_invariant
stakeholders:
  - subscriber (RSS reader)
  - tenant administrator (configures feed metadata)
  - operator (debugs feed-render failures)
---

# REQ CONTENT-013 — RSS feed

Status: **Proposed** (2026-05-08)

## Statement

The articles feature **shall** expose
`Service.GenerateRSSFeed(tenantID, params)`
that:

1. Reads the published article set for the
   tenant via the same path as
   `ListPublished` (REQ-CONTENT-012);
2. Renders a valid RSS 2.0 XML document
   carrying the title, link, description,
   pubDate, and per-item guid for each
   article;
3. **XML-escapes** every text field so
   special characters (`&`, `<`, `>`, `"`,
   `'`) in titles or descriptions cannot
   produce malformed XML or XSS in
   subscriber clients.

The output **shall** be parseable by a
standard RSS 2.0 reader; downstream consumers
(feed aggregators, RSS-to-email bridges)
should not need custom parsing.

## Rationale

RSS is the platform's syndication contract.
Three properties:

1. **Valid XML at every byte.** A single
   unescaped `&` in a title produces a
   malformed feed that every reader will
   reject. The escape discipline is
   non-negotiable.
2. **RSS 2.0 not Atom.** The current contract
   is RSS 2.0; Atom is a documented future
   extension if subscriber demand surfaces.
3. **Tenant-scoped feeds.** Each tenant's feed
   is generated from its own article set; the
   tenant id is part of the input.

## Acceptance criteria

- **AC-1 — Feed renders valid XML.** A
  successful `GenerateRSSFeed` returns an XML
  document that parses cleanly under a
  standard RSS 2.0 parser.
- **AC-2 — Field escaping.** Titles or
  descriptions containing `&`, `<`, `>`,
  `"`, `'` produce XML-escaped output (no raw
  special characters in element text).

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `modules/platformkit-business-modules/content_management/features/articles/service_test.go::TestService_GenerateRSSFeed_ValidXML`. |
| AC-2 | Test | `modules/platformkit-business-modules/content_management/features/articles/service_test.go::TestService_GenerateRSSFeed_XmlEscaping`. |

## Edge cases & unhappy paths

- **Empty article set.** Produces a valid
  RSS document with zero `<item>` elements;
  the channel-level metadata is preserved.
- **Article with empty fields.** Empty
  title / description renders as empty
  elements; readers treat them as untitled.
- **Locale-specific feeds.** Currently the
  feed is locale-agnostic; future work may
  add per-locale feed paths
  (`/feed.{locale}.xml`).
- **Pagination.** RSS readers typically
  poll the feed root; the feed renders the
  most-recent N articles (the per-deployment
  page-size cap).

## Risk

- **Likelihood:** Low — exercised on each
  feed poll (typically minutes-to-hours
  cadence per subscriber).
- **Impact:** Low — defective feeds
  silently drop from subscribers' readers;
  no security implications.
- **Mitigations:** XML-escape discipline
  (AC-2) + structured XML render (AC-1).

## Implements (cross-cutting)

- **REQ-001 — Multi-tenant isolation.**
  Every feed is tenant-scoped.

## Compliance mapping

| Control | Coverage |
|---|---|
| ISO27001 A.18.1 (Compliance) | AC-2 — escape discipline prevents XSS injection through subscriber-rendered feeds. |

## Satisfied by

- `modules/platformkit-business-modules/content_management/features/articles/service.go::GenerateRSSFeed`.

## Related requirements

- [REQ-CONTENT-010 — Article create](./REQ-CONTENT-010-article-create.md)
- [REQ-CONTENT-011 — Article publish lifecycle](./REQ-CONTENT-011-article-publish-lifecycle.md)
- [REQ-CONTENT-012 — Article query](./REQ-CONTENT-012-article-query.md)
