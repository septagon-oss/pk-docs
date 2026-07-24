---
title: Add a Module
slug: v0-2-0-add-a-module
collection: docs
status: archived
---

> **Historical v0.2.0 documentation.** This page is retained for release research and is not the current OSS contract. Use `docs/current/` and the `septagon-oss/platformkit` README for current setup, credentials, routes, and capabilities.


# Add a module

**How do I build my own thing on it?**

A PlatformKit module is a small Go package: an entity, a persistence store with
a default SQLite implementation, a constructor that takes functional options,
and (optionally) admin and health registration. You then compose it next to the
nine built-ins in your app.

This page builds the smallest module that actually works — a `note` module —
following the exact shape of the real `tenant` module in `pk-modules`. Every
identifier here matches a real API: `module.NewBundle`, `module.NewCatalog`,
`module.Must`, `module.WithProvides`, `module.WithDependencies`,
`module.Provide`, `module.OptionalPort`, `module.PortSpec`,
`portslib.AdminRegistrar`, `portslib.HealthRegistrar`,
`health.CheckerFunc`.

> There is no `pk scaffold` subcommand. Scaffolding exists as a Go *library*
> (`pk-tools/pkg/scaffold`), not a CLI verb. The `pk` CLI is `doctor`, `verify`,
> `explain` only. So this is the manual path — and it compiles.

## The shape

A module package looks like the `tenant` module:

```
note/
  entities.go            # the Note entity + constants (EntityName, APIPath)
  ports.go               # the public interface other modules may consume
  store/store.go         # the persistence contract (interface) + sentinel errors
  store/sqlite/sqlite.go # the default SQLite store
  migrations/embed.go    # //go:embed *.sql
  migrations/0001_initial.up.sql
  options.go             # functional options (WithStore, WithSQLiteDSN, ...)
  module.go              # NewModule(opts...) + Compose()
  admin.go               # optional: admin page + sidebar registration
```

You do not need every file to start. The minimum that runs is: an entity, a
store interface, a SQLite store, options, and `module.go`. Admin and health are
optional integrations; when their registrars are absent, the module simply does
not contribute those surfaces.

## 1. The entity

`note/entities.go`:

```go
package note

import (
	"errors"
	"strings"
	"time"
)

// Note is the entity this module manages.
type Note struct {
	ID        string    `json:"id"`
	TenantID  string    `json:"tenant_id"`
	Title     string    `json:"title"`
	Body      string    `json:"body"`
	CreatedAt time.Time `json:"created_at"`
}

// EntityName is the stable display name used by admin registration.
const EntityName = "Note"

// APIPath is the canonical HTTP base path for note CRUD.
const APIPath = "/api/v1/notes"

func (n *Note) Validate() error {
	if n == nil {
		return errors.New("note: nil")
	}
	if strings.TrimSpace(n.Title) == "" {
		return errors.New("note: title is required")
	}
	return nil
}
```

## 2. The store contract

`note/store/store.go`. The store package does not import its parent, so it
defines its own row shape (exactly as the tenant module does):

```go
// Package store defines the persistence contract for the note module.
package store

import (
	"context"
	"errors"
	"time"
)

type Note struct {
	ID        string
	TenantID  string
	Title     string
	Body      string
	CreatedAt time.Time
}

// Store is the persistence contract. Implementations must be safe for
// concurrent use.
//
// Every by-id operation takes the tenantID alongside the id — this is the
// platform's core isolation invariant, and your module must follow it too.
// A row belonging to another tenant reads as ErrNotFound; a leaked or
// guessed id can never read or delete across tenants. List takes the tenant
// plus limit/offset so a caller can never request an unbounded read of
// someone else's data (or of the whole table).
type Store interface {
	Create(ctx context.Context, n *Note) error
	Get(ctx context.Context, tenantID, id string) (*Note, error)
	List(ctx context.Context, tenantID string, limit, offset int) ([]*Note, error)
	Delete(ctx context.Context, tenantID, id string) error
}

var ErrNotFound = errors.New("note: not found")
```

## 3. The default SQLite store

`note/store/sqlite/sqlite.go`. This package imports no SQL driver — the host
app registers one (`modernc.org/sqlite` registers itself as `"sqlite"`). `New`
runs `CREATE TABLE IF NOT EXISTS` so a fresh database works without running
migration files first — the same self-bootstrapping the tenant store does:

```go
// Package sqlite is the default Store implementation backed by database/sql.
package sqlite

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/youruser/yourapp/note/store"
)

type Store struct{ db *sql.DB }

const schemaDDL = `
CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at DATETIME NOT NULL
);`

// New wraps a *sql.DB and ensures the schema exists.
func New(db *sql.DB) (*Store, error) {
	if db == nil {
		return nil, errors.New("note/sqlite: nil *sql.DB")
	}
	s := &Store{db: db}
	if _, err := db.ExecContext(context.Background(), schemaDDL); err != nil {
		return nil, fmt.Errorf("note/sqlite: ensure schema: %w", err)
	}
	return s, nil
}

// Open opens a sqlite database and returns a Store.
func Open(driverName, dsn string) (*Store, error) {
	db, err := sql.Open(driverName, dsn)
	if err != nil {
		return nil, fmt.Errorf("note/sqlite: open: %w", err)
	}
	s, err := New(db)
	if err != nil {
		_ = db.Close()
		return nil, err
	}
	return s, nil
}

func (s *Store) DB() *sql.DB { return s.db }

func (s *Store) Create(ctx context.Context, n *store.Note) error {
	if n.CreatedAt.IsZero() {
		n.CreatedAt = time.Now().UTC()
	}
	_, err := s.db.ExecContext(ctx,
		`INSERT INTO notes (id, tenant_id, title, body, created_at) VALUES (?, ?, ?, ?, ?)`,
		n.ID, n.TenantID, n.Title, n.Body, n.CreatedAt)
	if err != nil {
		return fmt.Errorf("note/sqlite: create: %w", err)
	}
	return nil
}

// Get returns the note identified by (tenantID, id). The tenant predicate is
// mandatory: a note belonging to another tenant reads as ErrNotFound rather
// than leaking across tenants.
func (s *Store) Get(ctx context.Context, tenantID, id string) (*store.Note, error) {
	row := s.db.QueryRowContext(ctx,
		`SELECT id, tenant_id, title, body, created_at FROM notes WHERE id = ? AND tenant_id = ?`,
		id, tenantID)
	n := &store.Note{}
	err := row.Scan(&n.ID, &n.TenantID, &n.Title, &n.Body, &n.CreatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, store.ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("note/sqlite: scan: %w", err)
	}
	return n, nil
}

// List returns the tenant's notes, paged. The limit is capped so a caller can
// never request an unbounded read.
func (s *Store) List(ctx context.Context, tenantID string, limit, offset int) ([]*store.Note, error) {
	const maxLimit = 1000
	if limit <= 0 {
		limit = 50
	}
	if limit > maxLimit {
		limit = maxLimit
	}
	if offset < 0 {
		offset = 0
	}
	rows, err := s.db.QueryContext(ctx,
		`SELECT id, tenant_id, title, body, created_at FROM notes
		 WHERE tenant_id = ? ORDER BY created_at LIMIT ? OFFSET ?`,
		tenantID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("note/sqlite: list: %w", err)
	}
	defer rows.Close()
	var out []*store.Note
	for rows.Next() {
		n := &store.Note{}
		if err := rows.Scan(&n.ID, &n.TenantID, &n.Title, &n.Body, &n.CreatedAt); err != nil {
			return nil, fmt.Errorf("note/sqlite: scan: %w", err)
		}
		out = append(out, n)
	}
	return out, rows.Err()
}

// Delete removes the note identified by (tenantID, id). The tenant predicate
// is mandatory so a caller cannot delete another tenant's note by id.
func (s *Store) Delete(ctx context.Context, tenantID, id string) error {
	res, err := s.db.ExecContext(ctx,
		`DELETE FROM notes WHERE id = ? AND tenant_id = ?`, id, tenantID)
	if err != nil {
		return fmt.Errorf("note/sqlite: delete: %w", err)
	}
	if rows, _ := res.RowsAffected(); rows == 0 {
		return store.ErrNotFound
	}
	return nil
}
```

## 4. Migrations (append-only)

`note/migrations/0001_initial.up.sql`:

```sql
-- 0001_initial.up.sql creates the notes table.
CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at DATETIME NOT NULL
);
```

`note/migrations/embed.go`:

```go
// Package migrations exposes the embedded note migration files.
package migrations

import "embed"

//go:embed *.sql
var fs embed.FS

func FS() embed.FS { return fs }
```

> Migrations are **append-only**. Never edit an existing migration file — add a
> new one with a higher number. The SQLite store also self-creates its schema at
> construction, so the migration files are for app-level runners and for stores
> that don't bootstrap themselves.

## 5. The public port

`note/ports.go` — the interface other modules may depend on. They depend on this,
never on `*note.Module` or the store:

```go
package note

import "context"

// NoteService is the public contract other modules consume. It carries the
// same tenant-scoped shape as the store: the caller supplies the tenant it is
// acting for (an HTTP handler derives it from the authenticated principal —
// never from the request body), and cross-tenant ids read as not found.
type NoteService interface {
	Create(ctx context.Context, n *Note) error
	Get(ctx context.Context, tenantID, id string) (*Note, error)
	List(ctx context.Context, tenantID string, limit, offset int) ([]*Note, error)
	Delete(ctx context.Context, tenantID, id string) error
}
```

## 6. Options

`note/options.go` — functional options, additive only, mirroring the tenant
module. `WithStore` injects a store; `WithSQLiteDSN` opens one for you;
`WithAdminRegistrar` / `WithHealthRegistrar` wire the host's shared ports:

```go
package note

import (
	"github.com/septagon-oss/pk-modules/pkg/portslib"
	"github.com/youruser/yourapp/note/store"
)

type Option func(*config)

type config struct {
	store        store.Store
	admin        portslib.AdminRegistrar
	health       portslib.HealthRegistrar
	sqliteDSN    string
	sqliteDriver string
}

func WithStore(s store.Store) Option { return func(c *config) { c.store = s } }

func WithSQLiteDSN(dsn string) Option { return func(c *config) { c.sqliteDSN = dsn } }

func WithSQLiteDriver(name string) Option { return func(c *config) { c.sqliteDriver = name } }

func WithAdminRegistrar(r portslib.AdminRegistrar) Option {
	return func(c *config) { c.admin = r }
}

func WithHealthRegistrar(r portslib.HealthRegistrar) Option {
	return func(c *config) { c.health = r }
}
```

## 7. The module

`note/module.go` — `NewModule(opts...)` resolves the store, registers optional
admin and health contributions only when their ports are wired, and `Compose()`
declares what the module provides and (optionally) depends on for the catalog:

```go
package note

import (
	"context"
	"errors"
	"fmt"

	pkmodule "github.com/septagon-oss/pk-core/pkg/module"
	"github.com/septagon-oss/pk-core/pkg/observability/health"
	"github.com/septagon-oss/pk-modules/pkg/portslib"
	"github.com/youruser/yourapp/note/store"
	notesqlite "github.com/youruser/yourapp/note/store/sqlite"
)

const (
	ModuleID          = "note_management"
	ModuleName        = "Note Management"
	ModuleDescription = "Simple per-tenant notes."
	ModuleVersion     = "0.0.0"
)

const defaultSQLiteDriver = "sqlite"

type Module struct {
	metadata pkmodule.Metadata
	store    store.Store
	svc      NoteService
}

func NewModule(opts ...Option) (*Module, error) {
	cfg := config{sqliteDriver: defaultSQLiteDriver}
	for _, opt := range opts {
		if opt != nil {
			opt(&cfg)
		}
	}
	st, err := resolveStore(cfg)
	if err != nil {
		return nil, err
	}

	m := &Module{
		metadata: pkmodule.Metadata{
			ID: ModuleID, Name: ModuleName,
			Description: ModuleDescription, Version: ModuleVersion,
		},
		store: st,
	}
	m.svc = newService(st) // your business logic over the store

	if err := registerAdmin(cfg.admin); err != nil {
		return nil, err
	}
	if err := registerHealth(cfg.health, st); err != nil {
		return nil, err
	}
	return m, nil
}

func resolveStore(cfg config) (store.Store, error) {
	switch {
	case cfg.store != nil:
		return cfg.store, nil
	case cfg.sqliteDSN != "":
		return notesqlite.Open(cfg.sqliteDriver, cfg.sqliteDSN)
	default:
		return nil, errors.New("note: no store configured — use WithStore or WithSQLiteDSN")
	}
}

func registerHealth(r portslib.HealthRegistrar, st store.Store) error {
	if r == nil {
		return nil
	}
	check := health.CheckerFunc(func(ctx context.Context) error {
		// Probe with a sentinel tenant and a limit of 1 — proves the table is
		// reachable without reading any real tenant's data. Same pattern as
		// the built-in modules.
		_, err := st.List(ctx, "_health_probe_", 1, 0)
		return err
	})
	return r.Register("note_management.store", check)
}

// Service returns the public NoteService port.
func (m *Module) Service() NoteService { return m.svc }

// Compose declares this module to the catalog. It provides NoteService and
// optionally consumes the shared admin/health registration ports.
func (m *Module) Compose() pkmodule.Composable {
	return pkmodule.Must(m.metadata,
		pkmodule.WithProvides(
			pkmodule.Provide[NoteService](ModuleVersion),
		),
		pkmodule.WithDependencies(
			pkmodule.OptionalPort[portslib.AdminRegistrar](pkmodule.PortSpec{
				Version:           "0.0.0",
				Purpose:           "Mount the notes admin page.",
				Category:          pkmodule.DependencyCategoryUI,
				SubCategory:       "admin",
				PreferredProvider: "admin_management",
			}),
			pkmodule.OptionalPort[portslib.HealthRegistrar](pkmodule.PortSpec{
				Version:           "0.0.0",
				Purpose:           "Surface note_management store reachability.",
				Category:          pkmodule.DependencyCategoryMonitoring,
				SubCategory:       "health",
				PreferredProvider: "health_management",
			}),
		),
	)
}
```

Supply `newService` (and `admin.go`'s `registerAdmin`) yourself — `registerAdmin`
returns `nil` when its registrar is absent, without constructing a fake provider.
The admin
registration in the tenant module's `admin.go` is the worked example to copy:
`RegisterEntityCRUD(ModuleID, EntityName, APIPath)`, `RegisterPage(...)`,
`RegisterSidebarSection(...)`.

> **Note on `import` paths.** A real published module lives under
> `github.com/septagon-oss/...`. Your own module uses your own module path (here
> `github.com/youruser/yourapp/note`). The only PlatformKit imports you need are
> `pk-core/pkg/module`, `pk-core/pkg/observability/health`, and
> `pk-modules/pkg/portslib`. You never import another business module's package —
> only its published interface, which it re-exports through ports.

## 8. Compose it next to the nine

In your app's assembly (the starter app does this in `app.go`), open one shared
`*sql.DB`, build your store on it, construct the module, and add its `Compose`
to the catalog bundle alongside the built-ins:

```go
import (
	pkmodule "github.com/septagon-oss/pk-core/pkg/module"
	"github.com/youruser/yourapp/note"
	notesqlite "github.com/youruser/yourapp/note/store/sqlite"
)

// db is the one shared *sql.DB the starter opens with SetMaxOpenConns(1).
noteStore, err := notesqlite.New(db)
if err != nil {
	return nil, fmt.Errorf("note store: %w", err)
}

noteMod, err := note.NewModule(
	note.WithStore(noteStore),
	note.WithAdminRegistrar(adminReg), // the admin shell's registrar
	note.WithHealthRegistrar(healthReg),
)
if err != nil {
	return nil, fmt.Errorf("note module: %w", err)
}

// Add your module to the same bundle the nine built-ins use.
bundle := pkmodule.NewBundle("yourapp.modules",
	[]pkmodule.Entry{
		// ... the nine existing entries: admin, health, tenant, user, ...
		{ID: note.ModuleID, New: noteMod.Compose},
	},
	[]string{ /* ...the nine module IDs..., */ note.ModuleID},
)

catalog, err := pkmodule.NewCatalog().Add(bundle).Build()
if err != nil {
	return nil, fmt.Errorf("catalog build: %w", err) // empty/duplicate-ID errors only
}

// Compose (used by host.New) is where dependencies are sorted + validated.
plan, err := pkmodule.Compose(catalog)
if err != nil {
	return nil, fmt.Errorf("compose: %w", err) // catches a miswired dependency
}
```

`Build()` only registers entries and defaults — it does not look at dependencies.
`Compose()` (which `host.New(...)` calls for you) topologically sorts on declared
dependencies and fails if a required port has no provider, so a wiring mistake is
caught at compose time, before the app serves — not a runtime surprise.

## Why one shared `*sql.DB`?

SQLite is a single-writer embedded engine. If each module opened its own DSN you
would get N independent connection pools over one file, inviting lock contention
and table-visibility surprises on a fresh database. The starter opens **one**
`*sql.DB` with `SetMaxOpenConns(1)` and builds every store on it. Follow that
pattern: prefer `WithStore(notesqlite.New(sharedDB))` over `WithSQLiteDSN(...)`
when composing more than one module.

## Verify

```bash
go build ./...
go test ./note/...
```

For the wider repo conventions (commit format, the no-cross-module-imports rule,
append-only migrations, file-purpose comments), see
[CONTRIBUTING.md](../../CONTRIBUTING.md).

## The easy path: `starterapp.WithModules`

Rebuilding the whole assembly (above) is the low-level route. In v0.3.0+ you can
instead contribute your module to the batteries-included starter without
touching its wiring — it joins the same catalog and its routes mount behind the
same identity, mutation-gate, and request-body-cap middleware as the nine
built-ins:

```go
app, err := starterapp.Run(ctx, cfg, starterapp.WithModules(
    func(env starterapp.ModuleEnv) (starterapp.ModulePlugin, error) {
        st, err := notesqlite.New(env.DB) // env.DB is the shared, single-writer pool
        if err != nil {
            return starterapp.ModulePlugin{}, err
        }
        m, err := note.NewModule(note.WithStore(st),
            note.WithAdminRegistrar(env.Admin), note.WithHealthRegistrar(env.Health))
        if err != nil {
            return starterapp.ModulePlugin{}, err
        }
        return starterapp.ModulePlugin{
            ID:             note.ModuleID,
            Compose:        m.Compose,                     // optional: joins the DI/health graph
            RegisterRoutes: m.HTTPHandler().RegisterRoutes, // authenticated routes (behind the gate)
        }, nil
    },
))
```

**Public routes.** For a surface that must be reachable *without* auth — a
signup form, an inbound webhook, a public status page — set
`RegisterPublicRoutes` on the plugin. Those routes still get identity resolution
(so a presented credential is honored) and the body cap, but they bypass the
anonymous-mutation gate at any path. Authenticated routes and the built-in
`/api/v1` mutations stay gated. A module may be public-only.

The worked example is `pk-apps/examples/custommodule` (a tenant-scoped widgets
module with both an authenticated API and a public `GET /w/{tenant}/count`).

## Prove your module is tenant-scoped

Forgetting the `WHERE tenant_id = ?` predicate is the one mistake that silently
breaks isolation. Assert you didn't, from a test, with the shared conformance
helper — it creates a row in one tenant and fails if a second tenant can read
or delete it by ID:

```go
import "github.com/septagon-oss/pk-modules/pkg/contracttest"

func TestNoteStoreIsTenantScoped(t *testing.T) {
    s := newTestStore(t)
    contracttest.AssertTenantScoped(t, contracttest.TenantScopedStore{
        Create:   func(ctx context.Context, tid string) (string, error) { /* insert, return id */ },
        Get:      func(ctx context.Context, tid, id string) error { _, err := s.Get(ctx, tid, id); return err },
        Delete:   s.Delete,
        NotFound: store.ErrNotFound,
    })
}
```

---

See also: [architecture.md](architecture.md) for how modules and the catalog fit
together, [quickstart.md](quickstart.md) to run the app you are extending.
