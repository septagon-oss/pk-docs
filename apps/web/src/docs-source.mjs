import { promises as fs, readFileSync } from "node:fs";
import path from "node:path";

import { renderMarkdown } from "./markdown.mjs";

export const DOCS_ASSET_SOURCE = "docs/assets";
export const DOCS_ASSET_ROUTE = "/docs/assets";

const DOC_SECTIONS = ["docs", "architecture", "adr", "requirements"];
const DEFAULT_PUBLIC_SECTION = "docs";
const DOC_SOURCE_ORDER = new Map([
  ["docs/ARCHITECTURE.md", 10],
  ["docs/PLATFORMKIT_FORMULA.md", 20],
  ["docs/IMPLEMENTATION_PLAN.md", 30],
  ["docs/RELEASING.md", 40],
  ["docs/RELEASE_NOTES_V0_0_0.md", 50],
  ["docs/V0_0_0_RELEASE_AUDIT.md", 60],
  ["docs/FIRST_SLICE.md", 70],
]);

export async function collectDocumentationContent({ workspaceRoot, locale = "en" }) {
  const files = [];
  for (const section of DOC_SECTIONS) {
    const sectionRoot = path.join(workspaceRoot, section);
    if (!(await exists(sectionRoot))) {
      continue;
    }
    for (const file of await walkMarkdown(sectionRoot)) {
      const relPath = path.relative(workspaceRoot, file).split(path.sep).join("/");
      if (skipDocument(relPath)) {
        continue;
      }
      const parsed = parseMarkdownDocument(await fs.readFile(file, "utf8"));
      if (!publishDocument(relPath, parsed.frontmatter)) {
        continue;
      }
      files.push({ file, parsed });
    }
  }
  files.sort((left, right) => left.file.localeCompare(right.file));

  const entries = [];
  for (const { file, parsed } of files) {
    const sourcePath = path.relative(workspaceRoot, file).split(path.sep).join("/");
    const collection = parsed.frontmatter.collection || collectionFromPath(sourcePath);
    const slug = parsed.frontmatter.slug || deriveSlug(sourcePath);
    const title = parsed.frontmatter.title || titleFromSlug(slug);
    const excerpt = String(parsed.frontmatter.description || "").trim() || excerptFromMarkdown(parsed.body, title);
    const headings = [];
    const contentHtml = renderMarkdown(parsed.body, {
      resolveHref: (href) => resolveDocsHref(href, sourcePath),
      resolveAsset: (src) => resolveDocsAssetWithSize(src, sourcePath, workspaceRoot),
      collectHeadings: headings,
    });
    const adrNumber = numberOrNull(parsed.frontmatter.adr_number ?? deriveADRNumber(sourcePath));
    const arc42Section = numberOrNull(parsed.frontmatter.arc42_section ?? deriveArc42Section(sourcePath));
    entries.push({
      id: `pk-docs:${locale}:${slug}`,
      type: "content_page",
      contentType: "documentation",
      title,
      slug,
      route: `/docs/${slug}`,
      locale,
      sourcePath,
      collection,
      content: parsed.body,
      contentHtml,
      excerpt,
      headings: headings.filter((heading) => heading.level >= 2 && heading.level <= 3),
      status: "published",
      metadata: {
        docsSource: "pk-docs",
        sourcePath,
        collection,
        arc42Section,
        adrNumber,
        group: String(parsed.frontmatter.group || "").trim() || null,
        readingTime: readingTimeMinutes(parsed.body),
      },
      order: sortOrder({
        collection,
        sourcePath,
        adrNumber,
        arc42Section,
        explicitOrder: numberOrNull(parsed.frontmatter.order),
      }),
    });
  }

  return entries.sort((left, right) => left.order - right.order || left.title.localeCompare(right.title));
}

export const collectDocumentation = collectDocumentationContent;

export function resolveDocsHref(href, fromSourcePath) {
  const raw = String(href ?? "").trim();
  if (raw === "" || raw.startsWith("#") || /^[a-z][a-z0-9+.-]*:/i.test(raw)) {
    return raw;
  }
  const [target, fragment = ""] = raw.split("#", 2);
  if (!target.endsWith(".md")) {
    return resolveDocsAsset(raw, fromSourcePath);
  }
  const normalized = path.posix.normalize(path.posix.join(path.posix.dirname(fromSourcePath), target));
  if (!DOC_SECTIONS.some((section) => normalized.startsWith(`${section}/`))) {
    return raw;
  }
  const suffix = fragment ? `#${fragment}` : "";
  return `/docs/${deriveSlug(normalized)}${suffix}`;
}

export function resolveDocsAsset(src, fromSourcePath) {
  const raw = String(src ?? "").trim();
  if (raw === "" || raw.startsWith("/") || raw.startsWith("#") || /^[a-z][a-z0-9+.-]*:/i.test(raw)) {
    return raw;
  }
  const [target, fragment = ""] = raw.split("#", 2);
  const normalized = path.posix.normalize(path.posix.join(path.posix.dirname(fromSourcePath), target));
  if (!normalized.startsWith(`${DOCS_ASSET_SOURCE}/`)) {
    return raw;
  }
  const suffix = fragment ? `#${fragment}` : "";
  return `${DOCS_ASSET_ROUTE}/${normalized.slice(DOCS_ASSET_SOURCE.length + 1)}${suffix}`;
}

// Figures get intrinsic width/height so the page does not jump while images
// load. Dimensions are read from the PNG header or the SVG viewBox at build
// time; anything unreadable falls back to the bare URL.
export function resolveDocsAssetWithSize(src, fromSourcePath, workspaceRoot) {
  const resolved = resolveDocsAsset(src, fromSourcePath);
  if (!resolved.startsWith(`${DOCS_ASSET_ROUTE}/`) || !workspaceRoot) {
    return resolved;
  }
  const relative = resolved.slice(DOCS_ASSET_ROUTE.length + 1).replace(/#.*$/, "");
  const file = path.join(workspaceRoot, ...DOCS_ASSET_SOURCE.split("/"), ...relative.split("/"));
  const size = imageSize(file);
  return size ? { src: resolved, ...size } : resolved;
}

function imageSize(file) {
  try {
    const buffer = readFileSync(file);
    if (buffer.length > 24 && buffer.toString("ascii", 1, 4) === "PNG") {
      return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
    }
    if (file.endsWith(".svg")) {
      const head = buffer.toString("utf8", 0, Math.min(buffer.length, 2048));
      const viewBox = head.match(/viewBox="[\d.\-]+\s+[\d.\-]+\s+([\d.]+)\s+([\d.]+)"/);
      if (viewBox) {
        return { width: Math.round(Number(viewBox[1])), height: Math.round(Number(viewBox[2])) };
      }
    }
  } catch {
    return null;
  }
  return null;
}

function readingTimeMinutes(markdown) {
  const words = String(markdown ?? "")
    .replace(/```[\s\S]*?```/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

async function walkMarkdown(root) {
  const entries = await fs.readdir(root, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const next = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkMarkdown(next)));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(next);
    }
  }
  return files;
}

async function exists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

function skipDocument(relPath) {
  if (
    relPath === "adr/0000-template.md" ||
    relPath === "requirements/0000-template.md" ||
    relPath === "requirements/0001-capability-template.md"
  ) {
    return true;
  }
  if (relPath === "architecture/README.md") {
    return true;
  }
  return false;
}

function publishDocument(relPath, frontmatter) {
  const status = String(frontmatter.status ?? "").trim().toLowerCase();
  if (status === "published") {
    return true;
  }
  if (status === "archived" || status === "draft") {
    return false;
  }
  return relPath.startsWith(`${DEFAULT_PUBLIC_SECTION}/`);
}

function parseMarkdownDocument(source) {
  const normalized = String(source ?? "").replaceAll("\r\n", "\n");
  if (!normalized.startsWith("---\n")) {
    return { frontmatter: {}, body: normalized };
  }
  const end = normalized.indexOf("\n---\n", 4);
  if (end < 0) {
    return { frontmatter: {}, body: normalized };
  }
  const frontmatterText = normalized.slice(4, end);
  return {
    frontmatter: parseFrontmatter(frontmatterText),
    body: normalized.slice(end + "\n---\n".length),
  };
}

function parseFrontmatter(text) {
  const frontmatter = {};
  for (const line of text.split("\n")) {
    const match = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (!match) {
      continue;
    }
    frontmatter[match[1]] = parseScalar(match[2]);
  }
  return frontmatter;
}

function parseScalar(value) {
  const trimmed = String(value ?? "").trim();
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    return trimmed
      .slice(1, -1)
      .split(",")
      .map((item) => stripQuotes(item.trim()))
      .filter(Boolean);
  }
  return stripQuotes(trimmed);
}

function stripQuotes(value) {
  return value.replace(/^["']|["']$/g, "");
}

function collectionFromPath(sourcePath) {
  if (sourcePath.startsWith("docs/")) return "docs";
  if (sourcePath.startsWith("adr/")) return "adr";
  if (sourcePath.startsWith("architecture/")) return "architecture";
  if (sourcePath.startsWith("requirements/")) return "requirements";
  return "docs";
}

function deriveSlug(sourcePath) {
  const withoutExtension = sourcePath.replace(/\.md$/, "");
  if (withoutExtension.startsWith("docs/")) {
    return slugify(withoutExtension.slice("docs/".length));
  }
  return slugify(withoutExtension);
}

function slugify(value) {
  return String(value ?? "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function deriveADRNumber(sourcePath) {
  const match = sourcePath.match(/^adr\/([0-9]{4})-/);
  return match ? String(Number.parseInt(match[1], 10)) : "";
}

function deriveArc42Section(sourcePath) {
  const match = sourcePath.match(/^architecture\/([0-9]{1,2})-/);
  return match ? String(Number.parseInt(match[1], 10)) : "";
}

function numberOrNull(value) {
  if (value === null || value === undefined || String(value).trim() === "") {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function sortOrder({ collection, sourcePath, adrNumber, arc42Section, explicitOrder = null }) {
  if (explicitOrder !== null) return explicitOrder;
  if (DOC_SOURCE_ORDER.has(sourcePath)) return DOC_SOURCE_ORDER.get(sourcePath);
  if (sourcePath === "architecture/index.md") return 0;
  if (collection === "architecture" && arc42Section !== null) return arc42Section;
  if (sourcePath === "requirements/README.md") return 2000;
  if (collection === "requirements") return 2100;
  if (collection === "adr" && adrNumber !== null) return 3000 + adrNumber;
  return 9000;
}

function titleFromSlug(slug) {
  return String(slug)
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function excerptFromMarkdown(markdown, fallback) {
  let inFence = false;
  for (const line of String(markdown ?? "").split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("```")) {
      inFence = !inFence;
      continue;
    }
    if (inFence || trimmed === "" || trimmed.startsWith("#") || trimmed.startsWith("- ")) {
      continue;
    }
    return stripMarkdownInline(trimmed).slice(0, 180);
  }
  return fallback;
}

function stripMarkdownInline(value) {
  return String(value ?? "")
    .replaceAll("`", "")
    .replaceAll("**", "")
    .replaceAll("__", "")
    .replaceAll("*", "")
    .replaceAll("_", "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}
