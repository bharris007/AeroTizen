import { resolveFamilyLocation } from "../../services/family/familyLocation";
import { clampRadarZoom, moveRadarCenter, radarViewport } from "../../services/radar/radarView";
import { getAppGridColumns } from "../../shared/apps/appCardSizes";
import { createInputScope } from "../../shared/input/createInputScope";
import { focusControl } from "../../shared/navigation/focusControl";
import { createStore } from "../../shared/state/createStore";
import { ADD_APPS_KEY } from "../homeControls";
import type {
  CalendarSpan,
  FamilyPane,
  HomeEnvironment,
  HomeMenuChoice,
  HomeState,
  Page,
  RadarCommand,
} from "../types";

import { revealHorizontalItem } from "./horizontalScroll";

const HEADER_KEYS = ["gear", "christmas-shortcut", "family-tab", "home-tab"] as const;
const FAMILY_ROW_KEYS = ["family-weather", "family-calendar"] as const;
export const FAMILY_DAY_KEY = "family-day";
export const FAMILY_RADAR_KEY = "family-radar";
// The calendar keeps events from a week back to a month ahead.
export const CALENDAR_FIRST_DAY = -7;
export const CALENDAR_LAST_DAY = 30;
const CALENDAR_SPANS: readonly CalendarSpan[] = [1, 3, 5];
const DEFAULT_CALENDAR_SPAN: CalendarSpan = 3;
const clampDay = (day: number, span = 1) => Math.max(CALENDAR_FIRST_DAY, Math.min(CALENDAR_LAST_DAY - span + 1, day));

const tabForPage = (page: Page) => {
  if (page === "apps") {
    return "apps-tab";
  }
  if (page === "family") {
    return "family-tab";
  }
  return "home-tab";
};

const pageForTab = (key: string): Page | null => {
  if (key === "home-tab") {
    return "home";
  }
  if (key === "apps-tab") {
    return "apps";
  }
  if (key === "family-tab") {
    return "family";
  }
  return null;
};
// Reserve 16px for the focus outline beyond the 112px top and 80px bottom fades.
const TOP_SCROLL_CLEARANCE = 128;
const BOTTOM_SCROLL_CLEARANCE = 96;
const APPS_END_CLEARANCE = 16;
const HOME_MENU_CHOICES = [
  { action: "move", label: "home.move" },
  { action: "remove", label: "home.removeFromHome" },
] as const;
const APP_MENU_CHOICES = {
  add: { action: "add", label: "home.addToHome" },
  remove: { action: "remove", label: "home.removeFromHome" },
} as const;

type Rows = readonly (readonly string[])[];

const getSelectedKey = (rows: Rows, selected: string, started: boolean) => {
  const first = rows[1]?.[0];
  if (!started && first) {
    return first;
  }
  if (rows.some((row) => row.includes(selected))) {
    return selected;
  }
  return first || "home-tab";
};

const getScrollOffset = ({
  selected,
  rows,
  previous,
  top,
  bottom,
  origin,
  limit,
}: {
  selected: string;
  rows: Rows;
  previous: number;
  top: number;
  bottom: number;
  origin: number;
  limit: number;
}) => {
  if (rows[0].includes(selected) || rows[1]?.includes(selected)) {
    return 0;
  }
  if (bottom - previous > limit) {
    return bottom - limit;
  }
  if (top - previous < origin + TOP_SCROLL_CLEARANCE) {
    return Math.max(0, top - origin - TOP_SCROLL_CLEARANCE);
  }
  return previous;
};

const moveItem = (items: readonly string[], from: number, to: number, item: string) => {
  const remaining = items.filter((_, index) => index !== from);
  return [...remaining.slice(0, to), item, ...remaining.slice(to)];
};

const getVerticalColumn = ({
  rows,
  row,
  target,
  selected,
  page,
  nodes,
  getViewport,
}: {
  rows: Rows;
  row: number;
  target: number;
  selected: string;
  page: Page;
  nodes: ReadonlyMap<string, HTMLElement>;
  getViewport(key: string): HTMLElement | null;
}) => {
  if (target === 0) {
    return rows[0].indexOf(tabForPage(page));
  }
  if (row === 0) {
    return 0;
  }
  const column = row === 0 ? 0 : rows[row].indexOf(selected);
  if (!getViewport(selected) && !getViewport(rows[target][0])) {
    return column;
  }
  const from = nodes.get(selected)?.getBoundingClientRect();
  if (!from) {
    return column;
  }
  const bounds = getViewport(rows[target][0])?.getBoundingClientRect();
  const nearest = rows[target].reduce(
    (nearest, key, column) => {
      const rect = nodes.get(key)?.getBoundingClientRect();
      if (!rect || (bounds && (rect.right <= bounds.left || rect.left >= bounds.right))) {
        return nearest;
      }
      const distance = Math.abs(rect.left + rect.right - from.left - from.right);
      return distance < nearest.distance ? { column, distance } : nearest;
    },
    { column, distance: Infinity },
  );
  return nearest.column;
};

// Remote transactions publish state synchronously; Preact owns every rendered node.
// No app/service commands are reimplemented here.
export const createHomeController = (
  env: Omit<
    HomeEnvironment,
    | "bridge"
    | "state"
    | "select"
    | "activate"
    | "showPage"
    | "choose"
    | "dismiss"
    | "menuChoices"
    | "calendarToday"
    | "collapsePane"
    | "commandRadar"
    | "expandPane"
    | "pageCalendar"
    | "panRadar"
    | "setCalendarSpan"
    | "shiftCalendarDay"
    | "toggleWeatherRadar"
    | "toggleRadarPanning"
    | "zoomRadar"
  >,
  transaction: (action: () => void) => void,
) => {
  const { runtime, settings, inventory, nodes } = env;
  const state = createStore<HomeState>({
    page: "family",
    appsEndOffset: 0,
    calendarDay: 0,
    calendarFocus: "grid",
    calendarSpan: DEFAULT_CALENDAR_SPAN,
    calendarStart: 0,
    expanded: null,
    scroll: 0,
    continueOffset: 0,
    selected: "",
    radarFrame: null,
    radarFrameCount: 0,
    radarNowIndex: 0,
    radarPanning: false,
    radarPlaying: false,
    radarSpan: 1,
    weatherFocus: "view",
    weatherRadar: false,
    active: true,
    appOffset: 0,
    moving: null,
    draft: null,
    menu: null,
  });
  let timer: number | undefined;
  let enterDown = false;
  let mediaPlayPauseDown = false;
  let started = false;
  const cancelPress = () => {
    if (timer !== undefined) {
      window.clearTimeout(timer);
    }
    timer = undefined;
    enterDown = false;
    mediaPlayPauseDown = false;
  };
  const update = (patch: Partial<HomeState>) =>
    transaction(() => {
      const before = state.getSnapshot();
      if (Object.keys(patch).some((key) => before[key as keyof HomeState] !== patch[key as keyof HomeState])) {
        state.set({ ...before, ...patch });
      }
    });
  const homeIds = () => {
    const saved =
      state.getSnapshot().draft ||
      (settings.getSnapshot().homeInitialized ? settings.getSnapshot().home : [runtime.config.FIREPLACE_ID]);
    // Movement must address the same visible IDs as the grid, not stale saved apps.
    return saved.filter(
      (id) => id === runtime.config.FIREPLACE_ID || !inventory.getSnapshot().ready || runtime.apps.byId(id),
    );
  };
  const ids = () =>
    state.getSnapshot().page === "home" ? homeIds() : inventory.getSnapshot().apps.map((app) => app.id);
  const scrollApps = () => state.getSnapshot().page === "home" && settings.getSnapshot().homeAppLayout === "scroll";
  const getScroller = (key: string) => {
    if (key.startsWith("continue:")) {
      return {
        track: env.continueItems.current,
        viewport: env.continueViewport.current,
        offset: "continueOffset",
      } as const;
    }
    if (key.startsWith("app:") && scrollApps()) {
      return { track: env.appItems.current, viewport: env.appViewport.current, offset: "appOffset" } as const;
    }
    return null;
  };
  const sourceKey = (source: { type: string; number?: number }) => "input:" + source.type + ":" + source.number;
  const rows = (): readonly (readonly string[])[] => {
    const page = state.getSnapshot().page;
    if (page === "family") {
      // The radar and day controls sit on the cards. Up from each card reaches its own control.
      return [HEADER_KEYS, FAMILY_ROW_KEYS, [FAMILY_RADAR_KEY, FAMILY_DAY_KEY]];
    }
    const columns = getAppGridColumns(settings.getSnapshot().homeCardColumns, page);
    const appKeys = ids().map((id) => "app:" + id);
    const all = state.getSnapshot().page === "apps" ? [ADD_APPS_KEY, ...appKeys] : appKeys;
    const rowLength = scrollApps() ? Math.max(1, all.length) : columns;
    const appRows = Array.from({ length: Math.ceil(all.length / rowLength) }, (_, index) =>
      all.slice(index * rowLength, (index + 1) * rowLength),
    );
    const appLayout = [HEADER_KEYS, ...appRows];
    if (state.getSnapshot().page !== "home") {
      return appKeys.length ? [...appLayout, ["back-to-top"]] : appLayout;
    }
    const { items, inputs } = inventory.getSnapshot();
    const continueRows =
      settings.getSnapshot().continueWatching && items.length ? [items.map((item) => "continue:" + item.key)] : [];
    const inputRows = inputs.length ? [inputs.map(sourceKey)] : [];
    return [...appLayout, ...continueRows, ...inputRows];
  };
  const focus = () => {
    if (document.hidden || runtime.settingsUi?.isOpen()) {
      update({ active: false });
      return;
    }
    const pending = state.getSnapshot();
    if (pending.moving && !ids().includes(pending.moving)) {
      update({ moving: null, draft: null });
      runtime.hideToast();
      cancelPress();
    }
    if (pending.menu && !ids().includes(pending.menu.id)) {
      update({ menu: null });
      cancelPress();
    }
    const list = rows();
    const old = state.getSnapshot().selected;
    const selected = getSelectedKey(list, old, started);
    if (list[1]?.length) {
      started = true;
    }
    if (old !== selected) {
      cancelPress();
    }
    update({ selected, active: true });
    const node = nodes.get(selected);
    const main = env.rows.current;
    if (!node || !main || runtime.settingsUi?.isOpen()) {
      return;
    }
    if (inputScope.getPath().length === 1) {
      focusControl(node);
    }
    const scroller = getScroller(selected);
    if (scroller?.track && scroller.viewport) {
      const offset = revealHorizontalItem(
        scroller.track,
        node,
        state.getSnapshot()[scroller.offset],
        document.documentElement.dir === "rtl",
      );
      update({ [scroller.offset]: offset });
    }
    // Home's header and first row always use the top position. Avoid style/layout reads for each horizontal move.
    if (
      pending.page === "family" ||
      (pending.page === "home" && (list[0].includes(selected) || list[1]?.includes(selected)))
    ) {
      update({ appsEndOffset: 0, scroll: 0 });
      return;
    }
    const mainTop = main.getBoundingClientRect().top;
    const apps = inventory.getSnapshot().apps;
    const lastCardKey = apps.length ? "app:" + apps[apps.length - 1].id : ADD_APPS_KEY;
    const lastAppRow = pending.page === "apps" ? list.find((row) => row.includes(lastCardKey)) : undefined;
    const lastApp = lastAppRow && nodes.get(lastAppRow[0]);
    const grid = lastApp?.parentElement;
    // The grid edge stays fixed while the last app's focus scale animates.
    const lastRowTop = lastApp && grid ? grid.getBoundingClientRect().bottom - lastApp.offsetHeight - mainTop : 0;
    const appsEndOffset = Math.max(0, Math.round(lastRowTop - APPS_END_CLEARANCE));
    if (selected === "back-to-top" || (pending.scroll === pending.appsEndOffset && lastAppRow?.includes(selected))) {
      update({ appsEndOffset, scroll: appsEndOffset });
      return;
    }
    const rect = node.getBoundingClientRect();
    const viewportBounds = main.parentElement?.getBoundingClientRect();
    const origin = viewportBounds?.top || 0;
    const scroll = getScrollOffset({
      selected,
      rows: list,
      previous: pending.scroll,
      top: rect.top - mainTop + origin,
      bottom: rect.bottom - mainTop + origin,
      origin,
      limit: (viewportBounds?.bottom || document.documentElement.clientHeight) - BOTTOM_SCROLL_CLEARANCE,
    });
    update({ appsEndOffset, scroll });
  };
  const select = (selected: string) => {
    const current = state.getSnapshot();
    if (current.selected !== selected) {
      cancelPress();
    }
    const resetWeatherFocus = !current.expanded && selected !== "family-weather" && current.weatherFocus !== "view";
    update(resetWeatherFocus ? { selected, weatherFocus: "view" } : { selected });
    focus();
  };
  const endMove = () => {
    const draft = state.getSnapshot().draft;
    if (draft) {
      settings.update({ home: [...homeIds()] });
    }
    update({ moving: null, draft: null });
    runtime.hideToast();
  };
  const dismiss = () => {
    update({ menu: null });
    focus();
  };
  const showPage = (page: Page) => {
    cancelPress();
    endMove();
    update({
      page,
      appsEndOffset: 0,
      scroll: 0,
      menu: null,
      selected: tabForPage(page),
      expanded: null,
      radarFrame: null,
      radarPanning: false,
      radarPlaying: false,
      weatherFocus: "view",
    });
    focus();
  };
  const expandPane = (pane: FamilyPane) => {
    const current = state.getSnapshot();
    update({
      calendarFocus: "grid",
      calendarStart: clampDay(current.calendarDay, current.calendarSpan),
      expanded: pane,
      radarFrame: null,
      radarPanning: false,
      radarPlaying: false,
      selected: pane === "weather" ? "family-weather" : "family-calendar",
      weatherFocus: pane === "weather" && current.weatherRadar ? "timeline" : "view",
    });
    focus();
  };
  const collapsePane = () => {
    const pane = state.getSnapshot().expanded;
    update({
      expanded: null,
      radarFrame: null,
      radarPanning: false,
      radarPlaying: false,
      selected: pane === "weather" ? "family-weather" : "family-calendar",
      weatherFocus: "view",
    });
    focus();
  };
  const shiftCalendarDay = (delta: number) => {
    update({ calendarDay: delta === 0 ? 0 : clampDay(state.getSnapshot().calendarDay + delta) });
  };
  const toggleWeatherRadar = () => {
    const current = state.getSnapshot();
    const nextRadar = !current.weatherRadar;
    update({
      radarFrame: null,
      radarPanning: false,
      radarPlaying: false,
      weatherFocus: current.expanded === "weather" ? current.weatherFocus : "view",
      weatherRadar: nextRadar,
    });
  };
  const toggleRadarPanning = () => {
    const current = state.getSnapshot();
    if (!current.weatherRadar) {
      return;
    }
    update({ radarPanning: !current.radarPanning, radarPlaying: false, weatherFocus: "pan" });
  };
  const radarPlace = () => resolveFamilyLocation(settings.getSnapshot().weatherLocation);
  const radarCamera = () => radarViewport(settings.getSnapshot().radarView, radarPlace());
  const saveRadarView = (next: { latitude: number; longitude: number; zoom: number }) => {
    const place = radarPlace();
    settings.update({
      radarView: {
        latitude: next.latitude,
        longitude: next.longitude,
        placeLatitude: place.latitude,
        placeLongitude: place.longitude,
        zoom: next.zoom,
      },
    });
  };
  const panRadar = (x: number, y: number) => {
    const current = radarCamera();
    const center = moveRadarCenter(current.latitude, current.longitude, current.zoom, x, y);
    update({ radarPlaying: false });
    saveRadarView({ latitude: center.latitude, longitude: center.longitude, zoom: current.zoom });
  };
  const zoomRadar = (delta: number) => {
    const current = radarCamera();
    const zoom = clampRadarZoom(current.zoom + delta);
    if (zoom === current.zoom) {
      return;
    }
    update({ radarPlaying: false });
    saveRadarView({ latitude: current.latitude, longitude: current.longitude, zoom });
  };
  const radarIndex = () => {
    const current = state.getSnapshot();
    if (current.radarFrame === null || current.radarFrameCount < 1) {
      return current.radarNowIndex;
    }
    return Math.max(0, Math.min(current.radarFrameCount - 1, current.radarFrame));
  };
  const commandRadar = (command: RadarCommand) => {
    const current = state.getSnapshot();
    if (command.type === "sync") {
      const count = Math.max(0, command.count);
      const nowIndex = count === 0 ? 0 : Math.max(0, Math.min(count - 1, command.nowIndex));
      const frame = current.radarFrame !== null && current.radarFrame >= count ? null : current.radarFrame;
      update({ radarFrame: frame, radarFrameCount: count, radarNowIndex: nowIndex });
      return;
    }
    if (command.type === "span") {
      update({ radarFrame: null, radarPlaying: false, radarSpan: command.span });
      return;
    }
    if (command.type === "play") {
      update({ radarPlaying: !current.radarPlaying });
      return;
    }
    if (command.type === "setPlaying") {
      update({ radarPlaying: command.playing });
      return;
    }
    const count = current.radarFrameCount;
    if (count < 1) {
      return;
    }
    const base = radarIndex();
    if (command.type === "tick") {
      if (!current.radarPlaying || count < 2) {
        return;
      }
      update({ radarFrame: (base + 1) % count });
      return;
    }
    if (command.type === "scrub") {
      update({ radarFrame: Math.max(0, Math.min(count - 1, base + command.delta)), radarPlaying: false });
      return;
    }
    update({ radarFrame: Math.max(0, Math.min(count - 1, command.index)), radarPlaying: false });
  };
  const setCalendarSpan = (span: CalendarSpan) => {
    update({ calendarSpan: span, calendarStart: clampDay(state.getSnapshot().calendarStart, span) });
  };
  const pageCalendar = (direction: number) => {
    const { calendarSpan, calendarStart } = state.getSnapshot();
    update({ calendarStart: clampDay(calendarStart + direction, calendarSpan) });
  };
  const calendarToday = () => update({ calendarStart: 0 });
  const activate = (key: string) => {
    const nextPage = pageForTab(key);
    if (key === "gear") {
      endMove();
      runtime.settingsUi?.open();
    } else if (key === "christmas-shortcut") {
      endMove();
      window.Christmas?.open();
    } else if (key === "samsung-home-shortcut") {
      if (runtime.homewatch.openSamsungHome) {
        runtime.homewatch.openSamsungHome();
      } else {
        runtime.homewatch.useSamsungHome();
      }
    } else if (nextPage) {
      showPage(nextPage);
    } else if (key === "family-weather" || key === "family-calendar") {
      expandPane(key === "family-weather" ? "weather" : "calendar");
    } else if (key === FAMILY_RADAR_KEY) {
      toggleWeatherRadar();
    } else if (key === FAMILY_DAY_KEY) {
      shiftCalendarDay(0);
    } else if (key === "back-to-top") {
      select(ADD_APPS_KEY);
    } else if (key === ADD_APPS_KEY) {
      runtime.apps.openStore();
    } else if (key.startsWith("app:")) {
      const id = key.slice(4);
      const app = runtime.apps.byId(id);
      if (id === runtime.config.FIREPLACE_ID) {
        runtime.apps.playFireplace();
      } else if (app) {
        runtime.apps.launch(app);
      }
    } else if (key.startsWith("continue:")) {
      // Use the current service record; stale cards must not launch.
      const item = runtime.continueWatching.getSnapshot().items.find((item) => item.key === key.slice(9));
      if (item) {
        runtime.continueWatching.open(item);
      }
    } else {
      const source = inventory.getSnapshot().inputs.find((source) => sourceKey(source) === key);
      if (source) {
        runtime.inputs.show(source);
      }
    }
  };
  const menuChoices = (): readonly HomeMenuChoice[] => {
    if (state.getSnapshot().page === "home") {
      return HOME_MENU_CHOICES;
    }
    const selected = homeIds().includes(state.getSnapshot().menu?.id || "");
    return [selected ? APP_MENU_CHOICES.remove : APP_MENU_CHOICES.add];
  };
  const choose = (index: number) => {
    const menu = state.getSnapshot().menu;
    const choice = menuChoices()[index];
    if (!menu || !choice) {
      return;
    }
    update({ menu: null });
    if (choice.action === "move") {
      update({ moving: menu.id, draft: [...homeIds()] });
      env.showMoveInstructions();
      focus();
      return;
    }
    const before = ids();
    const at = before.indexOf(menu.id);
    const home = [...homeIds()];
    settings.update({
      home: choice.action === "add" ? [...home, menu.id] : home.filter((id) => id !== menu.id),
    });
    if (state.getSnapshot().page === "home") {
      const after = ids();
      const nextApp = after[Math.min(Math.max(at, 0), after.length - 1)];
      const firstInput = inventory.getSnapshot().inputs[0];
      const fallback = firstInput ? sourceKey(firstInput) : "home-tab";
      update({ selected: nextApp ? "app:" + nextApp : fallback });
    }
    focus();
  };
  const K = runtime.config.KEY;
  const MEDIA_KEY_CODES = [K.MEDIA_PLAY, K.MEDIA_PAUSE, K.MEDIA_PLAY_PAUSE];
  const NAV_KEY_CODES = [K.LEFT, K.RIGHT, K.UP, K.DOWN, K.BACK, K.ESC, K.ENTER, ...MEDIA_KEY_CODES];
  // Remote keys for the Family page's panes. Returns true when the key was used.
  const familyKey = (code: number, delta: number) => {
    const current = state.getSnapshot();
    const horizontal = code === K.LEFT || code === K.RIGHT;
    if (code !== K.MEDIA_PLAY_PAUSE) {
      mediaPlayPauseDown = false;
    }
    const radarVisible = current.weatherRadar && (current.expanded === "weather" || current.expanded === null);
    if (radarVisible && MEDIA_KEY_CODES.includes(code)) {
      if (code === K.MEDIA_PLAY_PAUSE) {
        if (mediaPlayPauseDown) {
          return true;
        }
        mediaPlayPauseDown = true;
        commandRadar({ type: "play" });
        return true;
      }
      commandRadar({ playing: code === K.MEDIA_PLAY, type: "setPlaying" });
      return true;
    }
    if (MEDIA_KEY_CODES.includes(code)) {
      return false;
    }
    // Pan mode is opt-in. Back or OK leaves it; arrows then return to the controls.
    if (current.radarPanning) {
      if (code === K.BACK || code === K.ESC) {
        update({ radarPanning: false, weatherFocus: "pan" });
        return true;
      }
      if (code === K.ENTER && enterDown) {
        return true;
      }
      if (code === K.ENTER) {
        enterDown = true;
        update({ radarPanning: false, weatherFocus: "pan" });
        return true;
      }
      if (code === K.LEFT) {
        panRadar(-1, 0);
      } else if (code === K.RIGHT) {
        panRadar(1, 0);
      } else if (code === K.UP) {
        panRadar(0, -1);
      } else if (code === K.DOWN) {
        panRadar(0, 1);
      }
      return true;
    }
    if (current.expanded) {
      if (code === K.BACK || code === K.ESC) {
        collapsePane();
        return true;
      }
      // OK acts on key down here; holding it must not repeat.
      if (code === K.ENTER && enterDown) {
        return true;
      }
      enterDown = code === K.ENTER;
      if (current.expanded === "weather") {
        if (current.weatherFocus === "radar") {
          if (code === K.DOWN) {
            update({ weatherFocus: current.weatherRadar ? "zoomIn" : "view" });
          } else if (code === K.ENTER) {
            toggleWeatherRadar();
          }
          return true;
        }
        if (current.weatherRadar && current.weatherFocus === "zoomIn") {
          if (code === K.ENTER) {
            zoomRadar(1);
          } else if (code === K.UP) {
            update({ weatherFocus: "radar" });
          } else if (code === K.DOWN) {
            update({ weatherFocus: "zoomOut" });
          }
          return true;
        }
        if (current.weatherRadar && current.weatherFocus === "zoomOut") {
          if (code === K.ENTER) {
            zoomRadar(-1);
          } else if (code === K.UP) {
            update({ weatherFocus: "zoomIn" });
          } else if (code === K.DOWN) {
            update({ weatherFocus: "pan" });
          }
          return true;
        }
        if (current.weatherRadar && current.weatherFocus === "pan") {
          if (code === K.ENTER) {
            update({ radarPanning: true, weatherFocus: "pan" });
          } else if (code === K.UP) {
            update({ weatherFocus: "zoomOut" });
          } else if (code === K.DOWN) {
            update({ weatherFocus: "span" });
          }
          return true;
        }
        if (current.weatherRadar && current.weatherFocus === "span") {
          if (code === K.LEFT) {
            commandRadar({ span: 1, type: "span" });
          } else if (code === K.RIGHT) {
            commandRadar({ span: 2, type: "span" });
          } else if (code === K.UP) {
            update({ weatherFocus: "pan" });
          } else if (code === K.DOWN) {
            update({ weatherFocus: "timeline" });
          }
          return true;
        }
        if (current.weatherRadar && current.weatherFocus === "timeline") {
          if (code === K.LEFT) {
            commandRadar({ delta: -1, type: "scrub" });
          } else if (code === K.RIGHT) {
            commandRadar({ delta: 1, type: "scrub" });
          } else if (code === K.ENTER) {
            commandRadar({ type: "play" });
          } else if (code === K.UP) {
            update({ weatherFocus: "span" });
          }
          return true;
        }
        if (current.weatherRadar) {
          if (code === K.LEFT) {
            commandRadar({ delta: -1, type: "scrub" });
          } else if (code === K.RIGHT) {
            commandRadar({ delta: 1, type: "scrub" });
          } else if (code === K.ENTER) {
            commandRadar({ type: "play" });
          }
          update({ weatherFocus: "timeline" });
          return true;
        }
        if (code === K.UP) {
          update({ weatherFocus: "radar" });
          return true;
        }
        if (code === K.ENTER) {
          collapsePane();
        }
        return true;
      }
      if (current.calendarFocus === "span") {
        if (horizontal) {
          const index = CALENDAR_SPANS.indexOf(current.calendarSpan) + delta;
          setCalendarSpan(CALENDAR_SPANS[Math.max(0, Math.min(CALENDAR_SPANS.length - 1, index))]);
        } else if (code === K.DOWN || code === K.ENTER) {
          update({ calendarFocus: "grid" });
        }
        return true;
      }
      if (horizontal) {
        pageCalendar(delta);
      } else if (code === K.UP) {
        update({ calendarFocus: "span" });
      } else if (code === K.ENTER) {
        calendarToday();
      }
      return true;
    }
    if (current.selected === FAMILY_RADAR_KEY) {
      if (code === K.UP) {
        select(tabForPage("family"));
        return true;
      }
      if (code === K.DOWN) {
        select("family-weather");
        if (current.weatherRadar) {
          update({ weatherFocus: "zoomIn" });
        }
        return true;
      }
      if (horizontal) {
        if (current.weatherRadar && delta === 1) {
          select(FAMILY_DAY_KEY);
        }
        return true;
      }
      return false;
    }
    if (current.selected === FAMILY_DAY_KEY) {
      if (horizontal) {
        shiftCalendarDay(delta);
        return true;
      }
      if (code === K.UP || code === K.DOWN) {
        select(code === K.UP ? tabForPage("family") : "family-calendar");
        return true;
      }
      return false;
    }
    if (!current.expanded && current.weatherRadar && current.selected === "family-weather") {
      if (current.weatherFocus === "zoomIn") {
        if (code === K.ENTER && enterDown) {
          return true;
        }
        if (code === K.ENTER) {
          enterDown = true;
          zoomRadar(1);
        } else if (code === K.UP) {
          update({ weatherFocus: "view" });
          select(FAMILY_RADAR_KEY);
        } else if (code === K.DOWN) {
          update({ weatherFocus: "zoomOut" });
        }
        return true;
      }
      if (current.weatherFocus === "zoomOut") {
        if (code === K.ENTER && enterDown) {
          return true;
        }
        if (code === K.ENTER) {
          enterDown = true;
          zoomRadar(-1);
        } else if (code === K.UP) {
          update({ weatherFocus: "zoomIn" });
        } else if (code === K.DOWN) {
          update({ weatherFocus: "pan" });
        }
        return true;
      }
      if (current.weatherFocus === "pan") {
        if (code === K.ENTER && enterDown) {
          return true;
        }
        if (code === K.ENTER) {
          enterDown = true;
          update({ radarPanning: true, weatherFocus: "pan" });
        } else if (code === K.UP) {
          update({ weatherFocus: "zoomOut" });
        } else if (code === K.DOWN) {
          update({ weatherFocus: "view" });
        }
        return true;
      }
      if (current.weatherFocus === "timeline") {
        if (code === K.ENTER && enterDown) {
          return true;
        }
        if (code === K.ENTER) {
          enterDown = true;
          commandRadar({ type: "play" });
        } else if (code === K.LEFT) {
          commandRadar({ delta: -1, type: "scrub" });
        } else if (code === K.RIGHT) {
          commandRadar({ delta: 1, type: "scrub" });
        } else if (code === K.UP || code === K.BACK || code === K.ESC) {
          update({ weatherFocus: "view" });
        }
        return true;
      }
      if (code === K.UP) {
        update({ weatherFocus: "pan" });
        return true;
      }
      if (code === K.DOWN) {
        update({ weatherFocus: "timeline" });
        return true;
      }
    }
    if (code === K.UP && current.selected === "family-weather") {
      select(FAMILY_RADAR_KEY);
      return true;
    }
    if (code === K.UP && current.selected === "family-calendar") {
      select(FAMILY_DAY_KEY);
      return true;
    }
    return code === K.DOWN && (FAMILY_ROW_KEYS as readonly string[]).includes(current.selected);
  };
  const keydown = (code: number, event: Pick<KeyboardEvent, "preventDefault">) =>
    transaction(() => {
      const current = state.getSnapshot();
      // Rows run right to left in RTL languages, so Left moves to the next item there.
      const rtl = window.document?.documentElement.dir === "rtl";
      const delta = code === K.UP || (code === K.LEFT && !rtl) || (code === K.RIGHT && rtl) ? -1 : 1;
      if (!NAV_KEY_CODES.includes(code)) {
        return;
      }
      if (MEDIA_KEY_CODES.includes(code)) {
        if (current.page === "family" && familyKey(code, delta)) {
          event.preventDefault();
        }
        return;
      }
      event.preventDefault();
      if (current.page === "family" && familyKey(code, delta)) {
        return;
      }
      if (current.moving) {
        if (code === K.ENTER || code === K.BACK || code === K.ESC) {
          if (code !== K.ENTER || !enterDown) {
            enterDown = code === K.ENTER;
            endMove();
          }
          return;
        }
        if (scrollApps() && (code === K.UP || code === K.DOWN)) {
          return;
        }
        const home = [...homeIds()];
        const from = home.indexOf(current.moving);
        const step = code === K.UP || code === K.DOWN ? settings.getSnapshot().homeCardColumns : 1;
        const to = Math.max(0, Math.min(home.length - 1, from + delta * step));
        update({ draft: moveItem(home, from, to, current.moving) });
        focus();
        return;
      }
      if (code === K.ENTER) {
        if (enterDown) {
          return;
        }
        enterDown = true;
        const selected = current.selected;
        timer = window.setTimeout(() => {
          timer = undefined;
          if (enterDown && selected.startsWith("app:")) {
            update({ menu: { id: selected.slice(4) } });
          }
        }, runtime.config.LONG_PRESS_MS);
        return;
      }
      if (code === K.BACK || code === K.ESC) {
        if (current.page !== "family") {
          showPage("family");
        }
        return;
      }
      const all = rows();
      const row = all.findIndex((items) => items.includes(current.selected));
      if (row < 0) {
        focus();
        return;
      }
      const horizontal = code === K.LEFT || code === K.RIGHT;
      const target = horizontal ? row : row + delta;
      if (target < 0 || target >= all.length) {
        return;
      }
      const column = horizontal
        ? all[row].indexOf(current.selected) + delta
        : getVerticalColumn({
            rows: all,
            row,
            target,
            selected: current.selected,
            page: current.page,
            nodes,
            getViewport: (key) => getScroller(key)?.viewport || null,
          });
      select(all[target][Math.max(0, Math.min(all[target].length - 1, column))]);
    });
  const keyup = (code: number) => {
    if (code === K.MEDIA_PLAY_PAUSE) {
      mediaPlayPauseDown = false;
      return;
    }
    if (code !== K.ENTER) {
      return;
    }
    enterDown = false;
    if (timer === undefined) {
      return;
    }
    window.clearTimeout(timer);
    timer = undefined;
    if (!state.getSnapshot().menu && !state.getSnapshot().moving) {
      activate(state.getSnapshot().selected);
    }
  };
  const inputScope = createInputScope({
    onCancel: cancelPress,
    handle({ code, nativeEvent, phase }) {
      if (phase === "down") {
        keydown(code, nativeEvent);
      } else {
        keyup(code);
      }
      return "native";
    },
  });
  const bridge = {
    inputScope,
    cancelInput: cancelPress,
    render: focus,
    buildRows: focus,
    refreshApps: focus,
    focus,
    blur() {
      cancelPress();
      update({ active: false, menu: null });
    },
    keydown,
    keyup,
    showPage,
  };
  return {
    ...env,
    state,
    bridge,
    select,
    activate,
    showPage,
    choose,
    dismiss,
    menuChoices,
    calendarToday,
    collapsePane,
    commandRadar,
    expandPane,
    pageCalendar,
    setCalendarSpan,
    panRadar,
    shiftCalendarDay,
    toggleWeatherRadar,
    toggleRadarPanning,
    zoomRadar,
  };
};
