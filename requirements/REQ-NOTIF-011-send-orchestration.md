---
id: REQ-NOTIF-011
title: "Channel send orchestration validates input, gates on the per-tenant toggle, rate-limits, persists, and dispatches"
status: Proposed
date: 2026-05-08
slug: req-notif-011-send-orchestration
category: notification
ears_pattern: event-driven
priority: must
risk: high
verification_methods: [test]
compliance:
  - SOC2_CC6.7
  - SOC2_CC7.2
  - ISO27001_A.13.2
satisfied_by:
  adr: [ADR-0009]
  conventions: [C-04, C-14]
implements_cross_cutting: [REQ-001, REQ-005, REQ-009, REQ-014]
refines: REQ-NOTIF-001
type: doc
tags: [requirement, capability, notification_management, send, email, in_app, sms, push]
module: notification_management
feature: email_notifications,in_app_notifications,sms_notifications,push_notifications,whatsapp_notifications
capability: send_orchestration
capability_kind: state_machine
stakeholders:
  - business module (notification emitter)
  - tenant administrator (sees skipped vs sent counts)
  - operator (incident triage on delivery failures)
---

# REQ NOTIF-011 — Channel send orchestration

Status: **Proposed** (2026-05-08)

## Statement

**When** a caller invokes `SendEmail`, `SendInApp`,
`SendSMS`, `SendPush`, or `SendWhatsApp` with a
populated request, the matching channel service **shall**
execute a uniform pipeline:

1. Open a span named
   `<channel>.Service.Send<Channel>`;
2. Validate the request shape (recipient, body /
   subject / template ids per channel) and return a
   wrapped error on validation failure;
3. Resolve the tenant id (from the request or the
   request context) — refuse with a typed error when
   neither is present;
4. Consult `channelgate.Enabled` for the matching
   `Channel*` constant. **If** disabled, return
   `NotificationResponse{Status: "skipped", ID: nil}`
   so the caller's flow continues;
5. Apply per-tenant rate-limit (if enabled);
6. Process template (when `TemplateID != ""`) or fall
   back to the request's body fields;
7. Persist the base `Notification` record and the
   channel-specific record before invoking the
   transport adapter;
8. Dispatch through the configured transport adapter
   (SMTP / WebPush / SMS provider / WhatsApp Cloud API);
9. Emit the catalogued
   `notification.{channel}.{sent,failed}` event with
   the recipient + tenant + message id.

The "skipped" return path **shall not** be a hard error
— it is the documented signal for "tenant has this
channel disabled" — so business modules emitting
multi-channel notifications continue to the next channel
on a skip.

## Rationale

Five channels with the same fundamental shape (validate
→ gate → rate-limit → render → persist → send → emit
event) demand a uniform pipeline. Three properties:

1. **Skip ≠ fail.** A tenant who disables SMS does not
   want SMS-shaped errors flooding their dashboard;
   they want the platform to silently honour the
   toggle. The "skipped" status is the platform's
   contract for "did not fire, by configuration".
2. **Persist before dispatch.** Persisting the
   `Notification` record before the transport call
   means a transport failure leaves a queryable row
   (with `Status = failed`) that the operator can
   investigate. A "send-then-record" path would lose
   transport-failed rows when the service crashes
   between dispatch and persist.
3. **Per-channel events.** Each channel emits its own
   `notification.{email,sms,push,whatsapp}.{sent,failed}`
   so subscribers can listen to a single channel without
   needing to filter a shared stream. (In-app
   notifications use a unified `notification.sent` /
   `notification.read` pair because they have no
   transport leg.)

The rate-limit step is per-tenant (not per-recipient)
because the rate-limit's purpose is to bound the
*platform's* outbound capacity per tenant — a tenant
spamming 1000 users with one email each is the same load
as spamming one user with 1000.

## Acceptance criteria

- **AC-1 — Validation refuses malformed requests.** A
  `SendEmail` request with empty `To` returns a wrapped
  validation error before any DB or transport work.
- **AC-2 — Tenant resolution required.** A send call
  without tenant id in either the request or context
  returns the typed tenant-resolution error before
  any channel work.
- **AC-3 — Disabled channel returns skipped.** A send
  call against a tenant whose channel toggle is
  `false` returns
  `NotificationResponse{Status: "skipped", ID: uuid.Nil}`
  with a Debug log. The transport adapter is not
  invoked; no notification row is persisted.
- **AC-4 — Rate-limit blocks excessive bursts.** A
  tenant exceeding the per-tenant per-channel rate
  budget returns the wrapped `rate limit exceeded`
  error.
- **AC-5 — Template rendering on `TemplateID != ""`.**
  A send with a non-empty `TemplateID` invokes the
  template engine and uses its output as the body /
  HTML; without a template, the request's body is
  used verbatim.
- **AC-6 — Persist before dispatch.** The base
  `Notification` row is created before the transport
  adapter is called; a transport failure leaves the
  row with `Status = failed`.
- **AC-7 — Sent event on dispatch success.** A
  successful dispatch emits the per-channel
  `notification.{channel}.sent` event; a failed
  dispatch emits `notification.{channel}.failed` with
  the error message.
- **AC-8 — Span coverage.** Every send method opens a
  `<channel>.Service.Send<Channel>` span; per-step
  attributes (tenant id, recipient hash, template id)
  are attached.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `modules/platformkit-business-modules/notification_management/features/email_notifications/service_test.go::TestSendEmail_ValidationErrors`. |
| AC-2 | Test | `modules/platformkit-business-modules/notification_management/features/email_notifications/service_test.go::TestSendEmail_RequiresTenantContext` and `TestSendEmail_UsesTenantFromContextWhenRequestTenantMissing`. |
| AC-3 | Inspection | `service.go::SendEmail` lines 172–181 — when `channelgate.Enabled` returns false, the function returns `NotificationResponse{Status: "skipped"}` with a Debug log. The gate itself is exercised by `modules/platformkit-business-modules/notification_management/internal/channelgate/channelgate_test.go::TestEnabled_*`. Dedicated end-to-end skipped-response test pending. |
| AC-4 | Test | `modules/platformkit-business-modules/notification_management/features/email_notifications/service_test.go::TestSendEmail_RateLimitExceeded`. |
| AC-5 | Test | `modules/platformkit-business-modules/notification_management/features/email_notifications/service_test.go::TestSendEmail_WithTemplate` and `TestSendEmail_TemplateNotFound`. |
| AC-6 | Test | `modules/platformkit-business-modules/notification_management/features/email_notifications/service_test.go::TestSendEmail_NotificationRepoCreateFails` (persist failure before dispatch) and `TestSendEmail_ProviderFailureMarksNotificationFailed` (transport failure leaves the row with `Status=failed`). |
| AC-7 | Test | `modules/platformkit-business-modules/notification_management/features/email_notifications/service_test.go::TestSendEmail_PublishesGenericLifecycleEvents` verifies the channel and generic success events; adjacent failure and transactional-outbox tests cover failed dispatch and publication rollback. |
| AC-8 | Inspection | `service.go::SendEmail`, `service.go::SendInAppNotification`, `service.go::SendSMS`, etc. — each opens with `s.tracer.StartSpan`. |

## Edge cases & unhappy paths

- **Both tenant id in request and context.** The
  request's tenant id wins (callers explicitly
  override via `req.TenantID`); validation enforces
  that the request's tenant is one the caller is
  authorised for.
- **Recipient unknown.** Channels with optional user
  binding (in-app) accept a UUID; channels that need
  a user record (email) resolve via the
  user-boundary reader and refuse on miss.
- **Transport adapter timeout.** Wrapped error
  surfaces; the persisted row carries `Status =
  failed`. Retries are the caller's concern (or a
  future scheduled-retry job).
- **Template engine error.** Wrapped error surfaces;
  the row is *not* persisted (we don't want to record
  a notification we couldn't even render). This is
  asymmetric with the dispatch failure path —
  documented quirk.
- **Rate-limit cache outage.** The rate-limit
  collaborator's failure surface is up to its own
  REQ; here the wrapped error returns and the
  notification is not sent.
- **Bulk send.** `SendBulk` (where present)
  iterates the recipient list applying the per-call
  pipeline; partial failures return a per-recipient
  result map.

## Risk

- **Likelihood:** High — exercised on every business
  event that emits a notification.
- **Impact:** High — defective send orchestration
  either drops legitimate notifications or fires
  forbidden ones.
- **Mitigations:** Channel gate (AC-3) +
  persist-before-dispatch (AC-6) + per-channel events
  (AC-7) + uniform pipeline across five channels.

## Implements (cross-cutting)

- **REQ-001 — Multi-tenant isolation.** AC-2 — every
  send is tenant-scoped.
- **REQ-005 — Fail-closed.** AC-1 + AC-2 + AC-4
  default-deny on missing precondition.
- **REQ-009 — Observability.** AC-7 + AC-8 — events +
  spans.
- **REQ-014 — Graceful degradation.** AC-3 — disabled
  channel degrades to skip-with-Debug, not error.

## Compliance mapping

| Control | Coverage |
|---|---|
| SOC2 CC6.7 (Restrict information access) | AC-3 — outbound channel governed by tenant policy. |
| SOC2 CC7.2 (System monitoring) | AC-6 + AC-7 — every send has a queryable record + event. |
| ISO27001 A.13.2 (Information transfer) | AC-3 + AC-6 — controlled outbound flow with persistence. |

## Satisfied by

- `modules/platformkit-business-modules/notification_management/features/email_notifications/service.go::SendEmail`.
- `modules/platformkit-business-modules/notification_management/features/in_app_notifications/service.go::SendInAppNotification`.
- `modules/platformkit-business-modules/notification_management/features/sms_notifications/service.go::SendSMS`.
- `modules/platformkit-business-modules/notification_management/features/push_notifications/service.go::SendPushNotification`.
- `modules/platformkit-business-modules/notification_management/features/whatsapp_notifications/service.go::SendWhatsAppMessage`.

## Related requirements

- [REQ-NOTIF-001 — Email notifications](./REQ-NOTIF-001-email-notifications.md)
- [REQ-NOTIF-010 — Channel gate](./REQ-NOTIF-010-channel-gate.md) — the consumer of this orchestration's gate step.
- [REQ-NOTIF-012 — In-app read-state](./REQ-NOTIF-012-in-app-read-state.md) — the in-app-only follow-up.
