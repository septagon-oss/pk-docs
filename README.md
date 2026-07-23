# pk-docs

> Part of [PlatformKit](https://github.com/septagon-oss/platformkit) — the
> open-source Go backend for multi-tenant SaaS.

Public documentation source for PlatformKit OSS.

## Start here

For the current runnable contract, setup, credentials, routes, and architecture,
start with the
[PlatformKit front door](https://github.com/septagon-oss/platformkit). To extend
the starter, use the supported
[`starterapp.WithModules` reference](https://github.com/septagon-oss/pk-apps/tree/main/reference/custommodule).

Version-named directories in this branch are maintained historical documentation:
they may contain later corrections or backports and are not exact release
snapshots. For release-specific research, use the
[pinned v0.2.0 documentation commit](https://github.com/septagon-oss/pk-docs/tree/2d13847849e69b79a7e71dda807782645d544957/docs/v0.2.0).

PlatformKit exists to make serious SaaS systems composable without making the
hard parts informal. The OSS contract should make module boundaries,
authorization, entity metadata, design tokens, runtime health, requirements,
and conformance visible enough that a team can build a product, audit it, and
extend it without forking the mental model.

This repository turns that intent into docs-as-code. It is the public handbook
for the framework and the source material consumed by the docs portal.

It owns:

- release-ready public docs in `docs/`
- ADR source material in `adr/`
- architecture source material in `architecture/`
- platform requirement source material in `requirements/`
- the public PlatformKit page overlay in `overlays/platformkit/`
- documentation federation contracts in `.platformkit/` and `packages/`
- the lightweight docs build and preview tooling in `apps/` and `scripts/`

The public repo does not include hosted publishing automation. Downstream
distributions can publish these sources to their preferred docs host or compose
them into PlatformKit content modules.

## Reader Promise

The docs should make the platform legible from first principles:

- what belongs in core, modules, apps, shared packages, design, runtime, tools,
  tests, and docs
- why a boundary exists, linked to the ADR or requirement that justifies it
- how a community module can extend PlatformKit without importing private
  product code
- how Pro/private distributions extend the OSS model through the same public
  contracts
- how requirements, tests, and generated evidence keep the architecture honest

## Repository Shape

```text
pk-docs/
├── docs/                 release-ready public docs
├── adr/                  decision-record source material
├── architecture/         architecture source material
├── requirements/         requirement source material
├── overlays/platformkit/ public PlatformKit page content and assets
├── apps/                 docs hosts and preview apps
├── packages/             docs composer/source packages
└── .platformkit/         docs federation manifest
```

## Commands

```bash
make verify
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

Published docs live in `docs/` or opt in with `status: published` frontmatter.
ADR, architecture, and requirement source material is available for rewrite
work, but it is not published by default.

Copy `adr/0000-template.md` for new ADRs and
`requirements/0000-template.md` for new platform requirements. Keep source docs
small, link aggressively, and prefer module-owned docs for module-specific
reference material.
