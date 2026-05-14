---
id: REQ-SITE-010
title: "Homepage content loader resolves locale + profile and refuses non-product profiles that bypass the overlay"
status: Proposed
date: 2026-05-08
slug: req-site-010-homepage-content-loader
category: governance
ears_pattern: ubiquitous
priority: must
risk: medium
verification_methods: [test]
satisfied_by:
  adr: [ADR-0009]
  conventions: [C-04, C-14]
implements_cross_cutting: [REQ-001, REQ-005]
refines: REQ-SITE-001
type: doc
tags: [requirement, capability, site_management, homepage, content_loader]
module: site_management
feature: homepage
capability: content_loader
capability_kind: data_invariant
stakeholders:
  - tenant administrator (configures homepage profile)
  - operator (debugs missing homepage content)
  - end-user (sees the rendered homepage)
---

# REQ SITE-010 — Homepage content loader

Status: **Proposed** (2026-05-08)

## Statement

The homepage feature **shall** expose
`LoadHomepageContent(profileID, locale)` that:

1. Resolves the requested locale, falling back to the
   configured default when the requested locale is not
   available;
2. For the `default` profile, returns the platform-default
   homepage content (which **shall** include the
   join-CTA href);
3. Refuses to return content for an unknown profile id with
   the typed error;
4. Refuses to return content for **non-product profiles**
   that have not been provided through the overlay layer —
   non-product profiles are tenant-specific and must come
   from the overlay seeder, not the platform default.

## Rationale

The homepage is the platform's first user-facing surface;
the loader's three branches (default profile, custom
overlay profile, and refusal of unsupported profiles) are
the discipline that keeps tenant brands separated. Two
properties:

1. **Default profile is platform-owned.** Every
   deployment ships with the `default` profile so an
   un-customised tenant has a sensible homepage out of
   the box.
2. **Non-product profiles must come from the overlay.**
   A tenant-specific profile (e.g., a custom layout for
   a specific cowork brand) lives in the overlay
   manifest. The loader refuses to produce content for
   such profiles when the overlay hasn't supplied it,
   so a misconfigured deployment fails loudly rather
   than silently rendering the platform default in a
   place where the tenant expects their custom layout.

## Acceptance criteria

- **AC-1 — Locale resolution + fallback.** A
  `LoadHomepageContent("default", "pt")` against an
  overlay that has Portuguese returns the Portuguese
  copy; the same call against an overlay without
  Portuguese falls back to the configured default
  locale.
- **AC-2 — Default profile includes the join CTA.** The
  default profile's resolved content has a non-empty
  `JoinHref` field.
- **AC-3 — Unknown profile refused.** A
  `LoadHomepageContent("not-a-real-profile", ...)`
  returns the typed unknown-profile error.
- **AC-4 — Non-product profile must come from
  overlay.** A request for a non-product profile id
  that the overlay has not registered returns the
  typed error rather than the platform default.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `pk-modules/site_management/features/homepage/content_loader_test.go::TestLoadHomepageContent_LocaleAndFallback`. |
| AC-2 | Test | `pk-modules/site_management/features/homepage/content_loader_test.go::TestLoadHomepageContent_DefaultProfileIncludesJoinHref`. |
| AC-3 | Test | `pk-modules/site_management/features/homepage/content_loader_test.go::TestLoadHomepageContent_UnknownProfileFails`. |
| AC-4 | Test | `pk-modules/site_management/features/homepage/content_loader_test.go::TestLoadHomepageContent_NonProductProfilesMustComeFromOverlay`. |

## Edge cases & unhappy paths

- **Locale missing on a profile that exists.** The
  fallback locale is configured per profile; falling
  back to a third locale is not supported (an explicit
  fallback chain would create cycles).
- **Overlay not yet loaded.** The loader treats this
  as no overlay; default-profile requests succeed,
  non-product-profile requests fail.
- **Profile manifest with an empty content tree.**
  Currently allowed; the renderer produces a blank
  homepage. Operators should validate the manifest
  before deploying.

## Risk

- **Likelihood:** High — every public homepage render.
- **Impact:** High — defective loader either renders
  the wrong tenant's homepage or shows a blank page.
- **Mitigations:** Overlay-required-for-non-product
  (AC-4), unknown-profile refusal (AC-3),
  default-includes-join (AC-2).

## Implements (cross-cutting)

- **REQ-001 — Multi-tenant isolation.** AC-4 — overlay
  scoping prevents cross-tenant leak.
- **REQ-005 — Fail-closed.** AC-3, AC-4 — refused
  rather than silently substituted.

## Satisfied by

- `pk-modules/site_management/features/homepage/content_loader.go::LoadHomepageContent`.

## Related requirements

- [REQ-SITE-001 — Homepage](./REQ-SITE-001-homepage.md)
- [REQ-SITE-011 — Public shell rendering](./REQ-SITE-011-public-shell.md)
