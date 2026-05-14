---
id: REQ-MAIL-002
title: "Package tracking feature persists tenant-scoped parcel records and emits typed lifecycle events"
status: Proposed
date: 2026-05-07
slug: req-mail-002-package-tracking
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
feature: package_tracking
---

# REQ MAIL-002 — Package tracking

Status: **Proposed** (2026-05-07)

## Statement

The package tracking feature **shall** persist parcel records
(carrier, tracking number, recipient, status, received-at and
collected-at timestamps) per tenant. State transitions
(`LogPackage` → `received`, `CollectPackage` → `collected`)
**shall** be admin-driven through the handler surface and **shall**
emit the catalogued typed events (`mail.package.received`,
`mail.package.collected`).

## Rationale

PlatformKit deployments include cowork operators that handle
inbound parcels for their members. The discipline of recording
each state transition with a timestamp is the audit trail
operators need when a member disputes whether a parcel was ever
collected. Event emission keeps the in-app and email
notifications real-time as state changes.

## Acceptance criteria

- **AC-1** Parcel records persist with the tenant id assigned by
  the service (`s.LogPackage` sets `pkg.TenantID = tenantID`).
- **AC-2** `LogPackage` defaults the status to `received` and
  stamps `ReceivedAt` to the current time when not supplied.
- **AC-3** `CollectPackage` flips the status, stamps the
  collector, and emits the catalogued `mail.package.collected`
  event.

## Known gaps

- **No carrier-webhook receiver.** Today the lifecycle is
  admin-driven (operator clicks "received" / "collected" in the
  admin UI). Carrier-API integration with signed webhook
  validation is not implemented at this layer; reviewers verify
  the absence of an inbound webhook handler.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `pk-modules/mail_management/features/package_tracking/service_test.go::TestLogPackage_EmitsEvent` covers the LogPackage tenant-assignment path. |
| AC-2 | Test | `pk-modules/mail_management/features/package_tracking/service_test.go::TestLogPackage_EmitsEvent` covers default-status / received-at assignment. |
| AC-3 | Test | `pk-modules/mail_management/features/package_tracking/service_test.go::TestLogPackage_EmitsEvent` covers the CollectPackage transition + event emission via the recording event bus. |

## Implements (cross-cutting)

- REQ-001 — multi-tenant isolation.
- REQ-004 — audit per mutation (catalogued events).

## Satisfied by

- `mail_management/features/package_tracking/feature.go`
- `mail_management/features/package_tracking/service.go`,
  `service_test.go`
- `mail_management/features/package_tracking/handler.go`,
  `routes.go`, `permissions.go`

## Related requirements

- [REQ-MAIL-001 — Mail tracking](./REQ-MAIL-001-mail-tracking.md) — sibling physical-mail record.
