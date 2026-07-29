---
id: REQ-021
title: "Every JSON API endpoint speaks one wire contract for queries, envelopes, and errors"
status: Proposed
date: 2026-07-25
slug: req-021-uniform-api-wire-contract
category: interoperability
ears_pattern: ubiquitous
priority: must
risk: high
verification_methods: [test]
satisfied_by:
  adr: [ADR-0075]
  conventions: [C-14]
implements_cross_cutting: [REQ-002, REQ-013]
type: doc
tags: [requirement, cross-cutting, api, wire, pagination, envelope, errors]
module: platformkit_shared
feature: api_wire_contract
---

# REQ 021 — Uniform API wire contract

Status: **Proposed** (2026-07-25)

## Statement

The PlatformKit JSON API surface **shall** use a single shared wire contract —
owned by `pk-shared/pkg/apiwire` — for list-query parameters, response
envelopes, and error bodies, so that any conforming client and any conforming
server interoperate without per-repo translation.

Concretely:

1. **List queries.** Servers shall accept the canonical pagination parameters
   (`page`, `page_size`, `offset`, `sort`, `order`, `search`) and the legacy
   aliases (`limit`, `desc`, `q`) through `apiwire.ParseListQuery`; canonical
   parameters win when both are present.
2. **Envelopes.** Item responses shall serialize as `{"data": <entity>}` and
   list responses as `{"data": [<entities>], "metadata": {...}}` using the
   `apiwire.Item`/`apiwire.List` types.
3. **Errors.** JSON API error responses shall serialize as
   `{"error": "<message>"}` using `apiwire.Error`.

## Rationale

Before this requirement, three dialects coexisted on one wire: `pk-client`
sent `page`/`page_size` and expected `{data, metadata}`, `pk-core`'s CRUD kit
read `limit`/`offset` and returned bare arrays, and `pk-modules` handlers
hand-parsed `limit`/`offset` and returned plain-text errors. The result was a
client that could not list, page, or classify errors against the servers that
ship in the same product family. A wire contract that lives in the one library
every party may depend on (`pk-shared` is a dependency-graph leaf) removes the
translation burden and prevents future drift.

## Acceptance criteria

- `apiwire.ParseListQuery` accepts both dialects and normalizes them into one
  `ListQuery`; covered by table-driven tests in `pk-shared`.
- `pk-core/pkg/entity/crud` parses queries via `apiwire.ParseListQuery` and
  writes `apiwire.Item`/`apiwire.List`/`apiwire.Error` bodies.
- Every `pk-modules` JSON API handler parses queries and writes envelopes and
  errors through the same shared vocabulary.
- A round-trip of `pk-client` against a server built from `pk-core` and
  `pk-modules` succeeds for create, get-by-id, list (paged), and error
  classification.
