---
id: REQ-PORTS-018
title: "The static authorization adapter matches only explicit rules and fails closed by default"
status: Proposed
date: 2026-07-15
slug: req-ports-018-static-authorization-adapter
category: auth
ears_pattern: unwanted-behaviour
priority: must
risk: high
verification_methods: [test]
satisfied_by:
  adr: [ADR-0009, ADR-0021]
  conventions: [C-14]
implements_cross_cutting: [REQ-001, REQ-005, REQ-015]
refines: REQ-PORTS-001
type: doc
tags: [requirement, capability, ports, adapter, authorization]
module: platformkit_ports
feature: contract_identity
capability: static_authorization_adapter
capability_kind: failure_mode
---

# REQ PORTS-018 — Static authorization adapter

Status: **Proposed** (2026-07-15)

## Statement

The `staticauthz` adapter **shall** allow a decision only when every rule field
matches exactly or is the explicit `*` wildcard; an empty table, unmatched
field, other tenant, or canceled context **shall** produce a denied verdict.

## Rationale

Static rules are useful for demos and single-purpose services only if their
matching semantics are unambiguous. Treating an empty string as a wildcard or
falling through to allow would silently widen authorization across tenants.

## Acceptance criteria

- **AC-1 — Driver conformance.** Rules derived from exact allowed decisions pass
  the shared authorization driver suite.
- **AC-2 — Explicit wildcard only.** `*` matches any field, while empty matches
  only empty and a tenant-bound rule never matches another or missing tenant.
- **AC-3 — Deny by default.** An empty table and every unmatched decision return
  `Allow: false` with an audit reason.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `core/platformkit-adapters/staticauthz/staticauthz_test.go::TestPassesDeciderConformance`. |
| AC-2 | Test | `core/platformkit-adapters/staticauthz/staticauthz_test.go::TestWildcardSemantics`. |
| AC-3 | Test | `core/platformkit-adapters/staticauthz/staticauthz_test.go::TestEmptyTableDeniesEverything`. |

## Satisfied by

- `core/platformkit-adapters/staticauthz`.
- `core/platformkit-ports/authz/authztest`.
