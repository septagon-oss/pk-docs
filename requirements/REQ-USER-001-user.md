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
end-user identity and expose the DTO-only `ports.UserBoundaryService`
interface. Persistence entities, ORM metadata, and credential-bearing
records shall not cross ordinary user read/write boundaries. Every read,
write, and lifecycle transition **shall** be tenant-scoped, every
mutation **shall** emit a typed event for downstream consumption,
and identity-role assignment **shall** remain descriptive account metadata.
Neither a user role row nor a role claim **shall** grant authorization; live
access decisions belong exclusively to the governed authorization provider.

## Rationale

The user record is the single point of truth that every other module
consults — auth verifies credentials against it, audit anchors
events on its id, billing keys subscriptions to it, notifications
target it. The boundary is split into narrow reader, writer, lifecycle,
role, and statistics interfaces so consumers depend only on the behavior
they use. `porttypes.UserDTO` and `RoleDTO` are acyclic wire models owned by
the boundary rather than aliases of persistence entities. There is no
permission DTO on this identity boundary because permissions are evaluated as
live decision tuples rather than expanded into user records.

Tenant scoping is the single most-load-bearing property for
multi-tenant safety; user reads or writes that escape the tenant
boundary are the textbook isolation breach. Event emission on every
mutation is what makes the user record auditable and integrable
without giving every consumer a direct database hook.

## Acceptance criteria

- **AC-1** Reads, writes, and existence checks honour the tenant
  context — calls without a tenant fail closed, calls with the
  wrong tenant return "not found" rather than the resource.
- **AC-2** The producer implements `ports.UserBoundaryService`; `GetByIDDTO`
  returns the canonical persisted identity as `porttypes.UserDTO`, and no
  exported user boundary method accepts or returns a user-management entity.
- **AC-3** Every successful create / delete emits a typed event
  (`user.created`, `user.deleted`) that downstream consumers (audit,
  notifications) consume by subscription. Updates are propagated
  through the dedicated profile / preferences / avatar events
  (`user.profile.updated`, `user.preferences.updated`,
  `user.avatar.uploaded`) rather than a single bulk
  `user.updated` — the per-aspect granularity is what lets
  consumers subscribe to only the slices they care about.
- **AC-4** Identity-role assignment / removal calls the user-management
  service's `AssignRole` / `RemoveRole` methods and emits
  `user.assign_role` / `user.remove_role` audit events. Authorization tests
  prove that these rows and resulting session claims are not interpreted as
  grants by the runtime.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `pk-modules/user_management/features/user/service_test.go::TestNewService` exercises tenant-scoped lookup paths against the mock repository; `table_handler_test.go` covers the HTTP surface honouring tenant context. |
| AC-2 | Test | `pk-modules/user_management/features/user/service_test.go::TestNewService` covers both entity-shaped and boundary read paths against the same backing store; the boundary suite is the import-clean DTO contract. |
| AC-3 | Test | `pk-modules/user_management/features/user/service_test.go::TestNewService` includes coverage of event publication on the user lifecycle. The full event catalogue (`user.created`, `user.updated`, `user.deleted`) is registered in `feature.go` `Emits(...)` declarations and verified at module-contract check time (`make check-module-contracts`). |
| AC-4 | Inspection | `pk-modules/user_management/features/user/service_roles.go` owns identity-role metadata and audit publication. |
| AC-4 | Test | `pk-modules/user_management/features/user/service_test.go::TestService_AssignRole` proves assignment behavior and audit emission. |
| AC-4 | Test | `pk-modules/user_management/features/user/service_test.go::TestService_RemoveRole` proves removal behavior and audit emission. |
| AC-4 | Test | `pk-core/security/authz/runtime/runtime_test.go::TestRuntimeDoesNotTreatIdentityRoleClaimsAsAuthorizationGrants` proves identity roles cannot become authorization grants. |

## Implements (cross-cutting)

- REQ-001 — multi-tenant isolation (AC-1).
- REQ-004 — audit per mutation (AC-3).
- REQ-009 — observability (events + metrics).

## Satisfied by

- `pk-modules/user_management/features/user/feature.go` — wiring + admin UI.
- `pk-modules/user_management/features/user/service.go`, `service_test.go`,
  `service_roles.go` — domain logic, role delegation.
- `pk-modules/user_management/features/user/handler.go`,
  `table_handler.go`, `routes.go`, `representation.go` — HTTP surface.
- `pk-modules/user_management/features/user/notification_service.go`,
  `notification_service_test.go` — admin-pending notification fan-out.
- `pk-modules/user_management/features/user/section_renderer.go`,
  `section_renderer_test.go` — admin section rendering.

## Related requirements

- [REQ-USER-002 — Profile](./REQ-USER-002-profile.md)
- [REQ-USER-003 — Preferences](./REQ-USER-003-preferences.md)
- [REQ-USER-004 — Registration onboarding](./REQ-USER-004-registration.md)
- [REQ-AUTH-004 — Authorization catalog](./REQ-AUTH-004-permissions.md) — the boundary that keeps identity roles descriptive and provider decisions authoritative.
