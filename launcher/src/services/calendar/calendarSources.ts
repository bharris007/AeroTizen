import type { CalendarSource } from "../../contracts/familyCalendar";
import { equalRecord } from "../../shared/state/equalRecord";

export const MAX_CALENDARS = 12;
export const MAX_CALENDAR_NAME_LENGTH = 40;
const MAX_CALENDAR_URL_LENGTH = 2048;
const ID_PATTERN = /^[A-Za-z0-9_-]{1,40}$/;
const COLOUR_PATTERN = /^#[0-9a-f]{6}$/i;
export const DEFAULT_CALENDAR_COLOUR = "#4285f4";

// Accepts https and webcal addresses; webcal is the same feed over HTTPS.
export const calendarUrl = (value: unknown) => {
  if (typeof value !== "string" || value.length > MAX_CALENDAR_URL_LENGTH) {
    return null;
  }
  const url = value.trim().replace(/^webcal:\/\//i, "https://");
  return /^https:\/\/[^\s/]+\.[^\s/]+\/\S*$/i.test(url) ? url : null;
};

const record = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

export const calendarName = (value: unknown) =>
  typeof value === "string"
    ? value
        // eslint-disable-next-line no-control-regex
        .replace(/[\u0000-\u001f]/g, "")
        .trim()
        .slice(0, MAX_CALENDAR_NAME_LENGTH)
    : "";

export const calendarColour = (value: unknown) =>
  typeof value === "string" && COLOUR_PATTERN.test(value) ? value.toLowerCase() : DEFAULT_CALENDAR_COLOUR;

export const normalizeCalendars = (value: unknown): CalendarSource[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  const seen = new Set<string>();
  const calendars: CalendarSource[] = [];
  value.forEach((item) => {
    const data = record(item);
    const url = calendarUrl(data.url);
    const id = typeof data.id === "string" && ID_PATTERN.test(data.id) ? data.id : "";
    if (!url || !id || seen.has(id) || calendars.length >= MAX_CALENDARS) {
      return;
    }
    seen.add(id);
    calendars.push({
      color: calendarColour(data.color),
      enabled: data.enabled !== false,
      id,
      name: calendarName(data.name) || "Calendar",
      url,
    });
  });
  return calendars;
};

export const sameCalendars = (left: readonly CalendarSource[], right: readonly CalendarSource[]) =>
  left.length === right.length && left.every((calendar, index) => equalRecord(calendar, right[index]));

export interface IncomingCalendar {
  readonly color?: unknown;
  readonly name?: unknown;
  readonly url?: unknown;
}

// Adds calendars sent from a phone. A repeated address updates the existing entry's name
// and colour instead of adding a duplicate.
export const mergeIncomingCalendars = (
  current: readonly CalendarSource[],
  incoming: readonly IncomingCalendar[],
  createId: () => string,
): CalendarSource[] => {
  const next = [...current];
  incoming.forEach((item) => {
    const url = calendarUrl(item.url);
    if (!url) {
      return;
    }
    const name = calendarName(item.name) || "Calendar";
    const color = calendarColour(item.color);
    const index = next.findIndex((calendar) => calendar.url === url);
    if (index >= 0) {
      next[index] = { ...next[index], color, enabled: true, name };
    } else if (next.length < MAX_CALENDARS) {
      next.push({ color, enabled: true, id: createId(), name, url });
    }
  });
  return next;
};
