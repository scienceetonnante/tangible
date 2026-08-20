// `lesson preview` — serve the built static bundle, watch the scene + scripts, and
// rebuild + live-reload the browser on save. (Full Vite HMR is a deferred nicety;
// this gives the fast authoring loop the plan calls for.)

import { createServer, type Server, type ServerResponse } from "node:http";
import { watch, type FSWatcher } from "node:fs";
import { serveFromDir } from "./static-server.js";
import type { AssistantApiHandler } from "./assistant-server.js";

const RELOAD_SNIPPET = `<script>new EventSource("/__reload").onmessage=()=>location.reload()</script>`;

export interface PreviewOptions {
  siteDir: string;
  watchPaths: string[];
  rebuild: () => Promise<void | string[]>;
  port?: number;
  host?: string;
  assistantApi?: AssistantApiHandler;
  label?: string;
}

export function preview(opts: PreviewOptions): Server {
  const port = opts.port ?? 5179;
  const host = opts.host ?? "127.0.0.1";
  const clients = new Set<ServerResponse>();

  const server = createServer((req, res) => {
    if (req.url === "/__reload") {
      res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" });
      clients.add(res);
      req.on("close", () => clients.delete(res));
      return;
    }
    void (async () => {
      if (opts.assistantApi && await opts.assistantApi(req, res)) return;
      await serveFromDir(opts.siteDir, req, res, (html) => html.replace("</body>", `${RELOAD_SNIPPET}</body>`));
    })();
  });
  let timer: NodeJS.Timeout | undefined;
  const watchers = new Map<string, FSWatcher>();
  const onChange = () => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      try {
        const nextWatchPaths = await opts.rebuild();
        if (nextWatchPaths) syncWatchers(nextWatchPaths);
        for (const c of clients) c.write("data: reload\n\n");
        console.error("rebuilt → reloaded");
      } catch (e) {
        console.error(`rebuild failed: ${String(e)}`);
      }
    }, 150);
  };

  const syncWatchers = (paths: string[]) => {
    const next = new Set(paths);
    for (const [path, watcher] of watchers) {
      if (next.has(path)) continue;
      watcher.close();
      watchers.delete(path);
    }
    for (const path of next) {
      if (!watchers.has(path)) watchers.set(path, watch(path, onChange));
    }
  };

  syncWatchers(opts.watchPaths);
  server.on("close", () => {
    clearTimeout(timer);
    for (const watcher of watchers.values()) watcher.close();
    watchers.clear();
  });
  server.listen(port, host, () => {
    const address = server.address();
    const actualPort = typeof address === "object" && address ? address.port : port;
    console.error(`${opts.label ?? "preview"} on http://${host}:${actualPort} (watching for changes)`);
  });
  return server;
}
