---
id: REQ-SITE-001
title: "Homepage feature renders the tenant-branded marketing site with content + assets"
status: Proposed
date: 2026-05-07
slug: req-site-001-homepage
category: tenancy
ears_pattern: ubiquitous
verification_methods: [test]
compliance: []
satisfied_by:
  adr: [ADR-0009]
  conventions: [C-04, C-14]
implements_cross_cutting: [REQ-001, REQ-011]
type: doc
tags: [requirement, feature, site]
module: site
feature: homepage
---

# REQ SITE-001 — Homepage

Status: **Proposed** (2026-05-07)

## Statement

The homepage feature **shall** render the public marketing
homepage for the requesting tenant — composing the tenant's
brand assets, the configured content blocks, and any client-pack
overrides into a single HTML response. Brand assets **shall**
resolve through the tenant's brand registry; missing assets
**shall** fall back to the platform default rather than 404.

## Rationale

The homepage is the first impression every visitor gets, and the
tenant brands it. The discipline of "always render something" is
the resilience property: a missing logo for a freshly-onboarded
tenant should not produce a broken page; it should fall back to
the platform default while the tenant uploads theirs.

## Acceptance criteria

- **AC-1** Tenant-specific brand assets render when present.
  Asset resolution uses `firstAvailableBrandAsset(values...)`
  which returns the first non-empty value in the supplied
  fallback chain. **Caller responsibility:** the platform default
  must be the last entry in the chain when a true fallback is
  required; an all-empty chain yields `""` and becomes a 404 at
  the redirect layer.
- **AC-2** Content blocks load from the tenant's content store
  (REQ-CONTENT-001) and render into the page.
- **AC-3** The handler is tenant-scoped — a request to one
  tenant's host renders that tenant's homepage, never another's.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `pk-modules/site/features/homepage/brand_assets_test.go::TestResolveBrandingUsesTenantOverlayAssets`. |
| AC-2 | Test | `pk-modules/site/features/homepage/content_loader_test.go::TestLoadHomepageContent_LocaleAndFallback`. |
| AC-3 | Test | `pk-modules/site/features/homepage/handler_test.go::TestNormalizePublicLink`. |

## Implements (cross-cutting)

- REQ-001 — multi-tenant isolation (per-tenant rendering).
- REQ-011 — design tokens (brand assets resolve via the token system).

## Satisfied by

- `pk-modules/site/features/homepage/feature.go`
- `pk-modules/site/features/homepage/brand_assets_test.go`,
  `content_loader.go`, `content_loader_test.go`
- `pk-modules/site/features/homepage/handler.go`, `handler_test.go`
- `pk-modules/site/features/homepage/client_manifest.go`,
  `color_defaults.go`

## Related requirements

- [REQ-SITE-002 — Demo](./REQ-SITE-002-demo.md)
- [REQ-CONTENT-001 — Articles](./REQ-CONTENT-001-articles.md)
