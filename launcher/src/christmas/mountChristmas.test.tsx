import { act } from "@testing-library/preact";
import { expect, test, vi } from "vitest";

import type { MessageKey } from "../shared/i18n/catalogues";

import { mountChristmas } from "./mountChristmas";

const translate = (key: MessageKey) => key;

const createHarness = async (onTestFinished: (fn: () => void) => void) => {
  const host = document.createElement("div");
  document.body.append(host);
  let now = new Date(2026, 11, 24, 23, 59, 58).getTime();
  const callbacks: (() => void)[] = [];
  const timers = {
    setInterval: vi.fn((callback: () => void) => callbacks.push(callback)),
    clearInterval: vi.fn(),
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
  const tick = async (ms: number) =>
    await act(() => {
      now += ms;
      callbacks.forEach((callback) => callback());
    });
  return { host, christmas, timers, tick };
};

test("Christmas Mode renders nothing until opened, then shows the countdown scene", async ({ onTestFinished }) => {
  const { host, christmas } = await createHarness(onTestFinished);
  expect(host.innerHTML).toBe("");
  await act(() => christmas.bridge.open());
  expect(christmas.bridge.isOpen()).toBe(true);
  expect(host.querySelector("[data-christmas-scene]")?.getAttribute("data-christmas-scene")).toBe("countdown");
  expect(host.querySelector('[data-christmas-unit="seconds"]')?.textContent).toContain("02");
  const tabs = [...host.querySelectorAll('[role="tab"]')];
  expect(tabs.map((tab) => tab.getAttribute("data-christmas-tab"))).toEqual(["countdown", "fireplace", "northPole"]);
  expect(tabs.map((tab) => tab.getAttribute("aria-selected"))).toEqual(["true", "false", "false"]);
});

test("the owner ticks the countdown every second and celebrates at midnight", async ({ onTestFinished }) => {
  const { host, christmas, timers, tick } = await createHarness(onTestFinished);
  await act(() => christmas.bridge.open());
  expect(timers.setInterval).toHaveBeenCalledWith(expect.any(Function), 1000);
  await tick(1000);
  expect(host.querySelector('[data-christmas-unit="seconds"]')?.textContent).toContain("01");
  await tick(1000);
  expect(host.querySelector("[data-christmas-countdown]")?.getAttribute("data-christmas-countdown")).toBe("christmas");
  expect(host.textContent).toContain("christmas.merry");
});

test("scene steps move the selected tab and wrap", async ({ onTestFinished }) => {
  const { host, christmas } = await createHarness(onTestFinished);
  await act(() => christmas.bridge.open());
  await act(() => christmas.bridge.nextScene());
  expect(host.querySelector('[data-focused="true"]')?.getAttribute("data-christmas-tab")).toBe("fireplace");
  await act(() => christmas.bridge.nextScene());
  expect(host.querySelector("[data-christmas-scene]")?.getAttribute("data-christmas-scene")).toBe("northPole");
  await act(() => christmas.bridge.nextScene());
  expect(host.querySelector('[aria-selected="true"]')?.getAttribute("data-christmas-tab")).toBe("countdown");
  await act(() => christmas.bridge.previousScene());
  expect(host.querySelector('[aria-selected="true"]')?.getAttribute("data-christmas-tab")).toBe("northPole");
});

test("closing stops the ticker, unmounts the scene and reopens on the countdown", async ({ onTestFinished }) => {
  const { host, christmas, timers } = await createHarness(onTestFinished);
  await act(() => christmas.bridge.open());
  await act(() => christmas.bridge.nextScene());
  await act(() => christmas.bridge.close());
  expect(timers.clearInterval).toHaveBeenCalledOnce();
  expect(christmas.bridge.isOpen()).toBe(false);
  expect(host.innerHTML).toBe("");
  await act(() => christmas.bridge.open());
  expect(host.querySelector("[data-christmas-scene]")?.getAttribute("data-christmas-scene")).toBe("countdown");
});

test("scene steps do nothing while closed and a disposed mode cannot reopen", async ({ onTestFinished }) => {
  const { host, christmas } = await createHarness(onTestFinished);
  christmas.bridge.nextScene();
  christmas.dispose();
  christmas.bridge.open();
  expect(christmas.bridge.isOpen()).toBe(false);
  expect(host.innerHTML).toBe("");
});
