---
id: REQ-NNN
title: "<one-sentence requirement>"
status: Proposed
date: YYYY-MM-DD
slug: req-NNN-short-slug
category: <tenancy|auth|audit|compliance|availability|performance|data-durability|governance>
ears_pattern: <ubiquitous|event-driven|state-driven|optional|unwanted-behaviour>
verification_methods:
  - <test|analysis|inspection|demonstration>
compliance: []                         # e.g. [SOC2_CC6.1, ISO27001_A.9.4]
satisfied_by:
  adr: [ADR-NNNN]
  conventions: [C-NN]
type: doc
tags: [requirement]
---

# REQ NNN — <one-sentence requirement>

Status: **Proposed** (YYYY-MM-DD)

> **Voice guide.** A REQ names a property the running system must
> hold. Use EARS-style verb forms ("shall", "shall not"). Implementation
> language belongs in the ADR; observable evidence belongs in this
> document's Verification section.

## Statement

One EARS-formatted sentence (or short paragraph). Pick the EARS pattern
that fits and write the corresponding shape:

- *Ubiquitous*: "The system **shall** X."
- *Event-driven*: "**When** Y, the system **shall** X."
- *State-driven*: "**While** Y, the system **shall** X."
- *Optional*: "**Where** Y is configured, the system **shall** X."
- *Unwanted behaviour*: "**If** Y, **then** the system **shall** X (often `shall not`)."

## Rationale

Two or three short paragraphs. Who relies on this property — operators,
regulators, paying tenants, contractual counterparties? What goes wrong
if it fails? Cite the incident, audit finding, or contract clause that
motivates it.

## Acceptance criteria

The criteria are *testable* — each one names an observable behaviour or
artefact a reviewer (or analyzer) can check. Number them `AC-1`, `AC-2`,
…; the IDs are referenced from the Verification table and from
individual tests.

- **AC-1** What you would see if the requirement is satisfied.
- **AC-2** Another observable, complementary to AC-1 (perhaps the
  failure-mode behaviour).
- **AC-3** Optional — a stress / failure-mode acceptance criterion.

Each AC must be possible to verify with one of the four methods listed
in `verification_methods` frontmatter.

## Verification

A row per AC. The Method column is one of `Test`, `Analysis`,
`Inspection`, `Demonstration`. The Evidence column points at the exact
artefact a reviewer can re-run or read:

- For `Test`: `<go-package-path>/<file>.go::<TestFunctionName>`. The
  function is expected to fail when the AC is violated. The test itself
  declares `Validates: REQ-NNN#AC-N` in its file header so
  `check-traceability` resolves the link.
- For `Analysis`: the analyzer name and what it inspects (e.g.
  `analysis/importboundary` — rejects cross-module implementation
  imports).
- For `Inspection`: a manual review checklist plus the document or
  config reviewers consult.
- For `Demonstration`: the runbook or recorded session that exercises
  the behaviour against a live system.

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `path/to/file_test.go::TestSomething` |
| AC-2 | Analysis | `analyzer-name` |
| AC-3 | Demonstration | `runbooks/demo-X.md` |

## Satisfied by

The ADRs (and conventions) that carry the implementation. Each entry is
one line: which decision contributes what. Files that implement this
REQ declare `Implements: REQ-NNN` in their header so `check-traceability`
resolves the forward link.

- [ADR NNNN — title](../adr/NNNN-slug.md) — what this ADR contributes
  to satisfying the REQ.
- [Convention C-NN — title](../conventions.md#c-nn-slug) — the
  discipline the implementation follows.

## Compliance traceability

Optional. Map this REQ to the regulatory or contractual frames it
contributes to so an auditor can produce a coverage report by querying
the registry. Entries match the `compliance` list in frontmatter.

- **SOC2_CC6.1** — logical access controls. This REQ is part of the
  evidence pack for the access-control criterion.
- **ISO27001_A.9.4** — information access restriction.

## Related requirements

Optional. REQs that compose with or constrain this one.

- [REQ-NNN — title](./REQ-NNN-slug.md) — relationship in one line.

## References

- Motivating commits, incident reports, audit findings.
- External material (regulations, contracts, RFCs).

---

## Authoring notes (delete before committing)

- Number the file with the next free `NNN` (zero-padded to three).
- Frontmatter and h1 must agree on the title.
- A REQ that boils down to "we use technology X" is an ADR, not a REQ.
- A REQ with zero acceptance criteria can't be verified — it's an
  aspiration, not a requirement. Re-write or retire it.
- Every `verification_methods` entry must be exercised by at least one
  AC's Evidence row. `check-traceability` enforces this.
