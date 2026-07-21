---
id: REQ-PORTS-014
title: "Authorization ports expose fail-closed decisions and immutable policy-release evidence"
status: Proposed
date: 2026-07-15
slug: req-ports-014-authorization-contract
category: auth
ears_pattern: unwanted-behaviour
priority: must
risk: critical
verification_methods: [test, inspection]
satisfied_by:
  adr: [ADR-0009]
  conventions: [C-14]
implements_cross_cutting: [REQ-001, REQ-005]
refines: REQ-PORTS-001
type: doc
tags: [requirement, capability, ports, authorization, policy]
module: platformkit_ports
feature: contract_identity
capability: authorization_contract
capability_kind: inter_module_contract
---

# REQ PORTS-014 — Authorization contract

Status: **Proposed** (2026-07-15)

## Statement

The authorization seam **shall** express tenant-scoped decisions and portable
directory/policy lifecycle contracts without importing a provider; **if** a
policy release or activation observation lacks its exact immutable scope,
version, projection digest, bundle digest, revision, timestamp, or complete
replica attestation, the contract **shall** reject it as proof of activation.

## Rationale

Authorization is fail-closed only when provider-neutral DTOs preserve scope and
when "published" is not confused with "active." Exact immutable identities and
independent runtime observations prevent mutable tags or desired configuration
from masquerading as the policy actually serving decisions.

## Acceptance criteria

- **AC-1 — Narrow decision seam.** `authz.Decider` answers one subject/action/
  resource/tenant question, and denied decisions have a typed event contract.
- **AC-2 — Immutable release identity.** Desired/release values reject missing
  scope, version, timestamps, unsafe text, or non-SHA256 artifact identities.
- **AC-3 — Exact activation evidence.** `PolicyActivation.Matches` accepts only
  ready, observed state whose version, scope, policy path, projection digest,
  image digest, and loaded bundle revision match the desired release.
- **AC-4 — Provider-neutral management facets.** Directory reads and writes are
  separate optional ports, and writes carry expected ETags to prevent silent
  cross-console overwrites.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Inspection | `core/platformkit-ports/authz/authz.go` — `Decision`, `Verdict`, `Decider`, `Denied`, and `DeciderContract`. |
| AC-2 | Test | `core/platformkit-ports/authz/policy_release_test.go::TestPolicyReleaseValidateRequiresImmutableDigests`. |
| AC-3 | Test | `core/platformkit-ports/authz/policy_release_test.go::TestPolicyActivationMatchesDesiredRelease`. |
| AC-4 | Inspection | `core/platformkit-ports/authz/directory.go` — `DirectoryReader`, `DirectoryWriter`, and ETag-bearing mutations. |

## Satisfied by

- `core/platformkit-ports/authz`.
- the integrations layer's `topaz`.
