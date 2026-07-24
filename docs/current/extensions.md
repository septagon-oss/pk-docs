---
title: Secure Extensions
slug: current-extensions
collection: guides
status: published
---

# Build a secure extension

PlatformKit has one supported application-extension seam:
`starterapp.WithModules`. Start with
[`pk-apps/reference/custommodule`](https://github.com/septagon-oss/pk-apps/tree/main/reference/custommodule).
That directory is a runnable teaching reference, not a shipped product, module,
or alternate starter.

The reference demonstrates the required defaults:

1. Build the module on `ModuleEnv.DB`, the starter's shared SQLite pool.
2. Apply append-only, embedded migrations and record each applied filename.
3. Declare every machine capability in `ModulePlugin.APIKeyScopes`.
4. Enforce the matching scope in every authenticated route, while allowing the
   reserved interactive `admin` scope where appropriate.
5. Obtain tenant and subject from `portslib.RequestActor`; never trust body or
   query identity.
6. Generate IDs and timestamps on the server.
7. Scope every read, update, and delete query by tenant.
8. Reject unknown JSON fields and trailing JSON values.
9. Publish route metadata through `OpenAPIOperation`.
10. Test anonymous access, insufficient scopes, server-owned identity,
    cross-tenant reads, migrations, and the happy path.

## Authentication is not authorization

`RegisterRoutes` inherits identity resolution, the anonymous-mutation gate, and
the request-body limit. It does not infer a domain policy for your module. A
route that only calls `RequestActor` is authenticated but not authorized.

Declare application scopes:

```go
return starterapp.ModulePlugin{
    ID:             "reservation",
    RegisterRoutes: handler.RegisterRoutes,
    APIKeyScopes: []string{
        "reservations:read",
        "reservations:write",
    },
}
```

Then enforce one in the handler:

```go
tenantID, subject, ok := portslib.RequestActor(w, r)
if !ok {
    return
}
principal := identity.PrincipalFromContext(r.Context())
if !principal.HasScope("admin") &&
    !principal.HasScope("reservations:write") {
    http.Error(w, "forbidden: reservations:write scope required", http.StatusForbidden)
    return
}
```

Unknown API-key scopes are rejected. Declaring the scope in
`APIKeyScopes` makes it issuable; it does not authorize a route by itself.

## Keep product code downstream

Put the module's domain model, routes, migrations, policy, and tests in the
repository that owns the application. PlatformKit remains a generic foundation
whether the downstream product is a marketplace, CRM, booking system, or
internal tool.

