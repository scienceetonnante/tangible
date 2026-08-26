import { expect, test } from "@playwright/test";

async function ready(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.waitForFunction(() => (window as any).__player?.clock.duration > 0, null, { timeout: 20000 });
}

for (const viewport of [
  { name: "desktop", width: 1280, height: 720 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "phone landscape", width: 844, height: 390 },
]) {
  test(`${viewport.name} keeps the lesson controls separate and usable`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await ready(page);

    await expect(page.locator(".xv-portrait-message")).toBeHidden();
    await expect(page.locator(".xv-assistant-toggle")).toHaveAttribute("aria-expanded", "false");
    const player = (await page.locator(".xv-player").boundingBox())!;
    const drawer = (await page.locator(".xv-assistant-toggle").boundingBox())!;
    expect(drawer.y).toBeGreaterThanOrEqual(player.y + player.height);
    expect(drawer.y + drawer.height).toBeLessThanOrEqual(viewport.height);

    for (const selector of [".xv-play", ".xv-captions-toggle", ".xv-fullscreen"]) {
      const target = (await page.locator(selector).boundingBox())!;
      expect(target.width).toBeGreaterThanOrEqual(44);
      expect(target.height).toBeGreaterThanOrEqual(44);
    }

    await page.locator(".xv-captions-toggle").click();
    await page.evaluate(() => {
      const lesson = (window as any).__player;
      lesson.clock.seek(0.2);
      lesson.driver.tick();
    });
    const captions = (await page.locator(".xv-captions").boundingBox())!;
    const board = (await page.locator(".xv-board").boundingBox())!;
    const chrome = (await page.locator(".xv-chrome").boundingBox())!;
    expect(captions.x + captions.width).toBeLessThanOrEqual(board.x);
    expect(captions.y + captions.height).toBeLessThanOrEqual(chrome.y);
  });
}
