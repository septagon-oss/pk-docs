# pk-docs

Public documentation source for PlatformKit OSS.

PlatformKit exists to make serious SaaS systems composable without making the
hard parts informal. The OSS contract should make module boundaries,
authorization, entity metadata, design tokens, runtime health, requirements,
and conformance visible enough that a team can build a product, audit it, and
extend it without forking the mental model.

This repository turns that intent into docs-as-code. It is the public handbook
for the framework and the source material consumed by the docs portal.

It owns:

- ADRs in `adr/`
- architecture narrative in `architecture/`
- platform requirements in `requirements/`
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

Copy `adr/0000-template.md` for new ADRs and
`requirements/0000-template.md` for new platform requirements. Keep source docs
small, link aggressively, and prefer module-owned docs for module-specific
reference material.
