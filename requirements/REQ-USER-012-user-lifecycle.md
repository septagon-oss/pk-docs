---
id: REQ-USER-012
title: "User lifecycle transitions emit per-state catalogued audit events and tolerate the wrapped repository's idempotency"
status: Proposed
date: 2026-05-08
slug: req-user-012-user-lifecycle
category: user
ears_pattern: event-driven
priority: must
risk: high
verification_methods: [test]
compliance:
  - SOC2_CC6.1
  - SOC2_CC6.7
  - ISO27001_A.9.2.1
  - ISO27001_A.9.2.6
satisfied_by:
  adr: [ADR-0007]
  conventions: [C-04, C-14]
implements_cross_cutting: [REQ-001, REQ-004, REQ-005, REQ-009]
refines: REQ-USER-001
type: doc
tags: [requirement, capability, user_management, user, lifecycle]
module: user_management
feature: user
capability: user_lifecycle
capability_kind: state_machine
stakeholders:
  - operator (account suspension / re-activation)
  - compliance auditor (account-status timeline)
  - support engineer (account-state troubleshooting)
---

# REQ USER-012 — User lifecycle

Status: **Proposed** (2026-05-08)

## Statement

**When** an operator invokes `Service.Activate`, `Deactivate`,
`Suspend`, `Unsuspend`, `ReactivateUser`, or `DeactivateUser` on
a target user id, the user feature **shall** delegate to the
wrapped repository's matching method, emit the per-state
catalogued audit event (`user.activate`, `user.deactivate`,
`user.suspend`, `user.unsuspend`, `user.reactivate`) on success,
and emit the matching `*.failed` event with the underlying error
on failure.

`Activate` **shall** additionally increment the
`user.account.activated` metric. `Suspend` and `DeactivateUser`
**shall** carry the operator-supplied `reason` in the audit
metadata so post-incident review can reconstruct the
justification chain.

## Rationale

The user-state lifecycle is the platform's account-control
surface: every authenticated request gates on it (REQ-AUTH-010
AC-2), so a missed transition or a missing audit row breaks the
compliance story for "we knew the account was suspended". Three
properties:

1. **Per-state audit, not generic.** The catalogued events are
   distinct (`user.activate` vs `user.suspend`) so the audit
   timeline is queryable by transition type without parsing
   metadata. This matches REQ-004's "specific event per
   mutation" discipline.
2. **Reason capture.** Suspension and forced-deactivation are
   typically *human* operator actions — the `reason` field is
   the institutional memory for why the account was
   pulled. SOC2 / ISO27001 access-removal controls require this
   trail.
3. **Repository idempotency is delegated.** Activating an
   already-active user is the repository's call to make
   (no-op vs error vs metric-only); the service layer's
   responsibility is to faithfully audit whatever the
   repository decided. This is REQ-005-aligned: when the
   wrapped layer says "no", we say "no" too.

The set has duplicate-by-design pairs (`Deactivate` and
`DeactivateUser`, `Activate` and `ReactivateUser`) reflecting two
historical entry points (the V1 management-service surface and
the platform-wide PortService surface). They share an audit-event
namespace (both deactivate variants emit `user.deactivate`) so
the audit ledger is uniform.

## Acceptance criteria

- **AC-1 — Activate emits + counts.** A successful `Activate`
  call emits `user.activate` and increments
  `user.account.activated`; a failure emits
  `user.activate.failed` and propagates the wrapped error.
- **AC-2 — Deactivate (both variants) emit user.deactivate.**
  Both `Deactivate(userID)` and `DeactivateUser(userID, reason)`
  emit the same `user.deactivate` audit family on success and
  `user.deactivate.failed` on failure; the
  `DeactivateUser` variant carries `reason` in metadata.
- **AC-3 — Suspend captures reason.** A successful `Suspend`
  emits `user.suspend` with `reason` in metadata; a failure
  emits `user.suspend.failed` with both `error` and `reason`
  in metadata so the failed-attempt timeline is searchable.
- **AC-4 — Unsuspend / Reactivate emit + propagate.** Both
  emit their per-state event on success and the matching
  `*.failed` on failure; both wrap the error in
  `fmt.Errorf("…user %s: %w", userID, err)`.
- **AC-5 — All transitions are span-wrapped.** Every method
  starts a `user_service.<TransitionName>` span via the
  injected tracer; failures and successes share the span.
- **AC-6 — Metric hooks are best-effort.** A nil-`metrics`
  field does not panic; the audit and persist still happen.
- **AC-7 — No reason laundering.** `Activate` and `Unsuspend`
  intentionally do not accept a reason — the operator action
  is unambiguous (re-enable). Any caller-supplied reason is
  out-of-band metadata, not REQ scope.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `modules/platformkit-business-modules/user_management/features/user/service_test.go::TestService_Activate` (success + failure + metric assertions). |
| AC-2 | Test | `modules/platformkit-business-modules/user_management/features/user/service_test.go::TestService_Deactivate` and `TestService_DeactivateUser` (both emit `user.deactivate`; only the variant carries `reason`). |
| AC-3 | Test | `modules/platformkit-business-modules/user_management/features/user/service_test.go::TestService_Suspend` (success: reason in metadata; failure: error + reason in metadata). |
| AC-4 | Test | `modules/platformkit-business-modules/user_management/features/user/service_test.go::TestService_Unsuspend` and `TestService_ReactivateUser` (success + failure paths). |
| AC-5 | Inspection | `service_lifecycle.go` — every method opens with `s.tracer.StartSpan(ctx, "user_service.<Name>")`. |
| AC-6 | Test | `modules/platformkit-business-modules/user_management/features/user/service_test.go::TestNewService` — the test setup omits the metrics dependency in nil-metric sub-cases. |
| AC-7 | Inspection | `service_lifecycle.go::Activate`, `Unsuspend`, `ReactivateUser` — no `reason` parameter. |

## Edge cases & unhappy paths

- **Activate on an already-active user.** The repository's
  contract decides — current implementation no-ops at the DB
  level but still emits the audit + metric, so the timeline
  reads "activate(noop)". Acceptable; the ledger reflects the
  *attempt*.
- **Suspend with empty reason.** The reason field is the
  caller's responsibility; the service does not validate
  non-emptiness. An empty reason is a UX defect upstream, not a
  service-layer bug.
- **Suspend on a deleted user.** The repository will error
  (`ErrUserNotFound`); the service emits `user.suspend.failed`
  with the not-found error.
- **Repository transient error then success.** The transient
  error path emits `*.failed`; if the operator retries and it
  succeeds, the success event also fires. Both rows live in
  the timeline — the audit ledger is append-only.
- **Race against a concurrent rename.** Lifecycle transitions
  do not read the user row before writing; rename ↔ suspend
  races are last-write-wins at the repository.
- **Audit recorder outage.** Audit failures are silently
  discarded (the `_ =` discard). The lifecycle transition still
  succeeds; the missing row surfaces in the audit recorder's
  own metrics.

## Risk

- **Likelihood:** Medium — exercised on every operator-driven
  account action (suspend after fraud signal, deactivate at
  off-boarding).
- **Impact:** High — a missed `user.suspend` audit row breaks
  SOC2 access-removal evidence; a missed status change leaves
  a known-bad account active.
- **Mitigations:** Per-state catalogued events (AC-1..AC-4),
  reason-bearing audit on punitive transitions (AC-3),
  span-wrapped trace coverage (AC-5).

## Implements (cross-cutting)

- **REQ-001 — Multi-tenant isolation.** Indirect: lifecycle is
  identity-scoped, not tenant-scoped; tenant-side
  membership-revoke is REQ-TENANT-002.
- **REQ-004 — Audit per mutation.** AC-1..AC-4 emit per-state
  catalogued events on every transition.
- **REQ-005 — Fail-closed.** When the repository refuses, the
  service propagates the typed error; no silent recovery.
- **REQ-009 — Observability.** AC-5 (spans) + AC-1 (metric).

## Compliance mapping

| Control | Coverage |
|---|---|
| SOC2 CC6.1 (Logical access) | AC-2..AC-3 — suspend / deactivate are the access-removal controls. |
| SOC2 CC6.7 (Restrict information access) | AC-3 — suspended users cannot mint sessions (REQ-AUTH-010 AC-2). |
| ISO27001 A.9.2.1 (User registration) | AC-1 — activation closes the registration loop. |
| ISO27001 A.9.2.6 (Removal/adjustment of access rights) | AC-2 + AC-3 — captured per transition. |

## Satisfied by

- `modules/platformkit-business-modules/user_management/features/user/service_lifecycle.go::Activate, Deactivate, Suspend, Unsuspend, ReactivateUser, DeactivateUser` — the per-transition orchestration.
- `modules/platformkit-business-modules/user_management/features/user/service_audit.go::createAuditEvent` — audit emission helper.

## Related requirements

- [REQ-USER-001 — User feature](./REQ-USER-001-user.md) — the umbrella this refines.
- [REQ-USER-010 — User create](./REQ-USER-010-user-create.md) — the inception event of the lifecycle.
- [REQ-USER-011 — User update](./REQ-USER-011-user-update.md) — the field-edit counterpart.
- [REQ-AUTH-010 — Login credentials](./REQ-AUTH-010-login-credentials.md) — AC-2 is the consumer that gates on `inactive` / `suspended` / `pending_verification`.
- [REQ-AUTH-021 — Email verification](./REQ-AUTH-021-email-verification.md) — the activation companion that flips `pending_verification` → `active`.
