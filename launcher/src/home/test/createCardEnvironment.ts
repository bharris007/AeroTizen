import { vi } from "vitest";

import type { AppPresentation, InstalledApp } from "../../contracts/launcher";
import { createStore } from "../../shared/state/createStore";
import type { HomeEnvironment, HomeState } from "../types";

export const createCardEnvironment = (selected = "", presentation: Partial<AppPresentation> = {}) => {
  const state = createStore<HomeState>({
    active: true,
    appOffset: 0,
    appsEndOffset: 0,
    radarFrame: null,
    radarFrameCount: 0,
    radarNowIndex: 0,
    radarPanning: false,
    radarPlaying: true,
    radarSpan: 1,
    calendarDay: 0,
    calendarFocus: "grid",
    calendarSpan: 3,
    calendarStart: 0,
    continueOffset: 0,
    expanded: null,
    weatherFocus: "view",
    weatherRadar: false,
    draft: null,
    menu: null,
    moving: null,
    page: "home",
    scroll: 0,
    selected,
  });
  const runtime: Pick<HomeEnvironment["runtime"], "inputs"> = {
    inputs: {
      canLearnIpControlInput: () => false,
      learnIpControlInput: () => Promise.resolve({ status: "unavailable" }),
      getSnapshot: () => ({ sources: [], visibleSources: [], playback: "idle" }),
      alwaysVisible: () => false,
      hasRecognizedDevice: () => false,
      isVisible: () => true,
      label: (source, defaultLabel) => source.editName ?? defaultLabel ?? runtime.inputs.portName(source),
      portName: (source) => `${source.type} ${source.number}`,
      dispose: () => undefined,
      leave: () => undefined,
      load: () => undefined,
      start: () => undefined,
      show: () => undefined,
      subscribe: () => () => undefined,
    },
  };
  // Isolated cards use only these Home controller fields.
  const environment: Pick<
    HomeEnvironment,
    | "state"
    | "nodes"
    | "activate"
    | "select"
    | "runtime"
    | "describe"
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
  > = {
    state,
    nodes: new Map<string, HTMLElement>(),
    activate: vi.fn(),
    calendarToday: vi.fn(),
    collapsePane: vi.fn(),
    commandRadar: vi.fn(),
    expandPane: vi.fn(),
    pageCalendar: vi.fn(),
    panRadar: vi.fn(),
    setCalendarSpan: vi.fn(),
    shiftCalendarDay: vi.fn(),
    toggleWeatherRadar: vi.fn(),
    toggleRadarPanning: vi.fn(),
    zoomRadar: vi.fn(),
    select: vi.fn(),
    runtime: runtime as HomeEnvironment["runtime"],
    describe: (app: InstalledApp): AppPresentation => ({
      artwork: [],
      title: app.name,
      ...presentation,
    }),
  };
  return environment as HomeEnvironment;
};
