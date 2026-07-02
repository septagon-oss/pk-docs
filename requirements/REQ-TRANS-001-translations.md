---
id: REQ-TRANS-001
title: "Translations feature persists the platform-wide localisation catalogue and serves keyed lookups"
status: Proposed
date: 2026-05-07
slug: req-trans-001-translations
category: translation
ears_pattern: ubiquitous
verification_methods: [test]
compliance: []
satisfied_by:
  adr: [ADR-0009]
  conventions: [C-04, C-14]
implements_cross_cutting: []
type: doc
tags: [requirement, feature, translation_management]
module: translation_management
feature: translations
---

# REQ TRANS-001 — Translations

Status: **Proposed** (2026-05-07)

## Statement

The translations feature **shall** maintain the platform's
localisation catalogue (locale, namespace, key, value). The
service exposes:

- `GetByLocaleAndKey(locale, key)` — exact lookup, returns
  `ErrNotFound` on miss.
- `GetByLocale(locale)` / `GetByNamespace(namespace)` —
  bulk reads.
- `ListMerged(...)` — merged view across the database table and
  the file-backed translation packs (`listFileBackedTranslations`).

## Rationale

The translations service is the platform's keyed string registry.
Locale fallback chains, missing-key visible-fallback, and
tenant-override layering are deliberately NOT implemented at this
service layer — those are the responsibility of the *localizer*
(typically wired into the request pipeline, e.g.
`app/localization/providers/noop`) which composes lookups across
locales and applies overrides on top.

## Acceptance criteria

- **AC-1** `GetByLocaleAndKey(locale, key)` returns the matching
  row or `ErrNotFound` — no fallback applied at this layer.
- **AC-2** `ListMerged` combines the database table with the
  file-backed packs for the requested filter, deduplicating by
  `(locale, namespace, key)` so a DB override of a file-shipped
  default takes precedence.

## Known gaps

- **No locale fallback in the service.** Callers that need
  "request locale → default locale → key-as-fallback" semantics
  must implement the chain themselves; the localizer wired into
  the request pipeline is the canonical place for that.
- **No tenant-override layer in the service.** Tenant-specific
  string customisation (e.g. renaming "Members" to "Residents"
  for one cowork tenant) is not modelled at this service layer
  today.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `modules/platformkit-business-modules/translation_management/features/translations/service_test.go::TestNamespaceFromKey` covers `GetByLocaleAndKey` hits and misses. |
| AC-2 | Inspection | `service_extended_test.go` covers `ListMerged` (DB + file-backed deduplication). _Verification gap: pending — cited evidence is prose / pattern / non-Go and cannot be auto-resolved._ |

## Implements (cross-cutting)

- (None claimed at the service layer; the broader locale/tenant
  composition lives at the localizer layer.)

## Satisfied by

- `translation_management/features/translations/feature.go`
- `translation_management/features/translations/service.go`,
  `service_test.go`, `service_extended_test.go`
- `translation_management/features/translations/handler.go`,
  `route_registration.go`, `permissions.go`
- `modules/platformkit-business-modules/translation_management/features/translations/section_renderer_test.go`

## Related requirements

- [REQ-USER-003 — Preferences](./REQ-USER-003-preferences.md) — the per-user locale a localizer would resolve against.
