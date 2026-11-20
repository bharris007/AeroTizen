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
