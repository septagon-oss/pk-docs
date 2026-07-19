---
id: REQ-PORTS-023
title: "Tenancy drivers resolve and read an immutable tenant identity without ambiguous or cross-tenant fallback"
status: Proposed
date: 2026-07-15
slug: req-ports-023-tenancy-port-and-immutable-catalog
category: tenancy
ears_pattern: unwanted-behaviour
priority: must
risk: critical
verification_methods: [test, inspection]
satisfied_by:
  adr: [ADR-0009, ADR-0021]
  conventions: [C-14]
implements_cross_cutting: [REQ-001, REQ-005, REQ-015]
refines: REQ-PORTS-001
type: doc
tags: [requirement, capability, ports, tenancy, adapter]
module: platformkit_ports
feature: contract_identity
capability: tenancy_driver_contract
capability_kind: inter_module_contract
---

# REQ PORTS-023 — Tenancy port and immutable catalog

Status: **Proposed** (2026-07-15)

## Statement

Every `tenancy.Resolver`/`tenancy.Reader` driver **shall** resolve the minimal
tenant identity by current ID, host, ID, or slug; **if** a lookup is unknown,
ambiguous, or canceled, it **shall** return a portable failure instead of a
zero-valued or guessed tenant. The `memtenancy` adapter **shall** validate and
own an immutable catalog snapshot at construction.

## Rationale

Tenant identity is an isolation boundary. Duplicate keys, a fallback tenant,
or a mutable caller-owned catalog could redirect later requests across tenants.
The shared conformance kit and immutable reference adapter make those failure
semantics explicit.

## Acceptance criteria

- **AC-1 — Resolver conformance.** Current and host lookups return the intended
  tenant; unknown hosts are `KindNotFound`; cancellation and concurrency are
  safe.
- **AC-2 — Reader conformance.** ID and slug lookups return the intended tenant;
  unknown keys are `KindNotFound`; cancellation and concurrency are safe.
- **AC-3 — Unambiguous immutable catalog.** `memtenancy.New` rejects empty or
  duplicate IDs, slugs, and domains as `KindInvalid`, owns its input snapshot,
  and reports unknown current tenants as `KindNotFound`.
- **AC-4 — Bounded compatibility.** The deprecated one-release `MemResolver`
  preserves its historical constant-tenant behavior and aliases the canonical
  adapter contract version while callers migrate to `memtenancy.New`.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `core/platformkit-ports/tenancy/tenancytest/tenancytest_test.go::TestMemPassesResolverConformance`. |
| AC-2 | Test | `core/platformkit-ports/tenancy/tenancytest/tenancytest_test.go::TestMemPassesReaderConformance`. |
| AC-3 | Test | `core/platformkit-adapters/memtenancy/memtenancy_test.go::TestNewRejectsAmbiguousCatalogs`. |
| AC-3 | Test | `core/platformkit-adapters/memtenancy/memtenancy_test.go::TestCatalogOwnsTenantSnapshot`. |
| AC-4 | Test | `core/platformkit-adapters/tenancy/mem_test.go::TestMemResolverPreservesLegacyBehavior`. |

## Satisfied by

- `core/platformkit-ports/tenancy`.
- `core/platformkit-ports/tenancy/tenancytest`.
- `core/platformkit-adapters/memtenancy`.
- `core/platformkit-adapters/tenancy/mem.go` — one-release compatibility only.
