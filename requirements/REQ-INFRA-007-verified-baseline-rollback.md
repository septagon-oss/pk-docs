---
id: REQ-INFRA-007
title: "Upgrade rollback restores the exact verified deployment baseline"
status: Active
date: 2026-07-15
slug: req-infra-007-verified-baseline-rollback
category: availability
ears_pattern: unwanted-behaviour
verification_methods: [test, inspection]
compliance: []
satisfied_by:
  adr: []
  conventions: []
implements_cross_cutting: [REQ-014, REQ-015]
type: doc
tags: [requirement, feature, infrastructure, rollback, baseline, adoption]
module: infrastructure
feature: verified_baseline
---

# REQ INFRA-007 — Upgrade rollback restores the exact verified deployment baseline

Status: **Active** (2026-07-15)

## Statement

**If** an upgrade fails after provider mutation, **then** the deployment
lifecycle **shall** reconcile the exact request, provider target, and provider
program source recorded in the stack's last verified baseline, verify the
restored deployment, and confirm its identity before reporting rollback
success.

## Rationale

The parent of the current Git commit is not necessarily the last version that
passed production verification. Operators can skip releases, merge unrelated
commits, or deploy an equivalent tree from a different commit. Rollback must
therefore use promoted deployment identity rather than source-control
ancestry or an operator's memory.

Existing stacks without such identity need an explicit, verified adoption step;
silently treating their current state as a trusted baseline would defeat the
safety property.

## Acceptance criteria

- **AC-1** A baseline is promoted only after the candidate applies and every
  mandatory request-derived check passes, and is stored separately from the
  workload stack's mutable candidate output.
- **AC-2** Upgrade refuses a stack with no verified baseline. Explicit adoption
  first requires a no-change provider preview and readiness probes before
  promoting the observed state.
- **AC-3** On failed upgrade verification, rollback materializes the baseline's
  exact source revision and tree, reapplies its normalized request, reruns its
  verification plan, and confirms the restored fingerprint.
- **AC-4** Tampered baseline content, a provider-target mismatch, an
  environment downgrade, or an asserted previous request that is not the
  promoted baseline fails before candidate provider mutation.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `infrastructure/platformkit-infra-pulumi/internal/deployexec/pulumi_test.go::TestRunProvisionAppliesVerifiesThenPromotes` |
| AC-2 | Test | `infrastructure/platformkit-infra-pulumi/internal/deployexec/pulumi_test.go::TestRunUpgradeWithoutVerifiedBaselineRequiresAdoption` and `infrastructure/platformkit-infra-pulumi/internal/deployexec/pulumi_test.go::TestRunAdoptsExistingStackOnlyAfterNoChangePreviewAndProbes` |
| AC-3 | Test | `infrastructure/platformkit-infra-pulumi/internal/deployexec/pulumi_test.go::TestRunUpgradeVerificationFailureRestoresVerifiedArtifact` and `infrastructure/platformkit-infra-pulumi/internal/deployexec/pulumi_test.go::TestRunMaterializesVerifiedProgramBeforeSourceUpgrade` |
| AC-4 | Test | `infrastructure/platformkit-infra-pulumi/internal/deployexec/pulumi_test.go::TestRunRejectsTamperedVerifiedBaseline` and `infrastructure/platformkit-infra-pulumi/internal/deployexec/pulumi_test.go::TestRunRejectsProviderTargetChangeAgainstVerifiedStack` |

## Implements (cross-cutting)

- **REQ-014** — a failed candidate degrades to an explicitly verified prior
  state rather than an assumed revision.
- **REQ-015** — the baseline artifact makes rollback inputs deterministic and
  testable without relying on mutable operator context.

## Satisfied by

- `infrastructure/platformkit-infra-pulumi/internal/contract/deployment_artifact.go`.
- `infrastructure/platformkit-infra-pulumi/internal/deployexec/source.go::prepareRollbackWorktree`.
- `infrastructure/platformkit-infra-pulumi/internal/deployexec/pulumi.go::Run` and `pulumiAdapter.Rollback`.

## Related requirements

- [REQ-INFRA-004 — Request-derived verification](./REQ-INFRA-004-request-derived-verification.md)
- [REQ-INFRA-005 — Deployment artifact identity](./REQ-INFRA-005-deployment-artifact-identity.md)
- [REQ-INFRA-006 — Closed-loop deployment](./REQ-INFRA-006-closed-loop-deployment.md)

## References

- `product/platformkit-docs/adr/0047-executable-quality-bar-and-module-excellence-program.md`
