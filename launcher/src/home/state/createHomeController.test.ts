import { expect, test, vi } from "vitest";

import { launcherConfig } from "../../launcherConfig";
import { createStore } from "../../shared/state/createStore";
import type { Inventory } from "../types";

import { createHomeController } from "./createHomeController";

const KEY = launcherConfig.KEY;

const controller = () => {
  const inventory = createStore<Inventory>({
    apps: [{ id: "demo", name: "Demo" }],
    inputs: [],
    items: [],
    ready: true,
  });
  let saved = {
    continueWatching: false,
    home: ["demo"],
    homeAppLayout: "grid" as const,
    homeCardColumns: 3,
    homeInitialized: true,
    radarView: null as {
      latitude: number;
      longitude: number;
      placeLatitude: number;
      placeLongitude: number;
      zoom: number;
    } | null,
    weatherLocation: null,
  };
  const settings = {
    getSnapshot: () => saved,
    subscribe: () => () => undefined,
    update: (patch: Partial<typeof saved>) => {
      saved = { ...saved, ...patch };
    },
  };
  const runtime = {
    apps: { byId: (id: string) => (id === "demo" ? { id, name: "Demo" } : undefined) },
    config: launcherConfig,
    continueWatching: { getSnapshot: () => ({ items: [] }) },
    hideToast: () => undefined,
    homewatch: { useSamsungHome: () => undefined },
    inputs: { show: () => undefined },
  };
  return createHomeController(
    {
      appItems: { current: null },
      appViewport: { current: null },
      continueItems: { current: null },
      continueViewport: { current: null },
      describe: () => ({ artwork: [], title: "" }),
      inventory,
      nodes: new Map(),
      rows: { current: null },
      runtime,
      settings,
      showMoveInstructions: () => undefined,
    } as never,
    (action) => {
      action();
    },
  );
};

const press = (home: ReturnType<typeof controller>, code: number) => {
  home.bridge.keydown(code, { preventDefault() {} });
};

const ok = (home: ReturnType<typeof controller>) => {
  press(home, KEY.ENTER);
  home.bridge.keyup(KEY.ENTER);
};

test("moves from the header to Family and between its columns", () => {
  const home = controller();
  home.bridge.focus();
  // Family is the default page; its weather card is the first content item.
  expect(home.state.getSnapshot()).toMatchObject({ page: "family", selected: "family-weather" });

  // Up from weather reaches the radar control, then the Family tab.
  press(home, KEY.UP);
  expect(home.state.getSnapshot()).toMatchObject({ page: "family", selected: "family-radar" });
  press(home, KEY.UP);
  expect(home.state.getSnapshot()).toMatchObject({ page: "family", selected: "family-tab" });

  // Down moves into the family content columns.
  press(home, KEY.DOWN);
  expect(home.state.getSnapshot().selected).toBe("family-weather");
  press(home, KEY.RIGHT);
  expect(home.state.getSnapshot().selected).toBe("family-calendar");
  // Up from the calendar reaches its day control, then the tabs.
  press(home, KEY.UP);
  expect(home.state.getSnapshot().selected).toBe("family-day");
  press(home, KEY.UP);
  expect(home.state.getSnapshot().selected).toBe("family-tab");

  // Right moves to the Watch tab; activating it switches pages.
  press(home, KEY.RIGHT);
  expect(home.state.getSnapshot().selected).toBe("home-tab");
  ok(home);
  expect(home.state.getSnapshot()).toMatchObject({ page: "home", selected: "home-tab" });

  // Back returns to the default Family page.
  press(home, KEY.BACK);
  expect(home.state.getSnapshot()).toMatchObject({ page: "family", selected: "family-tab" });
});

test("the Christmas shortcut sits between the gear and the tabs and opens Christmas Mode", () => {
  const home = controller();
  const open = vi.fn();
  window.Christmas = { close() {}, isOpen: () => false, open };
  try {
    home.bridge.focus();
    press(home, KEY.UP);
    press(home, KEY.UP);
    expect(home.state.getSnapshot().selected).toBe("family-tab");
    press(home, KEY.LEFT);
    expect(home.state.getSnapshot().selected).toBe("christmas-shortcut");
    press(home, KEY.LEFT);
    expect(home.state.getSnapshot().selected).toBe("gear");
    press(home, KEY.RIGHT);
    expect(home.state.getSnapshot().selected).toBe("christmas-shortcut");

    ok(home);
    expect(open).toHaveBeenCalledOnce();
    expect(home.state.getSnapshot()).toMatchObject({ page: "family", selected: "christmas-shortcut" });

    press(home, KEY.RIGHT);
    expect(home.state.getSnapshot().selected).toBe("family-tab");
  } finally {
    window.Christmas = undefined;
  }
});

test("OK opens a Family pane full screen and Back closes it with focus kept on that pane", () => {
  const home = controller();
  home.bridge.focus();
  expect(home.state.getSnapshot().selected).toBe("family-weather");
  ok(home);
  expect(home.state.getSnapshot()).toMatchObject({ expanded: "weather", selected: "family-weather" });
  // Arrows do nothing behind the full-screen view.
  press(home, KEY.RIGHT);
  expect(home.state.getSnapshot()).toMatchObject({ expanded: "weather", selected: "family-weather" });
  press(home, KEY.BACK);
  expect(home.state.getSnapshot()).toMatchObject({ expanded: null, page: "family", selected: "family-weather" });

  press(home, KEY.RIGHT);
  ok(home);
  expect(home.state.getSnapshot()).toMatchObject({ expanded: "calendar", selected: "family-calendar" });
  press(home, KEY.BACK);
  expect(home.state.getSnapshot()).toMatchObject({ expanded: null, page: "family", selected: "family-calendar" });
  // Down from a pane stays put.
  press(home, KEY.DOWN);
  expect(home.state.getSnapshot().selected).toBe("family-calendar");
});

test("the weather radar control toggles live radar on the card and in full screen", () => {
  const home = controller();
  home.bridge.focus();
  press(home, KEY.UP);
  expect(home.state.getSnapshot()).toMatchObject({
    selected: "family-radar",
    weatherFocus: "view",
    weatherRadar: false,
  });
  ok(home);
  expect(home.state.getSnapshot()).toMatchObject({ selected: "family-radar", weatherRadar: true });
  ok(home);
  expect(home.state.getSnapshot().weatherRadar).toBe(false);
  press(home, KEY.RIGHT);
  expect(home.state.getSnapshot().selected).toBe("family-radar");
  press(home, KEY.DOWN);
  expect(home.state.getSnapshot().selected).toBe("family-weather");

  ok(home);
  expect(home.state.getSnapshot()).toMatchObject({ expanded: "weather", weatherFocus: "view", weatherRadar: false });
  press(home, KEY.UP);
  expect(home.state.getSnapshot().weatherFocus).toBe("radar");
  press(home, KEY.ENTER);
  press(home, KEY.ENTER);
  expect(home.state.getSnapshot()).toMatchObject({ expanded: "weather", weatherFocus: "radar", weatherRadar: true });
  home.bridge.keyup(KEY.ENTER);
  expect(home.state.getSnapshot().weatherRadar).toBe(true);
  press(home, KEY.DOWN);
  expect(home.state.getSnapshot().weatherFocus).toBe("zoomIn");
  press(home, KEY.DOWN);
  expect(home.state.getSnapshot().weatherFocus).toBe("zoomOut");
  press(home, KEY.DOWN);
  expect(home.state.getSnapshot().weatherFocus).toBe("pan");
  press(home, KEY.DOWN);
  expect(home.state.getSnapshot().weatherFocus).toBe("span");
  press(home, KEY.DOWN);
  expect(home.state.getSnapshot().weatherFocus).toBe("timeline");
  press(home, KEY.DOWN);
  expect(home.state.getSnapshot().weatherFocus).toBe("view");
  ok(home);
  expect(home.state.getSnapshot()).toMatchObject({ expanded: "weather", weatherFocus: "timeline", weatherRadar: true });
  press(home, KEY.BACK);
  expect(home.state.getSnapshot()).toMatchObject({ expanded: null, selected: "family-weather", weatherRadar: true });
});

test("full-screen radar pans and zooms with the remote and saves that view", () => {
  const home = controller();
  home.bridge.focus();
  home.toggleWeatherRadar();
  home.expandPane("weather");
  expect(home.state.getSnapshot()).toMatchObject({ radarPanning: false, weatherFocus: "view", weatherRadar: true });

  // Arrows on the map navigate controls; they do not pan until pan mode is on.
  press(home, KEY.RIGHT);
  expect(home.settings.getSnapshot().radarView).toBeNull();
  expect(home.state.getSnapshot().expanded).toBe("weather");

  press(home, KEY.ENTER);
  expect(home.state.getSnapshot().weatherFocus).toBe("timeline");
  press(home, KEY.UP);
  press(home, KEY.UP);
  expect(home.state.getSnapshot().weatherFocus).toBe("pan");
  ok(home);
  expect(home.state.getSnapshot().radarPanning).toBe(true);
  press(home, KEY.RIGHT);
  const panned = home.settings.getSnapshot().radarView;
  expect(panned?.zoom).toBe(7);
  expect(panned?.longitude).toBeGreaterThan(panned?.placeLongitude ?? 0);
  expect(home.state.getSnapshot()).toMatchObject({ expanded: "weather", radarPanning: true });

  press(home, KEY.BACK);
  expect(home.state.getSnapshot()).toMatchObject({
    expanded: "weather",
    radarPanning: false,
    weatherFocus: "pan",
  });
  ok(home);
  expect(home.state.getSnapshot().radarPanning).toBe(true);
  ok(home);
  expect(home.state.getSnapshot().radarPanning).toBe(false);

  press(home, KEY.UP);
  expect(home.state.getSnapshot().weatherFocus).toBe("zoomOut");
  press(home, KEY.UP);
  expect(home.state.getSnapshot().weatherFocus).toBe("zoomIn");
  ok(home);
  ok(home);
  expect(home.settings.getSnapshot().radarView?.zoom).toBe(9);
  press(home, KEY.DOWN);
  expect(home.state.getSnapshot().weatherFocus).toBe("zoomOut");
  ok(home);
  expect(home.settings.getSnapshot().radarView?.zoom).toBe(8);
  press(home, KEY.UP);
  for (let step = 0; step < 6; step += 1) {
    ok(home);
  }
  expect(home.settings.getSnapshot().radarView?.zoom).toBe(10);
  press(home, KEY.UP);
  expect(home.state.getSnapshot().weatherFocus).toBe("radar");
  press(home, KEY.DOWN);
  expect(home.state.getSnapshot().weatherFocus).toBe("zoomIn");
});

test("the split weather radar card pans and zooms with the remote and saves that view", () => {
  const home = controller();
  home.bridge.focus();
  home.toggleWeatherRadar();
  expect(home.state.getSnapshot()).toMatchObject({
    expanded: null,
    radarPanning: false,
    selected: "family-weather",
    weatherFocus: "view",
    weatherRadar: true,
  });

  // Default arrows still move between the two columns.
  press(home, KEY.RIGHT);
  expect(home.state.getSnapshot().selected).toBe("family-calendar");
  expect(home.settings.getSnapshot().radarView).toBeNull();
  press(home, KEY.LEFT);
  expect(home.state.getSnapshot().selected).toBe("family-weather");

  press(home, KEY.UP);
  expect(home.state.getSnapshot()).toMatchObject({
    selected: "family-weather",
    weatherFocus: "pan",
    radarPanning: false,
  });
  ok(home);
  expect(home.state.getSnapshot().radarPanning).toBe(true);
  press(home, KEY.RIGHT);
  const panned = home.settings.getSnapshot().radarView;
  expect(panned?.zoom).toBe(7);
  expect(panned?.longitude).toBeGreaterThan(panned?.placeLongitude ?? 0);
  expect(home.state.getSnapshot()).toMatchObject({ expanded: null, selected: "family-weather" });

  press(home, KEY.BACK);
  expect(home.state.getSnapshot()).toMatchObject({
    expanded: null,
    radarPanning: false,
    selected: "family-weather",
    weatherFocus: "pan",
  });

  press(home, KEY.UP);
  expect(home.state.getSnapshot()).toMatchObject({ selected: "family-weather", weatherFocus: "zoomOut" });
  press(home, KEY.UP);
  expect(home.state.getSnapshot()).toMatchObject({ selected: "family-weather", weatherFocus: "zoomIn" });
  ok(home);
  expect(home.settings.getSnapshot().radarView?.zoom).toBe(8);
  press(home, KEY.DOWN);
  expect(home.state.getSnapshot().weatherFocus).toBe("zoomOut");
  ok(home);
  expect(home.settings.getSnapshot().radarView?.zoom).toBe(7);
  press(home, KEY.UP);
  press(home, KEY.UP);
  expect(home.state.getSnapshot().selected).toBe("family-radar");
  press(home, KEY.RIGHT);
  expect(home.state.getSnapshot().selected).toBe("family-day");
  press(home, KEY.DOWN);
  expect(home.state.getSnapshot().selected).toBe("family-calendar");
  press(home, KEY.LEFT);
  expect(home.state.getSnapshot().selected).toBe("family-weather");
});

test("the radar timeline plays, scrubs, and switches between one hour and the full range", () => {
  const home = controller();
  home.toggleWeatherRadar();
  home.expandPane("weather");
  home.commandRadar({ count: 8, nowIndex: 6, type: "sync" });
  press(home, KEY.ENTER);
  expect(home.state.getSnapshot()).toMatchObject({ radarPlaying: true, weatherFocus: "timeline" });
  press(home, KEY.RIGHT);
  expect(home.state.getSnapshot()).toMatchObject({ radarFrame: 7, radarPlaying: false });
  press(home, KEY.LEFT);
  press(home, KEY.LEFT);
  expect(home.state.getSnapshot()).toMatchObject({ radarFrame: 5, radarPlaying: false });
  press(home, KEY.ENTER);
  expect(home.state.getSnapshot().radarPlaying).toBe(true);
  home.commandRadar({ type: "tick" });
  expect(home.state.getSnapshot().radarFrame).toBe(6);
  press(home, KEY.UP);
  expect(home.state.getSnapshot().weatherFocus).toBe("span");
  press(home, KEY.RIGHT);
  expect(home.state.getSnapshot()).toMatchObject({ radarFrame: null, radarSpan: 2 });
  press(home, KEY.LEFT);
  expect(home.state.getSnapshot().radarSpan).toBe(1);
});

test("the calendar's day control changes the Home pane's day and OK returns to today", () => {
  const home = controller();
  home.bridge.focus();
  press(home, KEY.RIGHT);
  press(home, KEY.UP);
  expect(home.state.getSnapshot().selected).toBe("family-day");
  press(home, KEY.RIGHT);
  press(home, KEY.RIGHT);
  expect(home.state.getSnapshot()).toMatchObject({ calendarDay: 2, selected: "family-day" });
  press(home, KEY.LEFT);
  expect(home.state.getSnapshot().calendarDay).toBe(1);
  ok(home);
  expect(home.state.getSnapshot().calendarDay).toBe(0);
  for (let index = 0; index < 12; index++) {
    press(home, KEY.LEFT);
  }
  expect(home.state.getSnapshot().calendarDay).toBe(-7);
  press(home, KEY.DOWN);
  expect(home.state.getSnapshot().selected).toBe("family-calendar");

  // Full screen opens on the shown day.
  ok(home);
  expect(home.state.getSnapshot()).toMatchObject({ calendarSpan: 3, calendarStart: -7, expanded: "calendar" });
});

test("in RTL, Left moves the day control forward", () => {
  document.documentElement.dir = "rtl";
  try {
    const home = controller();
    home.bridge.focus();
    home.select("family-day");
    press(home, KEY.LEFT);
    expect(home.state.getSnapshot().calendarDay).toBe(1);
  } finally {
    document.documentElement.dir = "ltr";
  }
});

test("the full-screen calendar moves one day at a time and Up picks 1, 3 or 5 days", () => {
  const home = controller();
  home.bridge.focus();
  home.expandPane("calendar");
  expect(home.state.getSnapshot()).toMatchObject({ calendarFocus: "grid", calendarSpan: 3, calendarStart: 0 });
  press(home, KEY.RIGHT);
  expect(home.state.getSnapshot().calendarStart).toBe(1);
  press(home, KEY.RIGHT);
  expect(home.state.getSnapshot().calendarStart).toBe(2);
  press(home, KEY.LEFT);
  expect(home.state.getSnapshot().calendarStart).toBe(1);

  press(home, KEY.UP);
  expect(home.state.getSnapshot().calendarFocus).toBe("span");
  press(home, KEY.RIGHT);
  expect(home.state.getSnapshot().calendarSpan).toBe(5);
  press(home, KEY.RIGHT);
  expect(home.state.getSnapshot().calendarSpan).toBe(5);
  press(home, KEY.DOWN);
  expect(home.state.getSnapshot().calendarFocus).toBe("grid");
  press(home, KEY.RIGHT);
  expect(home.state.getSnapshot().calendarStart).toBe(2);

  // OK goes back to today; paging stops at the end of the synced month.
  ok(home);
  expect(home.state.getSnapshot().calendarStart).toBe(0);
  for (let index = 0; index < 40; index++) {
    press(home, KEY.RIGHT);
  }
  expect(home.state.getSnapshot().calendarStart).toBe(26);

  press(home, KEY.UP);
  press(home, KEY.LEFT);
  press(home, KEY.LEFT);
  expect(home.state.getSnapshot().calendarSpan).toBe(1);
  press(home, KEY.BACK);
  expect(home.state.getSnapshot()).toMatchObject({ expanded: null, selected: "family-calendar" });

  // The span is remembered the next time the calendar opens.
  home.expandPane("calendar");
  expect(home.state.getSnapshot()).toMatchObject({ calendarFocus: "grid", calendarSpan: 1 });
});
