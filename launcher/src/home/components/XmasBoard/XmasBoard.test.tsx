import { act } from "@testing-library/preact";
import { expect, test, vi } from "vitest";

import { renderWithEnglish } from "../../../test/renderWithEnglish";

import { XmasBoard } from "./XmasBoard";

const harness = () => {
  let time = new Date(2026, 11, 24, 23, 59, 58).getTime();
  const callbacks = new Map<number, () => void>();
  let next = 1;
  const timers = {
    setInterval: vi.fn((callback: () => void) => {
      callbacks.set(next, callback);
      return next++;
    }),
    clearInterval: vi.fn((id: number) => {
      callbacks.delete(id);
    }),
  };
  const now = () => time;
  const tick = async (ms: number) =>
    await act(() => {
      time += ms;
      callbacks.forEach((callback) => callback());
    });
  return { callbacks, now, tick, timers };
};

test("the XMAS tab shows the live countdown and celebrates at midnight", async () => {
  const { now, tick, timers } = harness();
  const { container } = renderWithEnglish(<XmasBoard paused={false} now={now} timers={timers} />);
  expect(container.querySelector("[data-xmas-board]")?.getAttribute("data-paused")).toBe("false");
  expect(container.textContent).toContain("Christmas is coming!");
  expect(container.querySelector('[data-christmas-unit="seconds"]')?.textContent).toContain("02");
  expect(timers.setInterval).toHaveBeenCalledWith(expect.any(Function), 1000);
  await tick(1000);
  expect(container.querySelector('[data-christmas-unit="seconds"]')?.textContent).toContain("01");
  await tick(1000);
  expect(container.querySelector("[data-christmas-countdown]")?.getAttribute("data-christmas-countdown")).toBe(
    "christmas",
  );
  expect(container.textContent).toContain("Merry Christmas!");
});

test("a covered XMAS tab stops ticking and freezes its motion; unmounting clears the timer", async () => {
  const { callbacks, now, timers } = harness();
  const { container, rerender, unmount } = renderWithEnglish(<XmasBoard paused={false} now={now} timers={timers} />);
  expect(callbacks.size).toBe(1);
  await act(() => rerender(<XmasBoard paused now={now} timers={timers} />));
  expect(callbacks.size).toBe(0);
  expect(container.querySelector("[data-xmas-board]")?.getAttribute("data-paused")).toBe("true");
  await act(() => rerender(<XmasBoard paused={false} now={now} timers={timers} />));
  expect(callbacks.size).toBe(1);
  unmount();
  expect(callbacks.size).toBe(0);
});
