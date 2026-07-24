---
title: API Contract
slug: current-api-contract
collection: guides
status: published
---

# Current API contract

The public starter's built-in API is tenant-scoped and fail-closed.

- Anonymous API access returns `401`.
- An authenticated credential without the required capability returns `403`.
- Tenant and subject come from the verified credential, not JSON or query
  parameters.
- Mutating JSON bodies reject unknown fields, malformed input, trailing values,
  and bodies over 1 MiB.
- Pagination uses a positive `limit` and non-negative `offset`; malformed or
  negative values return `400`.
- API-key scopes must be a built-in capability or a scope declared by an
  application module. Typos and interactive-only scopes are rejected.
- User creation defaults `active` to true. On update, omitting `active`
  preserves its current value.
- A machine credential with `users:write` cannot modify or delete its own
  credential-owning user; that requires the interactive `admin` scope.
- Cross-tenant identifiers resolve as not found rather than revealing another
  tenant's resource.

Built-in machine scopes are:

```text
api-keys:read       api-keys:write
audit:read
content:read        content:write
metrics:read
notifications:read notifications:write
tenants:read        tenants:write
users:read          users:write
```

The seeded interactive administrator has the reserved `admin` and
`console:access` capabilities. API keys cannot request those scopes.

The canonical operation document lives in
[`pk-apps/api/openapi.yaml`](https://github.com/septagon-oss/pk-apps/blob/main/api/openapi.yaml).
Application extensions publish their aggregate operation metadata at
`/openapi/extensions.json`.

