---
id: REQ-PORTS-022
title: "Every contract-bearing capability package ships an executable sibling conformance kit"
status: Proposed
date: 2026-07-15
slug: req-ports-022-conformance-kit-admission-gate
category: governance
ears_pattern: unwanted-behaviour
priority: must
risk: high
verification_methods: [test]
satisfied_by:
  adr: [ADR-0009, ADR-0021]
  conventions: [C-14]
implements_cross_cutting: [REQ-002, REQ-015]
refines: REQ-PORTS-006
type: doc
tags: [requirement, capability, ports, admission, conformance]
module: platformkit_ports
feature: admission
capability: conformance_kit_gate
capability_kind: data_invariant
---

# REQ PORTS-022 — Conformance-kit admission gate

Status: **Proposed** (2026-07-15)

## Statement

**If** a capability package declares one or more authored `port.Contract`
values, the admission suite **shall** require a sibling `<package>test`
directory exporting at least one runnable function whose name contains
`Conformance`; otherwise the port **shall** be rejected.

## Rationale

An interface documents shape but cannot prove cancellation, isolation,
concurrency, or failure semantics. Requiring the suite at the point a contract
is introduced ensures every future driver has executable behavior to satisfy.

## Acceptance criteria

- **AC-1 — Contract discovery.** The gate discovers package-level contract
  literals by parsing all non-test capability source files.
- **AC-2 — Sibling kit.** Each declaring package has a sibling directory named
  from the package plus `test`.
- **AC-3 — Executable suite.** The sibling kit exports at least one free
  function whose name contains `Conformance`; a directory alone is not enough.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `core/platformkit-ports/portindex/conformancekit_test.go::TestEveryPortShipsAConformanceKit`. |
| AC-2 | Test | `core/platformkit-ports/portindex/conformancekit_test.go::TestEveryPortShipsAConformanceKit`. |
| AC-3 | Test | `core/platformkit-ports/portindex/conformancekit_test.go::TestEveryPortShipsAConformanceKit`. |

## Satisfied by

- [ADR 0021 — Interface contract test suites](../adr/0021-interface-contract-test-suites.md).
- `core/platformkit-ports/portindex/conformancekit_test.go`.
