---
id: REQ-AUTH-061
title: "Connection runtime test exercises the configured AuthProvider per purpose without persisting state"
status: Proposed
date: 2026-05-08
slug: req-auth-061-connection-runtime-test
category: auth
ears_pattern: event-driven
priority: must
risk: medium
verification_methods: [test]
compliance:
  - SOC2_CC7.2
  - ISO27001_A.12.4
satisfied_by:
  adr: [ADR-0009]
  conventions: [C-04, C-14]
implements_cross_cutting: [REQ-001, REQ-009, REQ-013]
refines: REQ-AUTH-006
depends_on: [REQ-AUTH-060]
type: doc
tags: [requirement, capability, auth_management, auth_provider, connection_test]
module: auth_management
feature: auth_provider
capability: connection_runtime_test
capability_kind: failure_mode
stakeholders:
  - tenant administrator (debugging SSO before going live)
  - operator (post-incident SSO sanity check)
  - integration partner (validating IdP wiring)
---

# REQ AUTH-061 — Connection runtime test

Status: **Proposed** (2026-05-08)

## Statement

**When** an administrator invokes `TestConnection` for a
`TenantIdentityConnection`, the auth-provider feature **shall**
resolve the request tenant, look up the connection record, derive
the test purpose (explicit `purpose` field, else the connection's
own enabled flag), validate the record's static configuration
against that purpose, and — if validation passes — exercise the
configured `AuthProvider` adapter through the
`backendidentity.{Interactive,Provisioning,AuthenticationMetadata}Runtime`
optional interface that matches the connection's provider type.

The runtime check **shall not** persist any state on the connection
record, **shall not** mint a session, **shall not** disclose
provider-side secret material in the response, and **shall** carry
the connection's tenant + key in the runtime metadata so the adapter
can pick the right credential bundle without the catalogue handing
it raw secrets.

## Rationale

A live SSO configuration that fails at first user login is a
support-load disaster — the user sees an opaque 500, the operator
sees no signal, and the tenant blames the platform. The
"test connection" surface is the early-warning that catches the
problem during configuration: before the connection goes live, the
admin clicks "Test" and the platform actually tries the provider
hand-off. This REQ encodes three guarantees:

1. **Adapter-correctness, not stub-correctness.** The runtime check
   must reach the *configured* `AuthProvider`, not a mock that
   merely re-states the static config. If the adapter the tenant
   will actually use can't begin an OIDC flow, the test must say so.
2. **No persistence.** Test calls run unbounded times during
   configuration — they must never write to the connection record,
   the session repository, or the audit row counters in a way that
   muddies the production timeline. Audit rows for *failed test
   runs* are out of scope here; success/failure goes in the
   structured log, not the audit ledger.
3. **Purpose-aware dispatch.** A login-only connection tests the
   interactive (or metadata) runtime; a provisioning connection
   tests the SCIM `Describe` path. A connection that does both
   must be testable on each side independently, because the two
   adapters can be configured at different times and may break
   independently.

The adapter contract is consumed via Go's optional-interface idiom
(`runtime, ok := h.authProvider.(backendidentity.InteractiveRuntime)`).
A provider that does not implement the runtime interface for the
asked-for purpose is treated as a clean test failure (with a
diagnostic message) rather than a panic — because production code
will see exactly the same failure shape.

## Acceptance criteria

- **AC-1 — Tenant resolution.** The handler resolves the tenant
  from `appcontext` (or the explicit `Tenant` query parameter)
  before any catalog lookup; an unresolvable tenant fails before
  the connection is read.
- **AC-2 — Static validation precedes runtime.** The connection's
  required fields for the requested purpose are validated first;
  if static validation fails, the response is `Valid=false` with
  the per-field diagnostics in `Errors` and `Checks`, and the
  runtime adapter is **not** invoked.
- **AC-3 — Runtime dispatch by provider type.** A `local` provider
  short-circuits with a `local_login_configuration` pass; an
  `oidc` provider dispatches `BeginAuthentication`; a `saml`
  provider dispatches `GetAuthenticationMetadata`; a
  `provisioning` purpose dispatches `ApplyProvisioning` with
  `Action=Describe`.
- **AC-4 — Optional-interface gate.** A configured `AuthProvider`
  that does not implement the required runtime interface for the
  dispatched purpose returns a typed-message check (`runtime not
  available`) rather than panicking. The response is `Valid=false`
  with the diagnostic.
- **AC-5 — Runtime metadata carries tenant + connection key.**
  The metadata passed to the runtime adapter contains the resolved
  tenant id and the connection key so the adapter can pick the
  correct credential material — verified by
  `TestConnection_UsesRuntimeWithConnectionMetadata`.
- **AC-6 — No persistence.** A test run does not write to the
  connection repository (no `Update`, no `Patch`), does not mint
  a session, and does not emit an `auth.user.authenticated` event.
- **AC-7 — Response shape is bounded.** The response carries the
  connection (without secret material), a `Valid` boolean, an
  ordered list of `Checks` (per probe step), an optional `Errors`
  list, and a timestamp — it does not surface raw provider-side
  exceptions or stack traces.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Test | `modules/platformkit-business-modules/auth_management/features/auth_provider/handlers_test.go::TestConnection_UsesRuntimeWithConnectionMetadata` — the resolution path runs before the runtime call. |
| AC-2 | Inspection | `handlers.go::TestConnection` — `validateConnectionForPurpose` runs before `runConnectionRuntimeChecks`; static failure short-circuits with no adapter invocation. Dedicated assertion test pending (tracked as test gap). |
| AC-3 | Inspection | `handlers.go::runConnectionRuntimeChecks` + `runLoginConnectionCheck` + `runProvisioningConnectionCheck` — the per-provider switch is the source of truth. Dedicated table-driven test pending. |
| AC-4 | Inspection | `handlers.go::runLoginConnectionCheck` — the `runtime, ok := h.authProvider.(backendidentity.InteractiveRuntime)` optional-interface gate produces a typed check failure, not a panic. Dedicated test pending. |
| AC-5 | Test | `modules/platformkit-business-modules/auth_management/features/auth_provider/handlers_test.go::TestConnection_UsesRuntimeWithConnectionMetadata` — asserts the runtime received tenant + connection key in `Metadata`. |
| AC-6 | Inspection | `handlers.go::TestConnection` — no `Update` / session-mint / event-emit on the runtime path. Dedicated repository-spy test pending. |
| AC-7 | Inspection | `handlers.go::ConnectionTestResponseBody` struct — the response shape's source of truth. |

## Edge cases & unhappy paths

- **Connection not found.** A connection id that doesn't exist
  in the tenant returns the typed not-found error before the
  runtime is touched.
- **Purpose ambiguity.** An empty `purpose` field on a connection
  with both `LoginEnabled` and `ProvisioningEnabled` defaults to
  login (the canonical "user-facing" path); explicit
  `purpose=provisioning` overrides.
- **Runtime panics.** A panic inside the adapter is recovered at
  the handler boundary (the adapter contract is "errors, not
  panics" — but defence-in-depth still recovers); the response
  surfaces as a typed runtime-error check.
- **Connection on archived tenant.** A test against a connection
  on an archived tenant is refused with a tenant-state error
  before the runtime is touched.
- **Network outage on adapter.** Adapter timeouts are surfaced
  verbatim in the check message — the operator needs the actual
  failure to debug; the bounded response shape (AC-7) keeps that
  message non-disclosive of secret material.

## Risk

- **Likelihood:** Medium — exercised on every IdP onboarding
  and on every "is the SSO broken?" support call.
- **Impact:** Medium — a defective test surface gives false
  confidence in a misconfigured connection, which compounds at
  the next user-login.
- **Mitigations:** Adapter-correctness (AC-3) + no-persistence
  (AC-6) + bounded response (AC-7) eliminate the silent-failure
  modes; the optional-interface gate (AC-4) eliminates the panic
  mode.

## Implements (cross-cutting)

- **REQ-001 — Multi-tenant isolation.** AC-1 + AC-5 — the runtime
  call carries the resolved tenant id; cross-tenant connection
  lookup is impossible.
- **REQ-009 — Observability.** Test outcomes (start, dispatch,
  result) are logged with the `connection_id` + `tenant_id`
  pair so support can correlate.
- **REQ-013 — Integration adapters isolated.** The adapter is
  consumed only via the optional-interface contract — the handler
  knows nothing of OIDC / SAML / SCIM specifics.

## Compliance mapping

| Control | Coverage |
|---|---|
| SOC2 CC7.2 (System monitoring) | AC-2 + AC-7 — controlled diagnostics for IdP wiring. |
| ISO27001 A.12.4 (Logging and monitoring) | AC-6 — test runs do not contaminate the production audit ledger. |

## Satisfied by

- `modules/platformkit-business-modules/auth_management/features/auth_provider/handlers.go::TestConnection` —
  the dispatch + adapter-call orchestration.
- `modules/platformkit-business-modules/auth_management/features/auth_provider/handlers.go::runConnectionRuntimeChecks` —
  the per-purpose runtime-call branch.
- `modules/platformkit-business-modules/auth_management/features/auth_provider/handlers.go::connectionRuntimeMetadata` —
  the tenant + connection-key plumbing.

## Related requirements

- [REQ-AUTH-006 — Auth provider umbrella](./REQ-AUTH-006-auth-provider.md)
- [REQ-AUTH-060 — Auth-provider catalogue](./REQ-AUTH-060-auth-provider-catalogue.md) — the CRUD surface this test sits alongside.
- [REQ-TENANT-005 — Identity connections](./REQ-TENANT-005-identity-connections.md) — the data-owner of the records under test.
