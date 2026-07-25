import { escapeHtml } from "../../../packages/contracts/src/index.mjs";
import { renderMarkdown } from "./markdown.mjs";

export function renderHomePage(site, overlay, contentEntries = []) {
  if (overlay?.manifest?.content) {
    return renderOverlayHomePage(site, overlay);
  }

  return renderLayout({
    title: "PlatformKit Docs",
    description: "Architecture, requirements, and decisions for PlatformKit OSS.",
    content: `
      ${renderDocsWelcome(contentEntries)}
      ${site.modules.length > 0 ? renderGeneratedDocsCatalog(site) : ""}
    `,
  });
}

function renderDocsWelcome(contentEntries) {
  const groups = groupContentEntries(contentEntries);

  return `
      <section class="hero hero--home">
        <div class="hero__copy">
          <span class="eyebrow">PlatformKit</span>
          <h1>PlatformKit Docs</h1>
          <p>Architecture, requirements, and decisions for a small trusted core, module-owned capability, and apps that compose business workflows.</p>
          <p>
            <a class="button" href="/docs">Browse the docs</a>
            <a class="button button--secondary" href="https://github.com/septagon-oss/platformkit">Source on GitHub</a>
          </p>
        </div>
      </section>
      <div class="pk-docs-index-grid">
        ${groups.map(([collection, entries]) => renderContentGroup(collectionTitle(collection), entries)).join("")}
      </div>
  `;
}

function renderOverlayHomePage(site, overlay) {
  const content = overlay.manifest.content;
  const metadata = content.metadata ?? {};
  const branding = content.branding ?? {};
  const bodyClass = joinClassNames([
    "overlay-public-shell",
    overlay.manifest.experience?.bodyClass,
    `overlay-homepage-${overlay.clientSlug}`,
  ]);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(metadata.title || "PlatformKit")}</title>
    <meta name="description" content="${escapeHtml(metadata.description || "")}" />
    ${metadata.keywords ? `<meta name="keywords" content="${escapeHtml(metadata.keywords)}" />` : ""}
    ${metadata.image ? `<meta property="og:image" content="${escapeHtml(metadata.image)}" />` : ""}
    ${branding.faviconUrl ? `<link rel="icon" href="${escapeAttribute(branding.faviconUrl)}" />` : ""}
    ${branding.appleTouchIconUrl ? `<link rel="apple-touch-icon" href="${escapeAttribute(branding.appleTouchIconUrl)}" />` : ""}
    <link rel="stylesheet" href="/assets/site.css" />
    ${(overlay.manifest.experience?.styles ?? [])
      .map((style) => `<link rel="stylesheet" href="/assets/overlays/${overlay.clientSlug}/${escapeAttribute(style)}" />`)
      .join("\n    ")}
    <style>${renderOverlayTokens(branding)}</style>
  </head>
  <body class="${escapeAttribute(bodyClass)}">
    ${renderAtlasPage(content, site)}
    ${(overlay.manifest.experience?.scripts ?? [])
      .map((script) => `<script src="/assets/overlays/${overlay.clientSlug}/${escapeAttribute(script)}" defer></script>`)
      .join("\n    ")}
  </body>
</html>`;
}

function renderAtlasPage(content, site) {
  return `
<div class="pk-page pk-atlas-page" data-platformkit-homepage data-platformkit-template="atlas">
  ${renderAtlasNav(content)}
  ${renderAtlasHero(content)}
  ${renderAtlasContracts(content)}
  ${renderAtlasModules(content, site)}
  ${renderAtlasTopologies(content)}
  ${renderAtlasCommercial(content)}
  ${renderAtlasProof(content)}
  ${renderAtlasFooter(content)}
</div>`;
}

function renderAtlasNav(content) {
  return renderPublicNav(content);
}

function renderPublicNav(content, options = {}) {
  const navbar = content.navbar ?? {};
  const anchorPrefix = options.anchorPrefix ?? "";
  const activeHref = options.activeHref ?? "";
  const navLinks = (navbar.links ?? []).map((item) => {
    const href = resolvePublicShellHref(normalizePublicLink(item.href), anchorPrefix);
    const active = activeHref && href === activeHref;
    return `<a href="${escapeAttribute(href)}"${active ? ' class="is-active"' : ""}>${escapeHtml(item.title)}</a>`;
  });
  const ctaHref = resolvePublicShellHref(normalizePublicLink(navbar.contactHref || "#get-started"), anchorPrefix);
  return `
<header class="pk-nav">
  <div class="pk-shell pk-nav__row">
    ${renderBrand(content)}
    <nav class="pk-nav__links" aria-label="Primary">
      ${navLinks.join("")}
    </nav>
    <a class="pk-nav__cta" href="${escapeAttribute(ctaHref)}">${escapeHtml(navbar.joinUsText || "Get PlatformKit")}</a>
  </div>
</header>`;
}

function renderAtlasHero(content) {
  const ui = content.ui ?? {};
  return `
<section class="pk-atlas-hero" id="get-started">
  <div class="pk-shell">
    <div class="pk-void-hero" data-pk-builder>
      <form class="pk-build-void" data-pk-build-form>
        <span class="pk-build-void__aura" aria-hidden="true"></span>
        <span class="pk-build-void__ring pk-build-void__ring--one" aria-hidden="true"></span>
        <span class="pk-build-void__ring pk-build-void__ring--two" aria-hidden="true"></span>

        <label class="pk-build-void__line" for="pk-build-intent">${escapeHtml(ui.builderPrompt || "I want to build")}</label>
        <input id="pk-build-intent" data-pk-build-input name="intent" type="text" autocomplete="off" placeholder="${escapeAttribute(
          ui.builderPlaceholder || "the product that keeps returning...",
        )}" required />

        <div class="pk-build-void__email" data-pk-email-step>
          <label for="pk-build-email">${escapeHtml(ui.builderEmailLabel || "Send the first workspace to")}</label>
          <input id="pk-build-email" data-pk-build-email name="email" type="email" autocomplete="email" placeholder="you@company.com" required />
        </div>

        <button class="pk-build-void__submit" data-pk-build-submit type="submit">${escapeHtml(ui.builderSubmit || "Start shaping it")}</button>
        <p class="pk-build-void__status" data-pk-build-status aria-live="polite">${escapeHtml(
          ui.builderStatus || "Describe the product that keeps returning.",
        )}</p>
      </form>
    </div>
  </div>
</section>`;
}

function renderAtlasContracts(content) {
  const ui = content.ui ?? {};
  const hero = content.home ?? {};
  return `
<section class="pk-atlas-contracts" id="enterprise">
  <div class="pk-shell pk-atlas-section-grid">
    <header class="pk-atlas-section-head">
      ${renderKicker(hero.badge)}
      <h2>${escapeHtml(ui.experienceSectionsTitle || "")}</h2>
    </header>
    <ol class="pk-atlas-contract-list">
      ${(content.sections ?? [])
        .slice(0, 6)
        .map(
          (section) => `
        <li id="${escapeAttribute(section.id)}">
          <span>${escapeHtml(section.id)}</span>
          <div>
            <h3>${escapeHtml(section.title)}</h3>
            <p>${escapeHtml(section.subtitle)}</p>
            ${section.buttonText ? `<a href="${escapeAttribute(normalizePublicLink(section.buttonHref))}">${escapeHtml(section.buttonText)}</a>` : ""}
          </div>
        </li>`,
        )
        .join("")}
    </ol>
  </div>
</section>`;
}

function renderAtlasModules(content, site) {
  const ui = content.ui ?? {};
  return `
<section class="pk-atlas-modules" id="modules">
  <div class="pk-shell">
    <header class="pk-atlas-band-head">
      <span>${escapeHtml(ui.modulesLabel || "Modules")}</span>
      <h2>${escapeHtml(ui.moduleFootprintTitle || "Module footprint")}</h2>
    </header>
    <div class="pk-atlas-module-ledger">
      ${homepageModules(site)
        .slice(0, 8)
        .map(
          (module) => `
        <article class="pk-module pk-atlas-module">
          <span>${escapeHtml(module.category)}</span>
          <h3>${escapeHtml(module.title)}</h3>
          <p>${module.entityCount} ${escapeHtml(ui.entitiesWord || "Entities")} / ${module.featureCount} ${escapeHtml(
            ui.featuresWord || "Features",
          )}</p>
        </article>`,
        )
        .join("")}
    </div>
  </div>
</section>`;
}

function renderAtlasTopologies(content) {
  const commodities = content.commodities ?? {};
  return `
<section class="pk-atlas-topologies" id="integrations">
  <div class="pk-shell pk-atlas-topology-grid">
    <header>
      ${renderKicker(commodities.title)}
      <h2>${escapeHtml(commodities.subtitle || "")}</h2>
      ${commodities.joinButton ? `<a class="pk-button pk-button--secondary" href="${escapeAttribute(normalizePublicLink(commodities.buttonHref))}">${escapeHtml(commodities.joinButton)}</a>` : ""}
    </header>
    <ul>
      ${(commodities.items ?? []).map((item) => `<li>${escapeHtml(item.label)}</li>`).join("")}
    </ul>
  </div>
</section>`;
}

function renderAtlasCommercial(content) {
  const pricing = content.pricing ?? {};
  return `
<section class="pk-atlas-commercial" id="pricing">
  <div class="pk-shell pk-atlas-section-grid">
    <header class="pk-atlas-section-head">
      ${renderKicker(pricing.monthlyLabel)}
      <h2>${escapeHtml(pricing.title || "")}</h2>
      <p>${escapeHtml(pricing.subtitle || "")}</p>
    </header>
    <div class="pk-atlas-plan-ledger">
      ${(pricing.plans ?? [])
        .map(
          (plan, index) => `
      <article class="${index === 1 ? "is-featured" : ""}">
        <span>${escapeHtml(plan.name)}</span>
        <strong>${escapeHtml(homepagePlanPrice(plan))}</strong>
        <p>${escapeHtml(plan.subtext || pricing.taxLabel || "")}</p>
        ${plan.buttonText ? `<a href="${escapeAttribute(normalizePublicLink(plan.buttonHref))}">${escapeHtml(plan.buttonText)}</a>` : ""}
      </article>`,
        )
        .join("")}
    </div>
  </div>
</section>`;
}

function renderAtlasProof(content) {
  const ui = content.ui ?? {};
  return `
<section class="pk-atlas-proof" id="about">
  <div class="pk-shell">
    <header class="pk-atlas-band-head">
      <span>${escapeHtml(ui.testimonialsTitle || "")}</span>
      <h2>${escapeHtml(ui.testimonialsSubtitle || "")}</h2>
    </header>
    <div class="pk-atlas-proof-list">
      ${(content.testimonials ?? [])
        .map(
          (item) => `
      <article>
        <strong>${escapeHtml(item.name)}</strong>
        <span>${escapeHtml(item.role || "")}</span>
        <p>${escapeHtml(item.quote)}</p>
      </article>`,
        )
        .join("")}
    </div>
  </div>
</section>`;
}

function renderAtlasFooter(content) {
  const footer = content.footer ?? {};
  const contact = content.contact ?? {};
  return `
<footer class="pk-footer" id="contact">
  <div class="pk-shell pk-footer__grid">
    <div class="pk-footer__brand">
      ${renderBrand(content)}
      <p>${escapeHtml(footer.description || "")}</p>
    </div>
    <div class="pk-footer__links">
      ${renderFooterLink(mailtoURL(contact.email), contact.email)}
      ${renderFooterLink(externalURL(contact.website), contact.website)}
      ${(content.social ?? []).map((item) => renderFooterLink(externalURL(item.url), item.label)).join("")}
      ${footer.termsConditions ? `<a href="${escapeAttribute(normalizePublicLink(footer.termsHref))}">${escapeHtml(footer.termsConditions)}</a>` : ""}
      ${footer.privacyPolicy ? `<a href="${escapeAttribute(normalizePublicLink(footer.privacyHref))}">${escapeHtml(footer.privacyPolicy)}</a>` : ""}
    </div>
  </div>
</footer>`;
}

function renderGeneratedDocsCatalog(site) {
  const featured = site.modules.find((module) => module.id === site.featuredModuleId) ?? site.modules[0] ?? null;
  const cards = site.modules
    .map(
      (module) => `
        <a class="module-card" href="/modules/${module.id}/">
          <span class="module-card__eyebrow">${escapeHtml(module.module.category || "module")}</span>
          <h2>${escapeHtml(module.title)}</h2>
          <p>${escapeHtml(module.summary)}</p>
          <dl class="module-card__stats">
            <div><dt>Features</dt><dd>${module.stats.featureCount}</dd></div>
            <div><dt>API Ops</dt><dd>${module.stats.operationCount}</dd></div>
            <div><dt>Showcases</dt><dd>${module.stats.showcaseCount}</dd></div>
          </dl>
        </a>
      `,
    )
    .join("");

  return `
      <section class="section" id="docs">
        <div class="section__header">
          <span class="eyebrow">Module catalog</span>
          <h1>PlatformKit Docs</h1>
          <h2>Composed from neutral docs bundles</h2>
          ${featured ? `<p>Start with <a href="/modules/${featured.id}/">${escapeHtml(featured.title)}</a>, then move through the generated module pages.</p>` : ""}
        </div>
        <div class="module-grid">${cards || renderEmptyModuleCatalog()}</div>
      </section>
    `;
}

function renderEmptyModuleCatalog() {
  return `
      <article class="empty-state">
        <h3>Public module docs are not attached yet.</h3>
        <p>
          As public modules gain neutral docs bundles, this catalog will
          populate from the generated composition model.
        </p>
      </article>
    `;
}

function renderBrand(content) {
  const branding = content.branding ?? {};
  return `
<a class="pk-brand" href="/">
  <span class="pk-brand__mark" aria-hidden="true"></span>
  <span class="pk-brand__text">${escapeHtml(branding.logoAlt || "platformkit")}</span>
</a>`;
}

function renderKicker(value) {
  return value ? `<p class="pk-kicker">${escapeHtml(value)}</p>` : "";
}

function renderOverlayTokens(branding) {
  return `
:root{
  --nav-h:3.5rem;
  --color-primary:${sanitizeColor(branding.primaryColor, "#14b8a6")};
  --color-secondary:${sanitizeColor(branding.secondaryColor, "#2563eb")};
  --color-accent:${sanitizeColor(branding.accentColor, "#f59e0b")};
  --pk-primary:var(--color-primary);
  --pk-secondary:var(--color-secondary);
  --pk-accent:var(--color-accent);
}
html{scroll-behavior:smooth;scroll-padding-top:6rem}
body{font-family:${sanitizeFontFamily(branding.fontFamily, "Inter")}, "Avenir Next", "Segoe UI", sans-serif}
`;
}

function homepageModules(site) {
  if (site.modules.length > 0) {
    return site.modules.map((module) => ({
      moduleId: module.id,
      category: module.module.category || "module",
      title: module.title,
      entityCount: module.stats.operationCount,
      featureCount: module.stats.featureCount,
    }));
  }

  return [
    { moduleId: "pk-core", category: "framework", title: "Core runtime", entityCount: 0, featureCount: 4 },
    { moduleId: "pk-modules", category: "modules", title: "Module pack", entityCount: 0, featureCount: 6 },
    { moduleId: "pk-design", category: "design", title: "Design system", entityCount: 0, featureCount: 5 },
    { moduleId: "pk-client", category: "client", title: "Client contract", entityCount: 0, featureCount: 3 },
    { moduleId: "pk-docs", category: "docs", title: "Docs substrate", entityCount: 0, featureCount: 4 },
    { moduleId: "pk-apps", category: "apps", title: "Reference apps", entityCount: 0, featureCount: 3 },
  ];
}

function homepagePlanPrice(plan) {
  const price = Number(plan.monthlyPrice ?? 0);
  return price > 0 ? `EUR ${price}` : "Custom";
}

function normalizePublicLink(link) {
  const raw = String(link ?? "").trim();
  if (!raw) return "";
  if (raw.startsWith("#")) return raw;
  try {
    const parsed = new URL(raw, "http://platformkit.local");
    if (parsed.origin !== "http://platformkit.local") {
      return safeExternalURL(parsed);
    }
    if (parsed.pathname.startsWith("/en/") || parsed.pathname.startsWith("/pt/")) {
      parsed.pathname = `/${parsed.pathname.split("/").slice(2).join("/")}`;
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}` || "/";
  } catch {
    return "";
  }
}

function resolvePublicShellHref(href, anchorPrefix) {
  const raw = String(href ?? "").trim();
  if (anchorPrefix && raw.startsWith("#")) {
    return `${anchorPrefix}${raw}`;
  }
  return raw;
}

function externalURL(link) {
  const raw = String(link ?? "").trim();
  if (!raw) return "";
  try {
    const parsed = new URL(/^[A-Za-z][A-Za-z0-9+.-]*:/.test(raw) ? raw : `https://${raw}`);
    return safeExternalURL(parsed);
  } catch {
    return "";
  }
}

function mailtoURL(email) {
  const raw = String(email ?? "").trim();
  if (!raw || /[\r\n<>"\s]/.test(raw) || !/^[^@]+@[^@]+\.[^@]+$/.test(raw)) {
    return "";
  }
  return `mailto:${raw}`;
}

function safeExternalURL(parsed) {
  if (!["http:", "https:", "mailto:", "tel:"].includes(parsed.protocol)) {
    return "";
  }
  return parsed.toString();
}

function renderFooterLink(href, label) {
  if (!href || !String(label ?? "").trim()) {
    return "";
  }
  return `<a href="${escapeAttribute(href)}">${escapeHtml(label)}</a>`;
}

function sanitizeColor(value, fallback) {
  const raw = String(value ?? "").trim();
  return /^#[0-9a-fA-F]{6}$/.test(raw) ? raw : fallback;
}

function sanitizeFontFamily(value, fallback) {
  const raw = String(value ?? "").trim();
  return /^[A-Za-z0-9 _-]{1,80}$/.test(raw) ? JSON.stringify(raw) : JSON.stringify(fallback);
}

function escapeAttribute(value) {
  return escapeHtml(String(value ?? ""));
}

export function renderModulePage(module, options = {}) {
  return renderLayout({
    title: `${module.title} | PlatformKit Docs`,
    description: module.summary,
    overlay: options.overlay,
    content: `
      <nav class="breadcrumb">
        <a href="/">PlatformKit Docs</a>
        <span>/</span>
        <span>${escapeHtml(module.title)}</span>
      </nav>

      <section class="hero hero--module">
        <div class="hero__copy">
          <span class="eyebrow">${escapeHtml(module.module.category || "module")}</span>
          <h1>${escapeHtml(module.title)}</h1>
          <p>${escapeHtml(module.summary)}</p>
          <dl class="inline-meta">
            <div><dt>Module ID</dt><dd>${escapeHtml(module.id)}</dd></div>
            <div><dt>Base path</dt><dd>${escapeHtml(module.module.basePath || "_none_")}</dd></div>
            <div><dt>Version</dt><dd>${escapeHtml(module.module.version || "_none_")}</dd></div>
            <div><dt>Archetype</dt><dd>${escapeHtml(module.module.archetype || "_none_")}</dd></div>
          </dl>
        </div>
      </section>

      <div class="section-grid">
        <section class="panel panel--wide">
          <div class="section__header">
            <span class="eyebrow">Narrative</span>
            <h2>Human-owned context</h2>
          </div>
          <div class="markdown-body">${renderMarkdown(module.narrativeBody)}</div>
        </section>

        <section class="panel">
          <div class="section__header">
            <span class="eyebrow">Stats</span>
            <h2>Surface summary</h2>
          </div>
          <dl class="stacked-stats">
            ${renderStat("Features", module.stats.featureCount)}
            ${renderStat("Dependencies", module.stats.dependencyCount)}
            ${renderStat("API operations", module.stats.operationCount)}
            ${renderStat("Showcases", module.stats.showcaseCount)}
            ${renderStat("Events", module.stats.eventCount)}
          </dl>
        </section>
      </div>

      ${renderFeatures(module)}
      ${renderAPI(module)}
      ${renderShowcases(module)}
      ${renderDependencies(module)}
      ${renderEvents(module)}
    `,
  });
}

export function renderContentIndexPage(contentEntries, options = {}) {
  const groups = groupContentEntries(contentEntries);
  return renderLayout({
    title: "PlatformKit Docs",
    description: "Architecture, requirements, and decisions for PlatformKit OSS.",
    overlay: options.overlay,
    activeHref: "/docs",
    content: `
      <section class="pk-docs-hero pk-shell">
        <div>
          <span class="pk-docs-kicker">Docs</span>
          <h1>PlatformKit Docs</h1>
          <p>Architecture, requirements, and decisions for a small trusted core, module-owned capability, and apps that compose business workflows.</p>
        </div>
      </section>

      <div class="pk-docs-index-grid pk-shell">
        ${groups.map(([collection, entries]) => renderContentGroup(collectionTitle(collection), entries)).join("")}
      </div>
    `,
  });
}

export function renderContentPage(entry, contentEntries = [], options = {}) {
  return renderLayout({
    title: `${entry.title} | PlatformKit Docs`,
    description: entry.excerpt,
    overlay: options.overlay,
    activeHref: "/docs",
    content: `
      <nav class="pk-docs-breadcrumb pk-shell">
        <a href="/">PlatformKit</a>
        <span>/</span>
        <a href="/docs">Docs</a>
        <span>/</span>
        <span>${escapeHtml(entry.title)}</span>
      </nav>

      <section class="pk-docs-hero pk-shell">
        <div>
          <span class="pk-docs-kicker">${escapeHtml(entry.collection || "docs")}</span>
          <h1>${escapeHtml(entry.title)}</h1>
          <p>${escapeHtml(entry.excerpt)}</p>
          <dl class="pk-docs-meta">
            <div><dt>Source</dt><dd>${escapeHtml(entry.sourcePath)}</dd></div>
            <div><dt>Route</dt><dd>${escapeHtml(entry.route)}</dd></div>
          </dl>
        </div>
      </section>

      <div class="pk-docs-layout pk-shell">
        <article class="pk-docs-panel pk-docs-article markdown-body">
          ${entry.contentHtml || renderMarkdown(entry.content)}
        </article>
        <aside class="pk-docs-panel pk-docs-aside">
          <div class="pk-docs-panel-head">
            <span class="pk-docs-kicker">Nearby</span>
            <h2>${escapeHtml(collectionTitle(entry.collection))}</h2>
          </div>
          <ul class="pk-docs-list">
            ${contentEntries
              .filter((item) => item.collection === entry.collection)
              .slice(0, 24)
              .map((item) => `<li><a href="${escapeAttribute(item.route)}">${escapeHtml(item.title)}</a></li>`)
              .join("")}
          </ul>
        </aside>
      </div>
    `,
  });
}

export const renderDocsIndexPage = renderContentIndexPage;
export const renderDocsPage = renderContentPage;

export function renderStyles() {
  return `
:root {
  --ink: #0f172a;
  --muted: #475569;
  --paper: #f8f4eb;
  --paper-strong: #fffaf2;
  --line: rgba(15, 23, 42, 0.14);
  --accent: #af3f1d;
  --accent-soft: #ffd8c7;
  --card: rgba(255, 250, 242, 0.88);
  --shadow: 0 28px 60px rgba(15, 23, 42, 0.12);
}

* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  font-family: "Iowan Old Style", "Palatino Linotype", "Book Antiqua", serif;
  color: var(--ink);
  background:
    radial-gradient(circle at top left, rgba(175, 63, 29, 0.12), transparent 30%),
    linear-gradient(180deg, #f4efe5 0%, #efe7d8 100%);
}
a { color: inherit; }
code {
  font-family: "Berkeley Mono", "SFMono-Regular", "Cascadia Code", monospace;
  background: rgba(15, 23, 42, 0.06);
  padding: 0.1rem 0.35rem;
  border-radius: 0.35rem;
}
.shell {
  width: min(1180px, calc(100vw - 2rem));
  margin: 0 auto;
  padding: 2rem 0 4rem;
}
.topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  margin-bottom: 2rem;
}
.brand {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  text-decoration: none;
}
.brand-mark {
  display: grid;
  width: 42px;
  height: 42px;
  place-items: center;
  border: 1px solid var(--ink);
  background: var(--ink);
  color: var(--paper);
  font-family: "Avenir Next Condensed", "Franklin Gothic Medium", sans-serif;
  font-weight: 800;
}
.brand strong,
.brand small {
  display: block;
}
.brand strong {
  font-family: "Avenir Next Condensed", "Franklin Gothic Medium", sans-serif;
  font-size: 1rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.brand small {
  color: var(--muted);
  font-size: 0.78rem;
}
.top-nav {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px 18px;
  color: var(--muted);
  font-family: "Avenir Next", "Segoe UI", sans-serif;
  font-size: 0.94rem;
}
.top-nav a,
.text-link {
  text-decoration-color: color-mix(in oklch, var(--accent), transparent 20%);
  text-decoration-thickness: 2px;
  text-underline-offset: 4px;
}
.badge {
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.5);
  padding: 0.45rem 0.8rem;
  border-radius: 999px;
  color: var(--muted);
  font-size: 0.9rem;
}
.hero {
  display: grid;
  grid-template-columns: minmax(0, 1.9fr) minmax(250px, 0.9fr);
  gap: 1.25rem;
  padding: 2rem;
  border: 1px solid var(--line);
  border-radius: 1.5rem;
  background: linear-gradient(135deg, rgba(255, 250, 242, 0.92), rgba(255, 238, 224, 0.85));
  box-shadow: var(--shadow);
}
.hero--home {
  grid-template-columns: minmax(0, 1.15fr) minmax(280px, 0.85fr);
  gap: clamp(32px, 6vw, 76px);
  align-items: end;
  min-height: min(780px, calc(100vh - 90px));
  padding: clamp(44px, 8vw, 110px) 0 clamp(44px, 7vw, 86px);
  border: 0;
  border-top: 1px solid var(--line);
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}
.hero--module {
  grid-template-columns: 1fr;
  margin-bottom: 2rem;
}
.hero--home .hero__copy h1 {
  max-width: 10ch;
  margin-bottom: 0.45rem;
  font-size: clamp(4.1rem, 14vw, 9.4rem);
  line-height: 0.9;
}
.hero-titleline {
  margin: 0 0 1rem;
  font-family: "Iowan Old Style", "Palatino Linotype", "Book Antiqua", serif;
  font-size: clamp(1.8rem, 4vw, 3.8rem);
  font-weight: 700;
  line-height: 1.02;
}
.hero-lede,
.statement p,
.readiness p,
.closing p {
  max-width: 720px;
  color: var(--muted);
  font-size: clamp(1.08rem, 1.7vw, 1.32rem);
}
.hero__copy h1 {
  margin: 0 0 0.75rem;
  font-size: clamp(2.4rem, 5vw, 4.8rem);
  line-height: 0.95;
}
.hero__copy p {
  margin: 0;
  font-size: 1.1rem;
  line-height: 1.6;
  max-width: 60ch;
}
.hero__meta,
.inline-meta,
.stacked-stats,
.module-card__stats {
  margin: 0;
}
.hero__meta {
  display: grid;
  gap: 0.85rem;
  align-content: start;
}
.hero__meta div,
.stacked-stats div,
.module-card__stats div {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  border-bottom: 1px solid var(--line);
  padding-bottom: 0.55rem;
}
.hero__meta span,
.stacked-stats dt,
.module-card__stats dt,
.inline-meta dt {
  color: var(--muted);
}
.hero__meta strong,
.stacked-stats dd,
.module-card__stats dd,
.inline-meta dd {
  margin: 0;
  font-weight: 700;
}
.hero__actions { margin-top: 1.25rem; }
.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  text-decoration: none;
  border-radius: 999px;
  background: var(--accent);
  color: white;
  padding: 0.9rem 1.1rem;
  font-family: "Avenir Next", "Segoe UI", sans-serif;
}
.button--secondary {
  border: 1px solid var(--ink);
  background: transparent;
  color: var(--ink);
}
.proof-board {
  border: 1px solid var(--line);
  border-radius: 0.5rem;
  background:
    linear-gradient(135deg, color-mix(in oklch, var(--paper), white 26%), var(--paper-strong));
  padding: clamp(20px, 3vw, 34px);
}
.proof-label {
  margin: 0 0 14px;
  color: var(--accent);
  font-family: "Avenir Next", "Segoe UI", sans-serif;
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.proof-board ol {
  display: grid;
  counter-reset: hierarchy;
  gap: 14px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.proof-board li {
  display: grid;
  counter-increment: hierarchy;
  grid-template-columns: auto 1fr;
  gap: 10px 16px;
  align-items: baseline;
  border-top: 1px solid var(--line);
  padding-top: 14px;
}
.proof-board li::before {
  content: counter(hierarchy, decimal-leading-zero);
  color: #9a641f;
  font-weight: 800;
}
.proof-board span {
  display: block;
  grid-column: 2;
  color: var(--muted);
}
.eyebrow {
  display: inline-block;
  margin-bottom: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.11em;
  font-size: 0.8rem;
  color: var(--accent);
}
.section {
  margin-top: 2rem;
}
.statement,
.product-ledger,
.readiness,
.closing,
#docs {
  border-top: 1px solid var(--line);
  padding-block: clamp(52px, 8vw, 96px);
}
.statement {
  max-width: 980px;
}
.statement h2,
.product-ledger h2,
.readiness h2,
.closing h2 {
  margin: 0 0 18px;
  font-size: clamp(2rem, 5vw, 4.25rem);
  line-height: 1;
}
.section-kicker {
  display: grid;
  grid-template-columns: minmax(0, 0.76fr) minmax(0, 1.24fr);
  gap: clamp(24px, 5vw, 64px);
  align-items: start;
  margin-bottom: 30px;
}
.section-kicker .eyebrow {
  margin-top: 8px;
}
.product-list {
  border-top: 1px solid var(--ink);
}
.product-row {
  display: grid;
  grid-template-columns: minmax(170px, 0.42fr) minmax(0, 1fr);
  gap: 24px;
  padding-block: 22px;
  border-bottom: 1px solid var(--line);
}
.product-row p {
  margin-bottom: 0;
  color: var(--muted);
}
.product-row > p {
  color: var(--ink);
}
.readiness {
  display: grid;
  grid-template-columns: minmax(0, 0.95fr) minmax(280px, 1.05fr);
  gap: clamp(28px, 6vw, 76px);
  align-items: start;
}
.readiness-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.readiness-list li {
  min-height: 54px;
  border: 1px solid var(--line);
  border-radius: 0.5rem;
  background: color-mix(in oklch, var(--paper), white 40%);
  padding: 13px 14px;
  font-family: "Avenir Next", "Segoe UI", sans-serif;
  font-weight: 700;
}
.closing {
  padding-bottom: clamp(70px, 10vw, 128px);
}
.text-link {
  color: #25483d;
  font-weight: 800;
}
.section-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.6fr) minmax(280px, 0.8fr);
  gap: 1.25rem;
  margin-top: 2rem;
}
.panel {
  border: 1px solid var(--line);
  border-radius: 1.25rem;
  background: var(--card);
  padding: 1.35rem;
  box-shadow: var(--shadow);
}
.panel--wide { min-width: 0; }
.section__header h2 {
  margin: 0.1rem 0 1rem;
  font-size: 1.7rem;
}
.module-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
}
.module-card {
  display: block;
  text-decoration: none;
  padding: 1.25rem;
  border-radius: 0.5rem;
  border: 1px solid var(--line);
  background: var(--card);
  box-shadow: var(--shadow);
}
.empty-state {
  border: 1px solid var(--line);
  border-radius: 0.5rem;
  background: var(--card);
  padding: 1.25rem;
}
.empty-state h3 {
  margin: 0 0 0.5rem;
}
.empty-state p {
  margin: 0;
  color: var(--muted);
}
.module-card h2 {
  margin: 0 0 0.55rem;
  font-size: 1.45rem;
}
.module-card p {
  margin: 0 0 1rem;
  color: var(--muted);
}
.module-card__eyebrow {
  display: inline-block;
  margin-bottom: 0.7rem;
  color: var(--accent);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-size: 0.78rem;
}
.module-card__stats {
  display: grid;
  gap: 0.55rem;
}
.inline-meta {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
  gap: 0.7rem 1rem;
  margin-top: 1.25rem;
}
.inline-meta div {
  border-top: 1px solid var(--line);
  padding-top: 0.75rem;
}
.table-wrap {
  overflow-x: auto;
}
table {
  width: 100%;
  border-collapse: collapse;
  min-width: 720px;
}
th, td {
  text-align: left;
  padding: 0.8rem 0.55rem;
  border-bottom: 1px solid var(--line);
  vertical-align: top;
}
th {
  font-family: "Avenir Next", "Segoe UI", sans-serif;
  font-size: 0.82rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--muted);
}
.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}
.tag {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 0.22rem 0.6rem;
  background: var(--accent-soft);
  color: #6e2611;
  font-size: 0.82rem;
}
.showcase-grid {
  display: grid;
  gap: 1rem;
}
.showcase {
  border: 1px solid var(--line);
  border-radius: 1.15rem;
  padding: 1.15rem;
  background: rgba(255, 255, 255, 0.5);
}
.showcase h3,
.feature-card h3 {
  margin-top: 0;
}
.feature-grid {
  display: grid;
  gap: 1rem;
}
.feature-card {
  border: 1px solid var(--line);
  border-radius: 1rem;
  padding: 1rem;
  background: rgba(255, 255, 255, 0.45);
}
.list {
  margin: 0;
  padding-left: 1.1rem;
}
.list li {
  margin-bottom: 0.35rem;
}
.markdown-body h1,
.markdown-body h2,
.markdown-body h3 { margin-top: 1.4rem; }
.markdown-body p,
.markdown-body li { line-height: 1.65; }
.breadcrumb {
  display: inline-flex;
  gap: 0.5rem;
  align-items: center;
  margin-bottom: 1rem;
  color: var(--muted);
}
.pk-docs-main {
  position: relative;
  z-index: 1;
  padding: clamp(2.5rem, 5vw, 5rem) 0 clamp(5rem, 8vw, 8rem);
}
.pk-docs-hero {
  display: grid;
  gap: 1rem;
  padding: clamp(3rem, 6vw, 6rem) 0 clamp(2.25rem, 5vw, 4rem);
}
.pk-docs-hero h1 {
  max-width: 12ch;
  margin: 0;
  color: var(--pk-ink, var(--ink));
  font-family: "Inter", "Avenir Next", "Segoe UI", sans-serif;
  font-size: clamp(3.4rem, 10vw, 7.6rem);
  font-weight: 820;
  letter-spacing: 0;
  line-height: 0.9;
}
.pk-docs-hero p {
  max-width: 760px;
  margin: 1.2rem 0 0;
  color: var(--pk-ink-soft, var(--muted));
  font-size: clamp(1.08rem, 1.8vw, 1.38rem);
  line-height: 1.55;
}
.pk-docs-kicker {
  display: inline-block;
  margin-bottom: 0.85rem;
  color: var(--pk-primary, var(--accent));
  font-family: "Inter", "Avenir Next", "Segoe UI", sans-serif;
  font-size: 0.78rem;
  font-weight: 780;
  letter-spacing: 0;
  text-transform: uppercase;
}
.pk-docs-index-grid,
.pk-docs-layout {
  display: grid;
  gap: 1rem;
}
.pk-docs-index-grid {
  grid-template-columns: minmax(0, 0.75fr) minmax(0, 1.35fr) minmax(0, 0.9fr);
  align-items: start;
}
.pk-docs-layout {
  grid-template-columns: minmax(0, 1fr) minmax(18rem, 0.34fr);
  align-items: start;
}
.pk-docs-panel {
  border: 1px solid var(--pk-line, var(--line));
  background: color-mix(in srgb, var(--pk-panel, var(--card)) 84%, white 16%);
  box-shadow: none;
}
.pk-docs-panel,
.pk-docs-article {
  padding: clamp(1.1rem, 2vw, 1.65rem);
}
.pk-docs-article {
  min-width: 0;
}
.pk-docs-panel-head h2 {
  margin: 0 0 1rem;
  color: var(--pk-ink, var(--ink));
  font-family: "Inter", "Avenir Next", "Segoe UI", sans-serif;
  font-size: clamp(1.35rem, 2.4vw, 2rem);
  letter-spacing: 0;
  line-height: 1;
}
.pk-docs-list {
  display: grid;
  gap: 0;
  max-height: min(72vh, 56rem);
  margin: 0;
  padding: 0;
  overflow: auto;
  list-style: none;
}
.pk-docs-list li {
  border-top: 1px solid var(--pk-line, var(--line));
}
.pk-docs-list a {
  display: block;
  padding: 0.78rem 0;
  color: var(--pk-ink-soft, var(--muted));
  text-decoration: none;
  line-height: 1.35;
}
.pk-docs-list a:hover {
  color: var(--pk-ink, var(--ink));
}
.pk-docs-meta {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
  gap: 0.75rem;
  max-width: 760px;
  margin: 1.5rem 0 0;
}
.pk-docs-meta div {
  border-top: 1px solid var(--pk-line, var(--line));
  padding-top: 0.75rem;
}
.pk-docs-meta dt {
  color: var(--pk-ink-faint, var(--muted));
  font-size: 0.82rem;
}
.pk-docs-meta dd {
  margin: 0.2rem 0 0;
  overflow-wrap: anywhere;
  color: var(--pk-ink, var(--ink));
  font-weight: 720;
}
.pk-docs-breadcrumb {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
  color: var(--pk-ink-faint, var(--muted));
  font-size: 0.95rem;
}
.pk-docs-breadcrumb a {
  color: var(--pk-ink-soft, var(--muted));
  text-decoration-color: color-mix(in srgb, var(--pk-primary, var(--accent)) 60%, transparent);
  text-underline-offset: 4px;
}
.pk-docs-article.markdown-body {
  color: var(--pk-ink, var(--ink));
  font-family: "Inter", "Avenir Next", "Segoe UI", sans-serif;
}
.pk-docs-article.markdown-body h1,
.pk-docs-article.markdown-body h2,
.pk-docs-article.markdown-body h3 {
  color: var(--pk-ink, var(--ink));
  font-family: "Inter", "Avenir Next", "Segoe UI", sans-serif;
  letter-spacing: 0;
}
.pk-docs-article.markdown-body h1 {
  margin-top: 0;
  font-size: clamp(2rem, 4vw, 3.6rem);
  line-height: 1;
}
.pk-docs-article.markdown-body h2 {
  margin-top: 2.2rem;
  padding-top: 1.35rem;
  border-top: 1px solid var(--pk-line, var(--line));
  font-size: clamp(1.45rem, 2.4vw, 2.15rem);
}
.pk-docs-article.markdown-body p,
.pk-docs-article.markdown-body li {
  color: var(--pk-ink-soft, var(--muted));
}
.pk-docs-article.markdown-body table {
  min-width: 0;
}
.pk-docs-article.markdown-body pre {
  overflow: auto;
  border: 1px solid var(--pk-line, var(--line));
  background: var(--pk-dark, #0d1411);
  color: #eef7f2;
  padding: 1rem;
}
.footer {
  margin-top: 3rem;
  padding-top: 1rem;
  border-top: 1px solid var(--line);
  color: var(--muted);
  font-size: 0.95rem;
}
@media (max-width: 900px) {
  .hero,
  .section-grid,
  .pk-docs-index-grid,
  .pk-docs-layout,
  .section-kicker,
  .product-row,
  .readiness {
    grid-template-columns: 1fr;
  }
  .shell {
    width: min(100vw - 1rem, 1180px);
  }
  .readiness-list {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 620px) {
  .topbar {
    display: grid;
    align-items: flex-start;
  }
  .top-nav {
    justify-content: flex-start;
  }
  .hero__actions .button {
    width: 100%;
  }
}
`;
}

function renderFeatures(module) {
  return `
    <section class="section">
      <div class="section__header">
        <span class="eyebrow">Features</span>
        <h2>Runtime capabilities</h2>
      </div>
      <div class="feature-grid">
        ${module.features
          .map(
            (feature) => `
              <article class="feature-card">
                <h3>${escapeHtml(feature.name)}</h3>
                <p>${escapeHtml(feature.description || "No description provided.")}</p>
                <div class="tag-list">
                  <span class="tag">${feature.enabled ? "enabled" : "disabled"}</span>
                  ${feature.tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}
                </div>
                <ul class="list">
                  <li><strong>ID:</strong> <code>${escapeHtml(feature.id)}</code></li>
                  <li><strong>Permissions:</strong> ${feature.permissions.length > 0 ? feature.permissions.map((value) => `<code>${escapeHtml(value)}</code>`).join(", ") : "_none_"}</li>
                  <li><strong>Endpoints:</strong> ${feature.endpoints.length}</li>
                  <li><strong>Mapped API operations:</strong> ${feature.operationCount}</li>
                </ul>
              </article>
            `,
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderAPI(module) {
  const rows =
    module.api.operations.length > 0
      ? module.api.operations
          .map(
            (operation) => `
              <tr>
                <td><code>${escapeHtml(operation.method)}</code></td>
                <td><code>${escapeHtml(operation.path)}</code></td>
                <td>${operation.featureNames.length > 0 ? operation.featureNames.map(escapeHtml).join(", ") : "_none_"}</td>
                <td><code>${escapeHtml(operation.operationId || "_none_")}</code></td>
                <td>${escapeHtml(operation.summary || "_none_")}</td>
                <td>${operation.tags.length > 0 ? operation.tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join(" ") : "_none_"}</td>
              </tr>
            `,
          )
          .join("")
      : `<tr><td colspan="6">No API operations were available for this module.</td></tr>`;

  return `
    <section class="section panel">
      <div class="section__header">
        <span class="eyebrow">API</span>
        <h2>Canonical Huma surface</h2>
      </div>
      <p>${escapeHtml(
        module.api.present
          ? `Loaded from ${module.api.sourcePath || "the embedded module API slice"} with ${module.api.schemaCount} schemas.`
          : "No OpenAPI slice is attached to this module yet.",
      )}</p>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Method</th>
              <th>Path</th>
              <th>Features</th>
              <th>Operation ID</th>
              <th>Summary</th>
              <th>Tags</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </section>
  `;
}

function renderShowcases(module) {
  if (module.showcases.length === 0) {
    return `
      <section class="section panel">
        <div class="section__header">
          <span class="eyebrow">Showcases</span>
          <h2>Executable evidence</h2>
        </div>
        <p>No showcase artifacts were attached to this module yet.</p>
      </section>
    `;
  }

  return `
    <section class="section">
      <div class="section__header">
        <span class="eyebrow">Showcases</span>
        <h2>Executable evidence</h2>
      </div>
      <div class="showcase-grid">
        ${module.showcases
          .map(
            (showcase) => `
              <article class="showcase">
                <span class="eyebrow">${escapeHtml(showcase.source)}</span>
                <h3>${escapeHtml(showcase.title)}</h3>
                <p>${escapeHtml(showcase.summary || "No summary provided.")}</p>
                <ul class="list">
                  <li><strong>Base path:</strong> <code>${escapeHtml(showcase.basePath || "_none_")}</code></li>
                  <li><strong>Routes:</strong> ${showcase.routes.length}</li>
                  <li><strong>Flows:</strong> ${showcase.flows.length}</li>
                  <li><strong>Required fields:</strong> ${showcase.requiredFields.length > 0 ? showcase.requiredFields.map(escapeHtml).join(", ") : "_none_"}</li>
                </ul>
              </article>
            `,
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderDependencies(module) {
  const items =
    module.dependencies.length > 0
      ? module.dependencies
          .map(
            (dependency) => `
              <li>
                <strong>${escapeHtml(dependency.name)}</strong>
                (${escapeHtml(dependency.category || "dependency")})
                ${dependency.preferredProvider ? `via <code>${escapeHtml(dependency.preferredProvider)}</code>` : ""}
              </li>
            `,
          )
          .join("")
      : "<li>No explicit dependencies declared.</li>";

  return `
    <section class="section panel">
      <div class="section__header">
        <span class="eyebrow">Dependencies</span>
        <h2>Composition contract</h2>
      </div>
      <ul class="list">${items}</ul>
    </section>
  `;
}

function renderEvents(module) {
  const items =
    module.events.length > 0
      ? module.events
          .map(
            (event) => `
              <li>
                <strong><code>${escapeHtml(event.name)}</code></strong>
                ${event.description ? `- ${escapeHtml(event.description)}` : ""}
              </li>
            `,
          )
          .join("")
      : "<li>No events declared.</li>";

  return `
    <section class="section panel">
      <div class="section__header">
        <span class="eyebrow">Events</span>
        <h2>Module signals</h2>
      </div>
      <ul class="list">${items}</ul>
    </section>
  `;
}

function renderLayout({ title, description, content, overlay = null, activeHref = "" }) {
  if (overlay?.manifest?.content) {
    return renderPublicLayout({ title, description, content, overlay, activeHref });
  }
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <link rel="stylesheet" href="/assets/site.css" />
  </head>
  <body>
    <div class="shell">
      <header class="topbar">
        <a class="brand" href="/" aria-label="PlatformKit home">
          <span class="brand-mark" aria-hidden="true">PK</span>
          <span>
            <strong>PlatformKit</strong>
            <small>by Septagon</small>
          </span>
        </a>
        <nav class="top-nav" aria-label="Primary navigation">
          <a href="/docs">Docs</a>
          <a href="https://github.com/septagon-oss/platformkit">GitHub</a>
          <a href="mailto:hello@septagon.dev">Contact</a>
        </nav>
      </header>
      <main>${content}</main>
      <footer class="footer">
        Built from the PlatformKit docs repository and neutral module bundles.
      </footer>
    </div>
  </body>
</html>`;
}

function renderPublicLayout({ title, description, content, overlay, activeHref }) {
  const overlayContent = overlay.manifest.content;
  const metadata = overlayContent.metadata ?? {};
  const branding = overlayContent.branding ?? {};
  const bodyClass = joinClassNames([
    "overlay-public-shell",
    overlay.manifest.experience?.bodyClass,
    `overlay-homepage-${overlay.clientSlug}`,
  ]);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    ${metadata.keywords ? `<meta name="keywords" content="${escapeHtml(metadata.keywords)}" />` : ""}
    ${branding.faviconUrl ? `<link rel="icon" href="${escapeAttribute(branding.faviconUrl)}" />` : ""}
    ${branding.appleTouchIconUrl ? `<link rel="apple-touch-icon" href="${escapeAttribute(branding.appleTouchIconUrl)}" />` : ""}
    <link rel="stylesheet" href="/assets/site.css" />
    ${(overlay.manifest.experience?.styles ?? [])
      .map((style) => `<link rel="stylesheet" href="/assets/overlays/${overlay.clientSlug}/${escapeAttribute(style)}" />`)
      .join("\n    ")}
    <style>${renderOverlayTokens(branding)}</style>
  </head>
  <body class="${escapeAttribute(bodyClass)}">
    <div class="pk-page pk-docs-page">
      ${renderPublicNav(overlayContent, { activeHref, anchorPrefix: "/" })}
      <main class="pk-docs-main">${content}</main>
      ${renderAtlasFooter(overlayContent)}
    </div>
  </body>
</html>`;
}

function renderStat(label, value) {
  return `<div><dt>${escapeHtml(label)}</dt><dd>${value}</dd></div>`;
}

function joinClassNames(values) {
  return [...new Set(values.filter(Boolean).flatMap((value) => String(value).split(/\s+/)).filter(Boolean))].join(" ");
}

function groupContentEntries(contentEntries) {
  const order = ["guides", "architecture", "requirements", "adr"];
  const groups = new Map();
  for (const entry of contentEntries) {
    const key = entry.collection || "docs";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(entry);
  }
  return [...groups.entries()].sort(
    (a, b) => ((order.indexOf(a[0]) + 1 || order.length + 1) - (order.indexOf(b[0]) + 1 || order.length + 1)),
  );
}

function renderContentGroup(title, entries) {
  return `
    <section class="pk-docs-panel">
      <div class="pk-docs-panel-head">
        <span class="pk-docs-kicker">${escapeHtml(title)}</span>
        <h2>${entries.length} pages</h2>
      </div>
      <ul class="pk-docs-list">
        ${entries.map((entry) => `<li><a href="${escapeAttribute(entry.route)}">${escapeHtml(entry.title)}</a></li>`).join("")}
      </ul>
    </section>
  `;
}

function collectionTitle(collection) {
  if (collection === "adr") return "Architecture Decisions";
  if (collection === "requirements") return "Requirements";
  if (collection === "architecture") return "Architecture";
  if (collection === "guides") return "Guides";
  return "Docs";
}
