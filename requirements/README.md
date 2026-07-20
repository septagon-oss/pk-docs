---
title: "PlatformKit Requirements"
slug: requirements
type: doc
tags: [requirements, governance]
---

# PlatformKit Requirements (REQ-NNN)

This directory holds the **functional and non-functional requirements**
the platform must satisfy. A requirement names a property of the
system as it should behave or appear to its operators, tenants, and
auditors. It survives implementation changes — swapping an auth
provider or changing the persistence engine doesn't change the REQ;
it changes the ADR that satisfies it.

Requirements are PlatformKit's public promises. They are not a
feature wishlist and they are not implementation notes. A strong REQ
states a property worth preserving across repos, modules, deployment
models, and Pro/private extensions. If the property is not valuable
enough to test, audit, or cite from code, it probably does not belong
in this catalog.

## How requirements relate to ADRs and conventions

Three layers of governance, each with a clear purpose:

| Layer | What it captures | Stability | Example |
|---|---|---|---|
| **REQ-NNN** | A property the system must hold | Survives architecture changes | REQ-001 "Multi-tenant isolation is enforced at every persistence boundary" |
| **ADR-NNNN** | The architectural decision that satisfies one or more REQs | Survives convention changes | ADR-0009 "Ports-only cross-module communication" satisfies REQ-002 |
| **C-NN** | The mechanical rule that follows from an ADR | Survives implementation changes | C-04 "Public contracts live away from implementation" — a discipline of ADR-0009 |

A reader looking at a file should see the highest-stability layer
that fits: prefer a REQ reference when the file embodies a system
property, fall back to ADR when it embodies a decision, fall back
to C when it embodies a rule.

A REQ never states the *how*. "We use Postgres" is not a REQ — it's
an ADR. The corresponding REQ is something like "Persistent state
is durable across single-node failures and replicated across
availability zones." The ADR is how we satisfy that.

## Requirement format

Every REQ follows the template in `0000-template.md`. The frontmatter
declares the requirement's category, status, and which ADRs satisfy
it. The body has four parts:

1. **Statement** — one sentence in declarative voice. The thing the
   system must do or be.
2. **Why this is a requirement** — the operator, regulator, tenant,
   or contractual reason.
3. **What "satisfied" looks like** — the observable evidence: log
   events, audit rows, behaviour under failure, latency budget.
4. **Satisfied by** — the ADRs (and, if relevant, conventions) that
   carry the implementation.

## Numbering

REQs come in three tiers — all stable, all referenceable from file
headers and tests. The number range is the tier signal:

1. **Cross-cutting REQs (REQ-NNN, no module prefix; range 001..099)**
   name properties the running system as a whole must hold (tenant
   isolation, audit per mutation, fail-closed authz, etc.). The ID is
   zero-padded to three digits; numbers have no meaning beyond stable
   referencing.
2. **Feature umbrella REQs (REQ-{MODULE}-NNN where NNN ≤ 009)** name
   the *functional* requirement of one feature inside one business
   module. The `{MODULE}` segment matches the business-module short
   tag (`AUTH`, `USER`, `TENANT`, `AUDIT`, `NOTIF`, `BILL`, `ADMIN`,
   `CONTENT`, `SITE`, `MAIL`, `CHAT`, `HEALTH`, `OP`, `ENTITLE`,
   `TRANS`, `APIKEY`) or a platform contract short tag (`SAAS`,
   `DATA`, `INFRA`, `PORTS`, `TEST`, `NAMING`). One umbrella per feature,
   capped at 9 per module or platform-contract family.
3. **Capability REQs (REQ-{MODULE}-NNN where NNN ≥ 010)** name a
   single discipline within a feature that the cross-cutting REQs
   alone cannot deliver. A capability REQ exists only when the
   capability has acceptance criteria the cross-cuttings cannot
   express; pure CRUD belongs to the umbrella, governed by the
   cross-cuttings. The lean rule is: one method (or one tightly-bound
   method group) = one REQ.

Each capability REQ declares `capability_kind:` in its frontmatter,
which records *why* the REQ earns its own existence. The taxonomy is:

- `state_machine` — non-trivial transition / lifecycle logic
- `failure_mode` — failure-mode discipline beyond the cross-cuttings
- `inter_module_contract` — a cross-module data or behaviour contract
  (one module owns, another consumes)
- `data_invariant` — a domain-specific data constraint with explicit
  acceptance criteria

Each feature REQ declares `implements_cross_cutting:` in its
frontmatter, listing the cross-cutting REQs it embodies. Each
capability REQ also declares `refines:` pointing at its feature
umbrella (within the same module). A file header carries only the
most-specific REQ (the capability one for the file that realises it;
the umbrella for shared feature code; the cross-cutting one for
platform-wide code), and each more-specific REQ links back through
`refines:` and `implements_cross_cutting:`.

The `check-traceability` guard enforces this structure; run with
`--strict-capabilities` in CI to fail any capability REQ that lacks
`capability_kind:` / `refines:` / a non-wiring `Implements:` link.

Categories are loose and live in frontmatter, not the ID:

- `tenancy` — multi-tenant isolation, namespacing, host resolution
- `auth` — authentication, authorisation, session, credentials
- `audit` — auditability, retention, traceability
- `compliance` — regulatory or contractual obligations
- `availability` — uptime, recoverability, degradation behaviour
- `performance` — latency, throughput, resource budgets
- `data-durability` — durability, consistency, migration discipline
- `governance` — workspace and code-organisation discipline (this
  category covers REQs that govern how the codebase is maintained
  rather than what the running system does)

## Capability decomposition policy (per module)

Not every feature umbrella has been decomposed into capability REQs.
The lean rule applies: a capability REQ exists only when its method
has acceptance criteria the cross-cuttings cannot deliver. Modules
fall into three states:

- **Decomposed.** The umbrella has at least one capability REQ:
  `auth_management`, `user_management`, `tenant_management`,
  `audit_management`, `api_key_management`, `notification_management`,
  `billing_management`, `content_management`, `admin_management`,
  `site_management`, `health_management`, `translation_management`,
  `entitlement_management`, `chat_management`, `mail_management`, and
  the `platformkit_ports` design authority.
- **Cross-cutting-only by design.** The feature is pure CRUD or pure
  rendering and the cross-cutting REQs (REQ-001..017) carry the entire
  discipline. No capability REQ is owed for pure rendering or other
  thin cross-cutting surfaces.
- **Partial decomposition.** `operator_management` already has a
  capability REQ for the operator surface, and its follow-on
  capability REQs should continue in the `NNN ≥ 010` range as the
  surface grows.

A module moving from "cross-cutting-only" into "decomposed" is a
deliberate decision, not drift; revisit this list when the umbrella
gains acceptance criteria the cross-cuttings cannot express.

## Index

(Maintained by hand. Cross-cutting first, then feature REQs grouped by module.)

### Cross-cutting REQs

- [REQ-001 — Multi-tenant isolation at every persistence boundary](./REQ-001-multi-tenant-isolation.md)
- [REQ-002 — Modules are independently deployable](./REQ-002-independently-deployable-modules.md)
- [REQ-003 — Authentication failures must not leak account existence](./REQ-003-no-account-enumeration.md)
- [REQ-004 — Every entity mutation produces an audit event](./REQ-004-audit-event-per-mutation.md)
- [REQ-005 — Authorisation gates fail closed under transient errors](./REQ-005-authorisation-fails-closed.md)
- [REQ-006 — Migrations are forward-only and idempotent](./REQ-006-forward-only-migrations.md)
- [REQ-007 — Cross-tenant access is explicit and labelled](./REQ-007-explicit-cross-tenant-access.md)
- [REQ-008 — Every Go file declares its purpose](./REQ-008-every-file-declares-purpose.md)
- [REQ-009 — Every operation produces traceable, measurable, and loggable signals](./REQ-009-observability-everywhere.md)
- [REQ-010 — Runtime configuration is environment-bound; no secrets in source](./REQ-010-configuration-environment-bound.md)
- [REQ-011 — Design tokens are the single source of truth for visual semantics](./REQ-011-design-tokens-source-of-truth.md)
- [REQ-012 — Mobile shell composes module + client packs at build time](./REQ-012-mobile-build-time-composition.md)
- [REQ-013 — Third-party integration adapters isolate external API boundaries](./REQ-013-integration-adapters-isolated.md)
- [REQ-014 — External calls degrade gracefully under transient failure](./REQ-014-graceful-degradation.md)
- [REQ-015 — Test infrastructure is shared, deterministic, and reproducible](./REQ-015-test-infrastructure-shared.md)
- [REQ-016 — Module composition is declarative via Fx](./REQ-016-fx-composition-declarative.md)
- [REQ-017 — Platform agent surfaces authenticate as service-account principals](./REQ-017-platform-agent-principal-substitution.md)
- [REQ-018 — Renderable entities declare read permissions; renderer fails closed on undeclared](./REQ-018-permission-coverage-fail-closed.md)
- [REQ-019 — Live A2UI delivery is signed, audience-bound, and replay-resistant](./REQ-019-live-a2ui-delivery-is-signed-and-replay-resistant.md)
- [REQ-020 — Warm platform-owned interactions meet the percentile latency objective](./REQ-020-warm-platform-owned-interactions-meet-the-latency-objective.md)

### Feature REQs by module

#### Shared quality authority (REQ-TEST-NNN)

- [REQ-TEST-001 — Shared quality primitives execute deterministically and preserve governed evidence](./REQ-TEST-001-shared-quality-authority.md)

#### Canonical naming authority (REQ-NAMING-NNN)

- [REQ-NAMING-001 — Canonical identifier and source-layout grammar](./REQ-NAMING-001-canonical-identifier-layout-grammar.md)

#### SaaS control plane (REQ-SAAS-NNN)

- [REQ-SAAS-001 — Governed lifecycle transitions](./REQ-SAAS-001-governed-lifecycle-transitions.md)
- [REQ-SAAS-002 — Commercial projection reconciliation](./REQ-SAAS-002-commercial-projection-reconciliation.md)
- [REQ-SAAS-003 — Durable resumable execution](./REQ-SAAS-003-durable-resumable-execution.md)

#### data lifecycle assurance (REQ-DATA-NNN)

- [REQ-DATA-001 — Recovery evidence gate](./REQ-DATA-001-recovery-evidence-gate.md)
- [REQ-DATA-002 — Tenant-data governance evidence gate](./REQ-DATA-002-tenant-data-governance-gate.md)
- [REQ-DATA-003 — Executable recovery drill](./REQ-DATA-003-executable-recovery-drill.md)
- [REQ-DATA-004 — Executable tenant-data drill](./REQ-DATA-004-executable-tenant-data-drill.md)

#### infrastructure deployment lifecycle (REQ-INFRA-NNN)

- [REQ-INFRA-004 — Request-derived deployment verification](./REQ-INFRA-004-request-derived-verification.md)
- [REQ-INFRA-005 — Reproducible deployment artifact identity](./REQ-INFRA-005-deployment-artifact-identity.md)
- [REQ-INFRA-006 — Serialized closed-loop deployment](./REQ-INFRA-006-closed-loop-deployment.md)
- [REQ-INFRA-007 — Exact verified-baseline rollback](./REQ-INFRA-007-verified-baseline-rollback.md)

#### platformkit_ports design authority (REQ-PORTS-NNN)

Feature umbrellas (NNN ≤ 009):

- [REQ-PORTS-001 — Port contract identity](./REQ-PORTS-001-port-contract-identity.md)
- [REQ-PORTS-002 — Typed event and schema authority](./REQ-PORTS-002-typed-event-schema-authority.md)
- [REQ-PORTS-003 — Code-authored module descriptor](./REQ-PORTS-003-code-authored-module-descriptor.md)
- [REQ-PORTS-004 — Portable error taxonomy](./REQ-PORTS-004-portable-error-taxonomy.md)
- [REQ-PORTS-005 — Authored contract index](./REQ-PORTS-005-authored-contract-index.md)
- [REQ-PORTS-006 — Port admission and conformance](./REQ-PORTS-006-port-admission-conformance.md)

Capability-level (NNN ≥ 010):

- [REQ-PORTS-010 — Audit port provider](./REQ-PORTS-010-audit-port-provider.md)
- [REQ-PORTS-011 — Audit driver conformance](./REQ-PORTS-011-audit-driver-conformance.md)
- [REQ-PORTS-012 — Typed event transport](./REQ-PORTS-012-typed-event-transport.md)
- [REQ-PORTS-013 — Event driver conformance](./REQ-PORTS-013-event-driver-conformance.md)
- [REQ-PORTS-014 — Authorization contract](./REQ-PORTS-014-authorization-contract.md)
- [REQ-PORTS-015 — Authorization driver conformance](./REQ-PORTS-015-authorization-driver-conformance.md)
- [REQ-PORTS-016 — Structured-log audit adapter](./REQ-PORTS-016-structured-log-audit-adapter.md)
- [REQ-PORTS-017 — Channel event adapter](./REQ-PORTS-017-channel-event-adapter.md)
- [REQ-PORTS-018 — Static authorization adapter](./REQ-PORTS-018-static-authorization-adapter.md)
- [REQ-PORTS-019 — Entitlement contract and OSS default](./REQ-PORTS-019-entitlement-contract-and-oss-default.md)
- [REQ-PORTS-020 — Tenancy port provider](./REQ-PORTS-020-tenancy-port-provider.md)
- [REQ-PORTS-021 — Domain vocabulary admission gate](./REQ-PORTS-021-domain-vocabulary-admission-gate.md)
- [REQ-PORTS-022 — Conformance-kit admission gate](./REQ-PORTS-022-conformance-kit-admission-gate.md)
- [REQ-PORTS-023 — Tenancy port and immutable catalog](./REQ-PORTS-023-tenancy-port-and-immutable-catalog.md)
- [REQ-PORTS-024 — Surface vocabulary authority](./REQ-PORTS-024-surface-vocabulary-authority.md)
- [REQ-PORTS-025 — Manifest surface hygiene](./REQ-PORTS-025-manifest-surface-hygiene.md)

#### auth_management (REQ-AUTH-NNN)

Feature umbrellas (NNN ≤ 009):

- [REQ-AUTH-001 — Authentication](./REQ-AUTH-001-authentication.md)
- [REQ-AUTH-002 — Registration](./REQ-AUTH-002-registration.md)
- [REQ-AUTH-003 — Two-factor authentication](./REQ-AUTH-003-twofactor.md)
- [REQ-AUTH-004 — Permissions](./REQ-AUTH-004-permissions.md)
- [REQ-AUTH-005 — Policy](./REQ-AUTH-005-policy.md)
- [REQ-AUTH-006 — Auth provider](./REQ-AUTH-006-auth-provider.md)
- [REQ-AUTH-007 — SCIM provisioning](./REQ-AUTH-007-scim-provisioning.md)

Capability-level (NNN ≥ 010):

- [REQ-AUTH-010 — Login credentials](./REQ-AUTH-010-login-credentials.md)
- [REQ-AUTH-011 — Refresh token](./REQ-AUTH-011-refresh-token.md)
- [REQ-AUTH-012 — Logout](./REQ-AUTH-012-logout.md)
- [REQ-AUTH-013 — MFA challenge](./REQ-AUTH-013-mfa-challenge.md)
- [REQ-AUTH-014 — Login rate limit](./REQ-AUTH-014-login-rate-limit.md)
- [REQ-AUTH-015 — Forgot password](./REQ-AUTH-015-forgot-password.md)
- [REQ-AUTH-016 — Token verification](./REQ-AUTH-016-token-verification.md)
- [REQ-AUTH-017 — Session lifecycle](./REQ-AUTH-017-session-lifecycle.md)
- [REQ-AUTH-020 — Account create](./REQ-AUTH-020-account-create.md)
- [REQ-AUTH-021 — Email verification](./REQ-AUTH-021-email-verification.md)
- [REQ-AUTH-022 — Password reset](./REQ-AUTH-022-password-reset.md)
- [REQ-AUTH-023 — Availability check](./REQ-AUTH-023-availability-check.md)
- [REQ-AUTH-024 — Resend verification](./REQ-AUTH-024-resend-verification.md)
- [REQ-AUTH-025 — Magic-link tenant self-enrollment](./REQ-AUTH-025-magic-link-self-enrollment.md)
- [REQ-AUTH-026 — Interactive-provider tenant self-enrollment](./REQ-AUTH-026-interactive-provider-self-enrollment.md)
- [REQ-AUTH-030 — TOTP enrollment](./REQ-AUTH-030-totp-enrollment.md)
- [REQ-AUTH-031 — TOTP verification](./REQ-AUTH-031-totp-verification.md)
- [REQ-AUTH-032 — Backup-code recovery](./REQ-AUTH-032-backup-code-recovery.md)
- [REQ-AUTH-040 — Permission check](./REQ-AUTH-040-permission-check.md)
- [REQ-AUTH-050 — Policy state machine](./REQ-AUTH-050-policy-state-machine.md)
- [REQ-AUTH-051 — Policy cross-tenant guard](./REQ-AUTH-051-policy-cross-tenant.md)
- [REQ-AUTH-060 — Auth-provider catalogue](./REQ-AUTH-060-auth-provider-catalogue.md)
- [REQ-AUTH-061 — Connection runtime test](./REQ-AUTH-061-connection-runtime-test.md)

#### user_management (REQ-USER-NNN)

Feature umbrellas (NNN ≤ 009):

- [REQ-USER-001 — User](./REQ-USER-001-user.md)
- [REQ-USER-002 — Profile](./REQ-USER-002-profile.md)
- [REQ-USER-003 — Preferences](./REQ-USER-003-preferences.md)
- [REQ-USER-004 — Registration onboarding](./REQ-USER-004-registration.md)

Capability-level (NNN ≥ 010):

- [REQ-USER-010 — User create](./REQ-USER-010-user-create.md)
- [REQ-USER-011 — User update](./REQ-USER-011-user-update.md)
- [REQ-USER-012 — User lifecycle](./REQ-USER-012-user-lifecycle.md)
- [REQ-USER-020 — Profile read with privacy filter](./REQ-USER-020-profile-read-privacy.md)

#### tenant_management (REQ-TENANT-NNN)

Feature umbrellas (NNN ≤ 009):

- [REQ-TENANT-001 — Tenant lifecycle](./REQ-TENANT-001-tenant-lifecycle.md)
- [REQ-TENANT-002 — Member management](./REQ-TENANT-002-member-management.md)
- [REQ-TENANT-003 — Onboarding](./REQ-TENANT-003-onboarding.md)
- [REQ-TENANT-004 — Workspace management](./REQ-TENANT-004-workspace-management.md)
- [REQ-TENANT-005 — Identity connections](./REQ-TENANT-005-identity-connections.md)

Capability-level (NNN ≥ 010):

- [REQ-TENANT-010 — Tenant create](./REQ-TENANT-010-tenant-create.md)
- [REQ-TENANT-011 — Tenant update + archive](./REQ-TENANT-011-tenant-update-archive.md)
- [REQ-TENANT-012 — Host alias resolution](./REQ-TENANT-012-host-alias-resolution.md)
- [REQ-TENANT-020 — Member management](./REQ-TENANT-020-member-management.md)
- [REQ-TENANT-030 — Identity-connection CRUD](./REQ-TENANT-030-identity-connection-crud.md)
- [REQ-TENANT-040 — Workspace management](./REQ-TENANT-040-workspace-management.md)

#### api_key_management (REQ-APIKEY-NNN)

Feature umbrellas (NNN ≤ 009):

- [REQ-APIKEY-001 — Key management](./REQ-APIKEY-001-key-management.md)

Capability-level (NNN ≥ 010):

- [REQ-APIKEY-010 — API key create](./REQ-APIKEY-010-api-key-create.md)
- [REQ-APIKEY-011 — API key validate](./REQ-APIKEY-011-api-key-validate.md)
- [REQ-APIKEY-012 — API key rotate + revoke](./REQ-APIKEY-012-api-key-rotate-revoke.md)
- [REQ-APIKEY-013 — API key rate limit](./REQ-APIKEY-013-api-key-rate-limit.md)
- [REQ-APIKEY-014 — Platform key ensure](./REQ-APIKEY-014-platform-key-ensure.md)

#### audit_management (REQ-AUDIT-NNN)

Feature umbrellas (NNN ≤ 009):

- [REQ-AUDIT-001 — Audit trail](./REQ-AUDIT-001-audit-trail.md)
- [REQ-AUDIT-002 — Audit events](./REQ-AUDIT-002-audit-events.md)
- [REQ-AUDIT-003 — Audit reports](./REQ-AUDIT-003-audit-reports.md)
- [REQ-AUDIT-004 — Audit compliance](./REQ-AUDIT-004-audit-compliance.md)
- [REQ-AUDIT-005 — Change approval](./REQ-AUDIT-005-change-approval.md)
- [REQ-AUDIT-006 — Digital signature](./REQ-AUDIT-006-digital-signature.md)

Capability-level (NNN ≥ 010):

- [REQ-AUDIT-010 — Audit record](./REQ-AUDIT-010-audit-record.md)
- [REQ-AUDIT-011 — Audit query + integrity](./REQ-AUDIT-011-audit-query-integrity.md)
- [REQ-AUDIT-012 — Audit retention + cleanup](./REQ-AUDIT-012-audit-retention-cleanup.md)
- [REQ-AUDIT-013 — Compliance check](./REQ-AUDIT-013-compliance-check.md)
- [REQ-AUDIT-014 — Audit data export formats](./REQ-AUDIT-014-export-formats.md)

#### health_management (REQ-HEALTH-NNN)

Feature umbrellas (NNN ≤ 009):

- [REQ-HEALTH-001 — Health monitoring](./REQ-HEALTH-001-health-monitoring.md)

Capability-level (NNN ≥ 010):

- [REQ-HEALTH-010 — Health registry](./REQ-HEALTH-010-health-registry.md)
- [REQ-HEALTH-011 — Aggregated health check](./REQ-HEALTH-011-aggregated-check.md)
- [REQ-HEALTH-012 — Alert derivation](./REQ-HEALTH-012-alert-derivation.md)

#### notification_management (REQ-NOTIF-NNN)

Feature umbrellas (NNN ≤ 009):

- [REQ-NOTIF-001 — Email notifications](./REQ-NOTIF-001-email-notifications.md)
- [REQ-NOTIF-002 — In-app notifications](./REQ-NOTIF-002-in-app-notifications.md)
- [REQ-NOTIF-003 — Push notifications](./REQ-NOTIF-003-push-notifications.md)
- [REQ-NOTIF-004 — SMS notifications](./REQ-NOTIF-004-sms-notifications.md)
- [REQ-NOTIF-005 — WhatsApp notifications](./REQ-NOTIF-005-whatsapp-notifications.md)

Capability-level (NNN ≥ 010):

- [REQ-NOTIF-010 — Channel gate](./REQ-NOTIF-010-channel-gate.md)
- [REQ-NOTIF-011 — Send orchestration](./REQ-NOTIF-011-send-orchestration.md)
- [REQ-NOTIF-012 — In-app read-state](./REQ-NOTIF-012-in-app-read-state.md)

#### chat_management (REQ-CHAT-NNN)

Feature umbrellas (NNN ≤ 009):

- [REQ-CHAT-001 — Messaging](./REQ-CHAT-001-messaging.md)
- [REQ-CHAT-002 — Public chat](./REQ-CHAT-002-public-chat.md)

Capability-level (NNN ≥ 010):

- [REQ-CHAT-010 — Send message](./REQ-CHAT-010-send-message.md)
- [REQ-CHAT-011 — Room lifecycle](./REQ-CHAT-011-room-lifecycle.md)
- [REQ-CHAT-012 — Public chat with assistant](./REQ-CHAT-012-public-chat-assistant.md)

#### mail_management (REQ-MAIL-NNN)

Feature umbrellas (NNN ≤ 009):

- [REQ-MAIL-001 — Mail tracking](./REQ-MAIL-001-mail-tracking.md)
- [REQ-MAIL-002 — Package tracking](./REQ-MAIL-002-package-tracking.md)

Capability-level (NNN ≥ 010):

- [REQ-MAIL-010 — Mail item lifecycle](./REQ-MAIL-010-mail-item-lifecycle.md)
- [REQ-MAIL-011 — Package lifecycle](./REQ-MAIL-011-package-lifecycle.md)

#### billing_management (REQ-BILL-NNN)

Feature umbrellas (NNN ≤ 009):

- [REQ-BILL-001 — Subscriptions](./REQ-BILL-001-subscriptions.md)

Capability-level (NNN ≥ 010):

- [REQ-BILL-010 — Subscription create](./REQ-BILL-010-subscription-create.md)
- [REQ-BILL-011 — Subscription lifecycle](./REQ-BILL-011-subscription-lifecycle.md)
- [REQ-BILL-012 — Plan change](./REQ-BILL-012-plan-change.md)
- [REQ-BILL-013 — Payment-status events](./REQ-BILL-013-payment-status.md)
- [REQ-BILL-014 — Usage metering](./REQ-BILL-014-usage-metering.md)
- [REQ-BILL-015 — Subscription FSM](./REQ-BILL-015-subscription-fsm.md)

#### entitlement_management (REQ-ENTITLE-NNN)

Feature umbrellas (NNN ≤ 009):

- [REQ-ENTITLE-001 — Grants](./REQ-ENTITLE-001-grants.md)

Capability-level (NNN ≥ 010):

- [REQ-ENTITLE-010 — Grant subscriber](./REQ-ENTITLE-010-grant-subscriber.md)

#### admin_management (REQ-ADMIN-NNN)

Feature umbrellas (NNN ≤ 009):

- [REQ-ADMIN-001 — Admin](./REQ-ADMIN-001-admin.md)
- [REQ-ADMIN-002 — Dashboard](./REQ-ADMIN-002-dashboard.md)
- [REQ-ADMIN-003 — Default CRUD renderer](./REQ-ADMIN-003-default-crud-renderer.md)
- [REQ-ADMIN-004 — Design tokens](./REQ-ADMIN-004-design-tokens.md)
- [REQ-ADMIN-005 — Discovery](./REQ-ADMIN-005-discovery.md)
- [REQ-ADMIN-006 — Ecosystem search](./REQ-ADMIN-006-ecosystem-search.md)
- [REQ-ADMIN-007 — Job monitoring](./REQ-ADMIN-007-job-monitoring.md)
- [REQ-ADMIN-008 — Admin profile](./REQ-ADMIN-008-profile.md)
- [REQ-ADMIN-009 — Settings](./REQ-ADMIN-009-settings.md)

Capability-level (NNN ≥ 010):

- [REQ-ADMIN-010 — Settings resolver](./REQ-ADMIN-010-settings-resolver.md)
- [REQ-ADMIN-011 — Settings outbox publication](./REQ-ADMIN-011-settings-outbox.md)
- [REQ-ADMIN-012 — Permission resolver wiring](./REQ-ADMIN-012-permission-resolver.md)
- [REQ-ADMIN-013 — Dashboard rendering](./REQ-ADMIN-013-dashboard-rendering.md)
- [REQ-ADMIN-014 — Ecosystem search](./REQ-ADMIN-014-ecosystem-search.md)
- [REQ-ADMIN-015 — Discovery route plans](./REQ-ADMIN-015-discovery-route-plan.md)

#### operator_management (REQ-OP-NNN)

- [REQ-OP-001 — Operator](./REQ-OP-001-operator.md)

#### content_management (REQ-CONTENT-NNN)

Feature umbrellas (NNN ≤ 009):

- [REQ-CONTENT-001 — Articles](./REQ-CONTENT-001-articles.md)
- [REQ-CONTENT-002 — Categories](./REQ-CONTENT-002-categories.md)

Capability-level (NNN ≥ 010):

- [REQ-CONTENT-010 — Article create](./REQ-CONTENT-010-article-create.md)
- [REQ-CONTENT-011 — Article publish lifecycle](./REQ-CONTENT-011-article-publish-lifecycle.md)
- [REQ-CONTENT-012 — Article query](./REQ-CONTENT-012-article-query.md)
- [REQ-CONTENT-013 — RSS feed](./REQ-CONTENT-013-rss-feed.md)
- [REQ-CONTENT-014 — Category navigation](./REQ-CONTENT-014-category-navigation.md)

#### site_management (REQ-SITE-NNN)

Feature umbrellas (NNN ≤ 009):

- [REQ-SITE-001 — Homepage](./REQ-SITE-001-homepage.md)
- [REQ-SITE-002 — Demo](./REQ-SITE-002-demo.md)

Capability-level (NNN ≥ 010):

- [REQ-SITE-010 — Homepage content loader](./REQ-SITE-010-homepage-content-loader.md)
- [REQ-SITE-011 — Public content shell](./REQ-SITE-011-public-shell.md)

#### translation_management (REQ-TRANS-NNN)

Feature umbrellas (NNN ≤ 009):

- [REQ-TRANS-001 — Translations](./REQ-TRANS-001-translations.md)

Capability-level (NNN ≥ 010):

- [REQ-TRANS-010 — Translation merge](./REQ-TRANS-010-merge-store.md)
- [REQ-TRANS-011 — Translation parsing](./REQ-TRANS-011-parsing.md)

## Authoring a new REQ

1. Copy `0000-template.md` to `REQ-NNN-short-slug.md` with the next
   free number.
2. Fill in the four sections.
3. Update the index above.
4. Update each ADR that satisfies the new REQ to add the
   `Satisfies REQs:` frontmatter line.
5. Land the REQ in a single commit so reviewers can see the
   requirement as a coherent unit.

## References

- [ADR 0029 — Every Go file declares its purpose](../adr/0029-every-file-declares-its-purpose.md)
- [Convention C-14 — Every Go file declares its purpose](../conventions.md#c-14-every-go-file-declares-its-purpose)
- [`pk-docs/conventions.md`](../conventions.md)
- [`pk-docs/adr/`](../adr/)
