---
id: REQ-TRANS-010
title: "Translation merge combines registry-baked defaults with DB overrides; DB failures fall back to registry"
status: Proposed
date: 2026-05-08
slug: req-trans-010-merge-store
category: translation
ears_pattern: ubiquitous
priority: must
risk: medium
verification_methods: [test]
compliance:
  - SOC2_CC7.2
  - ISO27001_A.18.1
satisfied_by:
  adr: [ADR-0009]
  conventions: [C-04, C-14]
implements_cross_cutting: [REQ-014]
refines: REQ-TRANS-001
type: doc
tags: [requirement, capability, translation_management, translations, merge]
module: translation_management
feature: translations
capability: translation_merge
capability_kind: failure_mode
stakeholders:
  - tenant administrator (overrides translations)
  - end-user (sees localised strings)
  - operator (debugs missing translations)
---

# REQ TRANS-010 — Translation merge

Status: **Proposed** (2026-05-08)

## Statement

The translations feature **shall** expose
`ListMerged(filter, params)` that returns the
merged set of translations:

1. **Registry-baked defaults** — every module
   ships JSON translation files at build time
   (the `translation_provider.go` at each
   module). These are loaded once at startup
   and serve as the baseline;
2. **Database overrides** — tenant-specific
   overrides persisted via the CRUD service.
   When a DB row exists for a key, it
   replaces the registry default;
3. **DB failure fall-back** — when the DB
   read errors transiently, the merge
   degrades to the registry-only view and
   surfaces the failure in logs (the user
   continues to see translations from the
   built-in defaults);
4. **Nil-service tolerance** — when no DB
   service is wired (minimal builds,
   isolated unit tests), `ListMerged`
   returns the registry-only view;
5. **Locale filter** — when the filter
   carries a locale, only that locale's
   translations are returned.

`GetByLocaleAndKey(locale, key)` **shall** be
the single-key lookup; pagination defaults
fill in when the caller omits page / page-size
values.

## Rationale

Translations are the platform's localisation
surface. Three properties:

1. **Registry-as-truth + DB-as-override.**
   The build-time registry guarantees every
   module has a default translation; the DB
   layer lets tenants customise. Without the
   merge, tenants would lose the registry
   defaults the moment they touch any
   translation.
2. **DB outage degrades, doesn't break.**
   A transient DB failure should not
   replace the user's UI strings with
   "translation key not found"; the registry
   is the resilient fallback.
3. **Stable namespace.** Translation keys
   follow `module.section.key` shape; the
   `NamespaceFromKey` helper extracts the
   namespace for filtering.

## Acceptance criteria

- **AC-1 — Merge from JSON files without
  DB.** A `ListMerged` against a service
  with no DB returns the registry-loaded
  translations.
- **AC-2 — DB + registry merge.** A
  `ListMerged` against a service whose DB
  has overrides returns the merge: DB
  rows replace registry rows for the same
  key, and registry rows fill in
  unspecified keys.
- **AC-3 — DB failure falls back to
  registry.** A DB error returns the
  registry-only view (the merge is
  resilient).
- **AC-4 — Nil generic service.** A
  service with `nil` DB collaborator
  returns the registry view without
  panicking.
- **AC-5 — Pagination defaults.** A
  `ListMerged` with `Page = 0` defaults
  to page 1; `PageSize = 0` defaults to
  the configured default.
- **AC-6 — Invalid page defaults.**
  Negative pages reset to 1; invalid
  page-sizes reset to default.
- **AC-7 — Locale filter applied.** A
  filter with a `Locale` field returns
  only translations for that locale.
- **AC-8 — Get by locale + key.** A
  `GetByLocaleAndKey(locale, key)`
  returns the matching translation;
  not-found returns the typed error;
  DB error returns the wrapped error.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `pk-modules/translation_management/features/translations/service_test.go::TestListMerged_LoadsFromJSONFilesWithoutDB`. |
| AC-2 | Test | `pk-modules/translation_management/features/translations/service_extended_test.go::TestListMerged_MergesDBAndRegistryTranslations`. |
| AC-3 | Test | `pk-modules/translation_management/features/translations/service_extended_test.go::TestListMerged_DBFailureFallsBackToRegistry`. |
| AC-4 | Test | `pk-modules/translation_management/features/translations/service_extended_test.go::TestListMerged_NilGenericService`. |
| AC-5 | Test | `pk-modules/translation_management/features/translations/service_extended_test.go::TestListMerged_Pagination`. |
| AC-6 | Test | `pk-modules/translation_management/features/translations/service_extended_test.go::TestListMerged_InvalidPageDefaults`. |
| AC-7 | Test | `pk-modules/translation_management/features/translations/service_extended_test.go::TestListMerged_WithLocaleFilter`. |
| AC-8 | Test | `pk-modules/translation_management/features/translations/service_extended_test.go::TestGetByLocaleAndKey_Found`, `TestGetByLocaleAndKey_NotFound`, `TestGetByLocaleAndKey_DBError`. |

## Edge cases & unhappy paths

- **Override directory configuration.** The
  `ResolveLangDirs` helper (`TestResolveLangDirs_*`)
  honours the configured override only and
  does not depend on the complete-saas path.
- **Filter matching.** The
  `MatchesFilter` helper covers
  per-translation field matching.
- **Empty key in JSON.** Skipped during
  parsing (`TestParseTranslationJSON_ArrayWithBlankIDs`).
- **Concurrent override writes.**
  Last-write-wins at the DB layer; the
  merge sees a consistent snapshot.

## Risk

- **Likelihood:** High — every UI string
  on every page-render.
- **Impact:** High — defective merge
  produces "translation.key.not.found"
  in user-facing UI.
- **Mitigations:** Registry fallback
  (AC-3, AC-4), pagination defaults
  (AC-5..AC-6), error wrapping (AC-8).

## Implements (cross-cutting)

- **REQ-014 — Graceful degradation.** AC-3
  + AC-4 — DB outage degrades to
  registry-only.

## Compliance mapping

| Control | Coverage |
|---|---|
| SOC2 CC7.2 (System monitoring) | AC-3 — DB failures observable in logs. |
| ISO27001 A.18.1 (Compliance) | AC-1 — every module has translatable defaults shipped at build time. |

## Satisfied by

- `pk-modules/translation_management/features/translations/service.go::ListMerged, GetByLocaleAndKey`.
- Helper functions: `NamespaceFromKey`, `MatchesFilter`, `ResolveLangDirs`.

## Related requirements

- [REQ-TRANS-001 — Translations umbrella](./REQ-TRANS-001-translations.md)
- [REQ-TRANS-011 — Translation parsing](./REQ-TRANS-011-parsing.md)
