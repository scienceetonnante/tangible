import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { buildIndex, evaluate } from "../packages/core/dist/index.js";

// Compiled tracks (produced by prepare.mjs) — the ground truth for seek checks.
const tracks = JSON.parse(readFileSync("lessons/unit-circle/build/lesson/tracks.json", "utf8"));
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

test("checkpoint pauses after the spoken tail and resumes from the play button", async ({ page }) => {
  await ready(page);
  const pauseT = tracks.pauses[0].t as number;
  await page.evaluate((pt) => {
    const p = (window as any).__player;
    p.clock.seek(pt - 0.4);
    p.clock.play();
  }, pauseT);
  await page.waitForFunction(() => (window as any).__player.clock.playing === false, null, { timeout: 6000 });
  const stoppedAt = await page.evaluate(() => (window as any).__player.clock.t as number);
  expect(stoppedAt).toBeCloseTo(pauseT, 1);
  await expect(page.locator(".xv-gate")).toHaveCount(0);
  await expect(page.locator(".xv-assistant-input")).toBeEnabled();

  await page.locator(".xv-play").click();
  await page.waitForFunction(() => (window as any).__player.clock.playing === true);
});

test("catch-up: a paused edit freezes, then holds and glides after resume", async ({ page }) => {
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
    p.store.touch("theta", 0.123, 12);
    p.driver.tick();
    return p.store.plain.theta as number;
  });
  expect(Math.abs(held - 0.123)).toBeLessThan(1e-6); // user value during the hold

  await page.waitForTimeout(3500); // wall time does not expire a paused hold
  const stillHeld = await page.evaluate(() => (window as any).__player.store.plain.theta as number);
  expect(Math.abs(stillHeld - 0.123)).toBeLessThan(1e-6);

  await page.evaluate(() => (window as any).__player.clock.play());
  await page.waitForFunction(() => (window as any).__player.clock.t >= 14.9, null, { timeout: 8000 });
  const heldAfterResume = await page.evaluate(() => (window as any).__player.store.plain.theta as number);
  expect(Math.abs(heldAfterResume - 0.123)).toBeLessThan(1e-6);

  await page.waitForFunction(() => (window as any).__player.clock.t >= 15.5, null, { timeout: 8000 });
  const back = await page.evaluate(() => {
    const p = (window as any).__player;
    p.clock.pause();
    p.driver.tick();
    return { t: p.clock.t as number, theta: p.store.plain.theta as number };
  });
  expect(Math.abs(back.theta - scriptedTheta(back.t))).toBeLessThan(Math.abs(0.123 - scriptedTheta(back.t)));
});

test("captions remain readable and playback can restart after ending", async ({ page }) => {
  await ready(page);
  await page.locator(".xv-captions-toggle").click();
  await page.evaluate(() => {
    const player = (window as any).__player;
    player.clock.seek(0.2);
    player.driver.tick();
  });
  await expect(page.locator(".xv-captions")).not.toBeEmpty();

  await page.evaluate(() => {
    const player = (window as any).__player;
    player.clock.seek(player.clock.duration - 0.15);
    player.clock.play();
  });
  await page.waitForFunction(() => (window as any).__player.clock.playing === false);
  await page.locator(".xv-play").click();
  await page.waitForFunction(() => (window as any).__player.clock.playing === true);
  expect(await page.evaluate(() => (window as any).__player.clock.t as number)).toBeLessThan(1);
});
