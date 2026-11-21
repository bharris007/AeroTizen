import { expect, test } from "vitest";

import { getChristmasCountdown, padCountdownUnit } from "./christmasCountdown";

test("counts whole days, hours, minutes and seconds to local Christmas midnight", () => {
  expect(getChristmasCountdown(new Date(2026, 10, 20, 22, 50, 15))).toEqual({
    kind: "countdown",
    days: 34,
    hours: 1,
    minutes: 9,
    seconds: 45,
  });
});

test("the last second of Christmas Eve still counts down", () => {
  expect(getChristmasCountdown(new Date(2026, 11, 24, 23, 59, 59))).toEqual({
    kind: "countdown",
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 1,
  });
});

test("partial seconds round up so the display never shows zero early", () => {
  expect(getChristmasCountdown(new Date(2026, 11, 24, 23, 59, 59, 500))).toMatchObject({ seconds: 1 });
});

test.each([new Date(2026, 11, 25, 0, 0, 0), new Date(2026, 11, 25, 18, 30), new Date(2026, 11, 31, 23, 59, 59)])(
  "Christmas Day through New Year's Eve celebrates instead of going negative (%s)",
  (now) => {
    expect(getChristmasCountdown(now)).toEqual({ kind: "christmas" });
  },
);

test("New Year's Day counts down to the coming Christmas", () => {
  expect(getChristmasCountdown(new Date(2027, 0, 1, 0, 0, 0))).toMatchObject({ kind: "countdown", days: 358 });
});

test("units pad to two digits", () => {
  expect(padCountdownUnit(0)).toBe("00");
  expect(padCountdownUnit(7)).toBe("07");
  expect(padCountdownUnit(42)).toBe("42");
});
