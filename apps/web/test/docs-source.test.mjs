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

test("only current OSS guides are published as setup and capability truth", async () => {
  const entries = await collectDocumentationContent({ workspaceRoot: repoRoot });
  const sources = entries.map((entry) => entry.sourcePath);

  for (const current of [
    "docs/current/quickstart.md",
    "docs/current/extensions.md",
    "docs/current/runtime-surfaces.md",
    "docs/current/api-contract.md",
  ]) {
    assert.ok(sources.includes(current), `missing current guide: ${current}`);
  }
  assert.equal(
    sources.some((source) => source.startsWith("docs/v0.2.0/")),
    false,
    "historical versioned docs must not be published as current",
  );
  assert.equal(
    sources.some((source) => source.startsWith("architecture/")),
    false,
    "the historical downstream architecture must not be published as OSS truth",
  );

  const retiredClaims = [
    "tenant_acme",
    "admin@local.test",
    "changeme",
    "47 business modules",
    "All 49 production-grade modules",
  ];
  const body = entries.map((entry) => `${entry.sourcePath}\n${entry.content}`).join("\n");
  for (const claim of retiredClaims) {
    assert.equal(body.includes(claim), false, `published docs contain retired claim: ${claim}`);
  }
});

test("historical v0.2 pages are explicitly archived and bannered", async () => {
  const historicalRoot = path.join(repoRoot, "docs", "v0.2.0");
  const pending = [historicalRoot];
  const markdown = [];
  while (pending.length > 0) {
    const directory = pending.pop();
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) pending.push(target);
      if (entry.isFile() && entry.name.endsWith(".md")) markdown.push(target);
    }
  }

  for (const file of markdown) {
    const source = await fs.readFile(file, "utf8");
    assert.match(source, /^status:\s*archived\s*$/m, `${file} must be archived`);
    assert.match(source, /Historical v0\.2\.0 documentation/, `${file} needs a historical banner`);
  }
});

test("federated navigation points to current guides, not archived architecture", async () => {
  const manifest = await fs.readFile(
    path.join(repoRoot, ".platformkit", "docs.manifest.yaml"),
    "utf8",
  );
  assert.match(manifest, /path:\s+docs\/current\/quickstart\.md/);
  assert.match(manifest, /path:\s+docs\/current\/extensions\.md/);
  assert.doesNotMatch(manifest, /path:\s+architecture\/(?:index|\d{2}-)[^\s]*\.md/);
});
