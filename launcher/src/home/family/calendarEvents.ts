import type { AllDayCalendarEvent, CalendarEvent, TimedCalendarEvent } from "../../contracts/familyCalendar";
import type { TimeFormat } from "../../contracts/preferences";
import { DAY_MS, utcToWall, wallToUtc } from "../../services/calendar/icsTime";
import type { Translate } from "../../shared/i18n/createTranslations";
import { zonedDate } from "../../shared/time/zonedDate";

import { CALENDAR_END_HOUR, CALENDAR_START_HOUR } from "./calendarDay";

const MINUTE_MS = 60 * 1000;
const GRID_START_MINUTE = CALENDAR_START_HOUR * 60;
// The last hour row runs to the end of CALENDAR_END_HOUR.
const GRID_END_MINUTE = (CALENDAR_END_HOUR + 1) * 60;
const GRID_SPAN_MINUTES = GRID_END_MINUTE - GRID_START_MINUTE;
// Short events still get room for a readable title.
const MIN_BLOCK_MINUTES = 30;

export interface DayEventBlock {
  readonly column: number;
  readonly columns: number;
  readonly event: TimedCalendarEvent;
  // Fractions of the day grid's height.
  readonly height: number;
  readonly top: number;
}

export interface DayAgenda {
  readonly allDay: readonly AllDayCalendarEvent[];
  readonly count: number;
  readonly timed: readonly DayEventBlock[];
}

// The calendar date of `now` in `timeZone` as a day number (days since 1970-01-01).
export const todayNumber = (now: number, timeZone: string) => {
  const zoned = zonedDate(now, timeZone);
  return Date.UTC(zoned.getFullYear(), zoned.getMonth(), zoned.getDate()) / DAY_MS;
};

interface Placement {
  readonly end: number;
  readonly event: TimedCalendarEvent;
  readonly start: number;
}

// Overlapping events share the width of their cluster; each takes the first free column.
const layoutColumns = (placements: readonly Placement[]): DayEventBlock[] => {
  const blocks: DayEventBlock[] = [];
  let cluster: { column: number; placement: Placement }[] = [];
  let columnEnds: number[] = [];
  let clusterEnd = -Infinity;
  const flush = () => {
    const columns = columnEnds.length;
    cluster.forEach(({ column, placement }) =>
      blocks.push({
        column,
        columns,
        event: placement.event,
        height: (placement.end - placement.start) / GRID_SPAN_MINUTES,
        top: (placement.start - GRID_START_MINUTE) / GRID_SPAN_MINUTES,
      }),
    );
    cluster = [];
    columnEnds = [];
  };
  placements.forEach((placement) => {
    if (placement.start >= clusterEnd) {
      flush();
      clusterEnd = placement.end;
    }
    const free = columnEnds.findIndex((end) => end <= placement.start);
    const column = free < 0 ? columnEnds.length : free;
    columnEnds[column] = placement.end;
    cluster.push({ column, placement });
    clusterEnd = Math.max(clusterEnd, placement.end);
  });
  flush();
  return blocks;
};

// One day's events in `timeZone` (`today` is that day's number): all-day events for the
// strip, and timed events placed on the CALENDAR_START_HOUR–CALENDAR_END_HOUR grid. Events
// outside the grid are pinned to its nearest edge so nothing is hidden.
export const agendaForDay = (events: readonly CalendarEvent[], today: number, timeZone: string): DayAgenda => {
  const dayStart = wallToUtc(today * DAY_MS, timeZone);
  const dayEnd = wallToUtc((today + 1) * DAY_MS, timeZone);
  const allDay: AllDayCalendarEvent[] = [];
  const placements: Placement[] = [];
  events.forEach((event) => {
    if (event.allDay) {
      if (event.startDay <= today && event.endDay > today) {
        allDay.push(event);
      }
      return;
    }
    const inDay = event.end > event.start ? event.start < dayEnd && event.end > dayStart : event.start >= dayStart;
    if (!inDay || event.start >= dayEnd) {
      return;
    }
    const minuteOf = (instant: number) =>
      (utcToWall(Math.min(Math.max(instant, dayStart), dayEnd), timeZone) - today * DAY_MS) / MINUTE_MS;
    const rawStart = minuteOf(event.start);
    const rawEnd = event.end >= dayEnd ? 24 * 60 : minuteOf(event.end);
    const start = Math.min(Math.max(rawStart, GRID_START_MINUTE), GRID_END_MINUTE - MIN_BLOCK_MINUTES);
    const end = Math.min(Math.max(rawEnd, start + MIN_BLOCK_MINUTES), GRID_END_MINUTE);
    placements.push({ end, event, start });
  });
  placements.sort((a, b) => a.start - b.start || b.end - a.end);
  return { allDay, count: allDay.length + placements.length, timed: layoutColumns(placements) };
};

export const dayAgenda = (events: readonly CalendarEvent[], now: number, timeZone: string) =>
  agendaForDay(events, todayNumber(now, timeZone), timeZone);

const padded = (value: number) => (value < 10 ? "0" + value : String(value));

export const formatEventTime = (instant: number, timeZone: string, format: TimeFormat, t: Translate) => {
  const zoned = zonedDate(instant, timeZone);
  const hour = zoned.getHours();
  const minute = padded(zoned.getMinutes());
  if (format === "24") {
    return t("family.time24", { hour: padded(hour), minute });
  }
  return t(hour < 12 ? "family.timeAm" : "family.timePm", { hour: hour % 12 || 12, minute });
};

// Translucent fill for an event block from its calendar colour (#rrggbb).
export const eventTint = (colour: string, alpha: number) => {
  const value = /^#([0-9a-f]{6})$/i.exec(colour);
  if (!value) {
    return colour;
  }
  const number = parseInt(value[1], 16);
  return "rgba(" + (number >> 16) + ", " + ((number >> 8) & 255) + ", " + (number & 255) + ", " + alpha + ")";
};
