import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { discoverModuleSources } from "../src/index.mjs";

test("discoverModuleSources finds translation management bundle", async () => {
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), "pk-docs-module-source-"));
  const modulesRoot = path.join(workspaceRoot, "pk-modules");
  const moduleDocsRoot = path.join(modulesRoot, "translation_management", "docs");
  await fs.mkdir(moduleDocsRoot, { recursive: true });
  await fs.writeFile(
    path.join(moduleDocsRoot, "bundle.json"),
    JSON.stringify(
      {
        apiVersion: "docs.platformkit.dev/v1alpha1",
        kind: "ModuleDocsBundle",
        metadata: {
          name: "translation_management",
          generatedAt: "2026-04-09T00:00:00Z",
          generatedBy: "test",
        },
        spec: {
          module: {
            id: "translation_management",
            title: "Translation Management",
            modulePath: "translation_management",
          },
          narrative: {
            summary: "Centralized translations.",
          },
          api: {
            operations: new Array(9).fill(null).map((_, index) => ({
              operationId: `translation-${index}`,
              method: "GET",
              path: `/api/${index}`,
              featureIds: ["translations"],
            })),
          },
        },
      },
      null,
      2,
    ),
  );

  const sources = await discoverModuleSources({
    modulesRoot,
    selectedModules: ["translation_management"],
  });

  assert.equal(sources.length, 1);
  assert.equal(sources[0].moduleId, "translation_management");
  assert.equal(sources[0].bundle.spec.api.operations.length, 9);

  await fs.rm(workspaceRoot, { recursive: true, force: true });
});
