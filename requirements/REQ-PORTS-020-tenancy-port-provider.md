---
id: REQ-PORTS-020
title: "tenant_management provides the platformkit-ports tenancy Reader/Resolver seam at authored contract versions"
status: Proposed
date: 2026-07-02
slug: req-ports-020-tenancy-port-provider
category: tenancy
ears_pattern: ubiquitous
priority: must
risk: high
verification_methods: [test, inspection]
compliance:
  - SOC2_CC6.1
  - ISO27001_A.9.4
satisfied_by:
  adr: [ADR-0009]
  conventions: [C-14]
implements_cross_cutting: [REQ-001, REQ-002, REQ-005]
refines: REQ-PORTS-001
type: doc
tags: [requirement, capability, tenant_management, tenant_lifecycle, ports]
module: platformkit_ports
feature: contract
capability: tenancy_port_provider
capability_kind: inter_module_contract
stakeholders:
  - every business module (resolves the current tenant through the thin seam)
  - platform-core (owns the platformkit-ports tenancy contract)
  - request middleware (host-based tenant resolution)
---

# REQ PORTS-020 — Tenancy port provider

Status: **Proposed** (2026-07-02)

## Statement

The `tenant_management` module **shall** provide the cross-module
tenancy seam defined in `platformkit-ports/tenancy` —
`tenancy.Reader` (Get, GetBySlug) and `tenancy.Resolver` (Resolve,
ResolveByHost) — as typed, versioned ports registered via
`standard.WithPortProvider` at the authored contract versions
(`tenancy.ReaderContract.Version`,
`tenancy.ResolverContract.Version`, both `1.0.0`), backed by this
module's own `contracts/provides.TenantService`.

The adapters **shall**:

1. Map the rich `provides.TenantDTO` onto the minimal
   `tenancy.Tenant` view (`ID`, `Slug`, `Domain`, `Name` — string
   IDs, no GORM types);
2. Surface absence as an error: a nil DTO (the compatibility not-found
   convention) becomes the module's domain `ErrTenantNotFound`,
   because the value-typed `tenancy.Tenant` seam has no
   `(nil, nil)` convention;
3. **If** `Resolve(ctx)` is called and the request context carries
   no active tenant, **then** the resolver **shall** fail closed
   with `ErrNoActiveTenant` rather than guessing a tenant;
4. Resolve the current tenant from
   `appcontext.GetActiveTenantID(ctx)` through the backing
   service, and resolve by host through the module's normalized
   host-alias lookup (`ResolveTenantByHost`).

## Rationale

Tenancy is the platform's isolation boundary (REQ-001); nearly
every module needs "which tenant am I acting for" without
importing `tenant_management`. The thin seam gives them exactly
two facets — read and resolve — per the ADR-0001 ports charter
(narrow interfaces, no domain nouns in core).

Two properties carry the security weight and justify
`capability_kind: inter_module_contract`. First, fail-closed
resolution: an empty active-tenant context must be an error, never
a fallback tenant — a resolver that guessed would silently
cross the isolation boundary (REQ-005). Second, the explicit
not-found error: the compatibility `(nil, nil)` convention of the backing
service cannot leak through a value-typed seam, or callers would
operate on a zero-valued `Tenant{}` as if it were real.

## Acceptance criteria

- **AC-1 — Ports provided at authored versions.** The constructed
  module implements `module.PortVersionProvider` and its
  `ProvidedPorts()` contains the canonical keys for
  `tenancy.Reader` and `tenancy.Resolver` at version `1.0.0`.
- **AC-2 — Reader mapping and not-found contract.** `Get` and
  `GetBySlug` return the mapped minimal `tenancy.Tenant`; a
  missing tenant surfaces as `ErrTenantNotFound`, never as a
  zero-valued success.
- **AC-3 — Resolver fails closed without an active tenant.**
  `Resolve` on a context with no active tenant returns
  `ErrNoActiveTenant`; with an active tenant in the request
  context it resolves through the backing service.
- **AC-4 — Host resolution delegates to the alias lookup.**
  `ResolveByHost` routes through
  `provides.TenantService.ResolveTenantByHost` (the normalized
  host-alias path of REQ-TENANT-012) and applies the same
  DTO-to-Tenant mapping and not-found conversion.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `modules/platformkit-business-modules/tenant_management/ports_provider_test.go::TestModuleProvidesTenancyPorts`. |
| AC-2 | Test | `modules/platformkit-business-modules/tenant_management/ports_provider_test.go::TestTenancyReaderAdapter`. |
| AC-3 | Test | `modules/platformkit-business-modules/tenant_management/ports_provider_test.go::TestTenancyResolverAdapter`. |
| AC-4 | Inspection | `modules/platformkit-business-modules/tenant_management/ports_provider.go::ResolveByHost` + `toTenancyTenant` — delegation and nil-DTO conversion. Dedicated host-resolution test pending (the underlying alias lookup is covered by REQ-TENANT-012). |

## Edge cases & unhappy paths

- **Whitespace-only active tenant ID.** Trimmed before the empty
  check, so `"  "` fails closed the same as `""`.
- **Backing-service errors.** Propagated unwrapped; the adapters
  add sentinels only for absence (`ErrTenantNotFound`) and
  missing context (`ErrNoActiveTenant`).
- **Session switching.** `tenancy.SessionSwitcher` is part of the
  seam but is not provided by this adapter set; auth-side
  providers own it.

## Risk

- **Likelihood:** High — tenant resolution sits on nearly every
  request path once consumers cut over to the seam.
- **Impact:** High — a resolver that guessed or a zero-valued
  Tenant success would breach tenant isolation invisibly.
- **Mitigations:** AC-3 (fail-closed), AC-2 (explicit not-found),
  AC-1 (composition-time version checking).

## Implements (cross-cutting)

- **REQ-001 — Multi-tenant isolation.** AC-3 — the active-tenant
  context is the only source of "current tenant".
- **REQ-002 — Independently deployable modules.** AC-1 — consumers
  bind to the versioned port key, not tenant_management types.
- **REQ-005 — Authorisation fails closed.** AC-3 — no active
  tenant is an error, never a default.

## Compliance mapping

| Control | Coverage |
|---|---|
| SOC2 CC6.1 (Logical access controls) | AC-3 — tenant scoping cannot be silently skipped. |
| ISO27001 A.9.4 (Information access restriction) | AC-2 + AC-3 — access to tenant data is keyed by explicit, verified identity. |

## Satisfied by

- `modules/platformkit-business-modules/tenant_management/ports_provider.go::registerTenancyPorts, tenancyReaderAdapter, tenancyResolverAdapter, toTenancyTenant`.
- `core/platformkit-ports/tenancy/tenancy.go` — the seam
  definition: `Tenant`, `Reader`, `Resolver`, and the authored
  contracts.

## Related requirements

- [REQ-TENANT-001 — Tenant lifecycle](./REQ-TENANT-001-tenant-lifecycle.md) —
  the feature umbrella whose service backs these adapters.
- [REQ-TENANT-012 — Host alias resolution](./REQ-TENANT-012-host-alias-resolution.md) —
  the normalized lookup `ResolveByHost` delegates to.
- [REQ-PORTS-010 — Audit port provider](./REQ-PORTS-010-audit-port-provider.md) —
  the sibling cut-over pilot following the same pattern.

## References

- `core/platformkit-ports/docs/ADR-0001-ports-charter.md` — the
  platformkit-ports charter (external ADR namespace; distinct
  from this registry's ADR-0001). Note:
  `core/platformkit-ports/portindex/methodbudget_test.go` also
  declares `Implements: REQ-PORTS-020` — that file enforces the
  charter's five-method interface budget across all capability
  packages (a charter-wide gate, of which the tenancy seam is one
  subject).
