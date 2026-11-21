import { zonedDate } from "../../shared/time/zonedDate";

export const DAY_MS = 24 * 60 * 60 * 1000;

// "Wall" times are the local date and clock fields of a time zone stored as if they
// were UTC milliseconds, so date arithmetic does not cross DST changes.
export const dayOfWall = (wall: number) => Math.floor(wall / DAY_MS);

const SECOND_MS = 1000;

// Offset of `timeZone` from UTC at the given instant, in milliseconds.
export const zoneOffset = (utc: number, timeZone: string) => {
  const zoned = zonedDate(utc, timeZone);
  const wall = Date.UTC(
    zoned.getFullYear(),
    zoned.getMonth(),
    zoned.getDate(),
    zoned.getHours(),
    zoned.getMinutes(),
    zoned.getSeconds(),
  );
  return wall - Math.floor(utc / SECOND_MS) * SECOND_MS;
};

export const utcToWall = (utc: number, timeZone: string) => utc + zoneOffset(utc, timeZone);

// Resolves a local clock time to an instant. Times skipped by a DST change move forward;
// repeated times use the first occurrence.
export const wallToUtc = (wall: number, timeZone: string) => {
  const first = zoneOffset(wall, timeZone);
  const guess = wall - first;
  const second = zoneOffset(guess, timeZone);
  if (second === first) {
    return guess;
  }
  const adjusted = wall - second;
  return zoneOffset(adjusted, timeZone) === second ? adjusted : guess;
};

// Outlook and Exchange publish Windows zone names.
const WINDOWS_ZONES: Readonly<Record<string, string>> = {
  "Alaskan Standard Time": "America/Anchorage",
  "Atlantic Standard Time": "America/Halifax",
  "Central Europe Standard Time": "Europe/Budapest",
  "Central Standard Time": "America/Chicago",
  "Eastern Standard Time": "America/New_York",
  "GMT Standard Time": "Europe/London",
  "Hawaiian Standard Time": "Pacific/Honolulu",
  "Mountain Standard Time": "America/Denver",
  "Pacific Standard Time": "America/Los_Angeles",
  "Romance Standard Time": "Europe/Paris",
  "US Mountain Standard Time": "America/Phoenix",
  "W. Europe Standard Time": "Europe/Berlin",
};

const validZones = new Map<string, boolean>();

const isValidZone = (timeZone: string) => {
  let valid = validZones.get(timeZone);
  if (valid === undefined) {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone }).format(0);
      valid = true;
    } catch {
      valid = false;
    }
    validZones.set(timeZone, valid);
  }
  return valid;
};

// Returns a usable IANA zone for an ICS TZID, or the fallback.
export const resolveZone = (tzid: string | undefined, fallback: string) => {
  if (!tzid) {
    return fallback;
  }
  const trimmed = tzid.replace(/^"|"$/g, "").trim();
  const candidate = WINDOWS_ZONES[trimmed] || trimmed.replace(/^\/[^/]*\/[^/]*\//, "");
  if (candidate === "UTC" || candidate === "Etc/UTC" || candidate === "GMT") {
    return "UTC";
  }
  return candidate && isValidZone(candidate) ? candidate : fallback;
};

export interface IcsDateValue {
  readonly date: boolean;
  readonly utc: boolean;
  // Wall time for local values; UTC milliseconds when `utc` is true.
  readonly value: number;
}

const DATE_PATTERN = /^(\d{4})(\d{2})(\d{2})$/;
const DATE_TIME_PATTERN = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z?)$/;

export const parseIcsDate = (raw: string): IcsDateValue | null => {
  const value = raw.trim();
  const date = DATE_PATTERN.exec(value);
  if (date) {
    return { date: true, utc: false, value: Date.UTC(Number(date[1]), Number(date[2]) - 1, Number(date[3])) };
  }
  const time = DATE_TIME_PATTERN.exec(value);
  if (!time) {
    return null;
  }
  return {
    date: false,
    utc: time[7] === "Z",
    value: Date.UTC(
      Number(time[1]),
      Number(time[2]) - 1,
      Number(time[3]),
      Number(time[4]),
      Number(time[5]),
      Number(time[6] || 0),
    ),
  };
};

// Instant for a date-time value; local values use their zone.
export const icsInstant = (value: IcsDateValue, timeZone: string) =>
  value.utc ? value.value : wallToUtc(value.value, timeZone);

// Wall time of a value in `timeZone`.
export const icsWall = (value: IcsDateValue, timeZone: string) =>
  value.utc ? utcToWall(value.value, timeZone) : value.value;

const DURATION_PATTERN = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/;

// ICS DURATION in milliseconds, or null when malformed.
export const parseIcsDuration = (raw: string) => {
  const match = DURATION_PATTERN.exec(raw.trim());
  if (!match) {
    return null;
  }
  const [, sign, weeks, days, hours, minutes, seconds] = match;
  const total =
    (Number(weeks || 0) * 7 + Number(days || 0)) * DAY_MS +
    (Number(hours || 0) * 3600 + Number(minutes || 0) * 60 + Number(seconds || 0)) * SECOND_MS;
  return sign === "-" ? -total : total;
};
