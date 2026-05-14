# pk-docs

Public documentation source for PlatformKit OSS.

This repository owns the docs-as-code source for:

- ADRs in `adr/`
- architecture narrative in `architecture/`
- platform requirements in `requirements/`
- the public PlatformKit page overlay in `overlays/platformkit/`
- documentation federation contracts in `.platformkit/` and `packages/`
- the lightweight docs build and preview tooling in `apps/` and `scripts/`

The public repo does not ship the private live-publish workflow. Downstream
distributions can add deployment automation that publishes these sources to
their preferred docs host or to PlatformKit's own content modules.

## Repository Shape

```text
pk-docs/
├── adr/                  architecture decision records
├── architecture/         arc42-style platform architecture
├── requirements/         canonical platform requirements
├── overlays/platformkit/ public PlatformKit page content and assets
├── docs/                 target docs-system architecture
├── apps/                 docs hosts and preview apps
├── packages/             docs composer/source packages
└── .platformkit/         docs federation manifest
```

## Commands

```bash
npm run docs:sync
npm run docs:build
npm run docs:dev
npm run docs:antora:sync
npm run docs:antora:build
npm run docs:test
```

The OSS build expects sibling public repos, especially `../pk-modules`, when
syncing module-owned docs bundles.

## Authoring

Copy `adr/0000-template.md` for new ADRs and
`requirements/0000-template.md` for new platform requirements. Keep source docs
small, link aggressively, and prefer module-owned docs for module-specific
reference material.
