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
