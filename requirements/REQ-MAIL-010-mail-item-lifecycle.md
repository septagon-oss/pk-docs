---
id: REQ-MAIL-010
title: "Mail item lifecycle logs intake, notifies the recipient, and records collection — every transition tenant-scoped"
status: Proposed
date: 2026-05-08
slug: req-mail-010-mail-item-lifecycle
category: mail
ears_pattern: state-driven
priority: must
risk: medium
verification_methods: [test]
compliance:
  - SOC2_CC6.1
  - ISO27001_A.8.2.3
  - GDPR_Art_5
satisfied_by:
  adr: [ADR-0009]
  conventions: [C-04, C-14]
implements_cross_cutting: [REQ-001, REQ-009]
refines: REQ-MAIL-001
type: doc
tags: [requirement, capability, mail, mail_tracking, lifecycle]
module: mail
feature: mail_tracking
capability: mail_item_lifecycle
capability_kind: state_machine
stakeholders:
  - reception staff (logs incoming mail)
  - resident / member (collects mail)
  - operator (debugs misrouted items)
---

# REQ MAIL-010 — Mail item lifecycle

Status: **Proposed** (2026-05-08)

## Statement

The mail-tracking feature **shall** expose the
incoming-mail lifecycle:

1. **`LogMailItem(tenantID, item)`** — persist the
   item with a server-generated id and a default
   `Status = received` (or the caller-supplied status
   when explicit), emit the catalogued
   `mail.item.received` event, and return the persisted
   record;
2. **`NotifyRecipient(tenantID, id)`** — read the item,
   verify it belongs to the tenant, set
   `Status = notified`, persist;
3. **`CollectMailItem(tenantID, id, collectedBy)`** —
   read the item, verify tenant scope, refuse if
   already in a terminal state (`collected`,
   `returned`, `expired`), set
   `Status = collected` + `CollectedBy = collectedBy`,
   persist;
4. **`ListPendingMail(tenantID, recipientID)`** —
   return mail items whose `Status` is not in the
   terminal set (`collected`, `returned`, `expired`)
   for the tenant + recipient pair;
5. **`GetMailItem(tenantID, mailID)`** — fetch by id;
   refuse cross-tenant by returning `(nil, nil)` when
   the row's `TenantID` does not match.

Every transition **shall** be validated against the
state machine documented in REQ-MAIL-001 AC-2 (verified
by `state_machine_test.go`).

## Rationale

Physical mail handling is a coworking-space staple;
incorrect tracking either delivers mail to the wrong
member (privacy breach) or marks an unclaimed item as
collected (audit defect). Three properties:

1. **Tenant scope on every read.** The
   `TenantID` parameter on every method ensures
   cross-tenant id collisions cannot leak items
   between tenants. The pattern is
   `fetch + compare tenant + reject` — REQ-001.
2. **Terminal-state idempotency.** Collecting an
   already-collected item is refused with a typed
   error so the audit ledger reads the actual
   collection event, not a re-write.
3. **Pending-list filter excludes terminal states.**
   The end-user UI's "what's waiting for me?" view
   must not show collected / returned items. The
   service-layer filter is the source of truth.

## Acceptance criteria

- **AC-1 — Log sets defaults.** A
  `LogMailItem(tenantID, item)` with no
  pre-set `Status` defaults to `received`;
  the persisted row carries the tenant id and a
  server-generated id.
- **AC-2 — Log preserves explicit status.** A
  caller-supplied `Status` (e.g., `notified` for
  back-fills) is preserved on persist.
- **AC-3 — Log emits event.** A successful log
  emits `mail.item.received` on the event bus.
- **AC-4 — Log propagates create error.** A
  CRUD-layer create failure returns the wrapped
  error with no event emitted.
- **AC-5 — Notify flips status.** A
  `NotifyRecipient(tenantID, id)` sets
  `Status = notified`; the row is persisted.
- **AC-6 — Notify refuses cross-tenant.** A
  notify call against a tenant that does not own
  the row returns the typed wrong-tenant error.
- **AC-7 — Collect happy path.** A
  `CollectMailItem(tenantID, id, collectedBy)`
  flips `Status = collected`, sets
  `CollectedBy`, and persists the row.
- **AC-8 — Collect refuses already-collected.** A
  collect against an item already in
  `collected` state returns the typed
  already-collected error.
- **AC-9 — Collect refuses cross-tenant.** A
  collect call from the wrong tenant returns the
  typed wrong-tenant error.
- **AC-10 — List excludes terminal states.**
  `ListPendingMail(tenantID, recipientID)` does
  not return items in `collected`, `returned`, or
  `expired` states.
- **AC-11 — Get refuses cross-tenant.** A
  `GetMailItem(otherTenant, id)` returns
  `(nil, nil)`; only the owning tenant sees the
  item.
- **AC-12 — Get returns summary for owning
  tenant.** A `GetMailItem(tenant, id)` returns
  the typed summary when the row belongs to the
  tenant.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `pk-modules/mail/features/mail_tracking/service_test.go::TestLogMailItem_SetsDefaults`. |
| AC-2 | Test | `pk-modules/mail/features/mail_tracking/service_test.go::TestLogMailItem_PreservesExplicitStatus`. |
| AC-3 | Test | `pk-modules/mail/features/mail_tracking/service_test.go::TestLogMailItem_EmitsEvent`. |
| AC-4 | Test | `pk-modules/mail/features/mail_tracking/service_test.go::TestLogMailItem_PropagatesCreateError`. |
| AC-5 | Test | `pk-modules/mail/features/mail_tracking/service_test.go::TestNotifyRecipient_SetsNotifiedStatus`. |
| AC-6 | Test | `pk-modules/mail/features/mail_tracking/service_test.go::TestNotifyRecipient_WrongTenantReturnsError`. |
| AC-7 | Test | `pk-modules/mail/features/mail_tracking/service_test.go::TestCollectMailItem_Success`. |
| AC-8 | Test | `pk-modules/mail/features/mail_tracking/service_test.go::TestCollectMailItem_AlreadyCollected`. |
| AC-9 | Test | `pk-modules/mail/features/mail_tracking/service_test.go::TestCollectMailItem_WrongTenant`. |
| AC-10 | Test | `pk-modules/mail/features/mail_tracking/service_test.go::TestListPendingMail_ExcludesTerminalStatuses`. |
| AC-11 | Test | `pk-modules/mail/features/mail_tracking/service_test.go::TestGetMailItem_ReturnsNilForWrongTenant`. |
| AC-12 | Test | `pk-modules/mail/features/mail_tracking/service_test.go::TestGetMailItem_ReturnsItemForCorrectTenant`. |

## Edge cases & unhappy paths

- **Concurrent notify + collect.**
  Last-write-wins; the audit ledger captures
  whichever transition won.
- **Returned / expired transitions.** Out of
  scope for this REQ; future work adds the
  return-mail and expiry-sweep capabilities.
- **Mail with no recipient.** Allowed at this
  layer (the row carries an empty
  `RecipientID`); the pending-list filter
  excludes it from member-facing views.
- **CollectedBy empty.** Currently allowed; UI
  handlers refuse empty `collectedBy` upstream.
- **State-machine violation.** Validated
  upstream against `ValidateMailTransition`
  (REQ-MAIL-001 AC-2 / `state_machine_test.go`).

## Risk

- **Likelihood:** Medium — every mail item.
- **Impact:** Medium — defective tracking
  delivers mail to the wrong member (privacy)
  or loses items (operator confidence).
- **Mitigations:** Tenant-scope guard on every
  method (AC-6, AC-9, AC-11), terminal-state
  refusal (AC-8), event on intake (AC-3).

## Implements (cross-cutting)

- **REQ-001 — Multi-tenant isolation.** AC-6,
  AC-9, AC-11 — explicit guards.
- **REQ-009 — Observability.** AC-3 — event
  emission.

## Compliance mapping

| Control | Coverage |
|---|---|
| SOC2 CC6.1 (Logical access) | AC-6, AC-9, AC-11 — tenant-bound mail handling. |
| ISO27001 A.8.2.3 (Handling of assets) | AC-7 + AC-8 — controlled handover with collected-by attribution. |
| GDPR Art. 5 (Data minimisation) | AC-11 — cross-tenant reads return `(nil, nil)`. |

## Satisfied by

- `pk-modules/mail/features/mail_tracking/service.go::LogMailItem, NotifyRecipient, CollectMailItem, ListPendingMail, GetMailItem`.
- `pk-modules/mail/features/mail_tracking/state_machine.go::ValidateMailTransition` — the transition validator.

## Related requirements

- [REQ-MAIL-001 — Mail tracking](./REQ-MAIL-001-mail-tracking.md)
- [REQ-MAIL-011 — Package lifecycle](./REQ-MAIL-011-package-lifecycle.md) — the parallel package surface with the same shape.
