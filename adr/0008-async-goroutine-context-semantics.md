---
title: "ADR 0008: Background work keeps its tracing and loses its deadline"
status: Accepted
date: 2024-04-22
slug: adr-0008-async-goroutine-context-semantics
adr_topic: runtime-execution
type: doc
tags: [adr, context, tracing, concurrency]
---

# ADR 0008 — Background work keeps its tracing and loses its deadline

Status: **Accepted** (2024-04-22)

## The problem

Request handlers need to fire off work that outlives the response —
admin approval notifications, pending-user alerts, API-key usage
tracking, retention cleanup. The naive shape is:

```go
go func() {
    if err := svc.Notify(context.Background(), user); err != nil {
        h.Logger().Error(ctx, "notify failed", ...)
    }
}()
```

Two things are wrong with this.

`context.Background()` is detached from the request. It carries no
trace id, no tenant id, no user id, no deadline — none of the
context the request built up. A log line emitted from inside the
goroutine loses its correlation handle. When a notification fails,
there's no way to trace that failure back to the specific request
that triggered it. Debugging an incident becomes a manual
timestamp-matching exercise.

The handler's `ctx` is the wrong alternative. The HTTP response
cycle cancels it microseconds after the goroutine starts. Any
downstream call that honours ctx cancellation sees the context
cancel almost immediately and bails — the whole point of the
goroutine (survive the response) fails.

Go 1.21 introduced `context.WithoutCancel(parent)`. It returns a
context that *inherits values* (trace ids, tenant ids, user ids,
anything `context.WithValue` put in) but *detaches cancellation* —
neither the parent's cancellation nor its deadline propagates.
That's exactly the semantic request-path goroutines need.

## The decision

Request-path goroutines that outlive the response use
`context.WithoutCancel(ctx)`. Not `context.Background()` and not
the raw `ctx`.

```go
notifyCtx := context.WithoutCancel(ctx)
go func() {
    if err := svc.Notify(notifyCtx, user); err != nil {
        h.Logger().Error(notifyCtx, "notify failed", ...)
    }
}()
```

The goroutine observes the same trace and tenant context as the
triggering request, so its logs correlate — but it isn't terminated
when the HTTP response completes.

The rule applies to:

- Async notifications (user approval/rejection, admin alerts).
- Fire-and-forget metric / usage writes that shouldn't block the
  response.
- Post-commit event publishes (until the producer migrates to
  [ADR 0007](./0007-transactional-outbox-for-event-delivery.md)).

It does **not** apply to:

- fx lifecycle hooks that receive their own `ctx` — use that
  directly.
- Worker goroutines scheduled at app-start with a lifecycle-scoped
  context created via `context.WithCancel(context.Background())`
  and cancelled from an `OnStop` hook. These are intentionally
  rooted in Background because they must not inherit any single
  request's trace.
- Cleanup goroutines that genuinely have no parent context
  available — orphan cleanup after the triggering DB transaction
  has already committed, for instance.

## What we gave up

- The zero-import simplicity of `context.Background()`. Not much to
  mourn — `WithoutCancel` is one stdlib call.
- A static gate. The rule is review-enforced today; a targeted lint
  that combines "inside a `go func()` closure" with "caller has
  `ctx` in scope" would catch the pattern reliably and is tracked
  as follow-up.

## What we kept

- Trace correlation. Trace ids, tenant ids, and request ids survive
  into async goroutines. Failed notifications are traceable to the
  request that triggered them. Tenant-scoped async work sees the
  right tenant context.
- A primitive you already know. The rule is expressed via a single
  stdlib call. No custom helpers to teach, no bespoke semantics to
  document past "use the thing the Go docs describe".

## How we enforce it

- **Review rule.** `context.Background()` inside a function that
  receives `ctx context.Context` is an immediate PR comment unless
  the function is an fx lifecycle setup, app bootstrap, or
  explicitly documented as rooted-Background.
- **Positive observability proof.** Traces emitted from
  `WithoutCancel`-derived goroutines carry the parent span id, so
  Jaeger/OTEL queries correlating "notification failed" logs with
  the originating request succeed. The absence of correlation in
  production logs is the failing signal operators see.
- **Gap.** No static analyzer flags `context.Background()`
  appearing inside a request-path closure
  (`go func() { ... context.Background() ... }()` inside a handler).
  The targeted lint described above is tracked as follow-up.

## References

- Go docs:
  `context.WithoutCancel` — <https://pkg.go.dev/context#WithoutCancel>.
- Commits: `825af327f fix(user/auth): preserve trace context in
  async notification goroutines`,
  `5e0e13515 fix(api_key/key_management): log api-key usage write
  failures`.
- Related:
  [ADR 0005 — no silent failures](./0005-error-handling-discipline.md)
  — the broader error-handling discipline this rule specialises.
