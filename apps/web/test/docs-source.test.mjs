import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

import { collectDocumentationContent, resolveDocsAsset, resolveDocsAssetWithSize, resolveDocsHref } from "../src/docs-source.mjs";

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

test("resolveDocsAsset maps relative docs/assets references to the served asset route", () => {
  assert.equal(resolveDocsAsset("../assets/screenshots/admin.png", "docs/current/quickstart.md"), "/docs/assets/screenshots/admin.png");
  assert.equal(resolveDocsAsset("../assets/diagrams/map.svg#wide", "docs/current/overview.md"), "/docs/assets/diagrams/map.svg#wide");
  assert.equal(resolveDocsAsset("https://example.test/x.png", "docs/current/quickstart.md"), "https://example.test/x.png");
  assert.equal(resolveDocsAsset("./local.png", "docs/current/quickstart.md"), "./local.png");
});

test("resolveDocsHref maps interactive docs assets to their published route", () => {
  assert.equal(
    resolveDocsHref("../assets/archify/platformkit-oss-architecture.html", "docs/current/overview.md"),
    "/docs/assets/archify/platformkit-oss-architecture.html",
  );
});

test("resolveDocsAssetWithSize reads intrinsic PNG and SVG dimensions from disk", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "pk-docs-assets-"));
  await fs.mkdir(path.join(root, "docs", "assets", "diagrams"), { recursive: true });
  const png = Buffer.alloc(33);
  png.write("\x89PNG\r\n\x1a\n", 0, "binary");
  png.writeUInt32BE(13, 8);
  png.write("IHDR", 12, "ascii");
  png.writeUInt32BE(640, 16);
  png.writeUInt32BE(480, 20);
  await fs.writeFile(path.join(root, "docs", "assets", "shot.png"), png);
  await fs.writeFile(path.join(root, "docs", "assets", "diagrams", "map.svg"), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1100 520"></svg>');

  assert.deepEqual(resolveDocsAssetWithSize("../assets/shot.png", "docs/current/a.md", root), { src: "/docs/assets/shot.png", width: 640, height: 480 });
  assert.deepEqual(resolveDocsAssetWithSize("../assets/diagrams/map.svg", "docs/current/a.md", root), { src: "/docs/assets/diagrams/map.svg", width: 1100, height: 520 });
  assert.equal(resolveDocsAssetWithSize("../assets/missing.png", "docs/current/a.md", root), "/docs/assets/missing.png");
});

test("collectDocumentationContent honours description, group, and order frontmatter and collects headings", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "pk-docs-order-"));
  await fs.mkdir(path.join(root, "docs", "current"), { recursive: true });
  await fs.writeFile(
    path.join(root, "docs", "current", "b.md"),
    "---\ntitle: Second\nslug: second\ncollection: guides\ngroup: Build\norder: 20\ndescription: The second page.\n---\n# Second\n\nBody.\n\n## 1. Step one\n\n### Detail\n",
  );
  await fs.writeFile(
    path.join(root, "docs", "current", "a.md"),
    "---\ntitle: First\nslug: first\ncollection: guides\ngroup: Start here\norder: 10\n---\n# First\n\nIntro paragraph.\n",
  );

  const entries = await collectDocumentationContent({ workspaceRoot: root });

  assert.deepEqual(entries.map((entry) => entry.slug), ["first", "second"]);
  assert.equal(entries[0].excerpt, "Intro paragraph.");
  assert.equal(entries[0].metadata.group, "Start here");
  assert.equal(entries[1].excerpt, "The second page.");
  assert.equal(entries[1].metadata.group, "Build");
  assert.deepEqual(
    entries[1].headings.map((heading) => [heading.level, heading.id, heading.step]),
    [[2, "1-step-one", 1], [3, "detail", null]],
  );
  assert.equal(entries[1].metadata.readingTime, 1);
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
    "docs/current/overview.md",
    "docs/current/quickstart.md",
    "docs/current/extensions.md",
    "docs/current/design-system.md",
    "docs/current/runtime-surfaces.md",
    "docs/current/api-contract.md",
    "docs/current/troubleshooting.md",
    "docs/current/glossary.md",
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

test("published guides read as a learning path and every referenced asset exists", async () => {
  const entries = await collectDocumentationContent({ workspaceRoot: repoRoot });
  const guides = entries.filter((entry) => entry.collection === "guides");

  assert.deepEqual(
    guides.map((entry) => entry.slug),
    [
      "current-overview",
      "current-quickstart",
      "current-extensions",
      "current-design-system",
      "current-api-contract",
      "current-runtime-surfaces",
      "current-troubleshooting",
      "current-glossary",
    ],
  );

  const missing = [];
  for (const entry of entries) {
    for (const match of entry.contentHtml.matchAll(/<img src="\/docs\/assets\/([^"#]+)/g)) {
      const file = path.join(repoRoot, "docs", "assets", ...match[1].split("/"));
      try {
        await fs.access(file);
      } catch {
        missing.push(`${entry.sourcePath}: ${match[1]}`);
      }
    }
    for (const match of entry.contentHtml.matchAll(/<img [^>]*alt="([^"]*)"/g)) {
      assert.ok(match[1].trim().length > 0, `${entry.sourcePath} has an image without alt text`);
    }
  }
  assert.deepEqual(missing, []);
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
