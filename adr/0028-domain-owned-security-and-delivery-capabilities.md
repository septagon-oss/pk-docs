---
title: "ADR 0028: Domain modules own security decisions and delivery modules deliver messages"
status: Accepted
date: 2026-05-05
slug: adr-0028-domain-owned-security-and-delivery-capabilities
adr_topic: module-system
type: doc
tags: [adr, modules, security, mfa, providers, composition]
---

# ADR 0028 — Domain modules own security decisions and delivery modules deliver messages

Status: **Accepted** (2026-05-05)

## The problem

The open-source extraction forced a boundary decision that will keep repeating.
When a workflow crosses authentication, notifications, mobile, jobs, and app
bootstrap, it is easy to put the code wherever the first route happens to be
wired. That is how an app bootstrap becomes an authentication system, or how a
push notification module accidentally becomes the owner of an MFA decision.

MFA push approval exposed the problem clearly. The deleted
`auth_push_approval` module looked like a separate product module, but its core
state transition was not "send a push"; it was "hold an authenticated session
pending a second factor and release it only after an approved challenge." That
is authentication behavior. Notification channels may deliver the challenge, and
mobile surfaces may render it, but neither should own whether a login is
complete.

This matters for SaaS and AI SaaS specifically. Tenant isolation, auditability,
agent identity, and delegated actions all depend on knowing which module owns a
decision. If ownership follows transport or UI convenience, the platform becomes
hard to secure, hard to split, and impossible to explain to external users.

## The decision

PlatformKit assigns ownership by the decision being made, not by the delivery
mechanism that observes or transports it.

For security-sensitive workflows, the module that owns the state transition owns
the contract, coordinator, validation, failure policy, audit hooks, and tests.
Delivery modules provide channels. App bootstraps compose the graph. Provider
packages adapt concrete vendors to the owning module's interface. This means:

- `auth_management` owns login, sessions, MFA, approval redemption, permission
  policy, and authentication failure semantics.
- `notification_management`, `mail_management`, and `chat_management` own
  delivery channels, templates, inbox/chat state, and delivery telemetry; they
  do not decide whether authentication, authorization, billing, or entitlement
  transitions are valid.
- `tenant_management` owns tenant identity and tenant lifecycle; tenant
  isolation enforcement remains a cross-cutting invariant that every stateful
  module must respect.
- `platformkit-apps/*/bootstrap` owns topology, routes, and composition only. It
  may inject an auth-owned coordinator into a mobile login route, but it must
  not own the MFA state machine.
- Provider implementations live behind contracts owned by the decision module.
  A NoOp provider may be registered by default so OSS and local builds compose,
  but security-sensitive code must fail closed when a configured provider
  errors.

The MFA approval move follows this rule. The stable contract is
`auth_management/contracts/provides.MFAApprovalService`; the coordinator and
redeem route are in `auth_management/mobileauth`; the default provider is
`auth_management/providers/mfa/noop`; the app mobile routes only call the
optional auth-owned coordinator after password authentication succeeds.

## What we gave up

- Fast vertical hacks in `platformkit-apps`. A new route can no longer absorb a
  domain rule just because it is the fastest place to patch.
- Standalone "transport modules" for every provider idea. If the lifecycle is an
  auth decision, the provider belongs behind auth, even when the user-visible
  artifact is a notification.
- Some DI simplicity. NoOp defaults are useful, but real provider replacement
  needs explicit configuration and conflict checks instead of relying on package
  import order.
- A universal "security module" bucket. Security ownership still has subdomains:
  authentication belongs in auth, tenant lifecycle in tenant, audit evidence in
  audit, and delivery evidence in notification/mail/chat.

## What we kept

- Clear bounded contexts. A future microservice split can extract auth without
  chasing MFA state through app bootstrap or notification code.
- Stronger security behavior. MFA provider failures fail closed instead of
  creating sessions through a degraded side path.
- Open-source completeness. OSS builds can include interfaces, coordinators,
  NoOp providers, and tests without shipping private vendor integrations.
- Replaceable providers. Expo, APNs, FCM, email, SMS, WhatsApp, or future agent
  channels can plug in without moving the auth decision.
- Tenant and AI safety. Agentic workflows can be reviewed by asking which module
  owns identity, authority, tenant scope, delivery, and audit evidence.

## How we enforce it

- **Review rule** — a PR adding a cross-module workflow must name the owning
  decision module before code is accepted. "The route needs it" is not an
  ownership argument.
- **Review rule** — app bootstrap may compose and route, but it may not own
  module business state machines, security decisions, or provider-specific
  domain behavior.
- **Review rule** — delivery modules may deliver, retry, template, track, and
  expose inbox/history state. They must not decide another module's lifecycle.
- **Review rule** — NoOp providers are allowed only when they make absence
  explicit. Security paths must either fall through because the capability is
  intentionally unavailable for the user, or fail closed when a configured
  provider errors.
- **Existing analyzer** — ADR 0009 still applies. Cross-module behavior goes
  through public contracts and ports, not direct imports into implementation
  packages.
- **Existing tests** — `auth_management/mobileauth` owns MFA coordinator tests:
  no-device fallthrough, pending approval creation, pending redemption, approved
  redemption, and fail-closed provider errors.
- **Gap** — provider conflict detection is still review/configuration driven.
  The follow-up is a DI/catalog check that rejects multiple concrete providers
  for the same security-sensitive interface unless a selector explicitly picks
  one.
- **Gap** — app bootstrap still registers some transport routes directly. The
  follow-up is to move more route/action registration behind module capability
  providers and app-owned surface catalogs, consistent with ADR 0025.

## References

- [ADR 0009 — Modules only talk through ports](./0009-ports-only-cross-module-communication.md).
- [ADR 0017 — Dependency injection is the composition boundary](./0017-fx-dependency-injection-as-composition.md).
- [ADR 0019 — Every port works over HTTP and NATS](./0019-dual-path-transport-symmetry.md).
- [ADR 0025 — Mobile surfaces are module-owned capabilities composed by apps](./0025-module-owned-mobile-surfaces.md).
- `pk-modules/auth_management/contracts/provides/mfa_approval.go`.
- `pk-modules/auth_management/mobileauth/approval.go`.
- `pk-modules/auth_management/providers/mfa/noop/noop.go`.
- `platformkit-apps/*/internal/bootstrap/mobile_ui_routes.go`.
- Thoughtworks, "Lightweight Architecture Decision Records" — keep important
  architectural decisions with context and consequences in source control:
  https://www.thoughtworks.com/en-us/radar/techniques/lightweight-architecture-decision-records
- ADR GitHub organization — an ADR captures one justified design choice and its
  rationale:
  https://adr.github.io/
- Microsoft Learn, "Use tactical DDD to design microservices" — bounded
  contexts and aggregates guide service boundaries:
  https://learn.microsoft.com/en-us/azure/architecture/microservices/model/tactical-domain-driven-design
- NIST SP 800-63B-4 — authentication and authenticator management guidance:
  https://www.nist.gov/publications/nist-sp-800-63b-4digital-identity-guidelines-authentication-and-authenticator
- OWASP WSTG, "Testing Multi-Factor Authentication" — MFA must be tested for
  bypass resistance:
  https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/04-Authentication_Testing/11-Testing_Multi-Factor_Authentication
- AWS SaaS Architecture Fundamentals, "Tenant isolation" — authentication and
  authorization are not sufficient by themselves for tenant isolation:
  https://docs.aws.amazon.com/whitepapers/latest/saas-architecture-fundamentals/tenant-isolation.html
