import { expect, test } from "vitest";

import type { RadarFrame } from "../../contracts/radarMap";

import { formatRadarTimestamp, framePhase, MAX_RADAR_FRAMES, radarAgeMinutes, radarTimeline } from "./radarTimeline";

const past = (time: number): RadarFrame => ({ kind: "past", path: "/v2/radar/" + time, time });
const forecast = (time: number): RadarFrame => ({ kind: "forecast", path: "/v2/radar/nowcast_" + time, time });

const TEN_MINUTES = 600;
const NOON = 1_700_000_000;

const archive = () =>
  Array.from({ length: 13 }, (_, index) => past(NOON - (12 - index) * TEN_MINUTES)).concat([
    forecast(NOON + TEN_MINUTES),
    forecast(NOON + 2 * TEN_MINUTES),
  ]);

test("strictly caps both 1h and 2h spans to MAX_RADAR_FRAMES (6) while preserving Now", () => {
  const frames = archive();
  const recent = radarTimeline(frames, 1, "rainviewer", NOON);
  expect(recent.choices).toEqual([
    { hours: 1, span: 1 },
    { hours: 2, span: 2 },
  ]);
  expect(recent.entries.length).toBeLessThanOrEqual(MAX_RADAR_FRAMES);
  expect(recent.entries).toHaveLength(6);
  expect(recent.entries[recent.nowIndex]?.time).toBe(NOON);
  expect(framePhase(recent.entries[recent.nowIndex], NOON)).toBe("now");
  expect(framePhase(recent.entries[recent.entries.length - 1], NOON)).toBe("forecast");
  expect(framePhase(recent.entries[0], NOON)).toBe("past");

  const full = radarTimeline(frames, 2, "rainviewer", NOON);
  expect(full.entries.length).toBeLessThanOrEqual(MAX_RADAR_FRAMES);
  expect(full.entries).toHaveLength(6);
  expect(full.entries[0]?.time).toBe(NOON - 12 * TEN_MINUTES);
  expect(full.entries[full.nowIndex]?.time).toBe(NOON);
});

test("NEXRAD zoom has at most 6 frames covering the last hour with no forecast frames", () => {
  const timeline = radarTimeline([past(NOON)], 2, "nexrad", NOON);
  expect(timeline.choices).toEqual([{ hours: 1, span: 1 }]);
  expect(timeline.entries.length).toBeLessThanOrEqual(MAX_RADAR_FRAMES);
  expect(timeline.entries.map((entry) => entry.nexrad)).toEqual(["m50m", "m40m", "m30m", "m20m", "m10m", "now"]);
  expect(timeline.entries.some((entry) => entry.forecast)).toBe(false);
  expect(timeline.nowIndex).toBe(timeline.entries.length - 1);
});

test("age uses the catalog time", () => {
  expect(radarAgeMinutes(NOON, NOON - 600, (NOON + 4 * 60) * 1000)).toBe(4);
  expect(radarAgeMinutes(0, NOON, (NOON + 30) * 1000)).toBe(1);
  expect(radarAgeMinutes(0, 0, NOON * 1000)).toBeNull();
});

test("formats radar timestamps in Central Time with the timezone abbreviation", () => {
  // 2026-01-15T18:30:00Z is 12:30 PM CST in America/Chicago.
  const winterUtcSeconds = Math.floor(Date.UTC(2026, 0, 15, 18, 30) / 1000);
  const twelveHour = formatRadarTimestamp(winterUtcSeconds, "America/Chicago", "en", "12");
  expect(twelveHour).toContain("12:30");
  expect(twelveHour).toMatch(/CST|GMT-6/);
  const twentyFourHour = formatRadarTimestamp(winterUtcSeconds, "America/Chicago", "en", "24");
  expect(twentyFourHour).toContain("12:30");
  expect(twentyFourHour).toMatch(/CST|GMT-6/);
});
