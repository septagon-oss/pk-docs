---
id: REQ-NOTIF-003
title: "Push notifications feature dispatches device-targeted pushes through a configured backend with expired-subscription pruning"
status: Proposed
date: 2026-05-07
slug: req-notif-003-push-notifications
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
feature: push_notifications
---

# REQ NOTIF-003 — Push notifications

Status: **Proposed** (2026-05-07)

## Statement

**When** a caller submits a push-notification request, the feature
**shall** consult the per-tenant push channel toggle, list the
recipient's active push subscriptions for the tenant, fan out
through the configured push delivery backend, and prune any
subscription the backend reports as expired. Scheduled push
delivery is not supported at this layer (the documented capability
gap is signalled by a typed error).

## Rationale

Push is the most-time-sensitive channel. The discipline of
"prune expired subscriptions on the dispatch path" keeps the
subscription table from accumulating stale tokens without a
separate cleanup job. The channel-gate consistency keeps the
operator surface uniform with the other notification channels.

## Acceptance criteria

- **AC-1** Dispatch consults the push channel toggle and
  short-circuits when disabled.
- **AC-2** Active subscriptions for the requested user/device set
  are looked up and fanned out through the delivery backend.
- **AC-3** A backend response indicating subscription expiry
  prunes that subscription via
  `maybeDeactivateExpiredSubscription` — the row is deleted, not
  just flagged.
- **AC-4** A scheduled-delivery request (`req.ScheduledAt != nil`)
  is rejected with a typed error pointing at the alternative
  (email_notifications).

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Inspection | `service.go:179-182` — channelgate check returns `"skipped"`. |
| AC-2 | Inspection | `service_test.go` covers the listSubscriptions + fan-out path against the mock delivery backend. _Verification gap: pending — cited evidence is prose / pattern / non-Go and cannot be auto-resolved._ |
| AC-3 | Inspection | `service.go:426-439` — `maybeDeactivateExpiredSubscription` deletes the subscription on `subscriptionExpiryError`. |
| AC-4 | Inspection | `service.go:186-192` — the scheduled-delivery rejection with the typed error pointing at `email_notifications`. |

## Implements (cross-cutting)

- REQ-001 — multi-tenant isolation (subscriptions keyed by tenant + user).
- REQ-004 — audit per mutation.
- REQ-013 — integration adapters isolated (delivery backend behind the `delivery` interface).

## Satisfied by

- `modules/platformkit-business-modules/notification_management/features/push_notifications/feature.go`
- `modules/platformkit-business-modules/notification_management/features/push_notifications/service.go`,
  `service_test.go`
- `modules/platformkit-business-modules/notification_management/features/push_notifications/routes.go`,
  `permissions.go`

## Related requirements

- [REQ-NOTIF-001 — Email notifications](./REQ-NOTIF-001-email-notifications.md)
- [REQ-NOTIF-002 — In-app notifications](./REQ-NOTIF-002-in-app-notifications.md)
