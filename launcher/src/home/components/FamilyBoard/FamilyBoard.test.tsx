import { screen } from "@testing-library/preact";
import { expect, test } from "vitest";

import type { FamilyForecastSnapshot } from "../../../contracts/familyForecast";
import { createStore } from "../../../shared/state/createStore";
import { renderWithEnglish } from "../../../test/renderWithEnglish";
import { createCardEnvironment } from "../../test/createCardEnvironment";

import { FamilyBoard } from "./FamilyBoard";

const NOON = Date.UTC(2026, 0, 15, 18, 30);
const BEFORE_DAWN = Date.UTC(2026, 0, 15, 9, 0);

const ready: FamilyForecastSnapshot = {
  code: 2,
  days: [
    { code: 2, high: 75, low: 51, weekday: 4 },
    { code: 61, high: 66, low: 48, weekday: 5 },
    { code: 71, high: 33, low: 20, weekday: 6 },
  ],
  high: 75,
  hours: [
    { code: 2, hour: 15, temperature: 70 },
    { code: 1, hour: 16, temperature: 68 },
  ],
  locationLabel: "Franklin, TN",
  low: 51,
  status: "ready",
  sunriseMinute: 7 * 60 + 30,
  sunsetMinute: 17 * 60,
  temperature: 72.4,
  timeZone: "America/Chicago",
};

const environment = (forecast: FamilyForecastSnapshot, selected: string, now = NOON) => {
  const env = createCardEnvironment(selected);
  return {
    ...env,
    runtime: { ...env.runtime, familyForecast: createStore(forecast) },
    status: { time: createStore(now) },
  } as unknown as typeof env;
};

test("shows the saved forecast and an empty today calendar", () => {
  const { container } = renderWithEnglish(
    <FamilyBoard env={environment(ready, "family-calendar")} shown timeFormat="12" />,
  );

  expect(screen.getByText("Franklin, TN")).toBeDefined();
  expect(screen.getByText("72°")).toBeDefined();
  expect(screen.getByText("Partly cloudy")).toBeDefined();
  expect(screen.getByText("High 75°")).toBeDefined();
  expect(screen.getByText("Low 51°")).toBeDefined();
  expect(screen.getAllByText("3 PM")).toHaveLength(2);
  expect(screen.getAllByText("4 PM")).toHaveLength(2);
  expect(screen.getByText("70°")).toBeDefined();
  expect(container.querySelector("[data-family-photo]")?.getAttribute("data-family-photo")).toBe("partly");
  expect(container.querySelectorAll("[data-family-day]")).toHaveLength(3);
  expect(screen.getAllByText("Today").length).toBeGreaterThan(1);
  expect(screen.getByText("Fri")).toBeDefined();
  expect(screen.getByText("Sat")).toBeDefined();
  expect(screen.getByText("No events")).toBeDefined();
  expect(screen.getByText("Thursday, January 15")).toBeDefined();
  expect(screen.getByRole("button", { name: /No events/ })).toBeDefined();
  expect(container.querySelector("[data-family-now]")).not.toBeNull();
  expect(container.querySelector("[data-family-event]")).toBeNull();
  expect(screen.queryAllByRole("listitem")).toEqual([]);
  expect(screen.getByRole("button", { name: /Franklin, TN/ }).getAttribute("data-focused")).toBeNull();
  expect(screen.getByRole("button", { name: /No events/ }).getAttribute("data-focused")).toBe("true");
});

test("keeps the calendar empty and hides the time line outside the day grid", () => {
  const loading: FamilyForecastSnapshot = {
    ...ready,
    code: null,
    days: [],
    high: null,
    hours: [],
    low: null,
    status: "loading",
    temperature: null,
  };
  const { container } = renderWithEnglish(
    <FamilyBoard env={environment(loading, "family-weather", BEFORE_DAWN)} shown timeFormat="12" />,
  );

  expect(screen.getByText("Franklin, TN")).toBeDefined();
  expect(screen.getByText("--°")).toBeDefined();
  expect(screen.queryByText("Partly cloudy")).toBeNull();
  expect(screen.queryByText("72°")).toBeNull();
  expect(screen.getByText("No events")).toBeDefined();
  expect(container.querySelector("[data-family-now]")).toBeNull();
  expect(container.querySelector("[data-family-hourly]")).toBeNull();
  expect(container.querySelector("[data-family-days]")).toBeNull();
  expect(container.querySelector("[data-family-photo]")?.getAttribute("data-family-photo")).toBe("night");
});
