#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { renderMarkdown } from "../apps/web/src/markdown.mjs";

const DEFAULT_TENANT_ID = "a0000000-0000-0000-0000-000000000002";
const DEFAULT_LOCALE = "en";
const GENERATOR = "pk-docs/scripts/docs-content-seed.mjs";
const SECTIONS = ["adr", "architecture", "requirements"];

const args = parseArgs(process.argv.slice(2));
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const docsRoot = path.resolve(args.root ?? path.join(scriptDir, ".."));
const output = args.output ? path.resolve(args.output) : "";
const tenantId = String(args["tenant-id"] ?? DEFAULT_TENANT_ID).trim();
const locale = String(args.locale ?? DEFAULT_LOCALE).trim() || DEFAULT_LOCALE;

const docs = await collectDocs(docsRoot, tenantId, locale);
const sql = renderSQL(docs, tenantId, locale);

if (!output || output === "-") {
  process.stdout.write(sql);
} else {
  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.writeFile(output, sql);
}

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) {
      continue;
    }
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = "true";
    } else {
      parsed[key] = next;
      i += 1;
    }
  }
  return parsed;
}

async function collectDocs(root, tenantId, locale) {
  const files = [];
  for (const section of SECTIONS) {
    const sectionRoot = path.join(root, section);
    if (!(await exists(sectionRoot))) {
      continue;
    }
    for (const file of await walkMarkdown(sectionRoot)) {
      if (path.basename(file) === "README.md" && section !== "requirements") {
        continue;
      }
      files.push(file);
    }
  }
  files.sort();

  const docs = [];
  for (const file of files) {
    const relPath = path.relative(root, file).split(path.sep).join("/");
    if (relPath === "adr/0000-template.md" || relPath === "requirements/0000-template.md") {
      continue;
    }
    const source = await fs.readFile(file, "utf8");
    const parsed = parseMarkdownDocument(source);
    const frontmatter = parsed.frontmatter;
    const collection = frontmatter.collection || collectionFromPath(relPath);
    const slug = frontmatter.slug || deriveSlug(relPath);
    const adrNumber = numberOrNull(frontmatter.adr_number ?? deriveADRNumber(relPath));
    const arc42Section = numberOrNull(frontmatter.arc42_section ?? deriveArc42Section(relPath));
    const displayBody = collection === "adr" ? cleanADRDisplayMarkdown(parsed.body) : parsed.body;
    const status = frontmatter.status || "";
    const articleStatus = articleStatusFor(collection, status);
    const tags = unique([
      ...asList(frontmatter.tags),
      collection ? `collection:${collection}` : "",
      arc42Section !== null ? `arc42:${arc42Section}` : "",
      adrNumber !== null ? `adr:${adrNumber}` : "",
      frontmatter.adr_topic ? `topic:${frontmatter.adr_topic}` : "",
      status ? `adr_status:${status.toLowerCase()}` : "",
    ]);
    const metadata = {
      docs_source: "pk-docs",
      source_path: relPath,
      source_hash: sha1Hex(parsed.body),
      collection: collection || null,
      arc42_section: arc42Section,
      adr_number: adrNumber,
      adr_topic: frontmatter.adr_topic || null,
      adr_status: status || null,
      adr_date: frontmatter.date || null,
      supersedes: asList(frontmatter.supersedes),
      superseded_by: asList(frontmatter.superseded_by),
      affects: asList(frontmatter.affects),
      locale,
    };
    docs.push({
      id: stableUUID(`platformkit-doc:${tenantId}:${locale}:${slug}`),
      tenantId,
      title: frontmatter.title || titleFromSlug(slug),
      slug,
      locale,
      content: displayBody,
      contentHtml: renderMarkdown(displayBody, {
        resolveHref: (href) => resolveDocsHref(href, relPath),
      }),
      type: frontmatter.type || "doc",
      status: articleStatus,
      tags,
      excerpt: excerptFromMarkdown(displayBody, frontmatter.title || titleFromSlug(slug)),
      sortOrder: sortOrder(collection, adrNumber, arc42Section),
      metadata,
    });
  }
  return docs;
}

function cleanADRDisplayMarkdown(markdown) {
  const lines = String(markdown ?? "").replaceAll("\r\n", "\n").split("\n");
  const output = [];
  let skipLevel = 0;

  for (const line of lines) {
    const heading = parseATXHeading(line);
    if (skipLevel > 0) {
      if (heading && heading.level <= skipLevel) {
        skipLevel = 0;
      } else {
        continue;
      }
    }
    if (heading && heading.level === 2 && ["status", "date"].includes(heading.key)) {
      skipLevel = heading.level;
      continue;
    }
    output.push(line);
  }

  return output.join("\n").replace(/^\n+/, "");
}

function parseATXHeading(line) {
  const match = String(line ?? "").match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
  if (!match) {
    return null;
  }
  return {
    level: match[1].length,
    key: normalizeHeadingKey(match[2]),
  };
}

function normalizeHeadingKey(text) {
  return String(text ?? "")
    .replace(/[`*_~[\]()]/g, "")
    .trim()
    .toLowerCase();
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
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
  const body = normalized.slice(end + "\n---\n".length);
  return { frontmatter: parseFrontmatter(frontmatterText), body };
}

function parseFrontmatter(text) {
  const out = {};
  for (const line of text.split("\n")) {
    const match = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (!match) {
      continue;
    }
    out[match[1]] = parseScalar(match[2]);
  }
  return out;
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

function articleStatusFor(collection, status) {
  const normalized = String(status ?? "").trim().toLowerCase();
  if (collection === "adr") {
    return ["accepted", "living"].includes(normalized) ? "published" : "draft";
  }
  if (["draft", "proposed"].includes(normalized)) {
    return "draft";
  }
  return "published";
}

function collectionFromPath(relPath) {
  if (relPath.startsWith("adr/")) {
    return "adr";
  }
  if (relPath.startsWith("architecture/")) {
    return "architecture";
  }
  if (relPath.startsWith("validation/")) {
    return "validation";
  }
  if (relPath.startsWith("requirements/")) {
    return "validation";
  }
  return "";
}

function deriveSlug(relPath) {
  return relPath.replace(/\.md$/, "").replaceAll("/", "-").toLowerCase();
}

function resolveDocsHref(href, fromRelPath) {
  const raw = String(href ?? "").trim();
  if (raw === "" || raw.startsWith("#") || /^[a-z][a-z0-9+.-]*:/i.test(raw)) {
    return raw;
  }
  const [target, fragment = ""] = raw.split("#", 2);
  if (!target.endsWith(".md")) {
    return raw;
  }
  const normalized = path.posix.normalize(path.posix.join(path.posix.dirname(fromRelPath), target));
  if (!SECTIONS.some((section) => normalized.startsWith(`${section}/`))) {
    return raw;
  }
  const suffix = fragment ? `#${fragment}` : "";
  return `/docs/${deriveSlug(normalized)}${suffix}`;
}

function deriveADRNumber(relPath) {
  const match = relPath.match(/^adr\/([0-9]{4})-/);
  if (!match) {
    return "";
  }
  return String(Number.parseInt(match[1], 10));
}

function deriveArc42Section(relPath) {
  const match = relPath.match(/^architecture\/([0-9]{1,2})-/);
  if (!match) {
    return "";
  }
  return String(Number.parseInt(match[1], 10));
}

function numberOrNull(value) {
  if (value === null || value === undefined || String(value).trim() === "") {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function asList(value) {
  if (Array.isArray(value)) {
    return value.map(String).map((item) => item.trim()).filter(Boolean);
  }
  if (!value) {
    return [];
  }
  return String(value)
    .replace(/^\[/, "")
    .replace(/\]$/, "")
    .split(",")
    .map((item) => stripQuotes(item.trim()))
    .filter(Boolean);
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
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
  let currentHeading = "";
  for (const line of String(markdown ?? "").split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("```")) {
      inFence = !inFence;
      continue;
    }
    const headingMatch = trimmed.match(/^#{1,6}\s+(.*)$/);
    if (headingMatch) {
      currentHeading = headingMatch[1].toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
      continue;
    }
    if (inFence || trimmed === "" || trimmed.startsWith("- ")) {
      continue;
    }
    if (currentHeading === "status" || currentHeading === "date") {
      continue;
    }
    if (/^(Accepted|Living|Proposed|Draft|Superseded|Deprecated)(\b|$)/i.test(trimmed)) {
      continue;
    }
    if (/^Status:/i.test(trimmed) || /^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      continue;
    }
    return stripMarkdownInline(trimmed).slice(0, 240);
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
    .replace(/\[[^\]]+\]\([^)]+\)/g, (match) => match.replace(/^\[/, "").replace(/\]\([^)]+\)$/, ""))
    .replace(/\s+/g, " ")
    .trim();
}

function sortOrder(collection, adrNumber, arc42Section) {
  if (collection === "architecture" && arc42Section !== null) {
    return arc42Section;
  }
  if (collection === "adr" && adrNumber !== null) {
    return 1000 + adrNumber;
  }
  return 9000;
}

function renderSQL(docs, tenantId, locale) {
  const generatedAt = new Date().toISOString();
  const slugs = docs.map((doc) => doc.slug);
  const lines = [
    `-- Code generated by ${GENERATOR}. DO NOT EDIT.`,
    `-- Generated: ${generatedAt}`,
    "-- Recreates platform-authored documentation in the default PlatformKit tenant.",
    "",
    "BEGIN;",
    "",
    "DELETE FROM content_articles",
    `WHERE tenant_id = ${sqlString(tenantId)}::uuid`,
    "  AND (",
    "    metadata ->> 'docs_source' = 'pk-docs'",
    "    OR metadata ->> 'collection' IN ('adr', 'architecture', 'validation')",
  ];
  if (slugs.length > 0) {
    lines.push("    OR slug IN (");
    lines.push(slugs.map((slug) => `      ${sqlString(slug)}`).join(",\n"));
    lines.push("    )");
  }
  lines.push("  );", "");

  if (docs.length > 0) {
    lines.push(
      "INSERT INTO content_articles (",
      "    id, tenant_id, title, slug, locale, content, content_html, type, status,",
      "    category_id, tags, excerpt, sort_order, metadata, published_at, created_at, updated_at",
      ") VALUES",
    );
    lines.push(
      docs
        .map((doc) =>
          [
            `${sqlString(doc.id)}::uuid`,
            `${sqlString(doc.tenantId)}::uuid`,
            sqlString(doc.title),
            sqlString(doc.slug),
            sqlString(locale),
            sqlString(doc.content),
            sqlString(doc.contentHtml),
            sqlString(doc.type),
            sqlString(doc.status),
            "NULL",
            `${sqlString(JSON.stringify(doc.tags))}::jsonb`,
            sqlString(doc.excerpt),
            String(doc.sortOrder),
            `${sqlString(JSON.stringify(doc.metadata))}::jsonb`,
            "NOW()",
            "NOW()",
            "NOW()",
          ].join(", "),
        )
        .map((row) => `(${row})`)
        .join(",\n"),
    );
    lines.push(";");
  }
  lines.push("COMMIT;", "");
  return lines.join("\n");
}

function stableUUID(input) {
  const bytes = crypto.createHash("sha1").update(input).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function sha1Hex(value) {
  return crypto.createHash("sha1").update(String(value ?? "")).digest("hex");
}

function sqlString(value) {
  return `'${String(value ?? "").replaceAll("\u0000", "").replaceAll("'", "''")}'`;
}
