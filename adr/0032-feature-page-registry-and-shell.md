---
title: "ADR 0032: Each feature declares its pages once; the shell guarantees the e2e marker"
status: Proposed
date: 2026-05-10
slug: adr-0032-feature-page-registry-and-shell
adr_topic: testing-architecture
type: doc
tags: [adr, testing, e2e, page-registry, frontend-architecture]
---

# ADR 0032 — Each feature declares its pages once; the shell guarantees the e2e marker

Status: **Proposed** (2026-05-10)

## The problem

Every feature in `pk-modules` that owns admin or
public pages has the same three-leg setup, repeated by hand: a
renderer that returns the page HTML, an `e2e.go` declaring the CSS
selector the harness should wait on, and (by convention) a
`data-page="X"` attribute on the renderer's outermost `<div>` that
the selector matches. Nothing links the three. Nothing fails when one
drifts.

We watched this go wrong twice in May 2026. The auth registration
page renderer never emitted `data-page="register"` — the
`auth_management/registration` e2e suite was timing out on the
selector for months and we only noticed it when running every BM
e2e during the MFA-flow root-cause investigation. Separately, the
homepage renderer's content profile was renamed from
`platformkit_showcase` to `overlay_experience` and the e2e assertion
was unchanged for the entire delta — the test was right "by accident"
until it wasn't.

The shape of the bug is identical in both cases: the *renderer* and
the *test* know about a page identity, but they reach that identity
through two parallel string conventions instead of one shared object.
A new feature follows the convention because the author saw another
feature do it; nothing catches the author who misses a step or forgets
the marker entirely. We ended this audit with a 4-feature gap of
admin pages that render without any stable selector — and 21 features
that follow the convention only because nobody has happened to
rename a constant yet.

## The decision

Every feature that owns user-facing pages declares them in one
package-local `pages.go` file using a shared `pageregistry` contract.
The renderer renders the page via a `pageshell.Render(ctx, page,
content)` call — the shell is the only sanctioned entry point for
returning a top-level page node, and it always emits
`data-page=<page.ID>` on the outermost element along with the
declared `<title>`, language attributes, and any common chrome. The
feature's `e2e.go` builds its `Pages` and `Routes` maps by
introspecting the same registry instead of duplicating the strings.
A per-feature unit test asserts that every registered page renders
through the shell and the rendered HTML carries the marker. The
combined effect: a page that exists has a marker, a marker exists
because a page does, and the e2e selector matches the renderer's
output by construction — drift is impossible without a build break.

Concretely the contract is three small packages:

```go
// pageregistry.Page is the per-page declaration. ID is the stable
// identifier (e2e selector + data-page attribute), Route is the URL
// the router serves it under, Title is the <title> element, all
// other fields are optional admin-chrome metadata.
type Page struct {
    ID          string   // stable: "register", "subscriptions"
    Route       string   // "/register", "/admin/billing/subscriptions"
    Title       string   // i18n key resolved at render time
    NavGroup    string   // optional admin sidebar grouping
    NavLabel    string   // optional admin sidebar label
    Permissions []string // optional read-token gates
}

// pageregistry.Declare validates uniqueness of (ID, Route) tuples
// and returns a Registry the feature exports as a package-level var.
func Declare(pages ...Page) *Registry
```

```go
// pageshell.Render is the one sanctioned page-rendering entry point.
// It wraps content with the data-page marker, sets the <title>, and
// applies the platform's standard <html>/<body> chrome. Renderers
// that bypass the shell fail the per-feature page-shell guard.
func Render(ctx context.Context, page pageregistry.Page, content g.Node, opts ...Option) g.Node
```

```go
// e2econfig.PageSelectorsFromRegistry produces the Pages/Routes
// maps the FeatureConfig consumes. The feature's e2e.go calls this
// instead of repeating the strings; one change in pages.go cascades
// to both renderer and test.
func PageSelectorsFromRegistry(r *pageregistry.Registry) map[string]string
func RoutesFromRegistry(r *pageregistry.Registry) map[string]string
```

The shell's emitted marker is the only public contract. The shell
may add other chrome (inert classes, telemetry attributes, runtime
context blocks); the marker stays the canonical e2e anchor and
cannot be silently removed without breaking every test that depends
on it.

## What we gave up

- One additional shared package (`pageregistry` + `pageshell`) and
  the small migration pass to move 21 existing renderers onto it.
- The freedom to render a one-off page outside the shell — a
  renderer that genuinely cannot use the shell (e.g. a SAML callback
  HTML stub) must opt out via an explicit `pageshell.Bypass()` call
  that the guard test recognises and the next reviewer sees.
- A small amount of test boilerplate per feature (one
  `TestPagesEmitMarkers` per `pages.go`).

## What we kept

- Every existing `data-page="X"` value stays valid — we migrate
  renderers to the shell without changing any e2e selectors or test
  assertions, so the migration is a pure refactor.
- The current `FeatureConfig`/`E2E` shape is unchanged on the read
  side; tests still call `feature.E2E.Page("register")`. Only the
  *source* of the strings moves.
- Backend-only features (27 of 52) are untouched — they don't own
  pages, so they don't declare a registry.
- New pages are e2e-ready by construction: declare it once, the
  marker is emitted, the selector is exposed, the guard test
  catches anyone who tries to remove the shell call.

## How we enforce it

The shell + registry are the carrier; three checks make the
contract mechanical rather than aspirational.

- **`pageshell.Render` is the only path that emits `data-page`.**
  The package keeps the attribute name as an unexported constant
  and never exports it. A renderer that wants to set `data-page`
  manually has to import `pageshell` to get the value, which is
  the wrong shape and gets caught in review.
- **Per-feature `TestPagesEmitMarkers`** (`pages_test.go`) — for
  each page in the registry, render it through the canonical
  feature renderer entry point, assert the rendered HTML contains
  `data-page=<id>`. A new page added to `pages.go` without a
  matching shell call fails this test before any e2e run.
- **`check-page-shell`** (`platformkit-devtools/cmd/check-page-shell`)
  — workspace-wide AST scan that flags any string literal
  `data-page=` outside `pageshell.Render`. The forward-direction
  enforcement: a renderer that bypasses the shell to set the
  marker manually fails the build. The opt-out path
  (`pageshell.Bypass()`) is recognised by name so legitimate
  exceptions stay loud. (Tracked follow-up: tool does not exist
  yet; first version lands with the migration.)

## References

- Motivating commits:
  - `3b1258207` — `fix(auth_management/registration): make /register
    testable end-to-end` (the data-page="register" patch that
    surfaced the gap class).
  - `a8dec5f0` — `fix(tests/e2e): target platformkit tenant +
    align assertions to current overlay reality` (the assertion
    drift that the registry would catch by tying the test to the
    declaration, not a snapshot).
- Inventory: [`proposals/feature-page-inventory-2026-05-10.md`](../proposals/feature-page-inventory-2026-05-10.md)
  — the per-feature audit that scoped this ADR.
- Related ADRs:
  - [ADR 0029](./0029-every-file-declares-its-purpose.md) — file-purpose
    discipline (why we add load-bearing structure rather than convention).
  - [ADR 0031](./0031-atomic-component-tiers.md) — registry-mirrors-filesystem
    pattern this borrows the "declare once, derive everything" shape from.
