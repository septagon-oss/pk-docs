import { promises as fs } from "node:fs";
import path from "node:path";

import { assertModuleBundle, compareBundlesByTitle } from "../../contracts/src/index.mjs";

export async function discoverModuleSources({ modulesRoot, selectedModules = [] }) {
  const allowed = new Set(selectedModules.map((value) => value.trim()).filter(Boolean));
  const entries = await fs.readdir(modulesRoot, { withFileTypes: true });
  const discovered = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) {
      continue;
    }
    if (allowed.size > 0 && !allowed.has(entry.name)) {
      continue;
    }

    const docsRoot = path.join(modulesRoot, entry.name, "docs");
    const bundlePath = path.join(docsRoot, "bundle.json");
    if (!(await fileExists(bundlePath))) {
      continue;
    }

    const rawBundle = await fs.readFile(bundlePath, "utf8");
    const bundle = assertModuleBundle(JSON.parse(rawBundle), bundlePath);
    const apiPath = bundle.spec.api?.artifactPath
      ? path.join(docsRoot, filepathFromBundle(bundle.spec.api.artifactPath))
      : null;
    const overlayPath = path.join(docsRoot, "openapi.overlay.yaml");

    discovered.push({
      moduleId: bundle.spec.module.id,
      moduleRoot: path.join(modulesRoot, entry.name),
      docsRoot,
      bundlePath,
      bundle,
      apiPath: apiPath && (await fileExists(apiPath)) ? apiPath : null,
      overlayPath: (await fileExists(overlayPath)) ? overlayPath : null,
    });
  }

  return discovered.sort((left, right) => compareBundlesByTitle(left.bundle, right.bundle));
}

export async function syncWorkspaceModules({
  docsRoot,
  generatedRoot = path.join(docsRoot, ".generated"),
  modulesRoot = path.resolve(docsRoot, "..", "pk-modules"),
  selectedModules = [],
}) {
  const sources = await discoverModuleSources({ modulesRoot, selectedModules });
  const modulesOutDir = path.join(generatedRoot, "modules");

  await fs.rm(modulesOutDir, { recursive: true, force: true });
  await fs.mkdir(modulesOutDir, { recursive: true });

  for (const source of sources) {
    const targetRoot = path.join(modulesOutDir, source.moduleId);
    await fs.mkdir(targetRoot, { recursive: true });
    await fs.copyFile(source.bundlePath, path.join(targetRoot, "bundle.json"));

    if (source.apiPath) {
      const apiTarget = path.join(targetRoot, "api");
      await fs.mkdir(apiTarget, { recursive: true });
      await fs.copyFile(source.apiPath, path.join(apiTarget, "openapi.json"));
    }

    if (source.overlayPath) {
      await fs.copyFile(source.overlayPath, path.join(targetRoot, "openapi.overlay.yaml"));
    }
  }

  await fs.writeFile(
    path.join(modulesOutDir, "index.json"),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        moduleCount: sources.length,
        modules: sources.map((source) => ({
          id: source.bundle.spec.module.id,
          title: source.bundle.spec.module.title,
          category: source.bundle.spec.module.category,
          hasAPI: Boolean(source.bundle.spec.api),
          hasShowcases: Array.isArray(source.bundle.spec.showcases) && source.bundle.spec.showcases.length > 0,
        })),
      },
      null,
      2,
    ) + "\n",
  );

  return {
    generatedRoot,
    modules: sources.map((source) => source.bundle.spec.module.id),
  };
}

export async function loadGeneratedBundles({ generatedRoot }) {
  const modulesOutDir = path.join(generatedRoot, "modules");
  const entries = await fs.readdir(modulesOutDir, { withFileTypes: true });
  const bundles = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const bundlePath = path.join(modulesOutDir, entry.name, "bundle.json");
    if (!(await fileExists(bundlePath))) {
      continue;
    }
    const bundle = assertModuleBundle(JSON.parse(await fs.readFile(bundlePath, "utf8")), bundlePath);
    bundles.push(bundle);
  }

  return bundles.sort(compareBundlesByTitle);
}

function filepathFromBundle(value) {
  return value.split("/").join(path.sep);
}

async function fileExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}
