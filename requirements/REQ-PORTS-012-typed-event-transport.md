---
id: REQ-PORTS-012
title: "Declared typed events retain contract identity across the transport seam"
status: Proposed
date: 2026-07-15
slug: req-ports-012-typed-event-transport
category: governance
ears_pattern: event-driven
priority: must
risk: high
verification_methods: [test, inspection]
satisfied_by:
  adr: [ADR-0009, ADR-0018]
  conventions: [C-14]
implements_cross_cutting: [REQ-002, REQ-004]
refines: REQ-PORTS-002
type: doc
tags: [requirement, capability, ports, events, transport]
module: platformkit_ports
feature: typed_events
capability: typed_event_transport
capability_kind: inter_module_contract
---

# REQ PORTS-012 — Typed event transport

Status: **Proposed** (2026-07-15)

## Statement

**When** a caller emits a declared `port.Event[T]`, the events seam **shall**
publish JSON on the contract name and stamp the contract name, payload version,
and content type; **when** a subscriber decodes it, the seam **shall** reject a
foreign contract, incompatible major version, or malformed payload as
`KindInvalid` while accepting additive minor-version drift.

## Rationale

Transporting bytes without contract identity recreates ad-hoc events. The
typed path carries enough metadata to detect topic mistakes and incompatible
schema generations without rejecting additive evolution within one major.

## Acceptance criteria

- **AC-1 — Emission identity.** `Emit` JSON-encodes `T`, publishes on the event
  name, and stamps name, version, and `application/json` metadata.
- **AC-2 — Compatibility check.** `Decode` rejects foreign names and foreign
  major versions but accepts minor/patch drift and unknown JSON fields.
- **AC-3 — Invalid payload discipline.** Encoding or decoding failures return
  `KindInvalid`, and an encoding failure publishes nothing.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `core/platformkit-ports/events/events_test.go::TestEmitDecodeRoundTrip`. |
| AC-2 | Test | `core/platformkit-ports/events/events_test.go::TestDecodeRejectsForeignMajorVersion`. |
| AC-2 | Test | `core/platformkit-ports/events/events_test.go::TestDecodeAcceptsMinorVersionDrift`. |
| AC-3 | Test | `core/platformkit-ports/events/events_test.go::TestEmitRejectsUnmarshalablePayload`. |

## Satisfied by

- [ADR 0018 — Event contracts are declared](../adr/0018-event-contracts-are-declared.md).
- `core/platformkit-ports/events/events.go`.
