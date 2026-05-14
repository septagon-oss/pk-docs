---
id: REQ-USER-020
title: "Profile read returns a viewer-redacted projection determined by viewer kind and the owner's privacy settings"
status: Proposed
date: 2026-05-08
slug: req-user-020-profile-read-privacy
category: user
ears_pattern: ubiquitous
priority: must
risk: medium
verification_methods: [test, inspection]
compliance:
  - SOC2_CC6.1
  - ISO27001_A.18.1.4
  - GDPR_Art_5
  - GDPR_Art_25
satisfied_by:
  adr: [ADR-0009]
  conventions: [C-04, C-14]
implements_cross_cutting: [REQ-001, REQ-009]
refines: REQ-USER-002
type: doc
tags: [requirement, capability, user_management, profile, privacy]
module: user_management
feature: profile
capability: profile_read_privacy
capability_kind: data_invariant
stakeholders:
  - profile owner (controls visibility of personal data)
  - tenant member (read another member's profile under tenant rules)
  - public viewer (anonymous directory lookup)
  - compliance auditor (data-minimisation control)
---

# REQ USER-020 — Profile read with viewer-aware privacy filter

Status: **Proposed** (2026-05-08)

## Statement

The profile feature **shall** expose a pure helper,
`RedactProfileForViewer(profile, viewer, settings)`, that
returns a copy of a profile with fields redacted according to
the viewer's relationship and the owner's
`PrivacySettings`. The helper **shall**:

1. Treat the input pointer as immutable (returned value is a
   fresh allocation; the caller's profile is never mutated);
2. Return the original profile fully populated when
   `viewer == ViewerOwner`;
3. Strip every field except the display surface
   (`FirstName`, `LastName`, plus avatar — owned upstream)
   when `viewer == ViewerPublic` or
   `settings.ProfileVisibility == "private"`;
4. For `viewer == ViewerTenantMember`, honour the per-toggle
   privacy preferences on the settings record — currently
   `ProfileVisibility=="members_only"` redacts `PhoneNumber`
   and `DateOfBirth`.

Cross-user read paths in this feature **shall** apply this
helper before serialising the response. The helper is the
discipline anchor; it does not retroactively patch the
existing `Handler.GetProfile` (a known follow-up — handler
adoption is tracked separately).

## Rationale

Profile data is the densest single concentration of personal
data in the platform: phone, DOB, location, employer, free-text
bio. Three pressures shape the helper's design:

1. **Data minimisation by default.** GDPR Article 5(1)(c)
   requires that personal data be "adequate, relevant and
   limited to what is necessary" — surfacing PhoneNumber to
   another tenant member who cannot see it is a regulatory
   leak even if the UI hides it. The redaction must happen at
   the response-shape layer, not at the rendering layer.
2. **Three-tier viewer model.** Owner / tenant-member / public
   captures the minimum sensible distinctions; richer ACL
   models would split tenant-member into role tiers, but the
   current schema collapses to these three. Future ACL
   refinements extend the helper without breaking callers.
3. **Pure helper, applied at the boundary.** A pure function
   is testable in isolation and reusable from every read
   path (HTTP, RPC, GraphQL, A2UI). Locating the redaction
   inside the repository would conflate persistence with
   policy and complicate write paths.

The helper's `_ = out` branch on `ShowEmail` is a documented
anchor: today the `Profile` entity does not embed the email
field (email lives on `User`), so the toggle is a no-op at
this layer. When the schema migrates email onto the profile,
this is the single place to add the redaction.

## Acceptance criteria

- **AC-1 — Owner sees full profile.** `RedactProfileForViewer`
  with `ViewerOwner` returns a copy that is field-equal to the
  input, regardless of privacy settings.
- **AC-2 — Public viewer sees only display subset.**
  `ViewerPublic` returns a profile with `PhoneNumber`,
  `DateOfBirth`, `Gender`, `Location`, `Company`, `JobTitle`,
  `Bio`, `SocialLinks`, `Website`, `Occupation` cleared;
  `FirstName` and `LastName` are preserved.
- **AC-3 — Private visibility forces public-tier redaction.**
  An owner whose `ProfileVisibility == "private"` causes a
  `ViewerTenantMember` viewer to be downgraded to the
  public-tier redaction set.
- **AC-4 — Members-only visibility redacts contact + DOB.**
  `ViewerTenantMember` with `ProfileVisibility ==
  "members_only"` clears `PhoneNumber` and `DateOfBirth` but
  preserves the remainder of the tenant-visible fields.
- **AC-5 — Helper does not mutate input.** Calling the helper
  with any viewer / settings combination leaves the input
  `*Profile` byte-identical to its pre-call state.
- **AC-6 — Nil-input safety.** `RedactProfileForViewer(nil,
  ...)` returns `nil` without panicking.

## Verification

> **Verification gap (deployment, not specification).** The helper is
> tested in isolation per the rows below. The HTTP `Handler.GetProfile`
> path does not yet invoke the helper, so the *runtime* discipline this
> REQ describes is currently a documented seam rather than an enforced
> response shape. Closing the gap is the "wire profile handler to
> redaction" follow-up; until then, REQ-USER-002 AC-3 is the runtime
> claim and acknowledges the same gap.

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `pk-modules/user_management/features/profile/privacy_filter_test.go::TestRedactProfileForViewer_OwnerSeesEverything`. |
| AC-2 | Test | `pk-modules/user_management/features/profile/privacy_filter_test.go::TestRedactProfileForViewer_PublicSeesOnlyDisplaySubset`. |
| AC-3 | Test | `pk-modules/user_management/features/profile/privacy_filter_test.go::TestRedactProfileForViewer_TenantMember_PrivateVisibility`. |
| AC-4 | Test | `pk-modules/user_management/features/profile/privacy_filter_test.go::TestRedactProfileForViewer_TenantMember_MembersOnlyVisibility`. |
| AC-5 | Test | `pk-modules/user_management/features/profile/privacy_filter_test.go::TestRedactProfileForViewer_DoesNotMutateInput`. |
| AC-6 | Inspection | `privacy_filter.go::RedactProfileForViewer` — first statement is `if profile == nil { return nil }`. |

## Edge cases & unhappy paths

- **Mixed-tier ambiguity.** A viewer that is both owner and
  public (an admin reading their own profile via a
  service-account context) is resolved by the caller's choice
  of `ViewerKind`, not by the helper. Callers must pick the
  *most-restrictive* applicable tier when in doubt.
- **Settings record absent.** A zero-value
  `PrivacySettings` — every field at its Go default — is
  treated as "no special preferences": `ShowEmail=false`,
  `ProfileVisibility=""`. The helper degrades to the
  tenant-member tier without member-only or private
  redaction.
- **Schema growth.** When new sensitive fields are added to
  `Profile`, they must be added to the public-tier branch's
  redaction list. The current set is not exhaustive of any
  future schema; reviewers MUST audit the helper on schema
  growth (a dedicated `check-profile-privacy-coverage` is the
  proposed safeguard).
- **Handler retrofit pending.** The `Handler.GetProfile`
  endpoint currently returns the un-redacted profile; the
  helper documents the discipline for the cross-user paths
  but the HTTP boundary has not yet been wired. This is a
  known gap, tracked under follow-up "wire profile handler to
  redaction".
- **Avatar handling.** Avatars live on a separate sub-entity
  and are not redacted by this helper; their visibility is
  controlled by storage-layer access rules.

## Risk

- **Likelihood:** Medium — every cross-user profile read.
- **Impact:** High — accidental over-disclosure is a GDPR
  data-minimisation breach.
- **Mitigations:** Pure helper (AC-5) + tested cases for each
  viewer / settings pair (AC-1..AC-4) + nil-safety
  (AC-6). The handler-retrofit follow-up closes the deployment
  gap.

## Implements (cross-cutting)

- **REQ-001 — Multi-tenant isolation.** AC-3 / AC-4 —
  the tenant-member tier governs visibility within the
  tenant boundary; out-of-tenant viewers fall to the
  public tier.
- **REQ-009 — Observability.** Indirect: the helper itself is
  pure and side-effect-free; observability lives at the
  caller.

## Compliance mapping

| Control | Coverage |
|---|---|
| SOC2 CC6.1 (Logical access) | AC-2..AC-4 — tier-aware exposure aligns with access policy. |
| ISO27001 A.18.1.4 (Privacy and protection of PII) | AC-1..AC-4 — graduated visibility implements PII protection. |
| GDPR Art. 5 (Data minimisation) | AC-2..AC-4 — only necessary fields exposed per viewer relationship. |
| GDPR Art. 25 (Data protection by design) | AC-5 — the helper is the documented review point at the response-shape boundary. |

## Satisfied by

- `pk-modules/user_management/features/profile/privacy_filter.go::RedactProfileForViewer` — the pure helper.
- `pk-modules/user_management/features/profile/privacy_filter_test.go` — viewer / settings coverage.

## Related requirements

- [REQ-USER-002 — Profile feature](./REQ-USER-002-profile.md) — the umbrella this refines.
- [REQ-USER-003 — Preferences](./REQ-USER-003-preferences.md) — where `PrivacySettings` is owned and edited.
- [REQ-USER-011 — User update](./REQ-USER-011-user-update.md) — the analogous write-side discipline.
