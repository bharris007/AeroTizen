import type { Store } from "../shared/state/createStore";

export interface FamilyHour {
  readonly code: number;
  readonly hour: number;
  // Chance of precipitation in percent, when the forecast has it.
  readonly precipitation?: number;
  readonly temperature: number;
}

export interface FamilyDay {
  readonly code: number;
  readonly high: number;
  readonly low: number;
  // Highest chance of precipitation in percent, when the forecast has it.
  readonly precipitation?: number;
  // 0 = Sunday ... 6 = Saturday, from the forecast's own calendar date.
  readonly weekday: number;
}

export type FamilyForecastStatus = "loading" | "ready" | "unavailable";

// Extra current conditions for the full-screen weather view; each is null when unknown.
// Wind speed is mph with Fahrenheit and km/h with Celsius.
export interface FamilyConditions {
  readonly feelsLike: number | null;
  readonly humidity: number | null;
  readonly windSpeed: number | null;
}

export interface FamilyForecastSnapshot {
  readonly code: number | null;
  readonly conditions: FamilyConditions;
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
