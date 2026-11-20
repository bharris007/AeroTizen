import type { Store } from "../shared/state/createStore";

export interface FamilyHour {
  readonly code: number;
  readonly hour: number;
  readonly temperature: number;
}

export interface FamilyDay {
  readonly code: number;
  readonly high: number;
  readonly low: number;
  // 0 = Sunday ... 6 = Saturday, from the forecast's own calendar date.
  readonly weekday: number;
}

export type FamilyForecastStatus = "loading" | "ready" | "unavailable";

export interface FamilyForecastSnapshot {
  readonly code: number | null;
  readonly days: readonly FamilyDay[];
  readonly high: number | null;
  readonly hours: readonly FamilyHour[];
  readonly locationLabel: string;
  readonly low: number | null;
  readonly status: FamilyForecastStatus;
  // Today's sunrise/sunset as local minutes after midnight, or null when unknown.
  readonly sunriseMinute: number | null;
  readonly sunsetMinute: number | null;
  readonly temperature: number | null;
  // IANA zone used for today's calendar. Franklin's default is America/Chicago.
  readonly timeZone: string;
}

export interface FamilyForecastService extends Store<FamilyForecastSnapshot> {
  dispose(): void;
  start(): void;
}
