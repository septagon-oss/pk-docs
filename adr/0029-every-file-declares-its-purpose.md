---
title: "ADR 0029: Every Go file declares its purpose with structured traceability"
status: Accepted
date: 2026-05-06
slug: adr-0029-every-file-declares-its-purpose
adr_topic: governance
type: doc
tags: [adr, governance, conventions, file-organisation]
---

# ADR 0029 — Every Go file declares its purpose with structured traceability

Status: **Accepted** (2026-05-06)

> **Current authority:** [ADR 0064](./0064-file-purpose-traceability-is-a-blocking-workspace-invariant.md)
> restores this decision's universal,
> blocking target after ADR 0053's temporary de-scope and defines the
> exact-content historical-debt ratchet. Where enforcement mechanics here
> conflict with ADR 0064, ADR 0064 governs. Its repository-scope note
> distinguishes the full workspace gate from narrower public-repository
> wrappers.

## The problem

At the time of this decision, a workspace with 22 repos and roughly 3,500 Go
files was already accreting silent intent. A
file's reason for existing — why it sits in this package, why it owns
exactly this concern, why the split happened — lives in commit messages
and tribal memory, not in the file itself. Readers walking in cold
have to reverse-engineer the cohesion: read all the function names, see
what's imported, deduce the boundary. By the time they're confident,
they've spent the first thirty minutes of their session on archaeology
that the original author already did.

This came to a head during the May 2026 complexity sweep. We split nine
1000–2000-line files (`tenant_lifecycle/service.go`,
`audit_trail/table_handler.go`, `core/entity/repository/gorm.go`, and
six others) into 50+ siblings. The split was principled — each file
answered one cohesive question — but those questions live in the
commit messages, not in the files. A reader landing in
`gorm_authz.go` six months from now has no in-file signal that the
split was deliberate, what convention motivated it, or how to extend
it consistently.

The same problem exists at module-instance level (`module.go`),
boundary-port level (`contracts/provides/*.go`), and rendering-helper
level (`renderInput`, `renderFieldInput`, etc.) — every cohesion
choice we make today is invisible to tomorrow's reader unless the
file says so.

## The decision

Every Go file the workspace owns must declare its purpose in a leading
comment block. The comment carries **bidirectional traceability** —
implementation files cite the REQs they satisfy and the ADRs/conventions
that shape them; test files cite the REQs they validate.

Every complete header carries exactly three adjacent `//` comment lines in the
following order, one structured role for each governance layer:

- **`Implements:` or `Validates:`** cites a registered `REQ-NNN`,
  `REQ-{OWNER}-NNN`, or `PKBM-{MODULE}-REQ-NNN` (the *what*).
- **`Per:`** cites a registered `ADR-NNNN` (the *how decided*).
- **`Discipline:`** explicitly cites registered `C-14` (the *discipline*).

Additional requirements, ADRs, and conventions are encouraged when they
explain real design constraints, but they do not replace any of these three
roles.

Compact one-line declarations, reordered roles, and prose inserted between
the role lines remain non-conformant.

The structured header belongs within the first 100 physical lines measured
from the start of the file. Leading purpose comments may appear before or after
the `package` declaration, but must precede the first `import` or other
non-package declaration. For example:

```go
// service_audit.go owns audit-event recording for the tenant
// lifecycle service — extracted so service.go stays focused on
// the entity lifecycle.
//
// Implements: REQ-004 (audit event per mutation).
// Per: ADR-0007 (transactional outbox for event delivery).
// Discipline: C-14 (file purpose declaration).
```

Test files declare the inverse — *what they validate* — so the audit
trail closes both directions:

```go
// gorm_security_test.go — verification suite for the GORM repo's
// authorisation gate.
//
// Validates: REQ-001#AC-1, REQ-001#AC-2, REQ-007#AC-1.
// Per: ADR-0029 (file purpose declaration).
// Discipline: C-14 (file purpose declaration).
```

The identifier is the load-bearing part: `REQ-NNN`, `ADR-NNNN`, and
`C-NN` are workspace-stable identifiers that survive renames, moves,
and refactors. The free-text purpose line is for the human reader;
the IDs are for the guards.

The check is mechanical, not aspirational. Two tools enforce the
property:

- **`check-file-purpose`** (`platformkit-devtools/cmd/check-file-purpose`)
  — scans every governed hand-authored Go file and fails the workspace gate
  when a new or changed file lacks any structured role or cites an unknown
  identifier. The forward half of traceability. Unchanged inherited failures
  remain visible through ADR 0064's exact-content baseline.
- **`check-traceability`** (`platformkit-devtools/cmd/check-traceability`)
  — walks the REQ docs, parses the acceptance-criteria + verification
  tables, then walks Go files and validates that every REQ has at
  least one `Implements:` reference and one `Validates:` reference,
  and that test evidence cited in REQ verification tables resolves to
  a real test function. The reverse half.

Exclusions are an explicit allowlist for non-source material such as downloaded
caches, vendored output, build state, and testdata. Hand-authored tests,
migration embed wrappers, command implementations, and generator source under
`cmd/` are governed. Generated-looking names are insufficient: only Go's
canonical pre-package `// Code generated ... DO NOT EDIT.` marker proves
generated provenance. The exclusion list lives in reviewed YAML; inline
suppression is unsupported.

## What we gave up

- A small per-file overhead: every new file adds 3–5 lines of header
  comment. Roughly 0.1% of file size on a 200-line average.
- A coupling between file authoring and the authority registries — authors
  must identify the requirement the file implements or validates, the ADR
  governing it, and C-14. This is the point, not a cost: it forces the
  question "which requirement and decision govern this file?" at write time.
- A blocking workspace gate. A new or changed incomplete header fails until
  fixed; individual child repositories do not all expose the equivalent local
  target yet.

## What we kept

- Cold-readers gain a 30-second orient: the leading comment plus its
  role-labelled IDs resolves the file's purpose without reading the body.
- The requirement, ADR, and convention registries become load-bearing rather
  than archival. Authority with zero file references is a candidate for
  retirement; an ADR with a hundred references is part of the codebase's
  architectural spine.
- Refactors stay legible. When `service.go` splits into seven
  siblings, each sibling carries the cohesion claim at the top.
- Renames are cheap. Moving a file to a different package is still
  one `git mv`; the convention reference travels with it.

## How we enforce it

- `check-file-purpose`
  (`platformkit-devtools/cmd/check-file-purpose/main.go`,
  invoked via `platformkit verify file-purpose`, wired as
  `make check-file-purpose` at the workspace root and per repo).
  Walks every `.go` file under configured roots, verifies that those roots
  cover every root `go.work` member and every discovered standalone owned
  `go.mod` module, applies the exclusions from
  `.claude/check-file-purpose.yaml`, and emits a pass/fail report. Failures name
  incomplete structured roles, unknown IDs, and stale debt acknowledgements.
- Historical adoption debt is an exact path-and-SHA-256 inventory of unchanged
  committed violations. New and untracked files are never eligible; editing,
  deleting, or conforming an acknowledged file invalidates its entry and fails
  the gate until the source and inventory are reconciled.
- The exclusion allowlist is a deliberate inventory, not a filename trick.
  Canonical generated-file provenance is parsed; a marker after `package` or a
  `_gen.go` suffix cannot bypass the rule.
- `pkvet` follow-up — once the workspace is fully covered, the check
  graduates from "standalone tool" to a `pkvet` analyzer so it ships
  alongside the other static checks.
- Convention freshness check (gap, tracked) — a sibling tool that
  inverts the question: every `C-NN` and `ADR-NNNN` must have at
  least one file referencing it. Conventions with zero references
  become candidates for retirement. Not yet built; tracked as a
  follow-up.

## References

- [Convention C-14 — every Go file declares its purpose](../conventions.md#c-14-every-go-file-declares-its-purpose)
- [ADR 0023 — Module documentation stack](./0023-module-documentation-stack.md) — the prior decision about module-level docs that this complements at the file level.
- [`pk-docs/conventions.md`](../conventions.md) — the rules that file headers reference.
- May 2026 complexity sweep commits — the refactors that motivated this convention.
