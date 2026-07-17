import { test, expect } from "@playwright/test";

async function ready(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.waitForFunction(() => (window as any).__player?.clock.duration > 0, null, { timeout: 20000 });
}

test("paused question speaks, demonstrates, yields to interaction, and resumes", async ({ page }) => {
  await ready(page);
  const input = page.locator(".xv-assistant-input");
  await expect(input).toBeDisabled();

  await page.locator(".xv-play").click();
  await page.waitForFunction(() => (window as any).__player.clock.playing === true);
  await page.locator(".xv-play").click();
  await expect(input).toBeEnabled();

  await input.fill("Pourquoi le cosinus vaut-il zéro à un quart de tour ?");
  await page.locator(".xv-assistant-ask").click();
  await expect(page.locator(".xv-assistant-answer")).toContainText("quart de tour");

  // WebKit can require a second activation after an asynchronous audio fetch.
  await page.waitForFunction(() => {
    const p = (window as any).__player;
    const fallback = document.querySelector(".xv-assistant-play-answer") as HTMLButtonElement;
    return Math.abs(p.displayStore.plain.theta - Math.PI / 2) < 0.15 || !fallback.hidden;
  });
  const fallback = page.locator(".xv-assistant-play-answer");
  if (await fallback.isVisible()) await fallback.click();
  await page.waitForFunction(() => Math.abs((window as any).__player.displayStore.plain.theta - Math.PI / 2) < 0.15);

  // The learner can grab the assistant-positioned point. Their write wins for
  // theta while the rest of the answer keeps playing.
  const canvas = page.locator("canvas");
  const box = (await canvas.boundingBox())!;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const radius = Math.min(box.width, box.height) * 0.4;
  await page.mouse.move(cx, cy - radius);
  await page.mouse.down();
  await page.mouse.move(cx + radius, cy);
  await page.mouse.up();
  await page.waitForFunction(() => Math.abs((window as any).__player.displayStore.plain.theta) < 0.15);

  await expect(input).toBeEnabled({ timeout: 10000 });
  await expect(page.locator(".xv-assistant-turn")).toHaveCount(1);
  await page.locator(".xv-play").click();
  await page.waitForFunction(() => (window as any).__player.clock.playing === true);
});
