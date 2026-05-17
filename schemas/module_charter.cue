// Package charter defines the schema every PlatformKit module
// charter (`<module>/MODULE.cue`) unifies against. The schema is the
// single source of truth for module facts; everything else (catalog
// yaml, generated docs, agent skills, .claude context, Antora pages)
// is a projection.
//
// See ADR 0023 for the rationale behind the surrounding doc stack.
//
// Authoring contract:
//   - Every field marked `string` is required unless followed by `?`.
//   - Every list field rejects an empty list at the schema level
//     except where the comment says "may be empty".
//   - Enum fields enumerate every legal value; CUE rejects unknowns
//     at compile time.
//
// Validation:
//
//   cue vet pk-docs/schemas/module_charter.cue \
//          <module>/MODULE.cue
//
// runs as part of `make check-module-charter` and as the first
// gate before any narrative analyzer.
package charter

#Charter: {
	// schema pins the schema version this charter is valid for.
	// Bumping the schema major version requires a coordinated
	// migration of every module charter.
	schema: "module-charter/v1"

	identity:     #Identity
	boundary:     #Boundary
	surfaces:     #Surfaces
	dependencies: #Dependencies
	operability:  #Operability
	references:  #References
	maturity:    #Maturity
	arc42:       #Arc42
	diataxis:    #Diataxis
	designDoc:   #DesignDoc
}

// ---------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------

#Identity: {
	// name is the canonical module id (snake_case, ends with
	// `_management` by convention but not enforced for every existing
	// module).
	name: =~"^[a-z][a-z0-9_]*$"

	// description is a single sentence shown in the catalog tile,
	// agent-skill manifest, and module marketplace.
	description: string

	// version follows semver. Version bumps trigger changelog
	// entries.
	version: =~"^[0-9]+\\.[0-9]+\\.[0-9]+$"

	// basePath is the canonical HTTP base path for the module's
	// public surface. Empty when the module has no HTTP routes.
	basePath?: string

	// category is a free-form taxonomy slot ("compliance", "core",
	// "commerce", …). Catalog yaml validates the canonical set.
	category: string

	// domain is one of the eight workspace domains. Defines which
	// domain doc the module's charter transcludes into.
	domain: "governance" | "identity-access" | "workspace" |
		"content-experience" | "engagement" | "integrations" |
		"platform" | "revenue"

	// capabilityType reflects the module's role in compositions.
	// "system" = platform machinery; "business" = product feature;
	// "experience" = user-facing surface; "integration" = adapter.
	capabilityType: "system" | "business" | "experience" | "integration"

	// tier is the lifecycle posture set by ADR 0015.
	tier: "core-certified" | "supported" | "experimental"

	// assuranceEligible flags modules that participate in the
	// assurance-core set.
	assuranceEligible: bool

	// presets lists the preset labels the module opts into.
	presets: [...("minimal" | "core" | "default" | "coworking")]

	// archetype is the structural shape of the module
	// ("registry", "feature-set", "integration-adapter").
	archetype?: string

	// owner identifies the team or person accountable for the
	// module. May be a GitHub team handle.
	owner?: string

	// tags are free-form discovery hints surfaced in the catalog
	// and agent-skill manifest.
	tags: [...string]
}

// ---------------------------------------------------------------------
// Boundary
// ---------------------------------------------------------------------
//
// Boundary is the load-bearing section. It captures what the module
// owns AND what it intentionally does not. The "out of scope" entries
// pair the excluded responsibility with the module that does own it,
// so readers can route work to the right module without guessing.

#Boundary: {
	inScope: [...string]
	outOfScope: [...{
		item:  string
		owner: string  // module name that does own this responsibility
	}]
}

// ---------------------------------------------------------------------
// Surfaces
// ---------------------------------------------------------------------
//
// Surfaces are the public-API view of the module. The
// `charter-surface-parity` analyzer cross-checks each surface against
// the actual code (huma.Register calls, WithEvent calls, b.Service
// registrations) and fails CI on drift.

#Surfaces: {
	routes: [...#Route]
	events: [...#Event]
	services: [...#Service]
	components: [...string]    // PKDS component names contributed
	settings: [...#Setting]    // settings keys registered with admin
	permissions: [...string]   // authz tokens declared
}

#Route: {
	method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS"
	path:    string
	auth:    "public" | "authenticated" | "permission"
	purpose: string
	// permission is required when auth=permission.
	permission?: string
}

#Event: {
	name:    =~"^[a-z][a-z0-9._-]*$"
	purpose: string
	// payload is the JSON shape; values are TypeScript-style hints
	// ("string", "timestamp", "object", "boolean").
	payload: {[string]: string}
	// consumers names modules expected to subscribe.
	consumers: [...string]
}

#Service: {
	name:        string
	"interface": string  // fully qualified contracts/provides interface
	purpose:     string
}

#Setting: {
	key:         string
	type:        "string" | "number" | "boolean" | "enum" | "object"
	default?:    _
	description: string
}

// ---------------------------------------------------------------------
// Dependencies
// ---------------------------------------------------------------------

#Dependencies: {
	required: [...#Dependency]
	optional: [...#Dependency]
}

#Dependency: {
	port:        string  // fully qualified port type (e.g. "ports.AuditService")
	via:         string  // canonical providing module id
	why:         string  // one sentence — the rationale, not the port name
	category?:   "Security" | "UI" | "Data" | "Infrastructure" | "Monitoring" | "Communication"
}

// ---------------------------------------------------------------------
// Operability
// ---------------------------------------------------------------------

#Operability: {
	health: {
		// provides=true when the module registers health checks via
		// ports.HealthRegistrar.
		provides: bool
		checks?: [...string]
	}
	audit: {
		// emits lists the event names this module pushes into the
		// audit trail. Empty when the module doesn't audit.
		emits: [...string]
		complianceTags?: [...string]
	}
	retention?: {
		policy:   "ephemeral" | "operational" | "regulatory" | "indefinite"
		duration: string  // ISO 8601 duration ("P30D", "P3Y")
	}
	metrics: [...string]   // Prometheus metric names
}

// ---------------------------------------------------------------------
// References
// ---------------------------------------------------------------------

#References: {
	adrs: [...string]      // ADR slugs, e.g. "ADR 0009"
	standards: [...string] // external standards (RFC, ISO, GDPR Art.)
	related: [...string]   // related module ids
}

// ---------------------------------------------------------------------
// Maturity
// ---------------------------------------------------------------------

#Maturity: {
	since:        string  // semver — when the module first reached its current shape
	changeLog?:   string  // path to CHANGELOG.md
	deprecation?: {
		since:       string
		removeBy:    string
		replacement: string
	}
	testCoverage: {
		unit:        string  // glob or path
		integration?: string
		e2e?:        string
	}
	signals: {
		breakingChangesAllowed: bool
		betaFeatures: [...string]
	}
}

// ---------------------------------------------------------------------
// arc42 (workspace + domain transclusion targets)
// ---------------------------------------------------------------------
//
// These fields project into the module's home in domain §5 and the
// workspace arc42 §10 / §11.

#Arc42: {
	goals: [...string]    // §1 — bullets of what success looks like

	constraints: {        // §2 — facts; rationale lives in MODULE.md
		regulatory: [...string]
		performance: [...string]
		presets: [...string] // mirrors identity.presets — kept here for arc42 transclusion
	}

	runtime: {            // §6
		flows: [...{
			name:         string
			diagram:      string  // path relative to the module dir
			participants: [...string]
		}]
	}

	qualityRequirements: [...{   // §10 — ISO 25010 vocabulary
		attribute: "functional-suitability" | "performance-efficiency" |
			"compatibility" | "usability" | "reliability" |
			"security" | "maintainability" | "portability"
		statement: string
		metric:    string
		target:    string
	}]

	risks: [...{           // §11
		description: string
		severity:    "low" | "medium" | "high"
		mitigation:  string
	}]

	glossary: [...{        // §12 — module-local terms only
		term:       string
		definition: string
	}]
}

// ---------------------------------------------------------------------
// Diátaxis
// ---------------------------------------------------------------------
//
// Each module's MODULE.md body is a Diátaxis layout. The schema only
// captures which quadrants the module ships and where their content
// lives, so the projection generator can stitch them together.

#Diataxis: {
	primary: "tutorial" | "how-to" | "reference" | "explanation"
	tutorials: [...{
		title: string
		// body is "inline" (in MODULE.md) or a path to a separate
		// markdown file the projection includes.
		body:  "inline" | =~"^\\./.+\\.md$"
	}]
	howTos: [...{title: string, body: "inline" | =~"^\\./.+\\.md$"}]
	// Reference is always projected — generated from charter +
	// OpenAPI + AsyncAPI; the schema does not enumerate its body.
	explanations: [...{title: string, body: "inline" | =~"^\\./.+\\.md$"}]
}

// ---------------------------------------------------------------------
// Google Design Doc — intent capture
// ---------------------------------------------------------------------

#DesignDoc: {
	// goals state what success looks like, in language a stakeholder
	// would recognise (not engineering jargon).
	goals: [...string]

	// nonGoals state what this module deliberately does not do.
	// This is the harder list to write and the most valuable.
	nonGoals: [...string]

	// consideredAlternatives names the design choices we weighed and
	// rejected. Each entry is two short paragraphs in MODULE.md;
	// the schema only captures the title for transclusion.
	consideredAlternatives: [...{
		title:     string
		rejection: string  // one-sentence summary
	}]
}
