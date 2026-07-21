---
id: REQ-CHAT-011
title: "Chat room lifecycle creates rooms with typed metadata, retrieves them by id, and closes by status flip"
status: Proposed
date: 2026-05-08
slug: req-chat-011-room-lifecycle
category: chat
ears_pattern: state-driven
priority: must
risk: medium
verification_methods: [test]
compliance:
  - SOC2_CC6.1
  - ISO27001_A.13.2
satisfied_by:
  adr: [ADR-0009]
  conventions: [C-04, C-14]
implements_cross_cutting: [REQ-001, REQ-009]
refines: REQ-CHAT-001
type: doc
tags: [requirement, capability, chat, messaging, room]
module: chat
feature: messaging
capability: room_lifecycle
capability_kind: state_machine
stakeholders:
  - operator (creates rooms for support sessions)
  - end-user (joins / leaves rooms)
  - tenant administrator (closes stale rooms)
---

# REQ CHAT-011 — Chat room lifecycle

Status: **Proposed** (2026-05-08)

## Statement

The chat-messaging feature **shall** expose three
room-lifecycle operations:

1. **`CreateRoom(tenantID, name, roomType, metadata)`** —
   persist a `ChatRoom` row through the wrapped CRUD
   service with the supplied tenant scope, name, room
   type, and metadata; return a typed
   `ports.ChatRoomInfo` carrying the assigned id and
   default `Status = open`;
2. **`GetRoom(roomID)`** — fetch the persisted row by
   id; return a typed `*ports.ChatRoomInfo` or the
   wrapped not-found error when the row does not exist;
3. **`CloseRoom(roomID)`** — read the row, set
   `Status = closed`, and persist the change. **If**
   the read fails, the operation propagates the wrapped
   error; **if** the persist fails, the row remains in
   its prior state.

`AddParticipant` is currently a no-op stub
(documented at the function signature) — participant
modelling is deferred to a future capability.
`FindRoomByConditions` exposes a flexible-conditions
read path used by the public-chat layer to dedupe
rooms by metadata.

## Rationale

Rooms are the durable container for chat-message rows.
Three properties:

1. **Tenant binding at creation.** The `tenantID`
   parameter is required; without it, rooms cannot be
   listed per tenant and the chat surface leaks across
   tenant boundaries.
2. **Status as the lifecycle marker.** Closed rooms
   continue to be readable (so chat history is
   preserved) but new sends from `MessageService`
   should consult `Status` upstream. Status flips are
   atomic at the CRUD layer.
3. **Read-then-write on close.** A direct status-write
   would lose the rest of the row's state; the
   read-mutate-write sequence preserves every other
   column and lets the caller see the wrapped
   read-error if the room is already gone.

## Acceptance criteria

- **AC-1 — Create returns typed info.** A successful
  `CreateRoom` returns a populated
  `*ports.ChatRoomInfo` with the assigned id, the
  passed `name` and `roomType`, and the supplied
  metadata.
- **AC-2 — Create propagates persist errors.** A
  CRUD-layer `Create` failure returns the wrapped
  error; no info is returned.
- **AC-3 — Get returns the room when it exists.** A
  `GetRoom(persistedID)` returns the typed info with
  every column populated.
- **AC-4 — Get propagates not-found.** A
  `GetRoom(missingID)` returns the wrapped not-found
  error from the CRUD layer.
- **AC-5 — Close flips status.** A successful
  `CloseRoom(roomID)` reads the row, sets
  `Status = closed`, and persists the change.
- **AC-6 — Close propagates read error.** A
  `CloseRoom` against a missing id returns the
  wrapped fetch error; no write is issued.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `pk-modules/chat/features/messaging/service_test.go::TestCreateRoom_Success`. |
| AC-2 | Inspection | `room_service.go::CreateRoom` — wrapped error propagation on the `s.rooms.Create` failure path. Dedicated create-error test pending. |
| AC-3 | Test | `pk-modules/chat/features/messaging/service_test.go::TestGetRoom_ReturnsRoomInfo`. |
| AC-4 | Inspection | `room_service.go::GetRoom` — wrapped error on the `s.rooms.GetByID` failure path. Dedicated not-found test pending. |
| AC-5 | Test | `pk-modules/chat/features/messaging/service_test.go::TestCloseRoom_SetsStatusClosed`. |
| AC-6 | Test | `pk-modules/chat/features/messaging/service_test.go::TestCloseRoom_PropagatesGetError`. |

## Edge cases & unhappy paths

- **Close on already-closed room.** Idempotent;
  the row is fetched, `Status` is set to `closed`
  (already its value), the row is persisted again,
  the metric (if any) increments.
- **Create with empty name.** Currently allowed at
  this layer; UI handlers refuse empty names
  upstream.
- **Concurrent close + send.** Last-write-wins on
  the row; `MessageService.SendMessage` does not
  consult the room's `Status`. A future
  send-on-closed-room gate is documented as a
  follow-up.
- **Add participant.** Currently a no-op stub
  (documented at the signature); future work
  introduces a `RoomParticipant` table and
  participant-bound permissions.

## Risk

- **Likelihood:** Medium — rooms created on every
  support / chat session.
- **Impact:** Medium — defective room creation
  breaks every downstream message; defective close
  leaves stale rooms accumulating.
- **Mitigations:** Tenant-bound creation (AC-1),
  read-mutate-write close (AC-5), wrapped error
  propagation on every error path.

## Implements (cross-cutting)

- **REQ-001 — Multi-tenant isolation.** AC-1 — every
  room is tenant-scoped.
- **REQ-009 — Observability.** Indirect via the
  underlying CRUD service's tracing.

## Compliance mapping

| Control | Coverage |
|---|---|
| SOC2 CC6.1 (Logical access) | AC-1 — tenant-bound rooms cannot leak across boundaries. |
| ISO27001 A.13.2 (Information transfer) | AC-5 — controlled close transition. |

## Satisfied by

- `pk-modules/chat/features/messaging/room_service.go::CreateRoom, GetRoom, CloseRoom, AddParticipant, FindRoomByConditions`.

## Related requirements

- [REQ-CHAT-001 — Messaging umbrella](./REQ-CHAT-001-messaging.md)
- [REQ-CHAT-010 — Send message](./REQ-CHAT-010-send-message.md) — the consumer that depends on a live room.
- [REQ-CHAT-012 — Public chat with assistant](./REQ-CHAT-012-public-chat-assistant.md)
