---
id: REQ-AUDIT-010
title: "Audit record enriches events from request context, signs them with HMAC, and persists on a detached timeout-bound context"
status: Proposed
date: 2026-05-08
slug: req-audit-010-audit-record
category: audit
ears_pattern: event-driven
priority: must
risk: critical
verification_methods: [test, analysis]
compliance:
  - SOC2_CC7.1
  - SOC2_CC7.2
  - ISO27001_A.12.4
  - ISO27001_A.12.4.2
  - GDPR_Art_30
satisfied_by:
  adr: [ADR-0009]
  conventions: [C-04, C-14]
implements_cross_cutting: [REQ-001, REQ-004, REQ-009]
refines: REQ-AUDIT-001
type: doc
tags: [requirement, capability, audit_management, audit_trail, record]
module: audit_management
feature: audit_trail
capability: audit_record
capability_kind: data_invariant
stakeholders:
  - every business module (audit emitter)
  - operator (incident responder)
  - compliance auditor (SOC2 / ISO / GDPR evidence)
---

# REQ AUDIT-010 — Audit record (with enrichment + signature)

Status: **Proposed** (2026-05-08)

## Statement

**When** a caller invokes
`AuditService.RecordAuditEvent(ctx, evt)`, the audit-trail
feature **shall**:

1. **Enrich** the event from the request context
   (`enrichAuditEventFromContext`) — fill empty fields
   only, **never** overwrite caller-supplied values. The
   enrichment populates request id, trace id, span id,
   session id, IP address, user agent, correlation id,
   tenant id, and user id when present in `ctx`;
2. **Normalise** the event (`normalizeAuditEvent`) — apply
   default values for severity / outcome / category when
   the caller left them blank;
3. **Sign** the event when a signing key is configured —
   compute `HMAC-SHA256` over
   `id|action|resourceID|tenantID|occurredAtRFC3339Nano|actorID`
   and store the hex-encoded signature in
   `metadata["signature"]`;
4. **Persist** through the repository on a *detached*
   `context.WithoutCancel(ctx)` derived context with a
   10-second timeout — so request cancellation does not
   race with the repository transaction;
5. **Tolerate** context-cancellation errors specifically:
   when the persist write returns `context.Canceled`,
   `context.DeadlineExceeded`, or a transaction
   already-committed/rolled-back error, the service
   **shall** Warn-log and return `nil` rather than
   surfacing the failure (REQ-014: graceful degradation
   under transient failure);
6. **Increment** `audit.entry.created` on persist
   success.

`RecordDomainEvent(ctx, evt)` **shall** be the alternative
entry point that ingests platform domain events into the
audit ledger by inferring `EventCategory`, `Action`,
`Operation`, `ResourceType`, `ResourceID`, `Severity`, and
`Outcome` from the event's type + payload before
delegating to `RecordAuditEvent`.

## Rationale

Audit is the platform's source of truth for "what happened,
who did it, when, on what resource". Three load-bearing
properties:

1. **Enrich, don't overwrite.** Callers that supply
   `ActorID` explicitly mean it (e.g. seeder scripts that
   record actions on behalf of an admin). The enrichment
   path fills empty fields only — explicit caller values
   always win. This is the single point of context-to-row
   propagation; without it every call site would have to
   thread tracing / session / IP / user agent through.
2. **Detached persistence context.** HTTP request contexts
   cancel the moment the response is sent. If the audit
   write rides the request context, every successful
   request that triggers an audit row races between
   "transaction commit" and "ctx cancel". The
   `context.WithoutCancel + 10s timeout` boundary
   guarantees the write either succeeds or times out
   cleanly.
3. **HMAC signature for tamper detection.** A signed
   audit row is the integrity witness — if a privileged
   intruder edits an audit row in the database directly,
   `VerifyEventIntegrity` (REQ-AUDIT-011) will detect the
   mismatch. The signature payload is the load-bearing
   subset; metadata is excluded so caller-supplied
   metadata changes don't invalidate the signature.

The cancellation-tolerance branch is a deliberate trade-off:
audit is best-effort under cancellation, because failing
the request because the audit write was canceled would
double-degrade the operator's experience.

## Acceptance criteria

- **AC-1 — Enrichment fills empty fields only.** A call
  with `ActorID="explicit"` and a context user "ctx-user"
  persists `ActorID="explicit"`; a call with `ActorID=""`
  persists `ActorID="ctx-user"`.
- **AC-2 — Normalise applies defaults.** A call with no
  severity / outcome / category persists with the
  documented defaults (informational / success / business
  respectively).
- **AC-3 — HMAC signature present when keyed.** A service
  configured with a signing key persists the row with
  `metadata["signature"]` populated; without a key, no
  signature is added.
- **AC-4 — Detached persistence context.** A canceled
  request context still allows the write to proceed under
  the 10-second timeout; verified by spy repo whose
  `Create` checks `ctx.Err() == nil` at call time.
- **AC-5 — Context-cancel errors tolerated.** A repository
  Create that returns `context.Canceled` /
  `context.DeadlineExceeded` / "transaction has already
  been committed" produces a Warn log and a `nil` error
  return.
- **AC-6 — Other persistence errors propagate.** A
  unique-constraint violation returns the wrapped error
  with an Error log.
- **AC-7 — Counter on success only.** `audit.entry.created`
  increments only when the write returns nil.
- **AC-8 — Domain-event inference.** A
  `RecordDomainEvent` call with type
  `"user.created"` populates `Action`, `Operation`,
  `ResourceType`, `ResourceID`, `EventCategory`,
  `Severity`, `Outcome` via the inferer helpers and
  delegates to `RecordAuditEvent`.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `pk-modules/audit_management/features/audit_trail/service_test.go::TestRecordAuditEvent_EnrichesFromRequestContext` and `TestRecordAuditEvent_EnrichmentNeverOverwritesCallerValues`. |
| AC-2 | Inspection | `service.go::normalizeAuditEvent` — applies severity / outcome / category defaults when blank. The path is exercised through `TestRecordAuditEvent_Success`; dedicated defaults-only test pending. |
| AC-3 | Test | `pk-modules/audit_management/features/audit_trail/service_test.go::TestSigningKey_SignsAndVerifies` (signed-when-keyed branch) and `TestSigningKey_NoKeySkipsVerification` (unsigned branch). |
| AC-4 | Inspection | `service.go::RecordAuditEvent` lines 117–119 — `context.WithoutCancel` + 10-second timeout on the persist context. Dedicated request-cancel-survives test pending. |
| AC-5 | Inspection | `service.go::RecordAuditEvent` lines 122–129 + `isContextRelatedAuditWriteError` lines 150–161 — Warn-and-return-nil for context.Canceled / DeadlineExceeded / "transaction has already been committed". Dedicated test pending. |
| AC-6 | Test | `pk-modules/audit_management/features/audit_trail/service_test.go::TestRecordAuditEvent_RepositoryError` — non-context errors propagate wrapped. |
| AC-7 | Test | `pk-modules/audit_management/features/audit_trail/service_test.go::TestRecordAuditEvent_Success` (counter increments) and `TestRecordAuditEvent_NilMetrics` (nil-metrics safety). The counter-on-success-only branch is at `service.go::RecordAuditEvent` lines 137–139. |
| AC-8 | Inspection | `service.go::RecordDomainEvent` lines 164–250 — type-prefix-based inference of `EventCategory`, `Action`, `Operation`, `ResourceType`, etc. Dedicated end-to-end inference test pending. |

## Edge cases & unhappy paths

- **Empty signing key.** No signature is added; the row is
  persisted unsigned. `VerifyEventIntegrity` returns true
  for unsigned rows (the verifier cannot witness what is
  not configured).
- **Tenant id absent in both event and context.** The
  persisted row has empty `TenantID`; queries by tenant
  miss it. Documented; the audit consumer expects this
  for system-level events (e.g. background jobs without
  tenant context).
- **Domain event with no payload map.** Treated as empty
  map; inference uses defaults from the event type alone.
- **Skipped domain event types.** `shouldSkipDomainEvent`
  filters out internal types (e.g. `"audit.entry.created"`
  itself) to prevent infinite recursion.
- **Repository panic.** Not recovered here; bubbles up to
  the caller. Recovery is the caller's middleware concern.

## Risk

- **Likelihood:** Critical — every business-module mutation
  emits an audit row.
- **Impact:** Critical — a missing audit row breaks every
  compliance control that rests on the ledger.
- **Mitigations:** Detached persistence (AC-4),
  cancel-tolerance (AC-5), HMAC signature (AC-3),
  enrichment that never overwrites (AC-1).

## Implements (cross-cutting)

- **REQ-001 — Multi-tenant isolation.** AC-1 + AC-8 —
  tenant binding propagated from context.
- **REQ-004 — Audit per mutation.** This REQ is the
  enforcement vehicle.
- **REQ-009 — Observability.** AC-7 — counter on success.

## Compliance mapping

| Control | Coverage |
|---|---|
| SOC2 CC7.1 (System operations) | AC-7 — every mutation produces an audit row. |
| SOC2 CC7.2 (System monitoring) | AC-1 + AC-8 — observability triple captured per row. |
| ISO27001 A.12.4 (Logging and monitoring) | AC-1 — enrichment captures the attribution surface. |
| ISO27001 A.12.4.2 (Protection of log information) | AC-3 — HMAC signature is the tamper witness. |
| GDPR Art. 30 (Records of processing) | AC-1 + AC-3 — signed records with attribution chain. |

## Satisfied by

- `pk-modules/audit_management/features/audit_trail/service.go::RecordAuditEvent, RecordDomainEvent, signEvent, enrichAuditEventFromContext, normalizeAuditEvent, isContextRelatedAuditWriteError`.

## Related requirements

- [REQ-AUDIT-001 — Audit trail](./REQ-AUDIT-001-audit-trail.md)
- [REQ-AUDIT-011 — Audit query + integrity verify](./REQ-AUDIT-011-audit-query-integrity.md) — the read-side and tamper-check counterpart.
- [REQ-AUDIT-012 — Audit retention + cleanup](./REQ-AUDIT-012-audit-retention-cleanup.md) — the periodic cleanup that consumes the records this surface produces.
