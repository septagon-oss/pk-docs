# PlatformKit Docs Implementation Plan

## Outcome

Ship one maintainable docs platform with:

- module-owned bundles
- canonical API reference from Huma
- integrated showcases from E2E evidence
- one central preview/build system

## Phase 1: Stabilize Contracts

### `pk-modules`

- keep `docs/bundle.json` as the neutral contract
- add schema versioning and compatibility rules
- add optional `docs/openapi.overlay.yaml`
- keep current contract checks

Acceptance:

- every module exports a valid bundle
- no superseded generated docs files remain

### `platformkit-backend-kit`

- stamp operations with authoritative PlatformKit ownership extensions
- export canonical `openapi.json`
- disable built-in Huma docs UI permanently

Acceptance:

- no operation ownership is inferred heuristically downstream

### `platformkit-tests`

- keep neutral showcase artifacts
- ensure artifacts can reference module and feature IDs

Acceptance:

- one showcase artifact can be joined to one module page without custom glue code

## Phase 2: Create The Docs App

Create `pk-docs` with:

- `apps/web`
- `packages/contracts`
- `packages/module-source`
- `packages/openapi-source`
- `packages/showcase-source`
- `packages/composer`

Acceptance:

- the docs app can load fixture bundles and a fixture OpenAPI spec

## Phase 3: Build The Composer

Implement:

- bundle loader
- OpenAPI loader and overlay applier
- module page model composer
- global nav builder

Acceptance:

- one module renders from real bundle + real spec + optional showcase data

## Phase 4: Real API Pages

Render real API pages from the module slice with Fumadocs OpenAPI.

Acceptance:

- request/response schema, examples, errors, and operation IDs are visible
- no hand-authored endpoint inventory is required for API truth

## Phase 5: Integrated Showcases

Attach showcases to module pages:

- transcript
- video/poster
- chapter list
- related operations
- permissions used

Acceptance:

- one flagship module page explains the product surface and the API surface together

## Phase 6: CI And Preview

Add CI jobs:

1. export app OpenAPI
2. export module bundles
3. export showcase artifacts
4. build docs app
5. run page-model tests
6. deploy preview

Acceptance:

- every PR gets a docs preview
- contract drift fails before merge

## Proposed Commands

These are the commands I would standardize on.

### Backend App

```bash
make export-openapi
```

Artifact:

```text
dist/openapi/openapi.json
```

### Business Modules

```bash
make export-module-bundles
```

Artifact:

```text
dist/module-docs/<module>/bundle.json
dist/module-docs/<module>/openapi.overlay.yaml   # optional
```

### PlatformKit Tests

```bash
make export-showcases
```

Artifact:

```text
dist/showcases/<module>/<feature>/<showcase>.json
dist/showcases/<module>/<feature>/<showcase>.mp4
```

### Docs App

```bash
pnpm docs:sync
pnpm docs:dev
pnpm docs:build
pnpm docs:test
```

Expected behavior:

- `docs:sync` copies or resolves all upstream artifacts into `.generated/`
- `docs:dev` runs a local Fumadocs preview
- `docs:build` produces the static site
- `docs:test` validates page models and smoke pages

## Migration Rule

Do not block progress on deleting transitional provider output immediately.

Use this order:

1. central docs app reaches parity for one module
2. central docs app becomes the canonical preview path
3. transitional in-module provider output is downgraded to optional debug output
4. remove in-module provider rendering when no longer needed
