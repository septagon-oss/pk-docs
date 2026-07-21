---
id: REQ-TRANS-011
title: "Translation JSON parsing accepts array, flat-map, and nested-object shapes; flattens nested keys deterministically"
status: Proposed
date: 2026-05-08
slug: req-translation-011-parsing
category: translation
ears_pattern: ubiquitous
priority: must
risk: medium
verification_methods: [test]
compliance:
  - ISO27001_A.18.1
satisfied_by:
  adr: [ADR-0009]
  conventions: [C-04, C-14]
implements_cross_cutting: [REQ-005]
refines: REQ-TRANS-001
type: doc
tags: [requirement, capability, translation, translations, parsing]
module: translation
feature: translations
capability: translation_parsing
capability_kind: data_invariant
stakeholders:
  - module developer (ships translation files)
  - tenant administrator (uploads translation overrides)
  - operator (debugs malformed translations)
---

# REQ TRANSLATION-011 — Translation JSON parsing

Status: **Proposed** (2026-05-08)

## Statement

The translations feature **shall** expose
`ParseTranslationJSON(raw)` that accepts three
input shapes:

1. **Array shape** — a JSON array of
   `{id, value, locale}` objects;
2. **Flat-map shape** — a JSON object whose
   keys are translation ids and whose values
   are the translation strings;
3. **Nested-object shape** — a JSON object
   whose values may be sub-objects; the
   helper flattens nested keys to dotted
   paths (e.g.
   `{"home": {"title": "Welcome"}}` →
   `home.title = "Welcome"`).

The parser **shall**:

- Refuse with a typed error on invalid
  JSON;
- Refuse with a typed error on empty
  input;
- Skip array entries with blank ids
  rather than producing empty-id rows;
- Flatten nested objects to depth-N dotted
  keys deterministically;
- Skip blank keys at any nesting level.

`FlattenTranslationObject(obj)` is the
nested-shape primitive that produces a flat
map; `NamespaceFromKey(key)` extracts the
prefix before the first dot.

## Rationale

Translation file shapes vary between modules
(some ship arrays, some ship flat maps, some
ship i18next-style nested objects). The
parser's three-shape acceptance is the
documented entry point. Three properties:

1. **Multi-shape compatibility.** Forcing
   every module to convert their existing
   translations to one shape is operator
   pain; the parser accepts what's
   already there.
2. **Deterministic flatten.** Nested
   objects flatten the same way every
   parse — same keys produce the same
   dotted paths.
3. **Skip-blank discipline.** A blank id
   or key is data corruption; the parser
   surfaces this by *skipping* (not
   silently treating as empty) so the
   downstream merge does not produce
   "" → ""  rows.

## Acceptance criteria

- **AC-1 — Array shape.** A JSON array of
  `{id, value, locale}` parses
  successfully.
- **AC-2 — Flat-map shape.** A flat
  `{id: value}` map parses successfully.
- **AC-3 — Nested-object shape.** Nested
  objects flatten to dotted keys.
- **AC-4 — Empty input.** An empty input
  returns the typed error.
- **AC-5 — Invalid JSON.** Malformed JSON
  returns the typed parse error.
- **AC-6 — Array with blank ids.**
  Entries with empty ids are skipped (not
  surfaced as empty-id rows).
- **AC-7 — Flatten depth-N.** Multi-level
  nesting produces dotted keys at every
  level.
- **AC-8 — Skip blank keys at every
  level.** Blank keys at any nesting
  depth are skipped during flatten.
- **AC-9 — Namespace extraction.**
  `NamespaceFromKey("module.section.key")`
  returns `"module"`.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `pk-modules/translation/features/translations/service_test.go::TestParseTranslationJSON_ArrayFormat`. |
| AC-2 | Test | `pk-modules/translation/features/translations/service_test.go::TestParseTranslationJSON_FlatMapFormat`. |
| AC-3 | Test | `pk-modules/translation/features/translations/service_extended_test.go::TestParseTranslationJSON_NestedFormat`. |
| AC-4 | Test | `pk-modules/translation/features/translations/service_extended_test.go::TestParseTranslationJSON_EmptyInput`. |
| AC-5 | Test | `pk-modules/translation/features/translations/service_extended_test.go::TestParseTranslationJSON_InvalidJSON`. |
| AC-6 | Test | `pk-modules/translation/features/translations/service_extended_test.go::TestParseTranslationJSON_ArrayWithBlankIDs`. |
| AC-7 | Test | `pk-modules/translation/features/translations/service_extended_test.go::TestFlattenTranslationObject_DeepNesting`. |
| AC-8 | Test | `pk-modules/translation/features/translations/service_extended_test.go::TestFlattenTranslationObject_SkipsBlankKeys`. |
| AC-9 | Test | `pk-modules/translation/features/translations/service_test.go::TestNamespaceFromKey`. |

## Edge cases & unhappy paths

- **Mixed shapes in one file.** Not
  supported; the parser picks the shape
  from the top-level type and rejects
  contradictions.
- **Non-string values in flat map.**
  Coerced to string when possible;
  otherwise skipped.
- **Locale missing on array entries.**
  Defaults to the configured fallback
  locale at registration time.
- **Cyclic nested objects.** Not
  possible in valid JSON (which is
  acyclic by construction).
- **Module entity validation.** The
  `entities.Translation::Validate`
  helper ensures persisted rows have
  the required fields
  (`TestTranslationValidatePopulatesBaseEntityFromContext`).

## Risk

- **Likelihood:** Medium — every module
  ships at least one translation file;
  every tenant upload re-parses.
- **Impact:** Medium — defective
  parsing drops translations silently.
- **Mitigations:** Three-shape
  acceptance (AC-1..AC-3),
  empty-and-invalid refusal (AC-4..AC-5),
  blank-key skip (AC-6, AC-8).

## Implements (cross-cutting)

- **REQ-005 — Fail-closed.** AC-4, AC-5
  refuse malformed input rather than
  silently producing empty rows.

## Compliance mapping

| Control | Coverage |
|---|---|
| ISO27001 A.18.1 (Compliance) | AC-1..AC-3 — every shipped module ships translatable copy. |

## Satisfied by

- `pk-modules/translation/features/translations/service.go::ParseTranslationJSON, FlattenTranslationObject, NamespaceFromKey`.

## Related requirements

- [REQ-TRANS-001 — Translations umbrella](./REQ-TRANS-001-translations.md)
- [REQ-TRANS-010 — Translation merge](./REQ-TRANS-010-merge-store.md)
