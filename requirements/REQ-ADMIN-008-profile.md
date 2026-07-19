---
id: REQ-ADMIN-008
title: "Admin profile feature surfaces the operator's own profile and preferences within the admin shell"
status: Proposed
date: 2026-05-07
slug: req-admin-008-profile
category: governance
ears_pattern: ubiquitous
verification_methods: [inspection]
compliance: []
satisfied_by:
  adr: [ADR-0009]
  conventions: [C-14]
implements_cross_cutting: [REQ-001]
type: doc
tags: [requirement, feature, admin_management]
module: admin_management
feature: profile
---

# REQ ADMIN-008 — Admin profile

Status: **Proposed** (2026-05-07)

## Statement

The admin profile feature **shall** surface the requesting
operator's own user profile (REQ-USER-002) and preferences
(REQ-USER-003) inside the admin shell so an operator can
self-service their own settings without leaving the admin context.
Reads and writes **shall** scope strictly to the requesting user.

## Rationale

An operator hitting "edit my profile" from the admin sidebar
should not be redirected out to the end-user surface — that breaks
the admin context. The discipline is purely a presentation choice:
data lives in user_management, this feature renders it inside the
admin shell.

## Acceptance criteria

- **AC-1** Reads/writes scope to the requesting user; an operator
  cannot view or edit another user's profile through this surface.
- **AC-2** The render reuses the user_management profile + preferences
  data path, not a parallel implementation.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `modules/platformkit-business-modules/admin_management/features/profile/section_renderer_test.go::TestProfileFeatureDeclaresGovernedPagePermission` verifies the governed self-profile page is permission-owned; request-context scoping remains an integration-review concern. |
| AC-2 | Test | `modules/platformkit-business-modules/admin_management/features/profile/section_renderer_test.go::TestProfileSectionRendererOwnsProfileContent` verifies that the governed section delegates through the narrow admin content seam instead of implementing a second profile route. |

## Implements (cross-cutting)

- REQ-001 — multi-tenant isolation.

## Satisfied by

- `admin_management/features/profile/feature.go`
- `admin_management/features/profile/section_renderer.go`
- `admin_management/admin_renderer.go`

## Related requirements

- [REQ-USER-002 — Profile](./REQ-USER-002-profile.md)
- [REQ-USER-003 — Preferences](./REQ-USER-003-preferences.md)
