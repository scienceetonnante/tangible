import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { buildIndex, evaluate } from "../packages/core/dist/index.js";

// Compiled tracks (produced by prepare.mjs) — the ground truth for seek checks.
const tracks = JSON.parse(readFileSync("lessons/unit-circle/build/fr/tracks.json", "utf8"));
const idx = buildIndex(tracks.tracks, {
  theta: { type: { kind: "scalar" }, default: 0, interpolate: "lerp", ownership: "script" },
});
const scriptedTheta = (t: number) => evaluate(idx, t).theta as number;

async function ready(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.waitForFunction(() => (window as any).__player?.clock.duration > 0, null, { timeout: 20000 });
}

test("seek correctness: browser state matches core evaluation at random times", async ({ page }) => {
  await ready(page);
  for (const t of [0, 3, 7, 11, 14, 19]) {
    const got = await page.evaluate((t) => {
      const p = (window as any).__player;
      p.clock.seek(t);
      p.driver.tick();
      return p.store.plain.theta as number;
    }, t);
    expect(Math.abs(got - scriptedTheta(t))).toBeLessThan(1e-6);
  }
});

test("playback advances state and the pause gate stops at the checkpoint", async ({ page }) => {
  await ready(page);
  const pauseT = tracks.pauses[0].t as number;
  await page.evaluate((pt) => {
    const p = (window as any).__player;
    p.clock.seek(pt - 0.4);
    p.clock.play();
  }, pauseT);
  await page.waitForFunction(() => (window as any).__player.clock.playing === false, null, { timeout: 6000 });
  const display = await page.evaluate(() => getComputedStyle((window as any).__player.pauseGate.el).display);
  expect(display).toBe("flex");
});

test("catch-up: a touched parameter holds, then glides back to scripted", async ({ page }) => {
  await ready(page);
  // Seek first and let the rAF loop settle (a seek clears interactions).
  await page.evaluate(() => {
    const p = (window as any).__player;
    p.clock.seek(12);
    p.clock.pause();
  });
  await page.waitForTimeout(100);
  // Now simulate an interaction and observe it holds this frame.
  const held = await page.evaluate(() => {
    const p = (window as any).__player;
    p.store.touch("theta", 0.123, performance.now() / 1000, 12);
    p.driver.tick();
    return p.store.plain.theta as number;
  });
  expect(Math.abs(held - 0.123)).toBeLessThan(1e-6); // user value during the hold

  await page.waitForTimeout(4500); // past the 3s hold + exponential glide
  const back = await page.evaluate(() => (window as any).__player.store.plain.theta as number);
  expect(Math.abs(back - scriptedTheta(12))).toBeLessThan(0.05);
});
