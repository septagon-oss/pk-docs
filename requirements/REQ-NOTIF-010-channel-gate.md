---
id: REQ-NOTIF-010
title: "Channel gate consults the per-tenant toggle with a registered-default fallback that never silently drifts"
status: Proposed
date: 2026-05-08
slug: req-notif-010-channel-gate
category: notification
ears_pattern: ubiquitous
priority: must
risk: high
verification_methods: [test, inspection]
compliance:
  - SOC2_CC6.7
  - ISO27001_A.13.2
  - GDPR_Art_25
satisfied_by:
  adr: [ADR-0009]
  conventions: [C-04, C-14]
implements_cross_cutting: [REQ-005, REQ-009, REQ-014]
refines: REQ-NOTIF-001
type: doc
tags: [requirement, capability, notification_management, channel_gate, tenant_toggle]
module: notification_management
feature: email_notifications,in_app_notifications,sms_notifications,push_notifications,whatsapp_notifications
capability: channel_gate
capability_kind: failure_mode
stakeholders:
  - tenant administrator (channel-toggle UX consumer)
  - operator (debugs "why isn't the email going out")
  - compliance auditor (consent-control evidence)
---

# REQ NOTIF-010 — Channel gate

Status: **Proposed** (2026-05-08)

## Statement

The notification feature **shall** centralise the
per-tenant "is this channel enabled?" decision in
`channelgate.Enabled(ctx, settings, log, settingKey)` and
**shall** apply it identically across email, in-app, SMS,
push, and WhatsApp services. The gate **shall**:

1. Refuse with `false` when `settingKey` is not one of
   the five registered `Channel*` constants — closed-by-
   default for keys the gate does not own;
2. Return the registered default
   (`channelDefaults[settingKey]`) when the
   `settings` collaborator is `nil`;
3. Read the per-tenant override via
   `settings.GetSettingValue(ctx, ModuleID, settingKey)`;
4. **If** the underlying read errors transiently (DB
   blip, NATS hop failure) — log Warn and return the
   registered default;
5. **If** the stored value is `nil` (no override) —
   return the registered default;
6. **If** the stored value is a non-`bool` scalar — log
   Warn and return the registered default;
7. **Else** return the boolean override verbatim.

The registered defaults **shall** be: `email = true`,
`in_app = true`, `push = true`, `sms = false`,
`whatsapp = false`. The defaults **shall** match the
structural `SurfaceSetting.Default` values declared by
`notificationSurfaceContribution()` in `surfaces.go` so the runtime
decision and the admin form's "default" badge cannot drift apart.

## Rationale

A user-facing channel toggle has to behave the same way
in three places: (a) the runtime gate that decides
whether to send, (b) the admin form's "default" badge,
(c) the migration script that backfills tenant
overrides. The single helper enforces that. Three
properties:

1. **Closed-by-default for unknown keys.** A typo'd key
   would otherwise resolve through the settings service
   and silently fail to fire. Hard-coding the known set
   in `channelDefaults` makes typos visible (the channel
   simply doesn't fire) rather than subtle (the channel
   fires inconsistently).
2. **Registered-default on read failure.** A transient
   settings outage must not silently flip a tenant
   "back to defaults" mid-incident — but it also must
   not block notifications outright. Returning the
   registered default keeps the runtime aligned with the
   admin UI; the structured Warn log surfaces the
   condition.
3. **Source-of-truth lockstep with the structural surface.**
   The constant table at the top of `channelgate.go`
   *is* the runtime contract; `notificationSurfaceContribution()`
   is the settings-registration contract consumed by the admin bridge.
   `TestChannelDefaults_AgreeWithSurfaceContribution` compares the two
   directly, while `channelgate_test` exercises the runtime fallbacks.

The cancellation-tolerance branch is deliberate: a
transient settings hiccup must not silently flip a
default-on channel to default-off, and must not silently
turn on a default-off channel either.

## Acceptance criteria

- **AC-1 — Unknown key closes fail-closed.**
  `Enabled(ctx, _, _, "channels.unknown")` returns
  `false` and Warn-logs. Verified by
  `TestEnabled_UnknownKeyClosesFailClosed`.
- **AC-2 — Nil settings returns registered default.**
  `Enabled(ctx, nil, log, ChannelEmail)` returns
  `true` (email's default). Verified by
  `TestEnabled_NilSettingsReturnsRegisteredDefault`.
- **AC-3 — Tenant override wins.** A tenant override of
  `false` against an `email` default of `true`
  resolves to `false`. Verified by
  `TestEnabled_TenantOverrideWins`.
- **AC-4 — Nil override falls back to default.** A
  settings service that returns `(nil, nil)` falls
  back to the registered default. Verified by
  `TestEnabled_NilOverrideFallsBackToDefault`.
- **AC-5 — Underlying error falls back + warns.** A
  settings read returning an error logs Warn and
  returns the default. Verified by
  `TestEnabled_UnderlyingErrorFallsBackToDefault`.
- **AC-6 — Non-bool override warns + defaults.** A
  stored value that is not a bool logs Warn and falls
  back to the registered default. Verified by
  `TestEnabled_NonBoolFallsBackToDefault`.
- **AC-7 — Defaults match the registered values.** The
  five entries in `channelDefaults` match the
  `SurfaceSetting.Default` values in
  `modules/platformkit-business-modules/notification_management/surfaces.go`
  (verified by
  `settings_provider_test.go::TestChannelDefaults_AgreeWithSurfaceContribution`).

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `modules/platformkit-business-modules/notification_management/internal/channelgate/channelgate_test.go::TestEnabled_UnknownKeyClosesFailClosed`. |
| AC-2 | Test | `modules/platformkit-business-modules/notification_management/internal/channelgate/channelgate_test.go::TestEnabled_NilSettingsReturnsRegisteredDefault`. |
| AC-3 | Test | `modules/platformkit-business-modules/notification_management/internal/channelgate/channelgate_test.go::TestEnabled_TenantOverrideWins`. |
| AC-4 | Test | `modules/platformkit-business-modules/notification_management/internal/channelgate/channelgate_test.go::TestEnabled_NilOverrideFallsBackToDefault`. |
| AC-5 | Test | `modules/platformkit-business-modules/notification_management/internal/channelgate/channelgate_test.go::TestEnabled_UnderlyingErrorFallsBackToDefault`. |
| AC-6 | Test | `modules/platformkit-business-modules/notification_management/internal/channelgate/channelgate_test.go::TestEnabled_NonBoolFallsBackToDefault`. |
| AC-7 | Test | `modules/platformkit-business-modules/notification_management/settings_provider_test.go::TestChannelDefaults_AgreeWithSurfaceContribution` compares the channel defaults in `surfaces.go::notificationSurfaceContribution` with `internal/channelgate/channelgate.go::channelDefaults`. |

## Edge cases & unhappy paths

- **Logger nil.** The gate is nil-safe on `log`; the
  Warn-log branches no-op when `log` is `nil`. Tests
  exercise this.
- **Stored value is a `string` representation of bool.**
  Treated as non-bool → registered default + Warn. The
  caller must store actual booleans.
- **Structural setting changes default.** A change to a channel
  `SurfaceSetting.Default` in `surfaces.go` must update
  `channelDefaults` in the same commit (the drift-lock test catches
  disagreement). Operators rolling forward without a settings
  migration see new defaults applied to tenants that
  hadn't overridden the key.
- **Cross-channel inconsistency.** Each channel
  service consults the same gate, so a tenant who
  toggles `sms_enabled` cannot accidentally toggle
  `whatsapp_enabled`.
- **Cache layer.** No cache today; every send call
  reads the setting. A future cache layer would have
  to honour the same fail-fallback semantics.

## Risk

- **Likelihood:** High — every send call asks this.
- **Impact:** High — a defective gate either silently
  drops legitimate sends or fires on disabled channels
  (privacy / cost regression).
- **Mitigations:** Closed-by-default unknown key
  (AC-1), nil-safe collaborator (AC-2), registered
  default on every error path (AC-4..AC-6), lint
  enforcing default lockstep (AC-7).

## Implements (cross-cutting)

- **REQ-005 — Fail-closed.** AC-1 + AC-6 — unknown /
  malformed inputs default to safe behaviour.
- **REQ-009 — Observability.** AC-1 / AC-5 / AC-6 —
  Warn-log discipline on every fallback.
- **REQ-014 — Graceful degradation.** AC-5 — transient
  settings outage degrades to registered default.

## Compliance mapping

| Control | Coverage |
|---|---|
| SOC2 CC6.7 (Restrict information access) | AC-3 — channel-level control honours tenant policy. |
| ISO27001 A.13.2 (Information transfer) | AC-1 + AC-3 — outbound channels gated per-tenant. |
| GDPR Art. 25 (Data protection by design) | AC-3 — per-tenant default → consent posture inheritable. |

## Satisfied by

- `modules/platformkit-business-modules/notification_management/internal/channelgate/channelgate.go::Enabled`.
- `modules/platformkit-business-modules/notification_management/internal/channelgate/channelgate.go::channelDefaults` — the registered-default table.
- `modules/platformkit-business-modules/notification_management/surfaces.go::notificationSurfaceContribution`
  — the structural settings source consumed by the admin bridge.
- `modules/platformkit-business-modules/notification_management/settings_provider_test.go::TestChannelDefaults_AgreeWithSurfaceContribution`
  — the executable lock between structural settings and runtime fallbacks.

## Related requirements

- [REQ-NOTIF-001 — Email notifications](./REQ-NOTIF-001-email-notifications.md)
- [REQ-NOTIF-011 — Send-orchestration](./REQ-NOTIF-011-send-orchestration.md) — the consumer that calls this gate.
- [REQ-005 — Authorisation fails closed](./REQ-005-authorisation-fails-closed.md)
- [REQ-014 — Graceful degradation](./REQ-014-graceful-degradation.md)
