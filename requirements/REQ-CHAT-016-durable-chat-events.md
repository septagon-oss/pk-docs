---
id: REQ-CHAT-016
title: "Chat message events are emitted durably via the transactional outbox: message row and event row commit atomically"
status: Proposed
date: 2026-07-02
slug: req-chat-016-durable-chat-events
category: data-durability
ears_pattern: event-driven
priority: must
risk: high
verification_methods: [test, inspection]
compliance:
  - SOC2_CC7.2
satisfied_by:
  adr: [ADR-0007]
  conventions: [C-14]
implements_cross_cutting: [REQ-001, REQ-009, REQ-014]
refines: REQ-CHAT-001
depends_on: [REQ-CHAT-010]
type: doc
tags: [requirement, capability, chat_management, messaging, outbox]
module: chat_management
feature: messaging
capability: durable_chat_events
capability_kind: data_invariant
stakeholders:
  - downstream subscribers (notifications, search indexing, audit) relying on at-least-once delivery
  - operator (reconciles "message exists but event never arrived" incidents)
  - chat-only compositions (need an outbox without admin_management's shared provider)
---

# REQ CHAT-016 — Durable chat events

Status: **Proposed** (2026-07-02)

## Statement

**When** `MessageService.SendMessage` accepts a message, the
messaging feature **shall** write the `ChatMessage` row and an
outbox row carrying the `chat.message_sent` event
(`EventTypeMessageSent`) in a **single database transaction**:

1. The outbox row is enqueued inside
   `repo.WithTransaction` with aggregate type `chat_message`, the
   persisted message id as aggregate id, the tenant id from the
   request context, the message's creation time as `OccurredAt`,
   status `pending`, and a payload identifying room, message,
   sender, and content;
2. **If** either write fails, the transaction **shall** roll back
   both — subscribers never see an event for a message that was
   not persisted, and no message exists whose event was silently
   lost;
3. Post-commit real-time fan-out through `chat.Publisher` is
   best-effort — a transport hiccup is recoverable via history
   replay, while durable event-bus delivery is the outbox drain
   worker's job (at-least-once, with retry).

Bot replies posted by the command dispatcher **shall** route
through the same persist-plus-enqueue path, so all chat traffic
shares one durability guarantee. The `chatoutbox` package
**shall** provide the outbox repository and service as **named**
fx providers (`chat_management_outbox_repo`,
`chat_management_outbox_service`) so chat-only compositions
construct an outbox without colliding with admin_management's
unnamed shared provider.

## Rationale

The earlier direct-publish path had the classic dual-write hole:
"Postgres write succeeded, event-bus write lost". For chat that
means notification fan-out, search indexing, and audit consumers
silently miss messages — an unreconcilable gap because nothing
records that the event was ever owed. ADR-0007's transactional
outbox closes it: the event becomes a row in the same
transaction as the domain write, and delivery becomes a
drain-worker concern with retries.

This is a data invariant — the atomicity of (message row, event
row) is the property, independent of any particular consumer —
hence `capability_kind: data_invariant`. The named-provider shape
matters for composition: outbox infrastructure is module-owned
per producer, and fx graphs that include both chat and admin
outboxes must not have their providers collide.

## Acceptance criteria

- **AC-1 — Atomic commit with correct envelope.** A successful
  `SendMessage` commits exactly one `ChatMessage` row and one
  outbox row; the outbox row carries event type
  `chat.message_sent`, aggregate type `chat_message`, the message
  id as aggregate id, status `pending`, and a non-zero
  `OccurredAt`.
- **AC-2 — Rollback drops both rows.** An outbox enqueue failure
  inside the transaction fails `SendMessage` and leaves zero
  committed (and zero staged) chat rows and zero outbox rows.
- **AC-3 — Tenant stamping from context.** The outbox row's
  tenant id comes from the request context; with no tenant in
  context the column is empty and the row is still valid
  (cross-tenant fan-out is the subscriber's concern).
- **AC-4 — Named chat-owned providers.** The outbox repository
  and service are provided under the
  `chat_management_outbox_repo` / `chat_management_outbox_service`
  names, constructed from the shared `internal/outbox` service
  over the platform table factory and event bus.
- **AC-5 — Bot replies inherit durability.** Command-dispatch
  replies persist through the same transaction-plus-outbox path
  as user messages.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `modules/platformkit-business-modules/chat_management/features/messaging/service_outbox_test.go::TestSendMessage_OutboxPath_PersistsBothRowsAtomically`. |
| AC-2 | Test | `modules/platformkit-business-modules/chat_management/features/messaging/service_outbox_test.go::TestSendMessage_OutboxPath_RollbackDropsChatMessageOnEnqueueFailure`. |
| AC-3 | Test | `modules/platformkit-business-modules/chat_management/features/messaging/service_outbox_test.go::TestSendMessage_OutboxPath_TenantFromContextStampedOnOutboxRow` (empty-context branch). |
| AC-4 | Inspection | `modules/platformkit-business-modules/chat_management/internal/chatoutbox/provider.go::Providers` — fx annotations with the two result/param name tags. |
| AC-5 | Inspection | `modules/platformkit-business-modules/chat_management/features/messaging/message_service.go::postCommandReply` — routes replies through `persistMessage`, the same transactional path. Covered indirectly by the AC-1 pipeline plus REQ-CHAT-014 AC-1. |

## Edge cases & unhappy paths

- **Transport publish failure post-commit.** Logged, not
  returned; connected clients reconcile via history replay. The
  durable path is the outbox, not the transport.
- **No tenant in context.** The outbox row commits with an empty
  tenant column (AC-3); system-context sends are legitimate.
- **Drain-worker downtime.** Rows accumulate as `pending` and
  deliver when the worker (owned by admin_management/settings,
  30s cadence with retry) resumes — delayed, not lost.
- **Duplicate delivery.** At-least-once by design; subscribers
  must be idempotent on the event id / aggregate id.

## Risk

- **Likelihood:** High — every chat send takes this path.
- **Impact:** High — a broken invariant either loses events
  (silent subscriber gaps) or emits phantoms (events for rows
  that rolled back).
- **Mitigations:** Single-transaction enqueue (AC-1),
  rollback atomicity (AC-2), drain-worker retries.

## Implements (cross-cutting)

- **REQ-001 — Multi-tenant isolation.** AC-3 — tenant binding
  travels on the event envelope.
- **REQ-009 — Observability.** AC-1 — every send is observable as
  a catalogued, durable event.
- **REQ-014 — Graceful degradation.** Post-commit transport
  fan-out degrades without data loss.

## Compliance mapping

| Control | Coverage |
|---|---|
| SOC2 CC7.2 (System monitoring) | AC-1 + AC-2 — the event stream is a complete, non-phantom record of accepted messages. |

## Satisfied by

- `modules/platformkit-business-modules/chat_management/internal/chatoutbox/provider.go::Providers, provideRepository, provideService` —
  the chat-owned named DI providers.
- `modules/platformkit-business-modules/chat_management/features/messaging/message_service.go::persistMessage` —
  the single-transaction write + enqueue.
- [ADR 0007 — Transactional outbox for event delivery](../adr/0007-transactional-outbox-for-event-delivery.md) —
  the pattern this capability instantiates for chat.

## Related requirements

- [REQ-CHAT-001 — Messaging umbrella](./REQ-CHAT-001-messaging.md)
- [REQ-CHAT-010 — Send message](./REQ-CHAT-010-send-message.md) —
  the send capability whose earlier best-effort event surface
  this outbox path supersedes for event-bus consumers.
- [REQ-CHAT-014 — Chat command dispatch](./REQ-CHAT-014-command-dispatch.md) —
  bot replies share this pipeline (AC-5).
- [REQ-ADMIN-011 — Settings outbox](./REQ-ADMIN-011-settings-outbox.md) —
  the sibling producer whose shared drain worker delivers these
  rows.
