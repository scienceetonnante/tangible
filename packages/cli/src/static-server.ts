// Range-capable static file serving shared by `preview` and `frame`. HTTP Range
// support is required for Safari/WebKit to play <audio> (it refuses a plain 200).

import { stat, readFile } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { extname, join } from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";

const TYPES: Record<string, string> = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".json": "application/json",
  ".css": "text/css",
  ".vtt": "text/vtt",
  ".wav": "audio/wav",
  ".mp3": "audio/mpeg",
  ".webm": "audio/webm",
};

/** Serve `req` from `dir`. `transformHtml` (optional) rewrites index.html (e.g. to
 *  inject a live-reload snippet); HTML is sent whole, other files support Range. */
export async function serveFromDir(
  dir: string,
  req: IncomingMessage,
  res: ServerResponse,
  transformHtml?: (html: string) => string,
): Promise<void> {
  const url = req.url ?? "/";
  const path = url === "/" || url.startsWith("/?") ? "/index.html" : url.split("?")[0]!;
  const file = join(dir, path);

  let s;
  try {
    s = await stat(file);
  } catch {
    res.writeHead(404);
    res.end("not found");
    return;
  }
  const type = TYPES[extname(path)] ?? "application/octet-stream";

  if (path.endsWith(".html") && transformHtml) {
    const html = transformHtml(await readFile(file, "utf8"));
    res.writeHead(200, { "content-type": "text/html" });
    res.end(html);
    return;
  }

  const range = req.headers.range;
  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    const start = m && m[1] ? Number(m[1]) : 0;
    const end = m && m[2] ? Number(m[2]) : s.size - 1;
    if (start > end || start >= s.size) {
      res.writeHead(416, { "content-range": `bytes */${s.size}` });
      res.end();
      return;
    }
    res.writeHead(206, {
      "content-type": type,
      "accept-ranges": "bytes",
      "content-range": `bytes ${start}-${end}/${s.size}`,
      "content-length": end - start + 1,
    });
    createReadStream(file, { start, end }).pipe(res);
  } else {
    res.writeHead(200, { "content-type": type, "accept-ranges": "bytes", "content-length": s.size });
    createReadStream(file).pipe(res);
  }
}
