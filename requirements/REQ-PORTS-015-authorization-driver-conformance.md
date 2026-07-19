---
id: REQ-PORTS-015
title: "Authorization drivers allow only exact grants and deny unknown, cross-tenant, canceled, or incomplete decisions"
status: Proposed
date: 2026-07-15
slug: req-ports-015-authorization-driver-conformance
category: auth
ears_pattern: unwanted-behaviour
priority: must
risk: critical
verification_methods: [test]
satisfied_by:
  adr: [ADR-0009, ADR-0021]
  conventions: [C-14]
implements_cross_cutting: [REQ-001, REQ-005, REQ-015]
refines: REQ-PORTS-006
type: doc
tags: [requirement, capability, ports, authorization, conformance]
module: platformkit_ports
feature: admission
capability: authorization_driver_conformance
capability_kind: failure_mode
---

# REQ PORTS-015 — Authorization driver conformance

Status: **Proposed** (2026-07-15)

## Statement

Every policy-enforcing `authz.Decider` driver **shall** pass the shared suite:
an explicitly granted decision is allowed, while an unknown action, subject,
tenant, zero-value decision, or canceled context is denied or fails closed,
and concurrent decisions remain safe.

## Rationale

Exact-match denial cases are the security boundary of an interchangeable
authorization driver. A provider that treats a missing field or canceled
request as an allow result does not implement the port contract.

## Acceptance criteria

- **AC-1 — Exact grant.** The reference driver allows a declared decision.
- **AC-2 — Fail-closed mismatch.** Different action, subject, or tenant and the
  zero value cannot produce a successful allow result.
- **AC-3 — Runtime safety.** Canceled and concurrent calls do not accidentally
  allow or corrupt decisions.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `core/platformkit-ports/authz/authztest/authztest_test.go::TestAllowListPassesConformance`. |
| AC-2 | Test | `core/platformkit-ports/authz/authztest/authztest_test.go::TestAllowListPassesConformance`. |
| AC-3 | Test | `core/platformkit-ports/authz/authztest/authztest_test.go::TestAllowListPassesConformance`. |

## Satisfied by

- [ADR 0021 — Interface contract test suites](../adr/0021-interface-contract-test-suites.md).
- `core/platformkit-ports/authz/authztest`.
