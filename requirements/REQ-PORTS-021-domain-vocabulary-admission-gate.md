---
id: REQ-PORTS-021
title: "Capability-port exports exclude business-domain vocabulary unless an ADR authorizes it"
status: Proposed
date: 2026-07-15
slug: req-ports-021-domain-vocabulary-admission-gate
category: governance
ears_pattern: unwanted-behaviour
priority: must
risk: high
verification_methods: [test, inspection]
satisfied_by:
  adr: [ADR-0009]
  conventions: [C-04, C-14]
implements_cross_cutting: [REQ-002]
refines: REQ-PORTS-006
type: doc
tags: [requirement, capability, ports, admission, vocabulary]
module: platformkit_ports
feature: admission
capability: domain_vocabulary_gate
capability_kind: data_invariant
---

# REQ PORTS-021 — Domain vocabulary admission gate

Status: **Proposed** (2026-07-15)

## Statement

**If** an exported capability-port type, function, method, constant, or field
contains a prohibited business-domain noun, the admission suite **shall** reject
it unless the declaration carries an exact `//port:allow-noun <word>` directive
that cites the authorizing ADR on the same line.

## Rationale

Business nouns belong to the providing module's public contract. Allowing them
into the platform port layer turns that layer into a second domain model and
couples unrelated modules to one feature's vocabulary. ADR-cited exceptions
remain possible but visible and reviewable.

## Acceptance criteria

- **AC-1 — Exported vocabulary scan.** The gate checks exported functions,
  methods, constants, types, struct fields, and interface methods in every
  capability package against the governed noun list.
- **AC-2 — Word-aware matching.** Identifiers are split on CamelCase,
  underscore, acronym, and digit boundaries so a true noun/plural is rejected
  without substring false positives such as `Recorder` containing `order`.
- **AC-3 — Narrow exception.** An exception applies only to the named noun and
  only when its declaration documentation cites an ADR on the directive line.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `core/platformkit-ports/portindex/domainnouns_test.go::TestNoDomainNounsInExportedIdentifiers`. |
| AC-2 | Inspection | `core/platformkit-ports/portindex/domainnouns_test.go` — `camelWords` and exact word/plural comparison. |
| AC-3 | Inspection | `core/platformkit-ports/portindex/domainnouns_test.go` — `nounAllowed` requires the requested word and an `ADR-` citation. |

## Satisfied by

- `core/platformkit-ports/portindex/domainnouns_test.go`.
