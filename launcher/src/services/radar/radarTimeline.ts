import type { TimeFormat } from "../../contracts/preferences";
import type { RadarFrame } from "../../contracts/radarMap";

import { NEXRAD_FRAMES } from "./rainViewer";

export const ONE_HOUR_SECONDS = 60 * 60;
// Hard frame budget so total decoded radar memory stays well below 20 MB on Tizen TVs.
export const MAX_RADAR_FRAMES = 6;
export const RADAR_PLAY_STEP_MS = 820;
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

export type RadarPhase = "forecast" | "now" | "past";
export type RadarSpan = 1 | 2;

export interface RadarSpanChoice {
  readonly hours: number;
  readonly span: RadarSpan;
}

export interface TimelineEntry {
  readonly forecast: boolean;
  readonly id: string;
  readonly nexrad?: (typeof NEXRAD_FRAMES)[number];
  readonly path?: string;
  readonly time: number;
}

export interface RadarTimeline {
  readonly choices: readonly RadarSpanChoice[];
  readonly entries: readonly TimelineEntry[];
  readonly nowIndex: number;
}

const sameSpan = (entries: readonly RadarFrame[], span: RadarSpan) => {
  if (span === 2 || entries.length === 0) {
    return entries;
  }
  const observed = entries.filter((entry) => entry.kind === "past");
  const latest = observed[observed.length - 1]?.time ?? entries[entries.length - 1].time;
  const cutoff = latest - ONE_HOUR_SECONDS;
  return entries.filter((entry) => entry.kind === "forecast" || entry.time >= cutoff);
};

// Evenly sample an ordered list down to at most limit items, always preserving first and last.
const sampleEvenly = <T>(items: readonly T[], limit: number): readonly T[] => {
  if (items.length <= limit) {
    return items;
  }
  if (limit <= 1) {
    return items.slice(-1);
  }
  const picked: T[] = [];
  const step = (items.length - 1) / (limit - 1);
  for (let slot = 0; slot < limit; slot += 1) {
    const index = Math.round(slot * step);
    const item = items[index];
    if (picked[picked.length - 1] !== item) {
      picked.push(item);
    }
  }
  return picked;
};

// Keep at most MAX_RADAR_FRAMES (6) frames, always preserving the latest observed ("Now") frame.
const capFrames = (frames: readonly RadarFrame[], span: RadarSpan): readonly RadarFrame[] => {
  if (frames.length <= MAX_RADAR_FRAMES) {
    return frames;
  }
  const observed = frames.filter((frame) => frame.kind === "past");
  const forecast = frames.filter((frame) => frame.kind === "forecast");
  const keptForecast = forecast.slice(0, Math.min(2, MAX_RADAR_FRAMES - 1));
  const pastBudget = Math.max(1, MAX_RADAR_FRAMES - keptForecast.length);
  const keptPast = span === 1 ? observed.slice(-pastBudget) : sampleEvenly(observed, pastBudget);
  return [...keptPast, ...keptForecast];
};

const toEntry = (frame: RadarFrame): TimelineEntry => ({
  forecast: frame.kind === "forecast",
  id: frame.kind + ":" + frame.time,
  path: frame.path,
  time: frame.time,
});

const latestObservedIndex = (entries: readonly TimelineEntry[]) => {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    if (!entries[index].forecast) {
      return index;
    }
  }
  return Math.max(0, entries.length - 1);
};

// Frames and available ranges for the active radar source, strictly capped at MAX_RADAR_FRAMES (6).
export const radarTimeline = (
  frames: readonly RadarFrame[],
  span: RadarSpan,
  source: "nexrad" | "rainviewer",
  nowSeconds: number,
): RadarTimeline => {
  if (source === "nexrad") {
    const base = Math.floor(nowSeconds / 600) * 600;
    const entries = NEXRAD_STEPS.slice(-MAX_RADAR_FRAMES).map((step) => ({
      forecast: false,
      id: "nexrad:" + step.frame,
      nexrad: step.frame,
      time: base - step.age,
    }));
    return {
      choices: [{ hours: 1, span: 1 }],
      entries,
      nowIndex: entries.length - 1,
    };
  }
  const observed = frames.filter((frame) => frame.kind === "past");
  const history = observed.length > 1 ? observed[observed.length - 1].time - observed[0].time : 0;
  const choices: RadarSpanChoice[] =
    history >= FULL_SPAN_SECONDS
      ? [
          { hours: 1, span: 1 },
          { hours: 2, span: 2 },
        ]
      : [{ hours: 1, span: 1 }];
  const activeSpan: RadarSpan = span === 2 && choices.length > 1 ? 2 : 1;
  const entries = capFrames(sameSpan(frames, activeSpan), activeSpan).map(toEntry);
  return {
    choices,
    entries,
    nowIndex: latestObservedIndex(entries),
  };
};

export const framePhase = (entry: TimelineEntry, nowTime: number): RadarPhase => {
  if (entry.forecast) {
    return "forecast";
  }
  return Math.abs(entry.time - nowTime) <= NOW_MATCH_SECONDS ? "now" : "past";
};

export const radarAgeMinutes = (generated: number, latestTime: number, nowMs: number) => {
  const updated = generated > 0 ? generated : latestTime;
  if (updated <= 0) {
    return null;
  }
  return Math.max(0, Math.round((nowMs - updated * 1000) / 60_000));
};

// Full timestamp for the timeline header (e.g. "Thu, 9:30 PM CST").
export const formatRadarTimestamp = (
  epochSeconds: number,
  timeZone: string,
  language: string,
  timeFormat: TimeFormat,
) => {
  try {
    return new Intl.DateTimeFormat(language, {
      hour: "numeric",
      hour12: timeFormat !== "24",
      minute: "2-digit",
      timeZone,
      timeZoneName: "short",
      weekday: "short",
    }).format(new Date(epochSeconds * 1000));
  } catch {
    return new Date(epochSeconds * 1000).toLocaleTimeString();
  }
};

// Compact axis label (e.g. "8:30 PM" or "20:30").
export const formatRadarShortTime = (
  epochSeconds: number,
  timeZone: string,
  language: string,
  timeFormat: TimeFormat,
) => {
  try {
    return new Intl.DateTimeFormat(language, {
      hour: "numeric",
      hour12: timeFormat !== "24",
      minute: "2-digit",
      timeZone,
    }).format(new Date(epochSeconds * 1000));
  } catch {
    return new Date(epochSeconds * 1000).toLocaleTimeString();
  }
};
