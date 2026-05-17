import path from "node:path";

import { buildSite } from "../apps/web/src/build-site.mjs";
import { syncWorkspaceModules } from "../packages/module-source/src/index.mjs";
import { resolveSiblingRepo, resolveWorkspaceRoot } from "./workspace-paths.mjs";

const workspaceRoot = resolveWorkspaceRoot(import.meta.url);
const modulesRoot = resolveSiblingRepo(workspaceRoot, "pk-modules");
const selectedModules = process.env.MODULE ? process.env.MODULE.split(",").map((value) => value.trim()).filter(Boolean) : [];

await syncWorkspaceModules({
  docsRoot: workspaceRoot,
  modulesRoot,
  selectedModules,
});

const result = await buildSite({ workspaceRoot });

console.log(
  `Built ${result.moduleCount} module page${result.moduleCount === 1 ? "" : "s"} and ${
    result.documentCount
  } documentation page${result.documentCount === 1 ? "" : "s"} into ${path.relative(
    workspaceRoot,
    result.distRoot,
  )}.`,
);
