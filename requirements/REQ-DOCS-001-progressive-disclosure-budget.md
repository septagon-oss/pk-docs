---
id: REQ-DOCS-001
title: "Claude context guard enforces per-tier eager-load budgets"
status: Active
date: 2026-05-10
slug: req-docs-001-progressive-disclosure-budget
category: governance  # cmd/-only implementation; traceability policy excludes /cmd/, so this REQ is docs/analysis-satisfied
ears_pattern: ubiquitous
verification_methods:
  - test
satisfied_by:
  adr: [ADR-0030]
  conventions: []
type: doc
tags: [requirement, documentation, claude, context-budget]
---

# REQ DOCS-001 — Claude context guard enforces per-tier eager-load budgets

Status: **Active** (2026-05-10)

## Statement

The canonical Claude context checker **shall** evaluate `CLAUDE.md`
files and their `@<path>` transclusions against the byte budget defined
for each tier in
[ADR-0030](../adr/0030-progressive-disclosure-for-claude-context.md):

| Tier | Path                                        | Eager budget |
|------|---------------------------------------------|--------------|
| Root | `CLAUDE.md`, `*/CLAUDE.md`                  | ≤ 2 KB       |
| Module | linked summary docs under `.claude/generated/` and module-level CLAUDE.md transclusions | ≤ 5 KB |
| Detail | full reference docs, package indexes, exhaustive lists | no cap; loaded on demand only |

The checker **shall** reject a contiguous list of 30 or more bullet
items in eager content and shall ignore workspace-owned `.tmp-*`
transient directories without ignoring canonical source directories.

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

- **AC-1** The checker reports a root-tier `CLAUDE.md` whose effective
  content exceeds 2 KB after `@`-transclusions are resolved.
- **AC-2** The checker reports a module-tier `CLAUDE.md` whose effective
  content exceeds 5 KB after transclusion.
- **AC-3** The checker reports an eager transclusion containing a
  contiguous list of 30 or more bullet items.
- **AC-4** The checker ignores `.tmp-*` transient directories while
  continuing to scan canonical source directories.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `pk-tools/cmd/check-claudemd-discipline/main_test.go::TestEvaluateEnforcesRootAndModuleBudgets` proves the exact root-tier budget. |
| AC-2 | Test | `pk-tools/cmd/check-claudemd-discipline/main_test.go::TestEvaluateEnforcesRootAndModuleBudgets` proves the exact module-tier budget. |
| AC-3 | Test | `pk-tools/cmd/check-claudemd-discipline/main_test.go::TestEvaluateRejectsExhaustiveTranscludedEnumeration` proves the exact enumeration threshold. |
| AC-4 | Test | `pk-tools/cmd/check-claudemd-discipline/main_test.go::TestShouldIgnoreWorkspaceTransientDirectories` proves transient-directory filtering without a canonical-source exemption. |

## Satisfied by

- [ADR-0030 — Progressive disclosure for Claude context](../adr/0030-progressive-disclosure-for-claude-context.md) —
  the architectural decision that defines the tier model and budgets.
- `pk-tools/cmd/check-claudemd-discipline/` — the guard
  implementation.

## Related requirements

- [REQ-008](REQ-008-every-file-declares-purpose.md) — sister discipline
  for Go files; both keep generated context lean.

## References

- May 2026 progressive-disclosure landing — the work that surfaced
  the 57 KB / 18,000-token-per-turn smoking gun.
