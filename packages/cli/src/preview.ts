// `lesson preview` — serve the built static bundle, watch the scene + scripts, and
// rebuild + live-reload the browser on save. (Full Vite HMR is a deferred nicety;
// this gives the fast authoring loop the plan calls for.)

import { createServer, type ServerResponse } from "node:http";
import { watch } from "node:fs";
import { serveFromDir } from "./static-server.js";
import type { AssistantApiHandler } from "./assistant-server.js";

const RELOAD_SNIPPET = `<script>new EventSource("/__reload").onmessage=()=>location.reload()</script>`;

export interface PreviewOptions {
  siteDir: string;
  watchPaths: string[];
  rebuild: () => Promise<void>;
  port?: number;
  assistantApi?: AssistantApiHandler;
}

export function preview(opts: PreviewOptions): void {
  const port = opts.port ?? 5179;
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
