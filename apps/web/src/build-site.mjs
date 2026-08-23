import { promises as fs } from "node:fs";
import path from "node:path";

import { composeSiteModel } from "../../../packages/composer/src/index.mjs";
import { loadGeneratedBundles } from "../../../packages/module-source/src/index.mjs";
import { DOCS_ASSET_SOURCE, collectDocumentationContent } from "./docs-source.mjs";
import {
  renderContentIndexPage,
  renderContentPage,
  renderFavicon,
  renderHomePage,
  renderModulePage,
  renderScript,
  renderStyles,
} from "./site-template.mjs";

export async function buildSite({
  workspaceRoot,
  basePath = process.env.BASE_PATH ?? "",
  publishOverlay = process.env.PUBLISH_OVERLAY === "1",
}) {
  const prefix = basePath.replace(/\/+$/, "");
  // Templates emit root-absolute URLs for domain-root hosting; rewrite them at
  // the output boundary when the site is served from a subpath (GitHub Pages).
  const withBase = (html) => (prefix ? html.replace(/\b(href|src)="\/(?!\/)/g, `$1="${prefix}/`) : html);
  const generatedRoot = path.join(workspaceRoot, ".generated");
  const distRoot = path.join(workspaceRoot, "apps", "web", "dist");
  // The marketing overlay targets a hosted product domain that is not live
  // yet; the published docs site stays overlay-free until opted in.
  const overlay = publishOverlay ? await loadPlatformKitOverlay({ workspaceRoot }) : null;
  const bundles = await loadGeneratedBundles({ generatedRoot });
  const site = await composeSiteModel({ bundles, generatedRoot });
  const contentEntries = await collectDocumentationContent({ workspaceRoot });

  await fs.rm(distRoot, { recursive: true, force: true });
  await fs.mkdir(path.join(distRoot, "assets"), { recursive: true });
  await fs.writeFile(path.join(distRoot, "assets", "site.css"), renderStyles());
  await fs.writeFile(path.join(distRoot, "assets", "site.js"), renderScript());
  await fs.writeFile(path.join(distRoot, "assets", "favicon.svg"), renderFavicon());
  await copyDocsAssets({ workspaceRoot, distRoot });
  if (overlay) {
    await copyPlatformKitOverlayAssets({ distRoot, overlay });
  }
  await fs.writeFile(path.join(distRoot, "index.html"), withBase(renderHomePage(site, overlay, contentEntries)));
  await fs.writeFile(path.join(distRoot, "site-model.json"), JSON.stringify(site, null, 2) + "\n");
  await fs.mkdir(path.join(distRoot, "docs"), { recursive: true });
  await fs.writeFile(path.join(distRoot, "docs", "index.html"), withBase(renderContentIndexPage(contentEntries, { overlay })));
  await fs.writeFile(
    path.join(distRoot, "docs", "content-index.json"),
    JSON.stringify(contentEntries.map(contentIndexRecord), null, 2) + "\n",
  );

  for (const entry of contentEntries) {
    const documentRoot = path.join(distRoot, "docs", entry.slug);
    await fs.mkdir(documentRoot, { recursive: true });
    await fs.writeFile(path.join(documentRoot, "index.html"), withBase(renderContentPage(entry, contentEntries, { overlay })));
    await fs.writeFile(path.join(documentRoot, "page-model.json"), JSON.stringify(entry, null, 2) + "\n");
  }

  for (const module of site.modules) {
    const moduleRoot = path.join(distRoot, "modules", module.id);
    await fs.mkdir(moduleRoot, { recursive: true });
    await fs.writeFile(path.join(moduleRoot, "index.html"), withBase(renderModulePage(module, { overlay })));
    await fs.writeFile(path.join(moduleRoot, "page-model.json"), JSON.stringify(module, null, 2) + "\n");
    if (module.api.document) {
      await fs.mkdir(path.join(moduleRoot, "api"), { recursive: true });
      await fs.writeFile(path.join(moduleRoot, "api", "openapi.json"), JSON.stringify(module.api.document, null, 2) + "\n");
    }
  }

  return {
    distRoot,
    moduleCount: site.modules.length,
    documentCount: contentEntries.length,
  };
}

// Images and diagrams referenced from markdown live in docs/assets and are
// served from /docs/assets so the same relative links work on GitHub and here.
async function copyDocsAssets({ workspaceRoot, distRoot }) {
  const source = path.join(workspaceRoot, ...DOCS_ASSET_SOURCE.split("/"));
  try {
    await fs.access(source);
  } catch {
    return;
  }
  await fs.cp(source, path.join(distRoot, "docs", "assets"), { recursive: true, force: true });
}

function contentIndexRecord(entry) {
  const { content, contentHtml, ...indexRecord } = entry;
  return indexRecord;
}

async function loadPlatformKitOverlay({ workspaceRoot }) {
  const overlayRoot = path.join(workspaceRoot, "overlays", "platformkit");
  const siteRoot = path.join(overlayRoot, "site");
  const manifestPath = path.join(siteRoot, "homepage.en.json");

  try {
    const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
    return {
      clientSlug: "platformkit",
      overlayRoot,
      siteRoot,
      manifest,
    };
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

async function copyPlatformKitOverlayAssets({ distRoot, overlay }) {
  const overlayAssetRoot = path.join(distRoot, "assets", "overlays", overlay.clientSlug);
  const imageAssetRoot = path.join(distRoot, "images", "overlays", overlay.clientSlug);
  await fs.mkdir(overlayAssetRoot, { recursive: true });

  const experience = overlay.manifest.experience ?? {};
  for (const file of [...(experience.styles ?? []), ...(experience.scripts ?? [])]) {
    const name = String(file ?? "").trim();
    if (!name || name.includes("..") || path.isAbsolute(name)) {
      continue;
    }
    await fs.copyFile(path.join(overlay.siteRoot, name), path.join(overlayAssetRoot, name));
  }

  await fs.cp(path.join(overlay.overlayRoot, "assets"), imageAssetRoot, {
    recursive: true,
    force: true,
  });
}
