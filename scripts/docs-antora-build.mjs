import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";

import { syncWorkspaceAntora } from "../packages/antora-source/src/index.mjs";
import { resolveSiblingRepo, resolveWorkspaceRoot } from "./workspace-paths.mjs";

const workspaceRoot = resolveWorkspaceRoot(import.meta.url);
const modulesRoot = resolveSiblingRepo(workspaceRoot, "pk-modules");
const selectedModules = process.env.MODULE ? process.env.MODULE.split(",").map((value) => value.trim()).filter(Boolean) : [];

const syncResult = await syncWorkspaceAntora({
  docsRoot: workspaceRoot,
  modulesRoot,
  selectedModules,
});

await runAntora(workspaceRoot);

console.log(
  `Built Antora pilot for ${syncResult.moduleCount} module${syncResult.moduleCount === 1 ? "" : "s"} into apps/antora/dist.`,
);

async function runAntora(cwd) {
  const antoraCacheDir = path.join(cwd, ".cache", "antora");
  await fs.mkdir(antoraCacheDir, { recursive: true });

  await new Promise((resolve, reject) => {
    const child = spawn("npx", ["--no-install", "antora", "antora-playbook.yml"], {
      cwd,
      stdio: "inherit",
      env: {
        ...process.env,
        ANTORA_CACHE_DIR: antoraCacheDir,
      },
    });

    child.on("error", (error) => {
      reject(new Error(`unable to start Antora: ${error.message}`));
    });
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new Error(
          "Antora build failed. Install locked dependencies with `npm ci` in pk-docs before rerunning.",
        ),
      );
    });
  });
}
