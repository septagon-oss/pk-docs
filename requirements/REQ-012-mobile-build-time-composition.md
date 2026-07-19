---
id: REQ-012
title: "Mobile shell composes module + client packs at build time"
status: Active
date: 2026-05-06
slug: req-012-mobile-build-time-composition
category: governance
ears_pattern: ubiquitous
verification_methods:
  - analysis
  - test
compliance: []
satisfied_by:
  adr: [ADR-0025]
  conventions: []
type: doc
tags: [requirement, governance, mobile, composition]
---

# REQ 012 — Mobile shell composes module + client packs at build time

Status: **Active** (2026-05-06)

## Statement

The `platformkit-mobile` shell **SHALL** compose its renderer set from
two independent axes at build time (not runtime): module packs
(`mobileauth`, `mobileprofile`, `mobiletraffic`) and client packs
(per-tenant overlays supplied by downstream distributions). The build system
**SHALL** fail loudly when a slug filter misses, when duplicate slugs
collide, or when a client pack references a module pack absent from the
build.

## Rationale

Dual-axis composition at build time is what makes per-client mobile
artifacts reproducible. EAS profiles inject
`PLATFORMKIT_CLIENT_FILTER=<slug>`, and
`scripts/sync-client-packs.mjs` materializes a deterministic generated
index for that slug set. This gives each tenant build a bounded,
inspectable renderer surface and avoids "which overlays were bundled"
ambiguity across CI, local, and release builds.

Runtime composition would undermine the trust model for signed mobile
artifacts. App-store binaries are code-signed snapshots; if composition
moves to runtime path discovery, the effective UI contract can drift
from the signed bundle and from the tested build graph. Build-time
materialization plus explicit Metro workspace watches in
`metro.config.js` keeps composition inside the signed, testable build
boundary.

Fail-loud behavior is mandatory because silent fallback means the wrong
tenant can render without obvious failure. A missed
`PLATFORMKIT_CLIENT_FILTER`, a duplicate slug collision, or a pack-layer
mismatch are correctness violations, not recoverable warnings. The
correct posture is immediate build failure with actionable error text,
so the operator fixes the configuration before a wrong-client binary is
published.

## Acceptance criteria

- **AC-1** `scripts/sync-client-packs.mjs` exits non-zero when
  `PLATFORMKIT_CLIENT_FILTER` is set but no discovered client pack slug
  matches it.
- **AC-2** The generator exits non-zero when duplicate client slugs are
  discovered across workspace roots.
- **AC-3** `metro.config.js` declares explicit `watchFolders` entries
  for external client-pack roots instead of relying on implicit runtime
  resolution.
- **AC-4** Per-client EAS build profiles set
  `PLATFORMKIT_CLIENT_FILTER` to a concrete client slug.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Inspection | `platformkit-mobile/tests/sync-client-packs.test.mjs` — test case: "generator fails when PLATFORMKIT_CLIENT_FILTER does not match any pack". _Verification gap: cited resource is not a Go test (pattern / non-Go); downgraded to inspection._ |
| AC-2 | Inspection | `platformkit-mobile/tests/sync-client-packs.test.mjs` — test case: "generator fails loudly when the same slug appears in both roots". _Verification gap: cited resource is not a Go test (pattern / non-Go); downgraded to inspection._ |
| AC-3 | Analysis | `product/platformkit-mobile/metro.config.js` — `candidateExtraWatchFolders` explicitly includes downstream overlay roots, then assigns `config.watchFolders`. |
| AC-4 | Analysis | `product/platformkit-mobile/eas.json` — per-client profiles (e.g. `development-<client>`, `demo-<client>`) set `env.PLATFORMKIT_CLIENT_FILTER`. |

## Satisfied by

- [ADR 0025 — Module-owned mobile surfaces](../adr/0025-module-owned-mobile-surfaces.md) —
  establishes module-owned mobile surface contracts and the dual-axis
  composition model that this requirement mandates at build time.
