---
id: REQ-INFRA-005
title: "Deployment identity binds desired state, provider target, and exact source tree"
status: Active
date: 2026-07-15
slug: req-infra-005-deployment-artifact-identity
category: governance
ears_pattern: ubiquitous
verification_methods: [test, inspection]
compliance: []
satisfied_by:
  adr: []
  conventions: []
implements_cross_cutting: [REQ-010, REQ-015]
type: doc
tags: [requirement, feature, infrastructure, deployment, identity, reproducibility]
module: infrastructure
feature: deployment_identity
---

# REQ INFRA-005 — Deployment identity binds desired state, provider target, and exact source tree

Status: **Active** (2026-07-15)

## Statement

The deployment lifecycle **shall** identify a candidate by a validated,
versioned artifact that binds the normalized desired stack, the exact cloud
account or project, and the full Git tree of the provider program. Invalid or
tampered identity **shall** fail before provider mutation.

## Rationale

A request file does not completely identify a deployment: defaults, provider
code, lockfiles, external artifact versions, and the selected cloud boundary
also determine the resulting resources. The full source revision supplies the
materialization point while the full tree identifies its contents; the
artifact captures both with the normalized provider inputs needed to compare
a candidate with a verified baseline and reproduce it later.

Provider identity is safety-critical. A valid stack definition aimed at the
wrong AWS account or GCP project must not be accepted as the same deployment.

## Acceptance criteria

- **AC-1** The desired-state fingerprint is deterministic over the normalized
  stack and excludes requester, reason, and approval metadata that do not
  affect provider resources.
- **AC-2** Provider targeting resolves a concrete AWS account or GCP project
  with the runtime's documented precedence and rejects missing or unsupported
  targets.
- **AC-3** A version-3 deployment artifact binds request fingerprint, provider
  target, full source revision, and full source tree. Its artifact fingerprint
  changes when desired state, provider target, source revision, or source tree
  changes.
- **AC-4** Parsing or validating an artifact rejects altered request,
  fingerprint, source-tree, or provider-target content.
- **AC-5** The executor refuses modified or untracked source and resolves
  `HEAD` and `HEAD^{tree}` to full Git object IDs before constructing a
  candidate.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `infrastructure/platformkit-infra-pulumi/internal/contract/request_fingerprint_test.go::TestDeploymentRequestFingerprintIgnoresOperationalMetadata` |
| AC-2 | Test | `infrastructure/platformkit-infra-pulumi/internal/contract/provider_target_test.go::TestResolveProviderTargetUsesConcreteGCPProjectPrecedence` and `infrastructure/platformkit-infra-pulumi/internal/contract/provider_target_test.go::TestResolveProviderTargetRejectsMissingCloud` |
| AC-3 | Test | `infrastructure/platformkit-infra-pulumi/internal/contract/deployment_artifact_test.go::TestDeploymentArtifactBindsRequestRevisionAndSourceTree` |
| AC-4 | Test | `infrastructure/platformkit-infra-pulumi/internal/contract/deployment_artifact_test.go::TestParseDeploymentArtifactRejectsTampering` |
| AC-5 | Inspection | `infrastructure/platformkit-infra-pulumi/internal/deployexec/source.go::resolveSourceIdentity` checks the complete worktree status and resolves full object IDs. |

## Implements (cross-cutting)

- **REQ-010** — deployment identity is derived from validated environment-bound
  request data, not hidden mutable process state.
- **REQ-015** — canonical serialization and hashing make equivalent desired
  state reproducible in tests and automation.

## Satisfied by

- `infrastructure/platformkit-infra-pulumi/internal/contract/request_fingerprint.go`.
- `infrastructure/platformkit-infra-pulumi/internal/contract/provider_target.go`.
- `infrastructure/platformkit-infra-pulumi/internal/contract/deployment_artifact.go`.
- `infrastructure/platformkit-infra-pulumi/internal/deployexec/source.go`.

## Related requirements

- [REQ-INFRA-004 — Request-derived verification](./REQ-INFRA-004-request-derived-verification.md)
- [REQ-INFRA-007 — Verified baseline rollback](./REQ-INFRA-007-verified-baseline-rollback.md)

## References

- `product/platformkit-docs/adr/0047-executable-quality-bar-and-module-excellence-program.md`
