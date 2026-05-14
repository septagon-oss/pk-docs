---
title: "ADR 0002: Product composition is a typed contract, not app glue"
status: Proposed
date: 2024-02-12
slug: adr-0002-surface-manifests-and-shell-profiles
adr_topic: ui-architecture
type: doc
tags: [adr, frontend, composition]
---

# ADR 0002 — Product composition is a typed contract, not app glue

Status: **Proposed** (2024-02-12)

## The problem

The three repos that should compose a product each own the right
piece, but nothing ties them together cleanly.

`platformkit-frontend-kit` has the shell mechanics
(`components/organisms/admin_shell`), the page-pattern guidance, and
the controller-backed behaviour contracts from ADR 0001. It knows
how to render a product surface. `pk-modules` owns
the domain-side inputs — routes, permissions, admin registrations,
module manifests. It knows what a product *contains*. And
`platformkit-apps` owns the deployment compositions. It knows how a
product *ships*.

The missing layer is what connects them. Today each app re-adapts
routes and permissions into shell props by hand. The canonical
shell-adoption docs explicitly tell downstream repos to write that
glue. It works, but it means: shell adoption stays manual even when
the shell itself is canonical, business modules can't publish
portable UI contributions without leaking frontend mechanics, app
reuse proves deployment topology (monolith vs microservices) more
than it proves product-shape reuse, and there is no single
inspectable source of truth for navigation, page patterns, or shell
affordances.

## The decision

We add a typed product-composition layer with three artifacts, owned
by the repos that already own the inputs.

**`ModuleSurfaceContribution`** — owned by
`pk-modules`. The transport-safe description of a
module's UI contribution: stable route IDs, display labels, nav
section/group membership, icon tokens, page-pattern hints, breadcrumb
hints, capability/permission tags, shell-target hints (`admin`,
`operator`, `public`). It does *not* carry DOM structure, CSS
classes, controller identifiers, or any shell rendering code.

**`SurfaceManifest`** — owned by `platformkit-frontend-kit`. The
frontend-side composition contract for a concrete app surface:
selected shell profile, route inventory, navigation model,
page-pattern references, shell affordances (search, notifications,
tenant switcher, command palette, traceability slots), manifest-level
defaults that can be merged with app policy and request-scoped
preferences later.

**`ShellProfile`** — owned by `platformkit-frontend-kit`. Named
presets for shell mechanics: initially `admin`, `app`, `auth`,
`operator`. Profiles say what the shell *can* do; surface manifests
say what a concrete product surface *does*.

`platformkit-apps` owns the merge step: it takes shell-profile
defaults, module surface contributions, app-level product policy,
scenario/topology/rollout choices, and request-/tenant-/user-scoped
preferences, and resolves them into concrete `SurfaceManifest`
instances. The frontend kit then compiles each manifest into shell
props, page selection, header/sidebar placement, and future
backend-driven projections.

Phase 1 is admin-first. We prove one shell profile (`admin`), one
route and nav inventory, the existing admin page family, and the
deterministic merge of defaults/policy/preferences. We reuse the
current seams rather than standing up a parallel composition stack:
`pk-modules` derives `ModuleSurfaceContribution`
from the existing admin-registration, route, menu, and page-intent
seams; `platformkit-apps` assembles manifests *above* topology
bootstraps, not inside topology-specific sidebar wiring;
`platformkit-frontend-kit` adds a dedicated `surfaces/` package
rather than overloading `presentation/`; and
`components/organisms/admin_shell` stays the rendering target —
current prop assembly becomes an adapter boundary, not the long-term
source of truth.

Six boundary rules keep the layer honest:

1. `SurfaceManifest` is not a replacement for the component-registry
   manifest, module manifests, or the PWA manifest.
2. Business modules publish metadata, not shell mechanics.
3. Apps assemble product surfaces, not low-level shell behaviour.
4. Frontend kit owns shell profiles and manifest compilers, not
   domain route policy.
5. Navigation and page-pattern selection derive from stable route IDs
   and metadata, not page-local sidebar wiring.
6. Merge order for defaults and preferences is deterministic and
   documented.

## What we gave up

- Another contract layer. One more schema to version, one more thing
  to document.
- A migration. Existing app-local shell wiring has to move onto the
  manifest path.
- Discipline costs. The boundaries between module metadata, app
  policy, and frontend rendering have to stay crisp or the new layer
  collapses into another ad-hoc config blob — and that failure mode
  is easy to reach.

## What we kept

- Inspectable, typed, reusable product composition across repos.
- Canonical shell adoption moves from guidance-only to contract-driven.
- Module-owned navigation metadata evolves without leaking frontend
  mechanics.
- Reference apps can prove *composition* quality, not just deployment
  topology reuse.
- Future traceability, approvals, and operator affordances get a
  stable place to live.

## How we enforce it

- **No new app-local sidebar or shell wiring** becomes the primary
  source of navigation truth once the manifest path exists. Review
  rule today.
- **No business module imports frontend-shell mechanics** to publish
  UI contributions. Enforced by the boundary check in
  `pk-modules` (cross-module imports refused;
  see [ADR 0009](./0009-ports-only-cross-module-communication.md)).
- **No `SurfaceManifest` field requires consumers to know DOM
  structure or controller implementation details.** Schema-level
  rule; reviewed on changes to the `surfaces/` package.
- **Module-owned metadata is additive-first and stable-ID-first**
  under the compatibility policy.

## References

- [ADR 0001 — UI behaviour on two axes](./0001-interaction-architecture.md)
  — the interaction-architecture layer this composes on top of.
- [docs/platform-composition-standard.md](../platform-composition-standard.md)
- [docs/canonical-shell-adoption.md](../canonical-shell-adoption.md)
- [docs/page-patterns-and-consumption.md](../page-patterns-and-consumption.md)
