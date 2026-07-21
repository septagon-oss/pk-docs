---
id: REQ-008
title: "Every Go file declares its purpose with a registered reference"
status: Active
date: 2026-05-06
updated: 2026-07-20
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

Status: **Active** (2026-05-06), revised 2026-07-20.

> **Revision 2 amendment (2026-07-20).** Initial C-14 adoption used a
> content-addressed historical-debt ratchet. Adoption debt is now zero, so the
> acknowledgement file, configuration, refresh operation, and matching path
> are retired. Every governed file now satisfies this requirement or fails the
> canonical gate directly.

## Statement

Every governed hand-authored `.go` file the workspace owns **shall** carry a
structured purpose header within the first 100 physical lines, before imports
or other declarations. The header may appear before or after `package`, and
**shall** contain all three roles as exactly three adjacent `//` comment lines
in this order:

- `Implements:` (or `Validates:` for test evidence) with a registered
  `REQ-NNN`, `REQ-{OWNER}-NNN`, or `PKBM-{MODULE}-REQ-NNN`;
- `Per:` with a registered `ADR-NNNN`; and
- `Discipline:` with registered `C-14`.

A compact one-line triplet, reordered roles, or prose inserted between the
three lines does not satisfy the header contract.

Every referenced ID **shall** resolve to the configured requirement, ADR, or
convention registry. A generated-looking filename is not an exemption;
generated Go is outside this rule only when its parsed pre-package comments
contain Go's canonical `// Code generated ... DO NOT EDIT.` marker.

## Rationale

A large multi-repository workspace accretes silent intent.
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

- **AC-1** Every governed hand-authored `.go` file has the requirement,
  `Per:` ADR, and explicit `Discipline: C-14` roles on three adjacent `//`
  lines in that order within the leading 100 physical lines.
- **AC-2** Every cited requirement, ADR, and convention resolves; a typo,
  stale ID, or invented owner-prefixed requirement fails the gate.
- **AC-3** Hand-authored tests, command and generator implementations, and Go
  migration wrappers remain governed. Only explicit non-source directories
  and canonically marked generated Go are excluded.
- **AC-4** Every owned Go module is covered by a configured scan root. This
  includes root `go.work` members and standalone `go.mod` modules discovered
  outside explicit archive, recovery, generated, dependency-cache, vendor, and
  Git-worktree trees; an omitted module is a hard configuration error.
- **AC-5** The checker has one current validation path with no historical-debt
  acknowledgement or compatibility exception; every nonconformant governed
  file appears in the failing result.
- **AC-6** Workspace `make check-file-purpose` exits non-zero for every
  incomplete header or unknown ID.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `pk-tools/cmd/check-file-purpose/main_test.go::TestPurposeHeaderRequiresStructuredRequirementADRAndC14Roles`. |
| AC-2 | Test | `pk-tools/cmd/check-file-purpose/main_test.go::TestPrefixedRequirementCannotHideBehindValidConvention` and `pk-tools/cmd/check-file-purpose/main_test.go::TestLoadValidIDsIncludesCanonicalADRAndStrictDocRequirementShapes`. |
| AC-3 | Test | `pk-tools/cmd/check-file-purpose/main_test.go::TestScanExcludesCanonicalGeneratedSourceByProvenance`, `pk-tools/cmd/check-file-purpose/main_test.go::TestGeneratedMarkerAfterPackageCannotBypassGuard`, and `pk-tools/cmd/check-file-purpose/main_test.go::TestMarkerlessGeneratedSuffixCannotBypassGuard`. |
| AC-4 | Test | `pk-tools/cmd/check-file-purpose/main_test.go::TestValidateModuleCoverageRejectsOmittedGoWorkModules` and `pk-tools/cmd/check-file-purpose/main_test.go::TestValidateModuleCoverageRejectsStandaloneOwnedModules`. |
| AC-5 | Test | `pk-tools/cmd/check-file-purpose/main_test.go::TestScanReportsEveryNonconformantFile`. |
| AC-6 | Analysis | Workspace `make check-file-purpose`; the root target is the canonical blocking invocation. |

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
- `pk-tools/cmd/check-file-purpose/main.go` — the guard
  implementation.
