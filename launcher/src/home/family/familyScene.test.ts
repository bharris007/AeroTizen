import { expect, test } from "vitest";

import { familyPhase, familyScene } from "./familyScene";

const at = (hour: number, minute = 0) => Date.UTC(2026, 0, 15, hour + 6, minute); // America/Chicago, UTC-6
const zone = "America/Chicago";

test("derives day, sunset and night from sunrise and sunset", () => {
  const rise = 7 * 60;
  const set = 17 * 60;
  expect(familyPhase(at(12), zone, rise, set)).toBe("day");
  expect(familyPhase(at(16, 30), zone, rise, set)).toBe("sunset");
  expect(familyPhase(at(18), zone, rise, set)).toBe("night");
  expect(familyPhase(at(6, 59), zone, rise, set)).toBe("night");
});

test("falls back to the hour of day without sun times", () => {
  expect(familyPhase(at(5), zone, null, null)).toBe("night");
  expect(familyPhase(at(12), zone, null, null)).toBe("day");
  expect(familyPhase(at(20), zone, null, null)).toBe("night");
});

test("maps conditions to bundled scenes", () => {
  expect(familyScene(0, "day")).toBe("sun");
  expect(familyScene(0, "sunset")).toBe("sunset");
  expect(familyScene(3, "day")).toBe("cloud");
  expect(familyScene(63, "day")).toBe("rain");
  expect(familyScene(73, "day")).toBe("snow");
  expect(familyScene(95, "day")).toBe("storm");
  expect(familyScene(0, "night")).toBe("night");
  expect(familyScene(null, "day")).toBe("cloud");
  expect(familyScene(null, "night")).toBe("night");
});
