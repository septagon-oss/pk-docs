---
id: REQ-CHAT-010
title: "Send message persists the chat row and durable event, returns typed info, and fans out in real time when possible"
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
3. Enqueue the durable `chat.message_sent` event in the same
   transaction as the message row (the atomicity contract is specified
   by REQ-CHAT-016);
4. **If** a tenant-addressable `chat.Publisher` is configured, fan the
   persisted message out to connected clients after commit. This
   realtime transport is best-effort: a missing publisher, missing
   tenant context, or transport error does not turn an accepted message
   into a failed send because clients can reconcile from history.

`ListMessages` **shall** return rows for a room ordered
by send time and **shall** filter out nil entries
returned by the underlying CRUD layer (defensive against
partial deserialisation). `ListMessagesSince` **shall**
honour the `since` cutoff so polling consumers can fetch
only the new tail.

## Rationale

Chat is the platform's lowest-friction interaction
surface. Three properties:

1. **Durable domain delivery.** The message row and outbox row commit
   atomically, so downstream consumers see neither lost events nor
   events for rolled-back messages. REQ-CHAT-016 owns the detailed
   envelope and rollback criteria.
2. **Realtime-transport tolerance.** Some deployments do not wire a
   realtime chat publisher, and a connected-client transport can fail
   after commit. The send path still succeeds because the canonical
   history and durable outbox remain intact.
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
- **AC-3 — Durable event enqueued.** A successful send enqueues the
  `chat.message_sent` outbox event. The message/outbox atomicity and
  rollback behavior refine this criterion in REQ-CHAT-016.
- **AC-4 — Realtime fan-out degrades safely.** A configured
  `chat.Publisher` receives the tenant-addressed message after commit;
  a nil publisher, missing tenant context, or publisher error leaves the
  successful send result unchanged.
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
| AC-1 | Test | `modules/platformkit-business-modules/chat_management/features/messaging/service_test.go::TestSendMessage_CreatesMessageAndReturnsInfo`. |
| AC-2 | Test | `modules/platformkit-business-modules/chat_management/features/messaging/service_test.go::TestSendMessage_PropagatesCreateError`. |
| AC-3 | Test | `modules/platformkit-business-modules/chat_management/features/messaging/service_test.go::TestSendMessage_EnqueuesOutboxEvent`. |
| AC-4 | Test | `modules/platformkit-business-modules/chat_management/features/messaging/service_test.go::TestSendMessage_PublishesToChatTransport`, `modules/platformkit-business-modules/chat_management/features/messaging/service_test.go::TestSendMessage_PublisherErrorDoesNotFailCall`, and `modules/platformkit-business-modules/chat_management/features/messaging/service_test.go::TestSendMessage_PublisherSkippedWhenNoTenantInContext`. The nil-publisher branch is also exercised by `modules/platformkit-business-modules/chat_management/features/messaging/service_test.go::TestSendMessage_CreatesMessageAndReturnsInfo`. |
| AC-5 | Test | `modules/platformkit-business-modules/chat_management/features/messaging/service_test.go::TestListMessages_ReturnsAllRoomMessages`. |
| AC-6 | Test | `modules/platformkit-business-modules/chat_management/features/messaging/service_test.go::TestListMessages_FiltersNilMessages`. |
| AC-7 | Test | `modules/platformkit-business-modules/chat_management/features/messaging/service_test.go::TestListMessages_PropagatesError`. |
| AC-8 | Test | `modules/platformkit-business-modules/chat_management/features/messaging/service_test.go::TestListMessagesSince_FiltersOldMessages`. |

## Edge cases & unhappy paths

- **Empty content.** Currently allowed at this layer;
  upper handlers (HTTP / WS) validate non-empty
  content and refuse before reaching the service.
- **Sender on a closed room.** The service does not
  re-check room status; the room-lifecycle owner
  (REQ-CHAT-011) is the gate.
- **Realtime transport failure.** Logged after commit and not returned;
  connected clients reconcile from canonical history while durable
  subscribers receive the outbox event.
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
- **Mitigations:** Atomic message/outbox persistence (AC-1, AC-3),
  realtime-transport tolerance (AC-4), defensive list filtering
  (AC-6).

## Implements (cross-cutting)

- **REQ-001 — Multi-tenant isolation.** Indirect:
  `RoomID` is the tenant boundary in the room layer.
- **REQ-009 — Observability.** AC-3 — event emission
  is the observability hook.
- **REQ-014 — Graceful degradation.** AC-4 — optional realtime
  transport degrades cleanly without weakening durable delivery.

## Compliance mapping

| Control | Coverage |
|---|---|
| SOC2 CC7.2 (System monitoring) | AC-3 — every successful send produces a durable, auditable outbox event. |
| ISO27001 A.13.2 (Information transfer) | AC-1 — every message has a persisted ledger row. |

## Satisfied by

- `modules/platformkit-business-modules/chat_management/features/messaging/message_service.go::SendMessage, ListMessages, ListMessagesSince`.

## Related requirements

- [REQ-CHAT-001 — Messaging umbrella](./REQ-CHAT-001-messaging.md)
- [REQ-CHAT-011 — Room lifecycle](./REQ-CHAT-011-room-lifecycle.md)
- [REQ-CHAT-012 — Public chat with assistant](./REQ-CHAT-012-public-chat-assistant.md)
- [REQ-CHAT-016 — Durable chat events](./REQ-CHAT-016-durable-chat-events.md)
