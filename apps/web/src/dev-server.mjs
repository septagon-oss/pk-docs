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
      const urlPath = request.url === "/" ? "/index.html" : request.url ?? "/index.html";
      const requestPath = urlPath.endsWith("/") ? `${urlPath}index.html` : urlPath;
      const target = path.join(rootDir, path.normalize(requestPath).replace(/^(\.\.(\/|\\|$))+/, ""));
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
