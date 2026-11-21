import { zonedDate } from "../../shared/time/zonedDate";

export const CALENDAR_START_HOUR = 6;
export const CALENDAR_END_HOUR = 22;

export const CALENDAR_HOURS = Array.from(
  { length: CALENDAR_END_HOUR - CALENDAR_START_HOUR + 1 },
  (_, index) => CALENDAR_START_HOUR + index,
);

// Fraction of the 6:00–22:00 grid, or null when now is outside that day view.
export const calendarNowFraction = (hour: number, minute: number) => {
  if (hour < CALENDAR_START_HOUR || hour > CALENDAR_END_HOUR || minute < 0 || minute > 59) {
    return null;
  }
  const span = (CALENDAR_END_HOUR - CALENDAR_START_HOUR + 1) * 60;
  return ((hour - CALENDAR_START_HOUR) * 60 + minute) / span;
};

export const formatFamilyDate = (timestamp: number, timeZone: string, language: string) => {
  try {
    const options: Intl.DateTimeFormatOptions = {
      day: "numeric",
      month: "long",
      weekday: "long",
    };
    if (timeZone) {
      options.timeZone = timeZone;
    }
    return new Intl.DateTimeFormat(language, options).format(timestamp);
  } catch {
    const zoned = zonedDate(timestamp, timeZone);
    return zoned.getFullYear() + "-" + (zoned.getMonth() + 1) + "-" + zoned.getDate();
  }
};

export const calendarNowTop = (timestamp: number, timeZone: string) => {
  const zoned = zonedDate(timestamp, timeZone);
  return calendarNowFraction(zoned.getHours(), zoned.getMinutes());
};

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAY_FALLBACK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Names a calendar day number (days since 1970-01-01) in `language`. Day numbers are
// already local dates, so they are formatted in UTC.
export const formatCalendarDay = (day: number, language: string, style: "weekday" | "column" | "long") => {
  const options: Intl.DateTimeFormatOptions = { timeZone: "UTC" };
  if (style === "weekday") {
    options.weekday = "long";
  } else if (style === "column") {
    options.weekday = "short";
    options.day = "numeric";
  } else {
    options.weekday = "long";
    options.month = "long";
    options.day = "numeric";
  }
  const date = new Date(day * DAY_MS);
  try {
    return new Intl.DateTimeFormat(language, options).format(date);
  } catch {
    return WEEKDAY_FALLBACK[date.getUTCDay()] + " " + date.getUTCDate();
  }
};

// Short range for a multi-day header, e.g. "Nov 21 – 25".
export const formatCalendarRange = (first: number, last: number, language: string) => {
  const format = (day: number, options: Intl.DateTimeFormatOptions) => {
    try {
      return new Intl.DateTimeFormat(language, { ...options, timeZone: "UTC" }).format(new Date(day * DAY_MS));
    } catch {
      return new Date(day * DAY_MS).toISOString().slice(0, 10);
    }
  };
  const start = format(first, { day: "numeric", month: "long" });
  return first === last ? start : start + " – " + format(last, { day: "numeric", month: "long" });
};
