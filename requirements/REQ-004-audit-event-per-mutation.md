---
id: REQ-004
title: "Every entity mutation produces an audit event"
status: Active
date: 2026-05-06
slug: req-004-audit-event-per-mutation
category: audit
ears_pattern: ubiquitous
verification_methods:
  - test
  - inspection
compliance:
  - SOC2_CC7.2
  - ISO27001_A.12.4
satisfied_by:
  adr: [ADR-0007]
  conventions: [C-14]
type: doc
tags: [requirement, audit, compliance]
---

# REQ 004 — Every entity mutation produces an audit event

Status: **Active** (2026-05-06)

## Statement

The system **shall** emit an audit event through `ports.AuditBoundaryRecorder`
for every successful or failed entity-creating, entity-modifying, or
entity-deleting service call, capturing actor, tenant, resource type,
resource ID, before/after data (where applicable), and an outcome marker.

## Rationale

Auditability is contractual for every enterprise tenant we sell to, and
regulatory under several of the compliance regimes the platform claims
to support (SOC 2 Type II, ISO 27001 Annex A.12.4, HIPAA §164.308(a)(1)(ii)(D)).
The audit log is the authoritative record of who did what, when, and to
which entity — including the negative cases (the attempted mutation
that failed authorisation).

The property has to hold across every call site that mutates an entity,
not just the "well-behaved" ones. Call sites that bypass the audit
boundary leave gaps the auditor can't see — and the auditor can't see
what isn't there. The discipline is that the service layer wraps every
mutation in audit emission as a peer of the persistence operation, not
as an afterthought.

## Acceptance criteria

- **AC-1** Every method on a service struct that creates, updates, or
  deletes an entity emits exactly one audit event on success and one
  on failure. The success event carries the after-snapshot; the
  failure event carries the supplied error.
- **AC-2** The audit DTO carries actor (with optional name + email),
  tenant, resource type, resource ID, severity, outcome, action,
  metadata, and JSON-encoded before/after snapshots with heavy
  associations stripped (Sessions, Roles, Preferences, Profile).
- **AC-3** Audit-recording failures are logged but do not fail the
  underlying operation — the service-layer call is best-effort at
  the audit-emit step; durability is provided by the boundary
  recorder's transactional outbox (ADR-0007).
- **AC-4** A mutation reaching persistence without a corresponding
  audit event surfaces as a "no audit row" indicator in the admin
  audit explorer.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `modules/platformkit-business-modules/user_management/features/user/service_test.go::TestService_UpdateUser` and `TestService_Update` — both branches (success / failure) assert the audit recorder receives `user.update` / `user.update.failed` with full pre/post-image. The same pattern is exercised by `TestService_Create` and lifecycle tests (`TestService_Activate`, `TestService_Suspend`, `TestService_DeactivateUser`). |
| AC-2 | Test | `modules/platformkit-business-modules/audit_management/features/audit_trail/service_test.go::TestRecordAuditEvent_Success` exercises the audit envelope normalisation; `TestRecordAuditEvent_EnrichesFromRequestContext` covers the context-derived fields. **Verification gap: a dedicated heavy-association-stripping test is pending.** |
| AC-3 | Inspection | The audit-emit pattern in `service_crud.go` and `service_lifecycle.go` uses `_ = s.createAuditEvent(...)` so audit failures cannot fail the underlying operation. Discipline enforced by code review; dedicated test pending. |
| AC-4 | Inspection | `audit_management/features/audit_trail/table_handler_render_detail.go` — admin UI renders a "no audit row" indicator when the lookup misses. |

## Satisfied by

- [ADR 0007 — Transactional outbox for event delivery](../adr/0007-transactional-outbox-for-event-delivery.md) —
  the durability layer that turns the best-effort emit into a
  guaranteed write.
- [Convention C-14 — Every Go file declares its purpose](../conventions.md#c-14-every-go-file-declares-its-purpose) —
  the discipline that pins each audit-wrapping file to this REQ.
- `modules/platformkit-business-modules/user_management/features/user/service_audit.go` —
  the canonical audit-by-wrapping pattern.

## Compliance traceability

- **SOC2_CC7.2** — system operations: monitoring + auditing.
- **ISO27001_A.12.4** — logging and monitoring.

## Related requirements

- [REQ-007 — Cross-tenant access is explicit and labelled](./REQ-007-explicit-cross-tenant-access.md) —
  cross-tenant audit reads carry the same labelling so the audit
  trail is itself auditable.

## References

- SOC 2 Trust Services Criteria, CC7.2.
- `audit_management/features/audit_trail/` — the operator UI.
