---
title: Build a secure extension
slug: current-extensions
collection: guides
group: Build
order: 30
status: published
description: Add your own tenant-scoped module to PlatformKit through the one supported seam — generate it, read what was generated, understand the ten rules it follows, and keep it in your own repository.
---

# Build a secure extension

PlatformKit has **one** supported application-extension seam:
`starterapp.WithModules`. Your module lives in your repository, is written in
Go, and joins the starter's shared database pool, identity perimeter, admin
console, health checks, and OpenAPI discovery — instead of re-implementing any
of them.

This guide generates a working module first, then explains every rule it
follows so you can write one by hand.

![The WithModules seam: files in your repository (main.go, modules.go, mod_invoice.go, migrations, tests) plug into the starter's shared machinery — ModuleEnv.DB, the identity perimeter, the anonymous-mutation gate, the request-body cap, the scope registry, admin and health registrars, and OpenAPI discovery.](../assets/diagrams/extension-seam.svg "Your code on the left, the machinery you inherit on the right, one seam between them.")

## 1. Generate an app and a module

You need the `platformkit` CLI on your `PATH` (`go install github.com/septagon-oss/platformkit@latest`
— see the [Quickstart](./quickstart.md#get-the-platformkit-command)).

```bash
platformkit new app acme
```

```text
Scaffolded acme/ (11 files)

Next:
  cd acme
  go run .            # boots on http://127.0.0.1:8080/admin
  platformkit new module <name>   # add a tenant-scoped module
```

```bash
cd acme
platformkit new module invoice
```

```text
Scaffolded the invoice module (3 files):
  mod_invoice.go
  mod_invoice_test.go
  migrations/invoice/0001_create_invoices.up.sql

The module registers itself; just build and run. Its API keys need the invoices:read / invoices:write scopes.
```

Now verify. The Makefile's `verify` target is the same gate PlatformKit holds
itself to:

```bash
make verify
```

```text
go vet ./...
go test -race -count=1 ./...
ok  	acme	1.024s
```

That `ok` includes the generated module's test, `TestInvoiceStoreIsolatesTenants`:
a row created in one tenant must be invisible to another, by list and by id.
It is the test that fails the moment a `WHERE tenant_id` clause is dropped.
You have a tenant-isolated, tested module before writing a line yourself.

Run it and the invoice module is composed alongside the ten built-ins:

```bash
go run .
```

Its routes (`/api/v1/invoices`, `/api/v1/invoices/{id}`) inherit the
perimeter; its scopes (`invoices:read`, `invoices:write`) are issuable on API
keys; its operations appear in `/openapi/extensions.json`.

## 2. What was generated

```text
acme/
├── main.go                 boots the starter; mounts extraModules()
├── modules.go              additive registry — generated modules call registerModule() from init()
├── mod_invoice.go          the module: store, handler, routes, scopes, OpenAPI metadata
├── mod_invoice_test.go     tenant isolation: list and by-id reads never cross tenants
├── migrations/invoice/
│   └── 0001_create_invoices.up.sql
├── config.example.yaml     copy to config.yaml for fail-closed production
├── Dockerfile · compose.yaml · Makefile
├── AGENTS.md · llms.txt    the rules, for an AI coding agent
└── README.md
```

`main.go` is short, and you never edit it to add modules:

```go
cfg := starterapp.DefaultConfig()
cfg.AppName = "acme"

// config.yaml next to the process (or PK_CONFIG) switches to production.
if _, err := os.Stat(path); err == nil {
    cfg, err = starterapp.LoadConfig(path)
    // …
}
starterapp.ApplyAddressOverrides(cfg, os.Getenv)
if v := os.Getenv("PK_ADMIN_PASSWORD"); v != "" {
    cfg.Seed.AdminPassword = v
}

err := starterapp.Run(ctx, cfg, starterapp.WithModules(extraModules()...))
```

`modules.go` is an additive registry. A generated module file ends with
`func init() { registerModule(invoiceModule) }`, so the list grows without
anything else changing.

The module itself is one file. Its shape is the contract every reviewer
checks:

```go
func invoiceModule(env starterapp.ModuleEnv) (starterapp.ModulePlugin, error) {
    store, err := newInvoiceStore(env.DB)      // the starter's shared *sql.DB
    if err != nil {
        return starterapp.ModulePlugin{}, err
    }
    h := &invoiceHandler{store: store}
    return starterapp.ModulePlugin{
        ID:             "invoice",
        RegisterRoutes: h.RegisterRoutes,
        APIKeyScopes:   []string{"invoices:read", "invoices:write"},
        OpenAPI: []starterapp.OpenAPIOperation{
            {OperationID: "listInvoices", Method: http.MethodGet, Path: "/api/v1/invoices",
                Summary: "List invoices in the authenticated tenant", SuccessStatus: http.StatusOK},
            {OperationID: "createInvoice", Method: http.MethodPost, Path: "/api/v1/invoices",
                Summary: "Create an invoice owned by the authenticated actor", SuccessStatus: http.StatusCreated},
            {OperationID: "getInvoice", Method: http.MethodGet, Path: "/api/v1/invoices/{id}",
                Summary: "Get an invoice in the authenticated tenant", SuccessStatus: http.StatusOK},
        },
    }, nil
}
```

Path identifiers are decoded once, at the top of `ServeHTTP`, with
`portslib.EntityIDFromPath(r.URL.Path, "/api/v1/invoices")` — so a
non-canonical `{id}` is a `400` before any branch runs (see
[entity identifiers in paths](./api-contract.md#entity-identifiers-in-paths)).

And the one place authorization lives — every handler branch calls it, so none
can forget:

```go
func invoiceActorWithScope(w http.ResponseWriter, r *http.Request, scope string) (tenantID, subject string, ok bool) {
    tenantID, subject, ok = portslib.RequestActor(w, r)   // identity from the credential
    if !ok {
        return "", "", false                              // RequestActor already wrote 401
    }
    principal := identity.PrincipalFromContext(r.Context())
    if !principal.HasScope("admin") && !principal.HasScope(scope) {
        http.Error(w, "forbidden: "+scope+" scope required", http.StatusForbidden)
        return "", "", false
    }
    return tenantID, subject, true
}
```

To read a fuller hand-written version of the same thing, see
[`pk-apps/reference/custommodule`](https://github.com/septagon-oss/pk-apps/tree/main/reference/custommodule)
— a runnable teaching reference, not a shipped product or alternate starter.
When you want to see the seam carry a whole domain,
[`pk-apps/reference/polls`](https://github.com/septagon-oss/pk-apps/tree/main/reference/polls)
adds a lifecycle, an audit outbox committed atomically with each mutation,
signed anonymous voter identity, throttling, `/metrics` counters, and a public
browser surface beside the JSON API.

## 3. The ten rules (and what breaks if you skip one)

The generated module already follows all of these. When you write or review a
module by hand, this is the checklist.

| # | Rule | Why it matters | The generated module does it by… |
|---|---|---|---|
| 1 | **Build on `ModuleEnv.DB`**, the starter's shared pool | One connection pool, one transaction boundary, one engine choice (SQLite or Postgres) | `newInvoiceStore(env.DB)` |
| 2 | **Append-only, embedded migrations**; record each applied filename | Schema changes are reproducible and never edited after shipping | `migrations/invoice/0001_….up.sql` via `embed` |
| 3 | **Declare every machine capability** in `APIKeyScopes` | Unknown scopes on API keys are rejected; undeclared means un-issuable | `APIKeyScopes: []string{"invoices:read", "invoices:write"}` |
| 4 | **Enforce the matching scope in every authenticated route**, allowing interactive `admin` | Declaring a scope makes it issuable; it does not authorize anything by itself | `invoiceActorWithScope(w, r, invoiceWriteScope)` |
| 5 | **Tenant and subject come from `portslib.RequestActor`** — never from body or query | A caller cannot impersonate another tenant by editing JSON | `tenantID, subject, ok := portslib.RequestActor(w, r)` |
| 6 | **Generate IDs and timestamps on the server** | Clients cannot forge identity or history | `newInvoiceID()` from `crypto/rand`; `m.TenantID, m.OwnerID = tenant, owner` |
| 7 | **Scope every read, update, and delete by tenant** | A by-id query is always `WHERE id = ? AND tenant_id = ?` | every store method takes `tenantID` |
| 8 | **Reject unknown JSON fields and trailing values** | Typos and smuggled fields fail loudly instead of being ignored | `portslib.DecodeJSONBody(r.Body, &m)` |
| 9 | **Publish route metadata through `OpenAPIOperation`** | Your routes show up in `/openapi/extensions.json` for clients and docs | the `OpenAPI:` slice above |
| 10 | **Test** tenant isolation first, then anonymous access, insufficient scopes, server-owned identity, migrations, and the happy path | The moment isolation breaks, `make verify` fails | `mod_invoice_test.go` covers isolation; extend it as the module grows |

> [!IMPORTANT]
> **Authentication is not authorization.** `RegisterRoutes` inherits identity
> resolution, the anonymous-mutation gate, and the request-body limit. It does
> *not* infer a domain policy for your module. A route that only calls
> `RequestActor` is authenticated but not authorized — rule 4 is yours to
> apply, on every route.

## 4. Declare and enforce scopes by hand

If you are not using the generator, the two halves look like this.

Declare the application scopes on the plugin:

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

Issue a key with that scope and try it:

```bash
curl -sS -X POST http://127.0.0.1:8080/api/v1/api-keys \
  -H "Authorization: Bearer $SID" -H 'Content-Type: application/json' \
  -d '{"name":"booking-bot","scopes":["reservations:read"]}'
```

A key with `reservations:read` gets `200` on the list route and
`forbidden: reservations:write scope required` with `403` on the create route.
A key requesting a scope no module declared is refused at issue time.

## 5. Give your module an admin page (optional)

The admin shell's stylesheet already carries the whole design system, so a
module page links one asset and composes components — no authored CSS:

```go
func (m *Module) insightsPage(w http.ResponseWriter, r *http.Request) {
    doc := h.Doctype(h.HTML(h.Lang("en"),
        h.Head(h.Link(h.Rel("stylesheet"), h.Href("/admin/static/_admin.css"))),
        h.Body(web.Container(layouts.ContainerProps{MaxWidth: "4xl"},
            web.Stack(layouts.StackProps{Gap: "6"},
                web.Heading(atoms.HeadingProps{Text: "Invoice insights", Level: 1}),
                web.Table(molecules.TableProps{ /* live data */ }),
            ),
        )),
    ))
    doc.Render(w)
}

// registered once, in NewModule:
registrar.RegisterPage(portslib.AdminPage{
    ModuleID: ModuleID, Path: "/admin/invoice/insights",
    Title: "Invoice insights", Render: m.insightsPage,
})
```

The [Design system](./design-system.md) guide explains the pieces.

## 6. Keep product code downstream

Put the module's domain model, routes, migrations, policy, and tests in the
repository that owns the application. PlatformKit remains a generic foundation
whether the downstream product is a marketplace, CRM, booking system, or
internal tool — and you can upgrade the released set without merging your
domain into it.

> [!TIP]
> The scaffolded `AGENTS.md` and `llms.txt` state these rules for an AI coding
> agent working in your repository. Keep them up to date when you add
> conventions of your own; they are how the next module stays as safe as the
> first.
