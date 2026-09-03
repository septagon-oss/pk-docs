> **Archived on 2026-09-03.** This repository is read-only. It belongs to the 0.x PlatformKit family, superseded by [PlatformKit v1](https://github.com/septagon-oss/platformkit); the 0.x front door is kept under its `legacy-0.x` branch and tags.

# pk-docs

> Part of [PlatformKit](https://github.com/septagon-oss/platformkit) — the
> open-source Go backend for multi-tenant SaaS.

Public documentation source for PlatformKit OSS.

## Start here

The published site is
[septagon-oss.github.io/pk-docs](https://septagon-oss.github.io/pk-docs/).
Read the guides in this order — each one states what the starter does today
and shows the real output:

1. [What is PlatformKit?](docs/current/overview.md) — the one-page picture
2. [Quickstart](docs/current/quickstart.md) — run it, log in, call the API
3. [Build a secure extension](docs/current/extensions.md) — your first module
4. [Design system](docs/current/design-system.md) — the Go-end-to-end frontend stack
5. [API contract](docs/current/api-contract.md) — every rule, with status codes
6. [Runtime surfaces](docs/current/runtime-surfaces.md) — what ships and what deliberately does not
7. [Troubleshooting](docs/current/troubleshooting.md) and [Glossary](docs/current/glossary.md)

Executable facts are owned by the
[PlatformKit front door](https://github.com/septagon-oss/platformkit).
Screenshots live in `docs/assets/screenshots/`; diagrams are generated into
`docs/assets/diagrams/` by `npm run docs:diagrams`.

Version-named directories in this branch are maintained historical
documentation: they may contain later corrections or backports and are not
exact release snapshots. For release-specific research, use the
[pinned v0.2.0 documentation commit](https://github.com/septagon-oss/pk-docs/tree/2d13847849e69b79a7e71dda807782645d544957/docs/v0.2.0).

The numbered arc42 files under `architecture/` describe a larger historical
workspace. They are archived source, are no longer published by the docs
manifest, and must not be used as evidence of current OSS modules or products.

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

The public repo publishes itself: `.github/workflows/docs.yml` builds the site
and deploys it to GitHub Pages at
[septagon-oss.github.io/pk-docs](https://septagon-oss.github.io/pk-docs/).
Downstream distributions can also publish these sources to their preferred
docs host or compose them into PlatformKit content modules.

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
npm run docs:diagrams
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

Frontmatter the site understands: `title`, `slug`, `description` (the lede and
card text), `group` (sidebar section, e.g. `Start here`, `Build`, `Reference`),
and `order` (position within the reading list). The markdown renderer supports
GitHub-flavoured tables, `> [!NOTE]`/`[!TIP]`/`[!IMPORTANT]`/`[!WARNING]`/`[!CAUTION]`
callouts, images with captions (`![alt](../assets/x.png "Caption")`), task
lists, nested lists, and `<details>` blocks; headings written as `## 1. Step`
render with a step marker. Put images under `docs/assets/` and link them
relatively so they work on GitHub and on the site.

Copy `adr/0000-template.md` for new ADRs and
`requirements/0000-template.md` for new platform requirements. Keep source docs
small, link aggressively, and prefer module-owned docs for module-specific
reference material.