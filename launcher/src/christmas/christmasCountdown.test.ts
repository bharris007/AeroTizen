import { expect, test } from "vitest";

import { getChristmasCountdown, msUntilNextMinute, padCountdownUnit } from "./christmasCountdown";

test("counts whole days, hours and minutes to local Christmas midnight", () => {
  expect(getChristmasCountdown(new Date(2026, 10, 20, 22, 51))).toEqual({
    kind: "countdown",
    days: 34,
    hours: 1,
    minutes: 9,
  });
});

test("the countdown agrees with the wall clock and turns over exactly on the minute", () => {
  expect(getChristmasCountdown(new Date(2026, 11, 24, 18, 30, 0))).toMatchObject({ hours: 5, minutes: 30 });
  expect(getChristmasCountdown(new Date(2026, 11, 24, 18, 30, 59, 999))).toMatchObject({ hours: 5, minutes: 30 });
  expect(getChristmasCountdown(new Date(2026, 11, 24, 18, 31, 0))).toMatchObject({ hours: 5, minutes: 29 });
});

test("a whole day left reads as one day rather than 23 h 60 min", () => {
  expect(getChristmasCountdown(new Date(2026, 11, 24, 0, 0, 0))).toEqual({
    kind: "countdown",
    days: 1,
    hours: 0,
    minutes: 0,
  });
  expect(getChristmasCountdown(new Date(2026, 11, 24, 0, 0, 59))).toMatchObject({ days: 1, hours: 0, minutes: 0 });
  expect(getChristmasCountdown(new Date(2026, 11, 24, 0, 1, 0))).toMatchObject({ days: 0, hours: 23, minutes: 59 });
});

test("the last minute of Christmas Eve still shows one minute instead of zero", () => {
  expect(getChristmasCountdown(new Date(2026, 11, 24, 23, 59, 59, 500))).toEqual({
    kind: "countdown",
    days: 0,
    hours: 0,
    minutes: 1,
  });
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

test("the next tick lands on the next local minute boundary", () => {
  expect(msUntilNextMinute(new Date(2026, 11, 24, 23, 58, 30, 250))).toBe(29750);
  expect(msUntilNextMinute(new Date(2026, 11, 24, 23, 58, 59, 999))).toBe(1);
  expect(msUntilNextMinute(new Date(2026, 11, 24, 23, 59, 0, 0))).toBe(60000);
});

test("units pad to two digits", () => {
  expect(padCountdownUnit(0)).toBe("00");
  expect(padCountdownUnit(7)).toBe("07");
  expect(padCountdownUnit(42)).toBe("42");
});
