import { expect, test } from "vitest";

import { parseIcsDuration, resolveZone, utcToWall, wallToUtc } from "./icsTime";

test("converts wall times around DST changes in Chicago", () => {
  const zone = "America/Chicago";
  expect(wallToUtc(Date.UTC(2026, 6, 4, 12), zone)).toBe(Date.UTC(2026, 6, 4, 17));
  expect(wallToUtc(Date.UTC(2026, 11, 25, 12), zone)).toBe(Date.UTC(2026, 11, 25, 18));
  // 2:30 AM does not exist on 8 March 2026; it moves forward an hour.
  expect(wallToUtc(Date.UTC(2026, 2, 8, 2, 30), zone)).toBe(Date.UTC(2026, 2, 8, 8, 30));
  expect(utcToWall(Date.UTC(2026, 10, 21, 12), zone)).toBe(Date.UTC(2026, 10, 21, 6));
});

test("resolves Windows, quoted and unknown zone names", () => {
  expect(resolveZone("Central Standard Time", "UTC")).toBe("America/Chicago");
  expect(resolveZone('"America/New_York"', "UTC")).toBe("America/New_York");
  expect(resolveZone("Not/AZone", "America/Chicago")).toBe("America/Chicago");
  expect(resolveZone(undefined, "America/Chicago")).toBe("America/Chicago");
});

test("parses ICS durations", () => {
  expect(parseIcsDuration("PT1H30M")).toBe(90 * 60 * 1000);
  expect(parseIcsDuration("P1D")).toBe(24 * 60 * 60 * 1000);
  expect(parseIcsDuration("bad")).toBeNull();
});
