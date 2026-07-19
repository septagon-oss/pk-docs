---
id: REQ-PORTS-005
title: "Every declared port contract appears exactly once in the authored index"
status: Proposed
date: 2026-07-15
slug: req-ports-005-authored-contract-index
category: governance
ears_pattern: unwanted-behaviour
priority: must
risk: high
verification_methods: [test]
satisfied_by:
  adr: [ADR-0009]
  conventions: [C-14]
implements_cross_cutting: [REQ-002]
type: doc
tags: [requirement, feature, ports, index, catalog]
module: platformkit_ports
feature: contract_index
---

# REQ PORTS-005 — Authored contract index

Status: **Proposed** (2026-07-15)

## Statement

**If** a capability package declares a package-level `port.Contract`, the
`platformkit_ports` registry **shall** include that exact contract once in
`portindex.All()`, and callers **shall** be able to resolve it by its canonical
package-qualified name.

## Rationale

The index is the boundary consumed by catalogs and dependency resolvers. A
contract omitted from it is invisible; a duplicate or malformed entry makes
resolution ambiguous. Referencing the authored variables directly also turns
renames and removals into compile-time changes.

## Acceptance criteria

- **AC-1 — Complete registration.** An AST scan of all capability packages
  finds no package-level `port.Contract` absent from `All()`.
- **AC-2 — Well-formed uniqueness.** Every indexed contract has a unique,
  package-qualified name and a complete valid identity.
- **AC-3 — Canonical lookup.** `ByName` returns registered contracts and
  reports absence for unknown names; `All()` returns a fresh slice.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `core/platformkit-ports/portindex/completeness_test.go::TestEveryDeclaredContractIsRegistered`. |
| AC-2 | Test | `core/platformkit-ports/portindex/index_test.go::TestContractsAreWellFormed`. |
| AC-3 | Test | `core/platformkit-ports/portindex/index_test.go::TestByName`. |

## Satisfied by

- `core/platformkit-ports/portindex/index.go`.
- `core/platformkit-ports/portindex/completeness_test.go`.
