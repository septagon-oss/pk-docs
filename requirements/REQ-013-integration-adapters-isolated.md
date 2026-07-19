---
id: REQ-013
title: "Third-party integration adapters isolate external API boundaries"
status: Active
date: 2026-05-06
slug: req-013-integration-adapters-isolated
category: governance
ears_pattern: ubiquitous
verification_methods:
  - analysis
  - inspection
compliance: []
satisfied_by:
  adr: [ADR-0009]
  conventions: [C-04]
type: doc
tags: [requirement, governance, integrations]
---

# REQ 013 — Third-party integration adapters isolate external API boundaries

Status: **Active** (2026-05-06)

## Statement

Every third-party API integration (Twilio, Stripe, LiveKit, Tile38,
Novu, LibreTranslate, Meta WhatsApp, Instagram / Facebook / X
publishers, Toconline invoicing, etc.) **shall** live under
`platformkit-integrations/<domain>/<provider>/` and **shall** satisfy a
domain-level provider interface declared at
`platformkit-integrations/<domain>/provider.go`. Business modules
**shall** import and consume the domain interface, never the concrete
provider package.

## Rationale

Vendor risk is real and asymmetric: a single hardcoded Twilio import
across the SMS surface ties every PlatformKit deployment to Twilio's
pricing, region availability, and outage calendar. The integrations
layer exists so that swapping an adapter (Twilio → Vonage, Stripe →
Adyen) is a one-file substitution at composition time, not a refactor
across the business modules that depend on the capability.

The same isolation supports per-tenant provider choice. A tenant in
Brazil may need a regional WhatsApp gateway (`messaging/webhook/`),
while a North-American tenant routes through `messaging/twilio/`; the
business module sees only `messaging.SMSProvider` and the FX graph
binds the right adapter at startup. The directory layout is the
mechanism that makes this physically possible.

Finally, blast-radius containment. When a vendor breaks (auth-token
revoked, schema change, rate-limit retroactively tightened), the
failure surface is exactly one adapter package; the noop fallback
under `chat_management/providers/noop/` and similar paths keep the
platform booting even when an optional integration is unreachable.

## Acceptance criteria

- **AC-1** Every `platformkit-integrations/<domain>/` directory
  declares the domain's contract in `provider.go` (or a
  similarly-named interface file). Concrete adapters do not declare
  the contract themselves; they implement an externally-defined one.
- **AC-2** Concrete provider code lives at
  `platformkit-integrations/<domain>/<provider>/`. The directory name
  is the provider's slug (e.g. `twilio/`, `stripe/`, `tile38/`).
- **AC-3** No business-module package under `modules/platformkit-business-modules/`
  imports a concrete adapter package; imports go to the domain
  interface package only.
- **AC-4** Optional integrations have a noop fallback (e.g.
  `chat_management/providers/noop/`,
  `notification_management/providers/`,
  `translation_management/providers/noop/`) so a deployment without
  the integration still boots.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Inspection | Directory walk: every `platformkit-integrations/<domain>/` has at least one `provider.go` or interface-declaring file. |
| AC-2 | Inspection | Same walk: every leaf directory is a single provider's adapter. |
| AC-3 | Analysis | `core/platformkit-backend-kit/analysis/importboundary` rejects business-module imports of concrete adapter packages. |
| AC-4 | Inspection | Each optional integration lists its `providers/noop/` peer in its module's `dependencies.go` declarations. |

## Satisfied by

- [ADR 0009 — Ports-only cross-module communication](../adr/0009-ports-only-cross-module-communication.md) —
  the broader decision the integrations boundary specialises.
- [Convention C-04 — Public contracts live away from their implementation](../conventions.md#c-04-public-contracts-live-away-from-their-implementation) —
  the discipline that keeps `provider.go` import-safe.

## Related requirements

- [REQ-002 — Modules are independently deployable](./REQ-002-independently-deployable-modules.md) —
  the broader composition property this integration boundary supports.
- [REQ-014 — External calls degrade gracefully under transient failure](./REQ-014-graceful-degradation.md) —
  resilience wrappers sit between the consumer and the adapter.

## References

- `platformkit-integrations/messaging/{provider.go, twilio/, webhook/, meta/}` — canonical example.
- `platformkit-integrations/payments/stripe/` — payments adapter.
- `platformkit-integrations/geo/{provider.go, tile38/, inmemory/}` — geo provider with noop sibling.
