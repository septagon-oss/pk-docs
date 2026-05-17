---
title: "ADR 0001: We organise UI behaviour on two axes"
status: Accepted
date: 2024-01-15
slug: adr-0001-interaction-architecture
adr_topic: ui-architecture
type: doc
tags: [adr, frontend, architecture]
---

# ADR 0001 — We organise UI behaviour on two axes

Status: **Accepted** (2024-01-15)

## The problem

`platformkit-frontend-kit`'s *structure* is healthy. Atomic component
layers under `components/`, a behaviour-registry metadata under
`registry/`, transitional preview tooling under `storybook/`, vendored
browser primitives under `assets/`. The skeleton is fine.

The *behaviour* is the weak link. Today an interactive component can
express its behaviour through any of four channels at once: raw inline
`onclick` handlers, inline state blobs embedded in render code,
HTMX attributes sprinkled through page-specific Go, and duplicated
shell logic that business modules re-invent instead of inheriting
from the frontend kit. None of these channels talk to each other.

The consequences are the usual ones. Interactive behaviour is hard to
discover, hard to test, hard to reuse. Shell concerns drift between
`platformkit-frontend-kit` and `pk-modules` because
nothing enforces who owns the shell. The component registry
documents structure faithfully and behaviour not at all.

## The decision

We split UI responsibility on two axes. Structural composition stays
in Go and stays atomic. Interactive behaviour moves into
controller-based contracts on the client, wired through a shared
runtime.

Seven rules govern the split:

1. Go owns markup, props, accessibility, server-driven composition,
   and HTML contracts.
2. HTMX remains the default mechanism for server state transitions
   and partial rerenders.
3. Client JavaScript is limited to *ephemeral* interaction state —
   open/closed, keyboard handling, focus management, persisted
   browser preferences. Anything else is a server concern.
4. Interactive behaviour must be declared as a controller contract,
   not embedded as arbitrary inline script.
5. Only interactive organisms and pages hydrate as islands. Most
   atoms and many molecules stay plain server-rendered HTML.
6. The shared controller runtime is the only supported architecture
   for new interactive shared UI.
7. Generic admin-shell behaviour belongs in `platformkit-frontend-kit`,
   not inside business modules.

Each interactive component converges on the same file shape:
`builder.go` for rendering, `definition.go` for structural and
behavioural metadata, optional `behavior.go` for Go-side helpers that
emit controller values, optional `storybook.go` and `e2e.go` for
verification.

## What we gave up

- Authoring ceremony. Existing components had to migrate behaviour
  out of Go string literals into controller modules.
- Freedom. The registry now carries a behaviour schema that has to
  stay stable; a shared-UI change means touching both Go contract
  tests and runtime controller tests.

## What we kept

- Behaviour you can find. Registry + Storybook + MCP + AI surfaces
  all describe structure *and* behaviour from the same source.
- HTMX that doesn't fight controllers. Rerenders reconnect
  controllers consistently because the wiring is declared, not
  inlined.
- One canonical shell. Business modules consume it; they don't fork
  it.

## How we enforce it

- **No new raw `onclick` handlers** in shared interactive components.
  Review rule today; an analyzer is tracked as follow-up.
- **No new inline behaviour blobs** for complex shell or page
  behaviour.
- **Interactive organisms must declare behaviour metadata** in the
  registry; components without metadata fail registry validation.
- **Business modules own domain-specific behaviour only**, not
  generic shell behaviour. The line is enforced by the shell's
  canonical location under `components/organisms/` plus review.

## References

- Atomic Design: <https://atomicdesign.bradfrost.com/chapter-2/>
- HTMX docs: <https://htmx.org/docs/>
- Hypermedia-Friendly Scripting: <https://htmx.org/essays/hypermedia-friendly-scripting/>
- Stimulus handbook: <https://stimulus.hotwired.dev/handbook/introduction>
- Astro islands architecture: <https://docs.astro.build/en/concepts/islands/>
- Storybook docs: <https://storybook.js.org/docs>
- Related: [ADR 0002](./0002-surface-manifests-and-shell-profiles.md)
  — how shell profiles and surface manifests compose on top of this.
