---
title: "ADR 0073: Runtime A2UI surfaces cross an app-owned signed delivery boundary"
status: Accepted
date: 2026-07-19
slug: adr-0073-runtime-a2ui-surfaces-cross-an-app-owned-signed-delivery-boundary
adr_topic: security
type: doc
tags: [adr, security, mobile, a2ui, signing, ed25519, replay, key-rotation]
---

# ADR 0073 — Runtime A2UI surfaces cross an app-owned signed delivery boundary

Status: **Accepted** (2026-07-19)

## The problem

Runtime A2UI changes executable application behavior: a surface controls what
the user sees, which action they believe they are invoking, and which route or
manifest entry the shell follows next. TLS authenticates a connection, but it
does not make a cached document safe, bind a response to one tenant/native
binary, detect a replay, or prevent an internal module from constructing an
unsigned replacement after the HTTP boundary was reviewed.

The earlier wire contract exposed multiple construction and update paths. A
caller could build an unsigned envelope and sign it later, or return a patch or
raw complete spec from an action. Optional security fields, JavaScript number
rounding of 64-bit revisions, in-memory replay floors, and request-supplied app
identity all left room for a response to be accepted outside the authority the
app intended.

Signing inside shared module code would not solve the ownership problem.
Modules do not own deployment keys, native app allowlists, tenant resolution,
the public API origin, or the installed app-version policy. That authority
belongs to the composed application.

## The decision

Every live A2UI surface crosses one app-owned signing boundary. Shared code
offers one atomic constructor, `BuildSignedRuntimeEnvelope`; there is no public
unsigned constructor and no sign-later API. Modules may return only an
in-process `A2UIActionReplacementIntent`, which is excluded from JSON. The app
validates the complete spec against the negotiated client profile, binds the
request audience and a fresh revision, creates the signed replacement, and
clears the intent before serialization. A patch, raw complete spec, or
pre-populated replacement is not a supported action path.

The Ed25519 root private key remains offline. It signs a bounded keyset artifact
containing the current online envelope key, an optional next key, revocations,
expiry, and a monotonically increasing keyset revision. Native builds pin one
or more root public keys and the expected root identifier. The server exposes
the root-signed keyset at the discovery-declared public bootstrap endpoint; it
never generates a production key or substitutes a fallback when configuration
is absent.

An envelope signature transitively binds the canonical spec hash, schema hash,
screen ID, canonical extensions hash, protocol versions, signing-key ID,
revision, exact audience, validity window, and app-version bounds. The audience
is the exact platform, configured bundle/package ID, active tenant ID,
deployment environment, and response origin. The request identifies a
canonical native app profile separately from the switchable client slug. The
server resolves the bundle/package ID from its native-app configuration and
allows the client slug only when that app profile explicitly permits it; it
never signs a bundle identifier copied from a request header.

Revisions are positive unsigned 64-bit values encoded as decimal JSON strings.
The app uses PostgreSQL full transaction IDs as the cluster-wide revision
authority. The native client verifies root signature, keyset state, revocation,
leaf signature, hashes, versions, time bounds, app bounds, and exact audience
before profile decoding or rendering. It then advances durable keyset and
per-audience/per-screen/per-canonical-route replay floors in native secure storage. Live delivery
has no in-memory or unsigned-snapshot fallback. Missing trust, malformed or
expired material, storage failure, equivocation, rollback, replay, or an
unknown action-response field fails closed.

Unsigned action extensions may carry non-rendering protocol data such as a
session, approval handshake, or local offline-queue receipt. They cannot alter
the rendered spec, manifest, navigation, theme, screen identity, or renderer
contract. Any such change must be carried by the signed replacement envelope.

Root and leaf rotation is an overlap operation. A release pins the new root
before a server depends on it, and a root-signed keyset advertises the next leaf
before activation. Revocation and keyset revision prevent a client from
returning to superseded material. Removing an old root or leaf before the
installed-app cohort can validate the replacement intentionally makes that
cohort fail closed.

## What we gave up

- A live app cannot render when signing configuration, pinned trust, durable
  replay state, or the keyset bootstrap is unavailable.
- Modules cannot directly serialize action replacements, even when they already
  hold a complete spec.
- New action-response fields require an explicit client contract release; they
  are not silently accepted as additive JSON.
- Root rotation requires coordination with native app releases and an overlap
  window.
- PostgreSQL is required by the composed live signing module for the shared
  monotonic revision authority.

## What we kept

- Modules continue to author complete `MobileUISpec` values and remain unaware
  of deployment secrets.
- Discovery and the root-signed keyset remain public bootstrap documents; the
  root pin, not an authenticated session, establishes their signing authority.
- Tenant/client switching remains possible for native app profiles that declare
  an explicit client-slug allowlist.
- Demo mode may use deterministic local fixtures, but those fixtures do not
  weaken or provide fallback behavior for live mode.

## How we enforce it

- [REQ 019](../requirements/REQ-019-live-a2ui-delivery-is-signed-and-replay-resistant.md)
  defines the cross-layer acceptance criteria.
- [Convention C-23](../conventions.md#c-23-live-a2ui-delivery-has-one-app-owned-signed-boundary)
  defines the implementation and rotation checklist.
- `pk-shared/presentation` has retirement ratchets for unsigned
  constructors, sign-later helpers, and patch types, plus Go/TypeScript golden
  delivery-chain fixtures.
- `pk-apps/internal/bootstrap` requires explicit signer configuration,
  a PostgreSQL revision provider, exact native-app/client/origin policy, and an
  app finalizer for action replacement intents.
- `platformkit-mobile` verifies keysets and envelopes before decoding, persists
  atomic replay floors, rejects unknown action-response fields, and does not
  restore live decoded specs from unsigned runtime snapshots.

## References

- [ADR 0025 — Module-owned mobile surfaces](./0025-module-owned-mobile-surfaces.md)
- [ADR 0064 — File-purpose traceability is a blocking workspace invariant](./0064-file-purpose-traceability-is-a-blocking-workspace-invariant.md)
- [REQ 010 — Runtime configuration is environment-bound](../requirements/REQ-010-configuration-environment-bound.md)
- [REQ 012 — Mobile shell composes module and client packs at build time](../requirements/REQ-012-mobile-build-time-composition.md)
- [REQ 018 — Renderable entities fail closed on undeclared permissions](../requirements/REQ-018-permission-coverage-fail-closed.md)
