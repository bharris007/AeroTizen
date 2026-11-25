import type { RefObject } from "preact";

import type { AppPresentation, ContinueItem, HomeBridge, InputSource, InstalledApp } from "../contracts/launcher";
import type { SettingsStore } from "../contracts/preferences";
import type { StatusStores } from "../contracts/status";
import type { LauncherUpdateNotice } from "../contracts/updates";
import type { LauncherRuntime } from "../platform/tizen/launcherRuntime";
import type { MessageKey } from "../shared/i18n/catalogues";
import type { MutableStore, Store } from "../shared/state/createStore";
export interface Inventory {
  readonly apps: readonly InstalledApp[];
  readonly inputs: readonly InputSource[];
  readonly items: readonly ContinueItem[];
  readonly ready: boolean;
}
export type Page = "apps" | "family" | "home";
export type FamilyPane = "weather" | "calendar";
export type CalendarSpan = 1 | 3 | 5;
// Which part of the full-screen calendar the remote is on.
export type CalendarFocus = "grid" | "span";
// Which part of the full-screen weather the remote is on.
// Radar adds the timeline, its 1h/2h span, and the zoom control.
export type WeatherFocus = "radar" | "span" | "timeline" | "view" | "zoom";
export type RadarCommand =
  | { count: number; nowIndex: number; type: "sync" }
  | { span: 1 | 2; type: "span" }
  | { type: "play" }
  | { delta: number; type: "scrub" }
  | { index: number; type: "seek" }
  | { type: "tick" };
export interface HomeMenuChoice {
  readonly action: "add" | "remove" | "move";
  readonly label: MessageKey;
}
export interface HomeState {
  readonly active: boolean;
  readonly appOffset: number;
  readonly appsEndOffset: number;
  // Family calendar: the Home pane's day and the full-screen view's first day, as days
  // from today, plus the full-screen span and remote focus.
  readonly calendarDay: number;
  readonly calendarFocus: CalendarFocus;
  readonly calendarSpan: CalendarSpan;
  readonly calendarStart: number;
  readonly continueOffset: number;
  readonly draft: readonly string[] | null;
  // The Family pane shown full screen, if any.
  readonly expanded: FamilyPane | null;
  readonly menu: Readonly<{ id: string }> | null;
  readonly moving: string | null;
  readonly page: Page;
  // Full-screen radar playback. A null frame follows the newest observation.
  readonly radarFrame: number | null;
  readonly radarFrameCount: number;
  readonly radarNowIndex: number;
  readonly radarPlaying: boolean;
  readonly radarSpan: 1 | 2;
  readonly scroll: number;
  readonly selected: string;
  // Full-screen weather: the forecast, or the radar toggle in the corner.
  readonly weatherFocus: WeatherFocus;
  // Home and full-screen weather show live radar instead of the forecast.
  readonly weatherRadar: boolean;
}
export interface HomeEnvironment {
  activate(key: string): void;
  appItems: RefObject<HTMLDivElement>;
  appViewport: RefObject<HTMLDivElement>;
  bridge: HomeBridge;
  // Full-screen calendar: Back to today, change span, page by span (-1 or 1).
  calendarToday(): void;
  choose(index: number): void;
  collapsePane(): void;
  // Full-screen radar timeline: play, scrub, seek, and choose 1h or the full range.
  commandRadar(command: RadarCommand): void;
  continueItems: RefObject<HTMLDivElement>;
  continueViewport: RefObject<HTMLDivElement>;
  describe(app: InstalledApp): AppPresentation;
  dismiss(): void;
  expandPane(pane: FamilyPane): void;
  inventory: Store<Inventory>;
  menuChoices(): readonly HomeMenuChoice[];
  nodes: Map<string, HTMLElement>;
  pageCalendar(direction: number): void;
  // Full-screen radar: move the map by one step. x is west/east, y is north/south (-1 or 1).
  panRadar(x: number, y: number): void;
  rows: RefObject<HTMLElement>;
  runtime: LauncherRuntime;
  select(key: string): void;
  setCalendarSpan(span: CalendarSpan): void;
  settings: SettingsStore;
  // Home pane: move the shown day (-1 or 1), or 0 for today.
  shiftCalendarDay(delta: number): void;
  showMoveInstructions(): void;
  showPage(page: Page): void;
  state: MutableStore<HomeState>;
  status: StatusStores;
  // Home and full-screen weather: switch between the forecast and live radar.
  toggleWeatherRadar(): void;
  updates: LauncherUpdateNotice;
  // Full-screen radar: change the saved zoom by one step.
  zoomRadar(delta: number): void;
}
