---
id: REQ-PORTS-001
title: "Every cross-module port has a stable, authored contract identity"
status: Proposed
date: 2026-07-15
slug: req-ports-001-port-contract-identity
category: governance
ears_pattern: ubiquitous
priority: must
risk: high
verification_methods: [test, inspection]
satisfied_by:
  adr: [ADR-0009]
  conventions: [C-04, C-14]
implements_cross_cutting: [REQ-002]
type: doc
tags: [requirement, feature, ports, contracts, identity]
module: platformkit_ports
feature: contract_identity
---

# REQ PORTS-001 — Port contract identity

Status: **Proposed** (2026-07-15)

## Statement

The `platformkit_ports` design authority **shall** describe every
cross-module port with an authored `port.Contract` whose package-qualified
name, semantic version, stability class, purpose, and owner form one stable
identity that catalogs and composition tooling can consume without importing
an implementation.

## Rationale

A Go interface alone does not carry enough information to compare providers,
render a catalog, or explain an evolution guarantee. The authored contract is
the portable identity of the seam. Keeping that identity next to the interface
also prevents manifests and catalogs from inventing competing metadata.

## Acceptance criteria

- **AC-1 — Complete identity.** Every indexed contract has a unique
  package-qualified name, a `MAJOR.MINOR.PATCH` version, a non-empty purpose
  and owner, and one of the defined stability classes.
- **AC-2 — Explicit evolution class.** Stability is restricted to `frozen`,
  `stable`, `beta`, or `experimental`; an unrecognised value is invalid.
- **AC-3 — Implementation-independent record.** The contract meta-model is
  pure data and contains only port identity, declared event/endpoint metadata,
  and shared dependency vocabulary, not a concrete provider instance.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `core/platformkit-ports/portindex/index_test.go::TestContractsAreWellFormed`. |
| AC-2 | Test | `core/platformkit-ports/portindex/index_test.go::TestContractsAreWellFormed`. |
| AC-3 | Inspection | `core/platformkit-ports/port/contract.go` — the authored data-only `Contract`, `Stability`, event, endpoint, and dependency-category vocabulary. |

## Satisfied by

- [ADR 0009 — Ports-only cross-module communication](../adr/0009-ports-only-cross-module-communication.md).
- `core/platformkit-ports/port/contract.go`.
- `core/platformkit-ports/portindex/index_test.go`.
