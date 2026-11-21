import type { AllDayCalendarEvent, TimedCalendarEvent } from "../../contracts/familyCalendar";

// Relay that pairs a phone with this TV, keeps the encrypted Google sign-ins this TV owns,
// and proxies calendar feeds the TV cannot fetch directly. Pasted calendar addresses stay
// on the relay only until the TV collects them.
export const CALENDAR_RELAY_URL = "https://aerotizen-cal.vercel.app";
export const CALENDAR_RELAY_HOST = "aerotizen-cal.vercel.app";

const SECRET_BYTES = 16;

export const relaySessionUrl = (base: string) => base + "/api/session";
export const relayClaimUrl = (base: string, code: string) => base + "/api/session/" + code + "/claim";
export const relayProxyUrl = (base: string) => base + "/api/ics";
export const relayEventsUrl = (base: string) => base + "/api/events";
export const relayRemoveAccountUrl = (base: string) => base + "/api/accounts/remove";
export const relayPairingUrl = (base: string, code: string) => base + "/c/" + code;

// "K7P29QXM" is easier to read from across the room as "K7P2-9QXM".
export const formatPairingCode = (code: string) => (code.length === 8 ? code.slice(0, 4) + "-" + code.slice(4) : code);

export type FillRandom = (bytes: Uint8Array<ArrayBuffer>) => void;

export const createPairingSecret = (fillRandom: FillRandom) => {
  const bytes = new Uint8Array(SECRET_BYTES);
  fillRandom(bytes);
  let secret = "";
  bytes.forEach((byte) => {
    secret += (byte < 16 ? "0" : "") + byte.toString(16);
  });
  return secret;
};

export const validPairingSecret = (value: unknown): value is string =>
  typeof value === "string" && /^[a-f0-9]{32}$/.test(value);

interface SessionReply {
  readonly code: string;
  readonly expiresAt: number;
}

export const parseSessionReply = (text: string): SessionReply | null => {
  try {
    const data = JSON.parse(text) as Partial<SessionReply>;
    return typeof data.code === "string" && /^[0-9A-Z]{8}$/.test(data.code) && typeof data.expiresAt === "number"
      ? { code: data.code, expiresAt: data.expiresAt }
      : null;
  } catch {
    return null;
  }
};

export const parseClaimReply = (text: string): readonly Record<string, unknown>[] | null => {
  try {
    const data = JSON.parse(text) as { calendars?: unknown };
    return Array.isArray(data.calendars)
      ? data.calendars.filter(
          (item): item is Record<string, unknown> => item !== null && typeof item === "object" && !Array.isArray(item),
        )
      : null;
  } catch {
    return null;
  }
};

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_TITLE_LENGTH = 120;
const MAX_EVENTS = 1000;

export type RelayEvent =
  Omit<AllDayCalendarEvent, "calendarId" | "color"> | Omit<TimedCalendarEvent, "calendarId" | "color">;

// One Google calendar's events from the relay, or why they could not be read.
export type RelayCalendarReply = { readonly events: readonly RelayEvent[] } | { readonly error: string };

const finite = (value: unknown): value is number => typeof value === "number" && isFinite(value);

// Checks one event from the relay. All-day events use day numbers like the iCal parser.
const relayEvent = (value: unknown): RelayEvent | null => {
  if (value === null || typeof value !== "object") {
    return null;
  }
  const data = value as Record<string, unknown>;
  const id = typeof data.id === "string" ? data.id.slice(0, 200) : "";
  const title = typeof data.title === "string" ? data.title.slice(0, MAX_TITLE_LENGTH) : "";
  if (!id) {
    return null;
  }
  if (data.allDay === true && finite(data.startDay) && finite(data.endDay) && data.endDay > data.startDay) {
    return { allDay: true, endDay: Math.min(data.endDay, data.startDay + 366), id, startDay: data.startDay, title };
  }
  if (data.allDay === false && finite(data.start) && finite(data.end) && data.end >= data.start) {
    return { allDay: false, end: Math.min(data.end, data.start + 366 * DAY_MS), id, start: data.start, title };
  }
  return null;
};

export const parseEventsReply = (text: string): Readonly<Record<string, RelayCalendarReply>> | null => {
  try {
    const data = JSON.parse(text) as { calendars?: unknown };
    if (!data.calendars || typeof data.calendars !== "object") {
      return null;
    }
    const calendars = data.calendars as Record<string, unknown>;
    const replies: Record<string, RelayCalendarReply> = {};
    Object.keys(calendars).forEach((id) => {
      const item = (calendars[id] || {}) as { error?: unknown; events?: unknown };
      if (Array.isArray(item.events)) {
        const events: RelayEvent[] = [];
        item.events.slice(0, MAX_EVENTS).forEach((value) => {
          const event = relayEvent(value);
          if (event) {
            events.push(event);
          }
        });
        replies[id] = { events };
      } else {
        replies[id] = { error: typeof item.error === "string" ? item.error : "api" };
      }
    });
    return replies;
  } catch {
    return null;
  }
};
