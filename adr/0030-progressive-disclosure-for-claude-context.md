---
title: "ADR 0030: CLAUDE.md and adjacent docs follow progressive disclosure — top files stay small, detail lives in linked files"
status: Accepted
date: 2026-05-10
slug: adr-0030-progressive-disclosure-for-claude-context
adr_topic: documentation
type: doc
tags: [adr, documentation, claude, context-budget, governance]
---

# ADR 0030 — CLAUDE.md and adjacent docs follow progressive disclosure — top files stay small, detail lives in linked files

Status: **Accepted** (2026-05-10)

## The problem

Claude loads every `CLAUDE.md` that sits above the working directory
into context on every turn. The transclusion is eager — anything those
files `@include` lands in the prompt before the assistant has done
anything. That makes the top of the documentation tree a context budget,
not just a docs surface. Files written at the *human* tier of detail
("here's everything you might want to know about this module") become
silent tax on every session, even sessions that never touch the
content.

The May 2026 readiness audit measured what we were spending. The
top-of-tree files for the two largest repos —
`.claude/generated/repos/pk-modules.md` (57 KB) and
`.claude/generated/repos/pk-core.md` (22 KB) — together
shipped roughly 18,000 tokens to the model on every turn, almost
entirely as an exhaustive `## Go Modules And Packages` enumeration:
~250 lines listing every Go import path inside business-modules, plus
~120 for backend-kit. The other 17 repo-level docs cap at 1 KB and
behave fine. The two outliers were the entire problem.

The cost is not just bytes. Eager content competes with the user's
actual prompt for attention; long boilerplate at the top of the
window pushes the user's question further down and weakens the
model's grasp of what it's been asked to do. Repeated text also
poisons retrieval: when 18,000 tokens of identical-shape lines
("- `github.com/septagon-oss/pk-modules/...`") sit
above every conversation, useful signal — the user's domain language,
the module's actual job — gets crowded out.

The pattern is general. Module-level `CLAUDE.md`, repo-level
`CLAUDE.md`, root-level `CLAUDE.md`, and any deeper `**/CLAUDE.md` all
have the same eager-load behaviour. As the workspace grows, the temptation
is to put more in the always-loaded layer "so Claude knows about it";
the actual effect is a steadily-shrinking effective context window plus
slower, more expensive turns.

## The decision

CLAUDE.md and the documentation it transcludes follow **progressive
disclosure**: the always-loaded top tier stays small and points at
detail; detail lives in linked files Claude reads on demand. We chose
size-budgeted top-tier files plus mechanical guards over voluntary
discipline because voluntary discipline has consistently lost to the
"add it to the top so it's discoverable" reflex.

The tier model is:

- **Tier 1 — `CLAUDE.md` (eagerly loaded, ≤ 2 KB)**: name the
  directory, state what it owns and what it doesn't, link to the
  documents the model should read when it needs more. Lists, schemas,
  and enumerations DO NOT belong here. Cross-references DO.
- **Tier 2 — Linked summary docs (loaded on demand, ≤ 8 KB)**: the
  per-module / per-feature contract — purpose, key entities, key
  ports, dependency triad, agent-invocation surface. The kind of
  thing a contributor reads once when they enter a module.
- **Tier 3 — Reference material (loaded on demand, no cap)**: full
  package listings, exhaustive schemas, runbooks, change histories.
  Live in `docs/`, `README.md`, or generated `.claude/generated/*`
  files. Tier 1 may link them; it must not transclude them.

Concretely:

- A repo's `CLAUDE.md` opens with two lines on what the repo owns,
  three lines on the entry points to look at first, and a short link
  list of where to find the rest. No package listings.
- A module's `CLAUDE.md` opens with the module's job, its tier,
  domain, key entities, and dependency triad — capped at 5 KB.
- Generated content that exceeds the budget gets split: a short
  `*.md` file under the budget that humans and Claude both read, plus
  a sibling `*.full.md` (or under `docs/`) that nobody transcludes
  but tools and curious humans can open.
- Cross-references use stable identifiers (`REQ-NNN`, `ADR-NNNN`,
  `C-NN` per ADR 0029) so a Tier-1 file pointing at a Tier-3
  document never embeds the document's content.

## What we gave up

- Authors must split their docs across two files when they exceed
  the budget — one short, one long. Slight friction on first author.
- Newcomers no longer get the full package map "for free" at the top
  of context. They have to ask, or `ls`. (The package map is a poor
  substitute for actually reading the code anyway.)
- The generators that produce `.claude/generated/repos/*.md` need a
  size-aware mode that emits the short version in the always-loaded
  spot and routes the exhaustive enumeration elsewhere.

## What we kept

- Every conversation gets back ~18,000 tokens of context window for
  the *actual* question. On a 200K window that's a 9% budget recovery
  per turn; on a compacted 40K window it's closer to 45%.
- The eager layer becomes scannable. A new contributor opening a
  module's `CLAUDE.md` reads the file in five seconds, not five
  minutes.
- Generated docs stay generated. We don't ban tooling-emitted
  enumerations — we move them out of the eager tier.
- The discipline composes with ADR 0023 (module documentation stack)
  and ADR 0029 (every file declares its purpose): all three are
  about teaching the workspace to introduce itself in layers rather
  than as a single firehose.

## How we enforce it

- **`check-claudemd-discipline`**
  (`pk-tools/cmd/check-claudemd-discipline/main.go`,
  verified by its package-local executable contract tests).
  Walks every `CLAUDE.md` in the workspace plus every file the
  encountered `@include` directives transclude, computes the
  effective eager-load size, and fails the build when:
    - a `CLAUDE.md` (or its transclusions) exceeds 2 KB at Tier 1, or
    - a module/feature `CLAUDE.md` exceeds 5 KB at Tier 2, or
    - any file in the eager set contains an "exhaustive enumeration"
      pattern (a contiguous list of ≥ 30 backtick-fenced bullet items
      with the same prefix — typically the package-listing shape).
  Failures name the file, the measured size, and the budget; the
  exclusion allowlist lives in the checker's reviewed configuration file
  so adding a category is a deliberate one-line diff.
- **Module-doc generator size mode**
  (`pk-modules/cmd/module-docs-generate`): emits a
  short `*.md` for the eager tier and a sibling `*.full.md` for the
  exhaustive listing. The eager file links to the full file; the full
  file does not auto-load. The same change applies to the workspace
  repo-doc generator.
- **Authoring template**
  (`pk-docs/templates/CLAUDE.md.tmpl`): hand-authored
  CLAUDE.md files start from a template that has the budget, the
  required sections, and a "Don't put this here" reminder list at
  the top.
- **Review rule** — pull requests that add content to a CLAUDE.md
  must call out the size delta. The guard rejects regressions, but
  reviewers should still ask "could this be a link instead?" before
  approving any new lines in the eager tier.
- Gap — Tier 2 files (linked summary docs) are not yet discovered
  automatically by the discipline check. The follow-up is a sibling
  `check-claudemd-discoverability` walker that reads every Tier-1
  `CLAUDE.md`, follows its outbound `@include` and `[link](...)`
  references, and warns when a Tier-2 file is reachable from no
  Tier-1 file. Tracked, not yet built.

## References

- [ADR 0023 — Module documentation stack](./0023-module-documentation-stack.md) — the prior decision about documentation surfaces; this ADR adds the size discipline to that stack.
- [ADR 0029 — Every file declares its purpose](./0029-every-file-declares-its-purpose.md) — the file-level analogue. Both decisions are about layering disclosure rather than dumping.
- [Convention C-08 — Workspace guards emit a single output format](../conventions.md#c-08-workspace-guards-emit-a-single-output-format) — the format the new discipline check follows.
- May 2026 readiness audit measurements (the 57 KB / 22 KB outliers).
