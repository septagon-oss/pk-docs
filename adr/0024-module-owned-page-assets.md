---
title: "ADR 0024: Page assets are module-owned and loaded by declaration"
status: Proposed
date: 2026-04-27
slug: adr-0024-module-owned-page-assets
adr_topic: frontend-architecture
type: doc
tags: [adr, frontend, assets, modules, design-system]
---

# ADR 0024 — Page assets are module-owned and loaded by declaration

Status: **Proposed** (2026-04-27)

## The problem

PlatformKit already has design tokens, a shared frontend shell, and a module
browser asset registry. The weak point was the last mile: route-specific CSS and
JavaScript could still be passed around as raw URLs or inline blobs.

That made ownership blurry. A page could depend on
`/assets/modules/content_management/css/docs.css`, but the public shell only saw
an opaque URL. It could not tell which module owned the file, whether the asset
should be cache-busted through the registry, or whether the asset was being
loaded on a page that actually needed it.

The same failure mode encouraged homepage renderers to accumulate large
one-off CSS strings. Tokens normalized values, but the cascade and loading model
still felt ad hoc.

## The decision

Public pages declare browser assets by module ownership, not by hand-built URLs.

The public page contract exposes typed page asset declarations:

```go
type PublicPageAsset struct {
    ModuleID string
    Path     string
}
```

Pages attach module assets through `PublicPageOptions.ModuleStylesheets` and
`PublicPageOptions.ModuleScripts`. The concrete site shell resolves those
declarations through the module browser asset registry, which provides the
public `/assets/modules/<module>/...` URL and content-hash cache busting when
the module has registered embedded browser assets.

The loading order is:

1. Shared shell CSS and runtime.
2. Overlay shell assets, when a tenant overlay is active.
3. Module-owned page stylesheets.
4. Legacy extra stylesheet URLs, only for non-module escape hatches.
5. Tenant route stylesheet overrides.
6. Overlay scripts.
7. Legacy extra classic scripts.
8. Module-owned page ES modules.
9. The site shell controller.

This keeps module behavior local while preserving tenant customization. A docs
page loads docs CSS. A community journal page loads journal CSS. Other public
pages do not pay for either.

## Consequences

- Business modules own their browser assets under `browser/css` and
  `browser/js`.
- Shared shell code does not import concrete feature packages to discover CSS.
  The rendering module declares its exact page needs at the port boundary.
- Raw `ExtraStylesheetURLs` and `ExtraScriptURLs` remain as escape hatches for
  overlay or external assets, not as the default module path.
- Token CSS remains the value source. Module CSS must consume design tokens via
  CSS custom properties instead of hard-coded visual values.
- The base stylesheet can stay small because route chrome moves into module
  files and loads only on routes that render that surface.

## Enforcement

- Module assets should be embedded from the owning module's `browser/` tree and
  registered with `moduleassets.MustRegisterBrowserAssets`.
- Public page renderers should use `ModuleStylesheets` and `ModuleScripts` for
  module-owned assets.
- Tests should assert that route-owned CSS and JS are present only on pages that
  declare them.
- Future linting should reject hand-built `/assets/modules/...` strings in page
  options when a `PublicPageAsset` declaration can be used instead.

## References

- ADR 0003 — Component token extractor pattern.
- ADR 0004 — Typed design token DSL.
- ADR 0022 — PKDS CUE-authored design system pipeline.
- `platformkit-frontend-kit/docs/browser-asset-strategy.md`.
- `pk-modules/internal/moduleassets`.
