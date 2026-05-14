---
id: REQ-CHAT-002
title: "Public chat feature provides an unauthenticated assistant surface with bounded LLM-call timeouts"
status: Proposed
date: 2026-05-07
slug: req-chat-002-public-chat
category: availability
ears_pattern: event-driven
verification_methods: [test, inspection]
compliance: []
satisfied_by:
  adr: [ADR-0009]
  conventions: [C-04, C-14]
implements_cross_cutting: [REQ-014]
type: doc
tags: [requirement, feature, chat_management]
module: chat_management
feature: public_chat
---

# REQ CHAT-002 — Public chat

Status: **Proposed** (2026-05-07)

## Statement

**When** an unauthenticated visitor opens a public chat assistant
session, the feature **shall** create or look up a session-keyed
`ChatRoom`, append messages through the standard
`MessageService` (REQ-CHAT-001), and route the visitor's prompt to
the configured site assistant. The assistant call **shall** be
wrapped in a configurable timeout so a slow LLM provider does not
stall the request indefinitely. Persistent state (room +
messages) **shall** carry the originating tenant via the room's
`TenantID`.

## Rationale

Public chat is the assistant the marketing site exposes to
visitors. The LLM provider is the dominant cost + latency
component, so a bounded per-request timeout is the load-bearing
property — it keeps a stalled provider from accumulating in-flight
requests. Tenant-scoping the session lets each tenant's public
assistant see only its own context.

## Acceptance criteria

- **AC-1** A public session resolves to a `ChatRoom` with a
  populated `TenantID`; subsequent messages on the same session id
  attach to that room.
- **AC-2** The assistant call enforces the configured timeout
  (`publicAssistantTimeout()`), returning an error rather than
  blocking indefinitely when the provider is slow.
- **AC-3** **Known gap.** Per-IP and per-session rate limiting are
  not implemented at this layer today; the upstream gateway or a
  reverse proxy is the current enforcement point. Until rate
  limits land, an attacker can drive provider cost by replaying
  the public endpoint.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `pk-modules/chat_management/features/public_chat/assistant_test.go::TestSendPublicMessageUsesAssistantReply` covers session resolution; `service.go::GetOrCreatePublicSession` constructs the room with the tenant from context. |
| AC-2 | Inspection | `assistant.go:46-82` declares the timeout field, defaults via `defaultPublicAssistantTimeout`, and applies it in `Reply`. |
| AC-3 | Inspection | `service.go` and `assistant.go` contain no rate-limiter; reviewers verify no rate-limit code path exists at this layer. |

## Implements (cross-cutting)

- REQ-014 — graceful degradation (timeout-bounded LLM calls).

## Satisfied by

- `chat_management/features/public_chat/feature.go`
- `chat_management/features/public_chat/assistant.go`,
  `assistant_test.go`
- `chat_management/features/public_chat/service.go`
- `chat_management/features/public_chat/handler.go`, `routes.go`,
  `permissions.go`

## Related requirements

- [REQ-CHAT-001 — Messaging](./REQ-CHAT-001-messaging.md) — the underlying CRUD path public chat reuses.
