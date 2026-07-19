---
id: REQ-NAMING-001
title: "Canonical identifier and source-layout grammar is enforced at authored declaration sites"
status: Active
date: 2026-07-15
slug: req-naming-001-canonical-identifier-layout-grammar
category: governance
ears_pattern: ubiquitous
priority: must
risk: medium
verification_methods: [test]
satisfied_by:
  adr: [ADR-0062]
  conventions: [C-12, C-14]
implements_cross_cutting: [REQ-002]
type: doc
tags: [requirement, feature, governance, naming, identifiers, source-layout]
module: platformkit_devtools
feature: canonical_naming
---

# REQ NAMING-001 — Canonical identifier and source-layout grammar

Status: **Active** (2026-07-15)

## Statement

PlatformKit authoring checks **shall** enforce the registered namespace and
per-surface identifier grammar, together with canonical source-directory,
file, and Go-package names, at the authored declaration sites of every
registered business module. Historical violations **shall** be isolated by a
dated, shrink-only acknowledgement rather than weakening the grammar for new
or changed declarations.

## Rationale

Events, authorization tokens, error codes, translation keys, and source layout
all identify platform concepts. If they drift into independent dialects,
consumers must guess whether two spellings mean the same thing and mechanical
discovery becomes unreliable. Declaration-site validation avoids false
positives from prose and imports while keeping the namespace registry and
ADR-0062 grammar executable.

Some established modules do not end in `_management`, and valid Go command
packages necessarily use `package main`. Coverage and exception rules must
therefore derive from registered module identity and explicit command layout,
not fragile filename heuristics.

## Acceptance criteria

- **AC-1 — Declaration-site grammar.** The naming gate rejects invalid event,
  authorization-token, translation-key, error-code, directory, filename, and
  package declarations while ignoring strings outside those authored
  declaration positions and excluding vendored or generated assets.
- **AC-2 — Registered-module coverage.** The scan includes registered module
  directories that do not use the `_management` suffix and reports their
  violations with stable module-relative locations.
- **AC-3 — Layout exceptions are explicit.** A Go package name must match its
  directory, except that `package main` is accepted only beneath a canonical
  `cmd/<name>` command directory.
- **AC-4 — Source-file independence.** A governed declaration is checked in
  any hand-authored Go source file; moving it away from a conventional file
  name cannot bypass enforcement.
- **AC-5 — Historical debt ratchets.** Collection emits deterministic dated
  acknowledgement records, a current record suppresses only the exact known
  violation, and the same source fails again after that record expires.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `tooling/platformkit-devtools/internal/modulechecks/naming_check_test.go::TestCheckNamingConventionFlagsDeclarationSites`. |
| AC-2 | Test | `tooling/platformkit-devtools/internal/modulechecks/naming_check_test.go::TestCheckNamingConventionScansModuleIDsBeyondManagementSuffix`. |
| AC-3 | Test | `tooling/platformkit-devtools/internal/modulechecks/naming_check_test.go::TestCheckNamingConventionAllowsMainOnlyForCommandPackages`. |
| AC-4 | Test | `tooling/platformkit-devtools/internal/modulechecks/naming_check_test.go::TestCheckNamingConventionScansEventDeclarationsInAnySourceFile`. |
| AC-5 | Test | `tooling/platformkit-devtools/internal/modulechecks/naming_check_test.go::TestCheckNamingConventionCollectRoundTrip`. |

## Implements (cross-cutting)

- **REQ-002** — stable names and package layout keep independently composed
  modules mechanically discoverable without module-specific parsing rules.

## Satisfied by

- ADR 0062 — One identifier grammar, projected per surface.
- Convention C-12 — Identifiers use one grammar projected per surface.
- `tooling/platformkit-devtools/internal/modulechecks/naming_check.go`.

## Related requirements

- [REQ-002 — Modules are independently deployable](./REQ-002-independently-deployable-modules.md).
