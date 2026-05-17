---
title: First Slice
slug: first-slice
collection: docs
status: published
---

# First Slice

## Pick

Use `translation_management` as the first full slice.

It is the right first slice because it already has:

- a strong generated bundle
- real API surface
- clear showcase/E2E contracts
- enough complexity to prove the composition model

## First Slice Deliverable

One module section in the central docs app with:

1. overview page from the module bundle
2. features page from the module bundle
3. API page from the real Huma module slice
4. showcase page from E2E evidence

## Required Inputs

### From `pk-modules`

- `translation_management/docs/bundle.json`
- optional `translation_management/docs/openapi.overlay.yaml`

### From backend app

- app-level `openapi.json`
- operations stamped with:
  - `x-platformkit-module-id = translation_management`
  - `x-platformkit-feature-id`

### From `platformkit-tests`

- one showcase artifact mapped to `translation_management`

## Acceptance Criteria

- the docs app can render the module without reading source files directly
- API operations are joined by explicit ownership metadata, not path prefix guesses
- one showcase links back to one or more related API operations
- one engineer can run the full preview locally in a repeatable way

## Local Developer Flow

```bash
# backend app
make export-openapi

# business modules
make export-module-bundles

# tests
make export-showcases

# docs app
pnpm docs:sync
pnpm docs:dev
```

## What To Avoid In The First Slice

- full multi-module nav polishing
- search tuning
- localization
- cinematic video generation for every module

The first slice should prove the composition model, not finish the entire portal.
