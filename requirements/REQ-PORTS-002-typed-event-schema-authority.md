---
id: REQ-PORTS-002
title: "Typed event declarations are the authority for wire identity, durability, and projected schema"
status: Proposed
date: 2026-07-15
slug: req-ports-002-typed-event-schema-authority
category: governance
ears_pattern: ubiquitous
priority: must
risk: high
verification_methods: [test, inspection]
satisfied_by:
  adr: [ADR-0009, ADR-0018]
  conventions: [C-14]
implements_cross_cutting: [REQ-002, REQ-004]
type: doc
tags: [requirement, feature, ports, events, schemas]
module: platformkit_ports
feature: typed_events
---

# REQ PORTS-002 — Typed event and schema authority

Status: **Proposed** (2026-07-15)

## Statement

The `platformkit_ports` design authority **shall** derive each declared
event's portable contract from a typed `port.Event[T]`, preserving its name,
schema version, documentation, and delivery durability while projecting the
wire schema from `T` rather than accepting a separately authored schema map.

## Rationale

Typed payloads make producers, consumers, manifests, and AsyncAPI projections
share one source of truth. A derived schema eliminates hand-maintained field
maps, while the durable zero value prevents an omitted setting from silently
downgrading a state-changing event to best-effort delivery.

## Acceptance criteria

- **AC-1 — Identity and schema projection.** `Event[T].Contract()` preserves
  the event name/version/documentation and derives JSON field names and kinds
  from the exported payload fields.
- **AC-2 — Safe structural projection.** Projection ignores unexported and
  `json:"-"` fields, represents time and collection kinds consistently, and
  terminates recursive types with an explicit recursion marker.
- **AC-3 — Fail-closed durability.** Omitted durability is effectively
  `durable`; only an explicit `best_effort` declaration changes that guarantee.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `core/platformkit-ports/port/port_test.go::TestEventContractProjectsSchema`. |
| AC-2 | Test | `core/platformkit-ports/port/port_test.go::TestSchemaOfHandlesRecursion`. |
| AC-3 | Test | `core/platformkit-ports/port/port_test.go::TestEventContractPreservesExplicitBestEffortDurability`. |

## Satisfied by

- [ADR 0018 — Event contracts are declared](../adr/0018-event-contracts-are-declared.md).
- `core/platformkit-ports/port/event.go`.
- `core/platformkit-ports/port/schema.go`.
