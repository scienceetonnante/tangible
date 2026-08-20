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
    const siteDir = await mkdtemp(join(tmpdir(), "narrable-preview-"));
    await writeFile(join(siteDir, "index.html"), "<main>preview</main>");
    server = preview({ siteDir, watchPaths: [], rebuild: async () => {}, port: 0 });
    await once(server, "listening");

    expect((server.address() as AddressInfo).address).toBe("127.0.0.1");
  });
});
