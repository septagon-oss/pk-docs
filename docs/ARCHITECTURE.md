---
title: PlatformKit OSS Architecture
slug: architecture
collection: docs
status: published
---

# PlatformKit OSS Architecture

PlatformKit OSS is the public backbone for building modular SaaS products in
Go. The core idea is simple: product capabilities are built from small,
inspectable blocks that compose into a modular monolith, and the paid/private
distribution extends those same blocks instead of replacing them.

## The Formula

PlatformKit separates the platform into three layers:

1. Core defines the grammar: modules, registries, entities, authz policies,
   mutation gates, and observability contracts.
2. Modules contribute behavior: domain logic, UI descriptors, design tokens,
   translations, policies, contracts, docs, and tests.
3. Clients compose flows: business-specific journeys that connect modules into
   a product experience.

The OSS release owns the stable grammar. Downstream distributions can add
providers, adapters, hosted services, commercial workflows, and vertical modules
without changing the public contracts.

## Repository Roles

| Repo | Role |
|---|---|
| `pk-core` | Module composition, registries, authz contracts, entity descriptors, mutation gates, and observability contracts. |
| `pk-design` | Design tokens, themes, component descriptors, and design contribution catalogs. |
| `pk-shared` | Small cross-repo primitives for composition, flow definitions, state machines, and identifiers. |
| `pk-runtime` | Host/readiness primitives, guarded HTTP routing, request context, and health projection. |
| `pk-testkit` | Conformance checks, requirement coverage, and API flow execution helpers. |
| `pk-modules` | Small OSS module examples that prove the public contracts. |
| `pk-apps` | Runnable compositions proving the repos work together. |
| `pk-tools` | CLI/TUI primitives and workflow helpers. |
| `pk-client` | Public client primitives for typed calls, errors, retries, and transports. |
| `pk-docs` | Public documentation, release process, and generated docs portal. |

## Building Blocks

A PlatformKit block is not "any package". It is a capability with:

- identity: stable ID, owner, kind, version, and compatibility
- contract: typed inputs, outputs, errors, policies, schemas, or descriptors
- contribution: descriptors registered into catalogs instead of process-global
  mutation
- composition: deterministic ordering, conflict handling, and diagnostics
- extension: namespaced metadata or adapters can be added without a core fork
- runtime binding: the abstract contract can be projected to HTTP, jobs,
  metrics, docs, UI, or clients
- evidence: tests, docs, requirements, examples, and machine-readable manifests

That definition keeps PlatformKit close to an atomic design system for software:
tokens and fields are atoms, descriptors and policies are primitives, features
are molecules, modules are organisms, module packs are product templates, and
apps are composed surfaces.

## Runtime Shape

The runtime is a projection of the same block graph:

```text
modules -> catalogs -> app composition -> runtime projections
                              |-> HTTP routes
                              |-> health and metrics
                              |-> docs and module catalog
                              |-> CLI/TUI workflows
                              |-> client flows
```

No projection should invent a hidden ownership model. If a module contributes an
entity, policy, route, metric, design token, or docs page, the source module
must remain visible in the composed graph.

## What Core Does Not Own

Core does not own databases, queues, cloud SDKs, browser automation, visual
renderers, product billing, tenant-specific copy, or hosted workflows. Those are
adapters, modules, apps, tools, test fixtures, or downstream distribution code.

The public core should remain small enough to reason about and strict enough to
trust.
