---
id: REQ-SITE-002
title: "Demo feature exposes a public, rate-limited preview of the platform with synthetic data"
status: Proposed
date: 2026-05-07
slug: req-site-002-demo
category: availability
ears_pattern: ubiquitous
verification_methods: [inspection]
compliance: []
satisfied_by:
  adr: [ADR-0009]
  conventions: [C-04, C-14]
implements_cross_cutting: [REQ-005, REQ-014]
type: doc
tags: [requirement, feature, site]
module: site
feature: demo
---

# REQ SITE-002 — Demo

Status: **Proposed** (2026-05-07)

## Statement

The demo feature **shall** expose a public, rate-limited surface
that lets a prospective customer click through the platform with
synthetic data without creating an account. The synthetic data
**shall** be tenant-isolated from real production data; rate
limits **shall** bound the per-IP cost of demo traffic.

## Rationale

The demo is the lead-generation tool — anonymous visitors should
see the product working without friction. The rate-limit + synthetic
data discipline keeps the demo from becoming a weapon: an attacker
cannot use demo traffic to enumerate real records or to flood the
platform with traffic that incurs real cost.

## Acceptance criteria

- **AC-1** Demo traffic is rate-limited per IP and per session;
  excess returns a typed `ErrRateLimitExceeded`.
- **AC-2** Demo data is synthetic — no real tenant rows are
  reachable through the demo surface.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Inspection | Coverage gap — no `*_test.go` exists for `site/features/demo`; reviewers verify `rate_limiter.go` and the handler chain. |
| AC-2 | Inspection | Coverage gap; reviewers verify the synthetic-data fixture seed. |

## Implements (cross-cutting)

- REQ-005 — fail-closed on rate limit.
- REQ-014 — graceful degradation under load.

## Satisfied by

- `site/features/demo/feature.go`
- `site/features/demo/handler.go`
- `site/features/demo/rate_limiter.go`
- `site/features/demo/permissions.go`

## Related requirements

- [REQ-SITE-001 — Homepage](./REQ-SITE-001-homepage.md)
