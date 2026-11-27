import { act, fireEvent, screen } from "@testing-library/preact";
import { expect, test, vi } from "vitest";

import type { CalendarEvent, FamilyCalendarSnapshot } from "../../../contracts/familyCalendar";
import type { FamilyForecastSnapshot } from "../../../contracts/familyForecast";
import { RADAR_PLAY_STEP_MS } from "../../../services/radar/radarTimeline";
import { MAX_RADAR_TILES } from "../../../services/radar/rainViewer";
import { activeRadarTileLoads, queuedRadarTileLoads, resetRadarTileQueue } from "../../../services/radar/tileLoadQueue";
import { createStore } from "../../../shared/state/createStore";
import { renderWithEnglish } from "../../../test/renderWithEnglish";
import { createCardEnvironment } from "../../test/createCardEnvironment";
import type { FamilyPane, HomeState } from "../../types";
import { FamilyBoard } from "../FamilyBoard/FamilyBoard";

import { FamilyExpanded } from "./FamilyExpanded";

// Chicago is UTC-6 on 15 January 2026, a Thursday.
const NOON = Date.UTC(2026, 0, 15, 18, 30);
const at = (day: number, hour: number) => Date.UTC(2026, 0, 15 + day, hour + 6);

const forecast: FamilyForecastSnapshot = {
  code: 61,
  conditions: { feelsLike: 66.6, humidity: 81, windSpeed: 12.4 },
  days: [
    { code: 61, high: 75, low: 51, precipitation: 70, weekday: 4 },
    { code: 2, high: 66, low: 48, weekday: 5 },
  ],
  high: 75,
  hours: [
    { code: 61, hour: 12, precipitation: 60, temperature: 70 },
    { code: 2, hour: 13, precipitation: 5, temperature: 71 },
  ],
  latitude: 35.9251,
  locationLabel: "Franklin, TN",
  longitude: -86.8689,
  low: 51,
  status: "ready",
  sunriseMinute: 7 * 60 + 5,
  sunsetMinute: 17 * 60 + 2,
  temperature: 72.4,
  timeZone: "America/Chicago",
};

const timed = (id: string, name: string, day: number, hour: number): CalendarEvent => ({
  allDay: false,
  calendarId: "family",
  color: "#33b679",
  end: at(day, hour + 1),
  id,
  start: at(day, hour),
  title: name,
});

const events: CalendarEvent[] = [
  timed("a", "Dentist", 0, 9),
  timed("b", "Soccer", 1, 16),
  timed("c", "Piano", 2, 15),
  timed("d", "Far away", 4, 10),
  {
    allDay: true,
    calendarId: "family",
    color: "#8e24aa",
    endDay: 20470,
    id: "e",
    startDay: 20469,
    title: named("Trip"),
  },
];

function named(name: string) {
  return name;
}

const environment = (patch: Partial<HomeState>) => {
  const env = createCardEnvironment("family-calendar");
  env.state.set({ ...env.state.getSnapshot(), page: "family", ...patch });
  const calendar: FamilyCalendarSnapshot = {
    events,
    pairing: { code: "", expiresAt: 0, state: "idle", url: "" },
    statuses: {},
    syncing: false,
  };
  return {
    ...env,
    runtime: { ...env.runtime, familyCalendar: createStore(calendar), familyForecast: createStore(forecast) },
    status: { time: createStore(NOON) },
  } as unknown as typeof env;
};

const open = (expanded: FamilyPane, patch: Partial<HomeState> = {}) => {
  const env = environment({ expanded, ...patch });
  const view = renderWithEnglish(<FamilyExpanded env={env} timeFormat="12" unit="F" />);
  return { env, ...view };
};

test("shows nothing until a pane is expanded", () => {
  const env = environment({ expanded: null });
  const { container } = renderWithEnglish(<FamilyExpanded env={env} timeFormat="12" unit="F" />);
  expect(container.querySelector("[data-family-overlay]")).toBeNull();
});

test("full-screen weather shows current conditions, details, hours and days", () => {
  const { container } = open("weather");
  expect(container.querySelector("[data-family-overlay='weather']")).not.toBeNull();
  expect(screen.getByText("72°")).toBeDefined();
  expect(screen.getByText("Rain")).toBeDefined();
  expect(screen.getByText("Feels like 67°")).toBeDefined();
  expect(screen.getByText("Wind 12 mph")).toBeDefined();
  expect(screen.getByText("Humidity 81%")).toBeDefined();
  expect(screen.getByText("70% chance of rain")).toBeDefined();
  expect(screen.getByText("Sunrise 7:05 AM")).toBeDefined();
  expect(screen.getByText("Sunset 5:02 PM")).toBeDefined();
  expect(screen.getByText("Now")).toBeDefined();
  expect(screen.getByText("60%")).toBeDefined();
  expect(screen.queryByText("5%")).toBeNull();
  expect(screen.getByText("2-day forecast")).toBeDefined();
  expect(container.querySelectorAll("[data-family-days] [data-family-day]")).toHaveLength(2);
  expect(screen.getByText("Press Back to close")).toBeDefined();
});

test("full-screen calendar shows day columns for the span with a now line on today", () => {
  const { container } = open("calendar", { calendarSpan: 3, calendarStart: 0 });
  const columns = container.querySelectorAll("[data-calendar-column]");
  expect([...columns].map((column) => column.getAttribute("data-calendar-column"))).toEqual(["0", "1", "2"]);
  expect(screen.getByText("Dentist")).toBeDefined();
  expect(screen.getByText("Soccer")).toBeDefined();
  expect(screen.getByText("Piano")).toBeDefined();
  expect(screen.queryByText("Far away")).toBeNull();
  expect(screen.getByText("Trip").closest("[data-calendar-day]")?.getAttribute("data-calendar-day")).toBe("1");
  expect(container.querySelector("[data-calendar-column='0'] [data-family-now]")).not.toBeNull();
  expect(container.querySelectorAll("[data-family-now]")).toHaveLength(1);
  expect(screen.getByText("January 15 – January 17")).toBeDefined();
  expect(screen.getByRole("radio", { name: "3 days" }).getAttribute("aria-checked")).toBe("true");
  expect(container.querySelector("[data-calendar-grid]")?.getAttribute("data-focused")).toBe("true");
  expect(container.querySelector("[data-calendar-today]")).toBeNull();
});

test("the span toggle and paging arrows drive the controller", () => {
  const { container, env } = open("calendar", { calendarFocus: "span", calendarSpan: 5, calendarStart: 5 });
  expect(container.querySelectorAll("[data-calendar-column]")).toHaveLength(5);
  expect(container.querySelector("[data-calendar-spans]")?.getAttribute("data-focused")).toBe("true");
  expect(container.querySelector("[data-family-now]")).toBeNull();
  fireEvent.click(screen.getByRole("radio", { name: "1 day" }));
  expect(env.setCalendarSpan).toHaveBeenCalledWith(1);
  fireEvent.click(screen.getByRole("button", { name: "Later" }));
  expect(env.pageCalendar).toHaveBeenCalledWith(1);
  fireEvent.click(screen.getByRole("button", { name: "Earlier" }));
  expect(env.pageCalendar).toHaveBeenCalledWith(-1);
  fireEvent.click(screen.getByText("Back to today"));
  expect(env.calendarToday).toHaveBeenCalled();
});

test("one-day view names the whole date", () => {
  open("calendar", { calendarSpan: 1, calendarStart: 1 });
  expect(screen.getByText("Friday, January 16")).toBeDefined();
  expect(screen.getByText("Soccer")).toBeDefined();
  expect(screen.queryByText("Dentist")).toBeNull();
});

test("the Home calendar pane shows another day with its day control and a way back to today", () => {
  const env = environment({ calendarDay: 1, expanded: null, selected: "family-day" });
  const { container } = renderWithEnglish(<FamilyBoard env={env} shown timeFormat="12" />);
  expect(screen.getByText("Tomorrow")).toBeDefined();
  expect(screen.getByText("Friday, January 16")).toBeDefined();
  expect(screen.getByText("Soccer")).toBeDefined();
  expect(screen.queryByText("Dentist")).toBeNull();
  expect(container.querySelector("[data-family-now]")).toBeNull();
  const control = container.querySelector("[data-family-day-control]") as HTMLElement;
  expect(control.getAttribute("data-focused")).toBe("true");
  expect(screen.getByText("Friday")).toBeDefined();
  expect(screen.getByText("Back to today")).toBeDefined();
  fireEvent.click(container.querySelector("[data-family-day-step='1']") as HTMLElement);
  expect(env.shiftCalendarDay).toHaveBeenCalledWith(1);
  fireEvent.click(control);
  expect(env.shiftCalendarDay).toHaveBeenCalledWith(0);
});

test("full-screen radar keeps a remote toggle back to the forecast", () => {
  const env = environment({ expanded: "weather", weatherFocus: "radar", weatherRadar: true });
  const radarMap = {
    ...createStore({ frames: [], host: "", status: "loading" as const }),
    dispose() {},
    watch: vi.fn(() => () => undefined),
  };
  const view = {
    ...env,
    runtime: { ...env.runtime, radarMap },
    settings: createStore({ performanceMode: true }),
  } as unknown as typeof env;
  const { container } = renderWithEnglish(<FamilyExpanded env={view} timeFormat="12" unit="F" />);

  expect(container.querySelector("[data-family-overlay='weather']")).not.toBeNull();
  expect(container.querySelector("[data-family-expanded='radar']")).not.toBeNull();
  expect(screen.getByText("Loading radar")).toBeDefined();
  expect(screen.getByText("Franklin, TN")).toBeDefined();
  expect(screen.getByText("Press Back to close")).toBeDefined();
  expect(container.querySelector("[data-family-radar-zoom-level]")?.textContent).toBe("7");
  fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
  expect(env.zoomRadar).toHaveBeenCalledWith(1);
  fireEvent.click(screen.getByRole("button", { name: "Zoom out" }));
  expect(env.zoomRadar).toHaveBeenCalledWith(-1);
  const toggle = screen.getByRole("button", { name: "Show the forecast" });
  expect(toggle.getAttribute("data-focused")).toBe("true");
  expect(toggle.getAttribute("data-family-radar-toggle")).toBe("forecast");
  fireEvent.click(toggle);
  expect(env.toggleWeatherRadar).toHaveBeenCalledTimes(1);
});

test("the Home calendar pane marks today with a badge", () => {
  const env = environment({ calendarDay: 0, expanded: null });
  const { container } = renderWithEnglish(<FamilyBoard env={env} shown timeFormat="12" />);
  expect(container.querySelector("[data-family-relative='today']")?.textContent).toBe("Today");
  expect(container.querySelector("[data-family-back-to-today]")).toBeNull();
});

const finishQueuedTiles = (root: ParentNode) => {
  for (let step = 0; step < 60; step += 1) {
    if (activeRadarTileLoads() === 0 && queuedRadarTileLoads() === 0) {
      return;
    }
    [...root.querySelectorAll("img")]
      .filter((image) => image.getAttribute("src"))
      .forEach((image) => image.dispatchEvent(new Event("load")));
  }
};

test("full-screen radar never autoplays, preloads frames before playing, and cleans up on exit", async () => {
  vi.useFakeTimers();
  resetRadarTileQueue();
  const width = vi.spyOn(Element.prototype, "clientWidth", "get").mockReturnValue(1920);
  const height = vi.spyOn(Element.prototype, "clientHeight", "get").mockReturnValue(1080);
  const stopWatch = vi.fn();
  try {
    const nowSec = Math.floor(NOON / 1000);
    const frames = [
      { kind: "past" as const, path: "/v2/radar/f0", time: nowSec - 1200 },
      { kind: "past" as const, path: "/v2/radar/f1", time: nowSec - 600 },
      { kind: "past" as const, path: "/v2/radar/f2", time: nowSec },
    ];
    const env = environment({
      expanded: "weather",
      radarPlaying: false,
      weatherFocus: "timeline",
      weatherRadar: true,
    });
    const radarMap = {
      ...createStore({
        frames,
        generated: nowSec,
        host: "https://tilecache.rainviewer.com",
        status: "ready" as const,
      }),
      dispose() {},
      watch: vi.fn(() => stopWatch),
    };
    const view = {
      ...env,
      runtime: { ...env.runtime, radarMap },
      settings: createStore({ performanceMode: false }),
    } as unknown as typeof env;
    const { container, unmount } = renderWithEnglish(<FamilyExpanded env={view} timeFormat="12" unit="F" />);

    const mapNode = container.querySelector("[data-family-radar-map]");
    const layerTiles = Number(mapNode?.getAttribute("data-radar-layer-tiles") || "0");
    expect(layerTiles).toBeGreaterThan(0);
    expect(layerTiles).toBeLessThanOrEqual(MAX_RADAR_TILES);
    expect(container.querySelector("[data-family-radar-legend]")).not.toBeNull();
    expect(container.querySelector("[data-family-radar-marker]")).not.toBeNull();
    expect(container.querySelector("[data-family-radar-when]")?.textContent).toMatch(/CST|GMT-6/);
    expect(container.querySelector("[data-family-radar-timeline]")?.getAttribute("data-radar-playing")).toBe("false");
    expect(container.querySelector("[data-family-radar-progress]")?.textContent).toContain("Loading frames");

    // Never autoplays on open.
    vi.advanceTimersByTime(RADAR_PLAY_STEP_MS * 4);
    expect(env.commandRadar).not.toHaveBeenCalledWith({ type: "tick" });

    // Even when the user presses Play, ticks wait until all frames finish preloading.
    await act(() => {
      env.state.set({ ...env.state.getSnapshot(), radarPlaying: true });
    });
    expect(container.querySelector("[data-family-radar-timeline]")?.getAttribute("data-radar-buffering")).toBe("true");
    vi.advanceTimersByTime(RADAR_PLAY_STEP_MS * 3);
    expect(env.commandRadar).not.toHaveBeenCalledWith({ type: "tick" });

    // Finish preloading all frames: buffering clears and playback ticks smoothly.
    await act(() => {
      finishQueuedTiles(container);
    });
    expect(container.querySelector("[data-family-radar-timeline]")?.getAttribute("data-radar-preload-ready")).toBe(
      "true",
    );
    expect(container.querySelector("[data-family-radar-timeline]")?.getAttribute("data-radar-buffering")).toBe("false");
    vi.advanceTimersByTime(RADAR_PLAY_STEP_MS * 3);
    expect(env.commandRadar).toHaveBeenCalledWith({ type: "tick" });

    // Closing / unmounting stops the radar feed watcher and releases every tile slot.
    unmount();
    expect(stopWatch).toHaveBeenCalledTimes(1);
    expect(activeRadarTileLoads()).toBe(0);
    expect(queuedRadarTileLoads()).toBe(0);
  } finally {
    width.mockRestore();
    height.mockRestore();
    vi.useRealTimers();
    resetRadarTileQueue();
  }
});
