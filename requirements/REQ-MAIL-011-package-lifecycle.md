---
id: REQ-MAIL-011
title: "Package lifecycle mirrors the mail-item shape — log, notify, collect — with the same tenant-scope discipline"
status: Proposed
date: 2026-05-08
slug: req-mail-011-package-lifecycle
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
refines: REQ-MAIL-002
type: doc
tags: [requirement, capability, mail_management, package_tracking, lifecycle]
module: mail_management
feature: package_tracking
capability: package_lifecycle
capability_kind: state_machine
stakeholders:
  - reception staff (logs incoming packages)
  - resident / member (collects packages)
  - operator (debugs misrouted items)
---

# REQ MAIL-011 — Package lifecycle

Status: **Proposed** (2026-05-08)

## Statement

The package-tracking feature **shall** mirror the
mail-item lifecycle (REQ-MAIL-010) for parcels:

1. **`LogPackage(tenantID, item)`** — persist with
   default `Status = received`, emit
   `mail.package.received`, return the persisted
   record;
2. **`NotifyRecipient(tenantID, id)`** — fetch with
   tenant-scope check, set `Status = notified`,
   persist;
3. **`CollectPackage(tenantID, id, collectedBy)`** —
   tenant-scope check, refuse if already collected,
   set `Status = collected` + `CollectedBy`, persist;
4. **`ListPendingPackages(tenantID, recipientID)`** —
   filter out terminal-state packages
   (`collected`, `returned`, `expired`);
5. **`GetPackage(tenantID, packageID)`** — return
   `(nil, nil)` on cross-tenant lookup; return the
   typed summary on owning-tenant lookup.

Package-specific fields (size, weight, courier,
tracking number) are persisted but do not change the
state-machine shape — the lifecycle is identical to
mail items.

## Rationale

Packages and mail items differ in their physical
attributes (carrier, weight, dimensions) but share the
same state-machine: received → notified → collected
(or returned / expired). Maintaining two parallel
features rather than one generic one is a deliberate
choice — packages have storage / handling concerns
(forklift access, refrigeration, hazmat) that the
shared model would have to absorb, and the per-feature
event namespace (`mail.package.*` vs `mail.item.*`)
keeps subscribers unambiguous.

## Acceptance criteria

- **AC-1 — Log sets defaults.** A
  `LogPackage(tenantID, item)` defaults `Status` to
  `received` when blank; the persisted row carries the
  tenant id.
- **AC-2 — Log emits event.** A successful log emits
  `mail.package.received` on the event bus.
- **AC-3 — Log propagates create error.** A
  CRUD-layer create failure returns the wrapped error;
  no event is emitted.
- **AC-4 — Notify flips status.** A
  `NotifyRecipient(tenantID, id)` sets
  `Status = notified`; the row is persisted.
- **AC-5 — Notify refuses cross-tenant.** A notify
  call from the wrong tenant returns the typed
  wrong-tenant error.
- **AC-6 — Collect happy path.** A
  `CollectPackage(tenantID, id, collectedBy)` flips
  `Status = collected`, sets `CollectedBy`, and
  persists.
- **AC-7 — Collect refuses already-collected.** A
  collect against an already-collected package returns
  the typed already-collected error.
- **AC-8 — Collect refuses cross-tenant.** A collect
  from the wrong tenant returns the wrong-tenant
  error.
- **AC-9 — List excludes terminal states.**
  `ListPendingPackages(tenantID, recipientID)` does
  not return `collected`, `returned`, or `expired`
  packages.
- **AC-10 — Get refuses cross-tenant.** A
  `GetPackage(otherTenant, id)` returns `(nil, nil)`.
- **AC-11 — Get returns summary for owning tenant.** A
  `GetPackage(tenant, id)` returns the typed summary
  when the row belongs to the tenant.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `modules/platformkit-business-modules/mail_management/features/package_tracking/service_test.go::TestLogPackage_SetsDefaults`. |
| AC-2 | Test | `modules/platformkit-business-modules/mail_management/features/package_tracking/service_test.go::TestLogPackage_EmitsEvent`. |
| AC-3 | Test | `modules/platformkit-business-modules/mail_management/features/package_tracking/service_test.go::TestLogPackage_PropagatesCreateError`. |
| AC-4 | Test | `modules/platformkit-business-modules/mail_management/features/package_tracking/service_test.go::TestNotifyRecipient_SetsNotifiedStatus`. |
| AC-5 | Test | `modules/platformkit-business-modules/mail_management/features/package_tracking/service_test.go::TestNotifyRecipient_WrongTenantReturnsError`. |
| AC-6 | Test | `modules/platformkit-business-modules/mail_management/features/package_tracking/service_test.go::TestCollectPackage_Success`. |
| AC-7 | Test | `modules/platformkit-business-modules/mail_management/features/package_tracking/service_test.go::TestCollectPackage_AlreadyCollected`. |
| AC-8 | Test | `modules/platformkit-business-modules/mail_management/features/package_tracking/service_test.go::TestCollectPackage_WrongTenant`. |
| AC-9 | Test | `modules/platformkit-business-modules/mail_management/features/package_tracking/service_test.go::TestListPendingPackages_ExcludesTerminalStatuses`. |
| AC-10 | Test | `modules/platformkit-business-modules/mail_management/features/package_tracking/service_test.go::TestGetPackage_ReturnsNilForWrongTenant`. |
| AC-11 | Test | `modules/platformkit-business-modules/mail_management/features/package_tracking/service_test.go::TestGetPackage_ReturnsSummary`. |

## Edge cases & unhappy paths

- **Returned packages.** Out of scope for this REQ;
  the courier-return flow is a future capability.
- **Carrier-specific tracking.** Tracking numbers are
  persisted as plain strings; carrier integration
  (status updates from FedEx / DHL / UPS) is a
  separate integration adapter under REQ-013.
- **Recipient-pickup-without-id.** Reception staff can
  collect on behalf of a recipient (the
  `collectedBy` field carries the staff user id, not
  the recipient).
- **Concurrent notify + collect.** Last-write-wins;
  the audit ledger captures the actual transitions.

## Risk

- **Likelihood:** Medium — every package.
- **Impact:** Medium — defective tracking misroutes
  packages or loses them.
- **Mitigations:** Tenant-scope guard on every read
  (AC-5, AC-8, AC-10), terminal-state refusal (AC-7),
  event on intake (AC-2).

## Implements (cross-cutting)

- **REQ-001 — Multi-tenant isolation.** AC-5, AC-8,
  AC-10 — explicit guards.
- **REQ-009 — Observability.** AC-2 — event emission.

## Compliance mapping

| Control | Coverage |
|---|---|
| SOC2 CC6.1 (Logical access) | AC-5, AC-8, AC-10 — tenant-bound package handling. |
| ISO27001 A.8.2.3 (Handling of assets) | AC-6 + AC-7 — controlled handover with collected-by attribution. |
| GDPR Art. 5 (Data minimisation) | AC-10 — cross-tenant reads return `(nil, nil)`. |

## Satisfied by

- `modules/platformkit-business-modules/mail_management/features/package_tracking/service.go::LogPackage, NotifyRecipient, CollectPackage, ListPendingPackages, GetPackage`.

## Related requirements

- [REQ-MAIL-002 — Package tracking](./REQ-MAIL-002-package-tracking.md)
- [REQ-MAIL-010 — Mail item lifecycle](./REQ-MAIL-010-mail-item-lifecycle.md) — the parallel surface with the same shape.
