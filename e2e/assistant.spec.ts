import { test, expect } from "@playwright/test";

async function ready(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.waitForFunction(() => (window as any).__player?.clock.duration > 0, null, { timeout: 20000 });
}

test("paused question writes, demonstrates, yields to interaction, and resumes", async ({ page }) => {
  await ready(page);
  const input = page.locator(".xv-assistant-input");
  await expect(input).toBeDisabled();

  await page.locator(".xv-play").click();
  await page.waitForFunction(() => (window as any).__player.clock.playing === true);
  await page.locator(".xv-play").click();
  await expect(input).toBeEnabled();

  await input.fill("Why is the cosine zero at a quarter turn?");
  await page.locator(".xv-assistant-ask").click();
  await expect(page.locator(".xv-assistant-answer")).toContainText("quarter turn");
  const generatedLabels = await page.locator(".xv-assistant-question, .xv-assistant-answer").evaluateAll((elements) =>
    elements.map((element) => getComputedStyle(element, "::before").content),
  );
  expect(generatedLabels).toEqual(["none", "none"]);
  const formBox = (await page.locator(".xv-assistant-form").boundingBox())!;
  const answerBox = (await page.locator(".xv-assistant-answer").boundingBox())!;
  expect(formBox.y).toBeLessThan(answerBox.y);
  await page.waitForFunction(() => Math.abs((window as any).__player.displayStore.plain.theta - Math.PI / 2) < 0.15);

  // The learner can grab the assistant-positioned point. Their write wins for
  // theta while the written answer's visual timeline continues.
  const canvas = page.locator("canvas");
  const box = (await canvas.boundingBox())!;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const radius = Math.min(box.width, box.height) * 0.4;
  const theta = await page.evaluate(() => (window as any).__player.displayStore.plain.theta as number);
  await page.mouse.move(cx + Math.cos(theta) * radius, cy - Math.sin(theta) * radius);
  await page.mouse.down();
  await page.mouse.move(cx + radius, cy);
  await page.mouse.up();
  await page.waitForFunction(() => Math.abs((window as any).__player.displayStore.plain.theta) < 0.15);

  await expect(input).toBeEnabled({ timeout: 10000 });
  await expect(page.locator(".xv-assistant-turn")).toHaveCount(1);
  await page.locator(".xv-play").click();
  await page.waitForFunction(() => (window as any).__player.clock.playing === true);
});
