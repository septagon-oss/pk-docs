# PlatformKit architecture documentation

This directory holds the public, workspace-level architecture narrative. Start
with [`index.md`](./index.md), then follow the numbered arc42 sections for the
system context, building blocks, runtime, deployment, decisions, quality, risks,
and glossary.

## Authoring boundaries

- Cross-workspace explanations belong in the matching numbered architecture
  section.
- Decisions with meaningful alternatives belong in [`../adr/`](../adr/); copy
  [`../adr/0000-template.md`](../adr/0000-template.md) and register an accepted
  decision in [the docs manifest](../.platformkit/docs.manifest.yaml).
- Executable obligations belong in [`../requirements/`](../requirements/).
- Mechanical house rules belong in [`../conventions.md`](../conventions.md).
- Reference-module behavior belongs beside the code in the public
  `github.com/septagon-oss/pk-modules/pkg/<name>` package. The release-oriented
  module index lives in [`../docs/v0.2.0/module-reference.md`](../docs/v0.2.0/module-reference.md).

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
