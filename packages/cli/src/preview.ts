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
  initialError?: string;
}

export function preview(opts: PreviewOptions): Server {
  const port = opts.port ?? 5179;
  const host = opts.host ?? "127.0.0.1";
  const clients = new Set<ServerResponse>();
  let buildError = opts.initialError;

  const server = createServer((req, res) => {
    if (req.url === "/__reload") {
      res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" });
      clients.add(res);
      req.on("close", () => clients.delete(res));
      return;
    }
    if (buildError && (req.url === "/" || req.url === "/index.html")) {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
      res.end(errorPage(buildError));
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
        buildError = undefined;
        reload(clients);
        console.error("rebuilt → reloaded");
      } catch (e) {
        buildError = e instanceof Error ? e.message : String(e);
        reload(clients);
        console.error(`rebuild failed:\n${buildError}`);
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

function reload(clients: Set<ServerResponse>): void {
  for (const client of clients) client.write("data: reload\n\n");
}

function errorPage(message: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Lesson preview error</title>
<style>
html { color-scheme: dark; }
body { margin: 0; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; background: #16090b; color: #ffd8dc; }
main { box-sizing: border-box; width: min(900px, calc(100% - 32px)); margin: 8vh auto; padding: 28px; border: 1px solid #e5484d; border-radius: 12px; background: #2b1014; }
h1 { margin-top: 0; color: #ff6369; font: 700 24px system-ui, sans-serif; }
pre { margin: 20px 0; overflow-wrap: anywhere; white-space: pre-wrap; }
p { margin-bottom: 0; color: #ffb3ba; font-family: system-ui, sans-serif; }
</style>
</head>
<body>
<main role="alert">
<h1>Lesson could not build</h1>
<pre>${escapeHtml(message)}</pre>
<p>Fix the source file and save it. This preview will reload automatically.</p>
</main>
${RELOAD_SNIPPET}
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]!);
}
