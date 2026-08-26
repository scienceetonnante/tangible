import { afterEach, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { once } from "node:events";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { preview } from "./preview.js";

let server: Server | undefined;

afterEach(async () => {
  if (!server) return;
  await new Promise<void>((resolve) => server!.close(() => resolve()));
  server = undefined;
});

describe("preview networking", () => {
  it("binds to loopback by default", async () => {
    const siteDir = await mkdtemp(join(tmpdir(), "tangible-preview-"));
    await writeFile(join(siteDir, "index.html"), "<main>preview</main>");
    server = preview({ siteDir, watchPaths: [], rebuild: async () => {}, port: 0 });
    await once(server, "listening");

    expect((server.address() as AddressInfo).address).toBe("127.0.0.1");
  });

  it("shows an initial build error and recovers after the source is fixed", async () => {
    const siteDir = await mkdtemp(join(tmpdir(), "tangible-preview-"));
    const source = join(siteDir, "script.md");
    await writeFile(join(siteDir, "index.html"), "<main>working preview</main>");
    await writeFile(source, "broken");
    server = preview({
      siteDir,
      watchPaths: [source],
      rebuild: async () => {},
      initialError: 'script.md:53:1: error: adamw.lr: 0.0075 is out of range [0.02, 0.16] <unsafe>',
      port: 0,
    });
    await once(server, "listening");
    const port = (server.address() as AddressInfo).port;

    const errorHtml = await fetch(`http://127.0.0.1:${port}`).then((response) => response.text());
    expect(errorHtml).toContain("Lesson could not build");
    expect(errorHtml).toContain("adamw.lr: 0.0075 is out of range");
    expect(errorHtml).toContain("&lt;unsafe&gt;");

    await writeFile(source, "fixed");
    await eventually(async () => (await fetch(`http://127.0.0.1:${port}`)).text(), "working preview");
  });
});

async function eventually(read: () => Promise<string>, expected: string): Promise<void> {
  const deadline = Date.now() + 3_000;
  while (Date.now() < deadline) {
    if ((await read()).includes(expected)) return;
    await new Promise((resolve) => setTimeout(resolve, 30));
  }
  expect(await read()).toContain(expected);
}
