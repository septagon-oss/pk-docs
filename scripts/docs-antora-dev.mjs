import { startDevServer } from "../apps/web/src/dev-server.mjs";
import { resolveWorkspaceRoot } from "./workspace-paths.mjs";
import "./docs-antora-build.mjs";

const workspaceRoot = resolveWorkspaceRoot(import.meta.url);
const port = Number.parseInt(process.env.PORT ?? "4180", 10);
const host = process.env.HOST ?? "127.0.0.1";

await startDevServer({
  rootDir: `${workspaceRoot}/apps/antora/dist`,
  port,
  host,
});

console.log(`Antora preview available at http://${host}:${port}`);
