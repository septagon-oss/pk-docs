---
id: REQ-CHAT-014
title: "Slash commands in chat messages dispatch to registered handlers, with bot replies posted through the canonical pipeline and best-effort failure isolation"
status: Proposed
date: 2026-07-02
slug: req-chat-014-command-dispatch
category: chat
ears_pattern: event-driven
priority: should
risk: medium
verification_methods: [test]
compliance: []
satisfied_by:
  adr: [ADR-0033]
  conventions: [C-14]
implements_cross_cutting: [REQ-002, REQ-014]
refines: REQ-CHAT-001
depends_on: [REQ-CHAT-010]
type: doc
tags: [requirement, capability, chat, commands, dispatch]
module: chat
feature: commands
capability: command_dispatch
capability_kind: inter_module_contract
stakeholders:
  - end-user (types /help, /ask, ... in a chat room)
  - external modules (agent-runtime registers command handlers at fx startup)
  - operator (debugs missing or duplicate command replies)
---

# REQ CHAT-014 — Chat command dispatch

Status: **Proposed** (2026-07-02)

## Statement

**When** `MessageService.SendMessage` persists a message whose
content begins with `/` and a `provides.ChatCommandRegistry` is
wired in, the chat commands extension point **shall**:

1. Parse the content into a command name (leading `/token`) and
   an argument tail via `commands.ParseCommand`;
2. Look up the handler in the registry and execute it with a
   `ChatCommandRequest` carrying name, args, raw content, room,
   sender, and source message id, under a 5-second default
   timeout; handlers implementing `ChatCommandWithTimeout` with a
   positive duration override the default, while a zero or
   negative override falls back to it;
3. **If** the handler returns a non-empty `ReplyContent`, post it
   back as a bot reply through the same persistence pipeline as a
   user message — `SenderID` `chat_command`, `SenderType` bot,
   `ReplyToID` set to the source message — so replies inherit the
   canonical wire format and delivery guarantees;
4. **If** the command is unknown, post an "Unknown command: …
   Try /help." hint reply;
5. **If** no registry is wired, the content is not a command, or
   the handler returns nil / errors / times out, dispatch **shall
   not** alter the SendMessage outcome — the user's message is
   already persisted, and dispatch failures are logged, never
   propagated.

The registry **shall** accept only names that are non-empty,
begin with `/`, and contain no whitespace; **shall** reject
duplicate registrations (`Unregister` first for deliberate
swaps); and **shall** provide a name-sorted `List` snapshot. The
built-in `/help` command **shall** be registered at startup so
every composition with the commands feature has a usable
baseline.

## Rationale

Slash commands are chat's extension point (ADR-0033:
chat as a pluggable transport with domain on top): external
modules — most importantly the agent runtime — register
handlers at fx startup without chat importing them,
which is why `capability_kind: inter_module_contract`. The
registry's validation and duplicate rejection are the contract
that keeps the dispatch parser unambiguous across independently
authored handlers.

Best-effort isolation is the load-bearing failure discipline: the
user's typed message is persisted *before* dispatch, so a broken
or slow handler can degrade the enhancement (no reply) but never
the primitive (the message). The timeout exists because handlers
run synchronously inside the send path; long-running work (LLM
calls) must fire-and-forget and stream via the chat transport
instead.

## Acceptance criteria

- **AC-1 — Dispatch happy path.** A `/echo hello world` message
  invokes the registered handler exactly once with name `/echo`,
  args `hello world`, and the sender's identity; the handler's
  reply persists as a second message with `SenderID`
  `chat_command`, bot sender type, and `ReplyToID` pointing at
  the source message.
- **AC-2 — Unknown command hint.** An unregistered `/nope`
  produces a persisted hint reply containing "Unknown command".
- **AC-3 — No registry, no dispatch.** With a nil registry, a
  `/`-prefixed message persists as ordinary content — one row,
  no handler invocation.
- **AC-4 — Plain messages bypass dispatch.** Content not starting
  with `/` never reaches a handler.
- **AC-5 — Per-command timeout override.** A handler advertising
  a 30s timeout receives a context deadline well past the 5s
  default; a zero override falls back to the 5s default.
- **AC-6 — Silent handlers produce no reply.** A handler
  returning nil (streams its own output) results in exactly one
  persisted row — the user's message.
- **AC-7 — Registry contract.** Registration rejects invalid
  names and duplicates; lookup finds registered handlers;
  `List` is a sorted snapshot; `ParseCommand` splits name/args by
  the documented rules; the built-in `/help` lists registered
  commands.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `pk-modules/chat/features/messaging/command_dispatch_test.go::TestSendMessage_DispatchesSlashCommand`. |
| AC-2 | Test | `pk-modules/chat/features/messaging/command_dispatch_test.go::TestSendMessage_UnknownCommandPostsHint`. |
| AC-3 | Test | `pk-modules/chat/features/messaging/command_dispatch_test.go::TestSendMessage_NoRegistryNoDispatch`. |
| AC-4 | Test | `pk-modules/chat/features/messaging/command_dispatch_test.go::TestSendMessage_PlainMessageNotDispatched`. |
| AC-5 | Test | `pk-modules/chat/features/messaging/command_dispatch_test.go::TestSendMessage_PerCommandTimeoutOverride` and `TestSendMessage_ZeroTimeoutFallsBackToDefault`. |
| AC-6 | Test | `pk-modules/chat/features/messaging/command_dispatch_test.go::TestSendMessage_HandlerNilResultNoReply`. |
| AC-7 | Test | `pk-modules/chat/features/commands/registry_test.go::TestRegistryRegisterAndLookup`, `TestRegistryRejectsInvalidNames`, `TestRegistryRejectsDuplicate`, `TestRegistryUnregister`, `TestRegistryListSorted`, `TestParseCommand`, `TestHelpCommand`. |

## Edge cases & unhappy paths

- **Handler error or timeout.** Logged with command name and
  message id; no reply posted; the caller's SendMessage already
  returned success.
- **Reply persistence failure.** Logged; the user's message
  stands, the reply is dropped (best-effort layer).
- **`Ephemeral` results.** Intentionally not honoured yet —
  suppressing the canonical write would need a transport-only
  publish path not all providers support; documented in
  `postCommandReply`.
- **Commands from bots.** Bot-authored replies use sender
  `chat_command`, so a handler reply that itself looks like a
  command would re-enter dispatch; handlers should not emit
  `/`-prefixed replies.

## Risk

- **Likelihood:** Medium — every chat send parses for the prefix;
  dispatch fires only on command messages.
- **Impact:** Medium — a defective dispatcher drops replies or,
  worse, blocks the send path; isolation (AC-3–AC-6) caps the
  blast radius at the enhancement layer.
- **Mitigations:** Persist-before-dispatch, timeout (AC-5),
  best-effort error handling, registry validation (AC-7).

## Implements (cross-cutting)

- **REQ-002 — Independently deployable modules.** AC-7 — external
  modules extend chat via the registry contract, not imports.
- **REQ-014 — Graceful degradation.** AC-3 + AC-6 — missing
  registry and silent/failing handlers degrade to plain
  messaging.

## Satisfied by

- `pk-modules/chat/features/commands/registry.go::Registry, ParseCommand` —
  the extension-point contract and parsing rules.
- `pk-modules/chat/features/commands/feature.go::NewCommandsFeature, registerBuiltinCommands` —
  fx wiring of the singleton registry and the `/help` baseline.
- `pk-modules/chat/features/messaging/message_service.go::dispatchCommandIfMatching, postCommandReply` —
  the dispatch path inside SendMessage.

## Related requirements

- [REQ-CHAT-001 — Messaging umbrella](./REQ-CHAT-001-messaging.md)
- [REQ-CHAT-010 — Send message](./REQ-CHAT-010-send-message.md) —
  the persistence primitive dispatch rides on.
- [REQ-CHAT-016 — Durable chat events](./REQ-CHAT-016-durable-chat-events.md) —
  bot replies inherit the same outbox-backed delivery.
