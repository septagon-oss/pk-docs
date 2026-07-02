---
id: REQ-USER-010
title: "User create persists a new identity record, emits the catalogued audit, and is uniquely identified by email + username"
status: Proposed
date: 2026-05-08
slug: req-user-010-user-create
category: user
ears_pattern: event-driven
priority: must
risk: high
verification_methods: [test]
compliance:
  - SOC2_CC6.1
  - ISO27001_A.9.2.1
  - GDPR_Art_5
satisfied_by:
  adr: [ADR-0007]
  conventions: [C-04, C-14]
implements_cross_cutting: [REQ-001, REQ-004, REQ-009]
refines: REQ-USER-001
type: doc
tags: [requirement, capability, user_management, user, create]
module: user_management
feature: user
capability: user_create
capability_kind: failure_mode
stakeholders:
  - operator (admin-driven user provisioning)
  - registration service (programmatic user creation)
  - compliance auditor (account-creation control)
---

# REQ USER-010 — User create

Status: **Proposed** (2026-05-08)

## Statement

**When** a caller invokes `Service.Create` with a populated
`*entities.User`, the user feature **shall** persist the record
through the wrapped `userService.Create`, increment the
`user.account.created` counter, and emit the catalogued
`user.create` audit event with the resulting identifier as the
target. **If** the underlying repository refuses the write
(uniqueness violation, validation failure, transport error), the
service **shall** emit `user.create.failed` with the error
message and propagate the typed error.

## Rationale

User creation is the foundation event in the identity timeline:
every audit row, role assignment, session, and notification down
the line is keyed on the identifier this call produces. Three
properties must hold:

1. **Audit on both branches.** Failure-only or success-only audit
   leaves an investigator with half a story. The catalogued
   event must fire on both — the failure event records the
   *attempted* email/username so security can trace
   reconnaissance attempts.
2. **Uniqueness is the repository's problem.** The service does
   not pre-check `email` or `username` before calling the
   repository — that's a TOCTOU race. The repository's
   uniqueness constraint is the source of truth; the service
   propagates the typed error verbatim.
3. **Caller's request body is trusted.** This entry point is
   *not* the public registration form (REQ-AUTH-020). It is the
   admin / programmatic surface — the caller is expected to have
   already validated the input. Field-level validation belongs
   to the caller.

## Acceptance criteria

- **AC-1 — Happy path persists + audits + counts.** A successful
  `Create` returns the persisted entity, increments
  `user.account.created`, and emits a `user.create` audit row
  with the resulting identifier and the original email/username
  in the metadata.
- **AC-2 — Failure path audits + propagates.** When the wrapped
  repository returns an error, `Create` emits
  `user.create.failed` with the error string and a
  `new_user` placeholder target, then returns the wrapped error
  (`fmt.Errorf("create user: %w", err)`).
- **AC-3 — Uniqueness deferred to repository.** The service does
  not read the user table before writing; the repository's
  uniqueness constraint on email or username is the only barrier
  to duplicates.
- **AC-4 — No password coupling.** The user-create call carries
  no password material; password binding is the credential
  writer's responsibility (REQ-AUTH-020 / `UserCredentialWriter`).
- **AC-5 — Metric is best-effort.** A nil-`metrics` field is a
  legal configuration; the create call does not panic and the
  audit + persist still happen.
- **AC-6 — Span coverage.** The operation is wrapped in a
  `user_service.Create` span for distributed-trace correlation.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `modules/platformkit-business-modules/user_management/features/user/service_test.go::TestService_Create` (success branch — asserts the audit recorder received `user.create`, the metric was incremented, and the entity was returned). |
| AC-2 | Test | `modules/platformkit-business-modules/user_management/features/user/service_test.go::TestService_Create` (failure-branch table case — asserts `user.create.failed` audit + wrapped error). |
| AC-3 | Inspection | `service_crud.go::Create` — no pre-read; the repository call is the single write path. |
| AC-4 | Inspection | `service_crud.go::Create` — signature is `(ctx, *entities.User)`; no password parameter. The credential-writer port is invoked separately by `register_user_service.go`. |
| AC-5 | Test | `modules/platformkit-business-modules/user_management/features/user/service_test.go::TestService_Create` (metrics-nil sub-case in test setup). |
| AC-6 | Inspection | `service_crud.go::Create` — `s.tracer.StartSpan` is the first statement. |

## Edge cases & unhappy paths

- **Repository returns nil entity on success.** The service
  records `user.create` with the literal `fmt.Sprintf("%v",
  userResult)` as target; consumers must not rely on a
  well-formed identifier in this case (a nil-as-interface bug).
- **Audit recorder failure.** A failure to write the audit row
  is silently dropped (`_ =` discard); persisting the user
  succeeded so the user lifecycle proceeds. The discrepancy
  surfaces in the recorder's own metrics.
- **Tenant context absent.** This surface does not enforce
  tenant scope — users live above the tenant in the entity
  hierarchy. Tenant binding happens at membership-creation time
  (REQ-TENANT-002).

## Risk

- **Likelihood:** Medium — exercised on every account creation
  (admin or programmatic).
- **Impact:** High — a corrupt user row poisons every downstream
  permission and audit join.
- **Mitigations:** Repository-side uniqueness (AC-3), audit on
  both branches (AC-1 + AC-2), no implicit field defaults at
  this layer.

## Implements (cross-cutting)

- **REQ-001 — Multi-tenant isolation.** Indirect: user records
  are tenant-agnostic; isolation lives in the membership table.
- **REQ-004 — Audit per mutation.** AC-1 + AC-2 are the
  catalogued events.
- **REQ-009 — Observability.** AC-1 emits the metric; AC-6 the
  span.

## Compliance mapping

| Control | Coverage |
|---|---|
| SOC2 CC6.1 (Logical access) | AC-3 — the uniqueness barrier prevents duplicate-identity vectors. |
| ISO27001 A.9.2.1 (User registration) | AC-1 + AC-2 — every create attempt is audited. |
| GDPR Art. 5 (Lawfulness, fairness, transparency) | AC-1 — the audit row is the personal-data-creation trail. |

## Satisfied by

- `modules/platformkit-business-modules/user_management/features/user/service_crud.go::Create` — orchestration.
- `modules/platformkit-business-modules/user_management/features/user/service_audit.go::createAuditEvent` — audit emission helper.

## Related requirements

- [REQ-USER-001 — User feature](./REQ-USER-001-user.md) — the umbrella this refines.
- [REQ-USER-011 — User update](./REQ-USER-011-user-update.md) — the partial-update counterpart.
- [REQ-USER-012 — User lifecycle](./REQ-USER-012-user-lifecycle.md) — the state-transition counterpart.
- [REQ-AUTH-020 — Account create](./REQ-AUTH-020-account-create.md) — the public registration path that calls into this surface.
