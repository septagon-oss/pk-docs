import path from "node:path";

import { syncWorkspaceAntora } from "../packages/antora-source/src/index.mjs";
import { resolveSiblingRepo, resolveWorkspaceRoot } from "./workspace-paths.mjs";

const workspaceRoot = resolveWorkspaceRoot(import.meta.url);
const modulesRoot = resolveSiblingRepo(workspaceRoot, "pk-modules");
const selectedModules = process.env.MODULE ? process.env.MODULE.split(",").map((value) => value.trim()).filter(Boolean) : [];

const result = await syncWorkspaceAntora({
  docsRoot: workspaceRoot,
  modulesRoot,
  selectedModules,
});

console.log(
  `Prepared Antora content for ${result.moduleCount} module${result.moduleCount === 1 ? "" : "s"} in ${path.relative(
    workspaceRoot,
    result.generatedRoot,
  )}.`,
);
