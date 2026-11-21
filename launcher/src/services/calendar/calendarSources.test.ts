import { expect, test } from "vitest";

import { mergeIncomingCalendars, normalizeCalendars } from "./calendarSources";

const url = "https://calendar.google.com/calendar/ical/a/private-x/basic.ics";

test("keeps only valid HTTPS calendars with safe ids, names and colours", () => {
  expect(
    normalizeCalendars([
      { color: "#ABCDEF", id: "cal-1", name: "  Family  ", url: "webcal://calendar.google.com/a.ics" },
      { color: "red", enabled: false, id: "cal-2", name: "", url },
      { id: "cal-1", url },
      { id: "bad id", url },
      { id: "cal-3", url: "http://calendar.google.com/insecure.ics" },
      "nonsense",
    ]),
  ).toEqual([
    { color: "#abcdef", enabled: true, id: "cal-1", name: "Family", url: "https://calendar.google.com/a.ics" },
    { color: "#4285f4", enabled: false, id: "cal-2", name: "Calendar", url },
  ]);
  expect(normalizeCalendars(null)).toEqual([]);
});

test("adds calendars from the phone and updates a repeated address instead of duplicating it", () => {
  const current = [{ color: "#33b679", enabled: false, id: "old", name: "Old", url }];
  let next = 0;
  const merged = mergeIncomingCalendars(
    current,
    [
      { color: "#8e24aa", name: "Family", url },
      { color: "#039be5", name: "Work", url: "https://outlook.office365.com/owa/calendar/x/calendar.ics" },
      { name: "Broken", url: "javascript:alert(1)" },
    ],
    () => "new-" + ++next,
  );
  expect(merged).toEqual([
    { color: "#8e24aa", enabled: true, id: "old", name: "Family", url },
    {
      color: "#039be5",
      enabled: true,
      id: "new-1",
      name: "Work",
      url: "https://outlook.office365.com/owa/calendar/x/calendar.ics",
    },
  ]);
});
