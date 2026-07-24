# PlatformKit architecture documentation

The numbered arc42 narrative in this directory is archived. It describes a
larger historical/downstream workspace, not the current nine-module PlatformKit
OSS runtime, and it is intentionally absent from the public docs manifest.

For current setup, capabilities, boundaries, and extension guidance, use
[`docs/current/`](../docs/current/quickstart.md) and verify executable claims
against the public `septagon-oss` code repositories. The files remain here only
to preserve decision context while accurate current architecture documentation
is written from the public code.

## Authoring boundaries

- Do not add current claims to the archived numbered sections.
- Decisions with meaningful alternatives belong in [`../adr/`](../adr/); copy
  [`../adr/0000-template.md`](../adr/0000-template.md) and register an accepted
  decision in [the docs manifest](../.platformkit/docs.manifest.yaml).
- Executable obligations belong in [`../requirements/`](../requirements/).
- Mechanical house rules belong in [`../conventions.md`](../conventions.md).
- Reference-module behavior belongs beside the code in the public
  `github.com/septagon-oss/pk-modules/pkg/<name>` package. Current runtime
  boundaries live in
  [`../docs/current/runtime-surfaces.md`](../docs/current/runtime-surfaces.md).

The abandoned CUE/module-charter projection plan is preserved only as history
in superseded [ADR 0023](../adr/0023-module-documentation-stack.md). Do not add
`MODULE.cue`, catalog YAML, or hand-maintained projection copies on its behalf.

## Authority and repository scope

Code owns executable facts. In the full PlatformKit distribution, typed
`ModuleContract` values own catalog, tier, preset, and set facts under
`pk-modules/catalog/modulecontracts`; serialized
catalog formats are generated exports under
[ADR 0048](../adr/0048-go-authored-catalog-and-generated-exports.md).

The public `pk-modules` repository is intentionally a smaller reference pack
under `pkg/`. It composes those exported packages directly and does not mirror
the full distribution's catalog. Public and downstream repositories must not
create a second YAML or CSV authority to make the two layouts appear identical.

## Links and generated output

Use relative Markdown links and keep authority links resolvable inside this
repository. The docs website discovers source content, while
`.platformkit/docs.manifest.yaml` explicitly registers federated topics and
accepted ADR navigation. Generated Antora and website output is a projection;
edit the Markdown source and rerun the documented build instead of editing
generated files.
