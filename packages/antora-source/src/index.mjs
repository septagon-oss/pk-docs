import { promises as fs } from "node:fs";
import path from "node:path";

import YAML from "yaml";

export async function syncWorkspaceAntora({
  docsRoot,
  modulesRoot,
  generatedRoot = path.join(modulesRoot, ".generated", "antora"),
  selectedModules = [],
}) {
  const repoManifest = await readYaml(path.join(modulesRoot, ".platformkit", "docs.manifest.yaml"));
  const selected = new Set(selectedModules.map((value) => value.trim()).filter(Boolean));
  const moduleIds = repoManifest.pilot_modules.filter((moduleId) => selected.size === 0 || selected.has(moduleId));
  const modules = [];

  for (const moduleId of moduleIds) {
    const moduleRoot = path.join(modulesRoot, moduleId);
    const moduleManifestPath = path.join(moduleRoot, repoManifest.module_docs.manifest_path);
    const manifest = await readYaml(moduleManifestPath);
    const topics = await Promise.all(
      manifest.topics.map(async (topic) => {
        const sourcePath = path.join(moduleRoot, topic.path);
        const pagePath = deriveAntoraPagePath(topic.path);
        const topicDoc = await loadMarkdownTopic(sourcePath);
        return {
          ...topic,
          pagePath,
          sourcePath,
          doc: topicDoc,
        };
      }),
    );
    modules.push({
      id: moduleId,
      title: manifest.title,
      root: moduleRoot,
      manifest,
      topics,
    });
  }

  const repoTopics = await Promise.all(
    repoManifest.repo_topics.map(async (topic) => {
      const sourcePath = path.join(modulesRoot, topic.path);
      return {
        ...topic,
        pagePath: deriveAntoraPagePath(topic.path),
        sourcePath,
        doc: await loadMarkdownTopic(sourcePath),
      };
    }),
  );

  await fs.rm(generatedRoot, { recursive: true, force: true });
  await fs.mkdir(generatedRoot, { recursive: true });
  await fs.writeFile(path.join(generatedRoot, "antora.yml"), renderDescriptor(repoManifest, modules));

  await writeRootModule({ generatedRoot, repoManifest, repoTopics, modules });
  for (const module of modules) {
    await writeModule({ generatedRoot, repoManifest, module });
  }

  return {
    generatedRoot,
    moduleCount: modules.length,
    modules: modules.map((module) => module.id),
    repoTopicCount: repoTopics.length,
  };
}

async function writeRootModule({ generatedRoot, repoManifest, repoTopics, modules }) {
  const moduleRoot = path.join(generatedRoot, "modules", "ROOT");
  const pagesRoot = path.join(moduleRoot, "pages");
  await fs.mkdir(pagesRoot, { recursive: true });

  const tutorials = repoTopics.filter((topic) => topic.diataxis === "tutorial");
  await fs.writeFile(path.join(pagesRoot, "index.adoc"), renderRootIndex(repoManifest, tutorials, modules));
  await fs.writeFile(path.join(moduleRoot, "nav.adoc"), renderRootNav(tutorials, modules));

  for (const topic of repoTopics) {
    await writeAsciiDocPage({
      pagesRoot,
      pagePath: topic.pagePath,
      title: topic.title,
      body: markdownToAsciiDoc(topic.doc.body, topic.title),
    });
  }
}

async function writeModule({ generatedRoot, repoManifest, module }) {
  const moduleRoot = path.join(generatedRoot, "modules", module.id);
  const pagesRoot = path.join(moduleRoot, "pages");
  await fs.mkdir(pagesRoot, { recursive: true });

  await fs.writeFile(path.join(pagesRoot, "index.adoc"), renderModuleIndex(module));
  await fs.writeFile(path.join(moduleRoot, "nav.adoc"), renderModuleNav(module));

  for (const topic of module.topics) {
    await writeAsciiDocPage({
      pagesRoot,
      pagePath: topic.pagePath,
      title: topic.title,
      body: markdownToAsciiDoc(topic.doc.body, topic.title),
    });
  }
}

async function writeAsciiDocPage({ pagesRoot, pagePath, title, body }) {
  const targetPath = path.join(pagesRoot, pagePath);
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  const content = [`= ${title}`, "", body.trim(), ""].join("\n");
  await fs.writeFile(targetPath, content);
}

function renderDescriptor(repoManifest, modules) {
  return YAML.stringify({
    name: repoManifest.component_id,
    title: repoManifest.title,
    version: "current",
    nav: ["modules/ROOT/nav.adoc", ...modules.map((module) => `modules/${module.id}/nav.adoc`)],
  });
}

function renderRootIndex(repoManifest, tutorials, modules) {
  const lines = [
    `= ${repoManifest.title}`,
    "",
    "This Antora pilot aggregates feature-local PlatformKit docs using the federated docs contract.",
    "",
    "== Repo tutorials",
    "",
  ];

  if (tutorials.length === 0) {
    lines.push("No tutorials are registered yet.", "");
  } else {
    for (const topic of tutorials) {
      lines.push(`* xref:${topic.pagePath}[${topic.title}]`);
    }
    lines.push("");
  }

  lines.push("== Pilot modules", "");
  for (const module of modules) {
    lines.push(`* xref:${module.id}:index.adoc[${module.title}]`);
  }
  lines.push("");
  return lines.join("\n");
}

function renderRootNav(tutorials, modules) {
  const lines = ["* xref:index.adoc[Business Modules Docs]"];
  if (tutorials.length > 0) {
    for (const topic of tutorials) {
      lines.push(`** xref:${topic.pagePath}[${topic.title}]`);
    }
  }
  for (const module of modules) {
    lines.push(`* xref:${module.id}:index.adoc[${module.title}]`);
  }
  lines.push("");
  return lines.join("\n");
}

function renderModuleIndex(module) {
  const grouped = groupTopicsByDiataxis(module.topics);
  const lines = [
    `= ${module.title}`,
    "",
    `Module docs aggregated from feature-local topics in \`${module.id}\`.`,
    "",
  ];

  for (const [section, topics] of grouped) {
    if (topics.length === 0) {
      continue;
    }
    lines.push(`== ${section}`, "");
    for (const topic of topics) {
      lines.push(`* xref:${topic.pagePath}[${topic.title}]`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

function renderModuleNav(module) {
  const lines = [`* xref:index.adoc[${module.title}]`];
  for (const topic of module.topics) {
    lines.push(`** xref:${topic.pagePath}[${topic.title}]`);
  }
  lines.push("");
  return lines.join("\n");
}

function groupTopicsByDiataxis(topics) {
  const order = [
    ["Explanation", topics.filter((topic) => topic.diataxis === "explanation")],
    ["How-to", topics.filter((topic) => topic.diataxis === "how-to")],
    ["Reference", topics.filter((topic) => topic.diataxis === "reference")],
    ["Tutorial", topics.filter((topic) => topic.diataxis === "tutorial")],
  ];
  return order;
}

async function loadMarkdownTopic(sourcePath) {
  const raw = await fs.readFile(sourcePath, "utf8");
  return parseFrontMatter(raw);
}

function parseFrontMatter(raw) {
  if (!raw.startsWith("---\n")) {
    return { attributes: {}, body: raw.trim() };
  }

  const rest = raw.slice(4);
  const end = rest.indexOf("\n---\n");
  if (end === -1) {
    return { attributes: {}, body: raw.trim() };
  }

  return {
    attributes: YAML.parse(rest.slice(0, end)) ?? {},
    body: rest.slice(end + 5).trim(),
  };
}

function deriveAntoraPagePath(sourcePath) {
  const normalized = sourcePath.split(path.sep).join("/");
  return normalized.replace(/\.(explanation|howto|reference|tutorial)\.md$/u, ".adoc").replace(/\.md$/u, ".adoc");
}

export function markdownToAsciiDoc(markdown, title = "") {
  const sourceLines = markdown.replace(/\r\n/g, "\n").split("\n");
  const lines = [];
  let inFence = false;
  let fenceLanguage = "";
  let titleSkipped = false;

  for (const sourceLine of sourceLines) {
    const line = sourceLine.replace(/\s+$/u, "");

    const fenceMatch = line.match(/^```([A-Za-z0-9_-]+)?\s*$/u);
    if (fenceMatch) {
      if (!inFence) {
        fenceLanguage = fenceMatch[1] ?? "";
        lines.push(fenceLanguage ? `[source,${fenceLanguage}]` : "[source]");
        lines.push("----");
        inFence = true;
      } else {
        lines.push("----");
        inFence = false;
      }
      continue;
    }

    if (inFence) {
      lines.push(line);
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/u);
    if (headingMatch) {
      const headingText = transformInlineMarkdown(headingMatch[2]);
      if (!titleSkipped && headingMatch[1].length === 1 && normalizeLabel(headingText) === normalizeLabel(title)) {
        titleSkipped = true;
        continue;
      }
      const level = Math.max(2, headingMatch[1].length);
      lines.push(`${"=".repeat(level)} ${headingText}`);
      continue;
    }

    lines.push(transformInlineMarkdown(line));
  }

  return lines.join("\n").trim();
}

function transformInlineMarkdown(line) {
  return line
    .replace(/\*\*([^*]+)\*\*/gu, "*$1*")
    .replace(/`([^`]+)`/gu, "+$1+");
}

function normalizeLabel(value) {
  return String(value).trim().toLowerCase();
}

async function readYaml(targetPath) {
  return YAML.parse(await fs.readFile(targetPath, "utf8"));
}
