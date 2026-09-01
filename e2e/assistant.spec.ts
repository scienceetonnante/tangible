import { test, expect } from "@playwright/test";

async function ready(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.waitForFunction(() => (window as any).__player?.clock.duration > 0, null, { timeout: 20000 });
}

test("scene fits the viewport while keeping the question field visible", async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 400 });
  await ready(page);

  const appBox = (await page.locator("#app").boundingBox())!;
  const sceneBox = (await page.locator(".xv-player").boundingBox())!;
  const toggle = page.locator(".xv-assistant-toggle");
  const toggleBox = (await toggle.boundingBox())!;
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator(".xv-assistant-body")).toBeHidden();
  expect(sceneBox.width).toBeLessThan(800);
  expect(sceneBox.width / sceneBox.height).toBeCloseTo(16 / 9, 2);
  expect(sceneBox.x - appBox.x).toBeCloseTo(appBox.x + appBox.width - sceneBox.x - sceneBox.width, 1);
  expect(toggleBox.y + toggleBox.height).toBeLessThanOrEqual(400);

  await toggle.click();
  await expect(page.locator(".xv-assistant-body")).toBeVisible();
  await page.waitForTimeout(50);
  const formBefore = (await page.locator(".xv-assistant-form").boundingBox())!;
  expect(formBefore.y + formBefore.height).toBeLessThanOrEqual(400);

  await page.evaluate(() => {
    const assistant = (window as any).__player.assistant;
    for (let i = 0; i < 8; i++) assistant.addTurn(`Question ${i}`, "A sufficiently long answer that grows the conversation panel.", []);
  });
  const formAfter = (await page.locator(".xv-assistant-form").boundingBox())!;
  expect(formAfter.y + formAfter.height).toBeLessThanOrEqual(400);
});

test("an authored assistant starts open only when the viewport has room", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/?assistant=open");
  await expect(page.locator(".xv-assistant-toggle")).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator(".xv-assistant-body")).toBeVisible();
  const form = (await page.locator(".xv-assistant-form").boundingBox())!;
  expect(form.y + form.height).toBeLessThanOrEqual(720);

  await page.setViewportSize({ width: 844, height: 390 });
  await page.reload();
  await expect(page.locator(".xv-assistant-toggle")).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator(".xv-assistant-body")).toBeHidden();
});

test("paused question writes, demonstrates, yields to interaction, and resumes", async ({ page }) => {
  await ready(page);
  await page.locator(".xv-assistant-toggle").click();
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
  await canvas.scrollIntoViewIfNeeded();
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
