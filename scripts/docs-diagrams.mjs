// Generates the SVG diagrams used by the published guides into
// docs/assets/diagrams. They are plain SVG with the pk-design default palette,
// so they render identically on GitHub and on the docs site, need no runtime
// library, and adapt to dark mode through an embedded media query.
//
//   node ./scripts/docs-diagrams.mjs

import { promises as fs } from "node:fs";
import path from "node:path";

import { resolveWorkspaceRoot } from "./workspace-paths.mjs";

const workspaceRoot = resolveWorkspaceRoot(import.meta.url);
const outDir = path.join(workspaceRoot, "docs", "assets", "diagrams");

const FONT = "'IBM Plex Sans', Inter, 'Segoe UI', system-ui, sans-serif";
const MONO = "'IBM Plex Mono', 'SFMono-Regular', Menlo, Consolas, monospace";

const STYLE = `
  .canvas { fill: #fffdf7; }
  .ink { fill: #15221f; }
  .muted { fill: #5f6b65; }
  .line { stroke: #8f988f; }
  .card { fill: #f2efe7; stroke: #cbc5b8; }
  .card-strong { fill: #fffdf7; stroke: #8f988f; }
  .accent { fill: #0f5d4e; }
  .accent-on { fill: #f9fff9; }
  .signal { fill: #d8f35d; }
  .dark { fill: #12201d; }
  .dark-text { fill: #eff4e9; }
  .dark-muted { fill: #aebbb2; }
  .ok { fill: #12715d; }
  .okbg { fill: #dcf3e8; }
  .warn { fill: #9a5318; }
  .warnbg { fill: #fff0d2; }
  .danger { fill: #9e3833; }
  .dangerbg { fill: #fbe5e2; }
  .focus { fill: #326de6; }
  .infobg { fill: #e3ecfb; }
  .arrow { stroke: #5f6b65; stroke-width: 2; fill: none; }
  .arrow-dashed { stroke: #8f988f; stroke-width: 2; fill: none; stroke-dasharray: 6 6; }
  .arrow-accent { stroke: #0f5d4e; stroke-width: 2.5; fill: none; }
  .t { font-family: ${FONT}; }
  .m { font-family: ${MONO}; }
  @media (prefers-color-scheme: dark) {
    .canvas { fill: #15201d; }
    .ink { fill: #eaf1ea; }
    .muted { fill: #aebbb2; }
    .line { stroke: #4a5c55; }
    .card { fill: #1b2825; stroke: #2a3a35; }
    .card-strong { fill: #0e1513; stroke: #4a5c55; }
    .accent { fill: #5fc2a6; }
    .accent-on { fill: #0b1a16; }
    .okbg { fill: #16302a; } .ok { fill: #7ed3b5; }
    .warnbg { fill: #33271a; } .warn { fill: #f0b36b; }
    .dangerbg { fill: #3a1f1d; } .danger { fill: #f09a94; }
    .infobg { fill: #1c2a3f; } .focus { fill: #7aa7ff; }
    .arrow { stroke: #aebbb2; }
    .arrow-dashed { stroke: #6f827a; }
    .arrow-accent { stroke: #5fc2a6; }
  }
`;

function svg({ width, height, title, body }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-labelledby="title">
  <title id="title">${escape(title)}</title>
  <style>${STYLE}</style>
  <defs>
    <marker id="head" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto" markerUnits="userSpaceOnUse"><path d="M0,0 L10,5 L0,10 z" fill="#5f6b65"/></marker>
    <marker id="head-accent" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto" markerUnits="userSpaceOnUse"><path d="M0,0 L10,5 L0,10 z" fill="#0f5d4e"/></marker>
    <marker id="head-faint" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto" markerUnits="userSpaceOnUse"><path d="M0,0 L10,5 L0,10 z" fill="#8f988f"/></marker>
  </defs>
  <rect class="canvas" width="${width}" height="${height}" rx="16"/>
  ${body}
</svg>
`;
}

function escape(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function text(x, y, value, { size = 14, cls = "ink t", weight = 400, anchor = "start", extra = "" } = {}) {
  return `<text x="${x}" y="${y}" class="${cls}" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}" ${extra}>${escape(value)}</text>`;
}

function lines(x, y, values, { size = 13, cls = "muted t", leading = 18, anchor = "start", weight = 400 } = {}) {
  return values.map((value, index) => text(x, y + index * leading, value, { size, cls, anchor, weight })).join("\n");
}

function card(x, y, w, h, { cls = "card", rx = 12, strokeWidth = 1.5 } = {}) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" class="${cls}" stroke-width="${strokeWidth}"/>`;
}

function badge(x, y, value, { cls = "dark", textCls = "dark-text t", width = null, size = 11 } = {}) {
  const w = width ?? value.length * 7.2 + 18;
  return `${card(x, y, w, 22, { cls, rx: 11, strokeWidth: 0 })}${text(x + w / 2, y + 15, value, { size, cls: textCls, weight: 600, anchor: "middle" })}`;
}

function stepCircle(x, y, n) {
  return `<circle cx="${x}" cy="${y}" r="16" class="dark"/>${text(x, y + 5, String(n), { size: 14, cls: "signal m", weight: 700, anchor: "middle" })}`;
}

function arrow(x1, y1, x2, y2, { cls = "arrow", marker = "head" } = {}) {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="${cls}" marker-end="url(#${marker})"/>`;
}

function pathArrow(d, { cls = "arrow", marker = "head" } = {}) {
  return `<path d="${d}" class="${cls}" marker-end="url(#${marker})"/>`;
}

// ---------------------------------------------------------------------------

function journey() {
  const steps = [
    { n: 1, title: "Run it", body: ["go run github.com/", "septagon-oss/platformkit@latest"], mono: true, note: "One process. SQLite. No Docker." },
    { n: 2, title: "Log in", body: ["127.0.0.1:8080/admin", "operator@local.test"], mono: true, note: "A real operator console, ten modules." },
    { n: 3, title: "Call the API", body: ["POST /api/v1/auth/sessions", "Authorization: Bearer <id>"], mono: true, note: "Tenant-scoped, fail-closed JSON." },
    { n: 4, title: "Make it yours", body: ["platformkit new app acme", "platformkit new module invoice"], mono: true, note: "Your module, isolation tests included." },
  ];
  const w = 1240;
  const h = 272;
  const cardW = 278;
  const gap = 30;
  const startX = (w - (cardW * 4 + gap * 3)) / 2;
  const y = 58;
  let body = "";
  steps.forEach((step, index) => {
    const x = startX + index * (cardW + gap);
    body += card(x, y, cardW, 184, { cls: "card-strong" });
    body += stepCircle(x + 28, y + 30, step.n);
    body += text(x + 54, y + 36, step.title, { size: 19, weight: 700 });
    body += card(x + 16, y + 58, cardW - 32, 58, { cls: "dark", rx: 8, strokeWidth: 0 });
    body += lines(x + 26, y + 81, step.body, { size: 11.5, cls: "dark-text m", leading: 19 });
    body += text(x + 16, y + 146, step.note, { size: 13, cls: "muted t" });
    if (index < steps.length - 1) {
      body += arrow(x + cardW + 6, y + 92, x + cardW + gap - 6, y + 92, { cls: "arrow-accent", marker: "head-accent" });
    }
  });
  body += text(w / 2, 36, "From zero to your own module — the path these guides follow", { size: 15, cls: "muted t", anchor: "middle" });
  return svg({ width: w, height: h, title: "The four-step PlatformKit journey: run it, log in, call the API, make it yours.", body });
}

function onePprocess() {
  const w = 1100;
  const h = 560;
  let body = "";
  body += text(40, 42, "One process, one database, one perimeter", { size: 22, weight: 700 });
  body += text(40, 66, "Everything below runs from a single Go binary on 127.0.0.1:8080.", { size: 14, cls: "muted t" });

  // Left: clients
  const clients = [
    ["Browser", "GET /  ·  /admin"],
    ["Your script", "curl -H 'Authorization: …'"],
    ["Orchestrator", "GET /healthz  /live  /ready"],
  ];
  clients.forEach(([name, route], index) => {
    const y = 110 + index * 92;
    body += card(40, y, 220, 66, { cls: "card" });
    body += text(56, y + 27, name, { size: 15, weight: 700 });
    body += text(56, y + 49, route, { size: 12, cls: "muted m" });
    body += arrow(262, y + 33, 318, y + 33);
  });

  // The process box
  body += card(324, 96, 736, 430, { cls: "card-strong", rx: 16, strokeWidth: 2 });
  body += badge(340, 110, "platformkit process");
  body += text(540, 126, "SQLite by default · Postgres for production", { size: 12.5, cls: "muted t" });

  // perimeter
  body += card(344, 146, 696, 74, { cls: "infobg", rx: 10, strokeWidth: 0 });
  body += text(360, 170, "HTTP perimeter", { size: 14, weight: 700 });
  body += text(360, 192, "resolve credential → tenant + subject · reject anonymous writes · 1 MiB body cap · canonical {id} path segments", { size: 12, cls: "muted t" });
  body += text(1024, 170, "401 · 403 · 400", { size: 12, cls: "focus m", anchor: "end", weight: 600 });

  // modules grid
  const modules = [
    ["tenant", "isolation"],
    ["user", "accounts"],
    ["auth", "sessions"],
    ["api_key", "machine scopes"],
    ["audit", "append-only log"],
    ["content", "draft → publish"],
    ["notification", "in-app records"],
    ["branding", "logo + palette"],
    ["admin", "operator console"],
    ["health", "probes + metrics"],
  ];
  const mx = 344;
  const my = 236;
  const mw = 130;
  const mh = 58;
  modules.forEach(([name, role], index) => {
    const col = index % 5;
    const row = Math.floor(index / 5);
    const x = mx + col * (mw + 11.5);
    const y = my + row * (mh + 12);
    body += card(x, y, mw, mh, { cls: "card", rx: 8 });
    body += text(x + 12, y + 24, name, { size: 13, cls: "ink m", weight: 700 });
    body += text(x + 12, y + 43, role, { size: 11.5, cls: "muted t" });
  });
  body += text(360, 385, "10 modules · each with tenant-scoped queries, declared scopes, embedded migrations, conformance tests", { size: 12, cls: "muted t" });

  // pool
  body += card(344, 404, 696, 48, { cls: "dark", rx: 10, strokeWidth: 0 });
  body += text(360, 424, "one shared *sql.DB pool", { size: 14, cls: "dark-text m", weight: 700 });
  body += text(360, 442, "every module store carries WHERE tenant_id = ? — on SQLite and on Postgres", { size: 11.5, cls: "dark-muted t" });
  body += text(1024, 432, "./pk.db", { size: 13, cls: "signal m", anchor: "end", weight: 600 });

  // extension seam
  body += card(344, 466, 696, 46, { cls: "okbg", rx: 10, strokeWidth: 0 });
  body += text(360, 486, "starterapp.WithModules(yourModule)", { size: 13.5, cls: "ok m", weight: 700 });
  body += text(360, 503, "the one supported seam: your modules join the same pool, identity perimeter, admin, health, and OpenAPI", { size: 11.5, cls: "muted t" });

  return svg({ width: w, height: h, title: "Inside the PlatformKit process: an HTTP perimeter, ten modules, one shared database pool, and the WithModules extension seam.", body });
}

function architecture() {
  const w = 1100;
  const h = 640;
  let body = "";
  body += text(40, 42, "How the repositories fit together", { size: 22, weight: 700 });
  body += text(40, 66, "Arrows point from what is used to what uses it. You only ever depend on the released set.", { size: 14, cls: "muted t" });

  const col = (x, y, wdt, hgt, kicker, title, desc, cls = "card-strong") => {
    let out = card(x, y, wdt, hgt, { cls });
    out += text(x + 18, y + 24, kicker, { size: 11, cls: "accent t", weight: 700, extra: 'letter-spacing="1.5"' });
    out += text(x + 18, y + 50, title, { size: 16, cls: "ink m", weight: 700 });
    out += lines(x + 18, y + 72, desc, { size: 12, cls: "muted t", leading: 16 });
    return out;
  };

  // Foundations (left column)
  body += card(40, 96, 250, 512, { cls: "card", rx: 14 });
  body += text(58, 124, "FOUNDATIONS", { size: 11, cls: "muted t", weight: 700, extra: 'letter-spacing="1.5"' });
  body += text(58, 142, "move fastest · design system", { size: 11.5, cls: "muted t" });
  const foundations = [
    ["pk-design", "tokens, themes, WCAG contrast"],
    ["tw", "typed utility classes + CSS"],
    ["styleengine", "typed CSS build + sanitize"],
    ["pk-ui", "accessible Go components"],
    ["pk-client", "call a PlatformKit API"],
  ];
  foundations.forEach(([name, desc], index) => {
    const y = 164 + index * 78;
    body += card(56, y, 218, 60, { cls: "card-strong", rx: 8 });
    body += text(70, y + 25, name, { size: 13.5, cls: "ink m", weight: 700 });
    body += text(70, y + 45, desc, { size: 11.5, cls: "muted t" });
  });

  // Released set (middle)
  body += card(330, 96, 430, 512, { cls: "card", rx: 14 });
  body += text(348, 124, "RELEASED SET", { size: 11, cls: "muted t", weight: 700, extra: 'letter-spacing="1.5"' });
  body += text(348, 142, "tagged together · boot-tested as a whole", { size: 11.5, cls: "muted t" });
  body += col(348, 160, 394, 98, "CONTRACTS", "pk-core · pk-shared · pk-runtime", ["module, identity, and runtime contracts;", "shared vocabulary; hosting and health"]);
  body += arrow(545, 260, 545, 280);
  body += col(348, 284, 394, 98, "IMPLEMENTATION", "pk-modules", ["the ten reference modules and the admin console;", "every store passes the same conformance suite"]);
  body += arrow(545, 384, 545, 404);
  body += col(348, 408, 394, 98, "COMPOSITION", "pk-apps / pkg/starterapp", ["the one canonical starter composition", "and the WithModules seam"]);
  body += arrow(545, 508, 545, 528);
  body += col(348, 532, 394, 62, "FRONT DOOR", "platformkit  →  go run .", []);

  // Your product (right)
  body += card(800, 96, 260, 190, { cls: "okbg", rx: 14, strokeWidth: 0 });
  body += text(818, 124, "YOUR PRODUCT", { size: 11, cls: "ok t", weight: 700, extra: 'letter-spacing="1.5"' });
  body += text(818, 150, "acme/", { size: 16, cls: "ink m", weight: 700 });
  body += lines(818, 176, ["main.go boots the starter", "mod_invoice.go, migrations,", "tests — all in your repo"], { size: 12.5, cls: "muted t", leading: 17 });
  body += text(818, 262, "platformkit new app acme", { size: 12, cls: "ok m", weight: 600 });
  body += pathArrow("M 742 449 C 790 449, 770 200, 798 200", { cls: "arrow-accent", marker: "head-accent" });
  body += card(742, 300, 100, 22, { cls: "dark", rx: 11, strokeWidth: 0 });
  body += text(792, 315, "WithModules", { size: 10.5, cls: "signal m", weight: 700, anchor: "middle" });

  // Toolchain (right bottom)
  body += card(800, 330, 260, 278, { cls: "card", rx: 14 });
  body += text(818, 358, "TOOLCHAIN", { size: 11, cls: "muted t", weight: 700, extra: 'letter-spacing="1.5"' });
  body += text(818, 376, "gates and generates · not linked in", { size: 11.5, cls: "muted t" });
  const tools = [
    ["pk-guard", "go/analysis guardrails"],
    ["pk-tools", "pk new module · pk explain"],
    ["pk-testkit", "conformance + flow tests"],
  ];
  tools.forEach(([name, desc], index) => {
    const y = 398 + index * 64;
    body += card(818, y, 224, 50, { cls: "card-strong", rx: 8 });
    body += text(832, y + 19, name, { size: 13, cls: "ink m", weight: 700 });
    body += text(832, y + 36, desc, { size: 11.5, cls: "muted t" });
  });

  body += pathArrow("M 292 340 C 312 340, 312 333, 330 333", { cls: "arrow-dashed", marker: "head-faint" });
  body += text(300, 322, "consumed", { size: 9.5, cls: "muted t" });
  return svg({ width: w, height: h, title: "Repository map: foundations feed the released set (pk-core, pk-modules, pk-apps, platformkit); your product extends the starter through WithModules; the toolchain gates it.", body });
}

function requestLifecycle() {
  const w = 1100;
  const h = 420;
  let body = "";
  body += text(40, 42, "What happens to every /api/v1 request", { size: 22, weight: 700 });
  body += text(40, 66, "Each gate fails closed. The status code tells you which gate stopped you.", { size: 14, cls: "muted t" });

  const gates = [
    { n: 1, title: "Who are you?", desc: ["Bearer session id,", "pk_ API key, or", "pk_session cookie"], fail: "401", failCls: "danger", failBg: "dangerbg", failText: "missing / invalid credential" },
    { n: 2, title: "May you?", desc: ["capability check:", "<resource>:read / :write", "or interactive admin"], fail: "403", failCls: "danger", failBg: "dangerbg", failText: "credential lacks the scope" },
    { n: 3, title: "Which tenant?", desc: ["tenant + subject come", "from the credential —", "never from the body"], fail: "404", failCls: "warn", failBg: "warnbg", failText: "other tenant's id → not found" },
    { n: 4, title: "Is it well-formed?", desc: ["strict JSON, ≤ 1 MiB,", "positive limit/offset,", "canonical id-<hex> paths"], fail: "400 · 413", failCls: "warn", failBg: "warnbg", failText: "unknown field, bad page, raw id" },
    { n: 5, title: "Do the work", desc: ["tenant-scoped query,", "server-owned ids + times,", "audit event appended"], fail: "2xx", failCls: "ok", failBg: "okbg", failText: "JSON body, or 204 on actions" },
  ];
  const cw = 198;
  const gap = 7.5;
  const sx = 40;
  gates.forEach((gate, index) => {
    const x = sx + index * (cw + gap);
    const y = 96;
    body += card(x, y, cw, 150, { cls: "card-strong" });
    body += stepCircle(x + 26, y + 28, gate.n);
    body += text(x + 50, y + 33, gate.title, { size: 14.5, weight: 700 });
    body += lines(x + 16, y + 66, gate.desc, { size: 11.5, cls: "muted m", leading: 17 });
    // outcome
    body += card(x, y + 166, cw, 60, { cls: gate.failBg, rx: 10, strokeWidth: 0 });
    body += text(x + 14, y + 191, gate.fail, { size: 18, cls: `${gate.failCls} m`, weight: 700 });
    body += text(x + 14, y + 212, gate.failText, { size: 11, cls: "muted t" });
    body += arrow(x + cw / 2, y + 150, x + cw / 2, y + 162, { cls: "arrow-dashed", marker: "head-faint" });
    if (index < gates.length - 1) {
      body += arrow(x + cw + 3, y + 75, x + cw + gap - 3, y + 75, { cls: "arrow-accent", marker: "head-accent" });
    }
  });

  body += card(40, 346, 1020, 48, { cls: "infobg", rx: 10, strokeWidth: 0 });
  body += text(58, 366, "Only one route is open without a credential: POST /api/v1/auth/sessions (log in). Everything else needs a bearer token or the session cookie.", { size: 12.5, cls: "ink t" });
  body += text(58, 384, "Errors are plain text, not JSON — the status code carries the meaning.", { size: 12.5, cls: "muted t" });
  return svg({ width: w, height: h, title: "Request lifecycle: authenticate (401), authorize (403), resolve tenant from the credential (404 for cross-tenant ids), validate input (400/413), then do tenant-scoped work (2xx).", body });
}

function storedVsDisplayed() {
  const w = 1100;
  const h = 440;
  let body = "";
  body += text(40, 42, "Stored is not the same as displayed", { size: 22, weight: 700 });
  body += text(40, 66, "The starter persists and administers records. Where they appear to end users is your product's decision.", { size: 14, cls: "muted t" });

  const row = (y, call, record, shipped, yours) => {
    let out = "";
    out += card(40, y, 250, 92, { cls: "dark", rx: 10, strokeWidth: 0 });
    out += text(56, y + 30, call[0], { size: 13, cls: "signal m", weight: 700 });
    out += lines(56, y + 52, call.slice(1), { size: 11.5, cls: "dark-muted m", leading: 16 });
    out += arrow(292, y + 46, 330, y + 46, { cls: "arrow-accent", marker: "head-accent" });
    out += card(336, y, 190, 92, { cls: "card-strong", rx: 10 });
    out += text(352, y + 28, "stored record", { size: 11, cls: "accent t", weight: 700, extra: 'letter-spacing="1.5"' });
    out += lines(352, y + 50, record, { size: 12, cls: "ink m", leading: 16 });
    out += arrow(528, y + 46, 566, y + 46, { cls: "arrow-accent", marker: "head-accent" });
    // shipped
    out += card(572, y, 230, 92, { cls: "okbg", rx: 10, strokeWidth: 0 });
    out += text(588, y + 28, "SHIPS IN THE STARTER", { size: 10.5, cls: "ok t", weight: 700, extra: 'letter-spacing="1.5"' });
    out += lines(588, y + 50, shipped, { size: 12, cls: "ink t", leading: 16 });
    out += arrow(804, y + 46, 842, y + 46, { cls: "arrow-dashed", marker: "head-faint" });
    // yours
    out += card(848, y, 212, 92, { cls: "card", rx: 10 });
    out += text(864, y + 28, "YOURS TO BUILD", { size: 10.5, cls: "muted t", weight: 700, extra: 'letter-spacing="1.5"' });
    out += lines(864, y + 50, yours, { size: 12, cls: "muted t", leading: 16 });
    return out;
  };

  body += row(96, ["POST /api/v1/notifications", '{"title":"Build passed",', ' "body":"main is green"}'], ["notification row", "tenant + user scoped", "read state, severity"], ["GET /api/v1/notifications", "Admin → Notifications", "audit: notification.dispatched"], ["navbar bell · inbox", "toast · email · SMS", "push · provider retries"]);
  body += row(214, ["POST /api/v1/content", '{"kind":"page","slug":"welcome",', ' "title":"Welcome"}'], ["content row", "draft → published_at", "body_format: markdown"], ["GET /api/v1/content", "Admin → Content", "publish / unpublish actions"], ["public URL scheme", "templates · theme", "audience policy · feed"]);

  body += card(40, 332, 1020, 78, { cls: "infobg", rx: 10, strokeWidth: 0 });
  body += text(58, 356, "Why the gap is deliberate", { size: 13.5, weight: 700 });
  body += lines(58, 376, ["A bell, a toast, or a public page is a product decision — layout, audience, delivery provider, retry policy. The starter refuses to guess.", "Add your read model, routes, and renderer through starterapp.WithModules; the stored record, API, and operator console are already there."], { size: 12, cls: "muted t", leading: 17 });
  return svg({ width: w, height: h, title: "Stored versus displayed: creating a notification or content record persists it and exposes it through the API and admin console; bells, toasts, emails, and public pages are downstream product features.", body });
}

function extensionSeam() {
  const w = 1100;
  const h = 520;
  let body = "";
  body += text(40, 42, "The one supported seam: starterapp.WithModules", { size: 22, weight: 700 });
  body += text(40, 66, "Your module lives in your repository. It joins the starter's shared machinery instead of re-implementing it.", { size: 14, cls: "muted t" });

  // Your repo
  body += card(40, 96, 380, 400, { cls: "okbg", rx: 16, strokeWidth: 0 });
  body += text(58, 124, "YOUR REPOSITORY", { size: 11, cls: "ok t", weight: 700, extra: 'letter-spacing="1.5"' });
  body += text(58, 150, "acme/", { size: 18, cls: "ink m", weight: 700 });
  const files = [
    ["main.go", "cfg := starterapp.DefaultConfig()", "starterapp.Run(ctx, cfg, WithModules(extraModules()...))"],
    ["modules.go", "registerModule(m) — additive registry", "generated modules call it from init()"],
    ["mod_invoice.go", "store on env.DB · RegisterRoutes", "APIKeyScopes · OpenAPI · scope checks"],
    ["migrations/invoice/0001_….up.sql", "append-only, embedded", "applied once, filename recorded"],
    ["mod_invoice_test.go", "tenant isolation: a row in tenant A is", "invisible to tenant B, by list and by id"],
  ];
  files.forEach(([name, a, b], index) => {
    const y = 168 + index * 64;
    body += card(58, y, 344, 54, { cls: "card-strong", rx: 8 });
    body += text(72, y + 20, name, { size: 12.5, cls: "ink m", weight: 700 });
    body += text(72, y + 36, a, { size: 10.5, cls: "muted m" });
    body += text(72, y + 49, b, { size: 10.5, cls: "muted m" });
  });

  // seam arrow
  body += pathArrow("M 424 300 L 486 300", { cls: "arrow-accent", marker: "head-accent" });
  body += card(430, 262, 52, 22, { cls: "dark", rx: 11, strokeWidth: 0 });
  body += text(456, 277, "seam", { size: 10.5, cls: "signal m", weight: 700, anchor: "middle" });

  // starter
  body += card(492, 96, 568, 400, { cls: "card-strong", rx: 16, strokeWidth: 2 });
  body += text(510, 124, "THE STARTER YOU INHERIT", { size: 11, cls: "accent t", weight: 700, extra: 'letter-spacing="1.5"' });
  body += text(510, 150, "pk-apps/pkg/starterapp · ten built-in modules", { size: 14, cls: "ink t", weight: 600 });
  const shared = [
    ["ModuleEnv.DB", "the shared *sql.DB — SQLite or Postgres, your call"],
    ["identity perimeter", "credential → principal; RequestActor gives tenant + subject"],
    ["anonymous-mutation gate", "unauthenticated writes never reach your handler"],
    ["request-body cap", "1 MiB, enforced before you read the body"],
    ["scope registry", "your APIKeyScopes become issuable; typos are rejected"],
    ["admin + health", "RegisterPage adds a console page; health checks aggregate"],
    ["OpenAPI discovery", "your OpenAPIOperation entries appear in extensions.json"],
  ];
  shared.forEach(([name, desc], index) => {
    const y = 168 + index * 45;
    body += card(510, y, 532, 38, { cls: "card", rx: 8 });
    body += text(524, y + 24, name, { size: 12.5, cls: "ink m", weight: 700 });
    body += text(712, y + 24, desc, { size: 11.5, cls: "muted t" });
  });
  return svg({ width: w, height: h, title: "The WithModules seam: files in your repository (main.go, modules.go, a module, migrations, tests) join the starter's shared database pool, identity perimeter, mutation gate, body cap, scope registry, admin and health registrars, and OpenAPI discovery.", body });
}

function designLayers() {
  const w = 1100;
  const h = 420;
  let body = "";
  body += text(40, 42, "Four small pieces, all in Go — each one replaceable", { size: 22, weight: 700 });
  body += text(40, 66, "No Node, no Tailwind build, no bundler. Classes are declared as values and the stylesheet is derived from them.", { size: 14, cls: "muted t" });
  const layers = [
    { repo: "pk-design", role: "Canonical theme", body: ["themes.Default() — tokens as data", "(DTCG) rendered to --pk-* custom", "properties. Brand = layer a theme."], out: "--pk-accent-default: #0f5d4e" },
    { repo: "tw", role: "Utility classes", body: ["Typed class builder + emission:", "CSS for every enumerable class,", "mapped onto --pk-role-* variables."], out: "bg-surface-brand text-fg-on-brand" },
    { repo: "styleengine", role: "CSS engine", body: ["Typed sheet IR: render, parse,", "sanitize. The thing that turns", "declarations into a stylesheet."], out: "sheet.Render(RenderOptions{…})" },
    { repo: "pk-ui", role: "Components", body: ["Props contracts, ARIA builder,", "gomponents renderers — atoms,", "molecules, organisms (DataGrid)."], out: "web.Button(ButtonProps{…})" },
  ];
  const cw = 238;
  const gap = 22;
  layers.forEach((layer, index) => {
    const x = 40 + index * (cw + gap);
    const y = 96;
    body += card(x, y, cw, 226, { cls: "card-strong" });
    body += text(x + 18, y + 28, layer.role.toUpperCase(), { size: 10.5, cls: "accent t", weight: 700, extra: 'letter-spacing="1.5"' });
    body += text(x + 18, y + 56, layer.repo, { size: 19, cls: "ink m", weight: 700 });
    body += lines(x + 18, y + 84, layer.body, { size: 12, cls: "muted t", leading: 17 });
    body += card(x + 14, y + 150, cw - 28, 56, { cls: "dark", rx: 8, strokeWidth: 0 });
    body += text(x + 26, y + 172, "emits", { size: 10, cls: "dark-muted t", weight: 700, extra: 'letter-spacing="1.5"' });
    body += text(x + 26, y + 192, layer.out, { size: 10.5, cls: "signal m" });
    if (index < layers.length - 1) {
      body += arrow(x + cw + 3, y + 110, x + cw + gap - 3, y + 110, { cls: "arrow-accent", marker: "head-accent" });
    }
  });
  body += card(40, 344, 1020, 52, { cls: "okbg", rx: 10, strokeWidth: 0 });
  body += text(58, 366, "Result: the admin shell serves one stylesheet (/admin/static/_admin.css) that already carries tokens, role variables, and every utility rule.", { size: 12.5, cls: "ink t" });
  body += text(58, 385, "A module admin page links that one asset and composes components — zero authored CSS.", { size: 12.5, cls: "muted t" });
  return svg({ width: w, height: h, title: "The design system layers: pk-design tokens feed tw utility classes, styleengine renders the CSS, and pk-ui components compose it; the admin shell serves one derived stylesheet.", body });
}

function palette() {
  const tokens = [
    ["color.surface.canvas", "#f2efe7", "Page background (warm paper)", "#15221f"],
    ["color.surface.primary", "#fffdf7", "Cards, inputs, raised surfaces", "#15221f"],
    ["color.surface.muted", "#e9e4d8", "Muted panels, disabled fills", "#15221f"],
    ["color.text.primary", "#15221f", "Ink", "#f9fff9"],
    ["color.text.muted", "#5f6b65", "Supporting copy", "#f9fff9"],
    ["color.border.default", "#cbc5b8", "Hairlines", "#15221f"],
    ["color.border.strong", "#8f988f", "Emphasized rules", "#15221f"],
    ["color.accent.default", "#0f5d4e", "Brand / action (deep green)", "#f9fff9"],
    ["color.accent.hover", "#0a493e", "Action hover", "#f9fff9"],
    ["color.accent.on", "#f9fff9", "Text on accent", "#15221f"],
    ["color.signal", "#d8f35d", "Lime highlight / primary CTA", "#15221f"],
    ["color.focus", "#326de6", "Focus rings, informational", "#f9fff9"],
    ["color.status.ok", "#12715d", "Success", "#f9fff9"],
    ["color.status.okbg", "#dcf3e8", "Success background", "#15221f"],
    ["color.status.warning", "#9a5318", "Warning", "#f9fff9"],
    ["color.status.warningbg", "#fff0d2", "Warning background", "#15221f"],
    ["color.status.danger", "#9e3833", "Danger", "#f9fff9"],
    ["color.status.dangerbg", "#fbe5e2", "Danger background", "#15221f"],
    ["color.sidebar.bg", "#12201d", "Dark field navigation", "#eff4e9"],
    ["color.sidebar.text", "#eff4e9", "Sidebar text", "#15221f"],
    ["color.sidebar.muted", "#aebbb2", "Sidebar muted", "#15221f"],
  ];
  const cols = 3;
  const cw = 330;
  const ch = 78;
  const gapX = 15;
  const gapY = 14;
  const rows = Math.ceil(tokens.length / cols);
  const w = 40 * 2 + cols * cw + (cols - 1) * gapX;
  const h = 96 + rows * (ch + gapY) + 20;
  let body = "";
  body += text(40, 42, "themes.Default() — the palette every consumer draws from", { size: 22, weight: 700 });
  body += text(40, 66, "Values come from pk-design/pkg/themes/default.go. Swatches below are the literal hex values.", { size: 14, cls: "muted t" });
  tokens.forEach(([token, hex, role, on], index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const x = 40 + col * (cw + gapX);
    const y = 90 + row * (ch + gapY);
    body += card(x, y, cw, ch, { cls: "card-strong", rx: 10 });
    body += `<rect x="${x + 10}" y="${y + 10}" width="58" height="58" rx="8" fill="${hex}" stroke="#cbc5b8" stroke-width="1"/>`;
    body += text(x + 39, y + 44, "Aa", { size: 14, cls: "t", weight: 700, anchor: "middle", extra: `fill="${on}"` });
    body += text(x + 80, y + 28, token, { size: 12.5, cls: "ink m", weight: 700 });
    body += text(x + 80, y + 46, hex, { size: 12, cls: "accent m", weight: 600 });
    body += text(x + 80, y + 64, role, { size: 11.5, cls: "muted t" });
  });
  return svg({ width: w, height: h, title: "The pk-design default palette as swatches with token names, hex values, and roles.", body });
}

function canonicalId() {
  const w = 1100;
  const h = 300;
  let body = "";
  body += text(40, 42, "How an entity id travels in a path", { size: 22, weight: 700 });
  body += text(40, 66, "The id is hex-encoded and prefixed with id- so it is always exactly one URL path segment, however odd its bytes.", { size: 14, cls: "muted t" });
  const boxes = [
    { kicker: "1 · the identifier", value: "1787466721729910452-tenant_local-welcome", note: "what the API returns as \"id\"", cls: "card-strong" },
    { kicker: "2 · lowercase hex of its bytes", value: "31373837…77656c636f6d65", note: "printf '%s' \"$ID\" | od -An -tx1", cls: "card-strong" },
    { kicker: "3 · prefix id-", value: "id-31373837…77656c636f6d65", note: "one opaque path segment", cls: "okbg" },
  ];
  const cw = 320;
  const gap = 30;
  boxes.forEach((box, index) => {
    const x = 40 + index * (cw + gap);
    const y = 96;
    body += card(x, y, cw, 104, { cls: box.cls, rx: 12, strokeWidth: box.cls === "okbg" ? 0 : 1.5 });
    body += text(x + 16, y + 26, box.kicker, { size: 11, cls: "accent t", weight: 700, extra: 'letter-spacing="1.2"' });
    body += text(x + 16, y + 56, box.value, { size: 12, cls: "ink m", weight: 700 });
    body += text(x + 16, y + 82, box.note, { size: 11.5, cls: "muted m" });
    if (index < boxes.length - 1) {
      body += arrow(x + cw + 4, y + 52, x + cw + gap - 4, y + 52, { cls: "arrow-accent", marker: "head-accent" });
    }
  });
  body += card(40, 222, 1020, 56, { cls: "dark", rx: 10, strokeWidth: 0 });
  body += text(58, 246, "GET /api/v1/content/id-31373837…77656c636f6d65", { size: 14, cls: "signal m", weight: 700 });
  body += text(58, 266, "raw id · uppercase hex · percent-escapes  →  400 (malformed), never 404. pk-client and portslib.EntityIDFromPath do this for you.", { size: 11.5, cls: "dark-muted t" });
  return svg({ width: w, height: h, title: "Canonical entity id path segment: the identifier is hex-encoded and prefixed with id-; raw or non-canonical spellings return 400.", body });
}

function credentials() {
  const w = 1100;
  const h = 330;
  let body = "";
  body += text(40, 42, "Two kinds of credential, one Authorization header", { size: 22, weight: 700 });
  body += text(40, 66, "Both travel as Authorization: Bearer <token>. They differ in who holds them and what they may do.", { size: 14, cls: "muted t" });
  const cards = [
    {
      title: "Session",
      who: "a person who logged in",
      lines: ["POST /api/v1/auth/sessions → { \"id\": … }", "or the pk_session cookie set by /admin/login", "carries the user's capabilities: the seeded", "operator has admin + console:access", "expires after 24 h; DELETE to log out"],
      cls: "card-strong",
    },
    {
      title: "API key",
      who: "a machine or script",
      lines: ["POST /api/v1/api-keys → { \"plaintext\": \"pk_…\" }", "shown once; only the prefix is stored", "explicit scopes: content:read, users:write, …", "cannot hold admin or console:access", "revoke with DELETE /api/v1/api-keys/{id}"],
      cls: "card-strong",
    },
  ];
  cards.forEach((item, index) => {
    const x = 40 + index * 520;
    const y = 96;
    body += card(x, y, 500, 200, { cls: item.cls, rx: 12 });
    body += text(x + 18, y + 32, item.title, { size: 18, weight: 700 });
    body += badge(x + 500 - 18 - (item.who.length * 6.6 + 18), y + 16, item.who, { cls: "okbg", textCls: "ok t" });
    body += lines(x + 18, y + 64, item.lines, { size: 12.5, cls: "muted m", leading: 24 });
  });
  return svg({ width: w, height: h, title: "Sessions versus API keys: both are bearer tokens; sessions belong to people and can hold admin capabilities, API keys belong to machines and hold explicit scopes only.", body });
}

const diagrams = {
  "journey.svg": journey,
  "one-process.svg": onePprocess,
  "architecture.svg": architecture,
  "request-lifecycle.svg": requestLifecycle,
  "stored-vs-displayed.svg": storedVsDisplayed,
  "extension-seam.svg": extensionSeam,
  "design-layers.svg": designLayers,
  "palette.svg": palette,
  "canonical-id.svg": canonicalId,
  "credentials.svg": credentials,
};

await fs.mkdir(outDir, { recursive: true });
for (const [name, render] of Object.entries(diagrams)) {
  await fs.writeFile(path.join(outDir, name), render());
}
console.log(`Wrote ${Object.keys(diagrams).length} diagrams to ${path.relative(workspaceRoot, outDir)}.`);
