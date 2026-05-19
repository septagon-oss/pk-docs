---
title: v0.0.0 Observability Guide
slug: v0-0-0-observability-guide
collection: docs
status: published
---

# v0.0.0 Observability Guide

`pk-core/pkg/observability` defines the three observability pillars
PlatformKit supports — **logs, metrics, traces** — and the
`ContextExtractor` pattern that ties them to incoming requests. This
page is the reference for wiring all of it up in a runnable app.

## The three pillars

Each pillar lives in a sub-package of `pk-core/pkg/observability`:

| Pillar | Package | Default provider |
|--------|---------|-------------------|
| Logs | `logger` | `slog`-based structured logger to stderr |
| Metrics | `metrics` | `expvar`-backed registry served at `/metrics` |
| Traces | `tracing` | No-op tracer (drop-in `otel` wiring in Pro) |

Modules never call these defaults directly. They depend on the
**interface** their package declares and receive a concrete provider at
compose time.

## The `ContextExtractor` pattern

Observability is only useful if log lines, metric labels, and trace
spans agree on the unit of work they describe. PlatformKit's answer is
the `ContextExtractor`:

```go
// pk-core/pkg/observability/logger
type ContextExtractor func(ctx context.Context) []slog.Attr
```

Each module that puts data on the request context contributes a
`ContextExtractor`. The runtime composes them in registration order
and, on every log/metric/trace emit, calls them to enrich the event
with structured fields.

For example, the OSS request middleware contributes an extractor that
emits `request_id` and `tenant_id`:

```go
func RequestExtractor(ctx context.Context) []slog.Attr {
    attrs := make([]slog.Attr, 0, 2)
    if rid, ok := requestID(ctx); ok {
        attrs = append(attrs, slog.String("request_id", rid))
    }
    if t, ok := tenant.FromContext(ctx); ok {
        attrs = append(attrs, slog.String("tenant_id", t.ID))
    }
    return attrs
}
```

Pro modules can add their own — for example, `auth_management` Pro
extractors can emit `user_id` and `session_id` without the logger
needing to know about authentication.

## Logging

Use the package logger, not the global default:

```go
import "github.com/septagon-oss/pk-core/pkg/observability/logger"

func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
    log := logger.FromContext(r.Context())
    log.Info("creating user", "email_domain", domainOf(req.Email))
    // ...
}
```

Three rules:

1. **Always pass the request context** to `logger.FromContext`. That is
   how the `ContextExtractor` fields get attached.
2. **Never log secrets.** The OSS provides a small `logger.Redactor`
   helper for stripping `Authorization` headers and password fields.
3. **Use structured fields, not formatted strings.** `"user not
   found", "user_id", id` — not `fmt.Sprintf("user %s not found", id)`.

## Metrics

The metrics registry lives in `pk-core/pkg/observability/metrics`:

```go
import "github.com/septagon-oss/pk-core/pkg/observability/metrics"

var loginAttempts = metrics.NewCounter("auth.login.attempts")

func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
    loginAttempts.Inc()
    // ...
}
```

The `expvar` default exposes everything at `/metrics` as JSON. Pro
distributions can swap in a Prometheus or OpenTelemetry collector
without changing the call sites — the counters and gauges keep the
same type.

## Traces

`pk-core/pkg/observability/tracing` declares the `Tracer` interface
and ships a no-op default. To start a span in a module:

```go
import "github.com/septagon-oss/pk-core/pkg/observability/tracing"

func (s *Service) loadUser(ctx context.Context, id string) (*User, error) {
    ctx, span := tracing.FromContext(ctx).Start(ctx, "user.load")
    defer span.End()
    // ...
}
```

With the no-op default this costs nothing. Wiring a real OTel exporter
is a single provider swap at app boot.

## Health endpoints

`health_management` contributes three HTTP endpoints:

- `/live` — process-is-alive probe; never reads the DB.
- `/ready` — JSON aggregate of every contributed `health.Probe`.
- `/healthz` — JSON aggregate of `Probe` + `ContextExtractor`
  diagnostics; intended for human use rather than k8s probes.

Pro modules can contribute their own probes by calling
`health.RegisterProbe` on the registry in their `Compose`.

## Putting it together

A real app's startup roughly looks like:

```go
log := logger.New(logger.WithExtractors(
    osmiddleware.RequestExtractor,
    auth.UserExtractor,         // Pro
    tenant.QuotaExtractor,      // Pro
))
metrics := metrics.NewExpvarRegistry()
tracer := tracing.NewNoop()     // swap with OTel in Pro

ctx := logger.WithLogger(context.Background(), log)
// ... compose modules with the same ctx / providers
```

After this, every module call site that uses `logger.FromContext`,
`metrics.NewCounter`, or `tracing.FromContext` gets the right
behaviour without further wiring.
