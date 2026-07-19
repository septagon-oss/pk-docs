---
id: REQ-ADMIN-011
title: "Setting writes and cache-invalidation events commit atomically; missing durable publication fails closed"
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
implements_cross_cutting: [REQ-004, REQ-005]
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
2. Enqueue the `admin.settings.changed` event through the durable
   publisher in that same transaction, so a crash between persist
   and delivery cannot leave the change un-announced;
3. **If** the publisher is missing or enqueue fails, roll back the
   setting write and return an error. There is no direct-publish
   fallback because it would reintroduce a dual-write hole;
4. **If** the row already exists, update the value and enqueue
   the same change event (the audit ledger captures the
   transition).

Every composition that permits settings mutation **shall** wire the
durable publisher supplied by `eventing_management`.

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

Failing closed on missing publication is deliberate. A stripped
composition may still read settings, but it cannot claim a successful
mutation while omitting the invalidation event required by other
replicas.

## Acceptance criteria

- **AC-1 — Outbox path on insert.** When the setting row
  does not exist and the outbox is wired, `SetSettingValue`
  persists the row and enqueues
  `admin.settings.changed` on the outbox in the same
  transaction; the in-process bus sees no direct publish.
- **AC-2 — Outbox path on update.** When the setting row
  exists, the same outbox-enqueue happens on the
  update path.
- **AC-3 — Missing publisher fails closed.** When no durable
  publisher is wired, `SetSettingValue` returns an actionable error
  and the transaction commits neither a setting row nor an outbox row.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `modules/platformkit-business-modules/admin_management/features/settings/service_outbox_test.go::TestSetSettingValue_OutboxPath_EnqueuesInsteadOfDirectPublish`. |
| AC-2 | Test | `modules/platformkit-business-modules/admin_management/features/settings/service_outbox_test.go::TestSetSettingValue_OutboxPath_OnUpdate`. |
| AC-3 | Test | `modules/platformkit-business-modules/admin_management/features/settings/service_outbox_test.go::TestSetSettingValue_MissingPublisherRollsBack`. |

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
- **Publisher missing or enqueue failure.** The transaction rolls
  back and the caller receives an error; no setting value becomes
  visible without its corresponding invalidation event.

## Risk

- **Likelihood:** Medium — every settings write.
- **Impact:** High — defective publish leaves caches
  stale; defective persist confuses operators about
  whether the change took effect.
- **Mitigations:** Atomic outbox path (AC-1, AC-2), fail-closed
  missing-publisher behavior (AC-3), commit-order preservation in
  the outbox (ADR-0007).

## Implements (cross-cutting)

- **REQ-004 — Audit per mutation.** The
  `admin.settings.changed` event is the audit signal.
- **REQ-005 — Authorisation gates fail closed.** AC-3 applies the
  same fail-closed posture to a required consistency boundary: an
  incomplete mutation is rejected, never reported as successful.

## Compliance mapping

| Control | Coverage |
|---|---|
| SOC2 CC7.2 (System monitoring) | AC-1..AC-3 — every successful settings change is durably observable. |
| SOC2 CC8.1 (Change management) | AC-1, AC-2 — atomic persist + announce. |
| ISO27001 A.12.4 (Logging) | AC-1 — outbox row is the durable event log. |

## Satisfied by

- `modules/platformkit-business-modules/admin_management/features/settings/service.go::SetSettingValue` — orchestration.
- `modules/platformkit-business-modules/internal/outbox/` — outbox infrastructure.

## Related requirements

- [REQ-ADMIN-009 — Settings](./REQ-ADMIN-009-settings.md)
- [REQ-ADMIN-010 — Settings resolver](./REQ-ADMIN-010-settings-resolver.md) — the resolver that consumes persisted values.
- [REQ-004 — Audit per mutation](./REQ-004-audit-event-per-mutation.md)
