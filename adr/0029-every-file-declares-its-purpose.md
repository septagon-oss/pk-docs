---
title: "ADR 0029: Every Go file declares its purpose with a convention or ADR reference"
status: Accepted
date: 2026-05-06
slug: adr-0029-every-file-declares-its-purpose
adr_topic: governance
type: doc
tags: [adr, governance, conventions, file-organisation]
---

# ADR 0029 — Every Go file declares its purpose with a convention or ADR reference

Status: **Accepted** (2026-05-06)

## The problem

A workspace with 22 repos and ~3,500 Go files accretes silent intent. A
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

Three identifier classes are accepted, each pointing at a different
governance layer:

- **`REQ-NNN`** — a registered requirement (the *what*).
- **`ADR-NNNN`** — a registered architectural decision (the *how decided*).
- **`C-NN`** — a registered convention (the *discipline*).

Files prefer to reference the highest-stability layer that fits — REQ
for files that embody a system property, ADR for files that embody a
decision, C for files that embody a rule. Most files reference at
least one of any of the three.

The reference belongs in the first 30 lines of the file (after the
`package` declaration, before the first `import`), in a comment of
the form:

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
```

The identifier is the load-bearing part: `REQ-NNN`, `ADR-NNNN`, and
`C-NN` are workspace-stable identifiers that survive renames, moves,
and refactors. The free-text purpose line is for the human reader;
the IDs are for the guards.

The check is mechanical, not aspirational. Two tools enforce the
property:

- **`check-file-purpose`** (`platformkit-devtools/cmd/check-file-purpose`)
  — scans every Go file in the workspace and fails the build when one
  lacks any reference. The forward half of traceability.
- **`check-traceability`** (`platformkit-devtools/cmd/check-traceability`)
  — walks the REQ docs, parses the acceptance-criteria + verification
  tables, then walks Go files and validates that every REQ has at
  least one `Implements:` reference and one `Validates:` reference,
  and that test evidence cited in REQ verification tables resolves to
  a real test function. The reverse half.

Exclusions are an explicit allowlist: generated code, manifest
schemas, migrations, atom/molecule definition files, and `cmd/*/main.go`
generators. The exclusion list lives in a YAML file the tools read, so
adding a category is a deliberate one-line diff rather than a quiet
`//nolint`.

## What we gave up

- A small per-file overhead: every new file adds 3–5 lines of header
  comment. Roughly 0.1% of file size on a 200-line average.
- A coupling between file authoring and the conventions registry —
  authors must know which `C-NN` or `ADR-NNNN` motivates their file.
  This is the point, not a cost: it forces the question "which rule
  am I following?" at write time.
- A blocking CI step. The check runs on every push; a missing header
  fails the build until fixed.

## What we kept

- Cold-readers gain a 30-second orient: the leading comment plus the
  ID resolves the file's purpose without reading the body.
- The conventions and ADRs registry becomes load-bearing rather than
  archival. A convention with zero file references is a candidate for
  deletion; an ADR with a hundred references is the spine of the
  codebase.
- Refactors stay legible. When `service.go` splits into seven
  siblings, each sibling carries the cohesion claim at the top.
- Renames are cheap. Moving a file to a different package is still
  one `git mv`; the convention reference travels with it.

## How we enforce it

- `check-file-purpose`
  (`platformkit-devtools/cmd/check-file-purpose/main.go`,
  invoked via `platformkit verify file-purpose`, wired as
  `make check-file-purpose` at the workspace root and per repo).
  Walks every `.go` file under the workspace, applies the exclusion
  allowlist from `.claude/check-file-purpose.yaml`, and emits a
  pass/fail report. Failures name the missing file plus a hint
  pointing at the closest matching convention.
- The exclusion allowlist is a deliberate inventory, not a wildcard
  list. Adding `**/manifestschema/*.gen.go` is a one-line diff that
  reviewers see and can reject.
- `pkvet` follow-up — once the workspace is fully covered, the check
  graduates from "standalone tool" to a `pkvet` analyzer so it ships
  alongside the other static checks.
- Convention freshness check (gap, tracked) — a sibling tool that
  inverts the question: every `C-NN` and `ADR-NNNN` must have at
  least one file referencing it. Conventions with zero references
  become candidates for retirement. Not yet built; tracked as a
  follow-up.

## References

- [Convention C-14 — every file declares its purpose](../conventions.md#c-14-every-file-declares-its-purpose)
- [ADR 0023 — Module documentation stack](./0023-module-documentation-stack.md) — the prior decision about module-level docs that this complements at the file level.
- [`pk-docs/conventions.md`](../conventions.md) — the rules that file headers reference.
- May 2026 complexity sweep commits — the refactors that motivated this convention.
