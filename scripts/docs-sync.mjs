import path from "node:path";

import { syncWorkspaceModules } from "../packages/module-source/src/index.mjs";
import { resolveSiblingRepo, resolveWorkspaceRoot } from "./workspace-paths.mjs";

const workspaceRoot = resolveWorkspaceRoot(import.meta.url);
const modulesRoot = resolveSiblingRepo(workspaceRoot, "pk-modules");
const selectedModules = process.env.MODULE ? process.env.MODULE.split(",").map((value) => value.trim()).filter(Boolean) : [];

const result = await syncWorkspaceModules({
  docsRoot: workspaceRoot,
  modulesRoot,
  selectedModules,
});

console.log(
  `Synced ${result.modules.length} module bundle${result.modules.length === 1 ? "" : "s"} into ${path.relative(
    workspaceRoot,
    result.generatedRoot,
  )}.`,
);
