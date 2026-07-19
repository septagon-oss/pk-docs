---
id: REQ-PORTS-004
title: "Port failures carry a provider-neutral kind without losing their cause"
status: Proposed
date: 2026-07-15
slug: req-ports-004-portable-error-taxonomy
category: availability
ears_pattern: unwanted-behaviour
priority: must
risk: high
verification_methods: [test]
satisfied_by:
  adr: [ADR-0009]
  conventions: [C-14]
implements_cross_cutting: [REQ-005, REQ-014]
type: doc
tags: [requirement, feature, ports, errors, failure]
module: platformkit_ports
feature: error_taxonomy
---

# REQ PORTS-004 — Portable error taxonomy

Status: **Proposed** (2026-07-15)

## Statement

**When** a port provider returns a failure, the `platformkit_ports` error
contract **shall** let callers classify it as invalid, not found, denied,
conflict, unavailable, or internal without inspecting provider-specific types,
while preserving the original error in the unwrap chain.

## Rationale

Shells and observability code need uniform retry, response, and audit behavior
across interchangeable drivers. Classification must not destroy the original
cause, and an unclassified failure must default to internal rather than be
mistaken for a safe retry.

## Acceptance criteria

- **AC-1 — Kind survives wrapping.** `WithKind` attaches the requested kind,
  preserves `errors.Is`/unwrapping, and returns nil for a nil cause.
- **AC-2 — Unknown failures fail closed.** `KindOf` returns `internal` when no
  known port kind exists anywhere in the error chain.
- **AC-3 — Retry is narrow.** Only `unavailable` is retryable; denied, invalid,
  conflict, not-found, and internal failures are not blindly retried.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `core/platformkit-ports/port/port_test.go::TestKindOf`. |
| AC-2 | Test | `core/platformkit-ports/port/port_test.go::TestKindOf`. |
| AC-3 | Test | `core/platformkit-ports/port/port_test.go::TestKindOf`. |

## Satisfied by

- `core/platformkit-ports/port/errors.go`.
- `core/platformkit-ports/port/port_test.go`.
