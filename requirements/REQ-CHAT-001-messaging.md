---
id: REQ-CHAT-001
title: "Messaging feature persists tenant-scoped chat rooms, messages, and participant records"
status: Proposed
date: 2026-05-07
slug: req-chat-001-messaging
category: tenancy
ears_pattern: ubiquitous
verification_methods: [test, inspection]
compliance: []
satisfied_by:
  adr: [ADR-0009]
  conventions: [C-04, C-14]
implements_cross_cutting: [REQ-001, REQ-004]
type: doc
tags: [requirement, feature, chat_management]
module: chat_management
feature: messaging
---

# REQ CHAT-001 — Messaging

Status: **Proposed** (2026-05-07)

## Statement

The messaging feature **shall** persist three tenant-scoped record
types — `ChatRoom`, `ChatMessage`, and `ChatParticipant` — through
the platform's generic CRUD layer. Rooms carry a `TenantID`;
messages and participants attach to a room. Successful mutations
(message create, room create, participant join) **shall** publish
typed events (`chat.message_sent`, `chat.room_created`,
`chat.participant_joined`) so downstream subscribers (push fan-out,
audit, in-app notification) can react.

## Rationale

Chat is the in-app messaging surface; persistence in the standard
generic-CRUD shape gives the rest of the platform — admin lists,
search, audit — uniform access to the records. Event-driven
propagation lets push notifications fire in real time without
coupling the chat handlers to the notification module.

The membership-check property — "non-members cannot read a room's
messages" — is currently a known gap at the service layer (see
AC-3). Until that lands, callers depending on chat for
strict-confidentiality flows must add an authorisation check
upstream of `ListMessages`.

## Acceptance criteria

- **AC-1** Room records persist with a non-empty `TenantID`; the
  room repository returns rooms keyed by ID and supports the
  generic CRUD list/find paths the admin UI consumes.
- **AC-2** Each successful mutation publishes the catalogued event
  (`chat.message_sent`, `chat.room_created`,
  `chat.participant_joined`) via the optional event bus when one is
  wired.
- **AC-3** **Known gap.** Service-level membership enforcement is
  not present — `MessageService::ListMessages` filters by
  `room_id` only, with no check against the requesting user's
  participant record. Treat the service as transport-trusted; rely
  on the upstream HTTP authorisation layer until the membership
  guard lands at this layer.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `pk-modules/chat_management/features/messaging/service_test.go::TestCreateRoom_Success` covers tenant assignment on room create and the list/get paths. |
| AC-2 | Test | `pk-modules/chat_management/features/messaging/service_test.go::TestCreateRoom_Success` covers event emission on the `SendMessage`, `CreateRoom`, and participant-join paths via the recording event bus. |
| AC-3 | Inspection | `message_service.go::ListMessages` (lines 64-78) and `room_service.go::GetRoom` (lines 41-47) — neither consults `ChatParticipant` before returning data. Tracked as a follow-up gap; the upstream HTTP layer is the current enforcement point. |

## Implements (cross-cutting)

- REQ-001 — multi-tenant isolation (rooms carry `TenantID`).
- REQ-004 — audit per mutation (catalogued events
  `chat.message_sent` / `chat.room_created` / `chat.participant_joined`).

## Satisfied by

- `chat_management/features/messaging/feature.go` — wiring.
- `chat_management/features/messaging/message_service.go`,
  `room_service.go`, `service_test.go` — domain logic.
- `chat_management/features/messaging/handler.go`, `routes.go`,
  `permissions.go` — HTTP surface.

## Related requirements

- [REQ-CHAT-002 — Public chat](./REQ-CHAT-002-public-chat.md)
- [REQ-NOTIF-003 — Push notifications](./REQ-NOTIF-003-push-notifications.md)
