---
id: REQ-PORTS-017
title: "The in-process channel event adapter provides bounded asynchronous fan-out without silent drops"
status: Proposed
date: 2026-07-15
slug: req-ports-017-channel-event-adapter
category: availability
ears_pattern: event-driven
priority: should
risk: high
verification_methods: [test]
satisfied_by:
  adr: [ADR-0009, ADR-0021]
  conventions: [C-14]
implements_cross_cutting: [REQ-014, REQ-015]
refines: REQ-PORTS-002
type: doc
tags: [requirement, capability, ports, adapter, events, channels]
module: platformkit_ports
feature: typed_events
capability: channel_event_adapter
capability_kind: inter_module_contract
---

# REQ PORTS-017 — Channel event adapter

Status: **Proposed** (2026-07-15)

## Statement

**When** an in-process subscriber queue has capacity, `chanevents` **shall**
deliver each published message asynchronously to every topic subscriber; **if**
the bounded queue remains full until the publish context ends, it **shall**
return `KindUnavailable` rather than silently dropping the message.

## Rationale

The adapter explicitly promises at-most-once, single-process delivery. Bounded
queues prevent unbounded memory growth, while context-aware backpressure makes
overload visible to the publisher. Idempotent cleanup prevents dispatcher and
topic-index leaks in long-lived processes.

## Acceptance criteria

- **AC-1 — Common bus behavior.** The adapter passes the shared events driver
  suite, including fan-out, isolation, panic containment, and concurrency.
- **AC-2 — Observable backpressure.** A saturated subscription blocks until
  capacity or context completion and reports the latter as `KindUnavailable`.
- **AC-3 — Safe subscription lifecycle.** Nil handlers are rejected as
  `KindInvalid`; unsubscribe is idempotent and removes an empty topic index.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `core/platformkit-adapters/chanevents/chanevents_test.go::TestPassesEventsConformance`. |
| AC-2 | Test | `core/platformkit-adapters/chanevents/chanevents_test.go::TestPublishBackpressureRespectsContext`. |
| AC-3 | Test | `core/platformkit-adapters/chanevents/chanevents_test.go::TestSubscribeRejectsNilHandler`. |
| AC-3 | Test | `core/platformkit-adapters/chanevents/chanevents_test.go::TestUnsubscribeReleasesEmptyTopic`. |

## Satisfied by

- `core/platformkit-adapters/chanevents`.
- `core/platformkit-ports/events/eventstest`.
