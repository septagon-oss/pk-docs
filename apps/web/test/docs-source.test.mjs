import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import { collectDocumentationContent, resolveDocsHref } from "../src/docs-source.mjs";

test("collectDocumentationContent indexes docs as hosted content and skips templates", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "pk-docs-source-"));
  await fs.mkdir(path.join(root, "architecture"), { recursive: true });
  await fs.mkdir(path.join(root, "requirements"), { recursive: true });
  await fs.writeFile(
    path.join(root, "architecture", "01-introduction-and-goals.md"),
    "---\ntitle: \"01 Introduction and Goals\"\nslug: architecture-01-introduction-and-goals\ncollection: architecture\narc42_section: 1\n---\n# Intro\n\nPublic architecture.",
  );
  await fs.writeFile(
    path.join(root, "requirements", "0001-capability-template.md"),
    "---\ntitle: \"Template\"\n---\n# Template",
  );

  const entries = await collectDocumentationContent({ workspaceRoot: root });

  assert.deepEqual(
    entries.map((entry) => entry.slug),
    ["architecture-01-introduction-and-goals"],
  );
  assert.equal(entries[0].type, "content_page");
  assert.equal(entries[0].contentType, "documentation");
  assert.equal(entries[0].route, "/docs/architecture-01-introduction-and-goals");
  assert.match(entries[0].contentHtml, /Public architecture/);
});

test("resolveDocsHref maps relative markdown docs to preview routes", () => {
  assert.equal(
    resolveDocsHref("../adr/0009-ports-only-cross-module-communication.md", "architecture/04-solution-strategy.md"),
    "/docs/adr-0009-ports-only-cross-module-communication",
  );
});
