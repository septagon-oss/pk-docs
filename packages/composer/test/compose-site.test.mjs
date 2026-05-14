import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { loadGeneratedBundles, syncWorkspaceModules } from "../../module-source/src/index.mjs";
import { composeSiteModel } from "../src/index.mjs";

test("composeSiteModel builds a translation management page model", async () => {
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), "pk-docs-composer-"));
  const docsRoot = path.join(workspaceRoot, "pk-docs");
  const modulesRoot = path.join(workspaceRoot, "pk-modules");
  const moduleDocsRoot = path.join(modulesRoot, "translation_management", "docs");

  await fs.mkdir(moduleDocsRoot, { recursive: true });
  await fs.mkdir(docsRoot, { recursive: true });
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
            body: "# Translation Management\n\nNarrative.",
          },
          features: [
            {
              id: "translations",
              name: "Translation Management",
              description: "Manage translations",
              enabled: true,
              tags: ["i18n"],
              permissions: ["translations.view"],
              endpoints: [{}],
            },
          ],
          showcases: [
            {
              id: "translation-showcase",
              title: "Translation Showcase",
              summary: "Walkthrough",
              basePath: "/admin/translations",
              routes: [{ id: "list", path: "/admin/translations" }],
              flows: [{ id: "create", title: "Create" }],
              requiredFields: ["key"],
            },
          ],
          events: [{ id: "translation.updated", title: "Translation updated" }],
          dependencies: [{ moduleId: "tenant_management", type: "required" }],
          api: {
            sourcePath: "translation_management/docs/api/openapi.json",
            document: {
              openapi: "3.1.0",
              info: { title: "Translation API", version: "1.0.0" },
              components: { schemas: { Translation: { type: "object" } } },
            },
            operations: new Array(9).fill(null).map((_, index) => ({
              operationId: `translation-${index}`,
              method: "GET",
              path: `/api/${index}`,
              summary: `Operation ${index}`,
              featureIds: ["translations"],
              tags: ["translations"],
            })),
          },
        },
      },
      null,
      2,
    ),
  );

  const syncResult = await syncWorkspaceModules({
    docsRoot,
    modulesRoot,
    selectedModules: ["translation_management"],
  });
  const bundles = await loadGeneratedBundles({ generatedRoot: syncResult.generatedRoot });
  const site = await composeSiteModel({
    bundles,
    generatedRoot: syncResult.generatedRoot,
  });

  assert.equal(site.modules.length, 1);
  assert.equal(site.modules[0].id, "translation_management");
  assert.equal(site.modules[0].api.operationCount, 9);
  assert.equal(site.modules[0].showcases.length, 1);

  await fs.rm(workspaceRoot, { recursive: true, force: true });
});
