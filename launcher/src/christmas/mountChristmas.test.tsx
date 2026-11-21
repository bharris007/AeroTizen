import { act } from "@testing-library/preact";
import { expect, test, vi } from "vitest";

import type { MessageKey } from "../shared/i18n/catalogues";

import { mountChristmas } from "./mountChristmas";

const translate = (key: MessageKey) => key;

const createHarness = async (onTestFinished: (fn: () => void) => void, start = new Date(2026, 11, 24, 23, 59, 58)) => {
  const host = document.createElement("div");
  document.body.append(host);
  let now = start.getTime();
  let pending: (() => void) | undefined;
  const timers = {
    setTimeout: vi.fn((callback: () => void) => {
      pending = callback;
      return 1;
    }),
    clearTimeout: vi.fn(),
  };
  let mounted: ReturnType<typeof mountChristmas> | undefined;
  // Mount inside act so the view's store subscription is live before the bridge is used.
  await act(() => {
    mounted = mountChristmas(host, translate, () => now, timers);
  });
  const christmas = mounted as ReturnType<typeof mountChristmas>;
  onTestFinished(() => {
    christmas.dispose();
    host.remove();
  });
  // Advance the clock to when the scheduled timeout fires and run it.
  const fire = async (ms: number) =>
    await act(() => {
      now += ms;
      pending?.();
    });
  const minutes = () => host.querySelector('[data-christmas-unit="minutes"]')?.textContent;
  return { host, christmas, timers, fire, minutes };
};

test("Christmas Mode renders nothing until opened, then shows the countdown", async ({ onTestFinished }) => {
  const { host, christmas, minutes } = await createHarness(onTestFinished);
  expect(host.innerHTML).toBe("");
  await act(() => christmas.bridge.open());
  expect(christmas.bridge.isOpen()).toBe(true);
  expect(
    [...host.querySelectorAll("[data-christmas-unit]")].map((unit) => unit.getAttribute("data-christmas-unit")),
  ).toEqual(["days", "hours", "minutes"]);
  expect(minutes()).toContain("01");
});

test("the owner wakes on the next minute boundary and celebrates at midnight", async ({ onTestFinished }) => {
  const { host, christmas, timers, fire } = await createHarness(onTestFinished);
  await act(() => christmas.bridge.open());
  expect(timers.setTimeout).toHaveBeenLastCalledWith(expect.any(Function), 2000);
  await fire(2000);
  expect(host.querySelector("[data-christmas-countdown]")?.getAttribute("data-christmas-countdown")).toBe("christmas");
  expect(host.textContent).toContain("christmas.merry");
  expect(timers.setTimeout).toHaveBeenLastCalledWith(expect.any(Function), 60000);
});

test("the shown minute turns over exactly on the boundary and an early wake-up changes nothing", async ({
  onTestFinished,
}) => {
  const { host, christmas, timers, fire, minutes } = await createHarness(
    onTestFinished,
    new Date(2026, 11, 24, 23, 57, 30),
  );
  await act(() => christmas.bridge.open());
  expect(minutes()).toContain("03");
  expect(timers.setTimeout).toHaveBeenLastCalledWith(expect.any(Function), 30000);
  const tile = host.querySelector('[data-christmas-unit="minutes"]');
  await fire(29999);
  expect(host.querySelector('[data-christmas-unit="minutes"]')).toBe(tile);
  expect(minutes()).toContain("03");
  expect(timers.setTimeout).toHaveBeenLastCalledWith(expect.any(Function), 1);
  await fire(1);
  expect(minutes()).toContain("02");
  expect(timers.setTimeout).toHaveBeenLastCalledWith(expect.any(Function), 60000);
});

test("closing stops the ticker, unmounts the scene and reopens on the countdown", async ({ onTestFinished }) => {
  const { host, christmas, timers } = await createHarness(onTestFinished);
  await act(() => christmas.bridge.open());
  await act(() => christmas.bridge.close());
  expect(timers.clearTimeout).toHaveBeenCalledOnce();
  expect(christmas.bridge.isOpen()).toBe(false);
  expect(host.innerHTML).toBe("");
  await act(() => christmas.bridge.open());
  expect(host.querySelector("[data-christmas-countdown]")?.getAttribute("data-christmas-countdown")).toBe("countdown");
});

test("a disposed mode cannot reopen", async ({ onTestFinished }) => {
  const { host, christmas } = await createHarness(onTestFinished);
  christmas.dispose();
  christmas.bridge.open();
  expect(christmas.bridge.isOpen()).toBe(false);
  expect(host.innerHTML).toBe("");
});
