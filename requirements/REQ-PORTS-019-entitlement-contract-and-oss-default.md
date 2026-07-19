---
id: REQ-PORTS-019
title: "Entitlement checks use namespaced keys, auditable grants, and an explicit unconditional OSS default"
status: Proposed
date: 2026-07-15
slug: req-ports-019-entitlement-contract-and-oss-default
category: auth
ears_pattern: unwanted-behaviour
priority: must
risk: high
verification_methods: [test]
satisfied_by:
  adr: [ADR-0009, ADR-0021]
  conventions: [C-14]
implements_cross_cutting: [REQ-001, REQ-005, REQ-015]
refines: REQ-PORTS-001
type: doc
tags: [requirement, capability, ports, entitlement, oss]
module: platformkit_ports
feature: contract_identity
capability: entitlement_contract
capability_kind: inter_module_contract
---

# REQ PORTS-019 — Entitlement contract and OSS default

Status: **Proposed** (2026-07-15)

## Statement

Entitlement policy drivers **shall** answer tenant-scoped, namespaced capability
keys with an auditable grant and fail closed for unknown or cross-tenant keys;
the named OSS `allowall` adapter **shall** be the explicit exception, granting
every key unconditionally and without a quota so open-source installations are
never license-gated.

## Rationale

One seam must support both policy-enforced distributions and unrestricted OSS
without scattering edition checks through modules. Naming the exception keeps
the default behavior honest while the policy conformance suite still exercises
denial and tenant-isolation paths.

## Acceptance criteria

- **AC-1 — Namespaced, auditable grants.** Keys accept only `feature.`,
  `module.`, and `limit.` namespaces; allowed grants carry a reason and finite
  limits preserve the exact quota.
- **AC-2 — Policy conformance.** Policy-enforcing drivers allow declared grants,
  deny unknown and cross-tenant capabilities, honor cancellation, and are safe
  concurrently.
- **AC-3 — Explicit OSS exception.** `allowall` grants every key for every
  tenant, including canceled contexts, with unlimited `oss-default` reason and
  passes universal (non-policy) conformance.
- **AC-4 — Denial event identity.** `EmitDenied` publishes the typed denied
  event with tenant, capability, and reason intact.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `core/platformkit-ports/entitlement/entitlementtest/entitlementtest_test.go::TestKeyValidation`. |
| AC-2 | Test | `core/platformkit-ports/entitlement/entitlementtest/entitlementtest_test.go::TestStaticPassesConformance`. |
| AC-3 | Test | `core/platformkit-adapters/allowall/allowall_test.go::TestAllowsEverything`. |
| AC-3 | Test | `core/platformkit-adapters/allowall/allowall_test.go::TestAllowsEvenWithCanceledContext`. |
| AC-4 | Test | `core/platformkit-ports/entitlement/entitlementtest/entitlementtest_test.go::TestEmitDeniedPublishesContract`. |

## Satisfied by

- `core/platformkit-ports/entitlement`.
- `core/platformkit-ports/entitlement/entitlementtest`.
- `core/platformkit-adapters/allowall`.
