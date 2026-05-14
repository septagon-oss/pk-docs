---
title: "ADR 0005: No silent failures in production paths"
status: Accepted
date: 2024-04-22
slug: adr-0005-error-handling-discipline
adr_topic: runtime-execution
type: doc
tags: [adr, error-handling, observability]
---

# ADR 0005 — No silent failures in production paths

Status: **Accepted** (2024-04-22)

## The problem

A deep audit across the workspace's 11 Go repos surfaced about 35
silent-failure patterns. `_ = err`. `_, _ = svc.Update(...)`.
`continue` on a decode error inside a loop.
`context.Background()` in a goroutine spawned from a request
handler. `panic()` on a `crypto/rand` failure in a token generator.

We weren't hunting theoretical issues. Every finding had a concrete
production consequence that we'd already seen or could name:

- Role changes committed to the DB without the corresponding audit
  row.
- Event-publish failures silently dropping notifications that
  subscribers were waiting on.
- Push-notification status updates lost on a double-failure,
  leaving the audit trail lying about delivery outcomes.
- Rollback `Delete`s swallowed during tenant onboarding, orphaning
  tenant rows.
- Verification tickets generated with a predictable
  `EVT-AAAAAAAA` suffix when `rand.Read` failed.
- Webhook subscriptions silently stopping delivery on a corrupted
  `event_types` column.

The common thread: modules we shipped as production-grade had
drifted into a posture where "the primary state change succeeded,
a follow-on effect silently failed" was considered acceptable. It
isn't — not for `core-certified` modules that advertise the
highest contract-review posture and claim
`assurance-eligible: true`. The gap between the tier claim and the
code was real.

## The decision

Every error in a production code path is either propagated to the
caller or logged at an appropriate level with enough context for
operators to reconcile. Silent drops — `_ = err`,
`_, _ = fn(...)`, empty `default:` branches on type switches,
`continue` on decode failure — aren't permitted outside narrowly
scoped cases:

- **HTTP response writers** where the client has disconnected
  (`_, _ = w.Write(...)` after headers sent).
- **Defer-time close on read-only streams** where the failure
  cannot affect correctness.
- **Intentional fire-and-forget notifications** explicitly
  documented as best-effort, where the log line still captures the
  error.

Log level follows failure semantics:

- **Error** — compliance-path failure (audit write lost),
  state-drift operators must reconcile (orphaned row, quota
  miscount).
- **Warn** — informational event lost (subscriber event, metric
  counter), fallback engaged.
- **Info** — normal operation observability.

Request-path goroutines that survive the response cycle use
`context.WithoutCancel(ctx)` — see
[ADR 0008](./0008-async-goroutine-context-semantics.md) for the
specific rule and its guards. `context.Background()` inside a
request handler loses trace correlation; the discipline here is
that we never take that loss silently.

`panic()` is permitted only in `init`, config validation, and
`Must*` helpers. Request-path code that discovers an unrecoverable
condition — a `crypto/rand` failure during token generation, say —
returns a wrapped error; the handler translates to 500.

## What we gave up

- Some log volume on the Warn track. Acceptable — Error is the
  signal that drives alerts; Warn is diagnostic.
- A review tax. Every `_ = err` in a PR becomes a question the
  author has to answer. Rightly so.
- A compile-time check (for now). This is documented as the review
  standard, not mechanically enforced across the full pattern set.

## What we kept

- Failures surface. Compliance drift shows up at Error level,
  giving operators an actionable alert. Async work keeps its trace
  context via `WithoutCancel`. Nothing ships that says "the user
  was onboarded" while the audit row vanished.
- The audit bar is enforceable. "Any `_ = err` needs justification"
  is a simple rule that reviewers can apply without a style guide.
- The tier claim matches the code. A `core-certified` module that
  silently drops audit writes is no longer possible without someone
  actively looking the other way.

## How we enforce it

- **`platformkit-backend-kit/analysis/safeerror`** — static
  analyzer bundled into `pkvet`. Flags known silent-error
  anti-patterns in production code paths. Runs via
  `go vet -vettool=./pkvet ./...` and gates `make check-pkvet`.
- **`platformkit-backend-kit/cmd/safeerror-check`** — standalone
  CLI for spot-checking a subtree.
- **Review rule**: any `_ = err` or `_, _ = fn(...)` in a PR must
  be paired with a `// justified: <reason>` comment or it's
  rejected on review.
- **Gap**: the analyzer catches `_ = err` on known error-returning
  calls but does not yet catch (a) `_, _ = svc.Update(...)` where
  the second value is error, (b) `if err != nil { /* log */ }`
  with no `return`, (c) `continue` on decode error inside a loop.
  Strengthening the analyzer is tracked as follow-up.

## References

- Commits implementing this discipline across modules:
  `43aa9783a`, `453625996`, `772e71680`, `bf2204f31`,
  `5fadeb5cb`, `8fdc8ff8f`, `5e0e13515`, `62b47b7a9`,
  `62d44abfd`, `66db4d47e`, `654925c55`, `5359e4654`, `c60ec22`
  (agent-runtime), and follow-ups.
- Related:
  [ADR 0006 — multi-entity writes are atomic or they don't happen](./0006-transactional-atomicity-for-multi-entity-state.md)
  — atomicity for multi-entity writes.
- Related:
  [ADR 0007 — events go through the outbox, not straight to the bus](./0007-transactional-outbox-for-event-delivery.md)
  — at-least-once delivery for the dual-write case.
- Related:
  [ADR 0008 — background work keeps its tracing and loses its deadline](./0008-async-goroutine-context-semantics.md)
  — `WithoutCancel` for request-originated goroutines.
