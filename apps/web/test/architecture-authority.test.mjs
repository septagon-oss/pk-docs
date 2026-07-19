import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

test("every accepted ADR is registered for federated navigation", async () => {
  const adrDir = path.join(root, "adr");
  const accepted = [];
  for (const name of await fs.readdir(adrDir)) {
    if (!/^\d{4}-.+\.md$/.test(name) || name === "0000-template.md") continue;
    const source = await fs.readFile(path.join(adrDir, name), "utf8");
    if (/^status:\s*Accepted\s*$/m.test(frontmatter(source))) {
      accepted.push(`adr/${name}`);
    }
  }

  const manifest = await fs.readFile(path.join(root, ".platformkit", "docs.manifest.yaml"), "utf8");
  const registered = [...manifest.matchAll(/^\s+path:\s+(adr\/[^\s]+\.md)\s*$/gm)].map(
    (match) => match[1],
  );

  assert.equal(new Set(registered).size, registered.length, "ADR manifest paths must be unique");
  assert.deepEqual(
    accepted.sort(),
    registered.filter((entry) => accepted.includes(entry)).sort(),
    "every accepted ADR must be present in .platformkit/docs.manifest.yaml",
  );

  for (const relative of registered) {
    await fs.access(path.join(root, relative));
  }
});

test("catalog and traceability authority links resolve", async () => {
  const roots = [
    "adr/0015-module-tiering.md",
    "adr/0016-module-sets-and-preset-composition.md",
    "adr/0029-every-file-declares-its-purpose.md",
    "adr/0048-go-authored-catalog-and-generated-exports.md",
    "adr/0064-file-purpose-traceability-is-a-blocking-workspace-invariant.md",
    "adr/0070-interactive-browser-authentication-uses-durable-one-time-bound-proofs.md",
    "adr/0071-email-verification-uses-hash-only-proofs-and-owner-guarded-activation.md",
    "adr/0072-one-time-public-authentication-bearers-use-hash-only-scoped-ledgers.md",
    "architecture/README.md",
    "architecture/08-cross-cutting-concepts.md",
    "architecture/09-architecture-decisions.md",
    "architecture/12-glossary.md",
    "requirements/REQ-002-independently-deployable-modules.md",
    "requirements/REQ-AUTH-021-email-verification.md",
    "requirements/REQ-AUTH-022-password-reset.md",
    "requirements/REQ-AUTH-024-resend-verification.md",
  ];
  const broken = [];

  for (const relative of roots) {
    const file = path.join(root, relative);
    const source = await fs.readFile(file, "utf8");
    for (const match of source.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
      const href = match[1].trim().replace(/^<|>$/g, "");
      if (href === "" || href.startsWith("#") || /^[a-z][a-z0-9+.-]*:/i.test(href)) continue;
      const target = href.split("#", 1)[0];
      try {
        await fs.access(path.resolve(path.dirname(file), target));
      } catch {
        broken.push(`${relative} -> ${href}`);
      }
    }
  }

  assert.deepEqual(broken, []);
});

function frontmatter(source) {
  return source.match(/^---\n([\s\S]*?)\n---\n/)?.[1] ?? "";
}
