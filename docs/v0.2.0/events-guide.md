---
title: v0.2.0 Events Guide
slug: v0-2-0-events-guide
collection: docs
status: published
---

# v0.2.0 Events Guide

`pk-core/pkg/event` is PlatformKit's provider-neutral event-bus contract: a
CloudEvents-flavored `Envelope`, a `Handler` callable, a `Subscription`
handle, and the `Bus` interface. Two implementations ship in sub-packages —
an in-process bus (`event/memory`) and a durable outbox decorator
(`event/outbox`). Adapters for external brokers (NATS, Kafka, CloudEvents-HTTP)
plug in downstream by implementing the same `Bus` interface.

## The contract (`pk-core/pkg/event`)

```go
type Bus interface {
    Publish(ctx context.Context, env Envelope) error
    Subscribe(eventType string, handler Handler) (Subscription, error)
    Close() error
}

type Handler func(ctx context.Context, env Envelope) error

type Subscription interface {
    Cancel() // idempotent; in-flight invocations run to completion
}
```

`Envelope` is a plain value type — the bus hands handlers a defensive copy,
never shared mutable state:

| Field | Required | Meaning |
|-------|----------|---------|
| `ID` | yes | Unique event ID (UUID recommended). The bus never generates IDs. |
| `Type` | yes | Event type, e.g. `"user.created"`. Subscription matching is **exact** — no wildcards in the OSS contract. |
| `Source` | yes | Emitter identity, e.g. `"user_management"`. |
| `Subject` | no | Entity the event is about, e.g. `"user:42"`. |
| `Time` | no | Defaults to `time.Now()` in `Validate`. |
| `TenantID` | no | Multi-tenant context. |
| `CorrelationID` | no | Chains events into a trace/saga. |
| `IdempotencyKey` | no | Dedupe key — honored by the outbox, passed through by in-process buses. |
| `Data` | no | Payload bytes; the bus never parses them. |
| `DataMediaType` | no | Defaults to `event.DefaultDataMediaType` (`"application/json"`). |

`(*Envelope).Validate()` normalizes in place (zero `Time` → now, empty
`DataMediaType` → JSON) and returns `event.ErrInvalidEnvelope` (joinable via
`errors.Is`) when `ID`, `Type`, or `Source` is missing. After `Close`, both
`Publish` and `Subscribe` fail with `event.ErrBusClosed`.

## The in-process bus (`pk-core/pkg/event/memory`)

`memory.New()` returns a synchronous bus: `Publish` runs every subscriber on
the caller's goroutine and surfaces the first handler error to the publisher.
Options switch it to bounded async dispatch:

- `memory.WithAsync(workerCount)` — `Publish` enqueues and returns; workers
  drain the queue (default depth: 16× workers).
- `memory.WithAsyncQueueSize(n)` — override the queue depth.
- `memory.WithErrorReporter(fn)` — receives handler errors in async mode.

### A compilable publish/subscribe example

```go
package main

import (
	"context"
	"fmt"

	"github.com/septagon-oss/pk-core/pkg/event"
	"github.com/septagon-oss/pk-core/pkg/event/memory"
)

func main() {
	bus := memory.New() // synchronous: Publish returns after handlers ran
	defer bus.Close()

	sub, err := bus.Subscribe("user.created", func(ctx context.Context, env event.Envelope) error {
		fmt.Printf("got %s from %s: %s\n", env.Type, env.Source, env.Data)
		return nil
	})
	if err != nil {
		panic(err)
	}
	defer sub.Cancel()

	env := event.Envelope{
		ID:     "evt-001",
		Type:   "user.created",
		Source: "user_management",
		Data:   []byte(`{"user_id":"user_admin"}`),
	}
	if err := bus.Publish(context.Background(), env); err != nil {
		panic(err)
	}
}
```

Run it with `go mod init example.com/events-demo && go get
github.com/septagon-oss/pk-core@v0.2.0 && go run .` (Go 1.26+).

## The durable outbox (`pk-core/pkg/event/outbox`)

`outbox.New(inner event.Bus, store outbox.Store, opts ...Option)` wraps any
bus with store-and-forward delivery: `Publish` **saves** the envelope to the
store; a background dispatcher (started with `Start(ctx)`, stopped with
`Stop()`) claims batches and forwards them to the inner bus, retrying on
failure and marking envelopes dead after too many attempts.

- Stores: `outbox.NewMemoryStore()` and `outbox.NewSQLStore(db *sql.DB)`
  (schema in `outbox.SchemaSQL` — apply it yourself; the store does not
  auto-migrate).
- Options: `WithDispatchInterval`, `WithBatchSize`, `WithMaxRetries`,
  `WithClaimTTL`, `WithErrorHandler`.
- `Envelope.IdempotencyKey` deduplicates saves (`outbox.ErrDuplicate`).
- `Subscribe` and `Close` delegate to the inner bus.

## How the shipped modules use events — honestly

**Thinly, in v0.2.0.** The state of play:

- `notification_management` accepts an `notification.WithEventBus(b event.Bus)`
  option and declares the intent to emit `notification.dispatched` events in
  its port spec — but the v0.2.0 module code stores the bus without publishing
  to it. Notification fan-out happens through the synchronous
  `portslib.NotificationChannel` list instead (the built-in `in_app` channel
  first, then anything added via `WithChannel`).
- No shipped module calls `Subscribe`.
- The starter app (`pk-apps/pkg/starterapp`) constructs **no bus at all**.
  Cross-module side-effects in the starter go through the audit log
  (`audit.AuditEmitter`), not events.

So in v0.2.0 the event layer is a stable, tested contract you can build on in
your own modules today — with a durable outbox ready for transactional
producers — but the built-in modules do not yet exercise it. A durable async
notification path is on the v0.2.0 roadmap (see the
[release notes](./release-notes-v0.2.0.md)).

## Using events in your own module

Follow the module pattern from [Add a module](./add-a-module.md): accept the
bus as a functional option (mirroring `notification.WithEventBus`), keep the
`event.Bus` type as your only coupling, and publish validated envelopes with
your module ID as `Source`. Because `Bus` is an interface, tests can pass a
`memory.New()` instance and assert on delivery synchronously.
