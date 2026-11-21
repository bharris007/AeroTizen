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

test("the XMAS tab sits right of Watch and shows the countdown under the launcher header", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => window.AeroTizen?.settingsUi);
  const tabs = page.locator("[data-header-tabs] [role=button]");
  await expect(tabs).toHaveText(["Home", "Watch", "XMAS"]);
  await expect(page.locator("[data-xmas-board]")).toHaveCount(0);

  await page.keyboard.press("ArrowUp");
  await expect(page.locator("#family-tab")).toHaveAttribute("data-focused", "true");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  const xmas = page.locator("#xmas-tab");
  await expect(xmas).toHaveAttribute("data-focused", "true");
  await page.keyboard.press("Enter");

  const board = page.locator("[data-xmas-board]");
  await expect(board).toBeVisible();
  await expect(xmas).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("[data-home-header]")).toBeVisible();
  await expect(board.locator("[data-christmas-countdown]")).toBeVisible();
  await expect(page.locator("#christmas-mode")).toHaveCount(0);

  // The countdown is display-only: Down keeps focus in the tab bar, and Left walks back to Watch.
  await page.keyboard.press("ArrowDown");
  await expect(xmas).toHaveAttribute("data-focused", "true");
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator("#home-tab")).toHaveAttribute("data-focused", "true");
  await page.keyboard.press("Enter");
  await expect(board).toHaveCount(0);

  await page.evaluate(() => AeroTizen.homeScreen.showPage("xmas"));
  await expect(board).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(board).toHaveCount(0);
  await expect(page.locator("#family-tab")).toHaveAttribute("aria-pressed", "true");
});
