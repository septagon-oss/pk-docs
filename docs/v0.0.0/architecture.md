---
title: Architecture (v0.0.0)
slug: v0-0-0-architecture
collection: docs
status: published
---

# Architecture

PlatformKit OSS is best understood as a **formula**:

> **Core defines the rules. Modules add capabilities. Clients compose.**

Everything in the OSS — every package, every interface, every CI gate —
exists to keep one of those three layers honest. This page is the
reference for what each layer is allowed to do and why.

## The three layers

```
┌──────────────────────────────────────────────────────────────┐
│ Clients          (pk-apps + downstream apps + Pro apps)      │
│   Compose modules. Choose providers. Run binaries.            │
├──────────────────────────────────────────────────────────────┤
│ Modules          (pk-modules + Pro modules + third-party)    │
│   Add capability. Declare ports. Contribute to registry.      │
├──────────────────────────────────────────────────────────────┤
│ Core             (pk-core + pk-shared + pk-design + runtime) │
│   Define rules. Provide contracts and primitives.             │
└──────────────────────────────────────────────────────────────┘
```

The arrow of allowed imports goes **downward only**. Modules import
from core; clients import from both. Core never imports modules. Modules
never import each other.

## Core: rules and contracts

The core layer is split across four repos:

- `pk-shared` — minimal building blocks (composition, IDs, state
  machines, flows). Has zero opinions.
- `pk-core` — the framework rules: registries, ports, mutation gates,
  authz/entity/observability contracts, architecture fitness tests.
- `pk-design` — tokens and component descriptors; the visual rule book.
- `pk-runtime` — the host: bind sockets, run middleware, project
  health, expose context.

Together they answer the question "what is a PlatformKit module
allowed to do?" If you cannot find a primitive in core, the module
needing it is asking for too much.

## Modules: capability and contribution

A module is a single Go package under `pk-modules/pkg/<name>/` that
provides a `New(...) *Module` constructor and a `Compose(registry)
error` method. That is the whole contract.

Inside, a module typically holds:

- one or more **stores** (interface + default impl),
- one or more **handlers** (HTTP routes),
- zero or more **admin contributions** (sidebar entries, entity pages),
- zero or more **health probes**,
- a **doc.go** that explains the module's purpose in one paragraph.

Modules are **not allowed** to:

- import another module's package directly,
- mutate the registry after `Compose` returns,
- start goroutines that outlive the runtime,
- assume any provider other than what their interfaces declare.

These constraints are enforced by architecture fitness tests in
`pk-core` and by review.

## Clients: composition and binary shape

A client is whatever turns a set of modules into a running process.
`pk-apps/apps/starter-saas` is the canonical OSS client; downstream
distributions and Pro will ship their own.

The client owns:

- the **module slice** (which modules, in what order),
- the **provider choices** (which `Store`, `Hasher`, `Sender`),
- the **runtime wiring** (HTTP server, signal handling, config load),
- the **release artifact** (binary, container, Helm chart).

A client may **not** modify a module's behaviour beyond the options
the module exposes. If the option does not exist, the client is asking
the wrong layer for the change.

## The registry as the single contact surface

Modules don't talk to each other. They talk to a `pkcore.Registry`.
The registry collects:

- **provided ports** — `tenant.Lookup`, `user.Hasher`, etc.
- **admin contributions** — sidebar sections, entity pages.
- **health probes** — anything implementing `health.Probe`.
- **route handlers** — guarded HTTP routes.
- **context extractors** — `slog.Attr` enrichment.

`Compose` is the only moment a module is allowed to write to the
registry. After every module's `Compose` returns, the registry is
frozen and the runtime starts. This rule is what makes PlatformKit
applications introspectable: at boot we know exactly who provides
what.

## How the formula stays true

Three mechanisms keep the formula honest:

1. **Architecture fitness tests.** `pk-core/architecture/*` runs go
   build/vet-style boundary checks (e.g. "no module imports another
   module"). They fail CI if a cross-module import sneaks in.
2. **Repository baseline workflow.** Every OSS repo's
   `repository-baseline.yml` verifies `LICENSE`, `README.md`,
   `SECURITY.md`, `CONTRIBUTING.md`, `CODEOWNERS` are present. No
   stealth-untracked-public-repo configuration.
3. **The `pk` CLI.** `pk verify` runs the same checks locally; `pk
   doctor` reports repo hygiene; `pk explain modules` introspects the
   composed registry of a running app.

If those three are green, the formula holds.

## Where Pro fits

Pro is **just another client + modules**. It does not unlock secret
behavior in the OSS; it does not patch private internals. It

- adds modules with stricter providers,
- adds modules with extra capability (deploy plane, assurance gates),
- composes them into Pro-branded clients.

Because Pro depends only on OSS contracts, OSS users can drop Pro
modules in piecemeal — the formula stays the same all the way down.
