---
id: REQ-ENTITLE-010
title: "Entitlement grant subscriber extracts items from event payloads, refuses nil dependencies, and tolerates non-map entries"
status: Proposed
date: 2026-05-08
slug: req-entitle-010-grant-subscriber
category: governance
ears_pattern: event-driven
priority: must
risk: medium
verification_methods: [test]
satisfied_by:
  adr: [ADR-0009]
  conventions: [C-04, C-14]
implements_cross_cutting: [REQ-005, REQ-013]
refines: REQ-ENTITLE-001
type: doc
tags: [requirement, capability, entitlement_management, grants, subscriber]
module: entitlement_management
feature: grants
capability: grant_subscriber
capability_kind: failure_mode
stakeholders:
  - billing service (emits subscription events the subscriber consumes)
  - entitlement consumer (downstream gate)
  - operator (debugs missing entitlements)
---

# REQ ENTITLE-010 — Grant subscriber

Status: **Proposed** (2026-05-08)

## Statement

The grants feature **shall** expose a subscriber that
listens for upstream subscription / plan events and projects
them into entitlement-grant rows. The subscriber **shall**:

1. Extract `items` from the event payload, accepting both
   `[]any` and typed slice shapes;
2. Tolerate nil / wrong-type payloads — when the payload
   is missing or shaped unexpectedly, the extractor returns
   an empty slice and the subscriber logs but does not
   panic;
3. Skip non-map entries within the items slice (data
   corruption tolerance);
4. Refuse construction (`NewSubscriber`) with a typed error
   when any required dependency is nil — the wiring bug
   surfaces at boot, not at first event.

## Rationale

The entitlement subscriber sits at the junction of
billing-event truth and downstream entitlement gates.
Three properties:

1. **Schema flexibility on extraction.** Producer events
   may evolve (typed slice today, generic slice
   tomorrow); the extractor accepts both shapes so
   schema migrations don't break the subscriber.
2. **Defensive against malformed payloads.** A producer
   bug should not panic the subscriber; an empty
   extraction is safer than a crash.
3. **Nil-deps refusal at construction.** The subscriber
   has hard dependencies (event bus, repository,
   logger); a nil at construction would manifest as a
   panic at first event. Refusing at construction
   surfaces the wiring error at startup.

## Acceptance criteria

- **AC-1 — Extract from `[]any` slice.** A payload
  carrying items as `[]any{...maps...}` is extracted
  to the typed slice.
- **AC-2 — Extract from typed slice.** A payload
  carrying items as a typed slice is extracted via
  reflection to the same shape.
- **AC-3 — Tolerate nil / wrong shape.** A nil payload
  or wrong-type entry returns an empty slice without
  panicking.
- **AC-4 — Skip non-map entries.** A slice mixing
  maps with non-map entries returns only the map
  entries.
- **AC-5 — Refuse nil dependencies.** A
  `NewSubscriber(nil, ...)` returns the typed
  nil-dep error.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `modules/platformkit-business-modules/entitlement_management/features/grants/subscriber_test.go::TestExtractItems_AnySlice`. |
| AC-2 | Test | `modules/platformkit-business-modules/entitlement_management/features/grants/subscriber_test.go::TestExtractItems_TypedSlice`. |
| AC-3 | Test | `modules/platformkit-business-modules/entitlement_management/features/grants/subscriber_test.go::TestExtractItems_NilOrWrong`. |
| AC-4 | Test | `modules/platformkit-business-modules/entitlement_management/features/grants/subscriber_test.go::TestExtractItems_SkipsNonMapEntries`. |
| AC-5 | Test | `modules/platformkit-business-modules/entitlement_management/features/grants/subscriber_test.go::TestNewSubscriber_RejectsNilDeps`. |

## Edge cases & unhappy paths

- **Empty items array.** Returns an empty slice; the
  subscriber emits no grants but does not error.
- **Concurrent event delivery.** Each event is
  processed independently; the subscriber does not
  serialise across events.
- **Repository write failure.** Surfaces as a
  wrapped error; the event-bus retry policy decides
  whether to redeliver.
- **Producer-side schema change.** Adding new fields
  to the item payload is tolerated; removing
  required fields surfaces as missing-grant rows.

## Risk

- **Likelihood:** Medium — every billing event.
- **Impact:** High — defective subscriber leaves
  entitlement rows out of sync with subscriptions
  (paid features become inaccessible / accessible
  inappropriately).
- **Mitigations:** Schema-flexible extractor (AC-1,
  AC-2), defensive payload handling (AC-3, AC-4),
  nil-deps refusal (AC-5).

## Implements (cross-cutting)

- **REQ-005 — Fail-closed.** AC-3, AC-5 — refuse on
  nil rather than panicking.
- **REQ-013 — Integration adapters isolated.** The
  subscriber is the integration boundary between
  billing events and entitlement persistence.

## Satisfied by

- `modules/platformkit-business-modules/entitlement_management/features/grants/subscriber.go` — orchestration + ExtractItems + NewSubscriber.

## Related requirements

- [REQ-ENTITLE-001 — Grants](./REQ-ENTITLE-001-grants.md)
- [REQ-BILL-014 — Usage metering](./REQ-BILL-014-usage-metering.md) — the entitlement consumer of metered limits.
- [REQ-005 — Fail-closed](./REQ-005-authorisation-fails-closed.md)
- [REQ-013 — Integration adapters isolated](./REQ-013-integration-adapters-isolated.md)
