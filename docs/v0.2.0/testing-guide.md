---
title: v0.2.0 Testing Guide
slug: v0-2-0-testing-guide
collection: docs
status: published
---

# v0.2.0 Testing Guide

`pk-testkit` is the adapter-neutral test layer for PlatformKit modules and
apps. It depends only on `pk-shared` — no browser, no database, no container
runtime — so the same definitions run in unit tests, local apps, and
downstream E2E harnesses. Three packages ship in v0.2.0:

| Package | Purpose |
|---------|---------|
| `pkg/conformance` | Deterministic pass/fail/skip check suites with structured reports. |
| `pkg/apitest` | Run API flow definitions against any `http.Handler` in-process. |
| `pkg/flowtest` | Validate that every requirement is covered by at least one valid flow. |

Prerequisites: Go 1.26+ and

```bash
go get github.com/septagon-oss/pk-testkit@v0.2.0
go get github.com/septagon-oss/pk-shared@v0.2.0   # flow definitions
```

## Conformance suites (`pkg/conformance`)

A `conformance.Check` is an ID, a requirement ID, and a
`Run func(context.Context) (conformance.Result, error)`. `NewSuite` validates
the checks (unique, whitespace-free IDs; requirement ID and run function
required) and stores them sorted by ID, so runs are deterministic. `Run`
returns a `Report` whose `Status` aggregates fail-first (`fail` if any check
failed, `skip` if everything skipped, else `pass`).

This example is taken from the package's own runnable godoc example:

```go
package myapp_test

import (
	"context"
	"testing"

	"github.com/septagon-oss/pk-testkit/pkg/conformance"
)

func TestConformance(t *testing.T) {
	suite, err := conformance.NewSuite(conformance.Check{
		ID:            "runtime.ready",
		RequirementID: "REQ-READY",
		Description:   "runtime reports ready",
		Run: func(context.Context) (conformance.Result, error) {
			return conformance.Pass("runtime is ready"), nil
		},
	})
	if err != nil {
		t.Fatal(err)
	}

	report := suite.Run(context.Background())
	if !report.OK() {
		t.Fatalf("conformance failed: %+v", report.Results)
	}
}
```

Result constructors: `conformance.Pass(msg)`, `conformance.Fail(msg)`,
`conformance.Skip(msg)`; a returned error from `Run` counts as a failure. The
`Report` and `CheckResult` types carry JSON tags, so you can serialize a run
straight into CI artifacts.

## API flow tests (`pkg/apitest`)

`apitest.NewRunner(handler)` executes the API channel of a
`flowdef.Definition` (from `pk-shared/pkg/flowdef`) against an `http.Handler`
using `httptest` — no network, no server. Each `flowdef.APIStep` declares an
operation ID, method, path, and expected `SuccessStatuses` (default: any 2xx).

Because the starter app exposes its whole HTTP surface as one handler
(`App.Mux()`), you can run flows against the real composed app. This test
boots the nine-module app on a temporary SQLite file and drives the seeded
login endpoint:

```go
package myapp_test

import (
	"context"
	"path/filepath"
	"testing"

	_ "modernc.org/sqlite"

	"github.com/septagon-oss/pk-apps/pkg/starterapp"
	"github.com/septagon-oss/pk-shared/pkg/flowdef"
	"github.com/septagon-oss/pk-testkit/pkg/apitest"
)

func TestTenantListFlow(t *testing.T) {
	cfg := starterapp.DefaultConfig()
	cfg.Database.DSN = "file:" + filepath.Join(t.TempDir(), "pk.db")

	app, err := starterapp.BuildApp(context.Background(), cfg)
	if err != nil {
		t.Fatal(err)
	}
	defer app.Close()

	mux, err := app.Mux()
	if err != nil {
		t.Fatal(err)
	}

	runner, err := apitest.NewRunner(mux)
	if err != nil {
		t.Fatal(err)
	}

	result := runner.Run(context.Background(), flowdef.Definition{
		ID:   "tenants.list",
		Name: "List tenants",
		Channels: flowdef.Channels{API: &flowdef.APIChannel{Steps: []flowdef.APIStep{{
			OperationID:     "tenants.list",
			Method:          "GET",
			Path:            "/api/v1/tenants",
			SuccessStatuses: []int{200},
		}}}},
	})
	if !result.Passed {
		t.Fatalf("flow failed: %+v", result.Steps)
	}
}
```

(Add `go get github.com/septagon-oss/pk-apps@v0.2.0` and
`go get modernc.org/sqlite` for this one.)

The default request builder sends no body and copies each step's static
`Headers`. Steps that need JSON bodies or values captured from earlier
responses use `apitest.WithRequestBuilder` to supply a custom
`apitest.RequestBuilder` — the runner stays in charge of execution and status
assertions.

## Requirement coverage (`pkg/flowtest`)

`flowtest.ValidateCoverage(requirements, flows)` cross-checks a requirement
list against your flow definitions: every requirement must be fulfilled by at
least one *valid* flow (invalid flows, duplicate IDs, and references to
unknown requirements become diagnostics; uncovered requirements land in
`Missing`).

```go
package myapp_test

import (
	"testing"

	"github.com/septagon-oss/pk-shared/pkg/flowdef"
	"github.com/septagon-oss/pk-testkit/pkg/flowtest"
)

func TestRequirementCoverage(t *testing.T) {
	requirements := []flowtest.Requirement{
		{ID: "REQ-TENANT-LIST", Title: "Tenants are listable", Critical: true},
	}
	flows := []flowdef.Definition{{
		ID:       "tenants.list",
		Name:     "List tenants",
		Fulfills: []string{"REQ-TENANT-LIST"},
		Channels: flowdef.Channels{API: &flowdef.APIChannel{Steps: []flowdef.APIStep{{
			OperationID: "tenants.list",
			Method:      "GET",
			Path:        "/api/v1/tenants",
		}}}},
	}}

	report := flowtest.ValidateCoverage(requirements, flows)
	if !report.OK() {
		t.Fatalf("missing: %v, diagnostics: %v", report.Missing, report.Diagnostics)
	}
}
```

The pattern the three packages add up to: define flows once in `flowdef`,
prove coverage with `flowtest`, execute them with `apitest`, and wrap
everything an external system needs to trust into a `conformance` suite.

## Testing your own module without the kit

pk-testkit complements — it does not replace — ordinary Go tests. Module
stores take a `*sql.DB` or a DSN, handlers mount on any `*http.ServeMux`, and
every cross-module dependency is an interface you can fake (see
[Add a module](./add-a-module.md)). `pk verify` runs `go vet ./...` and
`go test ./...` for you — see the [CLI Reference](./cli-reference.md).
