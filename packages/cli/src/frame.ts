// `lesson frame --at t -o f.png` — headless Chromium screenshot of the built site
// at time t (?t&nochrome). Deterministic because state is a pure function of t.

import { chromium } from "playwright";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { serveFromDir } from "./static-server.js";

export interface FrameOptions {
  t: number;
  out: string;
  size?: string; // "1280x720"
}

export async function renderFrame(siteDir: string, opts: FrameOptions): Promise<void> {
  const server = staticServer(siteDir);
  const port = await new Promise<number>((res) => server.listen(0, "127.0.0.1", () => res((server.address() as AddressInfo).port)));
  const [w, h] = (opts.size ?? "1280x720").split("x").map(Number);

  const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
  try {
    const page = await browser.newPage({ viewport: { width: w!, height: h! } });
    await page.goto(`http://localhost:${port}/?t=${opts.t}&nochrome`);
    await page.waitForFunction(() => (globalThis as unknown as { __player?: { clock: unknown } }).__player?.clock !== undefined);
    await page.waitForTimeout(500); // let the seek and WebGL compositor settle
    await page.screenshot({ path: opts.out });
  } finally {
    await browser.close();
    server.close();
  }
}

function staticServer(dir: string): Server {
  return createServer((req, res) => void serveFromDir(dir, req, res));
}
