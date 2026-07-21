---
id: REQ-TEST-001
title: "Shared quality primitives execute deterministically and preserve governed evidence"
status: Active
date: 2026-07-15
slug: req-test-001-shared-quality-authority
category: governance
ears_pattern: ubiquitous
priority: must
risk: high
verification_methods: [test]
satisfied_by:
  adr: [ADR-0021]
  conventions: [C-14]
implements_cross_cutting: [REQ-015]
type: doc
tags: [requirement, feature, testing, flow, harness, telemetry]
module: platformkit_tests
feature: shared_quality_authority
---

# REQ TEST-001 — Shared quality authority

Status: **Active** (2026-07-15)

## Statement

The `platformkit_tests` quality authority **shall** provide deterministic flow
ordering, isolated browser-runtime state, and fail-closed telemetry-conformance
checks so every consumer can reproduce execution and retain trustworthy test
evidence without implementing a private harness.

## Rationale

Reusable test infrastructure is valuable only when two runs over the same
inputs produce the same execution order, local browser state cannot leak
between profiles, and broken trace linkage is reported rather than accepted.
These properties specialize the workspace-wide shared-test requirement for the
concrete flow, harness, and telemetry contracts owned by `pk-testkit`.

## Acceptance criteria

- **AC-1 — Stable flow ordering.** A dependency graph with multiple ready
  nodes produces one deterministic topological order using stable flow IDs.
- **AC-2 — Isolated browser state.** A local browser profile uses
  profile-scoped runtime paths and materializes every required runtime
  directory before execution.
- **AC-3 — Fail-closed trace evidence.** Telemetry conformance rejects a
  missing or mismatched governed trace hop while accepting a continuous W3C
  trace chain.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `tooling/pk-testkit/flow/registry_test.go::TestDependencyGraphTopologicalSortUsesStableIDOrder`. |
| AC-2 | Test | `tooling/pk-testkit/harness/harness_test.go::TestLocalBrowserEnvUsesProfileScopedPaths`. |
| AC-3 | Test | `tooling/pk-testkit/telemetry/conformance_test.go::TestCheckTraceContinuityDetectsMcpGap`. |

## Satisfied by

- [ADR 0021 — Interface contract test suites](../adr/0021-interface-contract-test-suites.md).
- `tooling/pk-testkit/flow/registry.go`.
- `tooling/pk-testkit/harness/harness.go`.
- `tooling/pk-testkit/telemetry/conformance.go`.

## Related requirements

- [REQ-015 — Test infrastructure is shared, deterministic, and reproducible](./REQ-015-test-infrastructure-shared.md).
