---
id: REQ-PORTS-010
title: "audit_management provides the platformkit-ports audit Recorder/Reader seam at authored contract versions"
status: Proposed
date: 2026-07-02
slug: req-ports-010-audit-port-provider
category: audit
ears_pattern: ubiquitous
priority: must
risk: medium
verification_methods: [test, inspection]
compliance:
  - SOC2_CC7.2
  - ISO27001_A.12.4
satisfied_by:
  adr: [ADR-0009]
  conventions: [C-14]
implements_cross_cutting: [REQ-002, REQ-004]
refines: REQ-PORTS-001
type: doc
tags: [requirement, capability, audit_management, audit_trail, ports]
module: platformkit_ports
feature: contract
capability: audit_port_provider
capability_kind: inter_module_contract
stakeholders:
  - every business module (records audit events through the thin seam)
  - platform-core (owns the platformkit-ports audit contract)
  - operator (queries recorded events cross-module)
---

# REQ PORTS-010 — Audit port provider

Status: **Proposed** (2026-07-02)

## Statement

The `audit_management` module **shall** provide the cross-module
audit seam defined in `platformkit-ports/audit` — `audit.Recorder`
and `audit.Reader` — as typed, versioned ports registered via
`standard.WithPortProvider` at the authored contract versions
(`audit.RecorderContract.Version`, `audit.ReaderContract.Version`,
both `1.0.0`). This is the ADR-0001 (platformkit-ports charter)
cut-over pilot: consumers depend on the thin seam, never on
`audit_management` implementation types.

The adapters **shall** map between the thin `audit.Event` and the
rich entity-shaped `ports.AuditEvent` under fixed conventions:

1. `Actor` = `"<actorType>:<actorID>"`, split on the **first**
   colon; a bare value with no colon is the actor ID.
2. `Resource` = `"<resourceType>/<resourceID>"`, split on the
   **last** slash, so a typed prefix like `"entity:post"` survives
   in the type half.
3. `Severity` carries over as the string form of
   `entities.AuditSeverity`; `Metadata` is a stringified
   (`%v`) projection of the entity metadata map, skipping nils.
4. Fields the thin seam does not carry keep the defaults from
   `ports.NewAuditEvent` (e.g. a blank thin `ID` keeps the
   generated entity ID).

`audit.Reader.Get` **shall** surface absence as
`ErrAuditEventNotFound` — the value-typed `audit.Event` seam has
no `(nil, nil)` convention. `audit.Reader.Query` **shall** project
the thin `audit.Filter` onto the backing `ports.AuditFilter`
(actor/resource ref splitting, time bounds, limit) and, because
the backing filter has no `TenantID` field, honour an explicit
`f.TenantID` by post-filtering the mapped results.

## Rationale

ADR-0001 (the platformkit-ports charter, in
`core/platformkit-ports/docs/ADR-0001-ports-charter.md`) makes
narrow port interfaces the only cross-module surface. The audit
seam is the pilot cut-over: recording and reading are separate
facets so a module depends on exactly the capability it uses, and
the provider is discovered through `module.PortVersionProvider`
so composition tooling can verify the contract version before the
graph boots.

The ref-splitting conventions are the load-bearing detail of this
adapter — a wrong split silently mis-attributes audit rows
(actor type lost, resource type folded into the ID), which
corrupts the compliance ledger without any error surfacing. The
`capability_kind: inter_module_contract` choice reflects that the
ACs here are contract-shape properties (versions, mapping,
not-found semantics) that no cross-cutting REQ can decide for
this seam.

## Acceptance criteria

- **AC-1 — Ports provided at authored versions.** The constructed
  module implements `module.PortVersionProvider` and its
  `ProvidedPorts()` contains the canonical keys for
  `audit.Recorder` and `audit.Reader` at version `1.0.0`.
- **AC-2 — Recorder thin-to-rich projection.** `Record` splits
  actor refs on the first colon and resource refs on the last
  slash onto the typed entity fields, carries severity, timestamp,
  tenant, and metadata over, and delegates to
  `ports.AuditRecorder.RecordAuditEvent`.
- **AC-3 — Reader rich-to-thin mapping and not-found contract.**
  `Get` composes `"type:id"` / `"type/id"` refs from the entity
  fields and returns `ErrAuditEventNotFound` when the backing
  service has no event for the requested ID.
- **AC-4 — Query filter projection and tenant post-filter.**
  `Query` maps action, limit, actor/resource refs, and From/To
  bounds onto `ports.AuditFilter`, and drops mapped results whose
  `TenantID` does not match an explicitly supplied `f.TenantID`.
- **AC-5 — Defaults preserved for uncarried fields.** A thin event
  with a blank `ID`, zero `At`, or blank `Severity` keeps the
  `ports.NewAuditEvent` defaults rather than overwriting them
  with zero values.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `modules/platformkit-business-modules/audit_management/ports_provider_test.go::TestModuleProvidesAuditPorts`. |
| AC-2 | Test | `modules/platformkit-business-modules/audit_management/ports_provider_test.go::TestAuditRecorderAdapter`. |
| AC-3 | Test | `modules/platformkit-business-modules/audit_management/ports_provider_test.go::TestAuditReaderAdapterGet`. |
| AC-4 | Test | `modules/platformkit-business-modules/audit_management/ports_provider_test.go::TestAuditReaderAdapterQuery`. |
| AC-5 | Inspection | `modules/platformkit-business-modules/audit_management/ports_provider.go::Record` — blank-ID / zero-time / blank-severity guards keep `ports.NewAuditEvent` defaults. Dedicated defaults-only test pending. |

## Edge cases & unhappy paths

- **Nil entities in query results.** The Reader adapter skips nil
  entries returned by the backing service, mirroring the
  defensive-filtering discipline of REQ-CHAT-010's list path.
- **Metadata values that are nil.** Skipped by
  `stringifyMetadata`; everything else renders with `%v`.
- **Actor with multiple colons.** Only the first colon splits;
  the remainder stays in the ID half. Callers composing exotic
  actor refs own the consequence.
- **Backing-service errors.** Propagated unwrapped — the seam
  adds the not-found sentinel only for the absence case.

## Risk

- **Likelihood:** Medium — every module that adopts the thin seam
  routes its audit traffic through these adapters.
- **Impact:** Medium — a mapping defect mis-attributes audit rows
  silently; version drift breaks composition-time port matching.
- **Mitigations:** AC-1 pins the authored versions; AC-2/AC-3
  pin the ref conventions in both directions.

## Implements (cross-cutting)

- **REQ-002 — Independently deployable modules.** AC-1 — consumers
  bind to the versioned port key, not to `audit_management` types.
- **REQ-004 — Audit event per mutation.** AC-2 — the thin seam is
  a recording path into the same ledger REQ-004 governs.

## Compliance mapping

| Control | Coverage |
|---|---|
| SOC2 CC7.2 (System monitoring) | AC-2 — cross-module recordings land in the audit ledger with attribution intact. |
| ISO27001 A.12.4 (Logging and monitoring) | AC-3 + AC-4 — recorded events are retrievable and tenant-filterable through the seam. |

## Satisfied by

- `modules/platformkit-business-modules/audit_management/ports_provider.go::registerAuditPorts, auditRecorderAdapter.Record, auditReaderAdapter.Get, auditReaderAdapter.Query, splitActorRef, splitResourceRef, stringifyMetadata`.
- `core/platformkit-ports/audit/audit.go` — the seam definition:
  `Recorder`, `Reader`, `Event`, `Filter`, and the authored
  `RecorderContract` / `ReaderContract`.

## Related requirements

- [REQ-AUDIT-001 — Audit trail](./REQ-AUDIT-001-audit-trail.md) —
  the feature umbrella whose service backs these adapters.
- [REQ-AUDIT-010 — Audit record](./REQ-AUDIT-010-audit-record.md) —
  the enrichment/signing pipeline every `Record` call lands in.
- [REQ-PORTS-020 — Tenancy port provider](./REQ-PORTS-020-tenancy-port-provider.md) —
  the sibling wave-1 port provider following the same pattern.

## References

- `core/platformkit-ports/docs/ADR-0001-ports-charter.md` — the
  platformkit-ports charter this cut-over pilots (external ADR
  namespace; distinct from this registry's ADR-0001).
