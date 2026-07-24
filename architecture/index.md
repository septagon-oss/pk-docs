---
title: "PlatformKit Architecture"
slug: architecture-index
type: doc
tags: [architecture, arc42, index]
collection: architecture
arc42_section: 0
authoring: authored
status: archived
---

> **Historical architecture source.** This narrative describes a larger downstream workspace and is not the current PlatformKit OSS runtime. Use `docs/current/` and verify executable claims against the public `septagon-oss` repositories.


# PlatformKit Architecture

This is PlatformKit's architecture documentation, organised to the
**arc42** template. Each section answers one question; together they
answer every question a new contributor, an integrator, or an
auditor can reasonably have about how PlatformKit is built.

The architecture has one thesis: core should be small enough to trust
and explicit enough to extend. Modules add product capability through
contracts, registries, design contributions, policies, requirements,
and tests. Apps compose those modules into customer workflows.
Pro/private distributions build on the same public model.

If you came here looking for a specific decision rather than the
whole architecture, jump to
[section 09](./09-architecture-decisions.md) — that's the index of the
maintained ADR and convention collections.

## The 12 sections

| # | Section | What it answers |
|---|---|---|
| [01](./01-introduction-and-goals.md) | Introduction and Goals | What is PlatformKit, who is it for, what are the top three quality goals? |
| [02](./02-architecture-constraints.md) | Architecture Constraints | What hard constraints shaped the architecture — technical, organisational, regulatory? |
| [03](./03-system-scope-and-context.md) | System Scope and Context | What's inside the system, what's outside, who/what does PlatformKit talk to? |
| [04](./04-solution-strategy.md) | Solution Strategy | What are the fundamental decisions, at the highest level? |
| [05](./05-building-block-view.md) | Building Block View | What are the system's building blocks — repos, modules, features — and how do they nest? |
| [06](./06-runtime-view.md) | Runtime View | What happens at runtime for the important scenarios? |
| [07](./07-deployment-view.md) | Deployment View | How does PlatformKit ship — monolith, microservices, databases, observability? |
| [08](./08-cross-cutting-concepts.md) | Cross-cutting Concepts | What concerns span multiple modules — error handling, events, async, design system? |
| [09](./09-architecture-decisions.md) | Architecture Decisions | Where do the ADRs and conventions live? |
| [10](./10-quality-requirements.md) | Quality Requirements | What quality goals does the architecture deliver, and how are they verified? |
| [11](./11-risks-and-technical-debt.md) | Risks and Technical Debt | What risks, gaps, and open decisions must be managed deliberately? |
| [12](./12-glossary.md) | Glossary | What does *port*, *contract*, *outbox*, *PKDS* mean here? |

## How this docs system is organised

PlatformKit's docs split three ways:

- **Architecture** (this directory, 12 sections). The canonical
  explanation of how the system is built. Living, narrative, refreshed
  whenever the architecture changes.
- **Decisions** ([`adr/`](../adr/)). One file per decision that had
  alternatives worth recording. Each ADR is immutable once accepted —
  if the decision changes, a new ADR supersedes it.
- **Conventions** ([`conventions.md`](../conventions.md)). Rules that
  follow mechanically from a decision — migrations are append-only,
  features own their routes, test coverage scales with tier. No
  alternatives, just discipline, one page.

If you're adding something, the question is: *does this have an
alternative a reasonable team could have picked?* If yes, ADR. If no,
convention. If it's a narrative about how a thing works, architecture
section.

## Conventions for authors

Every architecture file carries arc42 frontmatter so the sync
pipeline can order the sidebar:

```yaml
---
title: "05 Building Block View"
slug: architecture-05-building-block-view
arc42_section: 5
collection: architecture
type: doc
tags: [architecture, arc42]
---
```

Section numbers are the arc42 canonical ones (1-12). `arc42_section`
is a JSON number, which the sync script reads for stable ordering.

Cross-references use relative paths:

- From a section to another section: `[05](./05-building-block-view.md)`.
- From a section to an ADR: `[ADR 0009](../adr/0009-ports-only-cross-module-communication.md)`.
- From a section to a convention:
  `[Convention C-04](../conventions.md#c-04-public-contracts-live-away-from-their-implementation)`.

When a section cites a decision, prefer linking the ADR — don't
paraphrase the ADR in a section; the ADR is the authority. Sections
summarise and contextualise.
