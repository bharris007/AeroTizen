import type { Store } from "../shared/state/createStore";

export interface FamilyHour {
  readonly code: number;
  readonly hour: number;
  readonly temperature: number;
}

export type FamilyForecastStatus = "loading" | "ready" | "unavailable";

export interface FamilyForecastSnapshot {
  readonly code: number | null;
  readonly high: number | null;
  readonly hours: readonly FamilyHour[];
  readonly locationLabel: string;
  readonly low: number | null;
  readonly status: FamilyForecastStatus;
  readonly temperature: number | null;
  // IANA zone used for today's calendar. Franklin's default is America/Chicago.
  readonly timeZone: string;
}

export interface FamilyForecastService extends Store<FamilyForecastSnapshot> {
  dispose(): void;
  start(): void;
}
