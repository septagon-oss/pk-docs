---
id: REQ-PORTS-016
title: "The structured-log audit adapter emits complete, deterministic audit records"
status: Proposed
date: 2026-07-15
slug: req-ports-016-structured-log-audit-adapter
category: audit
ears_pattern: event-driven
priority: should
risk: medium
verification_methods: [test]
satisfied_by:
  adr: [ADR-0009, ADR-0021]
  conventions: [C-14]
implements_cross_cutting: [REQ-004, REQ-009, REQ-015]
refines: REQ-PORTS-001
type: doc
tags: [requirement, capability, ports, adapter, audit, slog]
module: platformkit_ports
feature: contract_identity
capability: structured_log_audit_adapter
capability_kind: inter_module_contract
---

# REQ PORTS-016 — Structured-log audit adapter

Status: **Proposed** (2026-07-15)

## Statement

**When** the `slogaudit` adapter records an `audit.Event`, it **shall** emit one
structured info record carrying every canonical audit field and namespaced
metadata in deterministic key order; a canceled context **shall** fail with a
portable unavailable error instead of logging the event.

## Rationale

Development and log-pipeline-backed installations rely on structured logs as
their audit sink. Stable field names and ordering make output reproducible and
machine-consumable; cancellation prevents a caller-abandoned operation from
producing misleading evidence.

## Acceptance criteria

- **AC-1 — Port conformance.** The adapter passes the shared recorder suite,
  including cancellation and concurrent use.
- **AC-2 — Complete structured record.** Canonical audit identity, tenant,
  actor, action, resource, severity, time, and `audit.meta.*` fields are emitted
  as one structured record.
- **AC-3 — Deterministic metadata.** Arbitrary metadata map insertion order
  produces lexically ordered structured attributes.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `core/platformkit-adapters/slogaudit/slogaudit_test.go::TestPassesRecorderConformance`. |
| AC-2 | Test | `core/platformkit-adapters/slogaudit/slogaudit_test.go::TestRecordEmitsStructuredFields`. |
| AC-3 | Test | `core/platformkit-adapters/slogaudit/slogaudit_test.go::TestRecordOrdersMetadataFields`. |

## Satisfied by

- `core/platformkit-adapters/slogaudit`.
- `core/platformkit-ports/audit/audittest`.
