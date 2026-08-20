// Range-capable static file serving shared by `preview` and `frame`. HTTP Range
// support is required for Safari/WebKit to play <audio> (it refuses a plain 200).

import { stat, readFile, realpath } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { extname, isAbsolute, relative, resolve, sep } from "node:path";
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
  if (req.method !== undefined && req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { allow: "GET, HEAD", "x-content-type-options": "nosniff" });
    res.end("method not allowed");
    return;
  }

  const resolved = await resolveStaticFile(dir, req.url ?? "/");
  if (!resolved) {
    res.writeHead(404, { "x-content-type-options": "nosniff" });
    res.end("not found");
    return;
  }
  const { file, path, size } = resolved;
  const type = TYPES[extname(path)] ?? "application/octet-stream";

  if (path.endsWith(".html") && transformHtml) {
    const html = transformHtml(await readFile(file, "utf8"));
    res.writeHead(200, {
      "content-type": "text/html",
      "content-length": Buffer.byteLength(html),
      "x-content-type-options": "nosniff",
    });
    if (req.method !== "HEAD") res.end(html);
    else res.end();
    return;
  }

  const range = req.headers.range;
  if (range) {
    const parsed = parseRange(range, size);
    if (!parsed) {
      res.writeHead(416, { "content-range": `bytes */${size}`, "x-content-type-options": "nosniff" });
      res.end();
      return;
    }
    const { start, end } = parsed;
    res.writeHead(206, {
      "content-type": type,
      "accept-ranges": "bytes",
      "content-range": `bytes ${start}-${end}/${size}`,
      "content-length": end - start + 1,
      "x-content-type-options": "nosniff",
    });
    if (req.method !== "HEAD") createReadStream(file, { start, end }).pipe(res);
    else res.end();
  } else {
    res.writeHead(200, {
      "content-type": type,
      "accept-ranges": "bytes",
      "content-length": size,
      "x-content-type-options": "nosniff",
    });
    if (req.method !== "HEAD") createReadStream(file).pipe(res);
    else res.end();
  }
}

interface ResolvedStaticFile {
  file: string;
  path: string;
  size: number;
}

/** Resolve a request to a regular file contained by the canonical site root. */
export async function resolveStaticFile(dir: string, url: string): Promise<ResolvedStaticFile | undefined> {
  let path: string;
  try {
    path = decodeURIComponent(new URL(url, "http://localhost").pathname);
  } catch {
    return undefined;
  }
  if (path.includes("\0") || path.includes("\\")) return undefined;
  if (path === "/") path = "/index.html";

  try {
    const root = await realpath(dir);
    const file = await realpath(resolve(root, `.${path}`));
    const fromRoot = relative(root, file);
    if (!fromRoot || fromRoot === ".." || fromRoot.startsWith(`..${sep}`) || isAbsolute(fromRoot)) return undefined;
    const info = await stat(file);
    if (!info.isFile()) return undefined;
    return { file, path, size: info.size };
  } catch {
    return undefined;
  }
}

function parseRange(header: string, size: number): { start: number; end: number } | undefined {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!match || (!match[1] && !match[2]) || size <= 0) return undefined;

  if (!match[1]) {
    const suffix = Number(match[2]);
    if (!Number.isSafeInteger(suffix) || suffix <= 0) return undefined;
    return { start: Math.max(0, size - suffix), end: size - 1 };
  }

  const start = Number(match[1]);
  const requestedEnd = match[2] ? Number(match[2]) : size - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(requestedEnd) || start > requestedEnd || start >= size) return undefined;
  return { start, end: Math.min(requestedEnd, size - 1) };
}
