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
  await expect(mode.locator('[data-christmas-countdown="countdown"]')).toBeVisible();
  await expect(mode.locator('[role="tab"]')).toHaveCount(0);

  await test.step("the countdown typography renders from the packaged fonts", async () => {
    const loaded = await page.evaluate(async () => {
      const fonts = ['italic 400 64px "Playfair Display"', '300 64px "Jost"'];
      const faces = await Promise.all(fonts.map((font) => document.fonts.load(font, "Merry 0123")));
      return faces.map((matches) => matches.map((face) => face.family.replace(/"/g, "") + " " + face.status));
    });
    expect(loaded).toEqual([["Playfair Display loaded"], ["Jost loaded"]]);
  });

  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowLeft");
  await expect(mode.locator('[data-christmas-countdown="countdown"]')).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(mode).toBeHidden();
  await expect(page.locator("#editor")).toBeHidden();
  expect(await page.evaluate(() => window.Christmas.isOpen())).toBe(false);
});

test("the header Christmas icon sits between the gear and Wi-Fi and opens the countdown", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => window.AeroTizen?.settingsUi && window.Christmas);
  const icon = page.locator("#christmas-shortcut");
  await expect(icon).toBeVisible();
  await expect(icon).toHaveAttribute("aria-label", "Christmas Mode");
  const order = await page.evaluate(() =>
    [...document.querySelector("[data-header-shortcuts]").children].map((node) => node.id).filter(Boolean),
  );
  expect(order.slice(0, 3)).toEqual(["gear", "christmas-shortcut", "network"]);
  await expect(page.locator("[data-header-tabs] [role=button]")).toHaveText(["Home", "Watch"]);

  await page.keyboard.press("ArrowUp");
  await expect(page.locator("#family-tab")).toHaveAttribute("data-focused", "true");
  await page.keyboard.press("ArrowLeft");
  await expect(icon).toHaveAttribute("data-focused", "true");
  await page.keyboard.press("Enter");

  const mode = page.locator("#christmas-mode");
  await expect(mode).toBeVisible();
  await expect(mode.locator("[data-christmas-unit]")).toHaveCount(3);
  await expect(mode.locator('[data-christmas-unit="seconds"]')).toHaveCount(0);

  await page.keyboard.press("Escape");
  await expect(mode).toBeHidden();
  expect(await page.evaluate(() => window.Christmas.isOpen())).toBe(false);
});
