---
title: "ADR 0064: File-purpose traceability is a blocking workspace invariant"
status: Accepted
date: 2026-07-15
slug: adr-0064-file-purpose-traceability-is-a-blocking-workspace-invariant
adr_topic: governance
type: doc
tags: [adr, governance, traceability, conformance]
affects: [ADR-0029, ADR-0053]
---

# ADR 0064 — File-purpose traceability is a blocking workspace invariant

Status: **Accepted** (2026-07-15)

> **Repository scope.** The canonical workspace gate runs from the full
> PlatformKit distribution and covers every owned Go module configured there.
> Public repositories may expose narrower local wrappers, but those wrappers
> do not weaken the workspace invariant. The full-distribution ADR 0053 that
> temporarily narrowed this rule is not reproduced in this smaller OSS ADR
> subset; its file-purpose item is superseded by this decision.

## The problem

Our written authority and our executable authority disagree. ADR 0029 made a
registered purpose reference mandatory for every owned Go file. ADR 0053 item
9 later narrowed that rule to selected boundary and compliance files and said
the check should warn rather than block. The workspace subsequently chose the
broader rule again: its root guidance requires every owned Go file to declare
purpose, and `check-file-purpose` fails on both missing and unknown references
across its configured repository roots.

Leaving that split in place is worse than either choice. Authors following ADR
0053 can reasonably treat a red build as accidental; authors following the
guard can reasonably cite a convention whose motivating ADR says the opposite.
Traceability itself cannot be credible while its authority chain is ambiguous.

## The decision

We restore ADR 0029's universal, blocking target for hand-authored Go files and
supersede ADR 0053 item 9's selective, warning-only scope. Every non-excluded
`.go` file in a root configured by `check-file-purpose` must carry the complete
structured triplet as exactly three adjacent `//` comment lines in its leading
comment block, in this order:

1. `Implements:` or `Validates:` names at least one registered cross-cutting
   requirement (`REQ-NNN`), owner requirement (`REQ-{OWNER}-NNN`), or module
   requirement (`PKBM-{MODULE}-REQ-NNN`).
2. `Per:` names at least one registered decision (`ADR-NNNN`).
3. `Discipline:` names registered convention `C-14` and may name additional
   registered conventions that genuinely apply.

The role labels, physical-line separation, and order are part of the contract;
merely mentioning three identifiers or compressing the declarations onto one
line does not declare the relationships. A missing or reordered role and a
reference to an unknown ID both fail the check.

The ordered triplet must appear within the first 100 physical lines measured
from the start of the file, before the first import or other non-package
declaration. It may appear immediately before or after the `package` clause.

The word *universal* describes the governed source surface, not generated or
vendored material. Downloaded caches, testdata, build state, and other
non-source categories in `.claude/check-file-purpose.yaml` remain explicit
directory exclusions. Generated-looking filenames do not qualify: Go output is
exempt only when its parsed pre-package comments contain the canonical
`// Code generated ... DO NOT EDIT.` marker. Hand-authored tests, migration
embed wrappers, command-line tools, and code generators are governed. New
exclusions are reviewed inventory changes; inline suppression is unsupported.

The initial adoption cannot truthfully pretend that all historical source is
already conformant. We therefore acknowledge the exact inventory recorded in
the reviewed, static baseline. Each entry binds a workspace-relative path to
the SHA-256 digest of the committed file bytes. The baseline is a one-way debt
ratchet, not an allowlist:

- New and untracked files are never eligible.
- Editing an acknowledged file invalidates its digest, so that file must be
  brought into conformance as part of the edit.
- Deleting or conforming an acknowledged file leaves a stale entry, which also
  fails until the acknowledgement is removed.
- Regenerating the baseline is an explicit, reviewed debt decision and is not
  part of the normal check or CI path.

Consequently the gate blocks every new or changed violation while reporting
the precise unchanged historical balance on every run. Universal conformance
remains the destination; the baseline makes progress monotonic and observable
without disguising inherited debt.

## What we gave up

- Every new hand-authored Go file carries a small metadata cost even when its
  purpose seems obvious from the package.
- Renaming or retiring an authority ID can require coordinated source-header
  updates because stale IDs are build failures.
- The workspace check remains broader than every individual repository's local
  wrapper, so the root gate is the definitive conformance pass.

## What we kept

- Requirements, decisions, conventions, and implementation remain connected
  by machine-checkable stable identifiers and explicit relationship roles.
- Explicit exclusions keep generated and mechanical source out of a rule meant
  for human-authored design intent.
- Authors choose the requirement and ADR that actually govern the file, while
  C-14 records the universal file-purpose discipline. Additional conventions
  are cited only when they materially apply.

## How we enforce it

- `platformkit-devtools/cmd/check-file-purpose/main.go` loads the convention,
  ADR, and requirement registries, scans the configured roots, and exits
  non-zero for a missing structured role, an invalid leading reference,
  changed baseline files, or stale baseline acknowledgements.
- Workspace `make check-file-purpose` is the canonical invocation.
- `.claude/check-file-purpose.yaml` owns repository roots, the 100-line header
  window, registry paths, explicit exclusions, and baseline location.
- The checker validates that those roots cover every owned Go module: root
  `go.work` members and standalone `go.mod` modules discovered outside explicit
  archive, recovery, generated, dependency-cache, vendor, and Git-worktree
  trees. Adding an owned module without governance is a hard configuration
  error.
- `platformkit-devtools/config/check-file-purpose-baseline.txt` is the reviewed
  static debt inventory. Normal output reports the number of entries that still
  match exactly; successful checks are therefore not silent about remaining
  debt.
- Maintainers may rebuild that inventory only through the explicit
  `-write-baseline-from-head` maintenance flag. It snapshots unchanged
  violations from child-repository `HEAD`s and refuses to launder dirty or
  untracked working-tree violations. A regenerated file requires ordinary code
  review like any other governance change.
- Runtime commands and generator implementations under `cmd/`, hand-authored
  tests, and Go migration wrappers are included. Only canonical generated-file
  provenance exempts generated Go output.
- Root agent guidance treats C-14 as a never-break invariant, so human and agent
  authoring instructions match the executable gate.
- Gap — not every child repository exposes an equivalent local Make target;
  passing a local repo check alone is not evidence that the workspace-wide
  traceability gate passed.

## References

- [ADR 0029 — Every Go file declares its purpose with structured traceability](./0029-every-file-declares-its-purpose.md).
- Full-distribution ADR 0053, item 9 — superseded here only for file-purpose
  scope and severity; not reproduced in this OSS subset.
- [Convention C-14 — Every Go file declares its purpose](../conventions.md#c-14-every-go-file-declares-its-purpose).
