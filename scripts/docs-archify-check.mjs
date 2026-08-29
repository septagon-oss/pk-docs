import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const receiptPath = path.join(
  workspaceRoot,
  "docs/assets/archify/platformkit-oss-architecture.receipt.json",
);
const receipt = JSON.parse(await fs.readFile(receiptPath, "utf8"));
const mismatches = [];

for (const entry of [receipt.specification, receipt.artifact]) {
  const absolutePath = path.join(workspaceRoot, entry.path);
  let contents;
  try {
    contents = await fs.readFile(absolutePath);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    mismatches.push(`${entry.path} is missing`);
    continue;
  }

  const digest = createHash("sha256").update(contents).digest("hex");
  if (contents.byteLength !== entry.bytes || digest !== entry.sha256) {
    mismatches.push(`${entry.path} does not match its Archify delivery receipt`);
  }
}

if (mismatches.length > 0) {
  console.error(mismatches.join("\n"));
  process.exitCode = 1;
} else {
  console.log("Verified the delivered Archify specification and HTML artifact.");
}
