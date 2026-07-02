---
id: REQ-NOTIF-012
title: "In-app read-state transitions verify recipient ownership and idempotently flip ReadAt"
status: Proposed
date: 2026-05-08
slug: req-notif-012-in-app-read-state
category: notification
ears_pattern: event-driven
priority: must
risk: medium
verification_methods: [test]
compliance:
  - SOC2_CC6.1
  - ISO27001_A.9.4
satisfied_by:
  adr: [ADR-0009]
  conventions: [C-04, C-14]
implements_cross_cutting: [REQ-001, REQ-005, REQ-009]
refines: REQ-NOTIF-001
type: doc
tags: [requirement, capability, notification_management, in_app, read_state]
module: notification_management
feature: in_app_notifications
capability: in_app_read_state
capability_kind: state_machine
stakeholders:
  - end-user (clears the badge)
  - admin UI (mark-all-as-read action)
---

# REQ NOTIF-012 — In-app read-state transitions

Status: **Proposed** (2026-05-08)

## Statement

The in-app notifications feature **shall** expose two
read-state transitions:

1. **`MarkAsRead(notificationID, userID)`** — fetch the
   notification by id, verify
   `notification.RecipientID == userID`, and flip
   `ReadAt = now` only if the notification is currently
   unread (`ReadAt == nil`). Increment
   `notification.read` on a state change. Return the
   typed `unauthorized` error when the recipient check
   fails; return `notification not found` when the id
   does not resolve.
2. **`MarkAllAsRead(userID)`** — page through every
   in-app notification with
   `RecipientID == userID && Type == "in_app" &&
   ReadAt == nil`, set `ReadAt = now` on each, and
   continue past per-row failures (logged at Error).
   Increment `notification.read` once per call.

Both operations **shall** be idempotent — a second call
on an already-read notification is a clean no-op.

## Rationale

In-app notifications are user-private state — a defective
read-state transition either lets user A read user B's
notifications (privacy leak) or leaves the unread badge
ringing despite the user having "marked all read"
(UX regression). Three properties:

1. **Recipient-ownership check is the privacy gate.**
   Fetching by id alone is not enough — the URL
   parameter is operator-supplied; without the
   `RecipientID == userID` check, a user could mark any
   notification as read. The check is the explicit
   authorisation boundary.
2. **Idempotent state transition.** A second
   `MarkAsRead` on an already-read notification must
   not re-emit the metric (operator dashboards count
   distinct reads, not click events). The
   `if notification.ReadAt == nil` guard is the
   discipline.
3. **`MarkAllAsRead` continues past failures.** A
   single bad row should not abort the entire
   batch. The per-row Error log + continuation gives
   the operator a partial-progress signal while not
   stopping the user's "I just want my badge cleared"
   intent.

## Acceptance criteria

- **AC-1 — Mark as read happy path.** A
  `MarkAsRead(unread_id, owner_user)` flips `ReadAt`
  to a non-nil timestamp, persists the row, and
  increments `notification.read`.
- **AC-2 — Recipient mismatch refused.** A
  `MarkAsRead(notif_owned_by_userA, userB)` returns
  the typed `unauthorized: notification belongs to
  different user` error and does **not** mutate the
  row or increment the metric.
- **AC-3 — Already-read is a no-op.** A second
  `MarkAsRead` on the same notification leaves the
  existing `ReadAt` timestamp unchanged and does
  **not** re-increment the metric.
- **AC-4 — Not-found returns wrapped error.** A
  `MarkAsRead(missing_id, user)` returns a wrapped
  `notification not found` error.
- **AC-5 — Mark all paginates + flips unread only.**
  `MarkAllAsRead(user)` paginates the query in
  `pageSize=100` chunks, filters to
  `Type = "in_app"` and `ReadAt = nil`, sets
  `ReadAt = now` on each, and stops when no more
  rows match.
- **AC-6 — Mark all continues past errors.** A
  per-row update failure logs Error with the
  notification id and continues with the next row;
  the metric increments once for the call.
- **AC-7 — Span coverage.** Both methods open a
  `in_app_notifications.Service.MarkAs(All)Read`
  span via the injected tracer.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `modules/platformkit-business-modules/notification_management/features/in_app_notifications/service_test.go::TestMarkAsRead_Success` and `TestMarkAsRead_UpdateFails`. |
| AC-2 | Test | `modules/platformkit-business-modules/notification_management/features/in_app_notifications/service_test.go::TestMarkAsRead_WrongUser`. |
| AC-3 | Test | `modules/platformkit-business-modules/notification_management/features/in_app_notifications/service_test.go::TestMarkAsRead_AlreadyRead`. |
| AC-4 | Test | `modules/platformkit-business-modules/notification_management/features/in_app_notifications/service_test.go::TestMarkAsRead_NotFound`. |
| AC-5 | Test | `modules/platformkit-business-modules/notification_management/features/in_app_notifications/service_test.go::TestMarkAllAsRead_Success` and `TestMarkAllAsRead_NoUnread`. The pagination + filter shape is by inspection of `service.go::MarkAllAsRead` lines 386–416. |
| AC-6 | Test | `modules/platformkit-business-modules/notification_management/features/in_app_notifications/service_test.go::TestMarkAllAsRead_PartialUpdateFailure` and `TestMarkAllAsRead_ListError`. |
| AC-7 | Inspection | `service.go::MarkAsRead, MarkAllAsRead` — first statement is the tracer call. |

## Edge cases & unhappy paths

- **Concurrent mark-as-read on the same id.** Last-
  write-wins; both callers see success; the metric
  increments twice. Acceptable — the dashboard counts
  distinct reads via row state, not metric.
- **User with thousands of unread.** `MarkAllAsRead`
  paginates at 100 per page; the operation is bounded
  by the unread count and may take seconds. Future
  work: bulk SQL UPDATE for performance.
- **Notification deleted mid-mark.** The single fetch
  + update window is short; a delete during the call
  produces a wrapped persist error that surfaces
  through the per-row log and is skipped.
- **Mark-as-read on a non-in-app notification.** The
  single-id endpoint does not type-filter — any
  notification owned by the user can be marked. The
  bulk endpoint filters to `Type = "in_app"`
  explicitly because the bulk action is in-app
  semantically (other channels do not have a "read"
  state).
- **Cross-tenant notification.** The recipient check
  (AC-2) is the gate; a notification cannot belong to
  a user outside the tenant in practice, because the
  send path binds the tenant at create time.

## Risk

- **Likelihood:** High — every active user marks
  notifications read.
- **Impact:** Medium — defective transitions degrade
  UX (badge stuck) or violate privacy (cross-user
  read).
- **Mitigations:** Recipient-ownership gate (AC-2) +
  idempotent state transition (AC-3) + per-row
  tolerance in bulk (AC-6).

## Implements (cross-cutting)

- **REQ-001 — Multi-tenant isolation.** Indirect via
  recipient ownership.
- **REQ-005 — Fail-closed.** AC-2 — wrong recipient
  refused.
- **REQ-009 — Observability.** AC-7 — span; AC-1 —
  metric.

## Compliance mapping

| Control | Coverage |
|---|---|
| SOC2 CC6.1 (Logical access) | AC-2 — recipient-bound state transitions. |
| ISO27001 A.9.4 (Access control) | AC-2 — only the owner can mark their notifications. |

## Satisfied by

- `modules/platformkit-business-modules/notification_management/features/in_app_notifications/service.go::MarkAsRead, MarkAllAsRead`.

## Related requirements

- [REQ-NOTIF-001 — Notification umbrella](./REQ-NOTIF-001-notification.md)
- [REQ-NOTIF-011 — Send orchestration](./REQ-NOTIF-011-send-orchestration.md) — the producer of the notifications this feature reads.
