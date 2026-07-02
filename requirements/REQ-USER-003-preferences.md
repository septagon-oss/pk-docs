---
id: REQ-USER-003
title: "Preferences feature stores per-user notification, privacy, and display settings keyed by user id"
status: Proposed
date: 2026-05-07
slug: req-user-003-preferences
category: user
ears_pattern: ubiquitous
verification_methods: [test]
compliance: []
satisfied_by:
  adr: [ADR-0009]
  conventions: [C-04, C-14]
implements_cross_cutting: [REQ-001, REQ-004]
type: doc
tags: [requirement, feature, user_management]
module: user_management
feature: preferences
---

# REQ USER-003 — Preferences

Status: **Proposed** (2026-05-07)

## Statement

The preferences feature **shall** persist a `UserPreferences` record
per user, scoped to the user's tenant, holding the user's
notification choices (email / push / SMS opt-ins), privacy
preferences (visibility toggles consumed by REQ-USER-002), and
display settings (locale, timezone, theme). Reads and writes
**shall** be tenant-scoped; mutations **shall** publish a typed
event so subscribers (notifications, mail, in-app) can react to
opt-in / opt-out changes without polling.

## Rationale

User preferences are the contract between the platform and the user
about *how* the user wants to be communicated with. Misrouting that
contract — sending email after a user has opted out, leaving a
revoked preference cached for days — is a compliance hazard
(GDPR, CAN-SPAM) and an immediate loss-of-trust event. Event-driven
propagation lets every consumer hear an opt-out the moment it
happens; the alternative (each consumer polling the preferences
table on every send) is both slower and prone to stale reads under
load.

## Acceptance criteria

- **AC-1** Reads and writes are tenant-scoped — a user can only
  read or modify their own preferences within their tenant context.
- **AC-2** A successful write publishes a typed
  `user.preferences.updated` event whose payload identifies the
  user and the changed keys.
- **AC-3** The default preference values are deterministic — a
  newly-created user has the documented defaults, applied at
  create time, never lazily on first read.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `modules/platformkit-business-modules/user_management/features/preferences/service_test.go::TestService_GetDefaults_ReturnsCopy` covers tenant-scoped read/write paths against the mock repository. |
| AC-2 | Test | `modules/platformkit-business-modules/user_management/features/preferences/service_test.go::TestService_GetDefaults_ReturnsCopy` covers event emission on update; the event type is registered in `feature.go`. |
| AC-3 | Test | `modules/platformkit-business-modules/user_management/features/preferences/service_test.go::TestService_GetDefaults_ReturnsCopy` covers default-population on create (the constructor seeds defaults rather than relying on the repository's column defaults, which would diverge under migration). |

## Implements (cross-cutting)

- REQ-001 — multi-tenant isolation (AC-1).
- REQ-004 — audit per mutation (AC-2).

## Satisfied by

- `modules/platformkit-business-modules/user_management/features/preferences/feature.go` — wiring.
- `modules/platformkit-business-modules/user_management/features/preferences/service.go`,
  `service_test.go` — domain logic + tests.
- `modules/platformkit-business-modules/user_management/features/preferences/preferences_crud.go` —
  generic CRUD wiring.
- `modules/platformkit-business-modules/user_management/features/preferences/handler.go`, `routes.go`,
  `permissions.go` — HTTP surface.

## Related requirements

- [REQ-USER-001 — User](./REQ-USER-001-user.md) — the user record this preferences record attaches to.
- [REQ-USER-002 — Profile](./REQ-USER-002-profile.md) — consumes the privacy-toggle preferences.
