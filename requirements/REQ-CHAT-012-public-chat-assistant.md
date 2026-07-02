---
id: REQ-CHAT-012
title: "Public chat invokes the assistant for the reply, falls back to a static message when the assistant fails"
status: Proposed
date: 2026-05-08
slug: req-chat-012-public-chat-assistant
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
implements_cross_cutting: [REQ-005, REQ-009, REQ-013, REQ-014]
refines: REQ-CHAT-002
type: doc
tags: [requirement, capability, chat_management, public_chat, assistant]
module: chat_management
feature: public_chat
capability: public_chat_assistant
capability_kind: failure_mode
stakeholders:
  - public visitor (anonymous chat user)
  - tenant administrator (configures assistant prompts)
  - operator (debugs assistant failures)
---

# REQ CHAT-012 — Public chat with assistant fallback

Status: **Proposed** (2026-05-08)

## Statement

The public-chat feature **shall** orchestrate a reply
pipeline for an anonymous user's message:

1. Build an article-aware assistant prompt that
   incorporates the tenant's published content (so the
   assistant can answer tenant-specific questions);
2. Invoke the configured assistant runtime to produce a
   reply;
3. **If** the assistant returns a successful reply,
   persist both the user's message and the assistant's
   reply, and return the reply to the caller;
4. **If** the assistant fails (timeout, transport error,
   refusal), fall back to a configured static reply
   (e.g., "Thanks for your message — we'll get back to
   you") so the user always receives an answer; persist
   the user's message and the fallback reply with the
   assistant-failure flag in metadata.

The fallback path **shall not** surface the
assistant-side failure to the public visitor; the
operator sees the failure in structured logs.

## Rationale

Public chat is a tenant's lowest-friction outreach
surface. Three properties:

1. **Article-aware prompting.** The assistant must
   know the tenant's content to answer
   tenant-specific questions. The prompt-builder
   surfaces published articles, FAQs, and pricing
   as context so the assistant doesn't hallucinate
   tenant-specific facts.
2. **Always-reply contract.** A public visitor
   should never see "the AI is down" — the
   conversation must continue. The static-reply
   fallback preserves the conversation flow even
   when the assistant adapter is unavailable.
3. **Failure observability without disclosure.**
   Operators need to see assistant failures in
   logs / metrics; visitors must not. The
   `assistant_failure` metadata flag on the
   persisted reply is the operator's signal
   without leaking to the user-facing surface.

## Acceptance criteria

- **AC-1 — Article-aware prompt.** The assistant
  prompt builder surfaces the tenant's published
  articles when constructing the request to the
  assistant runtime.
- **AC-2 — Successful reply.** When the assistant
  runtime returns a reply, the public-chat handler
  persists both the user message and the
  assistant reply, then returns the reply to the
  caller.
- **AC-3 — Fallback on assistant failure.** When
  the assistant runtime errors, the handler
  persists the user message and a static fallback
  reply, then returns the fallback reply to the
  caller; the assistant error is logged but not
  surfaced.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `modules/platformkit-business-modules/chat_management/features/public_chat/assistant_test.go::TestSiteAssistantReplyBuildsArticleAwarePublicPrompt`. |
| AC-2 | Test | `modules/platformkit-business-modules/chat_management/features/public_chat/assistant_test.go::TestSendPublicMessageUsesAssistantReply`. |
| AC-3 | Test | `modules/platformkit-business-modules/chat_management/features/public_chat/assistant_test.go::TestSendPublicMessageFallsBackWhenAssistantFails`. |

## Edge cases & unhappy paths

- **Empty assistant reply.** Treated as a failure
  (the static fallback fires); a vacuous reply is
  worse UX than the static one.
- **Assistant timeout.** The runtime adapter
  returns a typed timeout error which the
  fallback path catches via the same branch as
  any other failure.
- **Tenant has no articles.** The prompt builder
  produces a generic prompt; the assistant
  responds without article context.
- **Persist failure on the message.** The
  reply is still produced (assistant ran), but
  the row is missing from history; the operator
  sees the persist error in logs. Future work:
  retry queue.
- **Spam / abuse.** Out of scope for this REQ;
  rate-limiting and abuse detection are
  upstream concerns (handler-layer middleware).

## Risk

- **Likelihood:** High — every public-chat
  exchange.
- **Impact:** Medium — a defective fallback
  means visitors see "the AI is down" or
  silence; a defective prompt means
  hallucinated answers.
- **Mitigations:** Always-reply contract
  (AC-3) + article-aware prompting (AC-1) +
  log-don't-disclose discipline.

## Implements (cross-cutting)

- **REQ-005 — Fail-closed.** AC-3 — assistant
  failure does not break the conversation.
- **REQ-009 — Observability.** AC-3 — failures
  logged for operator visibility.
- **REQ-013 — Integration adapters isolated.**
  The assistant runtime is consumed via an
  optional-interface contract; the handler
  knows nothing about the underlying provider.
- **REQ-014 — Graceful degradation.** AC-3 —
  static fallback preserves the conversation.

## Compliance mapping

| Control | Coverage |
|---|---|
| SOC2 CC7.2 (System monitoring) | AC-3 — failures observable to operators. |
| ISO27001 A.13.2 (Information transfer) | AC-2 + AC-3 — every public exchange persisted. |

## Satisfied by

- `modules/platformkit-business-modules/chat_management/features/public_chat/assistant.go` — prompt builder and reply orchestration.
- `modules/platformkit-business-modules/chat_management/features/public_chat/service.go` — public-chat orchestration entry.

## Related requirements

- [REQ-CHAT-002 — Public chat umbrella](./REQ-CHAT-002-public-chat.md)
- [REQ-CHAT-010 — Send message](./REQ-CHAT-010-send-message.md) — the persistence path this builds on.
- [REQ-CHAT-011 — Room lifecycle](./REQ-CHAT-011-room-lifecycle.md)
