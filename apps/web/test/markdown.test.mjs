import test from "node:test";
import assert from "node:assert/strict";

import { extractHeadings, renderMarkdown, slugifyHeading } from "../src/markdown.mjs";

test("renderMarkdown renders GitHub-flavoured pipe tables with alignment and escaped pipes", () => {
  const html = renderMarkdown("| Capability | Provides |\n|---|:-:|\n| `Tenants` | read \\| update |\n| Users | records |");

  assert.match(html, /<div class="pk-table-wrap"><table><thead><tr><th scope="col">Capability<\/th><th scope="col" style="text-align:center">Provides<\/th>/);
  assert.match(html, /<td><code>Tenants<\/code><\/td><td style="text-align:center">read \| update<\/td>/);
  assert.match(html, /<td>Users<\/td><td style="text-align:center">records<\/td>/);
});

test("renderMarkdown renders GitHub alert blockquotes as callouts and plain quotes as blockquotes", () => {
  const html = renderMarkdown("> [!WARNING]\n> Never expose it.\n> See [docs](./a.md).\n\n> just a quote");

  assert.match(html, /<aside class="pk-callout pk-callout--warning" role="note"><p class="pk-callout__title">.*Warning<\/p><div class="pk-callout__body"><p>Never expose it\. See <a href="\.\/a\.md">docs<\/a>\.<\/p><\/div><\/aside>/);
  assert.match(html, /<blockquote><p>just a quote<\/p><\/blockquote>/);
});

test("renderMarkdown renders a standalone image as a captioned figure with resolved src and intrinsic size", () => {
  const html = renderMarkdown('![The console](../assets/screenshots/admin.png "After login")', {
    resolveAsset: (src) => ({ src: src.replace("../assets", "/docs/assets"), width: 2000, height: 1250 }),
  });

  assert.equal(
    html,
    '<figure class="pk-figure"><img src="/docs/assets/screenshots/admin.png" alt="The console" width="2000" height="1250" loading="lazy" /><figcaption>After login</figcaption></figure>',
  );
});

test("renderMarkdown marks svg figures as diagrams and keeps inline images inline", () => {
  const html = renderMarkdown("![Map](../assets/diagrams/map.svg)\n\nSee the ![icon](icon.png) inline.", {
    resolveAsset: (src) => src,
  });

  assert.match(html, /<figure class="pk-figure pk-figure--diagram"><img src="\.\.\/assets\/diagrams\/map\.svg" alt="Map" loading="lazy" \/><\/figure>/);
  assert.match(html, /<p>See the <img src="icon\.png" alt="icon" loading="lazy" \/> inline\.<\/p>/);
});

test("renderMarkdown supports nested lists, lazy continuation lines, and task items", () => {
  const html = renderMarkdown("1. Build on `ModuleEnv.DB`, the pool.\n   The pool is shared.\n2. Apply migrations.\n   - [x] embedded\n   - [ ] append-only\n\n- plain");

  assert.match(html, /<ol><li>Build on <code>ModuleEnv\.DB<\/code>, the pool\. The pool is shared\.<\/li><li>Apply migrations\.\n<ul class="pk-task-list"><li class="pk-task pk-task--done"><input type="checkbox" disabled checked aria-hidden="true" \/> embedded<\/li><li class="pk-task"><input type="checkbox" disabled aria-hidden="true" \/> append-only<\/li><\/ul><\/li><\/ol>/);
  assert.match(html, /<ul><li>plain<\/li><\/ul>/);
});

test("renderMarkdown gives headings GitHub-compatible ids, anchors, and step markers", () => {
  const headings = [];
  const html = renderMarkdown("## 1. Run it\n\n## Get the `platformkit` command\n\n### Step 2: Log in\n\n## Run it", { collectHeadings: headings });

  assert.match(html, /<h2 id="1-run-it" class="pk-step" data-step="1">Run it<a class="pk-anchor" href="#1-run-it"/);
  assert.match(html, /<h2 id="get-the-platformkit-command">Get the <code>platformkit<\/code> command/);
  assert.match(html, /<h3 id="step-2-log-in" class="pk-step" data-step="2">Log in/);
  assert.match(html, /<h2 id="run-it">Run it/);
  assert.deepEqual(
    headings.map((heading) => [heading.level, heading.id, heading.text, heading.step]),
    [
      [2, "1-run-it", "Run it", 1],
      [2, "get-the-platformkit-command", "Get the platformkit command", null],
      [3, "step-2-log-in", "Log in", 2],
      [2, "run-it", "Run it", null],
    ],
  );
  assert.deepEqual(extractHeadings("# Title\n\n## Section").map((heading) => heading.id), ["title", "section"]);
  assert.equal(slugifyHeading("3. The ten rules (and what breaks if you skip one)"), "3-the-ten-rules-and-what-breaks-if-you-skip-one");
});

test("renderMarkdown applies inline formatting across soft wraps and inside link labels", () => {
  const html = renderMarkdown("The public [`septagon-oss/platformkit`](https://example.test/p) repo.\nThat is **No Docker, no\nserver.** Keep `a*b*c` literal and *em* too.\nA hard break  \nfollows.");

  assert.match(html, /<a href="https:\/\/example\.test\/p" rel="noopener"><code>septagon-oss\/platformkit<\/code><\/a>/);
  assert.match(html, /<strong>No Docker, no server\.<\/strong>/);
  assert.match(html, /<code>a\*b\*c<\/code> literal and <em>em<\/em> too\. A hard break<br \/>follows\./);
});

test("renderMarkdown wraps fenced code with a language bar and copy button while keeping the language class", () => {
  const html = renderMarkdown("```bash\necho <hi>\n```\n\n```text\nok\n```");

  assert.match(html, /<div class="pk-code" data-language="bash"><div class="pk-code__bar"><span class="pk-code__lang">Shell<\/span><button type="button" class="pk-code__copy" data-copy aria-label="Copy code">Copy<\/button><\/div><pre><code class="language-bash">echo &lt;hi&gt;<\/code><\/pre><\/div>/);
  assert.match(html, /<span class="pk-code__lang">Output<\/span>/);
});

test("renderMarkdown passes whitelisted raw HTML blocks through and renders horizontal rules", () => {
  const html = renderMarkdown("<details>\n<summary>More</summary>\n\nHidden para.\n\n</details>\n\n---\n\nAfter.");

  assert.match(html, /<details>\n<summary>More<\/summary>\n<p>Hidden para\.<\/p>\n<\/details>\n<hr \/>\n<p>After\.<\/p>/);
});

test("renderMarkdown escapes HTML in ordinary text", () => {
  const html = renderMarkdown("Use <resource>:read and a <script>alert(1)</script> tag.");

  assert.equal(html, "<p>Use &lt;resource&gt;:read and a &lt;script&gt;alert(1)&lt;/script&gt; tag.</p>");
});
