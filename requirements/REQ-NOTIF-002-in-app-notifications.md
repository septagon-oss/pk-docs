---
id: REQ-NOTIF-002
title: "In-app notifications feature persists tenant-scoped messages and gates dispatch on the channel toggle"
status: Proposed
date: 2026-05-07
slug: req-notif-002-in-app-notifications
category: notification
ears_pattern: event-driven
verification_methods: [test, inspection]
compliance: []
satisfied_by:
  adr: [ADR-0009]
  conventions: [C-04, C-14]
implements_cross_cutting: [REQ-001, REQ-004]
type: doc
tags: [requirement, feature, notification_management]
module: notification_management
feature: in_app_notifications
---

# REQ NOTIF-002 — In-app notifications

Status: **Proposed** (2026-05-07)

## Statement

The in-app notifications feature **shall** persist a per-user
tenant-scoped notification record (level, title, body, timestamp,
read-state) and expose it through the polled REST surface and the
admin notification badge. Dispatch (creating a new notification)
**shall** consult the per-tenant in-app channel toggle via
`channelgate.Enabled(... ChannelInApp)` before persisting; a
disabled channel short-circuits without writing the record.

## Rationale

In-app is the channel users see immediately — banners, badges,
the notification drawer. The channel-gate consistency with the
other notification features means an operator can disable in-app
notifications platform-wide via a single setting toggle. Per-user
record persistence is what makes mark-as-read meaningful per user.

## Acceptance criteria

- **AC-1** Notifications persist with a `(tenant_id, user_id)`
  composite key; reads filter by both.
- **AC-2** Dispatch consults the in-app channel toggle and
  short-circuits when disabled.
- **AC-3** Mutations publish typed events the catalogue declares
  (`notification.sent`, `notification.opened`,
  `notification.clicked`).

## Known gaps

- **Mark-as-read scoping is not service-layer enforced.** The
  service trusts the caller's user-id; non-owner read-state
  mutation prevention happens at the upstream HTTP authorisation
  layer, not inside the service.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `pk-modules/notification_management/features/in_app_notifications/service_test.go::TestNewService` covers tenant + user scoping on writes and reads. |
| AC-2 | Inspection | `service.go:160-163` — channelgate check before persistence. |
| AC-3 | Test | `pk-modules/notification_management/features/in_app_notifications/service_test.go::TestNewService` + `api_test.go` cover event emission paths. |

## Implements (cross-cutting)

- REQ-001 — multi-tenant isolation (composite key).
- REQ-004 — audit per mutation (catalogued events).

## Satisfied by

- `pk-modules/notification_management/features/in_app_notifications/feature.go`
- `pk-modules/notification_management/features/in_app_notifications/api.go`,
  `api_test.go`
- `pk-modules/notification_management/features/in_app_notifications/service.go`,
  `service_test.go`
- `pk-modules/notification_management/features/in_app_notifications/handler.go`

## Related requirements

- [REQ-NOTIF-001 — Email notifications](./REQ-NOTIF-001-email-notifications.md)
