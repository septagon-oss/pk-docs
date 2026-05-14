---
id: REQ-AUDIT-002
title: "Audit events feature exposes the typed-event vocabulary downstream modules emit"
status: Proposed
date: 2026-05-07
slug: req-audit-002-audit-events
category: audit
ears_pattern: ubiquitous
verification_methods: [inspection]
compliance: [SOC2_CC7.2, ISO27001_A.12.4]
satisfied_by:
  adr: [ADR-0007]
  conventions: [C-04, C-14]
implements_cross_cutting: [REQ-004]
type: doc
tags: [requirement, feature, audit_management]
module: audit_management
feature: audit_events
---

# REQ AUDIT-002 — Audit events

Status: **Proposed** (2026-05-07)

## Statement

The audit events feature **shall** declare the typed event
vocabulary the platform records — the catalogue of action labels
(`auth.user.authenticated`, `tenant.created`, `policy.change_request.approved`,
…) and the schema each one carries. Other modules **shall not**
invent ad-hoc audit action strings; they **shall** select from this
vocabulary or extend it via a deliberate addition reviewed at PR
time.

## Rationale

A consistent vocabulary is what makes the audit trail searchable
across ten years of records and across modules that came and went
during that time. Each module inventing its own free-form action
strings would mean every compliance query becomes a string-match
exercise across spelling variants. The vocabulary is small, audited,
and grows by review.

## Acceptance criteria

- **AC-1** The vocabulary lives in this feature (entity declarations
  + permission set), not in each downstream module's local code.
- **AC-2** Adding a new action label is a documented PR step that
  updates the catalogue and the module's `Emits(...)` declaration so
  `make check-module-port-event-audit` flags the change.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Inspection | `audit_management/features/audit_events/permissions.go` and the entity-level enums declare the vocabulary; downstream modules' `Emits(...)` calls reference these values. |
| AC-2 | Inspection | `make check-module-port-event-audit` (in `pk-modules`) verifies emitted events match the catalogue. |

## Implements (cross-cutting)

- REQ-004 — audit per mutation (this feature underwrites the action vocabulary).

## Satisfied by

- `audit_management/features/audit_events/feature.go`
- `audit_management/features/audit_events/permissions.go`,
  `routes.go`, `e2e.go`

## Related requirements

- [REQ-AUDIT-001 — Audit trail](./REQ-AUDIT-001-audit-trail.md) — the persistence layer that records these events.
