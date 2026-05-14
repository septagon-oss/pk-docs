---
id: REQ-010
title: "Runtime configuration is environment-bound; no secrets in source"
status: Active
date: 2026-05-06
slug: req-010-configuration-environment-bound
category: governance
ears_pattern: unwanted-behaviour
verification_methods:
  - analysis
  - inspection
compliance:
  - SOC2_CC6.1
  - SOC2_CC6.7
  - ISO27001_A.9.4
satisfied_by:
  adr: [ADR-0005]
  conventions: []
type: doc
tags: [requirement, governance, configuration, security, compliance]
---

# REQ 010 — Runtime configuration is environment-bound; no secrets in source

Status: **Active** (2026-05-06)

## Statement

**If** a runtime value is environment-specific (database DSN, JWT
secret, OAuth client secret, third-party API key, base URL, or feature
flag), **then** the system **shall** load it from environment
variables, mounted secrets, or the configured config provider, and
**shall not** hardcode it in source. Sample, test, and example values
are exempt only when they are explicitly marked as non-production
placeholders.

## Rationale

Hardcoded runtime values collapse multi-environment deployment into
source edits. The same binary must run across local development,
staging, and production by changing configuration, not code. The
configuration stack under `infrastructure/config/`,
`infrastructure/config/providers/viper/`, and
`infrastructure/config/openfeature/` exists specifically to keep runtime
variation outside compiled source and to make promotion between
environments predictable.

Hardcoding secrets is also an immediate credential-exposure risk. A
committed API key or signing secret leaks through repository history,
forks, caches, and CI logs, and incident response becomes credential
rotation plus forensic cleanup. PlatformKit already treats sensitive
values as runtime inputs: `JWT_SECRET_KEY` is enforced in
`security/identity/config.go`, and auth flows rely on injected values
rather than embedded literals.

The same discipline protects the per-tenant overlay model. Tenant and
environment overlays are only safe when base configuration is resolved
at runtime and can be overridden without source mutation. Authentication
flow wiring demonstrates this: `auth_management` builds `ServiceConfig`
from `cfg` and `login_service.go` derives interactive/OIDC callback
URLs from `config.BaseURL`; if that value were hardcoded, callbacks
would drift across environments and tenants.

## Acceptance criteria

- **AC-1** Every `infrastructure/config` consumer reads runtime values
  via `cfg.Get...` accessors (including typed config accessors provided
  by the loaded config object) rather than hardcoded environment-specific
  literals.
- **AC-2** Git history and current workspace contain no committed
  credentials or secrets; a gitleaks/trufflehog-style secret scan
  returns no confirmed leaks.
- **AC-3** The configuration provider remains pluggable through
  `infrastructure/config/providers/` so runtime sources can be swapped
  without changing business-module code.
- **AC-4** Tests use overridable defaults via testutil-style helpers so
  runtime config inputs can be replaced per test without source edits.

## Verification

| AC | Method | Evidence |
|---|---|---|
| AC-1 | Inspection | Code-review checklist over `pk-modules/infrastructure/module.go` (provider selection via `cfg.GetServiceProvider(...)`), `pk-modules/auth_management/features/authentication/feature.go` (service config from `cfg`), and `pk-modules/auth_management/features/authentication/login_service.go` (callback URL derived from `config.BaseURL`, not literal host secrets). |
| AC-2 | Inspection | CI workflow runs `gitleaks detect` and/or `trufflehog git file://.` with fail-on-findings policy; reviewers confirm no verified secret findings before release. _Verification gap: when the CI workflow file lands in-repo, link this row to its file path._ |
| AC-3 | Inspection | Review `platformkit-backend-kit/infrastructure/config/interfaces.go`, `platformkit-backend-kit/infrastructure/config/providers/viper/loader.go`, and `platformkit-backend-kit/infrastructure/config/registry.go` to confirm provider abstraction and swappable provider wiring through `providers/`. |
| AC-4 | Inspection | Review test helpers and defaults in `platformkit-backend-kit/infrastructure/config/builder_test.go`, `platformkit-backend-kit/infrastructure/config/providers/viper/loader_env_test.go`, and `pk-modules/auth_management/features/authentication/service_test.go` (`defaultTestService`, `testutil.*`) to confirm override-friendly test configuration. |

## Satisfied by

- [ADR 0005 — Error-handling discipline](../adr/0005-error-handling-discipline.md) —
  codifies explicit runtime failure behaviour when required
  configuration is missing or invalid, rather than silently continuing
  with hidden literals.
- `platformkit-backend-kit/infrastructure/config/` — canonical
  environment-bound configuration surface, including provider
  abstractions, runtime validation, and typed access.

## Compliance traceability

- **SOC2_CC6.1** — logical access controls depend on controlled runtime
  secret handling and separation of code from credentials.
- **SOC2_CC6.7** — data and system protection controls require secure
  handling and rotation of secrets outside source control.
- **ISO27001_A.9.4** — access and information restrictions require
  runtime-controlled credentials, not embedded static secrets.
