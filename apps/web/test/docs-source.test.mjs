import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

import { collectDocumentationContent, resolveDocsHref } from "../src/docs-source.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");

test("collectDocumentationContent indexes docs as hosted content and skips templates", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "pk-docs-source-"));
  await fs.mkdir(path.join(root, "docs"), { recursive: true });
  await fs.mkdir(path.join(root, "architecture"), { recursive: true });
  await fs.mkdir(path.join(root, "requirements"), { recursive: true });
  await fs.writeFile(
    path.join(root, "docs", "ARCHITECTURE.md"),
    "---\ntitle: Architecture\nslug: architecture\n---\n# Architecture\n\nPublic architecture.",
  );
  await fs.writeFile(
    path.join(root, "architecture", "01-introduction-and-goals.md"),
    "---\ntitle: \"01 Introduction and Goals\"\nslug: architecture-01-introduction-and-goals\ncollection: architecture\narc42_section: 1\n---\n# Intro\n\nSource-only architecture.",
  );
  await fs.writeFile(
    path.join(root, "architecture", "02-public-section.md"),
    "---\ntitle: Published Architecture\nslug: published-architecture\nstatus: published\n---\n# Published\n\nOpted-in architecture.",
  );
  await fs.writeFile(
    path.join(root, "requirements", "0001-capability-template.md"),
    "---\ntitle: \"Template\"\n---\n# Template",
  );

  const entries = await collectDocumentationContent({ workspaceRoot: root });

  assert.deepEqual(
    entries.map((entry) => entry.slug),
    ["published-architecture", "architecture"],
  );
  assert.equal(entries[0].type, "content_page");
  assert.equal(entries[0].contentType, "documentation");
  assert.equal(entries[1].route, "/docs/architecture");
  assert.match(entries[1].contentHtml, /Public architecture/);
});

test("resolveDocsHref maps relative markdown docs to preview routes", () => {
  assert.equal(
    resolveDocsHref("RELEASING.md", "docs/ARCHITECTURE.md"),
    "/docs/releasing",
  );
});

test("published documentation does not expose private workspace paths", async () => {
  const entries = await collectDocumentationContent({ workspaceRoot: repoRoot });
  const banned = [
    "septagon-dev",
    "platformkit-backend-kit",
    "platformkit-business-modules",
    "platformkit-frontend-kit",
    "private repo",
  ];
  const findings = [];
  for (const entry of entries) {
    const body = `${entry.title}\n${entry.sourcePath}\n${entry.content}`;
    for (const term of banned) {
      if (body.includes(term)) {
        findings.push(`${entry.sourcePath}: ${term}`);
      }
    }
  }
  assert.deepEqual(findings, []);
});
