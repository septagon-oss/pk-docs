---
id: REQ-015
title: "Test infrastructure is shared, deterministic, and reproducible"
status: Active
date: 2026-05-06
slug: req-015-test-infrastructure-shared
category: governance
ears_pattern: ubiquitous
verification_methods:
  - test
  - inspection
compliance: []
satisfied_by:
  adr: [ADR-0021]
  conventions: []
type: doc
tags: [requirement, governance, testing]
---

# REQ 015 — Test infrastructure is shared, deterministic, and reproducible

Status: **Active** (2026-05-06)

## Statement

Every PlatformKit test (unit, integration, e2e) **shall**: (a) use the
workspace-level test harness at `platformkit-tests/` for shared
infrastructure (browser harness, flow execution, database fixtures),
(b) be deterministic — no timing-sensitive flakes, no order-dependent
state, no machine-specific paths — and (c) be re-runnable in any
environment that provides the documented prerequisites
(docker-compose for integration tests, Playwright browsers for e2e),
without manual setup steps. Interface contracts **shall** ship a
shared `*_contract_test.go` suite that exercises any implementation.

## Rationale

Scattered ad-hoc test helpers fragment the suite: each module
reinvents browser setup, fixture loading, and tenant seeding, then
each invention rots independently. The harness exists so that
running `go test ./...` against any module exercises the same
shared scaffolding — easier to fix once, easier to reason about
when a flake appears.

Determinism is the precondition for CI confidence. A timing-sensitive
test that passes locally and fails 1-in-30 on CI is worse than no
test: it teaches engineers to ignore the test-result column. The
discipline is uncomfortable up-front (force-fix the flake, don't
retry-on-failure) and pays back every time a real regression lands
green.

Interface-contract test suites (ADR-0021) are how multiple
implementations of the same port stay honest. The noop and real
implementations of `ports.UserService`, the in-memory and Postgres
filesystems, the JetStream and memory event buses — each runs the
same `Contract` suite. A swap that changes behaviour fails the
contract test, not three weeks later in production.

## Acceptance criteria

- **AC-1** Test fixtures and helpers live under `platformkit-tests/`
  or a single `testutil/` package per repo — never duplicated across
  packages.
- **AC-2** Each interface declared in `ports/`,
  `<module>/contracts/provides/`, or `<repo>/contract/` has at least
  one shared `*_contract_test.go` suite that any implementation can
  execute.
- **AC-3** E2E tests replay deterministically against seeded
  fixtures — no real-time `time.Now()` comparisons, no random IDs
  without explicit seeding, no test-ordering dependencies.
- **AC-4** Flow execution (`platformkit-tests/flow/`) is the single
  e2e driver across browser, NATS, and HTTP transports — modules
  do not roll their own e2e runner.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Inspection | Repo audit during PR review: new packages under `<module>/<feature>/` should not declare test infrastructure that duplicates `platformkit-tests/` capabilities. |
| AC-2 | Test | `platformkit-backend-kit/observability/logger/providers/noop/contract_test.go::TestNoOpLoggerContract` and siblings — the canonical shape. |
| AC-3 | Inspection | E2E suites under `pk-modules/<module>/tests/e2e/` running against the seeded showroom fixtures. _Verification gap: pending — cited evidence is prose / pattern / non-Go and cannot be auto-resolved._ |
| AC-4 | Inspection | Grep for any package that declares its own browser bootstrap; reviewers redirect to `platformkit-tests/flow/`. |

## Satisfied by

- [ADR 0021 — Interface contract test suites](../adr/0021-interface-contract-test-suites.md) —
  the architectural decision that established the shared-suite pattern.
- `platformkit-tests/flow/`, `platformkit-tests/harness/`,
  `platformkit-tests/context/` — the workspace-level harness.

## Related requirements

- [REQ-008 — Every Go file declares its purpose](./REQ-008-every-file-declares-purpose.md) —
  test-file headers carry the `Validates: REQ-NNN` reverse link.

## References

- `platformkit-tests/REPO_CHARTER.md` — harness charter and authority
  boundary.
- `make check-dual-path-flows` (in `pk-modules`) —
  reuse-of-harness verification target.
