// `lesson frame --at t -o f.png` — headless Chromium screenshot of the built site
// at time t (?t&nochrome). Deterministic because state is a pure function of t.

import { chromium } from "playwright";
import { createServer, type Server } from "node:http";
import { readFile } from "node:fs/promises";
import { join, extname } from "node:path";
import type { AddressInfo } from "node:net";

const TYPES: Record<string, string> = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".json": "application/json",
  ".css": "text/css",
  ".vtt": "text/vtt",
  ".wav": "audio/wav",
};

export interface FrameOptions {
  t: number;
  out: string;
  size?: string; // "1280x720"
  lang?: string;
}

export async function renderFrame(siteDir: string, opts: FrameOptions): Promise<void> {
  const server = staticServer(siteDir);
  const port = await new Promise<number>((res) => server.listen(0, () => res((server.address() as AddressInfo).port)));
  const [w, h] = (opts.size ?? "1280x720").split("x").map(Number);

  const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
  try {
    const page = await browser.newPage({ viewport: { width: w!, height: h! } });
    const langQ = opts.lang ? `&lang=${opts.lang}` : "";
    await page.goto(`http://localhost:${port}/?t=${opts.t}&nochrome${langQ}`);
    await page.waitForFunction(() => (globalThis as unknown as { __player?: { clock: unknown } }).__player?.clock !== undefined);
    await page.waitForTimeout(200); // let the seek + a render frame settle
    await page.screenshot({ path: opts.out });
  } finally {
    await browser.close();
    server.close();
  }
}

function staticServer(dir: string): Server {
  return createServer(async (req, res) => {
    const path = req.url === "/" || req.url?.startsWith("/?") ? "/index.html" : (req.url?.split("?")[0] ?? "/");
    try {
      const body = await readFile(join(dir, path));
      res.writeHead(200, { "content-type": TYPES[extname(path)] ?? "application/octet-stream" });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end("not found");
    }
  });
}
