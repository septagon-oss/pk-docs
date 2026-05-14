---
title: "ADR 0025: Mobile surfaces are module-owned capabilities composed by apps"
status: Proposed
date: 2026-05-03
slug: adr-0025-module-owned-mobile-surfaces
adr_topic: mobile-architecture
type: doc
tags: [adr, mobile, modules, surfaces, composition]
---

# ADR 0025 — Mobile surfaces are module-owned capabilities composed by apps

Status: **Proposed** (2026-05-03)

## The problem

The first tenant mobile app proved the useful thing and exposed the weak thing
at the same time. A generic Expo shell can load a server-driven PlatformKit
surface, apply tenant theme tokens, survive network failure, and install as a
tenant-specific native app. But the moment the app needed a real booking flow,
it became tempting to put booking semantics directly in the complete-saas mobile
runtime.

That is the wrong boundary. If "request an appointment" lives in an app
bootstrap, the same mistake will repeat for invoices, memberships, support
tickets, orders, approvals, files, and every future vertical workflow. The app
would become a pile of tenant-specific business shortcuts with a generic shell
painted over it. That breaks the PlatformKit promise: modules are the lego
blocks, apps compose them, and delivery channels should not own domain rules.

The blank mobile home incident sharpened the same point from the rendering
side. The server emitted a root ID the client could not find. The client now
defends against that, but resilience is not a substitute for ownership. Surface
shape, action IDs, action handlers, and data loading need to come from typed,
module-owned contracts and app-owned composition, not ad hoc topology wiring.

## The decision

Mobile surfaces are module-owned capabilities, composed by apps and rendered by
a generic shell.

A business module owns the semantics of any workflow it exposes on mobile:
inputs, validation, action IDs, service calls, source labels, and domain
extensions. The module may expose those through ports, transport-safe helpers,
or `app/module.MobileCapabilityProvider`. The app owns composition:
which module capabilities appear in a given tenant app, in what order, under
which shell profile, and with which tenant policy. The mobile client owns only
generic runtime concerns: discovery, auth/session handling, rendering,
navigation, offline snapshots, action transport, and tenant design tokens.

The package direction is therefore:

- `pk-modules/<module>/...` owns domain-specific mobile
  forms, actions, projections, and port-backed handlers.
- `pk-modules/ports/` owns cross-module service interfaces.
- `platformkit-backend-kit/app/module.MobileCapabilityProvider` is the current
  runtime provider seam for module-owned mobile manifests, screens, and
  actions.
- `platformkit-shared/presentation` owns the neutral mobile component/action
  contract.
- `platformkit-apps/surfacecatalog/` should become the long-term home for
  app-owned mobile and operator surface presets.
- `complete-saas-*/*/bootstrap` may wire topology and route transport, but it
  must not become the long-term home for module business behavior.
- `platformkit-mobile` renders the contract and applies tenant customization;
  it must not special-case one vertical, client, or future tenant.

Not every module needs a bespoke mobile screen. Every module that exposes a
user, member, operator, or approval workflow must expose that workflow as a
module-owned capability. Infrastructure-only modules can remain invisible to
mobile except through status, admin, or operator projections.

## What we gave up

- Speed in the first app. Adding a mobile workflow now means adding or extending
  a module capability instead of patching one bootstrap file.
- Some duplication at the beginning. Until `surfacecatalog/` is the default,
  monolith and microservices routes still need small wiring changes.
- A looser demo loop. Tenant-specific mock data is not enough when the app is
  supposed to prove real module integration.
- A simple mental model for designers. Visual polish now depends on contract,
  module capability, app composition, and tenant tokens all being correct.

## What we kept

- The same module can power monolith, microservices, web, mobile, and operator
  surfaces through ports and shared presentation contracts.
- Tenant apps stay tenant-specific in delivery and brand, but generic in code.
- Business behavior remains testable without an Expo runtime.
- The app layer can build vertical experiences by arranging module blocks
  instead of forking tenant apps.

## How we enforce it

- Review rule — no new tenant-specific or module-specific domain behavior in
  `platformkit-mobile`. The mobile app may render component types and runtime
  states, but it may not know what a booking, invoice, membership, or ticket
  means.
- Review rule — no new module business action should live primarily in
  `complete-saas-monolith/internal/bootstrap` or
  `complete-saas-microservices/internal/bootstrap`. Topology bootstraps may
  inject ports and route actions to module-owned handlers.
- Review rule — module mobile actions must use ports or module-owned services,
  following [ADR 0009](./0009-ports-only-cross-module-communication.md).
- Review rule — public module capabilities that can cross the monolith /
  microservices boundary must preserve transport symmetry under
  [ADR 0019](./0019-dual-path-transport-symmetry.md).
- Test rule — every mobile surface emitted by a server runtime must have a
  `root` that references an emitted component. This caught the blank home
  failure.
- Test rule — every app-wired module action should have a test proving that the
  action delegates to the module capability, not just that the UI changes.
- Gap — there is no app-level `surfacecatalog/` composition path for mobile
  presets yet. The current bridge is module-owned `MobileCapabilityProvider`
  implementations plus explicit app wiring. The follow-up is to compose those
  providers through `platformkit-apps/surfacecatalog/`, parallel to admin
  surface contributions.

The initial rollout order should be practical, not exhaustive:

1. `auth_management`, `user_management`, and `tenant_management` — login,
   session, MFA, profile identity, and tenant context must be native-quality
   before any tenant app feels real.
2. `site_management`, `siteprofile`, and `translation_management` — tenant
   identity, design tokens, public profile, and localized app context.
3. `notification_management`, `mail_management`, and `chat_management` —
   confirmations, reminders, in-app messages, mail/package workflows, and help.
4. `billing_management` and `entitlement_management` — account state, plan
   status, access, and commercial lifecycle where the OSS build owns those
   surfaces.
5. Vertical modules from private/client distributions — compose only when a
   tenant app actually needs those workflows, and keep their mobile behavior in
   the owning module rather than in the generic app shell.
6. Operator modules from private/client distributions — compose into
   operator/admin mobile surfaces, not member-facing tenant apps by default.

## References

- [ADR 0002 — Product composition is a typed contract, not app glue](./0002-surface-manifests-and-shell-profiles.md).
- [ADR 0009 — Modules only talk through ports](./0009-ports-only-cross-module-communication.md).
- [ADR 0019 — Every port works over HTTP and NATS](./0019-dual-path-transport-symmetry.md).
- [ADR 0024 — Page assets are module-owned and loaded by declaration](./0024-module-owned-page-assets.md).
- [ADR 0028 — Domain modules own security decisions and delivery modules deliver messages](./0028-domain-owned-security-and-delivery-capabilities.md).
- `platformkit-apps/docs/reference-surface-manifest-compositions-task.md`.
- `pk-modules/auth_management/mobileauth/`.
- `platformkit-apps/internal/bootstrap/complete_saas_mobile_runtime.go`.
