---
id: REQ-NOTIF-005
title: "WhatsApp notifications feature dispatches templated WhatsApp messages through a configured provider"
status: Proposed
date: 2026-05-07
slug: req-notif-005-whatsapp-notifications
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
feature: whatsapp_notifications
---

# REQ NOTIF-005 — WhatsApp notifications

Status: **Proposed** (2026-05-07)

## Statement

**When** a caller submits a WhatsApp-notification request, the
feature **shall** validate the destination number, render the
WhatsApp-template payload (templated only — WhatsApp Business API
forbids freeform messages outside the 24-hour window), and
dispatch through the configured provider (Meta direct, Twilio,
webhook adapter) behind the resilience wrapper. Template approval
state **shall** be checked before dispatch.

## Rationale

WhatsApp's Business API has stricter rules than SMS — only
pre-approved templates outside the conversation window — and
provider deviations from those rules result in account-level
sanctions, not per-message failures. The discipline of validating
template approval before dispatch is what keeps a single bug from
costing a tenant their WhatsApp business account.

## Acceptance criteria

- **AC-1** Destination numbers are validated against `e164Regex`
  before any provider call.
- **AC-2** Channel gate (`channelgate.Enabled(... ChannelWhatsApp)`)
  short-circuits with `"skipped"` when the tenant has WhatsApp
  disabled.
- **AC-3** Message-type dispatch (`text` / `template` / `media`)
  rejects unsupported types with a typed error and enforces the
  per-type required-field set (template name for templates, media
  URL for media, body content for text — text body capped at 4096
  characters).
- **AC-4** Per-tenant rate limiting (`s.rateLimiter`, when wired)
  refuses excess sends with a typed error.

## Known gaps

- **Template-approval state is not checked at this layer.** The
  WhatsApp Business API requires templates to be pre-approved
  outside the conversation window; today the service trusts the
  caller's `template_name` without consulting an approval registry.
- **No `*_test.go` exists for `whatsapp_notifications/`** —
  verification is inspection-only.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Inspection | `service.go::SendWhatsApp` — `e164Regex.MatchString(req.To)` enforced before channel gate. |
| AC-2 | Inspection | `service.go::channelgate.Enabled(... ChannelWhatsApp)` short-circuits with `"skipped"`. |
| AC-3 | Inspection | `service.go::SendWhatsApp` switch on `msgType` (text/template/media/default) with per-type validation. |
| AC-4 | Inspection | `service.go::ratelimit.CheckRateLimit(s.rateLimiter, ctx, ...)` guarded by `s.rateLimiter != nil`. |

## Implements (cross-cutting)

- REQ-004 — audit per mutation.
- REQ-013 — integration adapters isolated.
- REQ-014 — graceful degradation.

## Satisfied by

- `notification_management/features/whatsapp_notifications/feature.go`
- `notification_management/features/whatsapp_notifications/api.go`
- `notification_management/features/whatsapp_notifications/handler.go`

## Related requirements

- [REQ-NOTIF-004 — SMS notifications](./REQ-NOTIF-004-sms-notifications.md) — companion messaging channel.
