---
id: REQ-NOTIF-001
title: "Email notifications feature dispatches templated emails through a configured provider with tenant-scoped channel gating"
status: Proposed
date: 2026-05-07
slug: req-notif-001-email-notifications
category: notification
ears_pattern: event-driven
verification_methods: [test, inspection]
compliance: []
satisfied_by:
  adr: [ADR-0009]
  conventions: [C-04, C-14]
implements_cross_cutting: [REQ-001, REQ-004, REQ-013]
type: doc
tags: [requirement, feature, notification_management]
module: notification_management
feature: email_notifications
---

# REQ NOTIF-001 — Email notifications

Status: **Proposed** (2026-05-07)

## Statement

**When** a caller submits an email-notification request, the
feature **shall** validate the request, resolve the tenant from
context, consult the per-tenant email channel toggle, render the
template (when one is supplied), and dispatch through the
configured provider. **If** the channel is disabled for the tenant
the call **shall** short-circuit and return a `"skipped"`
response — keeping callers (typically event handlers fanning out
across channels) flowing rather than failing the whole pipeline.

## Rationale

Email is the highest-volume notification channel and the canonical
channel for transactional flows. Centralising the dispatch path
means tenants can disable email globally with one setting toggle;
the catalog event vocabulary
(`notification.email.sent`/`failed`/`delivered`) gives every
downstream subscriber a uniform hook.

## Acceptance criteria

- **AC-1** A successful send persists the notification record with
  the dispatched `message_id` and emits the catalogued event for
  the disposition (`notification.email.sent` /
  `notification.email.failed` / `notification.email.delivered`).
- **AC-2** Validation rejects malformed requests (missing
  recipient, missing content) with typed errors *before* the
  provider is called.
- **AC-3** When the per-tenant email channel is disabled
  (`channelgate.Enabled(... ChannelEmail) == false`), the dispatch
  short-circuits and returns a `"skipped"` response without
  consuming provider quota.
- **AC-4** Per-tenant rate limiting bounds excess send volume; an
  exceeded budget returns a typed error.

## Known gaps

- **Per-recipient opt-out is not consulted at this layer.** The
  REQ-USER-003 preference for email-opt-in is stored on the user
  but is not read inside `Service::SendEmail`. Sending to a
  recipient who has opted out is currently the caller's
  responsibility to prevent.
- **No resilience wrapper.** The provider call (`p.notifier.Send`)
  is direct; there is no circuit-breaker, retry budget, or
  per-call timeout enforced at this layer beyond the underlying
  HTTP client default. Failure surfaces as the typed error from
  the provider.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `pk-modules/notification_management/features/email_notifications/service_test.go::TestIsValidEmail` covers the happy-path send + persistence + event emission. |
| AC-2 | Test | `pk-modules/notification_management/features/email_notifications/service_test.go::TestIsValidEmail` covers `validateEmailRequest` rejection paths. |
| AC-3 | Inspection | `service.go:172-181` — channelgate check returns the `"skipped"` response shape. |
| AC-4 | Inspection | `service.go:184-186` — `checkRateLimit` is called before persistence. |

## Implements (cross-cutting)

- REQ-001 — multi-tenant isolation (tenant from context drives the
  channel-gate lookup and persistence).
- REQ-004 — audit per mutation (event vocabulary catalogued).
- REQ-013 — integration adapters isolated (the provider sits
  behind `email_provider.go`'s `EmailProvider` interface).

## Satisfied by

- `pk-modules/notification_management/features/email_notifications/feature.go`
- `pk-modules/notification_management/features/email_notifications/api.go`,
  `api_test.go`
- `pk-modules/notification_management/features/email_notifications/service.go`,
  `service_test.go`
- `pk-modules/notification_management/features/email_notifications/email_provider.go`,
  `email_provider_test.go`
- `pk-modules/notification_management/features/email_notifications/handler.go`,
  `routes.go`, `permissions.go`
- `pk-modules/notification_management/internal/channelgate/` — channel-toggle helper.

## Related requirements

- [REQ-NOTIF-002 — In-app notifications](./REQ-NOTIF-002-in-app-notifications.md)
- [REQ-NOTIF-003 — Push notifications](./REQ-NOTIF-003-push-notifications.md)
- [REQ-NOTIF-004 — SMS notifications](./REQ-NOTIF-004-sms-notifications.md)
- [REQ-NOTIF-005 — WhatsApp notifications](./REQ-NOTIF-005-whatsapp-notifications.md)
- [REQ-USER-003 — Preferences](./REQ-USER-003-preferences.md) — stores the per-recipient opt-in that is currently not consulted.
