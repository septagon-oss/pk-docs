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
| AC-1 | Inspection | Coverage gap — no `*_test.go` exists; reviewers verify the request-context scoping. |
| AC-2 | Inspection | Reviewers verify the import of `user_management` profile/preferences services rather than re-implementation. |

## Implements (cross-cutting)

- REQ-001 — multi-tenant isolation.

## Satisfied by

- `admin_management/features/profile/feature.go`
- `admin_management/features/profile/handler.go`,
  `permissions.go`, `routes.go`

## Related requirements

- [REQ-USER-002 — Profile](./REQ-USER-002-profile.md)
- [REQ-USER-003 — Preferences](./REQ-USER-003-preferences.md)
