import { afterEach, expect, test, vi } from "vitest";

import { launcherConfig } from "../launcherConfig";

import { christmasScenes, stepChristmasScene } from "./christmasScenes";
import { createChristmasKeyHandler } from "./createChristmasKeyHandler";

const { KEY } = launcherConfig;
const createControls = () => ({
  isOpen: vi.fn(() => true),
  close: vi.fn(),
  nextScene: vi.fn(),
  previousScene: vi.fn(),
});

afterEach(() => {
  document.documentElement.dir = "";
});

test("the active state follows the Christmas Mode state", () => {
  const controls = createControls();
  const handler = createChristmasKeyHandler(KEY, controls);
  expect(handler.isActive()).toBe(true);
  controls.isOpen.mockReturnValue(false);
  expect(handler.isActive()).toBe(false);
});

test.each([KEY.BACK, KEY.ESC])("return key %i closes Christmas Mode", (code) => {
  const controls = createControls();
  const event = { preventDefault: vi.fn() };
  createChristmasKeyHandler(KEY, controls).keydown(code, event);
  expect(event.preventDefault).toHaveBeenCalledOnce();
  expect(controls.close).toHaveBeenCalledOnce();
});

test("left and right switch scenes, following the reading direction", () => {
  const controls = createControls();
  const event = { preventDefault: vi.fn() };
  const handler = createChristmasKeyHandler(KEY, controls);
  handler.keydown(KEY.RIGHT, event);
  handler.keydown(KEY.LEFT, event);
  expect(controls.nextScene).toHaveBeenCalledOnce();
  expect(controls.previousScene).toHaveBeenCalledOnce();

  document.documentElement.dir = "rtl";
  handler.keydown(KEY.LEFT, event);
  expect(controls.nextScene).toHaveBeenCalledTimes(2);
  expect(controls.close).not.toHaveBeenCalled();
});

test.each([KEY.UP, KEY.DOWN, KEY.ENTER])("other key %i is swallowed without an action", (code) => {
  const controls = createControls();
  const event = { preventDefault: vi.fn() };
  createChristmasKeyHandler(KEY, controls).keydown(code, event);
  expect(event.preventDefault).toHaveBeenCalledOnce();
  expect(controls.close).not.toHaveBeenCalled();
  expect(controls.nextScene).not.toHaveBeenCalled();
  expect(controls.previousScene).not.toHaveBeenCalled();
});

test("scene steps wrap around in both directions", () => {
  expect(christmasScenes.map((scene) => scene.id)).toEqual(["countdown", "fireplace", "northPole"]);
  expect(stepChristmasScene("countdown", 1)).toBe("fireplace");
  expect(stepChristmasScene("northPole", 1)).toBe("countdown");
  expect(stepChristmasScene("countdown", -1)).toBe("northPole");
});
