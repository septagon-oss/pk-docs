---
title: "06 Runtime View"
slug: architecture-06-runtime-view
arc42_section: 6
collection: architecture
type: doc
tags: [architecture, arc42, runtime]
authoring: authored
---

# 06 — Runtime View

The building blocks of [05](./05-building-block-view.md) come alive
in specific scenarios. This section walks through the ones that
matter most — the runtime behaviours every operator, integrator,
and module author should understand.

## Scenario 1 — app boot

```mermaid
flowchart TB
    Main["main.go"] -->|"fx.New(...)"| App["fx.App"]
    App -->|"catalog.Options(preset)"| Catalog["Catalog expansion"]
    Catalog -->|"fx.Options per module"| ModuleOpts["Module option bundles"]
    ModuleOpts -->|"Provide"| Providers["Services + adapters"]
    ModuleOpts -->|"Invoke"| Startup["Migrations, admin, event subs"]
    ModuleOpts -->|"Hook OnStart/OnStop"| Lifecycle["Workers, schedulers"]
    Providers -->|"graph resolution"| Boot["Boot complete"]
    Startup --> Boot
    Lifecycle --> Boot
    FxValidation["fx validation"] -.->|"fails if any required dep missing"| Boot
```

**What happens step by step.**

1. `pk-apps/complete-saas-monolith/cmd/server/main.go`
   resolves the selected preset — `flagship-coworking` by default —
   and calls `catalog.Options(preset)`. This returns an
   `fx.Options(...)` aggregate that pulls in every participating
   module's bundle.
2. `fx.New(...)` wires the graph. For every type the graph needs,
   some provider must satisfy it; missing deps fail the process
   immediately with a clear error (see
   [ADR 0017](../adr/0017-fx-dependency-injection-as-composition.md)).
3. Module invocations run:
   `module.RegisterModuleMigrations(...)` appends each module's
   migrations to the runner; admin registrars collect sidebar
   entries; event subscribers bind to topic patterns; the HTTP
   router accumulates `huma.Register` calls from every feature.
4. Lifecycle hooks fire: worker goroutines start, caches warm,
   schedulers register. `OnStop` hooks are installed for graceful
   shutdown.
5. `ListenAndServe` runs on the HTTP surface;
   `subscribe.Start(ctx)` runs on the event bus side.

The whole graph is a single fx resolution. A module can't start
"half wired" — either its whole option bundle resolves or nothing
boots. This is the load-bearing property that makes the composition
model safe.

## Scenario 2 — an HTTP request

```mermaid
flowchart TB
    Client["Client"] -->|"HTTP request"| Huma["Huma router"]
    Huma -->|"CSRF + auth + tenant middleware"| Ctx["ctx with tenant + user"]
    Ctx -->|"resolved handler"| Handler["feature.Handler"]
    Handler -->|"business logic"| Service["feature.Service"]
    Service -->|"cross-module call via port"| OtherModule["ports.OtherService"]
    Service -->|"persistence"| Repo["crud.Repository[T]"]
    Repo -->|"SQL"| DB["Postgres"]
    Service -->|"emit via outbox"| Outbox["outbox.Enqueue"]
    Outbox -->|"same tx"| DB
    Handler -->|"JSON response"| Client
```

**The request's journey.**

1. Huma routes the request to the registered handler based on
   method + path. Route registration came from
   `handler.RegisterRoutes(api huma.API)` at boot — one feature,
   one route set
   ([Convention C-03](../conventions.md#c-03-features-own-their-routes)).
2. The middleware chain applies CSRF (if mutating), the auth
   chain, and tenant resolution. By the time the handler runs,
   `ctx` carries trace id, tenant id, user id, permissions.
3. The handler delegates to its service. The service might:
   - Call a CRUD repo for persistence.
   - Call a port for a cross-module capability (`ports.UserBoundaryReader`
     for identity, `ports.AuditService` for audit trail).
   - Open a transaction via `repo.WithTransaction(ctx, fn)` if the
     operation touches more than one entity
     ([ADR 0006](../adr/0006-transactional-atomicity-for-multi-entity-state.md)).
4. Domain events emitted inside the transaction go through
   `outbox.EnqueueEvent(ctx, evt)`, not directly through
   `bus.Publish` — see Scenario 3.
5. The handler marshals the response; middleware writes it.
6. If the handler spawned async work (a notification, a usage
   counter update), the goroutine uses
   `context.WithoutCancel(ctx)` so trace survives but the
   response cycle's deadline doesn't
   ([ADR 0008](../adr/0008-async-goroutine-context-semantics.md)).

## Scenario 3 — event emission and delivery (outbox)

```mermaid
sequenceDiagram
    participant UseCase
    participant Tx as DB transaction
    participant DB as Postgres
    participant Outbox as outbox_events
    participant Worker as Outbox worker
    participant Bus as NATS / EventBus
    participant Subscriber

    UseCase->>Tx: WithTransaction(ctx, fn)
    Tx->>DB: Update domain state
    Tx->>Outbox: INSERT event row
    Tx-->>DB: atomic commit
    Worker->>Outbox: DrainOnceWithReport(batch)
    Outbox-->>Worker: pending rows
    Worker->>Bus: Publish(event)
    Bus-->>Subscriber: deliver
    Subscriber-->>Bus: ack
    Worker->>Outbox: mark published
```

**Why the outbox.** The straightforward shape —
`repo.Update(...)` then `bus.Publish(...)` — is a dual write. If
the bus publish fails, the state is persisted but the event is
lost; downstream projections never learn about the change. See
[ADR 0007](../adr/0007-transactional-outbox-for-event-delivery.md)
for the full rationale.

**At-least-once, idempotent subscribers.** The worker can restart
between publishing to the bus and marking the row `published`,
producing duplicate delivery. Subscribers must be idempotent.
This is a non-negotiable contract; subscriber-side idempotency is
audited before a producer migrates to outbox delivery.

**Three-layer defence against empty `event_id`.**
`outbox_events.event_id` has a Postgres `DEFAULT gen_random_uuid()`;
`Service.Enqueue` fills empty IDs; the worker refuses rows with
still-empty IDs and marks them failed. A rogue INSERT via manual
SQL can't slip through.

## Scenario 4 — cross-module call, monolith topology

```mermaid
sequenceDiagram
    participant Consumer as Consumer.Service
    participant Port as ports.UserBoundaryReader
    participant Binding as User service binding
    participant Provider as user_management

    Consumer->>Port: GetByIDDTO(ctx, id)
    Port->>Binding: in-process method call
    Binding->>Provider: GetByIDDTO(ctx, id)
    Provider-->>Binding: UserDTO
    Binding-->>Port: UserDTO
    Port-->>Consumer: UserDTO
```

In the monolith, the port interface is satisfied by a direct
binding to the provider module's concrete service. The call is a
Go method invocation; no serialisation, no network. Cost is
nanoseconds.

## Scenario 5 — cross-module call, microservices topology

```mermaid
sequenceDiagram
    participant Consumer as Consumer service
    participant Port as ports.UserBoundaryService
    participant Proxy as UserBoundaryServiceNATSClient
    participant NATS
    participant Server as User service
    participant Provider as user_management

    Consumer->>Port: GetByIDDTO(ctx, id)
    Port->>Proxy: GetByIDDTO(ctx, id)
    Proxy->>NATS: request("GetByIDDTO", {id})
    NATS->>Server: deliver
    Server->>Provider: GetByIDDTO(ctx, id)
    Provider-->>Server: UserDTO
    Server-->>NATS: response
    NATS-->>Proxy: UserDTO
    Proxy-->>Port: UserDTO
    Port-->>Consumer: UserDTO
```

Same port interface, different wiring. In microservices the port
is satisfied by a NATS-backed proxy from
`platformkit-module-bindings` (`UserBoundaryServiceNATSClient` satisfies
`ports.UserBoundaryService`). The serialised call rides NATS to the user
service's server handler, which dispatches into the real
`user_management` implementation.

The consumer's code is unchanged. This symmetry is exactly what
[ADR 0019](../adr/0019-dual-path-transport-symmetry.md) preserves
and why `check-dual-path-flows` gates CI: a port method without a
NATS binding breaks the microservices topology silently.

## Scenario 6 — design-system ingest (Claude Design)

```mermaid
sequenceDiagram
    participant CUE as pkds/src/*.cue
    participant Compile as pkds compile
    participant IR as dist/ir/
    participant Lint as pkds lint
    participant Emit as pkds emit claude-design
    participant Tarball as brand-context.tgz
    participant ClaudeDesign

    CUE->>Compile: 115 CUE sources
    Compile->>IR: 106 components + tokens + manifest
    IR->>Lint: 10 rules
    Lint-->>IR: 0 findings
    IR->>Emit: --out=brand-context.tgz
    Emit->>Tarball: brand.json + tokens + 106 components + 55 icons
    Tarball->>ClaudeDesign: upload during onboarding
    ClaudeDesign-->>Tarball: ingests as brand context
```

Every artifact ClaudeDesign sees is a pure function of the CUE
source. `compile` is deterministic, `lint` is declarative,
`emit` is a pure transform. The tarball is reproducible from
`{git SHA, manifest.json}`.

## Scenario 7 — bidirectional handoff (Claude Design → PlatformKit)

```mermaid
sequenceDiagram
    participant ClaudeDesign
    participant Bundle as pkds.handoff.v1 JSON
    participant Receive as pkds handoff receive
    participant IR as compiled IR
    participant Mutated as mutated IR
    participant Lint
    participant CUE as pkds/src/contracts/*.cue

    ClaudeDesign->>Bundle: export handoff
    Bundle->>Receive: --in=bundle.json
    Receive->>IR: load current
    Receive->>Mutated: apply changes in-memory
    Mutated->>Lint: run 10 rules
    Lint-->>Receive: 0 errors
    Receive->>CUE: re-emit affected files (only with --write)
```

The receiver applies every change kind (`token.override`,
`component.add`, `component.update`, `component.propAdd`,
`component.variantAdd`) to a copy of the compiled IR, runs the
full lint suite against the mutated IR, and only persists the
changes to CUE source if every gate passes and `--write` is
explicitly set.

This preserves the invariant that contract defects cannot enter
through the handoff path. The lint gate is the same one human
authors pass through; the handoff doesn't have privileged access.

See [ADR 0022 Phase 6](../adr/0022-pkds-cue-authored-design-system-pipeline.md)
for the full design.

## Scenario 8 — graceful shutdown

```mermaid
sequenceDiagram
    participant Signal as SIGTERM
    participant Main as main.go
    participant App as fx.App
    participant Hooks as OnStop hooks
    participant HTTP as HTTP server
    participant Workers as worker goroutines
    participant Bus as event bus

    Signal->>Main: received
    Main->>App: App.Stop(ctx)
    App->>Hooks: call in reverse registration order
    Hooks->>HTTP: Shutdown(ctx) — drain in-flight
    Hooks->>Workers: cancel lifecycle context
    Hooks->>Bus: Unsubscribe + flush
    Workers-->>Hooks: drained
    HTTP-->>Hooks: drained
    Bus-->>Hooks: flushed
    Hooks-->>App: done
    App-->>Main: clean exit
```

Every lifecycle hook registered via `fx.Hook{OnStop: ...}` runs on
shutdown. Workers that were spawned with a lifecycle context
(`context.WithCancel(context.Background())` cancelled from
`OnStop`) get their cancellation signal and drain cleanly. In-flight
HTTP requests finish on a 30-second deadline; the event-bus
connection flushes before the process exits.

## What the runtime tells you about the architecture

Reading the scenarios end to end, three patterns are visible:

- **Composition at boot, not at request time.** All wiring
  happens during `fx.New`. A running app's request path touches
  no DI machinery; the graph is already resolved.
- **Durability before delivery.** State changes commit to DB
  before events leave the process. Everything that can be
  serialised into a transaction is.
- **Transport-agnostic calls.** The consumer's code doesn't know
  whether a port call is going in-process or over NATS. That
  symmetry is the contract that makes monolith-to-microservices
  migration a wiring change, not a code change.
