---
id: REQ-NOTIF-004
title: "SMS notifications feature dispatches templated SMS through a configured provider with cost-aware controls"
status: Proposed
date: 2026-05-07
slug: req-notif-004-sms-notifications
category: availability
ears_pattern: event-driven
verification_methods: [inspection]
compliance: []
satisfied_by:
  adr: [ADR-0005]
  conventions: [C-04, C-14]
implements_cross_cutting: [REQ-004, REQ-013, REQ-014]
type: doc
tags: [requirement, feature, notification_management]
module: notification_management
feature: sms_notifications
---

# REQ NOTIF-004 — SMS notifications

Status: **Proposed** (2026-05-07)

## Statement

**When** a caller submits an SMS-notification request, the
feature **shall** validate the destination number (E.164),
consult the recipient's opt-in preference, render the template,
and dispatch through the configured SMS provider (Twilio, webhook
adapter) behind the resilience wrapper. Send rate **shall** be
capped per tenant and per recipient to bound the cost-impact of a
runaway loop.

## Rationale

SMS is the most-cost-sensitive channel — every send costs money,
and a runaway loop can drain a tenant's quota in minutes. The
per-tenant + per-recipient rate cap is the cost-of-mistake bound;
opt-in enforcement is the regulatory bound (TCPA, GDPR).

## Acceptance criteria

- **AC-1** Destination numbers are validated against `e164Regex`
  before any provider call; invalid numbers fail with a typed
  error before the rate-limit and provider steps.
- **AC-2** Channel gate (`channelgate.Enabled(... ChannelSMS)`)
  short-circuits with a `"skipped"` response when the tenant has
  SMS disabled.
- **AC-3** Per-tenant rate limiting (`s.rateLimiter`, when wired)
  refuses excess sends with a typed error.
- **AC-4** Notification record persists with the resolved provider
  name and the recipient before the provider is invoked, giving a
  failure-trace anchor.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Inspection | `service.go::SendSMS` (early in the body) — `e164Regex.MatchString(req.To)` enforced before channel gate. **No `*_test.go` exists for `sms_notifications/` today.** |
| AC-2 | Inspection | `service.go::channelgate.Enabled(... ChannelSMS)` short-circuits with `"skipped"`. |
| AC-3 | Inspection | `service.go::ratelimit.CheckRateLimit(s.rateLimiter, ctx, ...)` — guarded by `s.rateLimiter != nil` so the limit only applies when the dependency is wired. |
| AC-4 | Inspection | `service.go` — notification record `Create` happens before the provider's send. |

## Implements (cross-cutting)

- REQ-004 — audit per mutation.
- REQ-013 — integration adapters isolated.
- REQ-014 — graceful degradation.

## Satisfied by

- `notification_management/features/sms_notifications/feature.go`
- `notification_management/features/sms_notifications/api.go`
- `notification_management/features/sms_notifications/handler.go`,
  `routes.go`

## Related requirements

- [REQ-NOTIF-005 — WhatsApp notifications](./REQ-NOTIF-005-whatsapp-notifications.md) — companion messaging channel with similar provider pattern.
