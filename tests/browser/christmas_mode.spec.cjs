const { test, expect } = require("./launcher_fixture.cjs");
const errors = new WeakMap();
test.beforeEach(async ({ page }) => {
  const messages = [];
  errors.set(page, messages);
  page.on("pageerror", (error) => messages.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") messages.push(message.text());
  });
  await page.route("https://**/*", (route) => route.fulfill({ contentType: "application/json", body: "{}" }));
  await page.route("http://127.0.0.1:47790/**", (route) => route.fulfill({ body: "{}" }));
  await page.addInitScript(() => {
    localStorage.setItem("aerotizen.settings.v1", JSON.stringify({ background: "black", language: "en" }));
  });
});
test.afterEach(async ({ page }) => {
  expect(errors.get(page)).toEqual([]);
});

test("Christmas Mode opens from the Settings badge and is driven entirely by the remote", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => window.AeroTizen?.settingsUi && window.Christmas);
  await page.evaluate(() => AeroTizen.settingsUi.open());
  const badge = page.locator("[data-christmas-badge]");
  await expect(badge).toBeVisible();
  await expect(badge).toContainText("Christmas Mode");
  await expect(page.locator('[data-key="section:appearance"]')).toHaveAttribute("data-focused", "true");

  await page.keyboard.press("ArrowUp");
  await expect(badge).toHaveAttribute("data-focused", "true");
  await page.keyboard.press("Enter");

  const mode = page.locator("#christmas-mode");
  await expect(mode).toBeVisible();
  await expect(page.locator("#editor")).toBeHidden();
  await expect(mode).toHaveAttribute("data-christmas-scene", "countdown");
  await expect(page.locator('[data-christmas-tab="countdown"]')).toHaveAttribute("aria-selected", "true");

  await page.keyboard.press("ArrowRight");
  await expect(mode).toHaveAttribute("data-christmas-scene", "fireplace");
  await expect(mode.locator("canvas")).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(mode).toHaveAttribute("data-christmas-scene", "northPole");
  await page.keyboard.press("ArrowRight");
  await expect(mode).toHaveAttribute("data-christmas-scene", "countdown");
  await page.keyboard.press("ArrowLeft");
  await expect(mode).toHaveAttribute("data-christmas-scene", "northPole");

  await page.keyboard.press("Escape");
  await expect(mode).toBeHidden();
  await expect(page.locator("#editor")).toBeHidden();
  expect(await page.evaluate(() => window.Christmas.isOpen())).toBe(false);
});
