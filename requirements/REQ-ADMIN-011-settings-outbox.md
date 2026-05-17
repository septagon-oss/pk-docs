---
id: REQ-ADMIN-011
title: "Setting writes route through the transactional outbox when configured; direct publish remains for stripped builds"
status: Proposed
date: 2026-05-08
slug: req-admin-011-settings-outbox
category: governance
ears_pattern: event-driven
priority: must
risk: high
verification_methods: [test]
compliance:
  - SOC2_CC7.2
  - SOC2_CC8.1
  - ISO27001_A.12.4
satisfied_by:
  adr: [ADR-0007]
  conventions: [C-04, C-14]
implements_cross_cutting: [REQ-004, REQ-014]
refines: REQ-ADMIN-009
type: doc
tags: [requirement, capability, admin_management, settings, outbox]
module: admin_management
feature: settings
capability: settings_outbox
capability_kind: failure_mode
stakeholders:
  - tenant administrator (changes a setting)
  - subscriber (downstream listener for `admin.settings.changed`)
  - operator (debugs missing change events)
---

# REQ ADMIN-011 — Settings outbox publication

Status: **Proposed** (2026-05-08)

## Statement

**When** a caller invokes
`SettingsService.SetSettingValue(module, key, value, tenantID)`,
the settings feature **shall**:

1. Persist the new value through the resolver / repository in
   the same transaction;
2. **If** the platform has wired a transactional outbox
   (ADR-0007), enqueue the
   `admin.settings.changed` event on the outbox so the
   delivery is atomic with the persist — a crash between
   persist and publish cannot leave the change un-announced;
3. **If** no outbox is wired (minimal / stripped builds),
   fall through to the explicit direct-publish path: the event
   is published on the in-process bus immediately after the
   persist returns;
4. **If** the row already exists, update the value and emit
   the same change event (the audit ledger captures the
   transition).

The outbox path **shall** be the production default for
deployments with `audit_management` wired; the direct-publish
path is reserved for unit tests and minimal builds where the
outbox infrastructure is absent.

## Rationale

A setting change must reach every subscriber — caches,
notification channel gates, design-token resolvers all listen
for `admin.settings.changed`. Two failure modes the outbox
prevents:

1. **Persist-then-crash.** Direct publish runs *after* the
   persist returns. A crash between the two leaves the new
   value in the database with no event emitted; subscribers
   keep using stale cache entries until the next read.
   The outbox makes the publish part of the same DB
   transaction, so persist + outbox-row are atomic.
2. **Publish-then-rollback.** Conversely, publishing first
   and persisting second can announce a change that gets
   rolled back. The outbox path serialises through the DB
   commit so subscribers cannot see a phantom value.

The direct-publish branch is documented operator-side:
deployments without `audit_management` get the simpler
behaviour and operators understand the at-most-once-delivery
trade-off.

## Acceptance criteria

- **AC-1 — Outbox path on insert.** When the setting row
  does not exist and the outbox is wired, `SetSettingValue`
  persists the row and enqueues
  `admin.settings.changed` on the outbox in the same
  transaction; the in-process bus sees no direct publish.
- **AC-2 — Outbox path on update.** When the setting row
  exists, the same outbox-enqueue happens on the
  update path.
- **AC-3 — Explicit direct-publish path.** When no outbox
  is wired, `SetSettingValue` persists and then publishes
  the event directly on the in-process bus.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `pk-modules/admin_management/features/settings/service_outbox_test.go::TestSetSettingValue_OutboxPath_EnqueuesInsteadOfDirectPublish`. |
| AC-2 | Test | `pk-modules/admin_management/features/settings/service_outbox_test.go::TestSetSettingValue_OutboxPath_OnUpdate`. |
| AC-3 | Test | `pk-modules/admin_management/features/settings/service_outbox_test.go` covers the no-outbox direct publish branch. |

## Edge cases & unhappy paths

- **Outbox enqueue failure.** Treated as a transactional
  failure: the persist rolls back; the caller sees the
  wrapped error.
- **Worker delay on outbox dispatch.** Subscribers see
  the event delayed by the worker's polling interval;
  this is the documented eventual-consistency window.
- **Concurrent SetSettingValue on the same key.**
  Last-commit-wins; the outbox row order matches the
  commit order.
- **Subscriber error on direct-publish path.** The direct
  path's `eventBus.Publish` is best-effort; a failed
  subscriber does not roll back the persist (no
  transaction). This is the trade-off operators accept
  with the direct path.

## Risk

- **Likelihood:** Medium — every settings write.
- **Impact:** High — defective publish leaves caches
  stale; defective persist confuses operators about
  whether the change took effect.
- **Mitigations:** Atomic outbox path (AC-1, AC-2),
  explicit direct path for stripped builds (AC-3), commit-order
  preservation in the outbox (ADR-0007).

## Implements (cross-cutting)

- **REQ-004 — Audit per mutation.** The
  `admin.settings.changed` event is the audit signal.
- **REQ-014 — Graceful degradation.** AC-3 — minimal
  builds without outbox still announce changes.

## Compliance mapping

| Control | Coverage |
|---|---|
| SOC2 CC7.2 (System monitoring) | AC-1..AC-3 — every settings change is observable. |
| SOC2 CC8.1 (Change management) | AC-1, AC-2 — atomic persist + announce. |
| ISO27001 A.12.4 (Logging) | AC-1 — outbox row is the durable event log. |

## Satisfied by

- `pk-modules/admin_management/features/settings/service.go::SetSettingValue` — orchestration.
- `pk-modules/internal/outbox/` — outbox infrastructure.

## Related requirements

- [REQ-ADMIN-009 — Settings](./REQ-ADMIN-009-settings.md)
- [REQ-ADMIN-010 — Settings resolver](./REQ-ADMIN-010-settings-resolver.md) — the resolver that consumes persisted values.
- [REQ-004 — Audit per mutation](./REQ-004-audit-event-per-mutation.md)
