import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";

import { markdownToAsciiDoc, syncWorkspaceAntora } from "../src/index.mjs";

test("markdownToAsciiDoc converts headings and fenced code", () => {
  const result = markdownToAsciiDoc(`# Sample

## Steps

\`\`\`bash
echo hi
\`\`\`
`, "Sample");

  assert.match(result, /^== Steps/m);
  assert.match(result, /\[source,bash\]\n----\necho hi\n----/m);
  assert.doesNotMatch(result, /^= Sample/m);
});

test("syncWorkspaceAntora generates an antora content source from feature-local docs", async () => {
  const root = await fs.mkdtemp(path.join(process.cwd(), ".tmp-antora-test-"));
  const modulesRoot = path.join(root, "pk-modules");
  const docsRoot = path.join(root, "pk-docs");
  const generatedRoot = path.join(modulesRoot, ".generated", "antora");

  await fs.mkdir(path.join(modulesRoot, ".platformkit"), { recursive: true });
  await fs.mkdir(path.join(modulesRoot, "docs", "tutorials"), { recursive: true });
  await fs.mkdir(path.join(modulesRoot, "visit_management", "features", "visit_tracking"), { recursive: true });

  await fs.writeFile(
    path.join(modulesRoot, ".platformkit", "docs.manifest.yaml"),
    `schema_version: 1
component_id: pk-modules
title: PlatformKit OSS Modules
federation:
  assemblers: [antora, techdocs]
  reference_sources: [openapi, asyncapi, jsonschema]
repo_topics:
  - id: intro
    title: Intro tutorial
    path: docs/tutorials/intro.tutorial.md
    dita_type: task
    diataxis: tutorial
pilot_modules:
  - visit_management
module_docs:
  manifest_path: docs.manifest.yaml
  required_diataxis: [explanation, how-to, reference]
`,
  );

  await fs.writeFile(
    path.join(modulesRoot, "docs", "tutorials", "intro.tutorial.md"),
    `---
title: Intro tutorial
component_id: pk-modules
scope: repo
topic_id: intro
dita_type: task
diataxis: tutorial
---

# Intro tutorial

Body.
`,
  );

  await fs.writeFile(
    path.join(modulesRoot, "visit_management", "docs.manifest.yaml"),
    `schema_version: 1
component_id: pk-modules
module_id: visit_management
title: Visit Management
topics:
  - id: visit-boundary
    title: Visit boundary
    path: features/visit_tracking/boundary.explanation.md
    dita_type: concept
    diataxis: explanation
  - id: visit-howto
    title: Configure visit tracking
    path: features/visit_tracking/configure-visit-tracking.howto.md
    dita_type: task
    diataxis: how-to
  - id: visit-ref
    title: Visit contract
    path: features/visit_tracking/visit.reference.md
    dita_type: reference
    diataxis: reference
`,
  );

  await fs.writeFile(
    path.join(modulesRoot, "visit_management", "features", "visit_tracking", "boundary.explanation.md"),
    `---
title: Visit boundary
component_id: pk-modules
module_id: visit_management
scope: module
topic_id: visit-boundary
dita_type: concept
diataxis: explanation
---

# Visit boundary

Boundary body.
`,
  );
  await fs.writeFile(
    path.join(modulesRoot, "visit_management", "features", "visit_tracking", "configure-visit-tracking.howto.md"),
    `---
title: Configure visit tracking
component_id: pk-modules
module_id: visit_management
scope: module
topic_id: visit-howto
dita_type: task
diataxis: how-to
---

# Configure visit tracking

1. Enable the module.
`,
  );
  await fs.writeFile(
    path.join(modulesRoot, "visit_management", "features", "visit_tracking", "visit.reference.md"),
    `---
title: Visit contract
component_id: pk-modules
module_id: visit_management
scope: module
topic_id: visit-ref
dita_type: reference
diataxis: reference
---

# Visit contract

Reference body.
`,
  );

  const result = await syncWorkspaceAntora({ docsRoot, modulesRoot, generatedRoot });

  assert.equal(result.moduleCount, 1);
  const descriptor = await fs.readFile(path.join(generatedRoot, "antora.yml"), "utf8");
  assert.match(descriptor, /name: pk-modules/);

  const rootIndex = await fs.readFile(path.join(generatedRoot, "modules", "ROOT", "pages", "index.adoc"), "utf8");
  assert.match(rootIndex, /xref:visit_management:index\.adoc\[Visit Management\]/);

  const moduleIndex = await fs.readFile(
    path.join(generatedRoot, "modules", "visit_management", "pages", "index.adoc"),
    "utf8",
  );
  assert.match(moduleIndex, /Configure visit tracking/);

  const boundaryPage = await fs.readFile(
    path.join(generatedRoot, "modules", "visit_management", "pages", "features", "visit_tracking", "boundary.adoc"),
    "utf8",
  );
  assert.match(boundaryPage, /^= Visit boundary/m);

  await fs.rm(root, { recursive: true, force: true });
});
