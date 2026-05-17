import { promises as fs } from "node:fs";
import path from "node:path";

import { renderMarkdown } from "./markdown.mjs";

const DOC_SECTIONS = ["architecture", "adr", "requirements"];

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
      files.push(file);
    }
  }
  files.sort();

  const entries = [];
  for (const file of files) {
    const sourcePath = path.relative(workspaceRoot, file).split(path.sep).join("/");
    const parsed = parseMarkdownDocument(await fs.readFile(file, "utf8"));
    const collection = parsed.frontmatter.collection || collectionFromPath(sourcePath);
    const slug = parsed.frontmatter.slug || deriveSlug(sourcePath);
    const title = parsed.frontmatter.title || titleFromSlug(slug);
    const excerpt = excerptFromMarkdown(parsed.body, title);
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
      contentHtml: renderMarkdown(parsed.body, {
        resolveHref: (href) => resolveDocsHref(href, sourcePath),
      }),
      excerpt,
      status: "published",
      metadata: {
        docsSource: "pk-docs",
        sourcePath,
        collection,
        arc42Section: numberOrNull(parsed.frontmatter.arc42_section ?? deriveArc42Section(sourcePath)),
        adrNumber: numberOrNull(parsed.frontmatter.adr_number ?? deriveADRNumber(sourcePath)),
      },
      order: sortOrder({
        collection,
        sourcePath,
        adrNumber: numberOrNull(parsed.frontmatter.adr_number ?? deriveADRNumber(sourcePath)),
        arc42Section: numberOrNull(parsed.frontmatter.arc42_section ?? deriveArc42Section(sourcePath)),
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
    return raw;
  }
  const normalized = path.posix.normalize(path.posix.join(path.posix.dirname(fromSourcePath), target));
  if (!DOC_SECTIONS.some((section) => normalized.startsWith(`${section}/`))) {
    return raw;
  }
  const suffix = fragment ? `#${fragment}` : "";
  return `/docs/${deriveSlug(normalized)}${suffix}`;
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
  if (sourcePath.startsWith("adr/")) return "adr";
  if (sourcePath.startsWith("architecture/")) return "architecture";
  if (sourcePath.startsWith("requirements/")) return "requirements";
  return "docs";
}

function deriveSlug(sourcePath) {
  return sourcePath.replace(/\.md$/, "").replaceAll("/", "-").toLowerCase();
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

function sortOrder({ collection, sourcePath, adrNumber, arc42Section }) {
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
