import test from "node:test";
import assert from "node:assert/strict";

import { renderMarkdown } from "../src/markdown.mjs";
import { renderContentIndexPage, renderContentPage, renderHomePage, renderModulePage } from "../src/site-template.mjs";

test("renderMarkdown preserves fenced code language classes", () => {
  const html = renderMarkdown("```mermaid\nflowchart LR\n  A --> B\n```");

  assert.match(html, /<pre><code class="language-mermaid">/);
  assert.match(html, /flowchart LR/);
});

test("renderMarkdown supports inline emphasis and resolved links", () => {
  const html = renderMarkdown("**Module.** See [ADR 0007](../adr/0007-outbox.md).", {
    resolveHref: (href) => (href === "../adr/0007-outbox.md" ? "/docs/adr-0007-outbox" : href),
  });

  assert.match(html, /<strong>Module\.<\/strong>/);
  assert.match(html, /<a href="\/docs\/adr-0007-outbox">ADR 0007<\/a>/);
});

test("renderHomePage outputs the PlatformKit product page and module catalog", () => {
  const html = renderHomePage(siteFixture(), {
    clientSlug: "platformkit",
    manifest: {
      experience: {
        styles: ["homepage.css"],
        scripts: ["homepage.js"],
        bodyClass: "overlay-homepage-platformkit",
      },
      content: {
        metadata: {
          title: "PlatformKit — Production platform for AI-native SaaS in Go",
          description: "PlatformKit helps AI builders turn agent demos into real products.",
        },
        branding: {
          logoAlt: "platformkit",
          primaryColor: "#14b8a6",
          secondaryColor: "#2563eb",
          accentColor: "#f59e0b",
          fontFamily: "Inter",
        },
        home: {
          badge: "For AI builders with real users",
        },
        navbar: {
          joinUsText: "Get PlatformKit",
          contactHref: "#get-started",
          links: [{ title: "Modules", href: "#modules" }],
        },
        ui: {
          builderPrompt: "I want to build",
          builderPlaceholder: "the product that keeps returning...",
          builderEmailLabel: "Send the first workspace to",
          builderSubmit: "Start shaping it",
          builderStatus: "Describe the product that keeps returning.",
          experienceSectionsTitle: "The production layer AI builders usually discover too late.",
          modulesLabel: "Module footprint",
          moduleFootprintTitle: "Agent-ready platform graph",
          entitiesWord: "Entities",
          featuresWord: "Features",
          testimonialsTitle: "Proof packs",
          testimonialsSubtitle: "The same contracts across products.",
        },
        sections: [
          {
            id: "boring-half",
            title: "The demo is not the product.",
            subtitle: "A working agent still needs users, organizations, roles, billing, audit, and admin.",
            buttonText: "Read the platform charter",
          buttonHref: "/docs/architecture",
          },
        ],
        commodities: {
          title: "One graph, many AI surfaces",
          subtitle: "Serve the same composition as an app, admin console, MCP server, docs portal, worker runtime, module catalog, or vertical client surface.",
          joinButton: "Read topology ADR",
          buttonHref: "/docs/platformkit-formula",
          items: [{ label: "MCP tools" }, { label: "Agent workflows" }],
        },
        pricing: {
          monthlyLabel: "Pricing",
          title: "Start open. Add the production layer when the agent has users.",
          subtitle: "Use the source to understand the contract.",
          plans: [{ name: "Community", subtext: "Read the source.", monthlyPrice: 0, buttonText: "Start free", buttonHref: "/docs" }],
        },
        testimonials: [
          {
            name: "COMUM Cowork",
            role: "Real coworking operation",
            quote: "An operations surface where agents can reason about bookings.",
          },
        ],
        contact: { email: "hello@platformkit.dev", website: "https://platformkit.dev" },
        social: [{ label: "GitHub", url: "https://github.com/septagon-oss" }],
        footer: { description: "PlatformKit is the production substrate for AI-native SaaS." },
      },
    },
  });

  assert.match(html, /Production platform for AI-native SaaS in Go/);
  assert.match(html, /data-platformkit-template="atlas"/);
  assert.match(html, /data-pk-builder/);
  assert.match(html, /The demo is not the product/);
  assert.match(html, /Agent-ready platform graph/);
  assert.match(html, /MCP tools/);
  assert.match(html, /Translation Management/);
  assert.match(html, /COMUM Cowork/);
});

test("renderHomePage filters unsafe public links", () => {
  const html = renderHomePage(siteFixture(), {
    clientSlug: "platformkit",
    manifest: {
      experience: { bodyClass: "overlay-homepage-platformkit" },
      content: {
        metadata: { title: "PlatformKit", description: "Docs" },
        branding: { logoAlt: "platformkit" },
        navbar: {
          joinUsText: "Start",
          contactHref: "javascript:alert(1)",
          links: [{ title: "Bad", href: "javascript:alert(1)" }],
        },
        sections: [{ id: "safe", title: "Safe", subtitle: "Safe" }],
        commodities: { items: [] },
        pricing: { plans: [] },
        testimonials: [],
        contact: { email: "hello@platformkit.dev\r\nbcc:evil@example.com", website: "javascript:alert(1)" },
        social: [{ label: "Bad", url: "javascript:alert(1)" }],
        footer: { description: "Footer" },
      },
    },
  });

  assert.doesNotMatch(html, /href="javascript:/);
  assert.doesNotMatch(html, /https:\/\/javascript/);
  assert.doesNotMatch(html, /mailto:hello@platformkit\.dev/);
});

function siteFixture() {
  return {
    featuredModuleId: "translation_management",
    stats: {
      moduleCount: 1,
      apiModuleCount: 1,
      showcaseCount: 1,
    },
    modules: [
      {
        id: "translation_management",
        title: "Translation Management",
        summary: "Centralized translations.",
        module: {
          category: "localization",
        },
        stats: {
          featureCount: 1,
          operationCount: 9,
          showcaseCount: 1,
        },
      },
    ],
  };
}

test("renderModulePage outputs API and showcase sections", () => {
  const html = renderModulePage({
    id: "translation_management",
    title: "Translation Management",
    summary: "Centralized translations.",
    narrativeBody: "# translation_management\n\nNarrative.",
    module: {
      category: "localization",
      basePath: "/api/v1/translations",
      version: "1.0.0",
      archetype: "registry",
    },
    stats: {
      featureCount: 1,
      dependencyCount: 1,
      operationCount: 1,
      showcaseCount: 1,
      eventCount: 1,
    },
    dependencies: [],
    events: [],
    features: [
      {
        id: "translations",
        name: "Translation Management",
        description: "Manage translations",
        enabled: true,
        tags: ["i18n"],
        permissions: ["translations.view"],
        endpoints: [{}],
        operationCount: 1,
      },
    ],
    showcases: [
      {
        source: "bundle",
        title: "Translation Showcase",
        summary: "Walkthrough",
        basePath: "/admin/translations",
        routes: [{ id: "list", path: "/admin/translations" }],
        flows: [{ id: "create", title: "Create" }],
        requiredFields: ["key"],
      },
    ],
    api: {
      present: true,
      sourcePath: "translation_management/docs/api/openapi.json",
      schemaCount: 1,
      operations: [
        {
          method: "GET",
          path: "/admin/translations",
          featureNames: ["Translation Management"],
          operationId: "translations-page",
          summary: "Translations page",
          tags: ["ui"],
        },
      ],
    },
  });

  assert.match(html, /Canonical Huma surface/);
  assert.match(html, /Executable evidence/);
  assert.match(html, /translations-page/);
});

test("renderContentIndexPage outputs hosted documentation links", () => {
  const html = renderContentIndexPage([
    {
      title: "01 Introduction and Goals",
      slug: "architecture-01-introduction-and-goals",
      route: "/docs/architecture-01-introduction-and-goals",
      collection: "architecture",
      excerpt: "PlatformKit architecture.",
      sourcePath: "architecture/01-introduction-and-goals.md",
      content: "# 01 Introduction and Goals",
    },
  ]);

  assert.match(html, /PlatformKit Docs/);
  assert.match(html, /href="\/docs\/architecture-01-introduction-and-goals"/);
});

test("renderContentPage renders a hosted documentation content entry", () => {
  const html = renderContentPage(
    {
      title: "04 Solution Strategy",
      slug: "architecture-04-solution-strategy",
      route: "/docs/architecture-04-solution-strategy",
      collection: "architecture",
      excerpt: "Strategy.",
      sourcePath: "architecture/04-solution-strategy.md",
      content: "See ADR 0009.",
      contentHtml: '<p>See <a href="/docs/adr-0009-ports-only-cross-module-communication">ADR 0009</a>.</p>',
    },
    [],
  );

  assert.match(html, /href="\/docs\/adr-0009-ports-only-cross-module-communication"/);
});
