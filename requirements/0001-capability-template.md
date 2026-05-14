---
id: REQ-MOD-NNN
title: "<one-sentence capability requirement>"
status: Proposed
date: YYYY-MM-DD
slug: req-mod-nnn-short-slug
category: <module-named category, e.g. user, auth, billing>
ears_pattern: <ubiquitous|event-driven|state-driven|optional|unwanted-behaviour>
priority: <must|should|could>
risk: <low|medium|high|critical>
verification_methods: [test, inspection]
compliance:
  - SOC2_CC6.1   # short note on the control's relevance
  - ISO27001_A.9.4
satisfied_by:
  adr: [ADR-NNNN]
  conventions: [C-04, C-14]
implements_cross_cutting: [REQ-001, REQ-004]
refines: REQ-MOD-NNN          # the feature umbrella this capability narrows
depends_on: [REQ-MOD-NNN]      # optional — other capabilities this builds on
type: doc
tags: [requirement, capability, <module>, <feature>, <capability slug>]
module: <module_name>           # e.g. auth_management
feature: <feature_dirname>      # e.g. authentication
capability: <capability_slug>   # e.g. login_credentials
capability_kind: <state_machine|failure_mode|inter_module_contract|data_invariant>
stakeholders:
  - <role> (<concrete consumer relationship>)
---

# REQ MOD-NNN — <Capability title>

Status: **Proposed** (YYYY-MM-DD)

> **Voice guide.** A capability REQ names ONE method (or one tightly-bound
> method group) inside ONE feature. The lean rule: this REQ exists only
> when the method has acceptance criteria the cross-cuttings can't
> deliver. If pure CRUD governed by REQ-001..017 covers it, do not write
> a capability REQ — extend the feature umbrella instead.

## Statement

One EARS-formatted sentence or numbered list. Use the trigger that
matches `ears_pattern`:

- *Ubiquitous*: "`Service::Method(...)` **shall** X."
- *Event-driven*: "**When** Y, the system **shall** X."
- *State-driven*: "**While** Y, the system **shall** X."
- *Optional*: "**Where** Y is configured, the system **shall** X."
- *Unwanted behaviour*: "**If** Y, the system **shall not** X."

For multi-step orchestrations, write a numbered list under the
trigger sentence. Reference cross-cutting REQs explicitly in-line
where the discipline is theirs.

## Rationale

Two or three short paragraphs naming the discipline, the threat model,
and the property this REQ encodes that the cross-cuttings cannot.
Justify the `capability_kind:` choice — explain why this method has
ACs that cross-cuttings alone can't deliver.

## Acceptance criteria

Each AC names an observable behaviour or artefact. The modern format
includes a short bolded title alongside the label so the reader can
scan the AC list:

- **AC-1 — Happy path.** What you would see when the capability is
  satisfied on the canonical input.
- **AC-2 — Failure-mode opacity.** The discipline-specific failure
  shape — typed sentinel, uniform response, no information leak.
- **AC-3 — Edge-case behaviour.** A specific edge the cross-cuttings
  can't decide for this method.
- **AC-N — Observability.** What a metric / span / event records on
  this path (cross-references REQ-009).

Aim for 4–8 ACs. Fewer suggests under-decomposition; more suggests the
capability bundles two surfaces and should split.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `path/to/file_test.go::TestThing_HappyPath` |
| AC-2 | Test | `path/to/file_test.go::TestThing_FailureShape` |
| AC-3 | Inspection | `service.go::Method` lines NN–MM — the documented branch. Dedicated test pending. |

For Test rows: cite a real test that exists; do not invent a name from
the AC wording. If no test covers the AC yet, downgrade the row to
`Inspection` with a `Verification gap: <what is pending>` note. The
post-mortem fabrication audit (commit 72458c8) is precedent for honest
gap markers.

## Edge cases & unhappy paths

Bulleted list. The cases that don't get their own AC but a reviewer
should still understand. Document the chosen trade-off where the
behaviour is non-obvious.

- **Concurrent X.** What happens; the chosen trade-off (last-write-wins,
  optimistic-locking, etc.).
- **Cache outage during Y.** Fail-soft / fail-closed choice and why.
- **Schema growth.** What reviewers must audit when the data shape
  evolves.

## Risk

- **Likelihood:** <low|medium|high|critical> — exercised at <cadence>.
- **Impact:** <low|medium|high|critical> — what breaks when this REQ
  is defective.
- **Mitigations:** ACs that close the worst-case + companion REQs that
  share the load.

## Implements (cross-cutting)

For each cross-cutting REQ in `implements_cross_cutting:`, name which
ACs are the runtime witnesses. This is what an auditor reads to
confirm the capability is part of the cross-cutting evidence pack.

- **REQ-001 — Multi-tenant isolation.** AC-N + AC-M — the
  tenant-scope enforcement points.
- **REQ-004 — Audit per mutation.** AC-N — the catalogued event.
- **REQ-005 — Fail-closed.** AC-N — the default-deny path.

## Compliance mapping

| Control | Coverage |
|---|---|
| SOC2 CC6.1 | AC-N — short justification. |
| ISO27001 A.9.4 | AC-N — short justification. |

## Satisfied by

- `path/to/feature/file.go::Method` — what this file contributes.
- `path/to/feature/helper.go` — sub-component this method consumes.

The implementation file's leading comment **must** declare
`Implements: REQ-MOD-NNN` so `check-traceability` resolves the
forward link.

## Related requirements

- [REQ-MOD-NNN — Feature umbrella](./REQ-MOD-NNN-slug.md) — the
  umbrella this capability refines.
- [REQ-MOD-NNN — Sibling capability](./REQ-MOD-NNN-slug.md) — relates
  via shared method or shared state.
- [REQ-NNN — Cross-cutting](./REQ-NNN-slug.md) — the cross-cutting
  discipline this capability instruments.

## References

- Motivating commit, incident, audit finding.
- External standard (RFC, OWASP ASVS, NIST control).

---

## Authoring notes (delete before committing)

- Number the file `REQ-{MOD}-NNN-slug.md` with NNN ≥ 010 (capability
  range) and the next free number for the module.
- Frontmatter `id` and `# h1` must agree.
- The `capability_kind:` value must be one of: `state_machine`,
  `failure_mode`, `inter_module_contract`, `data_invariant`.
- Do not echo the cross-cutting REQ. If every AC is "REQ-001 also says
  this", drop the capability and extend the umbrella.
- `check-traceability --strict-capabilities` will refuse this REQ in
  CI if `module:` / `feature:` / `capability:` / `capability_kind:` /
  `refines:` are missing, or if no non-wiring source file declares
  `Implements: REQ-MOD-NNN`.
