import path from "node:path";

import { buildSite } from "../apps/web/src/build-site.mjs";
import { startDevServer } from "../apps/web/src/dev-server.mjs";
import { syncWorkspaceModules } from "../packages/module-source/src/index.mjs";
import { resolveSiblingRepo, resolveWorkspaceRoot } from "./workspace-paths.mjs";

const workspaceRoot = resolveWorkspaceRoot(import.meta.url);
const modulesRoot = resolveSiblingRepo(workspaceRoot, "pk-modules");
const selectedModules = process.env.MODULE ? process.env.MODULE.split(",").map((value) => value.trim()).filter(Boolean) : [];
const host = process.env.HOST ?? "127.0.0.1";

await syncWorkspaceModules({
  docsRoot: workspaceRoot,
  modulesRoot,
  selectedModules,
});

const result = await buildSite({ workspaceRoot });
const port = Number.parseInt(process.env.PORT ?? "4173", 10);

try {
  await startDevServer({
    rootDir: result.distRoot,
    port,
    host,
  });
  console.log(`Preview available at http://${host}:${port}`);
} catch (error) {
  const reason = error instanceof Error ? error.message : String(error);
  console.error(`Unable to start preview server on ${host}:${port}: ${reason}`);
  process.exitCode = 1;
}
