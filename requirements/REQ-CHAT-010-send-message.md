---
id: REQ-CHAT-010
title: "Send message persists the chat row, returns the typed info, and emits the message event when the bus is wired"
status: Proposed
date: 2026-05-08
slug: req-chat-010-send-message
category: chat
ears_pattern: event-driven
priority: must
risk: medium
verification_methods: [test]
compliance:
  - SOC2_CC7.2
  - ISO27001_A.13.2
satisfied_by:
  adr: [ADR-0009]
  conventions: [C-04, C-14]
implements_cross_cutting: [REQ-001, REQ-009, REQ-014]
refines: REQ-CHAT-001
type: doc
tags: [requirement, capability, chat_management, messaging, send]
module: chat_management
feature: messaging
capability: send_message
capability_kind: data_invariant
stakeholders:
  - end-user (sends a message)
  - operator (debugs missing messages)
  - subscriber (downstream feature listening for chat events)
---

# REQ CHAT-010 — Send message

Status: **Proposed** (2026-05-08)

## Statement

**When** a caller invokes
`MessageService.SendMessage(roomID, senderID, senderType,
content)`, the chat-messaging feature **shall**:

1. Persist a `ChatMessage` row through the wrapped CRUD
   service with `RoomID`, `SenderID`, `SenderType`,
   `Content`, and a server-generated timestamp;
2. Convert the persisted row into a typed
   `ports.ChatMessageInfo` and return it to the caller;
3. **If** the configured `event.EventBus` is non-nil,
   publish a chat-message event so downstream consumers
   (notifications, audit trail, analytics) can react.
   **If** the bus is nil, complete successfully without
   the event — the persist is the load-bearing
   guarantee, and the event surface is best-effort.

`ListMessages` **shall** return rows for a room ordered
by send time and **shall** filter out nil entries
returned by the underlying CRUD layer (defensive against
partial deserialisation). `ListMessagesSince` **shall**
honour the `since` cutoff so polling consumers can fetch
only the new tail.

## Rationale

Chat is the platform's lowest-friction interaction
surface. Three properties:

1. **Persist before publish.** Persisting first means a
   message that lands in the room will eventually
   propagate even if the event-bus hop drops; an event
   that fires without a row would leave consumers
   chasing a phantom message id. The persist is the
   ledger of truth.
2. **Bus-nil tolerance.** Some deployments (minimal
   builds, isolated unit tests, on-prem stripped
   compositions) do not wire the event bus. The send
   path must work without it; a nil-check is cheaper
   and clearer than a stub bus.
3. **Defensive list filtering.** The wrapped CRUD
   service occasionally hands back nil entries when
   row deserialisation fails on one of N rows.
   Returning the nil through the API would surface as a
   client-side panic; filtering at the service layer
   keeps the contract clean.

## Acceptance criteria

- **AC-1 — Send creates + returns info.** A successful
  `SendMessage` persists the row and returns a
  populated `*ports.ChatMessageInfo`.
- **AC-2 — Send propagates create errors.** A
  CRUD-layer `Create` failure returns the wrapped error
  to the caller; no event is published.
- **AC-3 — Event published when bus available.** When
  the service is constructed with a non-nil
  `event.EventBus`, the event is published after the
  successful persist.
- **AC-4 — No event when bus is nil.** A service with
  `eventBus == nil` returns success on
  `SendMessage` without panicking and without
  emitting an event.
- **AC-5 — List returns all room messages.** A
  `ListMessages(roomID, limit, offset)` returns every
  persisted message in the room, ordered by the
  underlying CRUD service.
- **AC-6 — List filters nil rows.** When the CRUD
  layer's response contains a nil entry, the service
  drops it; the returned slice is a contiguous,
  non-nil sequence.
- **AC-7 — List propagates errors.** A `List` failure
  returns the wrapped error and a `nil, 0` result.
- **AC-8 — ListSince honours cutoff.** A
  `ListMessagesSince(roomID, since)` returns only
  messages whose send timestamp is strictly after
  `since`; older messages are filtered out.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `pk-modules/chat_management/features/messaging/service_test.go::TestSendMessage_CreatesMessageAndReturnsInfo`. |
| AC-2 | Test | `pk-modules/chat_management/features/messaging/service_test.go::TestSendMessage_PropagatesCreateError`. |
| AC-3 | Test | `pk-modules/chat_management/features/messaging/service_test.go::TestSendMessage_PublishesEventWhenBusAvailable`. |
| AC-4 | Test | `pk-modules/chat_management/features/messaging/service_test.go::TestSendMessage_NoEventWhenBusIsNil`. |
| AC-5 | Test | `pk-modules/chat_management/features/messaging/service_test.go::TestListMessages_ReturnsAllRoomMessages`. |
| AC-6 | Test | `pk-modules/chat_management/features/messaging/service_test.go::TestListMessages_FiltersNilMessages`. |
| AC-7 | Test | `pk-modules/chat_management/features/messaging/service_test.go::TestListMessages_PropagatesError`. |
| AC-8 | Test | `pk-modules/chat_management/features/messaging/service_test.go::TestListMessagesSince_FiltersOldMessages`. |

## Edge cases & unhappy paths

- **Empty content.** Currently allowed at this layer;
  upper handlers (HTTP / WS) validate non-empty
  content and refuse before reaching the service.
- **Sender on a closed room.** The service does not
  re-check room status; the room-lifecycle owner
  (REQ-CHAT-011) is the gate.
- **Event-bus failure.** When the bus is non-nil but
  `Publish` errors, the persist already happened; the
  error surfaces but the row remains in place.
- **Cross-tenant leak.** `RoomID` is a UUID; the
  caller must be authorised for the room. The
  service trusts the upstream authorisation.
- **Duplicate send.** Last-send-wins; the underlying
  CRUD service uses a freshly-generated id, so
  duplicates produce two distinct rows.

## Risk

- **Likelihood:** High — every chat send.
- **Impact:** Medium — defective send loses messages
  or fires false events.
- **Mitigations:** Persist-before-publish (AC-1, AC-3),
  bus-nil tolerance (AC-4), defensive list filtering
  (AC-6).

## Implements (cross-cutting)

- **REQ-001 — Multi-tenant isolation.** Indirect:
  `RoomID` is the tenant boundary in the room layer.
- **REQ-009 — Observability.** AC-3 — event emission
  is the observability hook.
- **REQ-014 — Graceful degradation.** AC-4 — nil bus
  degrades cleanly.

## Compliance mapping

| Control | Coverage |
|---|---|
| SOC2 CC7.2 (System monitoring) | AC-3 — every send produces an audit-able event when wired. |
| ISO27001 A.13.2 (Information transfer) | AC-1 — every message has a persisted ledger row. |

## Satisfied by

- `pk-modules/chat_management/features/messaging/message_service.go::SendMessage, ListMessages, ListMessagesSince`.

## Related requirements

- [REQ-CHAT-001 — Messaging umbrella](./REQ-CHAT-001-messaging.md)
- [REQ-CHAT-011 — Room lifecycle](./REQ-CHAT-011-room-lifecycle.md)
- [REQ-CHAT-012 — Public chat with assistant](./REQ-CHAT-012-public-chat-assistant.md)
