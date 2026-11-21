import type { CalendarSource } from "../../contracts/familyCalendar";
import { equalRecord } from "../../shared/state/equalRecord";

export const MAX_CALENDARS = 24;
export const MAX_CALENDAR_NAME_LENGTH = 40;
const MAX_CALENDAR_URL_LENGTH = 2048;
const ID_PATTERN = /^[A-Za-z0-9_-]{1,40}$/;
const COLOUR_PATTERN = /^#[0-9a-f]{6}$/i;
const ACCOUNT_ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;
const MAX_GOOGLE_ID_LENGTH = 1024;
const MAX_ACCOUNT_LENGTH = 254;
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

export const accountId = (value: unknown) => (typeof value === "string" && ACCOUNT_ID_PATTERN.test(value) ? value : "");

const googleCalendarId = (value: unknown) =>
  typeof value === "string" && value.length > 0 && value.length <= MAX_GOOGLE_ID_LENGTH && !/\s/.test(value)
    ? value
    : "";

const accountName = (value: unknown) =>
  typeof value === "string"
    ? value
        // eslint-disable-next-line no-control-regex
        .replace(/[\u0000-\u001f]/g, "")
        .trim()
        .slice(0, MAX_ACCOUNT_LENGTH)
    : "";

// What a source points at: two sources with the same key are the same calendar.
export const calendarKey = (source: CalendarSource) =>
  source.kind === "google" ? "google:" + source.accountId + "/" + source.calendarId : source.url;

const icsSource = (id: string, url: string, name: string, color: string, enabled: boolean): CalendarSource => ({
  account: "",
  accountId: "",
  calendarId: "",
  color,
  enabled,
  id,
  kind: "ics",
  name,
  url,
});

const googleSource = (
  id: string,
  account: { readonly accountId: string; readonly email: string },
  calendarId: string,
  name: string,
  color: string,
  enabled: boolean,
): CalendarSource => ({
  account: account.email,
  accountId: account.accountId,
  calendarId,
  color,
  enabled,
  id,
  kind: "google",
  name,
  url: "",
});

// Saved sources from before Google sign-in have no kind and are iCal feeds.
const normalizeSource = (data: Record<string, unknown>, id: string): CalendarSource | null => {
  const name = calendarName(data.name) || "Calendar";
  const color = calendarColour(data.color);
  const enabled = data.enabled !== false;
  if (data.kind === "google") {
    const account = accountId(data.accountId);
    const calendarId = googleCalendarId(data.calendarId);
    return account && calendarId
      ? googleSource(id, { accountId: account, email: accountName(data.account) }, calendarId, name, color, enabled)
      : null;
  }
  const url = calendarUrl(data.url);
  return url ? icsSource(id, url, name, color, enabled) : null;
};

export const normalizeCalendars = (value: unknown): CalendarSource[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  const ids = new Set<string>();
  const keys = new Set<string>();
  const calendars: CalendarSource[] = [];
  value.forEach((item) => {
    const data = record(item);
    const id = typeof data.id === "string" && ID_PATTERN.test(data.id) ? data.id : "";
    const source = id ? normalizeSource(data, id) : null;
    if (!source || ids.has(id) || keys.has(calendarKey(source)) || calendars.length >= MAX_CALENDARS) {
      return;
    }
    ids.add(id);
    keys.add(calendarKey(source));
    calendars.push(source);
  });
  return calendars;
};

export const sameCalendars = (left: readonly CalendarSource[], right: readonly CalendarSource[]) =>
  left.length === right.length && left.every((calendar, index) => equalRecord(calendar, right[index]));

export interface IncomingCalendar {
  readonly accountId?: unknown;
  readonly calendars?: unknown;
  readonly color?: unknown;
  readonly email?: unknown;
  readonly name?: unknown;
  readonly type?: unknown;
  readonly url?: unknown;
}

const mergeIcs = (current: CalendarSource[], item: IncomingCalendar, createId: () => string) => {
  const url = calendarUrl(item.url);
  if (!url) {
    return current;
  }
  const name = calendarName(item.name) || "Calendar";
  const color = calendarColour(item.color);
  const index = current.findIndex((calendar) => calendar.kind === "ics" && calendar.url === url);
  if (index >= 0) {
    return current.map((calendar, position) =>
      position === index ? { ...calendar, color, enabled: true, name } : calendar,
    );
  }
  return current.length < MAX_CALENDARS ? [...current, icsSource(createId(), url, name, color, true)] : current;
};

// A Google sign-in carries the account's full selection, so it replaces that account's
// calendars. Calendars that stay keep their ids (and cached events).
const mergeGoogle = (next: CalendarSource[], item: IncomingCalendar, createId: () => string) => {
  const account = { accountId: accountId(item.accountId), email: accountName(item.email) };
  if (!account.accountId || !Array.isArray(item.calendars)) {
    return next;
  }
  const previous = next.filter((calendar) => calendar.kind === "google" && calendar.accountId === account.accountId);
  const position = next.findIndex((calendar) => previous.includes(calendar));
  const others = next.filter((calendar) => !previous.includes(calendar));
  const added: CalendarSource[] = [];
  (item.calendars as unknown[]).forEach((value) => {
    const data = record(value);
    const calendarId = googleCalendarId(data.id);
    if (!calendarId || added.some((calendar) => calendar.calendarId === calendarId)) {
      return;
    }
    if (others.length + added.length >= MAX_CALENDARS) {
      return;
    }
    const existing = previous.find((calendar) => calendar.calendarId === calendarId);
    added.push(
      googleSource(
        existing ? existing.id : createId(),
        account,
        calendarId,
        calendarName(data.name) || "Calendar",
        calendarColour(data.color),
        true,
      ),
    );
  });
  const at = position >= 0 ? Math.min(position, others.length) : others.length;
  return [...others.slice(0, at), ...added, ...others.slice(at)];
};

// Adds calendars sent from a phone. A repeated iCal address updates the existing entry's
// name and colour instead of adding a duplicate.
export const mergeIncomingCalendars = (
  current: readonly CalendarSource[],
  incoming: readonly IncomingCalendar[],
  createId: () => string,
): CalendarSource[] => {
  let next = [...current];
  incoming.forEach((item) => {
    if (item.type === "google") {
      next = mergeGoogle(next, item, createId);
    } else {
      next = mergeIcs(next, item, createId);
    }
  });
  return next;
};

// The Google accounts in use, in the order they were added.
export const googleAccounts = (sources: readonly CalendarSource[]) => {
  const accounts: { readonly account: string; readonly accountId: string }[] = [];
  sources.forEach((source) => {
    if (source.kind === "google" && !accounts.some((item) => item.accountId === source.accountId)) {
      accounts.push({ account: source.account, accountId: source.accountId });
    }
  });
  return accounts;
};
