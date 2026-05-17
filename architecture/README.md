# PlatformKit architecture documentation — the stack

This directory holds PlatformKit's architecture documentation. The
shape is deliberately a **curated stack of frameworks**, not a
single one — see [ADR 0023](../adr/0023-module-documentation-stack.md)
for the full rationale.

If you're here to read the architecture, start at
[`./index.md`](./index.md) — that's the workspace arc42 entry point.

If you're here to **author new docs**, this README tells you where
new content goes and which framework it belongs to.

---

## The stack at a glance

```
Workspace                       arc42 v8.2 (full 12 sections)
  │
  ├── governance domain          arc42-lite (§1 §3 §4 §5 §6 §11)
  │     └── cookie_consent_…     module charter
  │     └── audit_management      module charter
  │     └── change_management     module charter
  │
  ├── identity-access domain     arc42-lite
  │     └── auth_management       module charter
  │     └── …
  │
  └── … six more domains          arc42-lite each
        └── their modules          module charter each
```

**Three scales. One transclusion chain.** Workspace §5 includes the
domain doc; domain §5 includes each module charter's "At a glance"
projection. Same anchors, three zoom levels, no duplication.

| Concern | Framework | Where it lives |
|---|---|---|
| Workspace architecture | **arc42 v8.2** | [`./`](./) (12 sections + `index.md`) |
| Domain architecture (8) | **arc42-lite** | [`./domains/<domain>/arc42.md`](./domains/) |
| Module charter (46) | **CUE + Markdown** | `<repo>/<module>/MODULE.{cue,md}` |
| Module identity & facts | **CUE schema** | [`../schemas/module_charter.cue`](../schemas/module_charter.cue) |
| Module body | **Diátaxis** (Tutorial / How-to / Reference / Explanation) | inside each `MODULE.md` |
| Module intent | **Google Design Doc** (Goals / Non-goals / Considered alternatives / Decision) | inside each `MODULE.md` |
| Decisions | **ADRs** (Nygard) | [`../adr/`](../adr/) |
| Diagrams | **C4 + Structurizr DSL** | `<module>/diagrams/*.dsl` (canonical) + `*.mmd` (projection) |
| API contracts | **OpenAPI 3.1** | generated from Huma-registered routes |
| Event contracts | **AsyncAPI 3.0** | generated from `WithEvent` declarations |
| Component contracts | **PKDS CUE** | `platformkit-design-system/pkds/src/contracts/` |
| Quality attributes vocabulary | **ISO/IEC 25010:2023** | inside `arc42.qualityRequirements` (charter) and `§10` (workspace) |
| Glossary | **DDD ubiquitous language** | [`./12-glossary.md`](./12-glossary.md) |

---

## Where do I put new content?

A short decision tree:

**Are you describing a single decision (the "we picked X over Y") and the reasons?**
→ Write a new ADR under [`../adr/`](../adr/). Use [`../adr/0000-template.md`](../adr/0000-template.md).

**Are you describing what one specific module does, owns, or doesn't own?**
→ Edit `<module>/MODULE.cue` (facts) and `<module>/MODULE.md`
(narrative). The template lives at
[`../templates/MODULE.{cue,md}.tmpl`](../templates/).

**Are you describing how a domain (8 of them: governance, identity-access, workspace, content-experience, engagement, integrations, platform, revenue) hangs together — flows that cross modules within the domain, the domain's risk posture, the boundary against neighbouring domains?**
→ Edit the matching `./domains/<domain>/arc42.md`. arc42-lite shape;
sections §1, §3, §4, §5, §6, §11 only.

**Are you describing something that's true of the whole workspace — global goals, cross-domain runtime flows, deployment topology, system-wide quality requirements?**
→ Edit the workspace arc42 section under `./` that matches the
arc42 number. `01-introduction-and-goals.md` through
`12-glossary.md`.

**Are you adding a new diagram?**
→ Author it as Structurizr DSL under `<module>/diagrams/*.dsl`
(or, for cross-module flows, in the domain doc's `diagrams/`
subdirectory). Generate the Mermaid projection alongside it; keep
the DSL canonical.

**Are you defining a new term that the workspace will use widely?**
→ Add it to [`./12-glossary.md`](./12-glossary.md). Modules cite the
anchor; never redefine.

**Are you defining a term that only one module uses?**
→ Add it to the module's charter under `arc42.glossary`.

---

## How a fact reaches every consumer

The CUE schema is the source of truth. Every consumer of module
metadata projects from it. This is the same composability move PKDS
made for design tokens (see [ADR 0022](../adr/0022-pkds-cue-authored-design-system-pipeline.md)).

```
<module>/MODULE.cue   ←  single source
       │
       ├──→  catalog/module_contracts.yaml          (catalog projection)
       ├──→  <module>/docs/doc.go                   (Go-importable projection)
       ├──→  <module>/docs/README.md                (human-readable projection)
       ├──→  .claude/generated/modules/<m>.md       (Claude / agent projection)
       ├──→  module skills manifest                  (agent runtime)
       ├──→  domains/<domain>/arc42.md §5            (domain transclusion)
       └──→  Antora module page                      (public docs site)
```

Authors edit `MODULE.cue`. The projector regenerates every output.
Drift between projections becomes mechanically impossible.

---

## Worked example

The first module to ship under the new stack is
`cookie_consent_management`. Read its charter end-to-end to see
what each section looks like in practice:

- Charter source: [`pk-modules/cookie_consent_management/MODULE.cue`](../../pk-modules/cookie_consent_management/MODULE.cue)
- Narrative: [`pk-modules/cookie_consent_management/MODULE.md`](../../pk-modules/cookie_consent_management/MODULE.md)
- Diagrams: [`pk-modules/cookie_consent_management/diagrams/`](../../pk-modules/cookie_consent_management/diagrams/)
- Domain home: [`./domains/governance/arc42.md`](./domains/governance/arc42.md)

---

## Migration status

ADR 0023 lays out seven phases. Status as of 2026-04-25:

- **Phase 0 — ADR + schema + worked example.** ✅ Shipped. ADR 0023 is in
  the catalogue; the schema is at
  [`../schemas/module_charter.cue`](../schemas/module_charter.cue);
  the cookie_consent_management worked example is fully written;
  the governance domain doc is the first domain to land.
- **Phase 1 — Generator and projections.** Pending. Requires
  `cmd/platformkit charter` (subcommands `init`, `project`, `check`).
- **Phase 2 — Analyzers.** Pending. Five charter analyzers wired into
  the business-modules `precommit` target.
- **Phase 3 — Bulk skeleton migration.** Pending. Generate skeleton
  `MODULE.cue` for the 45 remaining modules from existing metadata.
- **Phase 4 — Domain docs.** Pending. Author the seven remaining
  domain `arc42.md` files (governance is done).
- **Phase 5 — Narrative fill.** Pending. Domain owners write the
  narrative slots for the modules in their domain.
- **Phase 6 — Consolidate generated docs.** Pending. Delete
  `cmd/module-docs-generate`, the existing `<module>/README.md`
  stub, and `<module>/docs/{doc.go,README.md}` once the charter
  generator covers them.
