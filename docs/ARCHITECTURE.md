# PlatformKit Docs Architecture

## Goal

Build one public docs portal that composes framework narrative, module docs,
API reference, and verified product walkthrough evidence from source-owned
artifacts.

The portal should make PlatformKit's public contract inspectable: what the core
promises, what modules contribute, what apps compose, which requirements govern
the behavior, and which generated evidence proves the claim.

## Non-Negotiable Rules

1. Modules own source contracts and contribution metadata, not final rendered
   pages.
2. The backend app owns the canonical Huma OpenAPI document.
3. The docs portal is built centrally at build time.
4. Docs-only augmentation stays separate from runtime API registration whenever
   possible.
5. Renderer choice is an adapter, not the source of truth.
6. Requirements, ADRs, module bundles, API slices, and showcase evidence remain
   traceable after composition.

## Recommended Stack

- API generation: `Huma`
- API augmentation: `OpenAPI Overlay`
- Human docs site: `Fumadocs`
- E2E showcase rendering: `Remotion`
- Search/indexing: generated from the composed page model

## Why This Shape

### Keep Huma

Huma already produces the canonical spec and supports disabling the built-in docs UI. That means PlatformKit can keep runtime API truth where it already belongs and remove the need for any in-app human docs renderer.

### Use OpenAPI Overlay

Some API descriptions, examples, grouping hints, and docs metadata are docs concerns, not runtime concerns. Those should live in overlay files owned by modules instead of being forced into Go registration code.

### Render With Fumadocs

Fumadocs is the right rendering layer because it supports custom content sources and can combine authored content with generated structures cleanly. It should render the unified page model, not become the source of truth itself.

## Ownership Split

### `pk-modules`

Owns:

- `README.md`
- `docs/adr/*.md`
- `docs/bundle.json`
- optional `docs/openapi.overlay.yaml`
- optional showcase narration metadata

Does not own:

- provider-rendered website pages as the long-term source of truth
- global navigation
- cross-module site composition

### Runtime and app repos

Own:

- canonical Huma `openapi.json`
- authoritative operation metadata
- operation extensions:
  - `x-platformkit-module-id`
  - `x-platformkit-feature-id`
  - `x-platformkit-permissions`
  - `x-platformkit-showcase-id`

### `pk-testkit` and downstream test repos

Owns:

- neutral showcase/evidence artifacts
- screenshots, timelines, transcripts, and video inputs

### `pk-docs`

Owns:

- loading bundles and overlays
- loading canonical OpenAPI and module slices
- composing page models
- rendering the final site
- preview and CI build

## Data Flow

```text
pk-modules
  -> docs/bundle.json
  -> docs/openapi.overlay.yaml (optional)

backend app
  -> dist/openapi/openapi.json

pk-testkit or downstream tests
  -> showcase artifacts

pk-docs composer
  -> loads bundles
  -> loads canonical OpenAPI
  -> applies overlays
  -> joins API + module + showcase data
  -> emits page model

Fumadocs app
  -> renders overview pages
  -> renders feature pages
  -> renders API pages
  -> embeds showcase content
```

## Central Packages

### `packages/contracts`

Shared schemas and types for:

- `ModuleBundle`
- `ShowcaseArtifact`
- `DocsNavNode`
- `ModulePageModel`
- `FeaturePageModel`
- `APISurfaceModel`

### `packages/module-source`

Responsibilities:

- discover module bundle files
- validate schema
- load authored narrative metadata
- resolve module-local asset references

Input:

- exported bundle directory or direct sibling repo path

### `packages/openapi-source`

Responsibilities:

- load canonical Huma spec
- validate required PlatformKit operation extensions
- apply module overlays
- derive module API slices by explicit extensions, not path heuristics

Important rule:

- never guess ownership from URL prefixes when authoritative metadata exists

### `packages/showcase-source`

Responsibilities:

- load showcase artifacts produced by `platformkit-tests`
- map showcase IDs to modules/features
- provide transcript/video/poster metadata

### `packages/composer`

Responsibilities:

- join module bundles, API slices, and showcase artifacts
- produce page models for the web app
- generate global navigation
- generate related-links graphs between pages

This package should be pure and deterministic so it is easy to test.

## Page Model

Each module gets one top-level section with these views:

1. `Overview`
2. `Features`
3. `API`
4. `Showcases`
5. `Events`
6. `Dependencies`

The docs site can render them as tabs or separate pages, but the underlying page model should stay stable.

## API Strategy

Use the real spec for API docs.

Do not render endpoint tables from hand-built projections when a canonical OpenAPI slice exists.

Preferred model:

1. export one app-wide spec from Huma
2. require authoritative PlatformKit extensions on operations
3. slice by extension
4. apply module overlay
5. render with Fumadocs OpenAPI components

## Showcase Strategy

Showcases should not be bolted on as loose videos.

Each showcase should attach to:

- module ID
- feature ID
- related operation IDs
- permissions used
- transcript
- video/poster assets

This lets the portal say:

- here is the feature
- here is the verified user journey
- here are the endpoints behind it

## Build Discipline

- Keep bundle generation in modules.
- Keep final rendering in `pk-docs`.
- Keep generated provider artifacts as validation references until the central
  page model covers the same assertions.
- Make every module page reproducible from bundle data, OpenAPI metadata,
  overlays, and showcase artifacts.
- Prefer explicit extensions such as `x-platformkit-module-id` over path or
  naming inference.
