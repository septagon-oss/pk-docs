---
id: REQ-USER-002
title: "Profile feature persists per-user profile + avatar records and stores privacy settings"
status: Proposed
date: 2026-05-07
slug: req-user-002-profile
category: user
ears_pattern: ubiquitous
verification_methods: [test, inspection]
compliance: [SOC2_CC6.1, ISO27001_A.9.4]
satisfied_by:
  adr: [ADR-0009]
  conventions: [C-04, C-14]
implements_cross_cutting: [REQ-001, REQ-004]
type: doc
tags: [requirement, feature, user_management]
module: user_management
feature: profile
---

# REQ USER-002 — Profile

Status: **Proposed** (2026-05-07)

## Statement

The profile feature **shall** persist a `Profile` and `Avatar`
record per user. Profile reads return the full record keyed by
user id; updates apply a sparse field-level patch. The feature
**shall** also persist per-user `PrivacySettings` (profile
visibility, show-email, allow-direct-messages) so consumers can
reason about whether to expose specific fields cross-user. Avatar
storage uses the platform filesystem abstraction; the avatar
record stores the reference, not the bytes.

## Rationale

The profile is the user's self-presented identity record — display
name, photo, biography. Storing privacy *preferences* alongside
the data lets the platform offer a consistent privacy contract to
users; *applying* those preferences when rendering profiles to
other users is currently the responsibility of the consumer view
(see AC-3). Splitting avatar storage from profile data keeps the
profile-read path lean (no binary payloads) and lets the
filesystem layer evolve independently.

## Acceptance criteria

- **AC-1** `Service::GetProfile(userID)` returns the persisted
  profile record (or a defaults-filled record when none exists);
  the returned shape carries every persisted field.
- **AC-2** `Service::UpdateProfile` applies a sparse patch — only
  fields present in `contracts.ProfileUpdate` are written, others
  remain unchanged.
- **AC-3** Privacy preferences are persisted via
  `Service::UpdatePrivacySettings` and applied at read time via
  `RedactProfileForViewer(profile, viewer, settings)` in
  `privacy_filter.go`. The helper takes the viewer's relationship
  (`ViewerOwner` / `ViewerTenantMember` / `ViewerPublic`) and the
  owner's `PrivacySettings`, returning a redacted copy of the
  profile without mutating the input. Cross-user readers must
  apply this filter; the helper is the documented seam.
- **AC-4** Avatar uploads route through the platform filesystem
  abstraction; the avatar record stores a content reference, not
  the bytes.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `pk-modules/user_management/features/profile/service_test.go::TestService_GetPublicProfile_ReturnsPublicFields` and `TestService_GetPublicProfile_NoProfileReturnsDefaults`. |
| AC-2 | Test | `pk-modules/user_management/features/profile/service_test.go::TestService_UpdateProfile_SelectiveFields` and `TestService_UpdateProfile_AllFields`. |
| AC-3 | Test | `pk-modules/user_management/features/profile/privacy_settings_test.go::TestUpdatePrivacySettings_AppliesMappedFields` covers the storage path (storage-only — read-side filtering is exercised by `pk-modules/user_management/features/profile/privacy_filter_test.go::TestRedactProfileForViewer_TenantMember_MembersOnlyVisibility` per REQ-USER-020). |
| AC-4 | Inspection | `avatar_crud.go` stores via `infrastructure/filesystem`; binary bytes never travel through the profile read path. |

## Implements (cross-cutting)

- REQ-001 — multi-tenant isolation (profile attached to a user record).
- REQ-004 — audit per mutation (the `user.profile.updated` event
  catalogued at module-contract check).

## Satisfied by

- `pk-modules/user_management/features/profile/feature.go` — wiring.
- `pk-modules/user_management/features/profile/service.go`,
  `service_test.go` — domain logic.
- `pk-modules/user_management/features/profile/privacy_settings_test.go` —
  storage-side privacy coverage.
- `pk-modules/user_management/features/profile/avatar_crud.go` — avatar
  storage abstraction.
- `pk-modules/user_management/features/profile/handler.go`, `routes.go`,
  `permissions.go` — HTTP surface.
- `pk-modules/user_management/features/profile/ui_test.go` — admin UI rendering.

## Related requirements

- [REQ-USER-001 — User](./REQ-USER-001-user.md)
- [REQ-USER-003 — Preferences](./REQ-USER-003-preferences.md)
