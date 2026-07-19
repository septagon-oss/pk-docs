---
id: REQ-PORTS-013
title: "Event-bus drivers provide isolated fan-out, safe unsubscription, and concurrent delivery"
status: Proposed
date: 2026-07-15
slug: req-ports-013-event-driver-conformance
category: governance
ears_pattern: ubiquitous
priority: must
risk: high
verification_methods: [test]
satisfied_by:
  adr: [ADR-0009, ADR-0021]
  conventions: [C-14]
implements_cross_cutting: [REQ-002, REQ-015]
refines: REQ-PORTS-002
type: doc
tags: [requirement, capability, ports, events, conformance]
module: platformkit_ports
feature: typed_events
capability: event_driver_conformance
capability_kind: inter_module_contract
---

# REQ PORTS-013 — Event driver conformance

Status: **Proposed** (2026-07-15)

## Statement

Every combined `events.Publisher`/`events.Subscriber` driver **shall** pass the
shared event-bus suite for topic isolation, per-topic fan-out, unsubscription,
panic containment, concurrent publication, and typed-event metadata delivery.

## Rationale

Drivers may differ in durability and redelivery, but the common seam must not
leak messages across topics, lose subscribers during fan-out, or let one
handler panic destroy delivery for healthy subscribers.

## Acceptance criteria

- **AC-1 — Topic and fan-out semantics.** Messages reach every subscriber of
  their topic and never a subscriber of another topic.
- **AC-2 — Lifecycle and containment.** Unsubscribe stops delivery, zero-message
  publish is a no-op, and a panicking handler cannot kill healthy siblings.
- **AC-3 — Concurrency and typed path.** Concurrent publishers are safe and
  `events.Emit` metadata/payload round-trips through the driver.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `core/platformkit-ports/events/eventstest/eventstest_test.go::TestMemBusPassesConformance`. |
| AC-2 | Test | `core/platformkit-ports/events/eventstest/eventstest_test.go::TestMemBusPassesConformance`. |
| AC-3 | Test | `core/platformkit-ports/events/eventstest/eventstest_test.go::TestMemBusPassesConformance`. |

## Satisfied by

- [ADR 0021 — Interface contract test suites](../adr/0021-interface-contract-test-suites.md).
- `core/platformkit-ports/events/eventstest`.
