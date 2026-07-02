---
id: REQ-USER-011
title: "User update applies a sparse partial DTO and audits the before/after pair on every mutation"
status: Proposed
date: 2026-05-08
slug: req-user-011-user-update
category: user
ears_pattern: event-driven
priority: must
risk: high
verification_methods: [test]
compliance:
  - SOC2_CC6.1
  - SOC2_CC8.1
  - ISO27001_A.12.4
  - GDPR_Art_30
satisfied_by:
  adr: [ADR-0007]
  conventions: [C-04, C-14]
implements_cross_cutting: [REQ-001, REQ-004, REQ-009]
refines: REQ-USER-001
type: doc
tags: [requirement, capability, user_management, user, update]
module: user_management
feature: user
capability: user_update
capability_kind: data_invariant
stakeholders:
  - user (self-service profile edit consumer)
  - operator (admin-driven user edits)
  - compliance auditor (change-tracking control)
---

# REQ USER-011 — User update

Status: **Proposed** (2026-05-08)

## Statement

**When** a caller invokes `Service.UpdateUser(userID,
ports.UserUpdate)`, the user feature **shall**:

1. Read the *pre-image* via `userService.GetUser` so the audit
   row carries the before-state;
2. Apply the sparse partial DTO — every field is a typed pointer
   (`*string`, `*UserStatus`, `*time.Time`); a nil pointer
   leaves the field untouched, a non-nil pointer is the
   authoritative new value;
3. Persist the result through the wrapped `userService.UpdateUser`;
4. Increment `user.account.updated` and emit `user.update` with
   the (oldUser, newUser) pair in the audit row's `before`/`after`
   fields.

**If** the read fails the operation continues with a `nil`
pre-image (a soft-fail — the update should not be blocked by an
audit-fetch hiccup). **If** the persist fails the service emits
`user.update.failed` with the `nil`/`oldUser` pair and propagates
the typed error.

## Rationale

The "what changed" auditability is the load-bearing property of
this surface — without the before-image, the audit row says only
"someone edited user X" without showing *what* moved. The sparse
partial DTO is the conventional shape for HTTP `PATCH`-style
edits — pointer-or-nil distinguishes "set to empty" from "do not
touch", a discrimination string-fields alone cannot make.

Three structural decisions:

1. **Pre-image fetch is best-effort.** A repository read that
   fails for transient reasons (DB blip, transient network) must
   not block the legitimate update — the audit row degrades to
   "after-only" and the discrepancy is logged at Error.
2. **Failure audit even with no pre-image.** If both the read
   and the write fail, the audit row still goes out (with
   `nil`/`nil`) so the failed-attempt metric is consistent.
3. **Sparse DTO ≠ entity replacement.** The wrapping `Update`
   variant (`Service.Update(ctx, *User)`) is the entity-replace
   form for the GenericService interface; this DTO form is what
   the HTTP handler / RPC client should use.

## Acceptance criteria

- **AC-1 — Happy path applies + audits before/after.** A
  populated `UserUpdate` returns the persisted entity,
  increments `user.account.updated`, and emits `user.update`
  with the pre-fetched user in the `before` field and the
  post-write user in the `after` field.
- **AC-2 — Sparse DTO honours nil semantics.** A `UserUpdate`
  with only `Email` set leaves `Status`, `Username`, etc.
  untouched on the resulting entity (verified by checking the
  before/after diff in audit-row metadata).
- **AC-3 — Pre-image fetch failure soft-fails.** When
  `GetUser` returns an error, the operation logs at Error and
  continues; the audit row records `nil` in `before` and the
  successful after-state in `after`.
- **AC-4 — Persist failure path audits + propagates.** A
  repository write error emits `user.update.failed` with
  `before=oldUser` and the wrapped error
  (`fmt.Errorf("update user %s: %w", userID, err)`).
- **AC-5 — Metric is best-effort.** A nil-`metrics` field does
  not panic; the audit and persist still happen.
- **AC-6 — Email + username in audit metadata.** The success
  audit's `metadata` carries the post-image email and username
  so the audit ledger is searchable by identity-shape changes
  even when the `before`/`after` payloads are large.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `modules/platformkit-business-modules/user_management/features/user/service_test.go::TestService_UpdateUser` (asserts the audit recorder saw `user.update` with both before/after; metric incremented). |
| AC-2 | Test | `modules/platformkit-business-modules/user_management/features/user/service_test.go::TestService_UpdateUser` (sparse-fields case — only `Email` set, asserts other fields preserved). |
| AC-3 | Test | `modules/platformkit-business-modules/user_management/features/user/service_test.go::TestService_UpdateUser` (pre-image-error sub-case — wrapped service returns error on `GetUser`, the update still proceeds and the audit row's `before` is `nil`). |
| AC-4 | Test | `modules/platformkit-business-modules/user_management/features/user/service_test.go::TestService_UpdateUser` (persist-error sub-case — asserts `user.update.failed` audit + wrapped error). |
| AC-5 | Test | `modules/platformkit-business-modules/user_management/features/user/service_test.go::TestService_UpdateUser` (metrics-nil sub-case). |
| AC-6 | Inspection | `service_crud.go::UpdateUser` — the metadata map includes `email` and `username` from the post-image. |

## Edge cases & unhappy paths

- **All-nil DTO.** A `UserUpdate{}` with every field nil is a
  legal no-op. The audit row still fires with identical
  before/after (the `_ =` discard ensures the recorder is
  untroubled).
- **Concurrent update.** Last-write-wins at the repository; the
  before-image is the *read-time* state and may be staler than
  the actual pre-write state. This is a known limitation
  documented for the audit consumer.
- **Username uniqueness collision.** A repository-side uniqueness
  failure surfaces as the `update.failed` audit; the service
  does not pre-check.
- **Identifier change attempts.** The DTO does not expose `ID`,
  so callers cannot rename a user; rename / merge is an
  out-of-band administrative operation.
- **Audit recorder failure.** Like create, audit failures are
  silently dropped — the user mutation is the source of truth.

## Risk

- **Likelihood:** High — exercised on every profile edit and
  admin user-management mutation.
- **Impact:** High — a missing audit row breaks SOC2 / ISO change
  tracking; a failed write that succeeds in audit creates a
  false-positive incident.
- **Mitigations:** Pre-image read (AC-1) + soft-fail (AC-3) +
  paired before/after (AC-1) + failure audit (AC-4) close the
  observable-change-tracking gap.

## Implements (cross-cutting)

- **REQ-001 — Multi-tenant isolation.** Indirect: identity edits
  do not cross tenants; tenant-bound state lives in the
  membership table (REQ-TENANT-002).
- **REQ-004 — Audit per mutation.** AC-1 + AC-4 are the
  catalogued audit events with full before/after.
- **REQ-009 — Observability.** AC-1 emits the metric; the
  underlying span (in service_crud.go) provides the trace
  correlation.

## Compliance mapping

| Control | Coverage |
|---|---|
| SOC2 CC6.1 (Logical access) | AC-1 + AC-4 — every mutation attempt audited. |
| SOC2 CC8.1 (Change management) | AC-1 — paired before/after enables change reconstruction. |
| ISO27001 A.12.4 (Logging) | AC-1 + AC-4 — the audit ledger is the event log of record. |
| GDPR Art. 30 (Records of processing) | AC-1 — change records of personal data with before/after state. |

## Satisfied by

- `modules/platformkit-business-modules/user_management/features/user/service_crud.go::UpdateUser` — sparse-DTO surface.
- `modules/platformkit-business-modules/user_management/features/user/service_crud.go::Update` — entity-replace surface.
- `modules/platformkit-business-modules/user_management/features/user/service_audit.go::createAuditEvent` — audit emission helper.

## Related requirements

- [REQ-USER-001 — User feature](./REQ-USER-001-user.md) — the umbrella this refines.
- [REQ-USER-010 — User create](./REQ-USER-010-user-create.md) — the create-pair counterpart.
- [REQ-USER-012 — User lifecycle](./REQ-USER-012-user-lifecycle.md) — the state-machine counterpart that uses dedicated audit events.
- [REQ-USER-002 — Profile feature](./REQ-USER-002-profile.md) — the profile surface that is updated by analogous PATCH semantics.
