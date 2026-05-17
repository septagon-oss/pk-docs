---
title: PlatformKit Formula
slug: platformkit-formula
collection: docs
status: published
---

# PlatformKit Formula

PlatformKit is a modular monolith framework shaped like a software design
system.

The platform is built from blocks. Blocks can be composed into modules, modules
can be composed into apps, and apps can be projected into runtime surfaces such
as HTTP, admin, docs, CLI, workers, MCP tools, and client flows.

## Core, Modules, Clients

```text
core -> modules -> clients
```

Core defines the grammar. It should be small, deterministic, and dependency
light.

Modules add capabilities. A module can contribute logic, contracts, UI
descriptors, design tokens, policies, translations, docs, and tests.

Clients compose business flows. A client chooses modules, binds adapters, adds
brand and copy, and defines product-specific journeys.

## What Makes A Block

A block is release-grade when it has:

| Property | Meaning |
|---|---|
| Identity | Stable ID, owner, kind, version, and compatibility. |
| Boundary | Consumers use public contracts, not implementation packages. |
| Contract | Inputs, outputs, errors, policies, schemas, and extension points are explicit. |
| Contribution | The block registers descriptors into catalogs instead of mutating process globals. |
| Composition | Ordering, defaults, conflicts, and diagnostics are deterministic. |
| Replacement | A compatible block can replace another without consumer code changes. |
| Extension | Downstream code can add namespaced metadata, adapters, or contributions without a core fork. |
| Runtime binding | The block can be projected into runtime behavior without changing its identity. |
| Evidence | Tests, docs, examples, requirements, diagnostics, and manifests prove the contract. |

If a part does not satisfy these properties, it can still be useful, but it is
not yet a PlatformKit block.

## Mathematical Shape

Composition is a partial operation:

```text
compose : Block x Block -> Block | Diagnostics
```

It is partial because not every pair of blocks can compose. Duplicate ownership,
missing required ports, incompatible versions, invalid descriptors, and
conflicting registry keys must return diagnostics.

Where composition is valid, the laws are:

- identity: composing with the empty block changes nothing
- associativity: grouping compatible blocks does not change the result
- closure: compatible valid blocks produce a valid block
- determinism: the same inputs produce the same catalog, order, and diagnostics
- substitution: a compatible replacement preserves the consumer contract
- locality: behavior depends on declared contracts and runtime inputs

This is the practical algebra behind the "building blocks" idea.

## Chainable Runtime Flows

Composable blocks assemble the product graph. Chainable links execute runtime
work.

```text
Link[A,B] = Context x A -> Result[B]
```

HTTP middleware, policy checks, validation, retry handling, tracing, and API
flows are links. Links are chainable when the output of one link satisfies the
input contract of the next link.

Good PlatformKit architecture needs both:

- composable blocks for product structure
- chainable links for runtime execution

## Quality Bar

A PlatformKit core feature is accepted only when it strengthens one of these:

- composability
- replacement safety
- deterministic diagnostics
- runtime binding clarity
- testability
- extension without core forks

That is how the OSS backbone stays small and trustworthy while still supporting
a richer Pro/private distribution on top.
