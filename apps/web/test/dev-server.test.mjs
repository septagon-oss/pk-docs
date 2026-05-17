import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import { startDevServer } from "../src/dev-server.mjs";

test("startDevServer resolves extensionless directory routes", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "pk-docs-server-"));
  await fs.mkdir(path.join(root, "docs"), { recursive: true });
  await fs.writeFile(path.join(root, "docs", "index.html"), "<h1>Docs</h1>");

  const server = await startDevServer({ rootDir: root, port: 0 });
  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/docs`);
    assert.equal(response.status, 200);
    assert.equal(await response.text(), "<h1>Docs</h1>");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
