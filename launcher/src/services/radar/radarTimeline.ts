import type { TimeFormat } from "../../contracts/preferences";
import type { RadarFrame } from "../../contracts/radarMap";

import { NEXRAD_FRAMES } from "./rainViewer";

export const ONE_HOUR_SECONDS = 60 * 60;
export const RADAR_PLAY_STEP_MS = 740;
export const RADAR_PLAY_END_HOLD_MS = 1400;
const FULL_SPAN_SECONDS = 90 * 60;
const NOW_MATCH_SECONDS = 5 * 60;
const NEXRAD_STEPS = [
  { age: 50 * 60, frame: "m50m" },
  { age: 40 * 60, frame: "m40m" },
  { age: 30 * 60, frame: "m30m" },
  { age: 20 * 60, frame: "m20m" },
  { age: 10 * 60, frame: "m10m" },
  { age: 0, frame: "now" },
] as const;

export interface TimelineEntry {
  readonly forecast: boolean;
  readonly id: string;
  readonly nexrad: (typeof NEXRAD_FRAMES)[number] | null;
  readonly path: string | null;
  readonly time: number;
}

export interface RadarSpanChoice {
  readonly hours: number;
  readonly span: 1 | 2;
}

export type RadarPhase = "forecast" | "now" | "past";

const newestPast = (frames: readonly RadarFrame[]) => {
  const past = frames.filter((frame) => frame.kind !== "forecast");
  return past.length > 0 ? past[past.length - 1].time : 0;
};

// Minutes since RainViewer published the catalog, or since the newest observed frame.
export const radarAgeMinutes = (generated: number, newest: number, nowMs: number) => {
  const stamp = generated > 0 ? generated : newest;
  if (!Number.isFinite(stamp) || stamp <= 0) {
    return null;
  }
  return Math.max(0, Math.round((nowMs / 1000 - stamp) / 60));
};

export const framePhase = (entry: TimelineEntry, nowTime: number): RadarPhase => {
  if (entry.forecast) {
    return "forecast";
  }
  if (Math.abs(entry.time - nowTime) <= NOW_MATCH_SECONDS) {
    return "now";
  }
  return "past";
};

// 1 hour is the recent loop. The longer choice is the whole archive, labeled from its real length.
export const radarTimeline = (
  frames: readonly RadarFrame[],
  span: 1 | 2,
  overlay: "nexrad" | "rainviewer",
  nowSeconds: number,
) => {
  const anchor = newestPast(frames) || nowSeconds;
  if (overlay === "nexrad") {
    const entries: TimelineEntry[] = NEXRAD_STEPS.map((step) => ({
      forecast: false,
      id: "nexrad:" + step.frame,
      nexrad: step.frame,
      path: null,
      time: anchor - step.age,
    }));
    return {
      choices: [{ hours: 1, span: 1 }] as readonly RadarSpanChoice[],
      entries,
      nowIndex: entries.length - 1,
    };
  }
  const ordered = [...frames].sort((first, second) => first.time - second.time);
  const past = ordered.filter((frame) => frame.kind !== "forecast");
  const forecast = ordered.filter((frame) => frame.kind === "forecast");
  const start = past.length > 0 ? past[0].time : anchor;
  const choices: RadarSpanChoice[] = [{ hours: 1, span: 1 }];
  if (anchor - start >= FULL_SPAN_SECONDS) {
    choices.push({ hours: Math.max(2, Math.round((anchor - start) / ONE_HOUR_SECONDS)), span: 2 });
  }
  const cutoff = anchor - ONE_HOUR_SECONDS;
  const selectedPast = span === 1 ? past.filter((frame) => frame.time >= cutoff) : past;
  const selected = [...selectedPast, ...forecast];
  const entries: TimelineEntry[] = selected.map((frame) => ({
    forecast: frame.kind === "forecast",
    id: frame.kind + ":" + frame.time,
    nexrad: null,
    path: frame.path,
    time: frame.time,
  }));
  return {
    choices,
    entries,
    nowIndex: entries.length === 0 ? 0 : Math.max(0, selectedPast.length - 1),
  };
};

// Full timestamp in the location's time zone (e.g. America/Chicago Central Time for Franklin, TN).
export const formatRadarTimestamp = (time: number, timeZone: string, language: string, format: TimeFormat) => {
  const stamp = new Date(time * 1000);
  const weekday = new Intl.DateTimeFormat(language, { timeZone, weekday: "short" }).format(stamp);
  const clock = new Intl.DateTimeFormat(language, {
    hour: "numeric",
    hour12: format === "12",
    minute: "2-digit",
    timeZone,
    timeZoneName: "short",
  }).format(stamp);
  return weekday + ", " + clock;
};

export const formatRadarShortTime = (time: number, timeZone: string, language: string, format: TimeFormat) =>
  new Intl.DateTimeFormat(language, {
    hour: "numeric",
    hour12: format === "12",
    minute: "2-digit",
    timeZone,
  }).format(new Date(time * 1000));
