---
title: v0.1.0 Configuration Reference
slug: v0-1-0-configuration
collection: docs
status: published
---

# v0.1.0 Configuration Reference

The starter app's configuration surface is deliberately small: one optional
`config.yaml`, parsed by `pk-apps/pkg/starterapp/config.go` into a typed
`Config`. This page is the complete reference — every key that exists, its
default, and exactly how the file is (and is not) loaded.

Two facts up front, because they surprise people:

1. **No environment variables are read.** Not for the port, not for the DSN,
   not for anything. Configuration comes from `config.yaml` (when a wrapper
   loads it) or from `DefaultConfig()` — full stop.
2. **The front door (`github.com/septagon-oss/platformkit`) does not read
   `config.yaml` at all.** Its `main.go` calls `starterapp.DefaultConfig()`
   and passes the result to `starterapp.Run`. See
   [Using a config file](#using-a-config-file) below for the supported paths.

## The full key set

The parser accepts exactly these keys. Anything else — top-level key, section,
or key within a section — is **rejected** with an error naming the file and
line (`config config.yaml:7: unknown http key "port"`), so typos fail loudly
instead of being silently ignored.

| Key | Type | Default | Notes |
|-----|------|---------|-------|
| `app_name` | string | `starter-saas` | Used in the admin shell title (`<app_name> Admin`) and the runtime host identity. |
| `app_version` | string | `0.1.0` | Reported through the runtime host identity. |
| `environment` | string | `development` | Free-form label passed to the runtime host. |
| `http.addr` | string | `:8080` | Listen address for `http.Server`. |
| `http.read_timeout` | Go duration | `30s` | `http.Server.ReadTimeout`. Parsed with `time.ParseDuration` — `30s`, `1m`, `1h30m`, … |
| `http.write_timeout` | Go duration | `30s` | `http.Server.WriteTimeout`. |
| `http.shutdown_timeout` | Go duration | `30s` | Grace period for `server.Shutdown` on SIGINT/SIGTERM. |
| `database.driver` | string | `sqlite` | `database/sql` driver name. The wrappers register `modernc.org/sqlite` under the name `sqlite`. |
| `database.dsn` | string | `file:./pk.db?_pragma=busy_timeout(5000)&cache=shared&mode=rwc` | The shared SQLite DSN every module store runs on. `busy_timeout(5000)` makes a locked database wait up to 5s instead of failing with `SQLITE_BUSY`. |
| `cache.provider` | string | `memory` | **Parsed but not consumed** by the v0.1.0 starter graph — reserved for future/downstream use. |

There are no other keys. A malformed duration is an error
(`config config.yaml:5: http.read_timeout: time: invalid duration ...`).

## A complete sample `config.yaml`

```yaml
# Starter app configuration. Every key is optional; missing keys
# fall back to the defaults documented above.
app_name: my-saas
app_version: 0.1.0
environment: production

http:
  addr: ":8080"
  read_timeout: 30s
  write_timeout: 30s
  shutdown_timeout: 30s

database:
  driver: sqlite
  dsn: "file:/var/lib/my-saas/pk.db?_pragma=busy_timeout(5000)&cache=shared&mode=rwc"

cache:
  provider: memory
```

Parser behavior worth knowing:

- Comments (`#` outside quotes), blank lines, and trailing whitespace are
  tolerated; surrounding double quotes on values are stripped.
- A line with a key and no value (`http:`) opens a section; an unindented
  `key: value` line closes it.
- **A missing file is not an error** — `LoadConfig` returns `DefaultConfig()`
  so the starter still boots. A present-but-invalid file *is* an error.
- This is a hand-written line-oriented parser, not a full YAML implementation.
  Nested structures beyond the two levels above, anchors, and multi-line
  values are not supported.

## How loading actually works

The two exported entry points in `pk-apps/pkg/starterapp`:

```go
func DefaultConfig() *Config                    // complete, bootable defaults
func LoadConfig(path string) (*Config, error)   // defaults + overrides from path
```

and the boot call every wrapper uses:

```go
func Run(ctx context.Context, cfg *Config) error
```

`Run` builds the whole nine-module app from `cfg`, serves until the context is
cancelled, and releases the shared SQLite handle on every exit path.

The two shipped wrappers differ only in the first line:

- **Front door** (`github.com/septagon-oss/platformkit`, `go run .`):
  `cfg := starterapp.DefaultConfig()` — ships no config file, always boots on
  `:8080` with `./pk.db`.
- **pk-apps starter** (`pk-apps/apps/starter-saas`):
  `cfg, err := starterapp.LoadConfig("config.yaml")` — reads `config.yaml`
  from the current working directory if present.

## Using a config file

If you started from the front door and want a config file, write your own
~15-line wrapper — this is the honest, supported path (there is no flag or
environment variable to point the front door at a file):

```go
package main

import (
	"context"
	"log"
	"os/signal"
	"syscall"

	_ "modernc.org/sqlite" // registers the "sqlite" driver

	"github.com/septagon-oss/pk-apps/pkg/starterapp"
)

func main() {
	ctx, cancel := signal.NotifyContext(context.Background(),
		syscall.SIGINT, syscall.SIGTERM)
	defer cancel()

	cfg, err := starterapp.LoadConfig("config.yaml")
	if err != nil {
		log.Fatalf("load config: %v", err)
	}
	if err := starterapp.Run(ctx, cfg); err != nil {
		log.Fatalf("run: %v", err)
	}
}
```

```bash
mkdir my-saas && cd my-saas
go mod init example.com/my-saas
# save the wrapper above as main.go, and your config.yaml next to it
go mod tidy
go run .
```

Requires Go 1.26+. The blank import of `modernc.org/sqlite` matters: the
starter opens the database through `database/sql` with the driver name from
`database.driver`, and nothing else registers that driver for you.

Alternatively, mutate the struct directly — `Config` fields are plain exported
Go values (`cfg := starterapp.DefaultConfig(); cfg.HTTP.Addr = ":9090"`).

## Related pages

- [Quickstart](./quickstart.md) — the zero-config `go run .` path.
- [Deployment Guide](./deployment-guide.md) — production DSN placement,
  systemd, and Docker.
- [Security Baseline](./security-baseline.md) — why "no env vars" also means
  secrets live in the file or your wrapper.
