import { afterEach, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { mkdtemp, mkdir, realpath, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { brotliCompressSync, gzipSync } from "node:zlib";
import { serveFromDir, resolveStaticFile } from "./static-server.js";

const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
});

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "tangible-static-"));
  const site = join(root, "site");
  const outside = join(root, "outside.txt");
  await mkdir(site);
  await writeFile(join(site, "index.html"), "<h1>safe</h1>");
  await writeFile(join(site, "audio.wav"), "0123456789");
  await writeFile(join(site, "audio.m4a"), "m4a");
  const script = "const lesson = 'tangible';\n".repeat(100);
  await writeFile(join(site, "player.js"), script);
  await writeFile(join(site, "player.js.br"), brotliCompressSync(script));
  await writeFile(join(site, "player.js.gz"), gzipSync(script));
  await writeFile(outside, "secret");
  return { site, outside, script };
}

async function start(site: string): Promise<string> {
  const server = createServer((req, res) => void serveFromDir(site, req, res));
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

describe("static server containment", () => {
  it("resolves ordinary files but rejects traversal and symlink escapes", async () => {
    const { site, outside } = await fixture();
    await symlink(outside, join(site, "leak.txt"));

    expect((await resolveStaticFile(site, "/"))?.file).toBe(await realpath(join(site, "index.html")));
    expect(await resolveStaticFile(site, "/..%2foutside.txt")).toBeUndefined();
    expect(await resolveStaticFile(site, "/%2e%2e%5coutside.txt")).toBeUndefined();
    expect(await resolveStaticFile(site, "/leak.txt")).toBeUndefined();
    expect(await resolveStaticFile(site, "/missing.txt")).toBeUndefined();
  });

  it("serves GET, HEAD, and bounded ranges with nosniff", async () => {
    const { site } = await fixture();
    const base = await start(site);

    const page = await fetch(base);
    expect(page.status).toBe(200);
    expect(page.headers.get("x-content-type-options")).toBe("nosniff");
    expect(await page.text()).toBe("<h1>safe</h1>");

    const head = await fetch(`${base}/audio.wav`, { method: "HEAD" });
    expect(head.status).toBe(200);
    expect(head.headers.get("content-length")).toBe("10");

    const m4a = await fetch(`${base}/audio.m4a`, { method: "HEAD" });
    expect(m4a.headers.get("content-type")).toBe("audio/mp4");
    expect(await head.text()).toBe("");

    const range = await fetch(`${base}/audio.wav`, { headers: { range: "bytes=-4" } });
    expect(range.status).toBe(206);
    expect(range.headers.get("content-range")).toBe("bytes 6-9/10");
    expect(await range.text()).toBe("6789");
  });

  it("rejects unsafe paths, unsupported methods, and malformed ranges", async () => {
    const { site } = await fixture();
    const base = await start(site);

    expect((await fetch(`${base}/..%2foutside.txt`)).status).toBe(404);
    expect((await fetch(base, { method: "POST" })).status).toBe(405);
    expect((await fetch(`${base}/audio.wav`, { headers: { range: "bytes=99-100" } })).status).toBe(416);
  });

  it("negotiates precompressed text without changing range responses", async () => {
    const { site, script } = await fixture();
    const base = await start(site);

    const brotli = await fetch(`${base}/player.js`, { headers: { "accept-encoding": "br, gzip" } });
    expect(brotli.headers.get("content-encoding")).toBe("br");
    expect(brotli.headers.get("vary")).toBe("Accept-Encoding");
    expect(await brotli.text()).toBe(script);

    const gzip = await fetch(`${base}/player.js`, { headers: { "accept-encoding": "gzip;q=1, br;q=0.5" } });
    expect(gzip.headers.get("content-encoding")).toBe("gzip");
    expect(await gzip.text()).toBe(script);

    const identity = await fetch(`${base}/player.js`, { headers: { "accept-encoding": "identity" } });
    expect(identity.headers.get("content-encoding")).toBeNull();
    expect(await identity.text()).toBe(script);

    const head = await fetch(`${base}/player.js`, { method: "HEAD", headers: { "accept-encoding": "br" } });
    expect(head.headers.get("content-encoding")).toBe("br");
    expect(head.headers.get("content-length")).toBe(String(brotliCompressSync(script).length));
    expect(await head.text()).toBe("");

    const range = await fetch(`${base}/player.js`, {
      headers: { "accept-encoding": "br", range: "bytes=0-4" },
    });
    expect(range.status).toBe(206);
    expect(range.headers.get("content-encoding")).toBeNull();
    expect(await range.text()).toBe(script.slice(0, 5));
  });
});
