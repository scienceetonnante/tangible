// Minimal static file server for the bundled harness (Playwright webServer).
// Supports HTTP Range requests — Safari/WebKit refuses to play <audio> otherwise.
import { createServer } from "node:http";
import { stat, readFile } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { join, extname } from "node:path";

const dir = join(process.cwd(), "e2e/dist");
const types = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".vtt": "text/vtt", ".wav": "audio/wav", ".webm": "audio/webm", ".m4a": "audio/mp4" };

createServer(async (req, res) => {
  if (req.url === "/api/answer" && req.method === "POST") {
    const answer = await readFile(join(dir, "answer.json"));
    res.writeHead(200, { "content-type": "application/json", "content-length": answer.length });
    res.end(answer);
    return;
  }
  const path = req.url === "/" || req.url.startsWith("/?") ? "/index.html" : req.url.split("?")[0];
  const file = join(dir, path);
  let s;
  try {
    s = await stat(file);
  } catch {
    res.writeHead(404);
    res.end("not found");
    return;
  }
  const type = types[extname(path)] ?? "application/octet-stream";
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
    res.writeHead(206, { "content-type": type, "accept-ranges": "bytes", "content-range": `bytes ${start}-${end}/${s.size}`, "content-length": end - start + 1 });
    createReadStream(file, { start, end }).pipe(res);
  } else {
    res.writeHead(200, { "content-type": type, "accept-ranges": "bytes", "content-length": s.size });
    createReadStream(file).pipe(res);
  }
}).listen(5178, () => console.log("harness on http://localhost:5178"));
