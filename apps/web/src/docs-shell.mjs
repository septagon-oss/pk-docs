import { escapeHtml } from "../../../packages/contracts/src/index.mjs";

// The docs-site shell: the reader-facing layout for the published guides.
// Everything here is plain HTML + CSS with one small progressive-enhancement
// script (copy buttons, on-page highlighting, search over the content index).
// Colors are the pk-design default theme, so the docs wear the same system
// the guides describe.

const GITHUB_REPO = "https://github.com/septagon-oss/pk-docs";
const PLATFORMKIT_REPO = "https://github.com/septagon-oss/platformkit";

const GROUP_ORDER = ["Start here", "Build", "Reference", "Guides", "Architecture", "Requirements", "Architecture Decisions", "Docs"];

export function docsGroupTitle(entry) {
  const explicit = String(entry?.metadata?.group ?? entry?.group ?? "").trim();
  if (explicit) return explicit;
  return collectionTitle(entry?.collection);
}

export function collectionTitle(collection) {
  if (collection === "adr") return "Architecture Decisions";
  if (collection === "requirements") return "Requirements";
  if (collection === "architecture") return "Architecture";
  if (collection === "guides") return "Guides";
  return "Docs";
}

export function groupDocsEntries(contentEntries) {
  const groups = new Map();
  for (const entry of contentEntries) {
    const key = docsGroupTitle(entry);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(entry);
  }
  const rank = (title) => {
    const index = GROUP_ORDER.indexOf(title);
    return index === -1 ? GROUP_ORDER.length : index;
  };
  return [...groups.entries()].sort((a, b) => rank(a[0]) - rank(b[0]) || a[0].localeCompare(b[0]));
}

export function renderDocsLayout({ title, description, content, activeHref = "", bodyClass = "", contentEntries = [] }) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <meta name="color-scheme" content="light dark" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:type" content="website" />
    <link rel="icon" href="/assets/favicon.svg" type="image/svg+xml" />
    <link rel="stylesheet" href="/assets/site.css" />
    <script src="/assets/site.js" defer></script>
  </head>
  <body class="pk-site ${escapeHtml(bodyClass)}">
    <a class="pk-skip" href="#main">Skip to content</a>
    <header class="pk-topbar">
      <div class="pk-topbar__inner">
        <a class="pk-brand" href="/" aria-label="PlatformKit docs home">
          <span class="pk-brand__mark" aria-hidden="true"><span></span><span></span><span></span></span>
          <span class="pk-brand__text"><strong>PlatformKit</strong><small>Docs</small></span>
        </a>
        <label class="pk-search" for="pk-search-input">
          <span class="pk-search__icon" aria-hidden="true">⌕</span>
          <input id="pk-search-input" type="search" placeholder="Search the docs…" autocomplete="off" aria-label="Search the docs" data-search-input />
          <kbd aria-hidden="true">/</kbd>
          <div class="pk-search__results" data-search-results hidden></div>
        </label>
        <nav class="pk-topnav" aria-label="Primary navigation">
          <a href="/docs/current-quickstart"${activeHref === "/docs/current-quickstart" ? ' aria-current="page"' : ""}>Quickstart</a>
          <a href="/docs"${activeHref === "/docs" ? ' aria-current="page"' : ""}>All guides</a>
          <a href="${PLATFORMKIT_REPO}" rel="noopener">GitHub ↗</a>
        </nav>
      </div>
    </header>
    <main id="main" class="pk-main">${content}</main>
    <footer class="pk-footer">
      <div class="pk-footer__inner">
        <p>PlatformKit is Apache-2.0 open source by <a href="https://github.com/septagon-oss" rel="noopener">Septagon</a>. The executable contract lives in <a href="${PLATFORMKIT_REPO}" rel="noopener">septagon-oss/platformkit</a>; this site is built from <a href="${GITHUB_REPO}" rel="noopener">septagon-oss/pk-docs</a>.</p>
        <p class="pk-footer__links"><a href="/docs">All guides</a><a href="${GITHUB_REPO}/issues/new" rel="noopener">Report a docs problem</a><a href="mailto:hello@septagon.dev">Contact</a></p>
      </div>
    </footer>
    <script type="application/json" id="pk-search-data">${escapeJsonForScript(searchIndex(contentEntries))}</script>
  </body>
</html>`;
}

function searchIndex(contentEntries) {
  return contentEntries.map((entry) => ({
    title: entry.title,
    route: entry.route,
    group: docsGroupTitle(entry),
    excerpt: entry.excerpt ?? "",
    headings: (entry.headings ?? []).map((heading) => ({ text: heading.text, id: heading.id })),
  }));
}

function escapeJsonForScript(value) {
  return JSON.stringify(value).replaceAll("<", "\\u003c").replaceAll(">", "\\u003e").replaceAll("&", "\\u0026");
}

export function renderDocsHome(contentEntries) {
  const bySlug = new Map(contentEntries.map((entry) => [entry.slug, entry]));
  const pick = (slug) => bySlug.get(slug);
  const quickstart = pick("current-quickstart");
  const overview = pick("current-overview");
  const extensions = pick("current-extensions");
  const paths = [
    {
      kicker: "I want to run it",
      title: "Quickstart",
      body: "One command gives you a multi-tenant backend, an operator console, and an API. Fifteen minutes, no Docker, no database server.",
      href: quickstart?.route ?? "/docs/current-quickstart",
      icon: "▶",
    },
    {
      kicker: "I want to understand it",
      title: "What is PlatformKit?",
      body: "The one-page picture: what ships, what deliberately does not, how the repositories fit, and who it is for.",
      href: overview?.route ?? "/docs",
      icon: "◎",
    },
    {
      kicker: "I want to extend it",
      title: "Build a secure extension",
      body: "Add your own tenant-scoped module through the one supported seam, with scope checks and isolation tests generated for you.",
      href: extensions?.route ?? "/docs/current-extensions",
      icon: "⬡",
    },
  ];

  return renderDocsLayout({
    title: "PlatformKit Docs",
    description: "Run, understand, and extend PlatformKit — the open-source Go foundation for multi-tenant SaaS.",
    activeHref: "/",
    bodyClass: "pk-site--home",
    contentEntries,
    content: `
      <section class="pk-hero">
        <div class="pk-hero__copy">
          <span class="pk-eyebrow">PlatformKit OSS · documentation</span>
          <h1>A multi-tenant SaaS backend, running in one command.</h1>
          <p class="pk-hero__lede">PlatformKit gives you tenants, users, sessions, API keys, audit, content, notifications, branding, health, and a real operator console — in a single Go process. These guides take you from <code>go run</code> to your own secure module.</p>
          <div class="pk-hero__actions">
            <a class="pk-button pk-button--primary" href="${escapeHtml(quickstart?.route ?? "/docs/current-quickstart")}">Start the quickstart →</a>
            <a class="pk-button" href="${escapeHtml(overview?.route ?? "/docs")}">What is PlatformKit?</a>
          </div>
          <div class="pk-hero__terminal" aria-label="The one command to run PlatformKit">
            <span class="pk-hero__prompt">$</span><code>go run github.com/septagon-oss/platformkit@latest</code>
            <button type="button" class="pk-code__copy" data-copy data-copy-text="go run github.com/septagon-oss/platformkit@latest" aria-label="Copy command">Copy</button>
          </div>
        </div>
        <figure class="pk-hero__shot pk-window">
          <div class="pk-window__bar" aria-hidden="true"><span></span><span></span><span></span><em>127.0.0.1:8080/admin</em></div>
          <img src="/docs/assets/screenshots/admin-overview.png" alt="The PlatformKit operator console overview page after logging in: a dark sidebar lists Tenant, Branding, Users, API keys, Content, Notifications, System health, and Audit log; the main panel shows an Operational status badge and counts of managed areas, collections, and actions." width="1440" height="900" />
          <figcaption>What you see after the quickstart: the operator console that ships with the starter.</figcaption>
        </figure>
      </section>

      <section class="pk-paths" aria-labelledby="paths-title">
        <h2 id="paths-title" class="pk-section-title">Pick a path</h2>
        <div class="pk-paths__grid">
          ${paths
            .map(
              (card) => `
            <a class="pk-path" href="${escapeHtml(card.href)}">
              <span class="pk-path__icon" aria-hidden="true">${card.icon}</span>
              <span class="pk-path__kicker">${escapeHtml(card.kicker)}</span>
              <strong>${escapeHtml(card.title)}</strong>
              <span class="pk-path__body">${escapeHtml(card.body)}</span>
              <span class="pk-path__cta" aria-hidden="true">Open →</span>
            </a>`,
            )
            .join("")}
        </div>
      </section>

      <section class="pk-journey" aria-labelledby="journey-title">
        <h2 id="journey-title" class="pk-section-title">The whole journey, at a glance</h2>
        <figure class="pk-figure pk-figure--plain">
          <img src="/docs/assets/diagrams/journey.svg" alt="Four steps: run the starter, log in to the operator console, call the API with a bearer session, then generate your own module with platformkit new module and verify it." width="1200" height="300" />
        </figure>
      </section>

      <section class="pk-all" aria-labelledby="all-title">
        <h2 id="all-title" class="pk-section-title">Every guide</h2>
        ${renderDocsGroups(contentEntries)}
      </section>
    `,
  });
}

export function renderDocsIndex(contentEntries) {
  return renderDocsLayout({
    title: "All guides | PlatformKit Docs",
    description: "Every published PlatformKit guide, in reading order.",
    activeHref: "/docs",
    contentEntries,
    content: `
      <div class="pk-page pk-page--index">
        <header class="pk-page__head">
          <span class="pk-eyebrow">Docs</span>
          <h1>All guides</h1>
          <p class="pk-lede">Read top to bottom for the full story, or jump to the page you need. Every page states what the starter actually does today; roadmap ideas are labelled as such.</p>
        </header>
        ${renderDocsGroups(contentEntries)}
      </div>
    `,
  });
}

function renderDocsGroups(contentEntries) {
  return `<div class="pk-groups">${groupDocsEntries(contentEntries)
    .map(
      ([group, entries]) => `
      <section class="pk-group">
        <h3 class="pk-group__title">${escapeHtml(group)}</h3>
        <ol class="pk-cards">
          ${entries
            .map(
              (entry) => `
            <li>
              <a class="pk-card" href="${escapeHtml(entry.route)}">
                <span class="pk-card__title">${escapeHtml(entry.title)}</span>
                <span class="pk-card__excerpt">${escapeHtml(entry.excerpt ?? "")}</span>
                <span class="pk-card__meta">${escapeHtml(String(entry.metadata?.readingTime ?? 1))} min read</span>
              </a>
            </li>`,
            )
            .join("")}
        </ol>
      </section>`,
    )
    .join("")}</div>`;
}

export function renderDocsPage(entry, contentEntries = []) {
  const ordered = contentEntries;
  const position = ordered.findIndex((item) => item.slug === entry.slug);
  const previous = position > 0 ? ordered[position - 1] : null;
  const next = position >= 0 && position < ordered.length - 1 ? ordered[position + 1] : null;
  const headings = (entry.headings ?? []).filter((heading) => heading.level === 2 || heading.level === 3);
  const editHref = `${GITHUB_REPO}/edit/main/${entry.sourcePath}`;
  const group = docsGroupTitle(entry);
  const body = injectLede(entry.contentHtml ?? "", entry.excerpt, entry.content);

  return renderDocsLayout({
    title: `${entry.title} | PlatformKit Docs`,
    description: entry.excerpt ?? entry.title,
    activeHref: "/docs",
    contentEntries,
    content: `
      <div class="pk-docs">
        <aside class="pk-sidebar" aria-label="Docs navigation">
          <details class="pk-sidebar__mobile">
            <summary>Browse guides</summary>
            ${renderSidebarNav(contentEntries, entry)}
          </details>
          <div class="pk-sidebar__desktop">${renderSidebarNav(contentEntries, entry)}</div>
        </aside>

        <article class="pk-article">
          <nav class="pk-breadcrumb" aria-label="Breadcrumb">
            <a href="/">Docs</a><span aria-hidden="true">/</span><a href="/docs">${escapeHtml(group)}</a><span aria-hidden="true">/</span><span aria-current="page">${escapeHtml(entry.title)}</span>
          </nav>
          <div class="pk-article__meta">
            <span>${escapeHtml(String(entry.metadata?.readingTime ?? 1))} min read</span>
            <a href="${escapeHtml(editHref)}" rel="noopener">Edit this page ↗</a>
          </div>
          <div class="markdown-body pk-prose">${body}</div>
          <nav class="pk-pager" aria-label="Previous and next">
            ${previous ? `<a class="pk-pager__link pk-pager__link--prev" href="${escapeHtml(previous.route)}"><small>← Previous</small><strong>${escapeHtml(previous.title)}</strong></a>` : "<span></span>"}
            ${next ? `<a class="pk-pager__link pk-pager__link--next" href="${escapeHtml(next.route)}"><small>Next →</small><strong>${escapeHtml(next.title)}</strong></a>` : "<span></span>"}
          </nav>
        </article>

        <aside class="pk-toc" aria-label="On this page">
          ${
            headings.length > 0
              ? `<p class="pk-toc__title">On this page</p><ol class="pk-toc__list">${headings
                  .map(
                    (heading) =>
                      `<li class="pk-toc__item pk-toc__item--h${heading.level}"><a href="#${escapeHtml(heading.id)}">${
                        heading.step ? `<span class="pk-toc__step">${escapeHtml(String(heading.step))}</span>` : ""
                      }${escapeHtml(heading.text)}</a></li>`,
                  )
                  .join("")}</ol>`
              : ""
          }
          <p class="pk-toc__source">Source: <code>${escapeHtml(entry.sourcePath)}</code></p>
        </aside>
      </div>
    `,
  });
}

function renderSidebarNav(contentEntries, current) {
  return `<nav class="pk-nav"><ul class="pk-nav__groups">${groupDocsEntries(contentEntries)
    .map(
      ([group, entries]) => `
      <li>
        <p class="pk-nav__group">${escapeHtml(group)}</p>
        <ul class="pk-nav__links">${entries
          .map(
            (entry) =>
              `<li><a href="${escapeHtml(entry.route)}"${entry.slug === current?.slug ? ' aria-current="page"' : ""}>${escapeHtml(entry.title)}</a></li>`,
          )
          .join("")}</ul>
      </li>`,
    )
    .join("")}</ul></nav>`;
}

// The page's frontmatter description becomes a lede paragraph under the H1 so a
// reader knows in one breath what the page will give them.
function injectLede(html, excerpt, markdown) {
  const description = String(excerpt ?? "").trim();
  if (!description) return html;
  const firstParagraph = firstProseLine(markdown);
  if (firstParagraph && firstParagraph.startsWith(description.slice(0, 40))) {
    return html;
  }
  const closing = html.indexOf("</h1>");
  if (closing === -1) return html;
  const cut = closing + "</h1>".length;
  return `${html.slice(0, cut)}\n<p class="pk-lede">${escapeHtml(description)}</p>${html.slice(cut)}`;
}

function firstProseLine(markdown) {
  for (const line of String(markdown ?? "").split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#") || trimmed.startsWith("!") || trimmed.startsWith(">") || trimmed.startsWith("```")) {
      continue;
    }
    return trimmed.replace(/[`*_]/g, "");
  }
  return "";
}

export function renderDocsFavicon() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="#12201d"/><rect x="14" y="14" width="16" height="16" rx="2" fill="#d8f35d"/><rect x="34" y="14" width="16" height="16" rx="2" fill="none" stroke="#d8f35d" stroke-width="4"/><rect x="14" y="38" width="36" height="12" rx="2" fill="#d8f35d"/></svg>`;
}

export function renderDocsScript() {
  return `(() => {
  const base = (() => {
    const link = document.querySelector('link[rel="stylesheet"][href$="/assets/site.css"]');
    if (!link) return "";
    return link.getAttribute("href").replace(/\\/assets\\/site\\.css$/, "");
  })();

  // Copy buttons on code blocks.
  for (const button of document.querySelectorAll("[data-copy]")) {
    button.addEventListener("click", async () => {
      const explicit = button.getAttribute("data-copy-text");
      const block = button.closest(".pk-code");
      const text = explicit ?? block?.querySelector("code")?.textContent ?? "";
      try {
        await navigator.clipboard.writeText(text);
        button.textContent = "Copied";
        button.classList.add("is-done");
        setTimeout(() => { button.textContent = "Copy"; button.classList.remove("is-done"); }, 1600);
      } catch {
        button.textContent = "Select & copy";
      }
    });
  }

  // Highlight the section the reader is in: the last heading above the fold.
  const tocLinks = [...document.querySelectorAll(".pk-toc a[href^='#']")];
  if (tocLinks.length > 0) {
    const targets = tocLinks
      .map((link) => ({ link, heading: document.getElementById(link.getAttribute("href").slice(1)) }))
      .filter((item) => item.heading);
    let active = null;
    let ticking = false;
    const update = () => {
      ticking = false;
      const offset = 110;
      let current = targets[0];
      for (const item of targets) {
        if (item.heading.getBoundingClientRect().top - offset <= 0) current = item;
      }
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) current = targets[targets.length - 1];
      if (current && current.link !== active) {
        active?.removeAttribute("aria-current");
        current.link.setAttribute("aria-current", "location");
        active = current.link;
      }
    };
    const schedule = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    update();
  }

  // Search over the content index embedded in the page.
  const input = document.querySelector("[data-search-input]");
  const results = document.querySelector("[data-search-results]");
  const raw = document.getElementById("pk-search-data");
  if (input && results && raw) {
    let index = [];
    try { index = JSON.parse(raw.textContent); } catch { index = []; }
    const render = (query) => {
      const q = query.trim().toLowerCase();
      if (q.length < 2) { results.hidden = true; results.innerHTML = ""; return; }
      const hits = [];
      for (const page of index) {
        const title = page.title.toLowerCase();
        if (title.includes(q)) hits.push({ page, label: page.title, href: page.route, score: 3 });
        for (const heading of page.headings) {
          if (heading.text.toLowerCase().includes(q)) hits.push({ page, label: page.title + " › " + heading.text, href: page.route + "#" + heading.id, score: 2 });
        }
        if (!title.includes(q) && page.excerpt.toLowerCase().includes(q)) hits.push({ page, label: page.title, href: page.route, score: 1 });
      }
      hits.sort((a, b) => b.score - a.score);
      const top = hits.slice(0, 8);
      if (top.length === 0) {
        results.innerHTML = '<p class="pk-search__empty">No matches. Try a shorter word.</p>';
      } else {
        results.innerHTML = "<ul>" + top.map((hit) => '<li><a href="' + base + hit.href + '"><span>' + escapeText(hit.page.group) + '</span>' + escapeText(hit.label) + '</a></li>').join("") + "</ul>";
      }
      results.hidden = false;
    };
    input.addEventListener("input", () => render(input.value));
    input.addEventListener("focus", () => render(input.value));
    document.addEventListener("click", (event) => { if (!event.target.closest(".pk-search")) results.hidden = true; });
    document.addEventListener("keydown", (event) => {
      if (event.key === "/" && document.activeElement !== input && !/^(INPUT|TEXTAREA)$/.test(document.activeElement?.tagName ?? "")) { event.preventDefault(); input.focus(); }
      if (event.key === "Escape") { results.hidden = true; input.blur(); }
    });
  }

  function escapeText(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  }
})();`;
}

export function renderDocsStyles() {
  return `
/* ---------- Docs site: tokens from the pk-design default theme ---------- */
.pk-site {
  --pk-canvas: #f2efe7;
  --pk-surface: #fffdf7;
  --pk-surface-muted: #e9e4d8;
  --pk-ink: #15221f;
  --pk-ink-muted: #5f6b65;
  --pk-border: #cbc5b8;
  --pk-border-strong: #8f988f;
  --pk-accent: #0f5d4e;
  --pk-accent-hover: #0a493e;
  --pk-accent-on: #f9fff9;
  --pk-signal: #d8f35d;
  --pk-focus: #326de6;
  --pk-ok: #12715d;
  --pk-ok-bg: #dcf3e8;
  --pk-warn: #9a5318;
  --pk-warn-bg: #fff0d2;
  --pk-danger: #9e3833;
  --pk-danger-bg: #fbe5e2;
  --pk-info-bg: #e3ecfb;
  --pk-dark: #12201d;
  --pk-dark-text: #eff4e9;
  --pk-dark-muted: #aebbb2;
  --pk-code-bg: #0f1a17;
  --pk-shadow: 0 18px 50px rgba(21, 34, 31, 0.12);
  --pk-radius: 8px;
  --pk-font-display: "Iowan Old Style", "Palatino Linotype", "Book Antiqua", Palatino, Georgia, serif;
  --pk-font-body: "IBM Plex Sans", "Inter", "Segoe UI", system-ui, -apple-system, sans-serif;
  --pk-font-mono: "IBM Plex Mono", "Berkeley Mono", "SFMono-Regular", "Cascadia Code", Menlo, monospace;
  --pk-measure: 72ch;
  background: var(--pk-canvas);
  color: var(--pk-ink);
  font-family: var(--pk-font-body);
  font-size: 16px;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}
@media (prefers-color-scheme: dark) {
  .pk-site {
    --pk-canvas: #0e1513;
    --pk-surface: #15201d;
    --pk-surface-muted: #1b2825;
    --pk-ink: #eaf1ea;
    --pk-ink-muted: #aebbb2;
    --pk-border: #2a3a35;
    --pk-border-strong: #4a5c55;
    --pk-accent: #5fc2a6;
    --pk-accent-hover: #7dd6bd;
    --pk-accent-on: #0b1a16;
    --pk-signal: #d8f35d;
    --pk-focus: #7aa7ff;
    --pk-ok: #7ed3b5;
    --pk-ok-bg: #16302a;
    --pk-warn: #f0b36b;
    --pk-warn-bg: #33271a;
    --pk-danger: #f09a94;
    --pk-danger-bg: #3a1f1d;
    --pk-info-bg: #1c2a3f;
    --pk-code-bg: #0a100e;
    --pk-shadow: 0 18px 50px rgba(0, 0, 0, 0.45);
  }
  .pk-site .pk-window img { filter: brightness(0.94); }
}
.pk-site *, .pk-site *::before, .pk-site *::after { box-sizing: border-box; }
.pk-site a { color: inherit; text-decoration-thickness: 1px; text-underline-offset: 3px; }
.pk-prose a, .pk-lede a, .pk-footer a, .pk-hero__lede a { color: var(--pk-accent); }
.pk-prose a:hover, .pk-lede a:hover, .pk-footer a:hover { color: var(--pk-accent-hover); }
.pk-site :focus-visible { outline: 3px solid var(--pk-focus); outline-offset: 2px; border-radius: 4px; }
.pk-site code, .pk-site kbd, .pk-site pre { font-family: var(--pk-font-mono); }
.pk-site code { background: var(--pk-surface-muted); color: var(--pk-ink); padding: 0.12rem 0.38rem; border-radius: 4px; font-size: 0.9em; }
.pk-site kbd { border: 1px solid var(--pk-border); border-bottom-width: 2px; background: var(--pk-surface); padding: 0.05rem 0.4rem; border-radius: 4px; font-size: 0.82em; }
.pk-skip { position: absolute; left: -999px; top: 0; background: var(--pk-signal); color: #15221f; padding: 0.6rem 1rem; z-index: 100; font-weight: 600; }
.pk-skip:focus { left: 1rem; top: 1rem; }

/* ---------- Top bar ---------- */
.pk-topbar { position: sticky; top: 0; z-index: 40; background: var(--pk-dark); color: var(--pk-dark-text); border-bottom: 1px solid rgba(255,255,255,0.06); }
.pk-topbar__inner { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 1.5rem; width: min(1360px, 100% - 2.5rem); margin: 0 auto; height: 64px; }
.pk-brand { display: inline-flex; align-items: center; gap: 0.75rem; color: var(--pk-dark-text); text-decoration: none; }
.pk-brand__mark { position: relative; display: grid; grid-template-columns: 1fr 1fr; gap: 3px; width: 34px; height: 34px; padding: 6px; border-radius: 6px; background: #0b1412; border: 1px solid rgba(216, 243, 93, 0.35); }
.pk-brand__mark span { display: block; border-radius: 2px; background: var(--pk-signal); }
.pk-brand__mark span:nth-child(2) { background: transparent; border: 2px solid var(--pk-signal); }
.pk-brand__mark span:nth-child(3) { grid-column: 1 / -1; height: 5px; align-self: end; }
.pk-brand__text { display: flex; flex-direction: column; line-height: 1.05; }
.pk-brand__text strong { font-family: var(--pk-font-body); font-weight: 700; letter-spacing: 0.01em; font-size: 1rem; }
.pk-brand__text small { color: var(--pk-dark-muted); font-size: 0.72rem; letter-spacing: 0.14em; text-transform: uppercase; }
.pk-topnav { display: flex; align-items: center; gap: 1.25rem; font-size: 0.94rem; }
.pk-topnav a { color: var(--pk-dark-muted); text-decoration: none; padding: 0.35rem 0; border-bottom: 2px solid transparent; }
.pk-topnav a:hover, .pk-topnav a[aria-current="page"] { color: var(--pk-dark-text); border-bottom-color: var(--pk-signal); }
.pk-search { position: relative; display: flex; align-items: center; gap: 0.5rem; max-width: 460px; width: 100%; justify-self: center; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 0 0.6rem 0 0.75rem; height: 38px; color: var(--pk-dark-muted); }
.pk-search:focus-within { border-color: var(--pk-signal); background: rgba(255,255,255,0.09); }
.pk-search__icon { font-size: 1.1rem; }
.pk-search input { flex: 1; min-width: 0; background: transparent; border: 0; color: var(--pk-dark-text); font: inherit; font-size: 0.94rem; outline: none; }
.pk-search input::placeholder { color: var(--pk-dark-muted); }
.pk-search kbd { border-color: rgba(255,255,255,0.18); background: transparent; color: var(--pk-dark-muted); font-size: 0.75rem; }
.pk-search__results { position: absolute; top: calc(100% + 8px); left: 0; right: 0; background: var(--pk-surface); color: var(--pk-ink); border: 1px solid var(--pk-border); border-radius: 10px; box-shadow: var(--pk-shadow); max-height: 60vh; overflow: auto; z-index: 50; }
.pk-search__results ul { list-style: none; margin: 0; padding: 0.35rem; }
.pk-search__results a { display: flex; flex-direction: column; gap: 0.1rem; padding: 0.55rem 0.7rem; border-radius: 6px; color: var(--pk-ink); text-decoration: none; font-size: 0.95rem; }
.pk-search__results a:hover, .pk-search__results a:focus { background: var(--pk-surface-muted); }
.pk-search__results a span { color: var(--pk-accent); font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 600; }
.pk-search__empty { margin: 0; padding: 0.8rem 1rem; color: var(--pk-ink-muted); font-size: 0.9rem; }

/* ---------- Home ---------- */
.pk-main { display: block; }
.pk-site--home .pk-main { width: min(1360px, 100% - 2.5rem); margin: 0 auto; padding: 2rem 0 4rem; overflow-x: clip; }
.pk-hero { display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(0, 1.1fr); gap: clamp(1.5rem, 4vw, 4rem); align-items: center; padding: clamp(2rem, 5vw, 4.5rem) 0 clamp(1.5rem, 3vw, 3rem); }
.pk-eyebrow { display: inline-block; color: var(--pk-accent); font-size: 0.76rem; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; margin-bottom: 0.9rem; }
.pk-hero h1 { margin: 0; font-family: var(--pk-font-display); font-weight: 400; font-size: clamp(2.4rem, 4.6vw, 4.1rem); line-height: 1.02; letter-spacing: -0.015em; }
.pk-hero__lede { margin: 1.25rem 0 0; max-width: 58ch; color: var(--pk-ink-muted); font-size: clamp(1.02rem, 1.4vw, 1.18rem); line-height: 1.6; }
.pk-hero__actions { display: flex; flex-wrap: wrap; gap: 0.75rem; margin-top: 1.75rem; }
.pk-button { display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.7rem 1.2rem; border-radius: 6px; border: 1px solid var(--pk-border-strong); color: var(--pk-ink); font-weight: 600; text-decoration: none; background: var(--pk-surface); }
.pk-button:hover { border-color: var(--pk-ink); color: var(--pk-ink); }
.pk-button--primary { background: var(--pk-signal); border-color: var(--pk-signal); color: #15221f; }
.pk-button--primary:hover { background: #c9e84a; border-color: #c9e84a; color: #15221f; }
.pk-hero__terminal { display: flex; align-items: center; gap: 0.6rem; margin-top: 1.5rem; padding: 0.55rem 0.6rem 0.55rem 0.9rem; max-width: 560px; background: var(--pk-code-bg); color: var(--pk-dark-text); border-radius: 8px; border: 1px solid rgba(255,255,255,0.08); font-family: var(--pk-font-mono); font-size: 0.9rem; overflow: hidden; }
.pk-hero__terminal code { background: transparent; color: inherit; padding: 0; flex: 1; min-width: 0; white-space: nowrap; overflow: auto; }
.pk-hero__prompt { color: var(--pk-signal); }
.pk-window { margin: 0; border-radius: 12px; background: var(--pk-surface); border: 1px solid var(--pk-border); box-shadow: var(--pk-shadow); overflow: hidden; }
.pk-window__bar { display: flex; align-items: center; gap: 6px; padding: 0.55rem 0.8rem; background: var(--pk-surface-muted); border-bottom: 1px solid var(--pk-border); }
.pk-window__bar span { width: 10px; height: 10px; border-radius: 50%; background: var(--pk-border-strong); opacity: 0.6; }
.pk-window__bar em { margin-left: auto; margin-right: auto; font-style: normal; font-family: var(--pk-font-mono); font-size: 0.72rem; color: var(--pk-ink-muted); }
.pk-window img { display: block; width: 100%; height: auto; }
.pk-window figcaption { padding: 0.6rem 0.9rem; font-size: 0.84rem; color: var(--pk-ink-muted); border-top: 1px solid var(--pk-border); }
.pk-section-title { margin: 0 0 1.1rem; font-family: var(--pk-font-display); font-weight: 400; font-size: clamp(1.5rem, 2.4vw, 2rem); }
.pk-paths, .pk-journey, .pk-all { padding: clamp(1.5rem, 3vw, 2.5rem) 0; border-top: 1px solid var(--pk-border); }
.pk-paths__grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 1rem; }
.pk-path { display: flex; flex-direction: column; gap: 0.45rem; padding: 1.4rem 1.4rem 1.2rem; background: var(--pk-surface); border: 1px solid var(--pk-border); border-radius: 12px; color: var(--pk-ink); text-decoration: none; transition: transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease; }
.pk-path:hover { transform: translateY(-2px); border-color: var(--pk-accent); box-shadow: var(--pk-shadow); color: var(--pk-ink); }
.pk-path__icon { display: grid; place-items: center; width: 40px; height: 40px; border-radius: 10px; background: var(--pk-dark); color: var(--pk-signal); font-size: 1.15rem; margin-bottom: 0.4rem; }
.pk-path__kicker { color: var(--pk-accent); font-size: 0.74rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; }
.pk-path strong { font-family: var(--pk-font-display); font-weight: 400; font-size: 1.45rem; line-height: 1.15; }
.pk-path__body { color: var(--pk-ink-muted); font-size: 0.95rem; }
.pk-path__cta { margin-top: auto; padding-top: 0.6rem; color: var(--pk-accent); font-weight: 600; font-size: 0.92rem; }
.pk-figure--plain { margin: 0; }
.pk-figure--plain img { width: 100%; height: auto; display: block; }
.pk-groups { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.25rem 2rem; }
.pk-group__title { margin: 0 0 0.6rem; color: var(--pk-ink-muted); font-size: 0.76rem; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; }
.pk-cards { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.6rem; counter-reset: card; }
.pk-card { display: grid; grid-template-columns: auto 1fr; grid-template-rows: auto auto; column-gap: 0.9rem; row-gap: 0.15rem; padding: 0.9rem 1rem; background: var(--pk-surface); border: 1px solid var(--pk-border); border-radius: 10px; color: var(--pk-ink); text-decoration: none; counter-increment: card; }
.pk-card::before { content: counter(card, decimal-leading-zero); grid-row: 1 / span 3; align-self: start; color: var(--pk-accent); font-family: var(--pk-font-mono); font-size: 0.8rem; padding-top: 0.2rem; }
.pk-card:hover { border-color: var(--pk-accent); color: var(--pk-ink); }
.pk-card__title { font-weight: 600; }
.pk-card__excerpt { color: var(--pk-ink-muted); font-size: 0.9rem; line-height: 1.45; }
.pk-card__meta { color: var(--pk-ink-muted); font-size: 0.76rem; }

/* ---------- Docs page layout ---------- */
.pk-docs { display: grid; grid-template-columns: 260px minmax(0, 1fr) 220px; gap: clamp(1.5rem, 3vw, 3.5rem); width: min(1360px, 100% - 2.5rem); margin: 0 auto; padding: 1.75rem 0 4rem; align-items: start; }
.pk-page { width: min(960px, 100% - 2.5rem); margin: 0 auto; padding: 2rem 0 4rem; }
.pk-page__head { margin-bottom: 2rem; }
.pk-page__head h1 { margin: 0; font-family: var(--pk-font-display); font-weight: 400; font-size: clamp(2.2rem, 4vw, 3.2rem); line-height: 1.05; }
.pk-lede { color: var(--pk-ink-muted); font-size: 1.12rem; line-height: 1.55; max-width: var(--pk-measure); }
.pk-sidebar { position: sticky; top: 80px; max-height: calc(100vh - 96px); overflow: auto; font-size: 0.93rem; }
.pk-sidebar__mobile { display: none; }
.pk-nav__groups, .pk-nav__links { list-style: none; margin: 0; padding: 0; }
.pk-nav__groups > li + li { margin-top: 1.25rem; }
.pk-nav__group { margin: 0 0 0.35rem; color: var(--pk-ink-muted); font-size: 0.72rem; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; }
.pk-nav__links a { display: block; padding: 0.38rem 0.7rem; margin-left: -0.7rem; border-left: 2px solid transparent; border-radius: 0 6px 6px 0; color: var(--pk-ink-muted); text-decoration: none; }
.pk-nav__links a:hover { color: var(--pk-ink); background: var(--pk-surface-muted); }
.pk-nav__links a[aria-current="page"] { color: var(--pk-ink); font-weight: 600; border-left-color: var(--pk-signal); background: var(--pk-surface); }
.pk-article { min-width: 0; }
.pk-breadcrumb { display: flex; flex-wrap: wrap; gap: 0.5rem; font-size: 0.85rem; color: var(--pk-ink-muted); }
.pk-breadcrumb a { color: var(--pk-ink-muted); text-decoration: none; }
.pk-breadcrumb a:hover { color: var(--pk-accent); }
.pk-article__meta { display: flex; gap: 1rem; margin: 0.6rem 0 1.5rem; font-size: 0.82rem; color: var(--pk-ink-muted); }
.pk-article__meta a { color: var(--pk-ink-muted); }
.pk-toc { position: sticky; top: 80px; max-height: calc(100vh - 96px); overflow: auto; font-size: 0.86rem; }
.pk-toc__title { margin: 0 0 0.5rem; color: var(--pk-ink-muted); font-size: 0.72rem; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; }
.pk-toc__list { list-style: none; margin: 0; padding: 0; border-left: 1px solid var(--pk-border); }
.pk-toc__item a { display: flex; align-items: baseline; gap: 0.45rem; padding: 0.3rem 0 0.3rem 0.85rem; margin-left: -1px; border-left: 2px solid transparent; color: var(--pk-ink-muted); text-decoration: none; line-height: 1.35; }
.pk-toc__item--h3 a { padding-left: 1.7rem; font-size: 0.82rem; }
.pk-toc__item a:hover { color: var(--pk-ink); }
.pk-toc__item a[aria-current="location"] { color: var(--pk-ink); border-left-color: var(--pk-accent); font-weight: 600; }
.pk-toc__step { display: inline-grid; place-items: center; min-width: 1.25rem; height: 1.25rem; border-radius: 999px; background: var(--pk-dark); color: var(--pk-signal); font-family: var(--pk-font-mono); font-size: 0.68rem; }
.pk-toc__source { margin: 1.25rem 0 0; color: var(--pk-ink-muted); font-size: 0.75rem; overflow-wrap: anywhere; }
.pk-toc__source code { font-size: 0.72rem; }
.pk-pager { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 3rem; padding-top: 1.5rem; border-top: 1px solid var(--pk-border); }
.pk-pager__link { display: flex; flex-direction: column; gap: 0.2rem; padding: 0.9rem 1rem; border: 1px solid var(--pk-border); border-radius: 10px; background: var(--pk-surface); color: var(--pk-ink); text-decoration: none; }
.pk-pager__link:hover { border-color: var(--pk-accent); color: var(--pk-ink); }
.pk-pager__link small { color: var(--pk-ink-muted); font-size: 0.78rem; }
.pk-pager__link--next { text-align: right; align-items: flex-end; }

/* ---------- Prose ---------- */
.pk-prose { font-size: 1.02rem; }
.pk-prose > :first-child { margin-top: 0; }
/* Text keeps a readable measure; figures and tables may use the whole column. */
.pk-prose > p, .pk-prose > ul, .pk-prose > ol, .pk-prose > h1, .pk-prose > h2, .pk-prose > h3, .pk-prose > h4,
.pk-prose > blockquote, .pk-prose > .pk-callout, .pk-prose > details, .pk-prose > hr, .pk-prose > .pk-lede { max-width: var(--pk-measure); }
.pk-prose > .pk-figure, .pk-prose > .pk-table-wrap, .pk-prose > .pk-code { max-width: 100%; }
.pk-prose > .pk-code { max-width: min(100%, 60rem); }
.pk-prose h1 { margin: 0 0 0.6rem; font-family: var(--pk-font-display); font-weight: 400; font-size: clamp(2.2rem, 4vw, 3.1rem); line-height: 1.05; letter-spacing: -0.01em; }
.pk-prose h2 { margin: 2.6rem 0 0.9rem; font-family: var(--pk-font-display); font-weight: 400; font-size: 1.75rem; line-height: 1.15; padding-top: 1.4rem; border-top: 1px solid var(--pk-border); }
.pk-prose h3 { margin: 1.9rem 0 0.6rem; font-size: 1.18rem; font-weight: 700; }
.pk-prose h4 { margin: 1.4rem 0 0.4rem; font-size: 1rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--pk-ink-muted); }
.pk-prose h2.pk-step, .pk-prose h3.pk-step { display: flex; align-items: center; gap: 0.8rem; }
.pk-prose .pk-step::before { content: attr(data-step); flex: none; display: grid; place-items: center; width: 2rem; height: 2rem; border-radius: 999px; background: var(--pk-dark); color: var(--pk-signal); font-family: var(--pk-font-mono); font-size: 0.95rem; font-weight: 600; }
.pk-prose h3.pk-step::before { width: 1.6rem; height: 1.6rem; font-size: 0.8rem; }
.pk-anchor { margin-left: 0.45rem; color: var(--pk-border-strong); text-decoration: none; font-family: var(--pk-font-body); font-size: 0.8em; opacity: 0; }
.pk-prose h1:hover .pk-anchor, .pk-prose h2:hover .pk-anchor, .pk-prose h3:hover .pk-anchor, .pk-prose h4:hover .pk-anchor, .pk-anchor:focus { opacity: 1; }
.pk-prose p, .pk-prose li { line-height: 1.68; }
.pk-prose p { margin: 0 0 1rem; }
.pk-prose ul, .pk-prose ol { margin: 0 0 1.1rem; padding-left: 1.4rem; }
.pk-prose li { margin: 0.3rem 0; }
.pk-prose li > p { margin: 0.4rem 0; }
.pk-prose ul ul, .pk-prose ol ul, .pk-prose ul ol, .pk-prose ol ol { margin: 0.3rem 0 0.4rem; }
.pk-prose ol > li::marker { color: var(--pk-accent); font-weight: 700; font-family: var(--pk-font-mono); font-size: 0.9em; }
.pk-task-list { list-style: none; padding-left: 0.2rem; }
.pk-task input { margin-right: 0.45rem; accent-color: var(--pk-accent); }
.pk-task--done { color: var(--pk-ink-muted); }
.pk-prose hr { border: 0; border-top: 1px solid var(--pk-border); margin: 2rem 0; }
.pk-prose blockquote { margin: 1.25rem 0; padding: 0.2rem 1.1rem; border-left: 3px solid var(--pk-border-strong); color: var(--pk-ink-muted); font-style: italic; }
.pk-prose blockquote p { margin: 0.4rem 0; }
.pk-prose strong { font-weight: 700; color: var(--pk-ink); }
.pk-prose del { color: var(--pk-ink-muted); }
.pk-prose img { max-width: 100%; height: auto; }
.pk-prose details { margin: 1rem 0 1.25rem; padding: 0.8rem 1rem; border: 1px solid var(--pk-border); border-radius: 8px; background: var(--pk-surface); }
.pk-prose summary { cursor: pointer; font-weight: 600; color: var(--pk-accent); }
.pk-prose details[open] summary { margin-bottom: 0.6rem; }

/* Tables */
.pk-table-wrap { margin: 1.25rem 0 1.5rem; overflow-x: auto; border: 1px solid var(--pk-border); border-radius: 10px; background: var(--pk-surface); }
.pk-prose table { width: 100%; min-width: 0; border-collapse: collapse; font-size: 0.93rem; }
.pk-prose th, .pk-prose td { padding: 0.65rem 0.9rem; text-align: left; vertical-align: top; border-bottom: 1px solid var(--pk-border); line-height: 1.45; }
.pk-prose th { background: var(--pk-surface-muted); color: var(--pk-ink); font-weight: 700; font-size: 0.78rem; letter-spacing: 0.06em; text-transform: uppercase; white-space: nowrap; }
.pk-prose tbody tr:last-child td { border-bottom: 0; }
.pk-prose tbody tr:hover td { background: color-mix(in srgb, var(--pk-surface-muted) 45%, transparent); }
.pk-prose td code { overflow-wrap: break-word; }

/* Code */
.pk-code { margin: 1.1rem 0 1.5rem; border-radius: 10px; background: var(--pk-code-bg); border: 1px solid rgba(255,255,255,0.06); overflow: hidden; box-shadow: 0 10px 30px rgba(21,34,31,0.12); }
.pk-code__bar { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; padding: 0.35rem 0.5rem 0.35rem 0.9rem; background: rgba(255,255,255,0.04); border-bottom: 1px solid rgba(255,255,255,0.06); }
.pk-code__lang { color: var(--pk-dark-muted); font-family: var(--pk-font-mono); font-size: 0.72rem; letter-spacing: 0.1em; text-transform: uppercase; }
.pk-code__copy { margin-left: auto; border: 1px solid rgba(255,255,255,0.14); background: transparent; color: var(--pk-dark-text); border-radius: 6px; padding: 0.25rem 0.6rem; font: inherit; font-size: 0.74rem; cursor: pointer; }
.pk-code__copy:hover { border-color: var(--pk-signal); color: var(--pk-signal); }
.pk-code__copy.is-done { background: var(--pk-signal); color: #15221f; border-color: var(--pk-signal); }
.pk-code pre { margin: 0; padding: 1rem 1.1rem; overflow: auto; color: #e8f0ea; font-size: 0.88rem; line-height: 1.6; tab-size: 4; }
.pk-code code { background: transparent; padding: 0; color: inherit; font-size: inherit; white-space: pre; }
.pk-code[data-language="text"] pre, .pk-code[data-language="console"] pre { color: #cfe3d8; }

/* Figures */
.pk-figure { margin: 1.5rem 0 1.75rem; }
.pk-figure img { display: block; width: 100%; height: auto; border: 1px solid var(--pk-border); border-radius: 10px; background: var(--pk-surface); box-shadow: var(--pk-shadow); }
.pk-figure figcaption { margin-top: 0.55rem; color: var(--pk-ink-muted); font-size: 0.86rem; line-height: 1.45; }
.pk-figure--wide { width: 100%; }
.pk-figure--plain img { border: 0; box-shadow: none; background: transparent; }
.pk-figure--diagram img, .pk-prose img[src$=".svg"] { box-shadow: none; background: var(--pk-surface); }

/* Callouts */
.pk-callout { display: grid; gap: 0.25rem; margin: 1.25rem 0 1.5rem; padding: 0.9rem 1.1rem 0.9rem 1rem; border: 1px solid var(--pk-border); border-left: 4px solid var(--pk-accent); border-radius: 10px; background: var(--pk-surface); }
.pk-callout__title { display: flex; align-items: center; gap: 0.55rem; margin: 0; font-weight: 700; font-size: 0.86rem; letter-spacing: 0.06em; text-transform: uppercase; }
.pk-callout__icon { display: inline-grid; place-items: center; width: 1.3rem; height: 1.3rem; border-radius: 999px; background: var(--pk-accent); color: var(--pk-accent-on); font-size: 0.75rem; font-weight: 700; font-style: normal; }
.pk-callout > *, .pk-callout__body, .pk-callout__body > * { min-width: 0; max-width: 100%; }
.pk-callout__body > :last-child { margin-bottom: 0; }
.pk-callout__body p { margin: 0.35rem 0; }
.pk-callout--note { border-left-color: var(--pk-focus); background: var(--pk-info-bg); }
.pk-callout--note .pk-callout__icon { background: var(--pk-focus); color: #fff; }
.pk-callout--tip { border-left-color: var(--pk-ok); background: var(--pk-ok-bg); }
.pk-callout--tip .pk-callout__icon { background: var(--pk-ok); color: #fff; }
.pk-callout--important { border-left-color: var(--pk-accent); background: var(--pk-surface); }
.pk-callout--warning { border-left-color: var(--pk-warn); background: var(--pk-warn-bg); }
.pk-callout--warning .pk-callout__icon { background: var(--pk-warn); color: #fff; }
.pk-callout--caution { border-left-color: var(--pk-danger); background: var(--pk-danger-bg); }
.pk-callout--caution .pk-callout__icon { background: var(--pk-danger); color: #fff; }
.pk-callout .pk-code { margin: 0.6rem 0 0.3rem; box-shadow: none; }

/* Footer */
.pk-footer { border-top: 1px solid var(--pk-border); background: var(--pk-surface); color: var(--pk-ink-muted); font-size: 0.88rem; }
.pk-footer__inner { width: min(1360px, 100% - 2.5rem); margin: 0 auto; padding: 1.75rem 0 2.5rem; display: grid; gap: 0.75rem; }
.pk-footer p { margin: 0; max-width: 80ch; }
.pk-footer__links { display: flex; flex-wrap: wrap; gap: 1.25rem; }

/* ---------- Responsive ---------- */
@media (max-width: 1180px) {
  .pk-docs { grid-template-columns: 240px minmax(0, 1fr); }
  .pk-toc { display: none; }
}
@media (max-width: 920px) {
  .pk-topbar__inner { grid-template-columns: auto 1fr; grid-template-rows: auto auto; height: auto; padding: 0.6rem 0; row-gap: 0.5rem; }
  .pk-search { grid-column: 1 / -1; grid-row: 2; max-width: none; }
  .pk-topnav { justify-self: end; gap: 0.9rem; font-size: 0.88rem; }
  .pk-hero { grid-template-columns: minmax(0, 1fr); }
  .pk-hero__copy, .pk-hero__shot { min-width: 0; }
  .pk-docs { grid-template-columns: minmax(0, 1fr); gap: 1rem; }
  .pk-sidebar { position: static; max-height: none; }
  .pk-sidebar__desktop { display: none; }
  .pk-sidebar__mobile { display: block; border: 1px solid var(--pk-border); border-radius: 10px; background: var(--pk-surface); padding: 0.6rem 0.9rem; }
  .pk-sidebar__mobile summary { cursor: pointer; font-weight: 600; }
  .pk-sidebar__mobile .pk-nav { margin-top: 0.8rem; }
  .pk-pager { grid-template-columns: 1fr; }
  .pk-pager__link--next { text-align: left; align-items: flex-start; }
  .pk-prose { font-size: 1rem; }
}
@media (max-width: 560px) {
  .pk-topnav { display: none; }
  .pk-hero__terminal { font-size: 0.8rem; }
  .pk-prose h2 { font-size: 1.5rem; }
}
@media print {
  .pk-topbar, .pk-sidebar, .pk-toc, .pk-pager, .pk-footer, .pk-code__copy, .pk-article__meta { display: none !important; }
  .pk-docs { grid-template-columns: 1fr; }
  .pk-code pre { white-space: pre-wrap; }
}
`;
}
