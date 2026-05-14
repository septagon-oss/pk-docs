---
id: REQ-AUTH-041
title: "Role assignment binds zero or more roles to a user, audits the change, and refuses excess role-count"
status: Proposed
date: 2026-05-08
slug: req-auth-041-role-assignment
category: auth
ears_pattern: event-driven
priority: must
risk: high
verification_methods: [test]
compliance:
  - SOC2_CC6.3
  - ISO27001_A.9.2.3   # Management of privileged access rights
  - NIST_AC-2          # Account management
satisfied_by:
  adr: [ADR-0009]
  conventions: [C-04, C-14]
implements_cross_cutting: [REQ-001, REQ-004, REQ-005]
refines: REQ-AUTH-004
type: doc
tags: [requirement, capability, auth_management, permissions, roles]
module: auth_management
feature: permissions
capability: assign_role
capability_kind: failure_mode
stakeholders:
  - tenant administrator (granting roles)
  - end-user (recipient of role)
  - compliance auditor (privileged-access audit)
---

# REQ AUTH-041 — Role assignment

Status: **Proposed** (2026-05-08)

## Statement

`Service::AssignUserRoles(ctx, userID, request)` **shall**
look up the target user, validate that every named role
exists, refuse the request if the resulting role count would
exceed the configured `MaxRolesPerUser`, persist the
new role bindings, publish the catalogued
`role.assigned` event for each role bound, and return the
populated `AssignmentResult`. **If** any precondition fails
(unknown user, unknown role, exceeded count), the function
**shall** return a typed error and persist no partial state.

## Rationale

Role assignment is the privileged-access management surface;
its discipline rests on three properties:

1. **All-or-nothing.** A bulk assignment either binds every
   requested role or binds none. A partial application
   leaves the user's effective permissions in an
   indeterminate state mid-request.
2. **Bounded role count.** The configured
   `MaxRolesPerUser` is the platform's implementation of
   the principle of least privilege at the user level —
   role explosion is itself a security smell.
3. **Audit per assignment.** Every role bound emits the
   catalogued `role.assigned` event so the audit trail
   captures the privileged-access change with the actor
   (`AssignedBy`) and target.

The check happens at assignment time rather than at access
time so the wrong-input error surfaces immediately to the
operator rather than appearing as an inscrutable deny on
the user's next privileged action.

## Acceptance criteria

- **AC-1 — Happy path.** A valid assignment of an existing
  set of roles to an existing user persists the bindings and
  emits one `role.assigned` event per role.
- **AC-2 — Unknown user rejection.** An assignment against
  a non-existent user returns the typed user-not-found
  error and persists no state.
- **AC-3 — Unknown role rejection.** An assignment naming a
  non-existent role returns the typed role-not-found error
  and persists no state.
- **AC-4 — Bounded role count.** An assignment that would
  exceed `MaxRolesPerUser` returns the typed bounded-count
  error and persists no state.
- **AC-5 — Audit emission.** Each successful assignment
  emits exactly one `role.assigned` event per role; the
  payload includes `userID`, `roleID`, `roleName`, and the
  `AssignedBy` actor.
- **AC-6 — Idempotency on re-assignment.** Assigning a role
  the user already has is a no-op write at the database
  level (the unique index absorbs it); the audit event
  still fires for the explicit operator action.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `pk-modules/auth_management/features/permissions/service_test.go::TestService_AssignUserRoles_Success` (asserts `len(bus.Published()) == 1`). |
| AC-2 | Test | `pk-modules/auth_management/features/permissions/service_test.go::TestService_AssignUserRoles_UserNotFound`. |
| AC-3 | Test | `pk-modules/auth_management/features/permissions/service_test.go::TestService_AssignUserRoles_RoleNotFound`. |
| AC-4 | Test | `pk-modules/auth_management/features/permissions/service_test.go::TestService_AssignUserRoles_ExceedsMaxRoles`. |
| AC-5 | Test | `pk-modules/auth_management/features/permissions/service_test.go::TestService_AssignUserRoles_Success` exercises the recording event bus. |
| AC-6 | Inspection | The repository's UpdateRoles is a set-replace; reviewers verify duplicate role bindings collapse via the unique index. |

## Edge cases & unhappy paths

- **System role protection.** Some roles (`platform_admin`,
  `tenant_owner`) are flagged `IsSystem` and refuse
  user-assignment outside the operator surface. Reviewers
  verify the gate.
- **Cross-tenant role assignment.** Roles are tenant-scoped;
  the service rejects assignment of one tenant's role to
  another tenant's user with a typed cross-tenant error.
- **Concurrent assignment race.** Two simultaneous
  AssignUserRoles for the same user race on the bindings
  write; whichever lands second is the source of truth.
  The platform's role-binding semantics are
  "last-write-wins"; reviewers verify the trade-off
  remains acceptable for the operator surface.
- **Role deletion mid-assignment.** A role removed between
  validation and write returns the same role-not-found
  error on the write step; the platform refuses the
  partial state.

## Risk

- **Likelihood:** Medium — exercised at administrative cadence.
- **Impact:** High — defective role assignment grants
  unintended access.
- **Mitigations:** All-or-nothing semantic (AC-1), bounded
  count (AC-4), audit-per-bind (AC-5), system-role
  protection (edge case).

## Implements (cross-cutting)

- **REQ-001 — Multi-tenant isolation.** Roles tenant-scoped;
  assignment refuses cross-tenant.
- **REQ-004 — Audit per mutation.** AC-5 is the explicit
  audit trail.
- **REQ-005 — Fail-closed.** AC-2..AC-4 default-deny on
  precondition failure.

## Compliance mapping

| Control | Coverage |
|---|---|
| SOC2 CC6.3 | AC-1, AC-5 — role-based access control with audit trail. |
| ISO27001 A.9.2.3 | AC-1..AC-5 — formal privileged-access management. |
| NIST AC-2 | AC-1, AC-2, AC-5 — account-management lifecycle. |

## Satisfied by

- `pk-modules/auth_management/features/permissions/service.go::AssignUserRoles` —
  the entry point.
- `pk-modules/auth_management/features/permissions/adapters.go` — the
  repository wrappers.

## Related requirements

- [REQ-AUTH-004 — Permissions umbrella](./REQ-AUTH-004-permissions.md)
- [REQ-AUTH-040 — Permission check](./REQ-AUTH-040-permission-check.md) — the consumer of the role-bound permissions this assignment produces.
- [REQ-AUTH-005 — Policy](./REQ-AUTH-005-policy.md) — the higher-level ABAC layer.
- [REQ-USER-001 — User](./REQ-USER-001-user.md) — the record this assignment binds against.
