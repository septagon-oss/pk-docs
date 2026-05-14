---
id: REQ-017
title: "Platform agent surfaces authenticate as service-account principals"
status: Active
date: 2026-05-07
slug: req-017-platform-agent-principal-substitution
category: governance
ears_pattern: state-driven
verification_methods:
  - test
  - analysis
  - inspection
compliance:
  - SOC2_CC6.1
  - SOC2_CC6.6
  - SOC2_CC7.2
  - ISO27001_A.9.4
  - ISO27001_A.12.4
satisfied_by:
  adr: [ADR-0009, ADR-0028, ADR-0029]
  conventions: [C-14]
type: doc
tags: [requirement, governance, agents, identity, audit]
---

# REQ 017 — Platform agent surfaces authenticate as service-account principals

Status: **Active** (2026-05-07)

## Statement

**While** a platform-shipped agent surface (e.g. `operator.surface`)
accepts a request from an authorised human user, the system **shall**
substitute the request principal with a tenant-scoped service-account
API key for the duration of the agent run. The human's identity
**shall** be preserved as `on_behalf_of` metadata in the audit trail;
the agent runtime authority gate **shall** resolve permissions from the
API key principal, never from the human's role grants.

## Rationale

The PlatformKit operator surface (and every agent surface that follows
it) runs governed LLM workloads under `platformkit-agent-runtime`. The
runtime gates `StartRun`, `RecordAction`, and budget enforcement against
a permission token (`agent_runtime:manage`) that is intentionally
narrow — it grants the right to manage agent definitions, runs, and
budgets across a tenant. That authority is appropriate for tenant
admins administering the agent fleet; it is *not* appropriate to
require for every operator who wants to type a prompt into the
`/admin/operator` chat surface.

Two architectures were considered and rejected:

1. **Granting `agent_runtime:manage` to every operator user.** This
   over-grants. A user who is allowed to ask the operator "list active
   API keys" suddenly also has the rights to revoke runs, mutate agent
   definitions, and reconfigure budgets. The principle of least
   privilege says the operator-surface scope must be narrower than the
   agent-runtime-administrator scope.

2. **Per-call permission overrides.** A short-lived attempt added a
   `RequiredPermission` field to `AgentRunRequest`/`AgentActionRequest`
   so each call site could declare the scope it expected. This created
   a third trust path: human grants, override grants, and the canonical
   gate diverged, and the override could only be set by an in-process
   caller (so the gate was effectively soft when the call came from
   the right place). It was a pretend-distinction.

The accepted architecture treats the operator surface as an
**identity-substitution boundary**. The human authenticates the surface
itself with a narrow surface-level scope (`operator.surface:render`).
Inside the surface, the platform substitutes a tenant-scoped
service-account API key whose embedded permission scopes include
exactly what the agent loop needs (`agent_runtime:manage` plus the
tools the agent invokes). The audit trail records both — the API key
is the actor, the human is the on-behalf-of party — so forensic
"who actually pushed this button" questions remain answerable.

This pattern generalises beyond `operator.surface`. Any future
platform-shipped agent surface (mobile concierge, support assistant,
billing automation) can adopt the same substitution by ensuring its own
`(tenant, name)`-keyed service-account API key on first use.
Tenant-scoping isolates the keys; the operator on tenant A cannot read
or operate on tenant B by changing tabs.

## Acceptance criteria

- **AC-1** When `/admin/operator/render` receives a request from a
  user authorised for `operator.surface:render`, the operator handler
  invokes `appcontext.WithOperatorPrincipal(ctx, apiKeyID, userID)`
  before calling `ports.SurfaceRenderer.Render`. The LLM tier observes
  the substituted principal in ctx; downstream `agent_runtime`
  authority gates resolve their permissions from the API key, not from
  the human's role grants.

- **AC-2** `ports.APIKeyService.EnsurePlatformAPIKey(ctx, tenantID,
  name, scopes)` is idempotent. Re-calling with the same `(tenantID,
  name)` returns the existing key UUID without creating a duplicate
  row. A first-call race on the unique-constraint surfaces as a
  follow-up lookup that returns the canonical row, never as a
  caller-visible error.

- **AC-3** `auth_management.PermissionService.CheckPermission`
  dispatches by principal kind. When the principal in ctx is an API
  key, the check evaluates the key's embedded permission scopes; the
  user-role graph is not traversed. Human users continue to use the
  user-role path unchanged.

- **AC-4** Cross-tenant isolation — an API key issued for tenant A
  resolves zero permissions when the request context carries tenant
  B. The check fails closed; no permission resolved through the wrong
  tenant context.

- **AC-5** Audit attribution — every governed mutation under an API
  key principal records `actor_id = <api_key_uuid>` and stamps the
  human user UUID into the audit-row metadata under the
  `on_behalf_of` key. Both fields are queryable post-hoc.

- **AC-6** Fail-closed posture — if `EnsurePlatformAPIKey` returns an
  error, or if the principal is not substituted in ctx before the
  agent run starts, the operator handler refuses the request with a
  403 and writes a deny audit row. The agent never executes under an
  unresolved principal.

- **AC-7** End-to-end — a user holding `operator.surface:render`
  (and not `agent_runtime:manage` directly) submits a prompt at
  `/admin/operator`, the agent run completes, a typed
  `presentation.SurfaceUpdate` renders. The same flow records a run
  row whose actor is the operator API key and whose audit metadata
  carries the human's UUID.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `pk-modules/operator_management/features/operator/html_handler_test.go::TestNewHTMLRenderHandler_SwapsToOperatorPrincipal` |
| AC-1 | Test | `pk-modules/operator_management/features/operator/page_test.go::TestOperatorPagePreview_GetPathDoesNotInvokeRenderer` (regression guard: GET render of `/admin/operator?intent=…` must NOT invoke the SurfaceRenderer — only the POST handler that runs `authorizeAndSwapPrincipal` may do so) |
| AC-2 | Test | `pk-modules/api_key_management/features/key_management/ensure_platform_api_key_test.go::TestEnsurePlatformAPIKey_IdempotentAndTenantScoped` |
| AC-3 | Test | `pk-modules/auth_management/features/permissions/service_test.go::TestService_CheckPermission_APIKeyPrincipalUsesAPIKeyPermissions` |
| AC-4 | Test | `pk-modules/api_key_management/features/key_management/ensure_platform_api_key_test.go::TestEnsurePlatformAPIKey_IdempotentAndTenantScoped` (the same test asserts cross-tenant isolation; a key issued for tenant A is invisible to tenant B's lookup) |
| AC-5 | Test | `platformkit-agent-runtime/service_test.go::TestAgentRuntimeService_RecordActionUsesContextActorForPermission` and `platformkit-agent-runtime/service_test.go::TestAgentRuntimeService_RecordActionStampsOnBehalfOfMetadata` |
| AC-6 | Test | `pk-modules/operator_management/features/operator/html_handler_test.go::TestNewHTMLRenderHandler_FailsClosedWhenAPIKeyServiceMissing` |
| AC-7 | Test | `pk-modules/operator_management/tests/e2e/flows_test.go::TestOperatorFlows` — runs the `operator.render-as-service-account` flow defined in `flows.go` (build tag `e2e`) against the running composition. |
| AC-1 | Analysis | `platformkit-backend-kit/analysis/importboundary` — confirms `operator_management` does not import `api_key_management` directly; the principal swap goes through `ports.APIKeyService`. |
| AC-5 | Inspection | `platformkit-agent-runtime/service.go::recordAudit` — every audit-row writer reads the principal from ctx via `appcontext.GetOperatorPrincipalFromContext` and stamps `on_behalf_of` into the `Metadata` map when present. |

## Satisfied by

- `pk-modules/api_key_management/features/key_management/service.go::EnsurePlatformAPIKey`
  — the per-tenant service-account key issuer; idempotent on
  `(tenant_id, name)` with race-safe fallback to lookup.
- `pk-modules/auth_management/features/permissions/service.go::CheckPermission`
  — the principal-kind dispatch; API-key principals resolve from the
  key's embedded scopes, user principals use the user-role graph.
- `platformkit-backend-kit/app/appcontext/context.go::WithOperatorPrincipal`,
  `GetOperatorPrincipalFromContext` — the principal-substitution ctx
  helpers used at the operator surface boundary.
- `pk-modules/operator_management/features/operator/html_handler.go::authorizeAndSwapPrincipal`
  — the explicit boundary that authorises the human, ensures the
  service-account key, and swaps the principal in ctx before the
  LLM tier is invoked.
- `platformkit-agent-runtime/service.go::StartRun`, `RecordAction`
  — both gates resolve permissions from the principal in ctx; both
  record audit rows attributing the action to the API key with the
  human carried as `on_behalf_of` metadata.

## Compliance traceability

| Framework | Control | Evidence |
|---|---|---|
| SOC2 | CC6.1 — Logical access | The operator surface enforces an explicit user permission (`operator.surface:render`) before any privileged work happens; API-key principals carry only the scopes needed for the surface they serve. |
| SOC2 | CC6.6 — Privileged access | `agent_runtime:manage` is held by the platform's service-account API key, not by individual operators. Per-tenant key isolation prevents privileged-access lateral movement. |
| SOC2 | CC7.2 — System monitoring | Every governed mutation produces an audit row that captures both the actor (API key) and the on-behalf-of identity (human user). |
| ISO27001 | A.9.4 — System access control | Two-tier identity model: humans authorise the surface; the surface authenticates the runtime as a service-account principal. |
| ISO27001 | A.12.4 — Logging and monitoring | Audit rows are queryable on either dimension (actor or on-behalf-of) for incident reconstruction. |

## ADR and convention compliance audit

The implementation was audited against the workspace's ADRs and
conventions on 2026-05-07. Findings:

- **ADR 0009 (ports-only cross-module communication)** —
  `pk-modules/operator_management/features/operator/html_handler.go` imports
  only `ports.APIKeyService` and `ports.SurfaceRenderer`, never
  `pk-modules/api_key_management/...`. The `EnsurePlatformAPIKey` extension
  lives on the existing `ports.APIKeyService` (in
  `pk-modules/ports/api_key.go`) and is implemented
  by the `api_key_management` module, with the operator side
  consuming it through `WithCategorizedDep` in `dependencies.go`.
  ✓ Compliant.

- **ADR 0028 (domain-owned security and delivery capabilities)** —
  the principal-substitution decision is *substitution* of one
  identity for another. The token issuance, hashing, expiry, and
  revocation of the API key remain owned by `api_key_management`
  (the security/delivery owner). The operator surface is a consumer
  of that capability, not a co-owner. The agent runtime authority
  decision (whose permissions count) remains in
  `auth_management.PermissionService`. No ownership boundary is
  blurred. ✓ Compliant.

- **ADR 0029 / Convention C-14 (every Go file declares its purpose)**
  — every new file shipped under this REQ carries the canonical
  header block (`// filename.go — short summary.\n// Implements:
  REQ-017.\n// Per: ADR-XXXX.\n// Discipline: C-14.`) or
  `Validates: REQ-017#AC-N` for tests. New files: `e2e.go`,
  `tests/e2e/flows.go`, `tests/e2e/flows_test.go`,
  `ensure_platform_api_key_test.go`, the new test functions in
  `service_test.go` and `html_handler_test.go`. ✓ Compliant.

- **REQ 001 (multi-tenant isolation)** — `EnsurePlatformAPIKey`
  scopes lookups by `(tenant_id, name)`; cross-tenant collision is
  impossible by construction. Verified in
  `TestEnsurePlatformAPIKey_IdempotentAndTenantScoped` (AC-4).
  ✓ Compliant.

- **REQ 004 (audit event per mutation)** — every governed mutation
  through `agent_runtime.service.go` writes an audit row. The
  recordAudit function reads the principal from ctx via
  `appcontext.GetOperatorPrincipalFromContext` so the new principal
  shape automatically lands in the actor and on_behalf_of fields.
  ✓ Compliant.

- **REQ 005 (authorisation fails closed)** — the operator handler
  refuses the request when the API key service is missing or
  EnsurePlatformAPIKey errors. Verified in
  `TestNewHTMLRenderHandler_FailsClosedWhenAPIKeyServiceMissing` and
  `TestNewHTMLRenderHandler_FailsClosedWhenEnsurePlatformAPIKeyErrors`
  (AC-6). ✓ Compliant.

- **REQ 007 (explicit cross-tenant access)** — the API key
  principal's permissions never resolve under a different tenant's
  context. The `apiKeyPermissionEvaluator` in
  `platformkit-backend-kit/security/authn/api_key.go` enforces
  tenant equality before evaluating the embedded scopes.
  ✓ Compliant.

- **REQ 008 / ADR 0029 (every file declares its purpose)** — see
  ADR 0029 row above; covered. ✓ Compliant.

The `RequiredPermission` field on `AgentRunRequest`,
`AgentActionRequest`, and `executor.RunRequest` (introduced as a
short-lived attempt before this REQ was accepted) was reverted as
part of the same change. The default `agent_runtime:manage` gate is
restored everywhere; the operator's API key holds that scope so the
gate passes naturally. Historical context is preserved in the diff
that landed this REQ.

## Notes

- A future REQ may extend this pattern to mobile and integration agent
  surfaces; the substitution boundary already generalises.
- The end-to-end flow declared in
  `pk-modules/operator_management/tests/e2e/flows.go`
  exercises the whole identity-substitution path against the running
  showroom composition. CI runs it with the `e2e` build tag against a
  freshly-seeded postgres so a regression on any AC fails the suite
  deterministically.
