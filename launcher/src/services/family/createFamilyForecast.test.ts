import { expect, test, vi } from "vitest";

import type { WeatherLocation } from "../../contracts/preferences";
import type { WeatherPlatform } from "../../contracts/status";
import { createStore } from "../../shared/state/createStore";

import { createFamilyForecast } from "./createFamilyForecast";

const CHICAGO_MORNING = Date.UTC(2026, 0, 15, 12, 30);
const LONDON_LABEL = "London, England, United Kingdom";
const london: WeatherLocation = {
  country_code: "GB",
  label: LONDON_LABEL,
  latitude: 51.5085,
  longitude: -0.1257,
  name: "London",
  timezone: "Europe/London",
};

const forecast = (temperature: number, zone = "America/Chicago") => ({
  current: { temperature_2m: temperature, weather_code: 1 },
  daily: { temperature_2m_max: [temperature + 5], temperature_2m_min: [temperature - 5] },
  hourly: {
    temperature_2m: Array.from({ length: 8 }, () => temperature),
    time: Array.from({ length: 8 }, (_, index) => "2026-01-15T" + String(6 + index).padStart(2, "0") + ":00"),
    weather_code: Array.from({ length: 8 }, () => 1),
  },
  timezone: zone,
});

const harness = (location: WeatherLocation | null = null, unit: "C" | "F" = "F") => {
  const requests: { abort: ReturnType<typeof vi.fn>; done: (data: unknown) => void; url: string }[] = [];
  const listeners = new Set<() => void>();
  let preferences = { tempUnit: unit, weatherLocation: location };
  let timestamp = CHICAGO_MORNING;
  const clock = createStore(timestamp);
  const platform: WeatherPlatform = {
    requestJSON(url, done) {
      const abort = vi.fn();
      requests.push({ abort, done, url });
      return abort;
    },
  };
  const service = createFamilyForecast({
    clock,
    now: () => timestamp,
    platform,
    settings: {
      getSnapshot: () => preferences as never,
      subscribe(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    },
    timers: { clearInterval: vi.fn(), setInterval: vi.fn(() => 1) },
  });
  return {
    advance(next: number) {
      timestamp = next;
      clock.set(next);
    },
    requests,
    service,
    setPreferences(next: { tempUnit?: "C" | "F"; weatherLocation?: WeatherLocation | null }) {
      preferences = { ...preferences, ...next };
      [...listeners].forEach((listener) => listener());
    },
  };
};

test("uses Franklin when the saved place is missing and ignores a stale reply", () => {
  const missing = harness({ latitude: 999, longitude: 0, name: "Nope" });
  expect(missing.service.getSnapshot()).toMatchObject({
    locationLabel: "Franklin, TN",
    status: "loading",
    timeZone: "America/Chicago",
  });
  missing.service.start();
  expect(missing.requests[0].url).toContain("latitude=35.9251");
  expect(missing.requests[0].url).toContain("longitude=-86.8689");
  expect(missing.requests[0].url).toContain("timezone=America%2FChicago");
  expect(missing.requests[0].url).toContain("temperature_unit=fahrenheit");
  expect(missing.requests[0].url).toContain("forecast_days=7");
  expect(missing.requests[0].url).toContain("sunrise,sunset");

  missing.setPreferences({ tempUnit: "C", weatherLocation: london });
  expect(missing.requests[0].abort).toHaveBeenCalled();
  missing.requests[0].done(forecast(1));
  expect(missing.service.getSnapshot().temperature).toBeNull();

  const londonRequest = missing.requests[1];
  expect(londonRequest.url).toContain("latitude=51.5085");
  expect(londonRequest.url).toContain("timezone=Europe%2FLondon");
  expect(londonRequest.url).not.toContain("temperature_unit=fahrenheit");
  londonRequest.done(forecast(12, "Europe/London"));
  expect(missing.service.getSnapshot()).toMatchObject({
    locationLabel: LONDON_LABEL,
    status: "ready",
    temperature: 12,
    timeZone: "Europe/London",
  });
  expect(missing.service.getSnapshot()).not.toHaveProperty("events");
});

test("moves the hourly strip forward when the location hour changes", () => {
  const { advance, requests, service } = harness(null, "C");
  service.start();
  expect(requests[0].url).not.toContain("temperature_unit");
  requests[0].done(forecast(60));
  expect(service.getSnapshot().hours.map((hour) => hour.hour)).toEqual([6, 7, 8, 9, 10, 11, 12, 13]);

  advance(Date.UTC(2026, 0, 15, 13, 30));
  expect(service.getSnapshot().hours.map((hour) => hour.hour)).toEqual([7, 8, 9, 10, 11, 12, 13]);
  expect(service.getSnapshot().hours.some((hour) => hour.hour === 6)).toBe(false);
});
