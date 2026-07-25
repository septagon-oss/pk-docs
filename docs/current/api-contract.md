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
- An entity identifier travels in a path as one canonical opaque segment. A
  segment that is not canonical returns `400`, not `404`: the request is
  malformed rather than pointing at something absent.

## Entity identifiers in paths

Wherever a route contains `{id}`, the value is the canonical segment produced by
`pk-shared/pkg/pathsegment` — the literal prefix `id-` followed by the
lowercase-hex encoding of the identifier's bytes:

```text
identifier   1784965307450776349-tenant_local-welcome
path segment id-31373834...2d77656c636f6d65
GET          /api/v1/content/id-31373834...2d77656c636f6d65
```

Encoding the identifier rather than passing it raw means an identifier
containing a slash, a percent escape, or a control character cannot change which
route a request resolves to. Decoding fails closed: raw identifiers, uppercase
hex, percent escapes, and non-canonical aliases are all rejected, so an entity
is reachable by exactly one spelling.

`pk-client` does this for you. Direct callers encode with
`pathsegment.EncodeOpaqueID`, or in any language by hex-encoding the identifier's
UTF-8 bytes and prefixing `id-`:

```bash
ID='1784965307450776349-tenant_local-welcome'
SEGMENT="id-$(printf '%s' "$ID" | od -An -tx1 | tr -d ' \n')"
curl -s "http://127.0.0.1:8080/api/v1/content/$SEGMENT" -H "Authorization: Bearer $SID"
```

Slugs are not identifiers and are never encoded — a route that addresses
something by slug, such as a public page, keeps it readable.

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

