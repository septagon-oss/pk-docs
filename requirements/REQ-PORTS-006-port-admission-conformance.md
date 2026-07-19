---
id: REQ-PORTS-006
title: "A port enters the design authority only through mechanical purity and conformance gates"
status: Proposed
date: 2026-07-15
slug: req-ports-006-port-admission-conformance
category: governance
ears_pattern: unwanted-behaviour
priority: must
risk: high
verification_methods: [test]
satisfied_by:
  adr: [ADR-0009, ADR-0021]
  conventions: [C-04, C-14]
implements_cross_cutting: [REQ-002, REQ-013, REQ-015]
type: doc
tags: [requirement, feature, ports, admission, conformance]
module: platformkit_ports
feature: admission
---

# REQ PORTS-006 — Port admission and conformance

Status: **Proposed** (2026-07-15)

## Statement

**If** a new or changed capability port violates repository purity, exports
business-domain vocabulary, exceeds the narrow-interface budget, or lacks a
runnable sibling driver-conformance kit, the `platformkit_ports` admission
suite **shall** reject the change.

## Rationale

Ports are a deliberately small design center, not a second domain layer.
Mechanical gates keep dependencies minimal, interfaces narrow, vocabulary
provider-neutral, and behavior executable by every adapter. This umbrella
owns the admission policy; specific gates refine it below.

## Acceptance criteria

- **AC-1 — Dependency purity.** Source imports are limited to the standard
  library, this module, and the explicitly allowlisted OpenTelemetry API; path
  lookalikes do not pass prefix checks.
- **AC-2 — Narrow, neutral seams.** Exported capability vocabulary is checked
  for prohibited domain nouns and interfaces stay within the five-method
  budget unless an ADR-cited bounded exception exists.
- **AC-3 — Executable conformance.** Every package declaring a port contract
  has a sibling `<package>test` kit exporting a runnable `*Conformance*` suite.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `core/platformkit-ports/portindex/purity_test.go::TestImportsAreStdlibOnly`. |
| AC-2 | Test | `core/platformkit-ports/portindex/domainnouns_test.go::TestNoDomainNounsInExportedIdentifiers`. |
| AC-2 | Test | `core/platformkit-ports/portindex/methodbudget_test.go::TestInterfaceMethodBudget`. |
| AC-3 | Test | `core/platformkit-ports/portindex/conformancekit_test.go::TestEveryPortShipsAConformanceKit`. |

## Satisfied by

- [ADR 0021 — Interface contract test suites](../adr/0021-interface-contract-test-suites.md).
- `core/platformkit-ports/portindex/purity_test.go`.
- `core/platformkit-ports/portindex/domainnouns_test.go`.
- `core/platformkit-ports/portindex/methodbudget_test.go`.
- `core/platformkit-ports/portindex/conformancekit_test.go`.
