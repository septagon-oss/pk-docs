---
id: REQ-USER-004
title: "Registration feature is the user-side onboarding facade that delegates to auth_management"
status: Proposed
date: 2026-05-07
slug: req-user-004-registration
category: user
ears_pattern: ubiquitous
verification_methods: [inspection]
compliance: []
satisfied_by:
  adr: [ADR-0009]
  conventions: [C-04, C-14]
implements_cross_cutting: [REQ-001]
type: doc
tags: [requirement, feature, user_management]
module: user_management
feature: registration
---

# REQ USER-004 — Registration onboarding

Status: **Proposed** (2026-05-07)

## Statement

The user-management registration feature **shall** declare the
permissions and module-level metadata for the user-side of the
onboarding flow, but **shall not** implement credential validation,
verification-token issuance, or password hashing — those concerns
live in `auth_management/registration` (REQ-AUTH-002). This feature
exists so that admin sidebars and module dashboards can register
"Onboarding" entries scoped to user_management without that module
taking a hard dependency on auth_management's HTTP surface.

## Rationale

PlatformKit deliberately splits "the user record" (user_management)
from "the credentialled identity" (auth_management) because the two
have different lifecycles — a user can exist without credentials
(SCIM-provisioned, pending invite, deactivated for compliance hold),
and credentials can be linked / unlinked from a user without
deleting the underlying record. This split means there are *two*
"registration" features: the user-facing facade (this REQ) and the
credential-bearing flow (REQ-AUTH-002). The facade exists to keep
the user_management module's permission and admin-UI surface
internally consistent without spilling auth concerns across the
boundary.

## Acceptance criteria

- **AC-1** This feature declares the user-facing onboarding
  permissions (`featurePermissions()`) but contains no credential
  validation, no password hashing, and no verification-token
  issuance.
- **AC-2** The actual onboarding business logic (CreateAccount,
  VerifyEmail, ResendVerification) is reachable only through
  `auth_management/registration` — call sites in this feature
  delegate or redirect; they do not duplicate the discipline.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Inspection | `user_management/features/registration/feature.go` is 24 lines; it declares metadata and permissions only. No imports of `passhash`, `notification`, or `verification` packages. |
| AC-2 | Inspection | Reviewers confirm the HTTP surface here, if any, redirects to `auth_management/registration` rather than mirroring its logic. The full registration AC suite is covered under [REQ-AUTH-002](./REQ-AUTH-002-registration.md). |

## Implements (cross-cutting)

- REQ-001 — module independence (this feature's hard dependency on
  auth_management is mediated by the catalog, not by direct import).

## Satisfied by

- `user_management/features/registration/feature.go` — metadata and
  permission declaration.
- `user_management/features/registration/permissions.go`,
  `routes.go`, `constants.go`, `e2e.go` — minimal surface.

## Related requirements

- [REQ-AUTH-002 — Registration (auth side)](./REQ-AUTH-002-registration.md) —
  the credential-bearing implementation this facade delegates to.
- [REQ-USER-001 — User](./REQ-USER-001-user.md) — the user record
  the onboarding flow ultimately creates.
