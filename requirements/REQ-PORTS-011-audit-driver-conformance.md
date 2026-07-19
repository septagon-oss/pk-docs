---
id: REQ-PORTS-011
title: "Audit drivers preserve recording, tenant filtering, cancellation, and concurrency semantics"
status: Proposed
date: 2026-07-15
slug: req-ports-011-audit-driver-conformance
category: audit
ears_pattern: ubiquitous
priority: must
risk: high
verification_methods: [test, inspection]
satisfied_by:
  adr: [ADR-0009, ADR-0021]
  conventions: [C-14]
implements_cross_cutting: [REQ-001, REQ-004, REQ-015]
refines: REQ-PORTS-001
type: doc
tags: [requirement, capability, ports, audit, conformance]
module: platformkit_ports
feature: contract_identity
capability: audit_driver_conformance
capability_kind: inter_module_contract
---

# REQ PORTS-011 — Audit driver conformance

Status: **Proposed** (2026-07-15)

## Statement

Every `audit.Recorder`/`audit.Reader` provider **shall** pass the shared audit
driver suite: valid records are accepted safely under concurrency, recorded
events round-trip, tenant filters do not leak other tenants, and canceled
operations fail rather than continuing work.

## Rationale

Audit drivers are interchangeable only when they agree on behavior, not just
method signatures. The shared kit makes the cancellation, isolation, and
round-trip obligations executable for every adapter.

## Acceptance criteria

- **AC-1 — Recorder behavior.** A valid event records successfully, a canceled
  context fails, and concurrent calls do not corrupt the provider.
- **AC-2 — Reader behavior.** A recorded event can be retrieved and a query
  filtered to its tenant returns it while an unknown tenant returns no rows.
- **AC-3 — Reference error semantics.** The reference driver classifies a
  missing ID as `KindNotFound` and canceled reads as `KindUnavailable`.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `core/platformkit-ports/audit/audittest/audittest_test.go::TestMemPassesRecorderConformance`. |
| AC-2 | Test | `core/platformkit-ports/audit/audittest/audittest_test.go::TestMemPassesReaderConformance`. |
| AC-3 | Inspection | `core/platformkit-ports/audit/audittest/mem.go` — `Get`, `Query`, and cancellation return portable error kinds. |

## Satisfied by

- [ADR 0021 — Interface contract test suites](../adr/0021-interface-contract-test-suites.md).
- `core/platformkit-ports/audit/audittest`.
