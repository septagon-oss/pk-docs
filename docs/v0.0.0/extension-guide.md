---
title: Extending PlatformKit OSS (v0.0.0)
slug: v0-0-0-extension-guide
collection: docs
status: published
---

# Extending PlatformKit OSS

PlatformKit OSS is the **base**. Downstream distributions — including
PlatformKit Pro — extend it without forking by following one rule:

> Depend on declared contracts, not on concrete implementations.

This page explains how to do that in practice for v0.0.0.

## The three extension axes

There are exactly three places an extension can plug into the OSS:

1. **Provider swap.** Replace a built-in `Store`, `Hasher`,
   `EventSink`, `Tracer`, etc. behind an interface that an OSS module
   already calls.
2. **Module embedding.** Embed the OSS `*Module` struct in a Pro module
   that adds new endpoints, new admin pages, or new ports, but keeps the
   OSS surface intact.
3. **New module.** Author a wholly new module that depends only on
   ports declared by OSS modules.

Anything that doesn't fit one of these axes is, by construction, a
modification to the OSS layer itself and should be proposed as an OSS PR.

## Axis 1: Provider swap

Every non-trivial OSS module accepts its dependencies through
constructor options. For example, `user_management.NewModule(...)`
accepts a `WithStore(Store)` option, a `WithHasher(Hasher)` option, and
so on. The OSS ships a SQLite-backed `Store` and a SHA-256 `Hasher` as
defaults — useful for local dev, not for production.

A Pro provider swap looks like this:

```go
// Pro: replace the OSS hasher with Argon2id while keeping the OSS module.
import (
    osuser "github.com/septagon-oss/pk-modules/pkg/user"
    prohash "example.com/pk-pro/pkg/security/argon2id"
)

func NewProUserModule(db *sql.DB) *osuser.Module {
    return osuser.NewModule(
        osuser.WithStore(osuser.NewSQLStore(db)),
        osuser.WithHasher(prohash.New()),
    )
}
```

The Pro caller never imports private OSS packages — only the public
`pkg/user` surface and the contracts that surface declares.

## Axis 2: Module embedding

Embedding adds capability **on top of** an OSS module without modifying
it. The pattern is:

```go
type ProUserModule struct {
    *osuser.Module                  // embedded OSS module
    sso *ssoController              // Pro-only field
}

func (m *ProUserModule) Compose(reg pkcore.Registry) error {
    if err := m.Module.Compose(reg); err != nil {
        return err
    }
    return m.sso.Compose(reg)       // additional Pro contributions
}
```

The Pro module reuses the OSS module's stores, admin contributions, and
HTTP handlers — and **augments** them. From the catalog's point of view
there is only one module with the same ID; consumers cannot tell whether
they are talking to OSS or Pro.

Embedding **must not**:

- shadow OSS ports without preserving their semantics,
- swap out OSS state stores (use Axis 1 instead),
- mutate OSS registry contributions after `Compose` returns.

## Axis 3: New module

If the extension is genuinely new behaviour, write a new module. The
shape is identical to an OSS module:

```
my_module/
  module.go         // type Module struct { ... } + New(opts...) *Module + Compose
  ports.go          // declared interfaces this module needs
  store.go          // default implementation(s)
  handler.go        // HTTP handler tree
  admin.go          // admin section + entity CRUD contributions
  doc.go            // package-level rationale
```

The only OSS-side requirement is that **every dependency on another
module is declared as a port** — never imported directly. If you need
to know who a user is, depend on the OSS `user.Lookup` interface, not on
the `pkg/user` implementation.

## What you should never do

| Anti-pattern | Why it breaks |
|--------------|---------------|
| Copy an OSS module and edit it in your fork | Loses upstream fixes; the catalog will refuse two modules with the same ID. |
| Import another module's internal types directly | Violates the "ports, not imports" rule; couples Pro to OSS internals. |
| Register routes from outside a module's `Compose` | Breaks the contract that modules own their routes; analyzers flag it. |
| Replace an OSS interface with a wider one in Pro | Pro consumers couple to the wider surface and cannot drop back to OSS. |

## Verifying an extension

Before tagging a Pro release that depends on an OSS tag:

```bash
# from the Pro workspace root
make verify          # runs the same gate the OSS repos run
pk doctor            # checks repo hygiene
pk verify            # checks module composition
pk explain modules   # lists what the running app actually exposes
```

If `make verify` is green in the Pro tree and `pk verify` reports zero
catalog conflicts, the extension is wire-compatible with the OSS
release it embeds.
