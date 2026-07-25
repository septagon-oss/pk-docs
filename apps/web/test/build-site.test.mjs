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

test("buildSite prefixes root-absolute URLs with basePath for subpath hosting", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "pk-docs-build-"));
  await fs.mkdir(path.join(root, ".generated", "modules"), { recursive: true });
  await fs.mkdir(path.join(root, "docs"), { recursive: true });
  await fs.writeFile(
    path.join(root, "docs", "ARCHITECTURE.md"),
    "---\ntitle: Architecture\nslug: architecture\ncollection: docs\n---\n# Architecture\n\nPublic architecture.",
  );

  const result = await buildSite({ workspaceRoot: root, basePath: "/pk-docs" });
  const homeHtml = await fs.readFile(path.join(result.distRoot, "index.html"), "utf8");
  const pageHtml = await fs.readFile(
    path.join(result.distRoot, "docs", "architecture", "index.html"),
    "utf8",
  );

  assert.match(homeHtml, /href="\/pk-docs\/assets\/site\.css"/);
  assert.doesNotMatch(homeHtml, /(href|src)="\/(?!pk-docs\/)/);
  assert.doesNotMatch(pageHtml, /(href|src)="\/(?!pk-docs\/)/);
});

test("buildSite publishes a docs-only site by default even when the overlay exists", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "pk-docs-build-"));
  const repoRoot = path.resolve(new URL(".", import.meta.url).pathname, "../../..");
  await fs.mkdir(path.join(root, ".generated", "modules"), { recursive: true });
  await fs.mkdir(path.join(root, "docs"), { recursive: true });
  await fs.cp(path.join(repoRoot, "overlays"), path.join(root, "overlays"), { recursive: true });
  await fs.writeFile(
    path.join(root, "docs", "ARCHITECTURE.md"),
    "---\ntitle: Architecture\nslug: architecture\ncollection: architecture\n---\n# Architecture\n\nPublic architecture.",
  );

  const result = await buildSite({ workspaceRoot: root });
  const homeHtml = await fs.readFile(path.join(result.distRoot, "index.html"), "utf8");

  assert.doesNotMatch(homeHtml, /overlay|EUR|platformkit\.dev|1490/i);
  assert.match(homeHtml, /href="\/docs"/);
  assert.match(homeHtml, /href="\/docs\/architecture"/);
  assert.doesNotMatch(homeHtml, /#customers|#compare/);
  await assert.rejects(fs.access(path.join(result.distRoot, "assets", "overlays")));
});

test("buildSite includes the overlay only when publishOverlay is set", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "pk-docs-build-"));
  const repoRoot = path.resolve(new URL(".", import.meta.url).pathname, "../../..");
  await fs.mkdir(path.join(root, ".generated", "modules"), { recursive: true });
  await fs.mkdir(path.join(root, "docs"), { recursive: true });
  await fs.cp(path.join(repoRoot, "overlays"), path.join(root, "overlays"), { recursive: true });

  const result = await buildSite({ workspaceRoot: root, publishOverlay: true });
  const homeHtml = await fs.readFile(path.join(result.distRoot, "index.html"), "utf8");

  assert.match(homeHtml, /data-platformkit-homepage/);
});
