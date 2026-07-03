import { test, expect } from "@playwright/test";

async function ready(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.waitForFunction(() => (window as any).__player?.clock.duration > 0, null, { timeout: 10000 });
}

async function dragTo(page: import("@playwright/test").Page, frac: number) {
  const box = (await page.locator(".xv-scrubber").boundingBox())!;
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width * 0.05, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * frac, y, { steps: 8 });
  await page.mouse.up();
}

const clockT = (page: import("@playwright/test").Page) => page.evaluate(() => (window as any).__player.clock.t as number);
const dur = (page: import("@playwright/test").Page) => page.evaluate(() => (window as any).__player.clock.duration as number);

test("scrubber seeks, and keeps working after the play/pause button", async ({ page }) => {
  await ready(page);
  const d = await dur(page);

  await dragTo(page, 0.5);
  expect(await clockT(page)).toBeGreaterThan(d * 0.4);

  await page.locator(".xv-play").click(); // play
  await page.waitForTimeout(120);
  await page.locator(".xv-play").click(); // pause

  await dragTo(page, 0.2);
  expect(await clockT(page)).toBeLessThan(d * 0.35);
});

test("scrubber seeks while playing", async ({ page }) => {
  await ready(page);
  const d = await dur(page);
  await page.locator(".xv-play").click();
  await page.waitForTimeout(120);
  await dragTo(page, 0.6);
  expect(await clockT(page)).toBeGreaterThan(d * 0.5);
});
