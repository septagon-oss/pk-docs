---
id: REQ-ADMIN-014
title: "Ecosystem search ranks results across modules, settings, widgets, records, and skills — gated by tenant + permission"
status: Proposed
date: 2026-05-08
slug: req-admin-014-ecosystem-search
category: governance
ears_pattern: ubiquitous
priority: must
risk: medium
verification_methods: [test]
compliance:
  - SOC2_CC6.1
  - ISO27001_A.9.4
satisfied_by:
  adr: [ADR-0009]
  conventions: [C-04, C-14]
implements_cross_cutting: [REQ-001, REQ-005]
refines: REQ-ADMIN-006
type: doc
tags: [requirement, capability, admin_management, ecosystem_search, search]
module: admin_management
feature: ecosystem_search
capability: ecosystem_search
capability_kind: data_invariant
stakeholders:
  - operator (uses search to find admin entry points)
  - module developer (registers a record source)
  - compliance auditor (cross-tenant leakage check)
---

# REQ ADMIN-014 — Ecosystem search

Status: **Proposed** (2026-05-08)

## Statement

The ecosystem-search feature **shall** expose a single search
surface that, given a query string, returns a ranked result
list combining:

1. **Modules** — each registered business module's name and
   metadata;
2. **Settings** — every setting key declared by a module;
3. **Widgets** — dashboard widgets contributed by modules;
4. **Records** — entity records contributed via the
   registered `RecordSource` interface (per-module read
   adapters);
5. **Skills** — agent skills from the generated skill
   catalog.

The search **shall**:

- Filter every result by the request's tenant context (a
  module disabled for the tenant produces zero results);
- Filter every result by the request's permission set (a
  module the principal cannot read produces zero results);
- Rank title-matches above body-matches for the same item
  type;
- Tolerate the absence of optional sources (e.g., no
  registered record sources → fewer hits, not an error).

## Rationale

Ecosystem search is the operator's primary navigation
surface across the admin platform. Three properties:

1. **Multi-source aggregation.** A single query has to
   surface across heterogeneous types — without
   aggregation, operators would have to remember which
   surface owns each thing.
2. **Tenant + permission filter is mandatory.** The
   search returns admin-internal data; without the
   filter, a query "settings" from a member without admin
   access would leak the entire setting catalogue. The
   filter is the explicit gate.
3. **Ranking favours title matches.** A query for
   "user" should surface the User module above an article
   that happens to mention "user" in body.

## Acceptance criteria

- **AC-1 — Permission filter applied + title-rank
  preferred.** A search with the principal's permission
  set filters non-readable items out and ranks title
  matches above body matches.
- **AC-2 — Tenant-enabled-modules filter applied.** A
  module disabled for the tenant produces zero hits in
  any of its children (settings, widgets, records,
  skills).
- **AC-3 — Settings + widgets surfaced.** A search
  query whose terms appear in setting keys / widget
  titles returns the matching settings and widgets.
- **AC-4 — Record hits from registered sources.**
  When a module has registered a `RecordSource`, the
  search includes record hits in the result list.
- **AC-5 — Module skills surfaced from catalog.** The
  generated skill catalog contributes skill entries.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `pk-modules/admin_management/features/ecosystem_search/service_test.go::TestSearchFiltersByPermissionAndRanksTitleMatches`. |
| AC-2 | Test | `pk-modules/admin_management/features/ecosystem_search/service_test.go::TestSearchHonorsTenantEnabledModules`. |
| AC-3 | Test | `pk-modules/admin_management/features/ecosystem_search/service_test.go::TestSearchIncludesSettingsAndWidgets`. |
| AC-4 | Test | `pk-modules/admin_management/features/ecosystem_search/service_test.go::TestSearchIncludesRecordHitsFromRegisteredSources`. |
| AC-5 | Test | `pk-modules/admin_management/features/ecosystem_search/service_test.go::TestSearchIncludesModuleSkillsFromGeneratedCatalog`. |

## Edge cases & unhappy paths

- **Empty query.** Returns an empty result set; no
  error.
- **Query longer than the configured maximum.**
  Truncated to the maximum; the search still runs.
- **Record source returns an error.** The error is
  logged; the search continues with the remaining
  source types. (Operator visibility is in logs.)
- **Tenant with zero enabled modules.** Returns an
  empty result set.

## Risk

- **Likelihood:** High — every operator search.
- **Impact:** High — defective filter leaks
  cross-tenant or cross-permission data.
- **Mitigations:** Permission filter (AC-1),
  tenant-enabled filter (AC-2), per-source
  tolerance (Record-source error handling).

## Implements (cross-cutting)

- **REQ-001 — Multi-tenant isolation.** AC-2 — search
  scoped to enabled modules.
- **REQ-005 — Fail-closed.** AC-1 — non-readable
  items filtered out.

## Compliance mapping

| Control | Coverage |
|---|---|
| SOC2 CC6.1 (Logical access) | AC-1 — permission gate. |
| ISO27001 A.9.4 (Access control) | AC-2 — tenant-enabled gate. |

## Satisfied by

- `pk-modules/admin_management/features/ecosystem_search/service.go` — the search orchestration.

## Related requirements

- [REQ-ADMIN-006 — Ecosystem search](./REQ-ADMIN-006-ecosystem-search.md)
- [REQ-ADMIN-010 — Settings resolver](./REQ-ADMIN-010-settings-resolver.md)
- [REQ-ADMIN-013 — Dashboard rendering](./REQ-ADMIN-013-dashboard-rendering.md)
