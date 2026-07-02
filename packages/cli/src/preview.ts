// `lesson preview` — serve the built static bundle, watch the scene + scripts, and
// rebuild + live-reload the browser on save. (Full Vite HMR is a deferred nicety;
// this gives the fast authoring loop the plan calls for.)

import { createServer, type ServerResponse } from "node:http";
import { watch } from "node:fs";
import { readFile } from "node:fs/promises";
import { join, extname } from "node:path";

const TYPES: Record<string, string> = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".json": "application/json",
  ".css": "text/css",
  ".vtt": "text/vtt",
  ".wav": "audio/wav",
};

const RELOAD_SNIPPET = `<script>new EventSource("/__reload").onmessage=()=>location.reload()</script>`;

export interface PreviewOptions {
  siteDir: string;
  watchPaths: string[];
  rebuild: () => Promise<void>;
  port?: number;
}

export function preview(opts: PreviewOptions): void {
  const port = opts.port ?? 5179;
  const clients = new Set<ServerResponse>();

  const server = createServer(async (req, res) => {
    if (req.url === "/__reload") {
      res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" });
      clients.add(res);
      req.on("close", () => clients.delete(res));
      return;
    }
    const path = req.url === "/" || req.url?.startsWith("/?") ? "/index.html" : (req.url?.split("?")[0] ?? "/");
    try {
      if (path === "/index.html") {
        const html = (await readFile(join(opts.siteDir, "index.html"), "utf8")).replace("</body>", `${RELOAD_SNIPPET}</body>`);
        res.writeHead(200, { "content-type": "text/html" });
        res.end(html);
      } else {
        const body = await readFile(join(opts.siteDir, path));
        res.writeHead(200, { "content-type": TYPES[extname(path)] ?? "application/octet-stream" });
        res.end(body);
      }
    } catch {
      res.writeHead(404);
      res.end("not found");
    }
  });
  server.listen(port, () => console.error(`preview on http://localhost:${port} (watching for changes)`));

  let timer: NodeJS.Timeout | undefined;
  const onChange = () => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      try {
        await opts.rebuild();
        for (const c of clients) c.write("data: reload\n\n");
        console.error("rebuilt → reloaded");
      } catch (e) {
        console.error(`rebuild failed: ${String(e)}`);
      }
    }, 150);
  };
  for (const p of opts.watchPaths) watch(p, onChange);
}
