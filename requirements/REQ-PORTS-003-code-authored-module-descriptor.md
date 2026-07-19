---
id: REQ-PORTS-003
title: "Module descriptors keep authored facts separate from generated manifest projections"
status: Proposed
date: 2026-07-15
slug: req-ports-003-code-authored-module-descriptor
category: governance
ears_pattern: ubiquitous
priority: must
risk: high
verification_methods: [test, inspection]
satisfied_by:
  adr: [ADR-0009]
  conventions: [C-14]
implements_cross_cutting: [REQ-002, REQ-016]
type: doc
tags: [requirement, feature, ports, descriptor, manifests]
module: platformkit_ports
feature: descriptor
---

# REQ PORTS-003 — Code-authored module descriptor

Status: **Proposed** (2026-07-15)

## Statement

The `platformkit_ports` design authority **shall** expose one code-authored
module descriptor covering identity, classification, lifecycle, runtime,
composition, dependencies, provided contracts, features, events, and
permissions, and **shall** mark only artifact destinations as projection-owned.

## Rationale

Catalogs and manifests are projections, not places to re-author module truth.
An explicit ownership map lets generators reject drift: business and contract
facts remain in module code while output paths describe only where derived
artifacts are emitted.

## Acceptance criteria

- **AC-1 — Complete descriptor vocabulary.** `descriptor.Descriptor` carries
  every major authored field group needed by composition and catalog tooling.
- **AC-2 — Explicit source ownership.** `OwnershipMap()` covers every field
  group, marks `projection` as `projection`, and marks every other group as
  `module_code`.
- **AC-3 — Port-native dependencies.** Descriptor dependencies and events use
  the canonical `port.DependencyCategory` and `port.EventContract` types rather
  than defining parallel manifest-only vocabulary.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `core/platformkit-ports/descriptor/descriptor_test.go::TestOwnershipMapCoversAllFieldGroups`. |
| AC-2 | Test | `core/platformkit-ports/descriptor/descriptor_test.go::TestOwnershipMapCoversAllFieldGroups`. |
| AC-3 | Inspection | `core/platformkit-ports/descriptor/descriptor.go` — `Dependency` and `Descriptor.Events` use the canonical port types. |

## Satisfied by

- `core/platformkit-ports/descriptor/descriptor.go`.
- `core/platformkit-ports/descriptor/descriptor_test.go`.
