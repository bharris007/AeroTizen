import type { CalendarEvent } from "../../contracts/familyCalendar";

import {
  DAY_MS,
  dayOfWall,
  type IcsDateValue,
  icsInstant,
  icsWall,
  parseIcsDate,
  parseIcsDuration,
  resolveZone,
  utcToWall,
  wallToUtc,
} from "./icsTime";
import { expandRecurrence, parseRecurrenceRule } from "./recurrence";

interface IcsProperty {
  readonly name: string;
  readonly params: Readonly<Record<string, string>>;
  readonly value: string;
}

const MAX_TITLE_LENGTH = 120;
// A guard for very large feeds; a family calendar window holds far fewer.
const MAX_INSTANCES = 2000;

const unescapeText = (value: string) =>
  value.replace(/\\([\\;,nN])/g, (_, character: string) => (character === "n" || character === "N" ? " " : character));

const parseLine = (line: string): IcsProperty | null => {
  let quoted = false;
  let colon = -1;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      quoted = !quoted;
    } else if (character === ":" && !quoted) {
      colon = index;
      break;
    }
  }
  if (colon <= 0) {
    return null;
  }
  const [name, ...rawParams] = line.slice(0, colon).split(";");
  const params: Record<string, string> = {};
  rawParams.forEach((param) => {
    const index = param.indexOf("=");
    if (index > 0) {
      params[param.slice(0, index).toUpperCase()] = param.slice(index + 1).replace(/^"|"$/g, "");
    }
  });
  return { name: name.toUpperCase(), params, value: line.slice(colon + 1) };
};

interface IcsDocument {
  readonly calendarZone: string;
  readonly events: readonly (readonly IcsProperty[])[];
}

// Splits unfolded lines into VEVENT property lists. Nested components such as VALARM
// are skipped.
const readDocument = (text: string): IcsDocument | null => {
  if (!/BEGIN:VCALENDAR/i.test(text.slice(0, 4096))) {
    return null;
  }
  const lines = text.replace(/\r?\n[ \t]/g, "").split(/\r?\n/);
  const stack: string[] = [];
  const events: IcsProperty[][] = [];
  let current: IcsProperty[] | null = null;
  let calendarZone = "";
  lines.forEach((line) => {
    const property = parseLine(line);
    if (!property) {
      return;
    }
    if (property.name === "BEGIN") {
      const component = property.value.trim().toUpperCase();
      stack.push(component);
      if (component === "VEVENT" && stack.length === 2) {
        current = [];
      }
      return;
    }
    if (property.name === "END") {
      const component = stack.pop();
      if (component === "VEVENT" && current) {
        events.push(current);
        current = null;
      }
      return;
    }
    if (stack.length === 1 && property.name === "X-WR-TIMEZONE") {
      calendarZone = property.value.trim();
    } else if (current && stack.length === 2) {
      current.push(property);
    }
  });
  return { calendarZone, events };
};

interface EventDate {
  readonly value: IcsDateValue;
  readonly zone: string;
}

const readDate = (property: IcsProperty | undefined, fallbackZone: string): EventDate | null => {
  if (!property) {
    return null;
  }
  const value = parseIcsDate(property.value);
  if (!value) {
    return null;
  }
  return { value, zone: resolveZone(property.params.TZID, fallbackZone) };
};

// Instance key shared by a recurring series and its RECURRENCE-ID overrides.
const instanceKey = (date: EventDate) =>
  date.value.date ? "d" + dayOfWall(date.value.value) : "t" + icsInstant(date.value, date.zone);

const readDates = (properties: readonly IcsProperty[], name: string, fallbackZone: string) => {
  const dates: EventDate[] = [];
  properties
    .filter((property) => property.name === name)
    .forEach((property) =>
      property.value.split(",").forEach((value) => {
        const date = readDate({ ...property, value }, fallbackZone);
        if (date) {
          dates.push(date);
        }
      }),
    );
  return dates;
};

// Last wall time a series may start; a date-only UNTIL includes that whole day.
const untilToWall = (raw: string, zone: string) => {
  const until = parseIcsDate(raw);
  if (!until) {
    return null;
  }
  return until.date ? until.value + DAY_MS - 1 : icsWall(until, zone);
};

// Event length in milliseconds: DTEND, then DURATION, then one day or zero.
const eventDuration = (start: EventDate, end: EventDate | null, durationProperty: IcsProperty | undefined) => {
  const allDay = start.value.date;
  const minimum = allDay ? DAY_MS : 0;
  if (end && end.value.date === allDay) {
    const length = allDay
      ? end.value.value - start.value.value
      : icsInstant(end.value, end.zone) - icsInstant(start.value, start.zone);
    return Math.max(minimum, length);
  }
  const parsed = durationProperty ? parseIcsDuration(durationProperty.value) : null;
  return parsed === null ? minimum : Math.max(minimum, parsed);
};

export interface CalendarWindow {
  readonly from: number;
  readonly timeZone: string;
  readonly to: number;
}

export interface CalendarIdentity {
  readonly color: string;
  readonly id: string;
}

// Parses an ICS feed into event instances overlapping [from, to). Recurring events are
// expanded with EXDATE, RECURRENCE-ID overrides and cancelled instances applied.
// Returns null when the text is not a calendar.
export const parseCalendar = (
  text: string,
  calendar: CalendarIdentity,
  window: CalendarWindow,
): CalendarEvent[] | null => {
  const document = readDocument(text);
  if (!document) {
    return null;
  }
  const defaultZone = resolveZone(document.calendarZone, window.timeZone);
  const fromDay = dayOfWall(window.from - DAY_MS);
  const toDay = dayOfWall(window.to + DAY_MS);
  const instances: CalendarEvent[] = [];
  const overrides = new Map<string, Set<string>>();

  const parsed = document.events.map((properties) => {
    const find = (name: string) => properties.find((property) => property.name === name);
    const uid = (find("UID")?.value || "").trim();
    const recurrence = readDate(find("RECURRENCE-ID"), defaultZone);
    if (uid && recurrence) {
      const keys = overrides.get(uid) || new Set<string>();
      keys.add(instanceKey(recurrence));
      overrides.set(uid, keys);
    }
    return { find, properties, recurrence, uid };
  });

  const add = (event: CalendarEvent) => {
    if (instances.length < MAX_INSTANCES) {
      instances.push(event);
    }
  };

  parsed.forEach(({ find, properties, recurrence, uid }) => {
    const start = readDate(find("DTSTART"), defaultZone);
    if (!start || (find("STATUS")?.value || "").trim().toUpperCase() === "CANCELLED") {
      return;
    }
    const title = unescapeText((find("SUMMARY")?.value || "").trim()).slice(0, MAX_TITLE_LENGTH);
    const allDay = start.value.date;
    const zone = start.value.utc ? defaultZone : start.zone;
    const startWall = icsWall(start.value, zone);
    const duration = eventDuration(start, readDate(find("DTEND"), start.zone), find("DURATION"));
    const base = { calendarId: calendar.id, color: calendar.color, title };
    const emitDay = (startDay: number) => {
      const endDay = startDay + Math.max(1, Math.round(duration / DAY_MS));
      if (endDay > fromDay && startDay < toDay) {
        add({ ...base, allDay: true, endDay, id: uid + "@d" + startDay, startDay });
      }
    };
    const emitInstant = (instant: number) => {
      const finish = instant + duration;
      if (finish > window.from && instant < window.to) {
        add({ ...base, allDay: false, end: finish, id: uid + "@t" + instant, start: instant });
      }
    };
    const emitWall = (wall: number) => (allDay ? emitDay(dayOfWall(wall)) : emitInstant(wallToUtc(wall, zone)));
    const ruleProperty = find("RRULE");
    const rule = !recurrence && ruleProperty ? parseRecurrenceRule(ruleProperty.value) : null;
    if (!rule) {
      if (allDay) {
        emitDay(dayOfWall(startWall));
      } else {
        emitInstant(icsInstant(start.value, zone));
      }
      return;
    }
    const untilWall = rule.until ? untilToWall(rule.until, zone) : null;
    const excluded = new Set(readDates(properties, "EXDATE", zone).map(instanceKey));
    const replaced = (uid && overrides.get(uid)) || new Set<string>();
    const fromWall = utcToWall(window.from - duration, zone) - DAY_MS;
    const stopWall = utcToWall(window.to, zone) + DAY_MS;
    expandRecurrence(rule, startWall, untilWall, fromWall, stopWall, (wall) => {
      const key = instanceKey({ value: { date: allDay, utc: false, value: wall }, zone });
      if (!excluded.has(key) && !replaced.has(key)) {
        emitWall(wall);
      }
    });
  });
  return instances.sort((a, b) => eventStart(a) - eventStart(b));
};

const eventStart = (event: CalendarEvent) => (event.allDay ? event.startDay * DAY_MS : event.start);
