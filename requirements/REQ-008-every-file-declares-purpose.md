---
id: REQ-008
title: "Every Go file declares its purpose with a registered reference"
status: Active
date: 2026-05-06
slug: req-008-every-file-declares-purpose
category: governance
ears_pattern: ubiquitous
verification_methods:
  - analysis
satisfied_by:
  adr: [ADR-0029]
  conventions: [C-14]
type: doc
tags: [requirement, governance]
---

# REQ 008 — Every Go file declares its purpose with a registered reference

Status: **Active** (2026-05-06)

## Statement

Every `.go` file the workspace owns **shall** carry a leading comment
block, in the first 30 lines after the `package` declaration, that
includes at least one reference to a registered governance ID
(`REQ-NNN`, `ADR-NNNN`, or `C-NN`). Each referenced ID **shall** resolve
to a real entry in `pk-docs/requirements/`,
`pk-docs/adr/`, or `pk-docs/conventions.md`.

## Rationale

A workspace with 22 repos and ~3,500 Go files accretes silent intent.
Cohesion choices — why this file owns this concern, why a refactor
landed, which discipline the file follows — live in commit messages
and tribal memory rather than the file itself. Readers walking in cold
spend the first thirty minutes reverse-engineering the cohesion the
original author already knew.

Beyond legibility, the property keeps the governance registries
load-bearing. A REQ, ADR, or convention that no file references is a
candidate for retirement; one with many references is the spine of the
codebase. Without per-file references, the registries drift into
archives — read once, never re-checked. The discipline keeps the
documents alive by making them part of the build.

## Acceptance criteria

- **AC-1** Every `.go` file under the configured workspace roots either
  carries a registered `REQ-NNN` / `ADR-NNNN` / `C-NN` reference in
  its leading comment block, or appears in the explicit exclusion
  allowlist at `.claude/check-file-purpose.yaml`.
- **AC-2** Every reference resolves: a typo, a stale ID, or a reference
  to a retired convention fails the build.
- **AC-3** The exclusion allowlist names the exact categories that
  legitimately escape the rule (generated code, manifest schemas,
  migrations, atom/molecule definition seeds, `cmd/*` generators).
- **AC-4** `make check-file-purpose` runs in CI on every push; the
  build is red until the missing reference is added or the
  exclusion is justified by a one-line YAML diff.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Analysis | `make check-file-purpose` (`platformkit-devtools/cmd/check-file-purpose`). |
| AC-2 | Analysis | `make check-file-purpose` — `loadValidIDs` cross-checks references against `conventions.md`, the `adr/` directory, and the `requirements/` directory; unknown IDs fail with exit 1. |
| AC-3 | Analysis | `make check-file-purpose` reads exclusions from `.claude/check-file-purpose.yaml`. New entries require a deliberate one-line diff. |
| AC-4 | Analysis | CI workflow invokes the tool; the build is red on any failure. |

## Satisfied by

- [ADR 0029 — Every Go file declares its purpose](../adr/0029-every-file-declares-its-purpose.md) —
  the architectural decision that established the per-file reference
  convention and the guard that enforces it.
- [Convention C-14 — Every Go file declares its purpose](../conventions.md#c-14-every-go-file-declares-its-purpose) —
  the mechanical rule reviewers and authors follow.

## Related requirements

(None today. Future "every package declares its public contracts"
or "every module declares its supported set" REQs would compose with
this one at higher granularity.)

## References

- May 2026 complexity sweep — the sequence of refactors that motivated
  this REQ.
- `platformkit-devtools/cmd/check-file-purpose/main.go` — the guard
  implementation.
