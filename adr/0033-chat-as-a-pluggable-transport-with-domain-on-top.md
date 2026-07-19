---
title: "ADR 0033: Chat is a pluggable real-time transport with the domain layered on top"
status: Accepted
date: 2026-05-11
slug: adr-0033-chat-as-a-pluggable-transport-with-domain-on-top
adr_topic: communication
type: doc
tags: [adr, chat, real-time, integrations, providers]
---

# ADR 0033 — Chat is a pluggable real-time transport with the domain layered on top

Status: **Accepted** (2026-05-11)

## The problem

Three different consumers wanted real-time chat at roughly the same
time. `operator_management` already had an LLM-driven chat surface
for admin operators. `chat_management` had a rooms + messages domain
that fan-out events via the internal `event.EventBus` but couldn't
deliver them to connected browsers in real time. A customer-support
widget on the public marketing site needed anonymous visitors to talk
to merchant support agents over a live channel. The runtime-agent
needed to subscribe to mentions, post bot replies, and stream LLM
output token-by-token into rooms.

The naive answer would have been "let chat_management own everything":
the domain, the WebSocket transport, the presence tracking, the
token-mint, the history replay. We tried sketching it. It collapsed
under three forces. First, the domain entities (rooms, messages,
participants, reactions) are real CRUD records — they belong in
chat_management's Postgres tables and feature graph, no question.
Second, the transport (WebSocket connections, channel namespaces,
presence sets, history rings) is infrastructure — it belongs next to
`communication/realtime` (the LiveKit-backed Service), implemented by
providers under `platformkit-integrations/<vendor>/`. Third, the
multi-tenant invariants we have everywhere else — tenant-scoped
channels, audited cross-module access, port-only consumption — apply
to chat too and shouldn't be redesigned per integration.

We watched the proposal drift toward Matrix/Synapse (heavy ops surface,
federation we don't want, E2E encryption that blocks server-side AI),
Mattermost/Rocket.Chat (full product stack, would relegate PlatformKit
to a second-class app inside their world), and the "just use NATS WS"
fallback (great backend pub/sub, terrible browser story, presence and
channel ACL and cursor-based history all reinvented). We needed an
architecture that owned the domain ourselves but rented the WebSocket
hard problems from a provider we could swap.

## The decision

Chat is split into two layers that talk through a single transport-
agnostic port: a domain layer in `chat_management` that owns rooms,
messages, participants, reactions, and the canonical message log; and
a transport layer in `platformkit-backend-kit/communication/chat`
defining a provider contract that `platformkit-integrations/chat/*`
implements. The contract sits next to `realtime` (LiveKit), sharing neutral
identity and transport primitives without inventing a dormant third seam.

```text
┌────────────────────────────────────────────────────────────────────┐
│  Domain — chat_management/                                          │
│   Rooms, Messages, Participants, Reactions, Commands               │
│   Postgres canonical store (chat_messages table)                   │
│   ChatRoomService / ChatMessageService / ChatParticipantService    │
└──────────────────────┬─────────────────────────────────────────────┘
                       │ depends on
┌──────────────────────▼─────────────────────────────────────────────┐
│  Transport contract — backend-kit/communication/chat/              │
│   Service = Publisher + Subscriber + ClientGateway                 │
│   Optional: Presence, History, Capable                             │
│   Channel = {TenantID, Kind, RoomID} — tenant-partitioned          │
│   Event = {ID, Type, ActorKind, ReplyToID, SupersedesID, Payload}  │
│   TokenRequest — authenticated XOR anonymous-guest                 │
└──────────────────────┬─────────────────────────────────────────────┘
                       │ implemented by
┌──────────────────────▼─────────────────────────────────────────────┐
│  Providers — platformkit-integrations/chat/<vendor>/                │
│   memory     (in-process — tests + dev + showroom)                  │
│   centrifugo (HTTP API + JWT — production)                          │
│   nats       (planned — JetStream)                                  │
│   websocket  (planned — single-node direct WS)                      │
│   noop       (in-tree backend-kit/communication/chat/providers/)    │
└────────────────────────────────────────────────────────────────────┘
```

The transport contract is minimal and intentionally so. `Publisher`
is a single method; `Subscriber` returns a typed `Stream`; `Presence`
and `History` are separate interfaces a provider may or may not
satisfy (consumers degrade gracefully via the `Capable` interface).
Anonymous-visitor support is first-class: `TokenRequest.Anonymous`
plus `GuestSessionID` gives the support widget its visitor identity
without forcing user_management to invent a "guest user" type.
`Event.ActorKind` distinguishes user / guest / bot / system on the
wire so renderers and audit pivot on it without out-of-band lookups.
`Event.SupersedesID` carries the streaming-bot-reply pattern (initial
publish establishes the message ID; successive events update in
place). `Event.ReplyToID` carries thread anchoring.

The domain layer talks to the transport through the narrowest
sub-interface that does the job. `chat_management.MessageService`
holds an optional `chat.Publisher` (write-only is all it needs).
`platformkit-agent-runtime` registers tools that hold `chat.Publisher`
+ `chat.History`. `notification_management` (future Stage) will
hold `chat.Subscriber` for offline-push fan-out. Nobody depends on
the composite `chat.Service` unless they genuinely need every
primitive.

The canonical store stays the source of truth. Every `SendMessage`
call writes to Postgres FIRST, then fans out to the internal
`event.EventBus` (existing event subscribers), then publishes through the
transport. Transport publish failures are logged and swallowed — a
transient WebSocket hiccup must not block a persisted message.
Connected clients reconcile on the next history replay; disconnected
clients catch up from the canonical store when they reconnect.

## What we gave up

- **An extra ops surface in production.** Centrifugo is a single
  Go binary and rides our existing NATS broker for horizontal fan-out,
  but it's still one more process to deploy, monitor, secure, and
  upgrade. Compositions that run the monolith on one VM avoid this
  cost by selecting the `websocket` (single-node) or `memory`
  (tests + showroom) provider; production deployments pay it.

- **Federation.** Matrix gives free cross-org interop; we don't.
  PlatformKit's multi-tenant story explicitly partitions channels by
  tenant, and the cross-tenant bridge that federation implies would
  break the isolation invariant. Customers who later need
  federation will run Matrix alongside, not instead of, the chat
  module — at which point chat_management becomes one of two
  systems-of-record and the audit story gets harder. We accept that.

- **End-to-end encryption.** The `Event.Payload` is plaintext JSON
  by the time it reaches the transport, which means the server can
  read every message. That's the right tradeoff for SaaS chat where
  the server-side AI features (slash commands, summary, search,
  moderation) require plaintext access. Customers in
  healthcare/legal/financial verticals who need E2EE will either
  fork the chat module to add Signal-protocol envelopes or run
  Matrix. Retrofitting E2EE later is hard — we'd have to choose
  between encrypting the canonical store too (kills server-side AI)
  or encrypting only the transport (visitors get false safety).
  Surfacing this tradeoff up front is honest; pretending we could
  add it later would not be.

- **Server-side Subscribe latency on Centrifugo.** The Centrifugo
  provider's server-side Subscribe is a 1-second long-poll against
  `/api/history`. Fine for bots, slash-command dispatch, and the
  runtime-agent's mention watcher; not fine if we ever want the
  backend itself to act on sub-second message-arrival signals.
  Frontends bypass this entirely — they connect directly to
  Centrifugo's WebSocket via the JWT we sign, so end users see
  proper real-time latency. If a future backend use case needs
  sub-second server-side notification, we'll add a streaming
  variant of Subscribe and the Centrifugo provider gets a real
  long-running HTTP stream rather than a poll.

- **HMAC-only token signing.** The Centrifugo provider supports HS256
  / HS384 / HS512 but not RS256 or ES256. Asymmetric signing would
  pull in a JWT library; we kept the provider dependency-free. The
  practical limit is enterprise deployments that mandate asymmetric
  algorithms — those tenants run Centrifugo's own JWT-builder
  service in front of us or fork the provider.

- **Three writes per message.** `SendMessage` now writes to Postgres
  + event bus + transport. Each is sub-millisecond locally, but the
  worst-case sum (with a slow event subscriber or a Centrifugo HTTP
  round-trip on a saturated network) can push p99 latency into the
  hundreds of milliseconds. The transport publish is best-effort,
  but the event-bus publish is part of the synchronous path because
  existing event subscribers (notification fan-out, search indexer) depend
  on it. We may eventually move the event-bus publish behind an
  outbox; doing so now would have widened the scope.

- **The convenience of "just call chat_management".** Producer
  modules that publish chat events (notification_management for
  "you were mentioned"; audit_management for "this audit decision
  needs visibility in chat") now take a `chat.Publisher` dep rather
  than importing `chat_management`. That's the right
  ports-first posture but it costs an extra `optional:"true"` fx
  parameter on every producer. We accept it because the alternative
  — every chat consumer transitively importing chat_management's
  entities + GORM tags — is what ADR 0009 explicitly forbids.

- **Frontend coupling to the streaming-update convention.** The
  `SupersedesID` pattern asks the frontend to render successive
  events with the same SupersedesID as one growing message. A naïve
  renderer that appends every event sees the bot's "thinking..."
  reply repeated N times. We bet that the existing chat_message
  molecule + the new chat_widget will both implement the dedup,
  but the contract can't enforce it.

## What we kept

- **Multi-tenant isolation as a type-level guarantee.** Every
  `Channel` carries `TenantID` by construction; the JWT token's
  channel allow-list encodes the same tenant; the transport
  enforces both at connect time. A `Channel{Kind: Messages, RoomID:
  "x"}` without a `TenantID` is structurally invalid — there is
  literally no way to address a cross-tenant channel through the
  contract. Compare to a "channels are strings" design where
  `tenant-A:room-X` and `tenant-B:room-X` differ only by convention
  and a typo crosses tenants silently.

- **Provider swap as a one-line config change.** Switching from
  noop (dev default) to memory (test default) to centrifugo
  (production) is `cfg.Services.Chat.Provider = "centrifugo"`. The
  domain code, the fx wiring, the consumer modules, every test —
  none of them know which provider is mounted. When NATS lands as
  the fourth provider, the same one-line config picks it without
  any code change. This is the same affordance the platform already
  has for cache, database, eventbus, logger, metrics — chat slots
  into the established slot.

- **Anonymous guests as first-class principals.** A merchant's
  marketing-site visitor opens the chat widget without a platform
  account. The widget generates a session UUID client-side; the
  backend calls `chat.IssueToken({Anonymous: true,
  GuestSessionID: <uuid>, TenantID: <merchant>, Channels: [room]})`
  and gets back a JWT scoped to exactly one room. The transport
  enforces the channel allow-list; the canonical store stamps
  `ActorKind=guest` on every message. No fake user-account shortcut,
  no leaking user_management primitives into the support flow, no
  cross-visitor room mixing. Visitor identity is contract-level.

- **One streaming-update primitive for LLM token streaming AND
  human message edits.** `Event.SupersedesID` covers both. The
  runtime-agent publishes an initial event with body="thinking..."
  then successive updates with `SupersedesID=initial.ID` as tokens
  arrive — the user sees one message that grows. The same
  primitive carries a message edit: chat_management emits the
  edited content as a new event whose `SupersedesID` points at the
  original posted event, and clients update in place rather than
  show "(edited)" as a new line. One concept, two use cases, one
  renderer implementation.

- **Canonical store + transport-as-cache.** The chat_messages table
  is the source of truth. Transport publish is best-effort. A
  Centrifugo restart, a NATS network hiccup, a provider migration —
  none of them lose messages. Clients reconnect, the
  `chat.History.Replay` returns the recent ring buffer (or the
  canonical store when the ring's been evicted), and the
  conversation resumes. This is the same posture as the existing
  `event.Outbox` pattern (ADR 0007) and the same posture we use for
  the search indexer.

- **Interface Segregation, all the way down.** Modules that only
  publish hold `chat.Publisher` (one method).
  notification_management's future offline-push subscriber will
  hold `chat.Subscriber`. Only chat_management itself depends on
  the composite `chat.Service`. The runtime-agent's tools hold
  `chat.Publisher` + `chat.History` because they need both. The
  consumers' dependency graphs stay narrow, the test stubs stay
  small, and a new consumer adding chat capability sees exactly
  which sub-interface to depend on.

- **A shared vocabulary across the three priority consumers.**
  `ActorKind` (user / guest / bot / system) is the same enum the
  support widget reads to render bot avatars distinctly, the
  audit_management subscriber reads to filter on guest-originated
  events, and chat_management's domain layer reads to map from
  the stored senderType field. The streaming-update + threading
  conventions are documented in `INTEGRATION.md` once, not
  reinvented per consumer.

- **The slash-command extension point.** `ChatCommandRegistry`
  (defined in chat_management's `contracts/provides/` —
  scheduled for Stage 11C) lets any module contribute commands.
  `operator_management` will register `/ask` and `/summarize`;
  audit_management could register `/audit-search`;
  api_key_management could register `/keys` for in-chat
  administration. Each command's handler is governed through the
  runtime-agent's existing executor.Registry, with full audit +
  budget + approval gates. Slash commands aren't a chat-domain
  shortcut — they're a platform-wide extensibility surface that
  happens to be invoked through chat.

- **Fail-soft transport behaviour.** Transport publish errors
  don't block the canonical store. The bet: a noisy transport
  failure mode (loud retry, drop the message, fail the API call)
  is worse than a silent one that the canonical store recovers
  from on reconnect. The cost: a silently-broken transport stays
  broken until someone notices the live-fan-out gap. The
  mitigation: provider-level telemetry (Centrifugo's metrics,
  memory provider's `PublishCount()`, future Prometheus signals)
  is the operator's warning system, not the user-facing error.

## How we enforce it

- **Provider registration via `infrastructure/providers` registry**
  (`backend-kit/communication/chat/providers/factory.go`,
  `infrastructure/providers/registry.go:ServiceTypeChat`). Adding
  a chat provider means a single `init()` that calls
  `providers.MustRegister(ServiceTypeChat, name, ...)`. The factory
  picks one at boot based on `chat.Config.Provider`.

- **Tenant partitioning enforced by `chat.ValidateChannel`**
  (`backend-kit/communication/chat/chat.go`). Every Publish and
  Subscribe call validates the channel; a missing TenantID returns
  `ErrInvalidChannel`. Providers MUST call it; the noop, memory,
  and Centrifugo providers do.

- **Anonymous/authenticated XOR enforced by
  `chat.ValidateTokenRequest`** (same file). UserID OR
  Anonymous+GuestSessionID, never both, never neither. Providers
  call this at the start of `IssueToken`. Eight table-driven tests
  pin the matrix.

- **Streaming + threading convention documented in
  `backend-kit/communication/chat/INTEGRATION.md`.** The two
  priority integration patterns (frontend support widget +
  runtime-agent) are walked end-to-end with code snippets. No
  enforcement at the contract layer; renderer dedup-by-ID +
  SupersedesID-collapse is convention.

- **Standard event schemas in
  `backend-kit/communication/chat/events.go`.** Type constants
  + matching struct schemas keep producer/consumer drift in check.
  Adding a new event type is one constant + one struct, no
  coordination required.

- **Provider compatibility matrix in `INTEGRATION.md`.** Each
  provider's support for each optional capability (presence,
  history, typing, offsets) is documented. Consumers that need a
  capability the deployed provider doesn't support degrade
  gracefully via the `Capable` interface; consumers that demand
  one fail at boot with `ErrPresenceUnsupported` /
  `ErrHistoryUnsupported`.

- **Canonical-store-first rule** in `chat_management.MessageService.SendMessage`
  (`chat_management/features/messaging/message_service.go`). The
  Postgres write is the success contract; event bus + transport
  failures are logged and swallowed. Tested by
  `TestSendMessage_PublisherErrorDoesNotFailCall`.

- **senderType → ActorKind mapping seam**
  (`chat_management/features/messaging/message_service.go:senderTypeToActorKind`).
  Single function with table-driven coverage. A future contributor
  who adds a new senderType (e.g., "scheduled-bot") MUST extend
  the function or fall through to the safe `ActorKindUser` default.

- **Gap — no automatic backpressure between canonical store and
  transport.** If Centrifugo saturates, the chat_messages table
  keeps growing while published events queue up. Today: human
  operator-level (Grafana dashboard + alert when publish lag > N).
  Future: an outbox-style worker on chat_messages that
  back-pressures the canonical-store writes when transport queue
  depth exceeds a threshold. Tracked under REQ-CHAT-040.

- **Gap — `ChatCommandRegistry` (slash commands) isn't implemented
  yet.** The runtime-agent can still react to mentions via
  `FetchHistoryTool` + a subscriber loop; first-class slash-command
  dispatch lands in Stage 11C.

- **Gap — Provider compliance test suite.** Every chat.Service
  implementation should pass the same behaviour suite (publish/
  subscribe ordering, presence semantics, history replay, slow-
  consumer drop). Today: each provider has its own test file. A
  shared `chat/providertest` suite would catch divergence early.
  Tracked under REQ-CHAT-041.

- **Gap — `nats` and `websocket` providers don't exist yet.** The
  noop + memory + centrifugo trio covers the immediate cases.
  Single-node deployments wanting WS without Centrifugo, or
  clusters that want to avoid an extra binary by riding NATS only,
  get those providers in follow-up work.

- **Gap — typing-indicator producer.** `ChannelKindTyping` +
  `ChatTypingEvent` are defined; no domain service emits typing
  events yet. The frontend renders nothing on the typing channel
  until a producer ships. Tracked under REQ-CHAT-042.

- **Gap — reaction producer.** `ChatReactionAddedEvent` /
  `ChatReactionRemovedEvent` schemas exist; no `ReactionService`
  is wired in chat_management yet. Tracked under REQ-CHAT-043.

- **Gap — `RoomService.AddParticipant` is a noop stub.** Pre-existed
  before chat integration; `chat.participant.joined` / `left`
  events never fire because the underlying domain operation is
  unimplemented. Tracked under the existing REQ-CHAT-001 acceptance
  criteria.

- **Gap — no `RefreshToken` method on `ClientGateway`.** Clients
  whose tokens expire have to re-call `IssueToken` against the
  backend. Adequate for short-lived guest sessions; weaker for
  long-running authenticated connections that would benefit from
  cookie-style refresh. Tracked under REQ-CHAT-044.

- **Gap — frontend client SDK pattern is documented in prose, not
  code.** `INTEGRATION.md` walks through the connection sequence
  for the support widget and the agent dashboard but no JS / Go
  client library exists. Tracked under REQ-CHAT-045.

- **Gap — no end-to-end integration test.** Each layer has unit
  tests (38+ across the four repos); no test boots Centrifugo +
  publishes through chat_management.MessageService + asserts a
  subscriber receives the event. Tracked under REQ-CHAT-046.

- **Gap — operator_management still uses A2UI, not chat.** The
  existing operator chat surface streams typed SurfaceUpdate via
  A2UI rather than chat. Migration would unify the operator
  surface with the support-widget / runtime-agent stack but is a
  separate refactor — tracked under REQ-CHAT-047.

## Stage 11 audit findings (post-shipment review, 2026-05-11)

The first audit pass after Stages 8–11 shipped surfaced two
critical gaps that would have made the integration story incomplete
in production. Both were closed before this ADR moved to Accepted.

- **`public_chat.SendPublicMessage` didn't publish to the chat
  transport.** The support-widget pattern documented in
  `INTEGRATION.md` called for visitor + bot messages to fan out
  through `chat.Publisher`, but only `MessageService.SendMessage`
  (the authenticated path) was wired in Stage 11A. The public chat
  path went straight from canonical store to HTTP response with no
  real-time fan-out. Fixed in commit `a0b9674cf` on
  `pk-modules`: `public_chat.Service` grew
  `SetPublisher` + a `publishToTransport` helper symmetric with
  the messaging service. Tenant resolution reads from the room
  record (rooms are tenant-scoped); falls back to `appcontext`.

- **No fx provider constructed `chat.Service` anywhere.** Stage 11A
  added `chat.Publisher` as a fx-optional dependency to
  `MessageService`, but the workspace had no app-composition step
  that built a `chat.Service` from the registered providers and
  wired it into the fx graph. In production the optional dep would
  have resolved to nil and the transport-publish path would be
  dead code. Fixed in commit `0f39a964f` on
  `platformkit-backend-kit`: new `communication/chat/providers/fx.go`
  with `Module(cfg)` + `ModuleFromConfigFn(fn)` packages the
  factory call + sub-interface provider boilerplate into a single
  `fx.Option` apps mount with one line. Three new tests pin the
  resolution + the two failure modes (typo'd provider →
  normalises to noop; configured-but-not-imported → fails loud
  at fx.New so operators see the gap at boot).

The audit also catalogued 8 secondary gaps (REQ-CHAT-040 through
REQ-CHAT-047, listed above) — none of them block the priority
support-widget + runtime-agent integrations but each tracks a
finite piece of follow-up work. The two critical gaps were
load-bearing; the secondary gaps are extensions.

## References

- Motivating stages:
  - Stage 8 (`platformkit-backend-kit` `87b6155d1`) — contract package.
  - Stage 9 (`platformkit-integrations` `3b083e2`) — memory + Centrifugo providers.
  - Stage 10 (`platformkit-backend-kit` `102dba60b`,
    `platformkit-integrations` `c4cc8ff`) — ActorKind / guest tokens /
    streaming + threading fields / INTEGRATION.md.
  - Stage 11A (`platformkit-backend-kit` `86ef2d51d`,
    `pk-modules` `4528a015c`) — event schemas +
    MessageService publish wiring.
  - Stage 11B (`platformkit-agent-runtime` `80af27c`) — chat tools
    (`chat.post_message`, `chat.fetch_history`,
    `chat.summarize_thread`).

- Related ADRs:
  - [ADR 0007 — Transactional outbox for event delivery](./0007-transactional-outbox-for-event-delivery.md) — the
    canonical-store-first pattern we mirror here.
  - [ADR 0009 — Ports-only cross-module communication](./0009-ports-only-cross-module-communication.md) — why
    `chat.Service` lives in `backend-kit/communication/chat/` rather
    than in `chat_management/contracts/provides/`.
  - [ADR 0017 — fx dependency injection as composition](./0017-fx-dependency-injection-as-composition.md) — the
    `optional:"true"` posture the chat consumer takes.
  - [ADR 0018 — Event contracts are declared](./0018-event-contracts-are-declared.md) — the
    `chat_management.chat.message_sent` semantic event remains the
    contract for existing event subscribers; the new transport schemas in
    `events.go` are the wire envelope, not a replacement.

- Related conventions:
  - C-09 — Ports take the smallest sub-interface that satisfies them.
  - C-14 — Every file declares its purpose.

- Provider documentation:
  - [Centrifugo](https://centrifugal.dev) — the production provider.
  - [Matrix protocol](https://matrix.org) — considered and rejected;
    federation cost > benefit for SaaS multi-tenant.

- Integration recipes:
  - `platformkit-backend-kit/communication/chat/INTEGRATION.md` —
    end-to-end patterns for the customer-support widget and the
    runtime-agent bot.
