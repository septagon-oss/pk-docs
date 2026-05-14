---
id: REQ-ADMIN-010
title: "Settings resolver merges baseline / deployment / tenant layers; tenant overrides win, unknown keys are typed errors"
status: Proposed
date: 2026-05-08
slug: req-admin-010-settings-resolver
category: governance
ears_pattern: ubiquitous
priority: must
risk: high
verification_methods: [test]
compliance:
  - SOC2_CC6.1
  - SOC2_CC8.1
  - ISO27001_A.18.1
satisfied_by:
  adr: [ADR-0009]
  conventions: [C-04, C-14]
implements_cross_cutting: [REQ-001, REQ-005, REQ-010]
refines: REQ-ADMIN-009
type: doc
tags: [requirement, capability, admin_management, settings, resolver]
module: admin_management
feature: settings
capability: settings_resolver
capability_kind: data_invariant
stakeholders:
  - tenant administrator (configures runtime knobs)
  - platform operator (sets deployment overrides)
  - module developer (declares baseline defaults)
---

# REQ ADMIN-010 — Settings resolver

Status: **Proposed** (2026-05-08)

## Statement

The settings feature **shall** expose a layered resolver that
combines three sources of setting values into a single
authoritative answer per `(module, key)` pair:

1. **Baseline** — the registered `DefaultValue` declared by the
   module's settings provider (compile-time constants);
2. **Deployment** — overrides set by the platform operator at
   deploy time (via `SetDeploymentOverrides`);
3. **Tenant** — per-tenant overrides set through the admin UI.

The resolver **shall** apply layers in
**`tenant > deployment > baseline`** precedence: a tenant
override always wins, a deployment override wins when no tenant
override exists, and the baseline default is the final fallback.

The resolver **shall** refuse a `Resolve(module, key)` call for
an unknown key with the typed `ErrSettingNotDefined` so
callers cannot silently consume an empty default.

`Reset(module, key, tenantID)` **shall** remove the tenant-tier
override (idempotent — repeating the call after the override is
gone is a clean no-op); `ResetAll(module, tenantID)` **shall**
remove every tenant override on the module.

`SetDeploymentOverrides` **shall** make a defensive copy of the
input map so subsequent caller mutations do not race with the
resolver's read snapshot; passing `nil` **shall** disable the
deployment layer.

## Rationale

Settings drive every runtime knob: feature toggles, channel
defaults, cache TTLs, display preferences. Three properties:

1. **Layered precedence with tenant on top.** A platform
   operator's deployment override should set a sensible
   default for every tenant; a tenant should be able to
   choose a different value when the platform operator's
   default doesn't fit. The order is the documented contract;
   reversing it would make tenant overrides invisible.
2. **Typed not-found, not zero-default.** A typo'd key should
   not silently resolve to `false` / `""` / `0` — that's the
   "channel disabled because of a bug" failure mode that
   REQ-NOTIF-010 already avoids at the gate. Refusing at the
   resolver layer prevents the same bug from reaching the
   gate.
3. **Defensive-copy on deployment-overrides write.** The
   deployment-override path is exercised at startup +
   reconciliation; without the defensive copy a caller's
   later mutation to the source map would leak into the
   resolver's snapshot, producing sporadic behaviour.

## Acceptance criteria

- **AC-1 — Baseline default returned with no overrides.**
  A `Resolve(module, key)` against a module with no
  deployment / tenant overrides returns the baseline
  default declared by the provider.
- **AC-2 — Deployment beats baseline.** When the operator
  has set a deployment override for the key, the resolver
  returns the deployment value, not the baseline.
- **AC-3 — Tenant beats deployment.** When the tenant has
  set an override for the key, the resolver returns the
  tenant value, not the deployment or baseline.
- **AC-4 — Unknown key refused.** `Resolve` for a key not
  registered by any provider returns
  `ErrSettingNotDefined`.
- **AC-5 — `ResolveAll` merges layers per key.** A
  `ResolveAll(module, tenantID)` returns the final
  per-key map applying the same precedence rule.
- **AC-6 — Unknown module returns empty.**
  `ResolveAll` for a module that has no registered
  settings returns an empty map (no error).
- **AC-7 — Reset removes tenant override.** A
  `Reset(module, key, tenantID)` removes the tenant
  override; subsequent `Resolve` returns the deployment
  / baseline value.
- **AC-8 — Reset is idempotent.** A second `Reset`
  against an already-removed override is a clean no-op.
- **AC-9 — Reset on unknown key refused.** A `Reset`
  on an unknown key returns
  `ErrSettingNotDefined`.
- **AC-10 — `ResetAll` removes every tenant
  override.** A `ResetAll(module, tenantID)` clears
  every tenant override registered on that module.
- **AC-11 — Deployment overrides are defensive-copied.**
  A subsequent mutation to the original map passed
  into `SetDeploymentOverrides` does not affect the
  resolver's snapshot.
- **AC-12 — Nil deployment overrides disable the
  layer.** A `SetDeploymentOverrides(nil)` makes
  subsequent `Resolve` fall through to baseline (or
  tenant when set).

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `pk-modules/admin_management/features/settings/resolver_test.go::TestResolve_BaselineWhenNoOverrides`. |
| AC-2 | Test | `pk-modules/admin_management/features/settings/resolver_test.go::TestResolve_DeploymentBeatsBaseline`. |
| AC-3 | Test | `pk-modules/admin_management/features/settings/resolver_test.go::TestResolve_TenantBeatsDeployment`. |
| AC-4 | Test | `pk-modules/admin_management/features/settings/resolver_test.go::TestResolve_UnknownKeyReturnsErrSettingNotDefined`. |
| AC-5 | Test | `pk-modules/admin_management/features/settings/resolver_test.go::TestResolveAll_MergesLayersPerKey`. |
| AC-6 | Test | `pk-modules/admin_management/features/settings/resolver_test.go::TestResolveAll_UnknownModuleReturnsEmpty`. |
| AC-7 | Test | `pk-modules/admin_management/features/settings/resolver_test.go::TestReset_RemovesTenantOverride`. |
| AC-8 | Test | `pk-modules/admin_management/features/settings/resolver_test.go::TestReset_IsIdempotent`. |
| AC-9 | Test | `pk-modules/admin_management/features/settings/resolver_test.go::TestReset_UnknownKeyReturnsErrSettingNotDefined`. |
| AC-10 | Test | `pk-modules/admin_management/features/settings/resolver_test.go::TestResetAll_RemovesEveryTenantOverrideOnTheModule`. |
| AC-11 | Test | `pk-modules/admin_management/features/settings/resolver_test.go::TestSetDeploymentOverrides_DefensiveCopy`. |
| AC-12 | Test | `pk-modules/admin_management/features/settings/resolver_test.go::TestSetDeploymentOverrides_NilDisablesLayer`. |

## Edge cases & unhappy paths

- **Tenant override that matches baseline.** Persists
  the override anyway; future baseline changes will not
  reach the tenant until explicitly reset. Documented
  operator hazard.
- **Module registered with zero settings.** The
  resolver returns an empty map for `ResolveAll`; this
  is the "module that has no runtime knobs" case.
- **Concurrent reset + write.** Last-write-wins;
  internal locking handles concurrent access through
  the underlying repository.
- **Non-Boolean stored value where Boolean expected.**
  Type coercion happens at the consumer (e.g.
  `channelgate.Enabled` falls back to default on
  non-bool — REQ-NOTIF-010 AC-6).

## Risk

- **Likelihood:** High — every module read of a setting.
- **Impact:** High — defective resolution either ignores
  tenant overrides (channel toggles silently fail) or
  ignores deployment overrides (operator can't lock down
  defaults).
- **Mitigations:** Documented precedence (AC-1..AC-3),
  typed not-found (AC-4), defensive copy (AC-11),
  idempotent reset (AC-8).

## Implements (cross-cutting)

- **REQ-001 — Multi-tenant isolation.** Tenant overrides
  are tenant-scoped.
- **REQ-005 — Fail-closed.** Unknown keys refused
  rather than silently defaulted.
- **REQ-010 — Configuration environment-bound.**
  Deployment overrides come from the environment via
  `SetDeploymentOverrides`.

## Compliance mapping

| Control | Coverage |
|---|---|
| SOC2 CC6.1 (Logical access) | AC-3 — tenant overrides bound to authenticated tenant. |
| SOC2 CC8.1 (Change management) | AC-7..AC-10 — reset operations auditable. |
| ISO27001 A.18.1 (Compliance) | AC-4 — unknown keys refused. |

## Satisfied by

- `pk-modules/admin_management/features/settings/resolver.go::Resolve, ResolveAll, Reset, ResetAll, SetDeploymentOverrides, ErrSettingNotDefined`.

## Related requirements

- [REQ-ADMIN-009 — Settings](./REQ-ADMIN-009-settings.md)
- [REQ-NOTIF-010 — Channel gate](./REQ-NOTIF-010-channel-gate.md) — the consumer of resolved settings.
- [REQ-010 — Configuration environment-bound](./REQ-010-configuration-environment-bound.md)
