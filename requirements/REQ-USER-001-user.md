---
id: REQ-USER-001
title: "User feature owns the user-record lifecycle and exposes both entity and DTO boundary surfaces"
status: Proposed
date: 2026-05-07
slug: req-user-001-user
category: user
ears_pattern: ubiquitous
verification_methods: [test, inspection]
compliance: [SOC2_CC6.1, ISO27001_A.9.4]
satisfied_by:
  adr: [ADR-0009]
  conventions: [C-04, C-14]
implements_cross_cutting: [REQ-001, REQ-004, REQ-009]
type: doc
tags: [requirement, feature, user_management]
module: user_management
feature: user
---

# REQ USER-001 — User

Status: **Proposed** (2026-05-07)

## Statement

The user feature **shall** own the persistent record for every
end-user identity and expose both the entity-shaped `ports.UserService`
interface (used by existing consumers during migration)
and the boundary `ports.UserBoundaryService` interface (DTO-shaped,
import-clean — the target shape for new consumers). Every read,
write, and lifecycle transition **shall** be tenant-scoped, every
mutation **shall** emit a typed event for downstream consumption,
and the role-assignment surface **shall** delegate to
`modules/platformkit-business-modules/auth_management/permissions` rather than re-implementing the
binding.

## Rationale

The user record is the single point of truth that every other module
consults — auth verifies credentials against it, audit anchors
events on its id, billing keys subscriptions to it, notifications
target it. Two-interface exposure (entity-shaped + boundary) is the
deliberate migration discipline documented in
`ports/MIGRATION.md`: producers implement both, consumers move one
at a time, and the entity-shaped interface is deleted only when the last
consumer is gone. Without that discipline a single big-bang
interface swap would block every consumer simultaneously.

Tenant scoping is the single most-load-bearing property for
multi-tenant safety; user reads or writes that escape the tenant
boundary are the textbook isolation breach. Event emission on every
mutation is what makes the user record auditable and integrable
without giving every consumer a direct database hook.

## Acceptance criteria

- **AC-1** Reads, writes, and existence checks honour the tenant
  context — calls without a tenant fail closed, calls with the
  wrong tenant return "not found" rather than the resource.
- **AC-2** The producer implements both `ports.UserService` (entity-shaped)
  and `ports.UserBoundaryService` (boundary) and the two return
  consistent results for the same id (a `GetByID` and `GetByIDDTO`
  for the same user resolve to the same persisted row).
- **AC-3** Every successful create / delete emits a typed event
  (`user.created`, `user.deleted`) that downstream consumers (audit,
  notifications) consume by subscription. Updates are propagated
  through the dedicated profile / preferences / avatar events
  (`user.profile.updated`, `user.preferences.updated`,
  `user.avatar.uploaded`) rather than a single bulk
  `user.updated` — the per-aspect granularity is what lets
  consumers subscribe to only the slices they care about.
- **AC-4** Role assignment / removal calls the user-management
  service's own `AssignRole` / `RemoveRole` methods, which then
  delegate to the underlying `userService` and emit
  `user.assign_role` / `user.remove_role` audit events.
  **Implementation note:** the canonical role/permission service is
  REQ-AUTH-004; the user-management facade currently passes the
  call through its own service rather than invoking the permissions
  service directly. This indirection is documented as a
  to-be-collapsed seam (see prior session task #47 — "Decide
  Role/Permission ownership; migrate permissions feature").

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `modules/platformkit-business-modules/user_management/features/user/service_test.go::TestNewService` exercises tenant-scoped lookup paths against the mock repository; `table_handler_test.go` covers the HTTP surface honouring tenant context. |
| AC-2 | Test | `modules/platformkit-business-modules/user_management/features/user/service_test.go::TestNewService` covers both entity-shaped and boundary read paths against the same backing store; the boundary suite is the import-clean DTO contract. |
| AC-3 | Test | `modules/platformkit-business-modules/user_management/features/user/service_test.go::TestNewService` includes coverage of event publication on the user lifecycle. The full event catalogue (`user.created`, `user.updated`, `user.deleted`) is registered in `feature.go` `Emits(...)` declarations and verified at module-contract check time (`make check-module-contracts`). |
| AC-4 | Inspection | `service_roles.go::AssignRole` / `RemoveRole` (lines 40-78) — calls into `s.userService.AssignRole/RemoveRole` and emits `user.assign_role` / `user.remove_role` audit events. Reviewers note the seam to REQ-AUTH-004 is the to-be-collapsed indirection. |

## Implements (cross-cutting)

- REQ-001 — multi-tenant isolation (AC-1).
- REQ-004 — audit per mutation (AC-3).
- REQ-009 — observability (events + metrics).

## Satisfied by

- `modules/platformkit-business-modules/user_management/features/user/feature.go` — wiring + admin UI.
- `modules/platformkit-business-modules/user_management/features/user/service.go`, `service_test.go`,
  `service_roles.go` — domain logic, role delegation.
- `modules/platformkit-business-modules/user_management/features/user/handler.go`,
  `table_handler.go`, `routes.go`, `representation.go` — HTTP surface.
- `modules/platformkit-business-modules/user_management/features/user/notification_service.go`,
  `notification_service_test.go` — admin-pending notification fan-out.
- `modules/platformkit-business-modules/user_management/features/user/section_renderer.go`,
  `section_renderer_test.go` — admin section rendering.

## Related requirements

- [REQ-USER-002 — Profile](./REQ-USER-002-profile.md)
- [REQ-USER-003 — Preferences](./REQ-USER-003-preferences.md)
- [REQ-USER-004 — Registration onboarding](./REQ-USER-004-registration.md)
- [REQ-AUTH-004 — Permissions](./REQ-AUTH-004-permissions.md) — the role/permission service this feature delegates role assignment to.
