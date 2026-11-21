import { expect, test, vi } from "vitest";

import { launcherConfig } from "../launcherConfig";

import { createChristmasKeyHandler } from "./createChristmasKeyHandler";

const { KEY } = launcherConfig;
const createControls = () => ({
  isOpen: vi.fn(() => true),
  close: vi.fn(),
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

test.each([KEY.LEFT, KEY.RIGHT, KEY.UP, KEY.DOWN, KEY.ENTER])("other key %i is swallowed without an action", (code) => {
  const controls = createControls();
  const event = { preventDefault: vi.fn() };
  createChristmasKeyHandler(KEY, controls).keydown(code, event);
  expect(event.preventDefault).toHaveBeenCalledOnce();
  expect(controls.close).not.toHaveBeenCalled();
});
