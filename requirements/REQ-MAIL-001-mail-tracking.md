---
id: REQ-MAIL-001
title: "Mail tracking feature persists per-tenant physical-mail records with delivery state"
status: Proposed
date: 2026-05-07
slug: req-mail-001-mail-tracking
category: mail
ears_pattern: ubiquitous
verification_methods: [test]
compliance: []
satisfied_by:
  adr: [ADR-0009]
  conventions: [C-04, C-14]
implements_cross_cutting: [REQ-001, REQ-004]
type: doc
tags: [requirement, feature, mail_management]
module: mail_management
feature: mail_tracking
---

# REQ MAIL-001 — Mail tracking

Status: **Proposed** (2026-05-07)

## Statement

The mail tracking feature **shall** persist physical-mail records
per tenant — sender, recipient, status, received-at and
collected-at timestamps — through the standard generic-CRUD
layer. Operator-driven state transitions (`LogMailItem` →
`received`, `CollectMailItem` → `collected`) **shall** stamp the
appropriate timestamp and emit the catalogued events
(`mail.item.received`, `mail.item.collected`).

## Rationale

PlatformKit deployments include cowork operators that handle
physical mail for tenant members. The discipline of recording each
state transition — particularly `picked_up` — is the audit trail
operators need when a member disputes whether a piece of mail was
ever collected. Event emission keeps the in-app and email
notifications real-time as state changes.

## Acceptance criteria

- **AC-1** Mail records persist with the tenant id assigned by
  the service (`s.LogMailItem` sets `item.TenantID = tenantID`).
- **AC-2** `LogMailItem` defaults the status to
  `MailStatusReceived` and stamps `ReceivedAt` to the current
  time when not supplied.
- **AC-3** `CollectMailItem` flips the status, stamps the
  collector, and emits the catalogued `mail.item.collected`
  event; `LogMailItem` emits `mail.item.received`.

- **AC-4** State transitions go through
  `ValidateMailTransition(from, to)` (`state_machine.go`) which
  encodes the documented forward-only lifecycle. Reversals
  (e.g. `collected → received`) and transitions out of terminal
  states are rejected with `ErrInvalidMailStateTransition`.
  Service callers must consult the validator before flipping the
  status field on a record.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `modules/platformkit-business-modules/mail_management/features/mail_tracking/service_test.go::TestLogMailItem_SetsDefaults` and `TestNotifyRecipient_WrongTenantReturnsError` cover tenant-scoped persistence and refusal. |
| AC-2 | Test | `modules/platformkit-business-modules/mail_management/features/mail_tracking/service_test.go::TestLogMailItem_PreservesExplicitStatus` and `TestLogMailItem_SetsDefaults` cover the default-and-override status assignment. |
| AC-3 | Test | `modules/platformkit-business-modules/mail_management/features/mail_tracking/service_test.go::TestLogMailItem_EmitsEvent` and `TestCollectMailItem_Success` cover event emission per transition. |
| AC-4 | Test | `modules/platformkit-business-modules/mail_management/features/mail_tracking/state_machine_test.go::TestValidateMailTransition_AllowsForwardLifecycle`, `TestValidateMailTransition_RejectsBackwardsTransitions`, `TestValidateMailTransition_RejectsUnknownState`, `TestValidateMailTransition_AllowsNoOp`. |

## Implements (cross-cutting)

- REQ-001 — multi-tenant isolation.
- REQ-004 — audit per mutation.

## Satisfied by

- `mail_management/features/mail_tracking/feature.go`
- `mail_management/features/mail_tracking/service.go`,
  `service_test.go`
- `mail_management/features/mail_tracking/handler.go`, `routes.go`,
  `permissions.go`

## Related requirements

- [REQ-MAIL-002 — Package tracking](./REQ-MAIL-002-package-tracking.md) — sibling parcel-tracking record.
