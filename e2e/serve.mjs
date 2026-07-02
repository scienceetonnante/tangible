// Minimal static file server for the bundled harness (Playwright webServer).
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, extname } from "node:path";

const dir = join(process.cwd(), "e2e/dist");
const types = { ".html": "text/html", ".js": "text/javascript" };

createServer(async (req, res) => {
  const path = req.url === "/" ? "/index.html" : (req.url ?? "/");
  try {
    const body = await readFile(join(dir, path));
    res.writeHead(200, { "content-type": types[extname(path)] ?? "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end("not found");
  }
}).listen(5178, () => console.log("harness on http://localhost:5178"));
