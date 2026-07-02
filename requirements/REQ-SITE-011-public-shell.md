---
id: REQ-SITE-011
title: "Public-content shell falls back when overlay is missing and threads route-scoped + module-owned assets through every render"
status: Proposed
date: 2026-05-08
slug: req-site-011-public-shell
category: governance
ears_pattern: ubiquitous
priority: must
risk: medium
verification_methods: [test]
satisfied_by:
  adr: [ADR-0009]
  conventions: [C-04, C-14]
implements_cross_cutting: [REQ-014]
refines: REQ-SITE-001
type: doc
tags: [requirement, capability, site_management, homepage, public_shell]
module: site_management
feature: homepage
capability: public_shell
capability_kind: failure_mode
stakeholders:
  - tenant administrator (configures overlay templates)
  - public visitor (sees the rendered page)
  - operator (debugs missing brand markers)
---

# REQ SITE-011 — Public content shell

Status: **Proposed** (2026-05-08)

## Statement

The homepage feature **shall** render the public-content shell
through `RenderPublicContentShell(ctx, options)` that:

1. **Falls back** to the platform default shell when the
   overlay layer has not provided a custom document — the
   public visitor never sees a blank page just because the
   overlay manifest is missing;
2. Honours an explicit `splash` template selection when the
   options request it;
3. Honours an explicit named template when the options
   request it (the override path used by tenants with custom
   layouts);
4. Includes route-scoped stylesheets in the rendered shell
   so the page never depends on a global CSS bundle;
5. Includes module-owned page assets (per-module CSS / JS)
   declared by features that contribute to the page.

## Rationale

The public shell is the rendering substrate for every
public-facing tenant page (homepage, blog, docs). Three
properties:

1. **Overlay-missing fallback.** A deployment that has not
   yet seeded the overlay should still serve a working
   homepage rather than a 500 / blank page. The fallback
   discipline is REQ-014's graceful-degradation in this
   surface.
2. **Explicit-template override.** Tenants with bespoke
   layouts (splash pages, branded landing variants) can
   request a named template; the orchestrator picks it up
   without touching the default path.
3. **Per-route + per-module assets.** Stylesheets and
   scripts must arrive scoped to the page being rendered;
   a global bundle would force every page to ship the
   union of all features' CSS, regardless of relevance.

## Acceptance criteria

- **AC-1 — Fallback when overlay document missing.** A
  render against an overlay that has no document for
  the requested page falls back to the platform shell.
- **AC-2 — Splash template explicitly selected.** A
  render with `Template: splash` produces the splash
  shell.
- **AC-3 — Named template explicitly selected.** A
  render with `Template: <name>` produces the
  overlay-provided template.
- **AC-4 — Route-scoped stylesheets included.** The
  rendered shell carries the stylesheet declarations
  scoped to the rendered route.
- **AC-5 — Module-owned page assets included.** The
  shell carries the per-module CSS/JS that features
  contributed.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `modules/platformkit-business-modules/site_management/features/homepage/public_shell_test.go::TestRenderPublicContentShellFallsBackWhenOverlayDocumentIsMissing`. |
| AC-2 | Test | `modules/platformkit-business-modules/site_management/features/homepage/public_shell_test.go::TestRenderPublicContentShellUsesSplashTemplateWhenExplicitlySelected`. |
| AC-3 | Test | `modules/platformkit-business-modules/site_management/features/homepage/public_shell_test.go::TestRenderPublicContentShellUsesTemplateWhenExplicitlySelected`. |
| AC-4 | Test | `modules/platformkit-business-modules/site_management/features/homepage/public_shell_test.go::TestRenderSharedPublicPageIncludesRouteScopedStylesheets`. |
| AC-5 | Test | `modules/platformkit-business-modules/site_management/features/homepage/public_shell_test.go::TestRenderSharedPublicPageIncludesModuleOwnedPageAssets`. |

## Edge cases & unhappy paths

- **Overlay with malformed template.** Rendering errors
  surface as wrapped errors; the fallback path is
  documented as "no overlay" not "broken overlay".
- **Asset dedup.** Two modules contributing the same
  asset URL produce a single tag in the rendered
  shell.
- **Concurrent template registration.** Templates
  registered after fx-graph build are not visible;
  registration is build-time only.

## Risk

- **Likelihood:** High — every public render.
- **Impact:** Medium — defective shell either fails
  closed (visitor sees error) or leaks per-tenant
  layout to the wrong tenant.
- **Mitigations:** Fallback path (AC-1), explicit
  template override (AC-2, AC-3), route-scoped
  assets (AC-4, AC-5).

## Implements (cross-cutting)

- **REQ-014 — Graceful degradation.** AC-1 — overlay
  missing degrades to platform default.

## Satisfied by

- `modules/platformkit-business-modules/site_management/features/homepage/public_shell.go::RenderPublicContentShell, RenderSharedPublicPage`.

## Related requirements

- [REQ-SITE-001 — Homepage](./REQ-SITE-001-homepage.md)
- [REQ-SITE-010 — Content loader](./REQ-SITE-010-homepage-content-loader.md)
