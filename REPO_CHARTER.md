# Repository Charter

## Mission

Hold the canonical written record of how PlatformKit is designed: ADRs, architecture narrative, requirements, schemas, and the public docs portal substrate.

## Owns

- Architecture Decision Records (`adr/`)
- architecture narrative (`architecture/`)
- requirements (`requirements/`) and proposals (`proposals/`)
- federation contract (`.platformkit/docs.manifest.yaml`) that other repos plug their docs into
- shared cross-repo schemas (`schemas/`)
- the Astro Starlight public docs substrate (`apps/`, `antora-ui/`)
- the docs portal's compile-and-publish pipeline

## Does Not Own

- per-repo source code (lives in the platformkit-* implementation repos)
- per-module business documentation (each business module owns its own `docs/`)
- public marketing copy
- release automation or CI workflow definitions

## Dependencies

- Node.js + npm for the Antora docs build
- Antora UI assets vendored in `antora-ui/`

## Release Posture

- Visibility: `public`
- Bootstrap mode: `git`
- ADR rule: ADRs are append-only once Accepted; supersession requires a new numbered ADR pointing back at the original
