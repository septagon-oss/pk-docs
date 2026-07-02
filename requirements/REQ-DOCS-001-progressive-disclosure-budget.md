---
id: REQ-DOCS-001
title: "Eager-loaded Claude documentation stays under the per-tier byte budget"
status: Active
date: 2026-05-10
slug: req-docs-001-progressive-disclosure-budget
category: governance  # cmd/-only implementation; traceability policy excludes /cmd/, so this REQ is docs/analysis-satisfied
ears_pattern: ubiquitous
verification_methods:
  - analysis
satisfied_by:
  adr: [ADR-0030]
  conventions: []
type: doc
tags: [requirement, documentation, claude, context-budget]
---

# REQ DOCS-001 — Eager-loaded Claude documentation stays under the per-tier byte budget

Status: **Active** (2026-05-10)

## Statement

Every Markdown document that Claude eagerly loads on every turn —
`CLAUDE.md` files at the workspace root, repo root, or module root,
and any document those files transclude with the `@<path>` syntax —
**shall** stay under the byte budget defined for its tier in
[ADR-0030](../adr/0030-progressive-disclosure-for-claude-context.md):

| Tier | Path                                        | Eager budget |
|------|---------------------------------------------|--------------|
| Root | `CLAUDE.md`, `*/CLAUDE.md`                  | ≤ 2 KB       |
| Module | linked summary docs under `.claude/generated/` and module-level CLAUDE.md transclusions | ≤ 5 KB |
| Detail | full reference docs, package indexes, exhaustive lists | no cap; loaded on demand only |

No Markdown document Claude auto-loads **shall** contain a contiguous
list of 30 or more bullet items — exhaustive enumerations are
detail-tier content and **shall** be moved to the on-demand `.full.md`
sibling.

## Rationale

Claude's prompt cache has a 5-minute TTL. Anything Claude eagerly
loads is paid for on every turn that misses the cache, and the
read-cost of large files dominates the round-trip. A 57 KB CLAUDE.md
in a single repo costs ≈ 18,000 tokens per turn. Multiplied across
the 22-repo workspace, the eager surface alone could swamp the
working budget before the assistant has read a single source file.

Progressive disclosure inverts the default: the eager tier carries
just enough to know where to look; the detail lives in linked files
that Claude reads only when the task touches them. The byte budget
makes the rule machine-checkable rather than a stylistic preference.

## Acceptance criteria

- **AC-1** No `CLAUDE.md` file at the workspace root or a repo root
  exceeds 2 KB after `@`-transclusions are resolved.
- **AC-2** No module-level summary doc (under
  `.claude/generated/modules/` or transcluded into a module's
  `CLAUDE.md`) exceeds 5 KB after transclusion.
- **AC-3** No eager-tier document contains a contiguous list of 30
  or more bullet items.
- **AC-4** `make check-claude-discipline` runs in CI on every push;
  the build is red until the offending file is split into eager +
  on-demand siblings or the budget is restructured.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Analysis | `make check-claude-discipline` enforces the 2 KB root-tier budget after `@`-transclusion. |
| AC-2 | Analysis | `make check-claude-discipline` enforces the 5 KB module-tier budget after `@`-transclusion. |
| AC-3 | Analysis | `make check-claude-discipline` rejects contiguous bullet runs of 30+ in any eager-tier doc. |
| AC-4 | Analysis | The workspace `Makefile`'s `check-all` target runs `check-claude-discipline`; CI invokes it on every push. |

## Satisfied by

- [ADR-0030 — Progressive disclosure for Claude context](../adr/0030-progressive-disclosure-for-claude-context.md) —
  the architectural decision that defines the tier model and budgets.
- `platformkit-devtools/cmd/check-claudemd-discipline/` — the guard
  implementation.

## Related requirements

- [REQ-008](REQ-008-every-file-declares-purpose.md) — sister discipline
  for Go files; both keep generated context lean.

## References

- May 2026 progressive-disclosure landing — the work that surfaced
  the 57 KB / 18,000-token-per-turn smoking gun.
