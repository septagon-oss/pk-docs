import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");

const ignoredDirectories = new Set([
  ".cache",
  ".generated",
  ".git",
  ".tmp-npm-cache",
  "node_modules",
  "dist",
]);

const ignoredFiles = new Set([
  "package-lock.json",
  "LICENSE",
]);

const scannedExtensions = new Set([
  ".css",
  ".cue",
  ".html",
  ".js",
  ".json",
  ".md",
  ".mjs",
  ".yaml",
  ".yml",
]);

const bannedTerms = [
  ["leg", "acy", "i"],
  ["TO", "DO", ""],
  ["FIX", "ME", ""],
  ["HA", "CK", ""],
  ["back", "ward", "i"],
  ["back", "wards", "i"],
];

const bannedPatterns = bannedTerms.map(([left, right, flags]) => {
  const term = `${left}${right}`;
  return new RegExp(`\\b${term}\\b`, flags);
});

test("public documentation sources avoid migration-era placeholders", async () => {
  const findings = [];
  for await (const file of walk(repoRoot)) {
    const body = await readFile(file, "utf8");
    const lines = body.split(/\r?\n/);
    lines.forEach((line, index) => {
      for (const pattern of bannedPatterns) {
        if (pattern.test(line)) {
          findings.push(`${path.relative(repoRoot, file)}:${index + 1}: ${line.trim()}`);
          break;
        }
      }
    });
  }

  assert.deepEqual(findings, []);
});

async function* walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (ignoredDirectories.has(entry.name)) {
      continue;
    }

    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      yield* walk(absolute);
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }
    if (ignoredFiles.has(entry.name)) {
      continue;
    }
    if (!scannedExtensions.has(path.extname(entry.name))) {
      continue;
    }

    const info = await stat(absolute);
    if (info.size > 1_000_000) {
      continue;
    }
    yield absolute;
  }
}
