import { describe, expect, test } from "vitest";

import type { CalendarEvent, TimedCalendarEvent } from "../../contracts/familyCalendar";

import { DAY_MS } from "./icsTime";
import { parseCalendar } from "./parseCalendar";

const CHICAGO = "America/Chicago";
const calendar = { color: "#33b679", id: "family" };
const day = (year: number, month: number, date: number) => Date.UTC(year, month - 1, date) / DAY_MS;
// Chicago wall time to UTC for dates in standard time (UTC-6) or daylight time (UTC-5).
const cst = (month: number, date: number, hour: number, minute = 0, year = 2026) =>
  Date.UTC(year, month - 1, date, hour + 6, minute);
const cdt = (month: number, date: number, hour: number, minute = 0, year = 2026) =>
  Date.UTC(year, month - 1, date, hour + 5, minute);

const ics = (...events: string[]) =>
  ["BEGIN:VCALENDAR", "VERSION:2.0", "X-WR-TIMEZONE:America/Chicago", ...events, "END:VCALENDAR"].join("\r\n");
const vevent = (...lines: string[]) => ["BEGIN:VEVENT", ...lines, "END:VEVENT"].join("\r\n");

const parse = (text: string, from: number, to: number) =>
  parseCalendar(text, calendar, { from, timeZone: CHICAGO, to }) as CalendarEvent[];
const timed = (events: CalendarEvent[]) => events.filter((event): event is TimedCalendarEvent => !event.allDay);
const starts = (events: CalendarEvent[]) => timed(events).map((event) => event.start);

describe("single events", () => {
  test("reads all-day, zoned and UTC events with escaped, folded titles", () => {
    const text = ics(
      vevent("UID:a", "DTSTART;VALUE=DATE:20261121", "DTEND;VALUE=DATE:20261123", "SUMMARY:Grandma\\, visiting"),
      vevent(
        "UID:b",
        "DTSTART;TZID=America/Chicago:20261121T093000",
        "DTEND;TZID=America/Chicago:20261121T103000",
        "SUMMARY:Soccer pr",
        " actice",
      ),
      vevent("UID:c", "DTSTART:20261121T230000Z", "DURATION:PT45M", "SUMMARY:Call"),
      vevent("UID:d", "DTSTART;TZID=Eastern Standard Time:20261121T120000", "SUMMARY:Lunch"),
    );
    const events = parse(text, cst(11, 21, 0), cst(11, 22, 0));
    expect(events).toHaveLength(4);
    const allDay = events.find((event) => event.allDay);
    expect(allDay && [allDay.title, allDay.allDay && allDay.startDay, allDay.allDay && allDay.endDay]).toEqual([
      "Grandma, visiting",
      day(2026, 11, 21),
      day(2026, 11, 23),
    ]);
    expect(timed(events).map((event) => [event.title, event.start, event.end])).toEqual([
      ["Soccer practice", cst(11, 21, 9, 30), cst(11, 21, 10, 30)],
      ["Lunch", cst(11, 21, 11), cst(11, 21, 11)],
      ["Call", cst(11, 21, 17), cst(11, 21, 17, 45)],
    ]);
  });

  test("skips cancelled events and nested alarms, and rejects non-calendar text", () => {
    const text = ics(
      vevent("UID:a", "DTSTART:20261121T150000Z", "STATUS:CANCELLED", "SUMMARY:Gone"),
      vevent("UID:b", "DTSTART:20261121T160000Z", "BEGIN:VALARM", "SUMMARY:Alarm", "END:VALARM", "SUMMARY:Kept"),
    );
    expect(parse(text, cst(11, 21, 0), cst(11, 22, 0)).map((event) => event.title)).toEqual(["Kept"]);
    expect(parseCalendar("<html>Sign in</html>", calendar, { from: 0, timeZone: CHICAGO, to: 1 })).toBeNull();
  });
});

describe("recurring events", () => {
  test("keeps the local time across a DST change", () => {
    const text = ics(
      vevent(
        "UID:w",
        "DTSTART;TZID=America/Chicago:20261026T090000",
        "DTEND;TZID=America/Chicago:20261026T100000",
        "RRULE:FREQ=WEEKLY;BYDAY=MO",
      ),
    );
    expect(starts(parse(text, cst(10, 25, 0), cst(11, 10, 0)))).toEqual([cdt(10, 26, 9), cst(11, 2, 9), cst(11, 9, 9)]);
  });

  test("honours COUNT, UNTIL, BYDAY and INTERVAL", () => {
    const daily = ics(vevent("UID:d", "DTSTART;TZID=America/Chicago:20261116T070000", "RRULE:FREQ=DAILY;COUNT=3"));
    expect(starts(parse(daily, cst(11, 1, 0), cst(12, 1, 0)))).toEqual([
      cst(11, 16, 7),
      cst(11, 17, 7),
      cst(11, 18, 7),
    ]);

    const weekly = ics(
      vevent(
        "UID:w",
        "DTSTART;TZID=America/Chicago:20261102T180000",
        "RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,TH;UNTIL=20261120T235959Z",
      ),
    );
    expect(starts(parse(weekly, cst(11, 1, 0), cst(12, 31, 0)))).toEqual([
      cst(11, 2, 18),
      cst(11, 5, 18),
      cst(11, 16, 18),
      cst(11, 19, 18),
    ]);
  });

  test("expands monthly ordinal weekdays, month days and yearly dates", () => {
    const text = ics(
      vevent("UID:m1", "DTSTART;TZID=America/Chicago:20260113T190000", "RRULE:FREQ=MONTHLY;BYDAY=2TU", "SUMMARY:PTA"),
      vevent("UID:m2", "DTSTART;TZID=America/Chicago:20260130T120000", "RRULE:FREQ=MONTHLY;BYDAY=-1FR", "SUMMARY:Pay"),
      vevent("UID:m3", "DTSTART;VALUE=DATE:20260131", "RRULE:FREQ=MONTHLY", "SUMMARY:Rent"),
      vevent("UID:y", "DTSTART;VALUE=DATE:20101121", "RRULE:FREQ=YEARLY", "SUMMARY:Birthday"),
    );
    // All-day events keep a one-day margin for time zone edges, so start after 31 October.
    const events = parse(text, cst(11, 2, 0), cst(12, 1, 0));
    expect(events.map((event) => event.title + ":" + (event.allDay ? event.startDay : event.start))).toEqual([
      "PTA:" + cst(11, 10, 19),
      "Birthday:" + day(2026, 11, 21),
      "Pay:" + cst(11, 27, 12),
    ]);
    const december = parse(text, cst(12, 1, 0), cst(1, 1, 0, 0, 2027));
    expect(december.filter((event) => event.title === "Rent").map((event) => event.allDay && event.startDay)).toEqual([
      day(2026, 12, 31),
    ]);
  });

  test("applies EXDATE, moved instances and cancelled instances", () => {
    const text = ics(
      vevent(
        "UID:s",
        "DTSTART;TZID=America/Chicago:20261116T160000",
        "DTEND;TZID=America/Chicago:20261116T170000",
        "RRULE:FREQ=DAILY",
        "EXDATE;TZID=America/Chicago:20261117T160000,20261118T160000",
        "SUMMARY:Piano",
      ),
      vevent(
        "UID:s",
        "RECURRENCE-ID;TZID=America/Chicago:20261119T160000",
        "DTSTART;TZID=America/Chicago:20261119T180000",
        "DTEND;TZID=America/Chicago:20261119T190000",
        "SUMMARY:Piano (moved)",
      ),
      vevent(
        "UID:s",
        "RECURRENCE-ID:20261120T220000Z",
        "DTSTART:20261120T220000Z",
        "STATUS:CANCELLED",
        "SUMMARY:Piano",
      ),
    );
    const events = timed(parse(text, cst(11, 16, 0), cst(11, 22, 0)));
    expect(events.map((event) => event.title + "@" + event.start)).toEqual([
      "Piano@" + cst(11, 16, 16),
      "Piano (moved)@" + cst(11, 19, 18),
      "Piano@" + cst(11, 21, 16),
    ]);
  });

  test("finds today's instance of an old series without a COUNT", () => {
    const text = ics(vevent("UID:old", "DTSTART;TZID=America/Chicago:20100104T083000", "RRULE:FREQ=WEEKLY;BYDAY=SA"));
    expect(starts(parse(text, cst(11, 21, 0), cst(11, 22, 0)))).toEqual([cst(11, 21, 8, 30)]);
  });
});
