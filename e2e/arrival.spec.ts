import { expect, test } from "@playwright/test";

test("loading becomes a deliberate start and never autoplays", async ({ page }, testInfo) => {
  if (testInfo.project.name === "mobile-webkit") await page.setViewportSize({ width: 844, height: 390 });
  await page.goto("/?arrival");

  const screen = page.locator(".xv-start-screen");
  await expect(screen).toHaveAttribute("data-state", "loading");
  await expect(page.locator(".xv-start-title")).toHaveText("The unit circle");
  await expect(page.locator(".xv-start-promise")).toHaveCount(0);
  await expect(page.locator(".xv-start-meta")).toHaveCount(0);
  await expect(page.locator(".xv-start-button")).toBeDisabled();
  await expect(page.locator("canvas")).toBeVisible();
  const card = await page.locator(".xv-start-content").boundingBox();
  const player = await page.locator(".xv-player").boundingBox();
  expect(card!.width).toBeLessThanOrEqual(player!.width - 12);
  expect(card!.height).toBeLessThan(player!.height * 0.95);
  await expect(screen).toHaveCSS("background-color", "rgba(4, 8, 15, 0.46)");
  await expect.poll(() => page.evaluate(() => (window as any).__player.clock.playing)).toBe(false);

  await expect(screen).toHaveAttribute("data-state", "ready");
  await expect(page.locator(".xv-start-status")).toHaveText("Ready");
  await page.locator(".xv-start-button").click();
  await expect(screen).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => (window as any).__player.clock.playing)).toBe(true);
});

test("static-style blob narration remains playable", async ({ page }, testInfo) => {
  if (testInfo.project.name === "mobile-webkit") await page.setViewportSize({ width: 844, height: 390 });
  await page.goto("/?arrival=blob");
  const screen = page.locator(".xv-start-screen");
  await expect(screen).toHaveAttribute("data-state", "ready");
  await page.locator(".xv-start-button").click();
  await expect(screen).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => (window as any).__player.clock.playing)).toBe(true);
});

test("portrait phones receive an orientation notice", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?arrival");
  const message = page.locator(".xv-portrait-message");
  await expect(message).toBeVisible();
  await expect(message).toContainText("Rotate your phone to landscape");
  const messageBox = (await message.boundingBox())!;
  const playerBox = (await page.locator(".xv-player").boundingBox())!;
  expect(messageBox).toEqual(playerBox);
});

test("phone landscape shows the lesson instead of the portrait message", async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto("/?arrival");
  await expect(page.locator(".xv-portrait-message")).toBeHidden();
  await expect(page.locator(".xv-start-screen")).toBeVisible();
});
