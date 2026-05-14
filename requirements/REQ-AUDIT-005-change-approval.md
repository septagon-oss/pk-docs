---
id: REQ-AUDIT-005
title: "Change approval feature gates high-risk mutations behind a documented review queue"
status: Proposed
date: 2026-05-07
slug: req-audit-005-change-approval
category: audit
ears_pattern: state-driven
verification_methods: [test, inspection]
compliance: [SOC2_CC8.1, ISO27001_A.6.3]
satisfied_by:
  adr: [ADR-0007]
  conventions: [C-14]
implements_cross_cutting: [REQ-004, REQ-005]
type: doc
tags: [requirement, feature, audit_management]
module: audit_management
feature: change_approval
---

# REQ AUDIT-005 — Change approval

Status: **Proposed** (2026-05-07)

## Statement

**While** a mutation is classified as high-risk (privilege
elevation, billing change, security-policy edit), the platform
**shall** route it through this feature's review queue rather than
applying it directly. A change request **shall** carry a typed
operation, a before/after diff, the requesting actor, and the set
of approvers; only after the configured approval threshold is met
**shall** the change apply, and the apply itself **shall** be
audited.

## Rationale

Some changes are too consequential to apply on a single keystroke
— granting a user the `admin.users.delete` capability, rewriting a
billing-tier price, replacing the active SAML certificate. The
review queue makes those changes visible to a second approver,
records the deliberation, and produces an audit row that ties the
final apply back to the human chain that authorised it. SOC 2 CC8.1
("change management") and ISO 27001 A.6.3 ("information security
during change") both require this kind of dual-control discipline
for high-risk changes.

## Acceptance criteria

- **AC-1** The feature exposes `Approve` and `Reject` handlers
  (`handlers.go::ApproveRequest`, `RejectRequest`); the state
  transitions and approval bookkeeping are delegated to the
  shared `core/change/approval` package. Reviewers verify the
  handlers do not bypass that package's discipline.
- **AC-2** Notification fan-out wires through
  `change_approval/notification.go`, which calls the platform
  notification service on submission and decision.
- **AC-3** The admin section renderer
  (`section_renderer_test.go`) shows the current state of each
  request to the operator.

## Known gaps

- **Threshold-gating is not visible in this feature's surface.**
  The "apply only after N approvals" rule lives in
  `core/change/approval`; this REQ does not assert a
  feature-local enforcement. Reviewers must trace through the
  shared package to confirm the threshold semantics for any
  given risk class.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Inspection | `change_approval/handlers.go::ApproveRequest` (line 193) + `RejectRequest` (line 269); `repository.go` is the persistence layer; the apply / threshold logic lives in `core/change/approval`. |
| AC-2 | Inspection | `change_approval/notification.go` — wires submission + decision events to the notification service. |
| AC-3 | Inspection | `section_renderer_test.go` covers the per-request render. _Verification gap: pending — cited evidence is prose / pattern / non-Go and cannot be auto-resolved._ |

## Implements (cross-cutting)

- REQ-004 — audit per mutation (every state transition).
- REQ-005 — fail-closed (apply only after threshold met).

## Satisfied by

- `audit_management/features/change_approval/feature.go`
- `audit_management/features/change_approval/handlers.go`,
  `page_handlers.go`, `admin_table_handler.go`
- `audit_management/features/change_approval/repository.go`
- `audit_management/features/change_approval/notification.go`
- `audit_management/features/change_approval/section_renderer.go`,
  `section_renderer_test.go`
- `audit_management/features/change_approval/permissions.go`,
  `routes.go`

## Related requirements

- [REQ-AUTH-005 — Policy](./REQ-AUTH-005-policy.md) — policy changes are the canonical high-risk class this feature gates.
