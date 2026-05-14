---
id: REQ-AUDIT-006
title: "Digital signature feature signs disclosed audit artefacts so external parties can verify authenticity"
status: Proposed
date: 2026-05-07
slug: req-audit-006-digital-signature
category: audit
ears_pattern: ubiquitous
verification_methods: [inspection]
compliance: [SOC2_CC7.2, ISO27001_A.12.4]
satisfied_by:
  adr: [ADR-0007]
  conventions: [C-14]
implements_cross_cutting: [REQ-004, REQ-010]
type: doc
tags: [requirement, feature, audit_management]
module: audit_management
feature: digital_signature
---

# REQ AUDIT-006 — Digital signature

Status: **Proposed** (2026-05-07)

## Statement

The digital signature feature **shall** expose admin endpoints
for signing document payloads
(`POST /api/v1/audit/signatures/sign`), verifying signatures
(`POST /api/v1/audit/signatures/verify`), and listing the
persisted signature records for a signer or document scope
(`GET /api/v1/audit/signatures`). Signing keys **shall** live in
the platform's configuration plane and never appear in source.

## Rationale

A regulator or customer who receives a CSV of audit records has no
way to verify the file was produced by us versus tampered with in
transit unless we sign it. Detached signatures (separate `.sig`
file rather than embedded headers) keep the disclosed payload
unchanged so it remains parsable by standard tools while still
carrying a verification path. Key management in the configuration
plane keeps the signing key out of the codebase and on a rotation
cadence operators control.

## Acceptance criteria

- **AC-1** The feature exposes the three admin operations
  (sign / verify / list) under `/api/v1/audit/signatures*`, each
  permission-gated through `featurePermissions()`.
- **AC-2** Signing keys are sourced from the runtime configuration
  surface (REQ-010); reviewers `grep` for PEM-encoded private
  keys in source and confirm none are embedded.

## Known gaps

- **Reproducibility + key-rotation guarantees are not asserted at
  this REQ** — they depend on the chosen signing implementation
  inside the `KeyManagementService` and the signer adapter.
  Reviewers consult the implementation when those properties
  matter for a specific deployment.
- **No `*_test.go` exists for `digital_signature/`** —
  verification is inspection-only.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Inspection | `digital_signature/handler.go::RegisterRoutes` wires `auditSignaturesList`, `auditSignaturesSign`, `auditSignaturesVerify`. |
| AC-2 | Inspection | Code review + `digital_signature/feature.go` config wiring; reviewers verify no PEM-encoded private key is embedded. |

## Implements (cross-cutting)

- REQ-004 — audit per mutation (signed artefacts are an audit-of-audits).
- REQ-010 — config env-bound (signing keys live in the configuration plane).

## Satisfied by

- `audit_management/features/digital_signature/feature.go`
- `audit_management/features/digital_signature/module.go`
- `audit_management/features/digital_signature/handler.go`,
  `routes.go`, `permissions.go`

## Related requirements

- [REQ-AUDIT-004 — Audit compliance](./REQ-AUDIT-004-audit-compliance.md) — signature accompanies the disclosure artefact.
