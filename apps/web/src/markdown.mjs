import { escapeHtml } from "../../../packages/contracts/src/index.mjs";

export function renderMarkdown(markdown, options = {}) {
  const lines = String(markdown ?? "").replaceAll("\r\n", "\n").split("\n");
  const output = [];
  let paragraph = [];
  let listItems = [];
  let codeFence = null;
  let orderedIndex = 0;

  const flushParagraph = () => {
    if (paragraph.length === 0) {
      return;
    }
    output.push(`<p>${inline(paragraph.join(" "), options)}</p>`);
    paragraph = [];
  };

  const flushList = (ordered = false) => {
    if (listItems.length === 0) {
      return;
    }
    const tag = ordered ? "ol" : "ul";
    output.push(`<${tag}>${listItems.map((item) => `<li>${inline(item, options)}</li>`).join("")}</${tag}>`);
    listItems = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (trimmed.startsWith("```")) {
      flushParagraph();
      flushList(Boolean(orderedIndex));
      if (codeFence === null) {
        codeFence = {
          language: codeFenceLanguage(trimmed),
          lines: [],
        };
      } else {
        output.push(renderCodeFence(codeFence));
        codeFence = null;
      }
      orderedIndex = 0;
      continue;
    }

    if (codeFence !== null) {
      codeFence.lines.push(line);
      continue;
    }

    if (trimmed === "") {
      flushParagraph();
      flushList(Boolean(orderedIndex));
      orderedIndex = 0;
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      flushParagraph();
      flushList(Boolean(orderedIndex));
      orderedIndex = 0;
      const level = headingMatch[1].length;
      output.push(`<h${level}>${inline(headingMatch[2], options)}</h${level}>`);
      continue;
    }

    if (trimmed.startsWith("- ")) {
      flushParagraph();
      if (orderedIndex > 0) {
        flushList(true);
        orderedIndex = 0;
      }
      listItems.push(trimmed.slice(2));
      continue;
    }

    const orderedMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (orderedMatch) {
      flushParagraph();
      if (orderedIndex === 0) {
        listItems = [];
      }
      orderedIndex += 1;
      listItems.push(orderedMatch[2]);
      continue;
    }

    flushList(Boolean(orderedIndex));
    orderedIndex = 0;
    paragraph.push(trimmed);
  }

  flushParagraph();
  flushList(Boolean(orderedIndex));

  if (codeFence !== null) {
    output.push(renderCodeFence(codeFence));
  }

  return output.join("\n");
}

function codeFenceLanguage(openingLine) {
  const language = String(openingLine ?? "").slice(3).trim().split(/\s+/)[0] ?? "";
  return language.replace(/[^A-Za-z0-9_-]/g, "");
}

function renderCodeFence(fence) {
  const className = fence.language ? ` class="language-${escapeHtml(fence.language)}"` : "";
  return `<pre><code${className}>${escapeHtml(fence.lines.join("\n"))}</code></pre>`;
}

function inline(text, options = {}) {
  return escapeHtml(text)
    .replaceAll(/`([^`]+)`/g, "<code>$1</code>")
    .replaceAll(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replaceAll(/__([^_]+)__/g, "<strong>$1</strong>")
    .replaceAll(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_match, label, href) => {
      const resolved = typeof options.resolveHref === "function" ? options.resolveHref(href) : href;
      return `<a href="${escapeHtml(resolved)}">${label}</a>`;
    });
}
