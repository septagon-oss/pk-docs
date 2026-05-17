import http from "node:http";
import { promises as fs } from "node:fs";
import path from "node:path";

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
};

export async function startDevServer({ rootDir, port, host = "127.0.0.1" }) {
  const server = http.createServer(async (request, response) => {
    try {
      const target = await findStaticFile(rootDir, request.url);
      const data = await fs.readFile(target);
      response.writeHead(200, {
        "Content-Type": contentTypes[path.extname(target)] ?? "application/octet-stream",
      });
      response.end(data);
    } catch {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
    }
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.off("error", reject);
      resolve();
    });
  });
  return server;
}

async function findStaticFile(rootDir, rawURL) {
  const candidates = routeCandidates(rawURL);
  let lastError = null;
  for (const candidate of candidates) {
    const target = resolveStaticPath(rootDir, candidate);
    try {
      const stat = await fs.stat(target);
      if (stat.isFile()) {
        return target;
      }
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError ?? new Error(`No static file matched ${rawURL ?? "/"}`);
}

function routeCandidates(rawURL) {
  const url = new URL(rawURL ?? "/", "http://platformkit.local");
  const pathname = decodeURIComponent(url.pathname);
  if (pathname.includes("\0")) {
    throw new Error("Invalid path");
  }
  const normalized = path.posix.normalize(pathname);
  const safePath = normalized.startsWith("/") ? normalized : `/${normalized}`;
  if (safePath === "/" || safePath.endsWith("/")) {
    return [`${safePath}index.html`];
  }
  if (path.posix.extname(safePath)) {
    return [safePath];
  }
  return [safePath, `${safePath}/index.html`, `${safePath}.html`];
}

function resolveStaticPath(rootDir, routePath) {
  const root = path.resolve(rootDir);
  const target = path.resolve(root, routePath.replace(/^\/+/, ""));
  if (target !== root && !target.startsWith(`${root}${path.sep}`)) {
    throw new Error("Path escapes static root");
  }
  return target;
}
