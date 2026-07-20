---
id: REQ-019
title: "Live A2UI delivery is signed, audience-bound, and replay-resistant"
status: Active
date: 2026-07-19
slug: req-019-live-a2ui-delivery-is-signed-and-replay-resistant
category: security
ears_pattern: ubiquitous
verification_methods:
  - analysis
  - test
  - inspection
compliance: []
satisfied_by:
  adr: [ADR-0073]
  conventions: [C-23]
type: doc
tags: [requirement, security, mobile, a2ui, signing, replay]
---

# REQ 019 — Live A2UI delivery is signed, audience-bound, and replay-resistant

Status: **Active** (2026-07-19)

## Statement

PlatformKit **SHALL** authenticate every live A2UI surface and action-driven
render change before client decoding or rendering. The composed application
**SHALL** own the online signing boundary, resolve the exact tenant/native-app
audience from trusted configuration and request context, allocate a durable
cluster-wide revision, and emit only a complete signed envelope. The native
client **SHALL** validate the offline-root-to-keyset-to-envelope chain and
advance durable replay floors. Every missing, malformed, expired, revoked,
replayed, equivocated, unsigned, or incorrectly scoped delivery **SHALL** fail
closed without a live-mode fallback.

## Rationale

Server-driven UI controls user-visible intent and subsequent mutations. A
transport-authenticated response is still unsafe when it can be replayed from a
cache, accepted for another tenant or native binary, modified in an unsigned
extension, or constructed by an internal module outside the app's deployment
authority. One atomic signed envelope and one durable verifier path make that
authority explicit and reviewable across Go and TypeScript.

## Acceptance criteria

- **AC-1** Shared presentation code exposes one atomic signed-envelope
  constructor. Public unsigned construction, sign-later, patch, and raw action
  replacement APIs do not exist.
- **AC-2** Application startup requires an explicit online Ed25519 leaf key, an
  offline-root-signed keyset artifact, root public key, validity policy,
  native-app audience map, and PostgreSQL revision authority. It generates or
  substitutes none of them.
- **AC-3** Every envelope signature binds canonical spec and extension hashes,
  schema, screen, protocol versions, key ID, positive uint64 decimal-string
  revision, exact platform/bundle/tenant/environment/origin audience, time
  bounds, and app-version bounds.
- **AC-4** Native app identity and switchable client identity are separate. The
  server selects the bundle/package ID from native-app configuration and
  rejects client slugs outside that app's explicit allowlist.
- **AC-5** Action producers return only an in-process complete replacement
  intent. The app validates and signs it; no patch, raw complete spec,
  pre-populated replacement, unknown top-level response field, or unsigned
  render-affecting extension reaches the renderer.
- **AC-6** The client verifies the pinned root, root-signed keyset, revocations,
  leaf signature, hashes, exact audience, versions, validity, app bounds, and
  revision before decoding or rendering a live spec.
- **AC-7** Accepted keyset and per-audience/per-screen/per-canonical-route
  revisions advance atomically in durable native secure storage. Rollback, equal-revision
  equivocation, replay, storage failure, or process restart cannot lower or
  bypass the floor.
- **AC-8** Root and leaf rotation uses explicit current/next/revoked keyset
  state and an app/server overlap window. Production and release builds pin
  their environment root; demo fixtures never become live fallback trust.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `core/platformkit-shared/presentation/a2ui_runtime_test.go::TestBuildSignedRuntimeEnvelope` |
| AC-2 | Test | `apps/platformkit-apps/internal/bootstrap/mobile_envelope_signing_contract_test.go::TestNewA2UIEnvelopeSignerFailsClosedWithoutExplicitTrustConfiguration` |
| AC-3 | Test | `core/platformkit-shared/presentation/a2ui_security_test.go::TestSec_EnvelopeFull_BindsScreenIDAndExtensions` |
| AC-4 | Test | `apps/platformkit-apps/internal/bootstrap/mobile_envelope_signing_test.go::TestA2UIEnvelopeSignerSeparatesNativeAppFromSelectedClient` |
| AC-5 | Test | `apps/platformkit-apps/internal/bootstrap/mobile_surface_contract_test.go::TestValidateMobileActionResponseRejectsPrepopulatedReplacementBypass`, route/action tests, and `product/platformkit-mobile/tests/shell-http-transport.test.ts` |
| AC-6 | Test | `core/platformkit-shared/presentation/a2ui_security_test.go::TestSec_VerifyDelivery`, `product/platformkit-mobile/tests/golden-fixture.test.ts`, and `shell-http-transport.test.ts` |
| AC-7 | Test | `core/platformkit-shared/presentation/a2ui_security_test.go::TestSec_EnvelopeFull_Replay`, `product/platformkit-mobile/tests/signed-delivery-state.test.ts`, and restart/replay cases in `shell-http-transport.test.ts` |
| AC-8 | Inspection | `apps/platformkit-apps/monolith/config.local.yaml`, `product/platformkit-mobile/app.config.ts`, and `.env.example` declare explicit development trust and release validation. |

## Satisfied by

- [ADR 0073 — Runtime A2UI surfaces cross an app-owned signed delivery boundary](../adr/0073-runtime-a2ui-surfaces-cross-an-app-owned-signed-delivery-boundary.md)
- [Convention C-23 — Live A2UI delivery has one app-owned signed boundary](../conventions.md#c-23-live-a2ui-delivery-has-one-app-owned-signed-boundary)
