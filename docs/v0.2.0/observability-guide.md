---
title: v0.2.0 Observability Guide
slug: v0-2-0-observability-guide
collection: docs
status: published
---

# v0.2.0 Observability Guide

`pk-core/pkg/observability` defines PlatformKit's provider-neutral
observability contracts in **five** sub-packages — `logger`, `metrics`,
`tracing`, `health`, and `guardrail`. Every sub-package ships a stdlib-only
default implementation; external adapters (OpenTelemetry, Prometheus, Datadog)
belong in downstream packages so the OSS kernel stays dependency-free.

This page covers the contracts and then what the starter app actually exposes
at runtime: `/live`, `/ready`, `/healthz`, and `/metrics`.

## Logging (`pk-core/pkg/observability/logger`)

The contract is a context-first `Logger` interface, not a global:

```go
type Logger interface {
    Debug(ctx context.Context, msg string, args ...any)
    Info(ctx context.Context, msg string, args ...any)
    Warn(ctx context.Context, msg string, args ...any)
    Error(ctx context.Context, msg string, args ...any)
    With(args ...any) Logger
    Enabled(ctx context.Context, level slog.Level) bool
}
```

Constructors: `logger.NewSlog(handler slog.Handler, extractors ...ContextExtractor)`,
`logger.NewSlogFromLogger(l *slog.Logger, extractors ...ContextExtractor)`, and
`logger.Noop()`.

There is no `logger.FromContext` and no context-carried logger in v0.2.0 —
you construct a `Logger` and inject it where you need it.

### The `ContextExtractor` pattern

```go
// pk-core/pkg/observability/logger
type ContextExtractor func(ctx context.Context) []any
```

Extractors are attached at construction (`NewSlog(handler, extractors...)`) and
run on every emit, appending structured key/value pairs derived from the
request context. The one extractor shipped in the OSS is
`tracing.LoggerExtractor` (in `pk-core/pkg/observability/tracing`), which
emits the active span's IDs so log lines correlate with traces.

## Metrics (`pk-core/pkg/observability/metrics`)

The contract is an instance-based `Metrics` factory — there are no
package-level counter constructors:

```go
type Metrics interface {
    Counter(name string, labels ...string) Counter     // Counter.Add(delta float64)
    Gauge(name string, labels ...string) Gauge         // Gauge.Set(value float64)
    Histogram(name string, labels ...string) Histogram // Histogram.Observe(v float64)
}
```

Implementations: `metrics.NewExpvar(m *expvar.Map)` (stdlib `expvar`-backed)
and `metrics.Noop()`. `metrics.HTTPHandler(m)` returns an `http.Handler` if
the implementation exports one (the expvar implementation does).

```go
import (
    "expvar"

    "github.com/septagon-oss/pk-core/pkg/observability/metrics"
)

m := metrics.NewExpvar(expvar.NewMap("myapp"))
logins := m.Counter("auth_login_attempts")
logins.Add(1)
```

**Honest note:** in v0.2.0 no shipped module registers custom metrics. The
starter app's `/metrics` endpoint is the standard library's `expvar.Handler()`
— a JSON document containing `cmdline`, `memstats`, and anything your own code
publishes via `expvar`. There is no Prometheus text endpoint in the starter
(pk-deploy has one for its own workers, see the
[Deployment Guide](./deployment-guide.md)).

## Tracing (`pk-core/pkg/observability/tracing`)

`tracing.Tracer` starts spans; `tracing.Span` carries `SetAttr`, `SetStatus`,
`RecordError`, `End`, and `Context()`. The default is `tracing.Noop()`. Span
propagation uses explicit helpers:

```go
import "github.com/septagon-oss/pk-core/pkg/observability/tracing"

tracer := tracing.Noop() // swap for a real adapter downstream

ctx, span := tracer.Start(ctx, "user.load")
defer span.End()

// elsewhere:
span := tracing.SpanFromContext(ctx)
ctx = tracing.ContextWithSpan(ctx, span)
```

There is no `tracing.FromContext(ctx).Start(...)` chain — the tracer itself is
injected; only the *span* travels on the context.

## Guardrail warnings (`pk-core/pkg/observability/guardrail`)

Guardrail standardizes the log record emitted when code takes a safe fallback
or degraded path, so monitoring can aggregate these independently of business
logs. Every record carries `guardrail=true`,
`guardrail_standard="platformkit.guardrail.v1"`, a `guardrail_mode`
(`fallback`, `degraded`, `unsupported`, `configuration_gap`, `soft_empty`),
and an optional `guardrail_code`:

```go
guardrail.WarnFallback(ctx, log, "cache_miss_fallback",
    "cache unavailable; serving from database", "tenant_id", tenantID)
```

The `Warn` family panics on a nil logger — a guardrail that silently drops its
warning would defeat its purpose.

## Health: who owns which endpoint

These endpoints are easy to misattribute, so to be precise:

| Endpoint | Owner | Behavior |
|----------|-------|----------|
| `/live` | **pk-runtime host** (`pk-runtime/pkg/host`) | Always `204 No Content` while the process serves. Never reads the DB. |
| `/ready` | **pk-runtime host** (`pk-runtime/pkg/host`) | JSON snapshot of the host's `health.Registry` (`pk-runtime/pkg/health`); `200` when aggregate status is ok, `503` otherwise. |
| `/healthz` | **health_management module** (`pk-modules/pkg/health`) | JSON aggregate of every checker registered through `portslib.HealthRegistrar`, rendered by pk-core's `health.Registrar.HTTPHandler()`. Unhealthy → `503`; healthy **and degraded** → `200`. |
| `/metrics` | starter app mux (`pk-apps/pkg/starterapp`) | stdlib `expvar.Handler()` JSON. |

`host.Host.ServeHTTP` intercepts exactly `/live` and `/ready`; `host.New` even
rejects any registered route that tries to claim those reserved paths. The
starter app forwards only those two paths to the host and keeps everything
else on its own mux.

### `/ready` payload

`/ready` encodes a `health.Snapshot` from `pk-runtime/pkg/health`:

```json
{
  "status": "ok",
  "checked_at": "2026-07-21T12:00:00Z",
  "results": [
    {
      "id": "runtime.modules",
      "module_id": "runtime",
      "critical": true,
      "status": "ok",
      "message": "module plan composed",
      "duration": 12345,
      "details": {"modules": "9"}
    }
  ]
}
```

In the starter app the host registry contains one built-in check —
`runtime.modules`, which verifies the composed module plan — because the
starter passes no extra `HealthChecks` to `host.New`. Add your own by
populating `host.Input.HealthChecks` with `health.Check` values
(`ID`, `ModuleID`, `Critical`, and a `Run func(context.Context)
(health.Result, error)`; helpers `health.OK`, `health.Degraded`,
`health.Down`).

### `/healthz` and module checks

Modules register liveness probes through the `portslib.HealthRegistrar` port:

```go
// pk-modules/pkg/portslib
type HealthRegistrar interface {
    Register(name string, check health.Checker) error
}
```

where `health.Checker` is pk-core's one-method interface
(`Check(ctx context.Context) error`), with the `health.CheckerFunc` adapter.
In the starter app the tenant, user, audit, auth, api_key, content, and
notification modules each register a store probe under a
`<module_id>.<component>` name (for example `tenant_management.store`,
`auth_management.sessions`), so `/healthz` goes unhealthy when SQLite stops
answering. The JSON body is pk-core's
`health.Result` (aggregate status plus one entry per named component, with the
error string when a component fails). Checker panics and timeouts
(`health.WithTimeout`) degrade only their own component.

## What the starter app logs

The starter is quiet by design: `pk-apps/pkg/starterapp` prints a startup
banner (listen address, admin URL, seed credentials, composed modules) and uses
the stdlib `log` package for shutdown messages
(`starter-saas: shutdown signal received`, `starter-saas: server stopped
cleanly`). Wiring `logger.NewSlog` and the guardrail helpers into your own
modules is up to you — the contracts above are the supported way to do it.

## Related pages

- [Module Reference](./module-reference.md) — which module registers which check.
- [Configuration](./configuration.md) — HTTP timeouts that affect probe behavior.
- [Deployment Guide](./deployment-guide.md) — pointing Kubernetes-style probes
  at `/live` and `/ready`.
