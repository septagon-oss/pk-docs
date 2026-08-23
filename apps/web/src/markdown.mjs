import { escapeHtml } from "../../../packages/contracts/src/index.mjs";

// A small CommonMark/GFM subset renderer for the docs site. It is intentionally
// dependency-free so the public build stays reproducible. Supported blocks:
// headings (with anchor ids), paragraphs, fenced code, ordered and unordered
// lists (nested, with task checkboxes), pipe tables, blockquotes and GitHub
// alert callouts, images as figures, horizontal rules, and whitelisted raw
// HTML blocks. Inline: code, strong, emphasis, strikethrough, links, images,
// autolinks, and hard line breaks.

const CALLOUT_KINDS = new Map([
  ["NOTE", { label: "Note", icon: "i" }],
  ["TIP", { label: "Tip", icon: "✓" }],
  ["IMPORTANT", { label: "Important", icon: "!" }],
  ["WARNING", { label: "Warning", icon: "!" }],
  ["CAUTION", { label: "Caution", icon: "✕" }],
]);

const RAW_HTML_BLOCK_TAGS = new Set([
  "a",
  "aside",
  "br",
  "details",
  "div",
  "figcaption",
  "figure",
  "hr",
  "img",
  "kbd",
  "p",
  "picture",
  "section",
  "source",
  "summary",
  "sup",
  "sub",
  "svg",
  "table",
  "tbody",
  "td",
  "th",
  "thead",
  "tr",
  "video",
]);

export function renderMarkdown(markdown, options = {}) {
  const state = {
    options,
    headings: [],
    slugCounts: new Map(),
  };
  const lines = String(markdown ?? "").replaceAll("\r\n", "\n").split("\n");
  const html = renderBlocks(lines, state);
  if (options.collectHeadings) {
    options.collectHeadings.push(...state.headings);
  }
  return html;
}

export function extractHeadings(markdown) {
  const headings = [];
  renderMarkdown(markdown, { collectHeadings: headings });
  return headings;
}

export function slugifyHeading(text) {
  return String(text ?? "")
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/&[a-z]+;|&#\d+;/g, "")
    .replace(/[`*_~]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function renderBlocks(lines, state) {
  const output = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (trimmed === "") {
      index += 1;
      continue;
    }

    if (trimmed.startsWith("```") || trimmed.startsWith("~~~")) {
      const fence = trimmed.slice(0, 3);
      const language = codeFenceLanguage(trimmed);
      const body = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith(fence)) {
        body.push(lines[index]);
        index += 1;
      }
      index += 1;
      output.push(renderCodeFence({ language, lines: body }));
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.*?)\s*#*$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      const step = text.match(/^(?:Step\s+)?(\d{1,2})[.:)]\s+(.+)$/i);
      const headingText = step ? step[2] : text;
      const id = uniqueSlug(slugifyHeading(stripInline(text)), state);
      state.headings.push({ level, text: stripInline(headingText), id, step: step ? Number(step[1]) : null });
      const stepAttrs = step ? ` class="pk-step" data-step="${escapeHtml(step[1])}"` : "";
      output.push(
        `<h${level} id="${escapeHtml(id)}"${stepAttrs}>${inline(headingText, state.options)}<a class="pk-anchor" href="#${escapeHtml(
          id,
        )}" aria-label="Link to this section">#</a></h${level}>`,
      );
      index += 1;
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      output.push("<hr />");
      index += 1;
      continue;
    }

    if (isTableStart(lines, index)) {
      const tableLines = [];
      while (index < lines.length && lines[index].trim().includes("|") && lines[index].trim() !== "") {
        tableLines.push(lines[index].trim());
        index += 1;
      }
      output.push(renderTable(tableLines, state.options));
      continue;
    }

    if (trimmed.startsWith(">")) {
      const quoteLines = [];
      while (index < lines.length && (lines[index].trim().startsWith(">") || (lines[index].trim() !== "" && quoteLines.length > 0 && !isBlockStart(lines[index])))) {
        quoteLines.push(lines[index].trim().replace(/^>\s?/, ""));
        index += 1;
      }
      output.push(renderBlockquote(quoteLines, state));
      continue;
    }

    const listMatch = matchListItem(line);
    if (listMatch) {
      const { block, next } = collectList(lines, index);
      output.push(renderList(block, state));
      index = next;
      continue;
    }

    const imageOnly = trimmed.match(/^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)$/);
    if (imageOnly) {
      output.push(renderFigure(imageOnly[1], imageOnly[2], imageOnly[3], state.options));
      index += 1;
      continue;
    }

    if (isRawHtmlBlock(trimmed)) {
      const raw = [];
      while (index < lines.length && lines[index].trim() !== "") {
        raw.push(lines[index]);
        index += 1;
      }
      output.push(raw.join("\n"));
      continue;
    }

    const paragraph = [];
    while (index < lines.length && lines[index].trim() !== "" && !isBlockStart(lines[index]) && !isTableStart(lines, index)) {
      paragraph.push(lines[index].replace(/^\s+/, ""));
      index += 1;
    }
    if (paragraph.length === 0) {
      paragraph.push(trimmed);
      index += 1;
    }
    output.push(`<p>${inlineParagraph(paragraph, state.options)}</p>`);
  }

  return output.join("\n");
}

function isBlockStart(line) {
  const trimmed = line.trim();
  return (
    trimmed.startsWith("```") ||
    trimmed.startsWith("~~~") ||
    /^#{1,6}\s/.test(trimmed) ||
    trimmed.startsWith(">") ||
    /^(-{3,}|\*{3,}|_{3,})$/.test(trimmed) ||
    Boolean(matchListItem(line)) ||
    /^!\[[^\]]*\]\([^)]+\)$/.test(trimmed) ||
    isRawHtmlBlock(trimmed)
  );
}

function isRawHtmlBlock(trimmed) {
  const match = trimmed.match(/^<\/?([a-zA-Z][a-zA-Z0-9]*)[\s>/]/);
  return Boolean(match) && RAW_HTML_BLOCK_TAGS.has(match[1].toLowerCase());
}

function isTableStart(lines, index) {
  const header = lines[index]?.trim() ?? "";
  const separator = lines[index + 1]?.trim() ?? "";
  if (!header.includes("|") || !separator.includes("|")) {
    return false;
  }
  return /^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?$/.test(separator) && separator.includes("-");
}

function splitTableRow(row) {
  let working = row.trim();
  if (working.startsWith("|")) working = working.slice(1);
  if (working.endsWith("|") && !working.endsWith("\\|")) working = working.slice(0, -1);
  const cells = [];
  let current = "";
  let inCode = false;
  for (let position = 0; position < working.length; position += 1) {
    const char = working[position];
    if (char === "`") inCode = !inCode;
    if (char === "\\" && working[position + 1] === "|") {
      current += "|";
      position += 1;
      continue;
    }
    if (char === "|" && !inCode) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  return cells;
}

function renderTable(tableLines, options) {
  const header = splitTableRow(tableLines[0]);
  const alignments = splitTableRow(tableLines[1]).map((cell) => {
    const left = cell.startsWith(":");
    const right = cell.endsWith(":");
    if (left && right) return "center";
    if (right) return "right";
    return "";
  });
  const bodyRows = tableLines.slice(2).map(splitTableRow);
  const alignAttr = (column) => (alignments[column] ? ` style="text-align:${alignments[column]}"` : "");
  const head = `<thead><tr>${header
    .map((cell, column) => `<th scope="col"${alignAttr(column)}>${inline(cell, options)}</th>`)
    .join("")}</tr></thead>`;
  const body = bodyRows
    .map(
      (row) =>
        `<tr>${header
          .map((_cell, column) => `<td${alignAttr(column)}>${inline(row[column] ?? "", options)}</td>`)
          .join("")}</tr>`,
    )
    .join("");
  return `<div class="pk-table-wrap"><table>${head}<tbody>${body}</tbody></table></div>`;
}

function renderBlockquote(quoteLines, state) {
  const first = quoteLines[0]?.trim() ?? "";
  const alert = first.match(/^\[!([A-Z]+)\]\s*(.*)$/);
  if (alert && CALLOUT_KINDS.has(alert[1])) {
    const kind = CALLOUT_KINDS.get(alert[1]);
    const rest = [...quoteLines.slice(1)];
    if (alert[2]) rest.unshift(alert[2]);
    const body = renderBlocks(rest, { ...state, headings: [] });
    const slug = alert[1].toLowerCase();
    return `<aside class="pk-callout pk-callout--${slug}" role="note"><p class="pk-callout__title"><span class="pk-callout__icon" aria-hidden="true">${escapeHtml(
      kind.icon,
    )}</span>${escapeHtml(kind.label)}</p><div class="pk-callout__body">${body}</div></aside>`;
  }
  return `<blockquote>${renderBlocks(quoteLines, { ...state, headings: [] })}</blockquote>`;
}

function matchListItem(line) {
  const match = line.match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/);
  if (!match) return null;
  return {
    indent: match[1].replace(/\t/g, "  ").length,
    ordered: /\d/.test(match[2]),
    marker: match[2],
    content: match[3],
  };
}

function collectList(lines, start) {
  const items = [];
  let index = start;
  const base = matchListItem(lines[start]);
  const baseIndent = base.indent;
  let current = null;

  while (index < lines.length) {
    const line = lines[index];
    if (line.trim() === "") {
      const following = lines[index + 1];
      if (following === undefined) break;
      const followingItem = matchListItem(following);
      const followingIndent = following.match(/^(\s*)/)[1].length;
      if ((followingItem && followingItem.indent >= baseIndent) || (!followingItem && following.trim() !== "" && followingIndent > baseIndent)) {
        if (current) current.lines.push("");
        index += 1;
        continue;
      }
      break;
    }
    const item = matchListItem(line);
    if (item && item.indent === baseIndent && item.ordered === base.ordered) {
      current = { content: item.content, lines: [] };
      items.push(current);
      index += 1;
      continue;
    }
    if (item && item.indent <= baseIndent) break;
    const indent = line.match(/^(\s*)/)[1].length;
    if (current && (indent > baseIndent || item)) {
      const continuation = line.slice(Math.min(indent, baseIndent + 2));
      const lazy = !item && current.lines.length === 0 && !isBlockStart(continuation);
      if (lazy) {
        current.content += ` ${continuation.trim()}`;
      } else {
        current.lines.push(continuation);
      }
      index += 1;
      continue;
    }
    break;
  }
  return { block: { ordered: base.ordered, items }, next: index };
}

function renderList(block, state) {
  const tag = block.ordered ? "ol" : "ul";
  let hasTasks = false;
  const items = block.items
    .map((item) => {
      let content = item.content;
      let taskAttr = "";
      const task = content.match(/^\[( |x|X)\]\s+(.*)$/);
      if (task) {
        hasTasks = true;
        const checked = task[1].toLowerCase() === "x";
        taskAttr = ` class="pk-task${checked ? " pk-task--done" : ""}"`;
        content = `<input type="checkbox" disabled${checked ? " checked" : ""} aria-hidden="true" /> ${inline(task[2], state.options)}`;
      } else {
        content = inline(content, state.options);
      }
      const nested = item.lines.length > 0 ? renderBlocks(item.lines, { ...state, headings: [] }) : "";
      const nestedHtml = nested ? `\n${nested}` : "";
      return `<li${taskAttr}>${content}${nestedHtml}</li>`;
    })
    .join("");
  const classAttr = hasTasks ? ' class="pk-task-list"' : "";
  return `<${tag}${classAttr}>${items}</${tag}>`;
}

function renderFigure(alt, src, title, options) {
  const resolved = resolveAsset(src, options);
  const caption = title ? `<figcaption>${inline(title, options)}</figcaption>` : "";
  const wide = /#wide$/.test(src) ? " pk-figure--wide" : "";
  const diagram = /\.svg(#|$)/.test(resolved.src) ? " pk-figure--diagram" : "";
  const size = resolved.width && resolved.height ? ` width="${resolved.width}" height="${resolved.height}"` : "";
  return `<figure class="pk-figure${wide}${diagram}"><img src="${escapeHtml(resolved.src.replace(/#wide$/, ""))}" alt="${escapeHtml(
    alt,
  )}"${size} loading="lazy" />${caption}</figure>`;
}

// resolveAsset may return a plain URL or { src, width, height }.
function resolveAsset(src, options) {
  const resolved = typeof options.resolveAsset === "function" ? options.resolveAsset(src) : src;
  if (resolved && typeof resolved === "object") {
    return { src: String(resolved.src ?? src), width: resolved.width, height: resolved.height };
  }
  return { src: String(resolved ?? src) };
}

function codeFenceLanguage(openingLine) {
  const language = String(openingLine ?? "").slice(3).trim().split(/\s+/)[0] ?? "";
  return language.replace(/[^A-Za-z0-9_-]/g, "");
}

function renderCodeFence(fence) {
  const language = fence.language || "";
  const className = language ? ` class="language-${escapeHtml(language)}"` : "";
  const label = language ? `<span class="pk-code__lang">${escapeHtml(codeLabel(language))}</span>` : "";
  const copy = `<button type="button" class="pk-code__copy" data-copy aria-label="Copy code">Copy</button>`;
  return `<div class="pk-code"${language ? ` data-language="${escapeHtml(language)}"` : ""}><div class="pk-code__bar">${label}${copy}</div><pre><code${className}>${escapeHtml(
    fence.lines.join("\n"),
  )}</code></pre></div>`;
}

function codeLabel(language) {
  const labels = {
    bash: "Shell",
    sh: "Shell",
    shell: "Shell",
    console: "Console",
    go: "Go",
    json: "JSON",
    yaml: "YAML",
    yml: "YAML",
    text: "Output",
    txt: "Output",
    http: "HTTP",
    sql: "SQL",
    mermaid: "Mermaid",
    dockerfile: "Dockerfile",
    toml: "TOML",
    js: "JavaScript",
    mjs: "JavaScript",
    ts: "TypeScript",
    html: "HTML",
    css: "CSS",
    diff: "Diff",
    makefile: "Makefile",
  };
  return labels[language.toLowerCase()] ?? language;
}

function uniqueSlug(base, state) {
  const slug = base || "section";
  const count = state.slugCounts.get(slug) ?? 0;
  state.slugCounts.set(slug, count + 1);
  return count === 0 ? slug : `${slug}-${count}`;
}

function inlineParagraph(lines, options) {
  // Inline syntax (bold, links, code) may span a soft line wrap, so the lines
  // are joined before inline rendering. A hard break (two trailing spaces or a
  // trailing backslash) is marked first and turned into <br /> afterwards.
  const joined = lines
    .map((line, index) => {
      const hardBreak = index < lines.length - 1 && (/\s{2,}$/.test(line) || /\\$/.test(line));
      const text = line.replace(/(\s{2,}|\\)$/, "");
      return hardBreak ? `${text}${HARD_BREAK}` : text;
    })
    .join(" ");
  return inline(joined, options).replaceAll(`${HARD_BREAK} `, "<br />").replaceAll(HARD_BREAK, "<br />");
}

const HARD_BREAK = "\u0001";
const CODE_SLOT = "\u0002";

function stripInline(text) {
  return String(text ?? "")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/~~([^~]+)~~/g, "$1")
    .replace(/(^|[\s(])\*([^*\s][^*]*?)\*(?=[\s).,;:!?]|$)/g, "$1$2")
    .trim();
}

export function inline(text, options = {}) {
  // Code spans are lifted out first so their contents are never formatted,
  // then restored after links and emphasis are applied to the surrounding text
  // (which lets a link label contain code).
  const codes = [];
  const withSlots = String(text ?? "").replace(/(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/g, (_match, _ticks, code) => {
    codes.push(`<code>${escapeHtml(String(code).trim())}</code>`);
    return `${CODE_SLOT}${codes.length - 1}${CODE_SLOT}`;
  });
  return inlineText(withSlots, options).replace(new RegExp(`${CODE_SLOT}(\\d+)${CODE_SLOT}`, "g"), (_match, index) => codes[Number(index)]);
}

function inlineText(text, options) {
  let html = escapeHtml(text);
  html = html.replace(/&lt;br\s*\/?&gt;/g, "<br />");
  html = html.replace(/&lt;kbd&gt;([^&]*)&lt;\/kbd&gt;/g, "<kbd>$1</kbd>");
  html = html.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+&quot;([^&]*)&quot;)?\)/g, (_match, alt, src, title) => {
    const resolved = resolveAsset(src, options);
    return `<img src="${escapeHtml(resolved.src)}" alt="${alt}"${title ? ` title="${title}"` : ""} loading="lazy" />`;
  });
  html = html.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+&quot;[^&]*&quot;)?\)/g, (_match, label, href) => {
    const resolved = typeof options.resolveHref === "function" ? options.resolveHref(href) : href;
    const external = /^https?:\/\//i.test(resolved) ? ` rel="noopener"` : "";
    return `<a href="${escapeHtml(resolved)}"${external}>${label}</a>`;
  });
  html = html.replace(/&lt;(https?:\/\/[^\s&]+)&gt;/g, (_match, url) => `<a href="${url}" rel="noopener">${url}</a>`);
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/__([^_]+)__/g, "<strong>$1</strong>");
  html = html.replace(/~~([^~]+)~~/g, "<del>$1</del>");
  html = html.replace(/(^|[\s(>])\*([^*\s][^*]*?)\*(?=[\s<).,;:!?]|$)/g, "$1<em>$2</em>");
  html = html.replace(/(^|[\s(>])_([^_\s][^_]*?)_(?=[\s<).,;:!?]|$)/g, "$1<em>$2</em>");
  return html;
}
