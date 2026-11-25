import { act, fireEvent, screen } from "@testing-library/preact";
import { expect, test, vi } from "vitest";

import type { CalendarEvent, FamilyCalendarSnapshot } from "../../../contracts/familyCalendar";
import type { FamilyForecastSnapshot } from "../../../contracts/familyForecast";
import type { RadarMapService, RadarMapSnapshot } from "../../../contracts/radarMap";
import { FRANKLIN_LATITUDE, FRANKLIN_LONGITUDE } from "../../../services/family/familyLocation";
import { baseTileUrl, RADAR_CARD_ZOOM, radarTileUrl, tilesForView } from "../../../services/radar/rainViewer";
import { createStore } from "../../../shared/state/createStore";
import { renderWithEnglish } from "../../../test/renderWithEnglish";
import { createCardEnvironment } from "../../test/createCardEnvironment";

import { FamilyBoard } from "./FamilyBoard";

const NOON = Date.UTC(2026, 0, 15, 18, 30);
const BEFORE_DAWN = Date.UTC(2026, 0, 15, 9, 0);

const ready: FamilyForecastSnapshot = {
  code: 2,
  conditions: { feelsLike: 70, humidity: 40, windSpeed: 6 },
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
  latitude: FRANKLIN_LATITUDE,
  locationLabel: "Franklin, TN",
  longitude: FRANKLIN_LONGITUDE,
  low: 51,
  status: "ready",
  sunriseMinute: 7 * 60 + 30,
  sunsetMinute: 17 * 60,
  temperature: 72.4,
  timeZone: "America/Chicago",
};

const calendarSnapshot = (events: readonly CalendarEvent[] = []): FamilyCalendarSnapshot => ({
  events,
  pairing: { code: "", expiresAt: 0, state: "idle", url: "" },
  statuses: {},
  syncing: false,
});

const environment = (
  forecast: FamilyForecastSnapshot,
  selected: string,
  now = NOON,
  events: readonly CalendarEvent[] = [],
) => {
  const env = createCardEnvironment(selected);
  return {
    ...env,
    runtime: {
      ...env.runtime,
      familyCalendar: createStore(calendarSnapshot(events)),
      familyForecast: createStore(forecast),
    },
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

test("shows today's events in calendar colours with overlaps side by side and an all-day strip", () => {
  // Chicago is UTC-6 on 15 January 2026.
  const at = (hour: number, minute = 0) => Date.UTC(2026, 0, 15, hour + 6, minute);
  const today = Date.UTC(2026, 0, 15) / (24 * 60 * 60 * 1000);
  const DAY_MS = 24 * 60 * 60 * 1000;
  const base = { calendarId: "family", color: "#33b679" };
  const allDay = (id: string, title: string, startDay: number): CalendarEvent => ({
    ...base,
    allDay: true,
    endDay: startDay + 1,
    id,
    startDay,
    title,
  });
  const timed = (id: string, title: string, start: number, end: number, color = base.color): CalendarEvent => ({
    ...base,
    allDay: false,
    color,
    end,
    id,
    start,
    title,
  });
  const events: CalendarEvent[] = [
    allDay("a", "MLK Day prep", today),
    allDay("old", "Yesterday", today - 1),
    timed("b", "Dentist", at(9), at(10)),
    timed("c", "Standup", at(9, 30), at(10, 30), "#f4511e"),
    timed("d", "Pickup", at(14), at(15)),
    timed("e", "Tomorrow", at(8) + DAY_MS, at(9) + DAY_MS),
  ];
  const { container } = renderWithEnglish(
    <FamilyBoard env={environment(ready, "family-calendar", NOON, events)} shown timeFormat="12" />,
  );

  expect(screen.queryByText("No events")).toBeNull();
  expect(screen.getByRole("button", { name: /4 events today/ })).toBeDefined();
  expect(screen.getByText("MLK Day prep")).toBeDefined();
  expect(screen.queryByText("Yesterday")).toBeNull();
  expect(screen.queryByText("Tomorrow")).toBeNull();
  expect(screen.getByText("9:00 AM – 10:00 AM")).toBeDefined();
  const block = (title: string) => screen.getByText(title).closest("[data-family-event]") as HTMLElement;
  expect(block("Dentist").style.width).toBe("50%");
  expect(block("Standup").style.left).toBe("50%");
  expect(block("Standup").style.borderColor).toBe("rgb(244, 81, 30)");
  expect(block("Pickup").style.width).toBe("100%");
  expect(Number.parseFloat(block("Pickup").style.top)).toBeGreaterThan(Number.parseFloat(block("Dentist").style.top));
  expect(container.querySelectorAll("[data-family-event='all-day']")).toHaveLength(1);
});

const radarService = (snapshot: RadarMapSnapshot): RadarMapService => ({
  ...createStore(snapshot),
  dispose() {},
  watch: vi.fn(() => () => undefined),
});

test("pressing up reveals the weather radar control and OK is wired to it", async () => {
  const env = environment(ready, "family-calendar");
  const { container } = renderWithEnglish(<FamilyBoard env={env} shown timeFormat="12" />);

  expect(container.querySelector("[data-family-radar-slot]")?.getAttribute("data-revealed")).toBeNull();
  const control = screen.getByRole("button", { name: "Show live radar" });
  expect(control.getAttribute("data-family-radar")).toBe("off");
  await act(() => {
    env.state.set({ ...env.state.getSnapshot(), selected: "family-radar" });
  });
  expect(container.querySelector("[data-family-radar-slot]")?.getAttribute("data-revealed")).toBe("true");
  expect(control.getAttribute("data-focused")).toBe("true");
  fireEvent.click(control);
  expect(env.select).toHaveBeenCalledWith("family-radar");
  expect(env.activate).toHaveBeenCalledWith("family-radar");
});

test("live radar replaces the forecast and loads RainViewer tiles for that place", () => {
  const width = vi.spyOn(Element.prototype, "clientWidth", "get").mockReturnValue(800);
  const height = vi.spyOn(Element.prototype, "clientHeight", "get").mockReturnValue(600);
  try {
    const env = environment(ready, "family-weather");
    const radarMap = radarService({
      frames: [{ path: "/v2/radar/13f17414a055", time: 100 }],
      host: "https://tilecache.rainviewer.com",
      status: "ready",
    });
    env.state.set({ ...env.state.getSnapshot(), weatherRadar: true });
    const view = {
      ...env,
      runtime: { ...env.runtime, radarMap },
      settings: createStore({ performanceMode: true }),
    } as unknown as typeof env;
    const { container } = renderWithEnglish(<FamilyBoard env={view} shown timeFormat="12" />);

    expect(container.querySelector("[data-family-weather-view]")?.getAttribute("data-family-weather-view")).toBe(
      "radar",
    );
    expect(screen.getByRole("button", { name: "Show the forecast" }).getAttribute("data-family-radar")).toBe("on");
    expect(screen.getByText("Franklin, TN")).toBeDefined();
    expect(screen.getByText("RainViewer · © Esri · © OpenStreetMap")).toBeDefined();
    const sources = [...container.querySelectorAll("img")].map((image) => image.getAttribute("src") || "");
    const tile = tilesForView(FRANKLIN_LATITUDE, FRANKLIN_LONGITUDE, RADAR_CARD_ZOOM, 800, 600).tiles[0];
    expect(sources).toContain(
      radarTileUrl("https://tilecache.rainviewer.com", "/v2/radar/13f17414a055", RADAR_CARD_ZOOM, tile),
    );
    expect(sources).toContain(baseTileUrl(RADAR_CARD_ZOOM, tile));
    expect(container.querySelector("[data-family-radar-marker]")).not.toBeNull();
    expect(container.querySelector("[data-family-radar-slot]")?.getAttribute("data-revealed")).toBe("true");
    expect(radarMap.watch).toHaveBeenCalled();
  } finally {
    width.mockRestore();
    height.mockRestore();
  }
});
