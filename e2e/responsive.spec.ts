import { expect, test } from "@playwright/test";

async function ready(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.waitForFunction(() => (window as any).__player?.clock.duration > 0, null, { timeout: 20000 });
}

for (const viewport of [
  { name: "desktop", width: 1280, height: 720 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "phone landscape 667 × 375", width: 667, height: 375 },
  { name: "phone landscape 844 × 390", width: 844, height: 390 },
  { name: "phone landscape 896 × 414", width: 896, height: 414 },
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

    for (const selector of [".xv-play", ".xv-captions-toggle", ".xv-fullscreen", ".xv-credit"]) {
      const target = (await page.locator(selector).boundingBox())!;
      expect(target.width).toBeGreaterThanOrEqual(44);
      expect(target.height).toBeGreaterThanOrEqual(44);
    }

    const credit = page.locator(".xv-credit");
    await expect(credit).toHaveText("Made with Tangible");
    await expect(credit).toHaveAttribute("href", "https://github.com/scienceetonnante/tangible");

    await page.locator(".xv-captions-toggle").click();
    await page.evaluate(() => {
      const lesson = (window as any).__player;
      lesson.clock.seek(0.2);
      lesson.driver.tick();
    });
    const captions = (await page.locator(".xv-captions").boundingBox())!;
    const board = (await page.locator(".xv-board").boundingBox())!;
    const chrome = (await page.locator(".xv-chrome").boundingBox())!;
    const creditBox = (await credit.boundingBox())!;
    expect(captions.x + captions.width).toBeLessThanOrEqual(board.x);
    expect(captions.y + captions.height).toBeLessThanOrEqual(chrome.y);
    expect(creditBox.x + creditBox.width).toBeLessThanOrEqual(chrome.x + chrome.width);
    expect(creditBox.y + creditBox.height).toBeLessThanOrEqual(chrome.y + chrome.height);
  });
}
