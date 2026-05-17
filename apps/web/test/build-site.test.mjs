import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import { buildSite } from "../src/build-site.mjs";

test("buildSite publishes docs as hosted content pages with page models", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "pk-docs-build-"));
  await fs.mkdir(path.join(root, ".generated", "modules"), { recursive: true });
  await fs.mkdir(path.join(root, "docs"), { recursive: true });
  await fs.writeFile(
    path.join(root, "docs", "ARCHITECTURE.md"),
    "---\ntitle: Architecture\nslug: architecture\ncollection: docs\n---\n# Architecture\n\nPublic architecture.",
  );

  const result = await buildSite({ workspaceRoot: root });
  const contentIndex = JSON.parse(await fs.readFile(path.join(result.distRoot, "docs", "content-index.json"), "utf8"));
  const pageModel = JSON.parse(
    await fs.readFile(
      path.join(result.distRoot, "docs", "architecture", "page-model.json"),
      "utf8",
    ),
  );
  const pageHtml = await fs.readFile(
    path.join(result.distRoot, "docs", "architecture", "index.html"),
    "utf8",
  );

  assert.equal(result.documentCount, 1);
  assert.equal(contentIndex[0].route, "/docs/architecture");
  assert.equal(contentIndex[0].content, undefined);
  assert.equal(contentIndex[0].contentHtml, undefined);
  assert.equal(pageModel.type, "content_page");
  assert.equal(pageModel.contentType, "documentation");
  assert.match(pageHtml, /Public architecture/);
});
