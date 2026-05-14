import { promises as fs } from "node:fs";
import path from "node:path";

export async function loadModuleShowcases({ bundle, generatedRoot }) {
  const moduleId = bundle.spec.module.id;
  const artifactRoot = path.join(generatedRoot, "showcases", moduleId);
  const externalArtifacts = await loadArtifactShowcases(artifactRoot);

  if (externalArtifacts.length > 0) {
    return externalArtifacts;
  }

  return (bundle.spec.showcases ?? []).map((showcase) => ({
    source: "bundle",
    id: showcase.id,
    title: showcase.title,
    summary: showcase.summary,
    basePath: showcase.basePath ?? "",
    routes: showcase.routes ?? [],
    flows: showcase.flows ?? [],
    requiredFields: showcase.requiredFields ?? [],
    tableColumns: showcase.tableColumns ?? [],
    pages: showcase.pages ?? [],
    formFields: showcase.formFields ?? [],
    actions: showcase.actions ?? [],
    tabs: showcase.tabs ?? [],
    filters: showcase.filters ?? [],
  }));
}

async function loadArtifactShowcases(rootDir) {
  try {
    const files = await fs.readdir(rootDir, { withFileTypes: true });
    const showcases = [];
    for (const file of files) {
      if (!file.isFile() || !file.name.endsWith(".json")) {
        continue;
      }
      const payload = JSON.parse(await fs.readFile(path.join(rootDir, file.name), "utf8"));
      showcases.push({
        source: "artifact",
        ...payload,
      });
    }
    return showcases;
  } catch {
    return [];
  }
}
