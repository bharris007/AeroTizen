import { expect, test } from "vitest";

import { parseFamilyForecast } from "./parseFamilyForecast";

// 2026-01-16T05:10:00Z is 23:10 in America/Chicago on 15 January.
const LATE_EVENING = Date.UTC(2026, 0, 16, 5, 10);

const hours = (start: number, count: number, day = "2026-01-15") =>
  Array.from({ length: count }, (_, index) => {
    const hour = start + index;
    const stampDay = hour > 23 ? "2026-01-16" : day;
    const clock = hour % 24;
    return stampDay + "T" + String(clock).padStart(2, "0") + ":00";
  });

test("keeps today's high and low and the next eight hours across midnight", () => {
  const reading = parseFamilyForecast(
    {
      current: { temperature_2m: 31.2, weather_code: 1 },
      daily: { temperature_2m_max: [40.4], temperature_2m_min: [20.2] },
      hourly: {
        temperature_2m: [30, 29, 28, 27, 26, 25, 24, 23, 22],
        time: [...hours(22, 2), ...hours(0, 7, "2026-01-16")],
        weather_code: [0, 1, 2, 3, 3, 3, 3, 3, 1],
      },
      timezone: "America/Chicago",
    },
    LATE_EVENING,
    "America/Chicago",
  );

  expect(reading).toMatchObject({
    code: 1,
    high: 40.4,
    low: 20.2,
    temperature: 31.2,
    timeZone: "America/Chicago",
  });
  expect(reading?.hours.map((hour) => hour.hour)).toEqual([23, 0, 1, 2, 3, 4, 5, 6]);
  expect(reading?.hours[0]).toMatchObject({ code: 1, temperature: 29 });
});

test("returns null when the forecast has no temperatures", () => {
  expect(parseFamilyForecast({ error: true }, LATE_EVENING, "America/Chicago")).toBeNull();
  expect(parseFamilyForecast({ current: {} }, LATE_EVENING, "America/Chicago")).toBeNull();
});

test("parses the five-day strip and today's sunrise and sunset", () => {
  const reading = parseFamilyForecast(
    {
      current: { temperature_2m: 60, weather_code: 3 },
      daily: {
        sunrise: ["2026-01-15T07:05", "2026-01-16T07:05"],
        sunset: ["2026-01-15T16:55", "2026-01-16T16:56"],
        temperature_2m_max: [61, 55, "bad"],
        temperature_2m_min: [40, 38, 30],
        time: ["2026-01-15", "2026-01-16", "2026-01-17"],
        weather_code: [3, 61, 0],
      },
    },
    LATE_EVENING,
    "America/Chicago",
  );

  expect(reading?.sunriseMinute).toBe(7 * 60 + 5);
  expect(reading?.sunsetMinute).toBe(16 * 60 + 55);
  expect(reading?.days).toEqual([
    { code: 3, high: 61, low: 40, weekday: 4 },
    { code: 61, high: 55, low: 38, weekday: 5 },
  ]);
});

test("leaves days and sun times empty when the daily block lacks them", () => {
  const reading = parseFamilyForecast(
    { current: { temperature_2m: 60, weather_code: 3 }, daily: { temperature_2m_max: [61], temperature_2m_min: [40] } },
    LATE_EVENING,
    "America/Chicago",
  );

  expect(reading?.days).toEqual([]);
  expect(reading?.sunriseMinute).toBeNull();
  expect(reading?.sunsetMinute).toBeNull();
});
