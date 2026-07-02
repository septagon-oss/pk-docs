---
id: REQ-ADMIN-009
title: "Settings feature owns the cross-module settings registry and resolves tenant-scoped values at read time"
status: Proposed
date: 2026-05-07
slug: req-admin-009-settings
category: governance
ears_pattern: ubiquitous
verification_methods: [test]
compliance: []
satisfied_by:
  adr: [ADR-0009]
  conventions: [C-04, C-14]
implements_cross_cutting: [REQ-001, REQ-010]
type: doc
tags: [requirement, feature, admin_management]
module: admin_management
feature: settings
---

# REQ ADMIN-009 — Settings

Status: **Proposed** (2026-05-07)

## Statement

The settings feature **shall** expose the registrar that other
modules call to declare the tenant-overridable settings they
honour (default locale, notification policy, feature flags). At
read time the resolver **shall** layer tenant overrides over
platform defaults; writes **shall** validate against the declared
schema. The admin UI section **shall** group settings by their
declared category so an operator can find them without knowing
which module owns them.

## Rationale

Settings are how a tenant customises platform behaviour without
code changes. The discipline of "module declares, settings owns"
is the same one used for permissions and admin sections: each
module knows what it cares about, the central feature renders
them uniformly.

## Acceptance criteria

- **AC-1** Settings reads layer tenant overrides over platform
  defaults; a missing override falls back to the default.
- **AC-2** Writes validate against the declared schema; invalid
  values fail with a typed error.
- **AC-3** Admin section grouping respects each module's declared
  category.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `modules/platformkit-business-modules/admin_management/features/settings/resolver_test.go::TestReset_IsIdempotent`. |
| AC-2 | Test | `modules/platformkit-business-modules/admin_management/features/settings/handler_test.go::TestHandleSettingsPageUsesCurrentRequestPath` covers schema-validation paths. |
| AC-3 | Test | `modules/platformkit-business-modules/admin_management/features/settings/section_renderer_test.go::TestRenderModuleSettingsCard_PerFieldSourceBadges`. |

## Implements (cross-cutting)

- REQ-001 — multi-tenant isolation (overrides are tenant-scoped).
- REQ-010 — config env-bound (platform defaults come from the configuration plane).

## Satisfied by

- `admin_management/features/settings/feature.go`
- `admin_management/features/settings/handler.go`,
  `handler_test.go`, `resolver_test.go`, `section_renderer_test.go`
- `admin_management/features/settings/admin_skin.go`

## Related requirements

- [REQ-ADMIN-001 — Admin](./REQ-ADMIN-001-admin.md)
- [REQ-010 — Configuration is environment-bound](./REQ-010-configuration-environment-bound.md)
