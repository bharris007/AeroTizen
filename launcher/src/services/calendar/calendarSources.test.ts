import { expect, test } from "vitest";

import { googleAccounts, mergeIncomingCalendars, normalizeCalendars } from "./calendarSources";

const url = "https://calendar.google.com/calendar/ical/a/private-x/basic.ics";
const NONE = { account: "", accountId: "", calendarId: "", kind: "ics" as const };
const ACCOUNT = "AccountAbc123456789xyz00";

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
    { ...NONE, color: "#abcdef", enabled: true, id: "cal-1", name: "Family", url: "https://calendar.google.com/a.ics" },
    { ...NONE, color: "#4285f4", enabled: false, id: "cal-2", name: "Calendar", url },
  ]);
  expect(normalizeCalendars(null)).toEqual([]);
});

test("adds calendars from the phone and updates a repeated address instead of duplicating it", () => {
  const current = [{ ...NONE, color: "#33b679", enabled: false, id: "old", name: "Old", url }];
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
    { ...NONE, color: "#8e24aa", enabled: true, id: "old", name: "Family", url },
    {
      ...NONE,
      color: "#039be5",
      enabled: true,
      id: "new-1",
      name: "Work",
      url: "https://outlook.office365.com/owa/calendar/x/calendar.ics",
    },
  ]);
});

test("keeps Google calendars with a valid account and calendar id", () => {
  expect(
    normalizeCalendars([
      {
        account: "me@example.com",
        accountId: ACCOUNT,
        calendarId: "me@example.com",
        id: "g-1",
        kind: "google",
        name: "Me",
      },
      { accountId: "short", calendarId: "x", id: "g-2", kind: "google" },
      { accountId: ACCOUNT, calendarId: "has space", id: "g-3", kind: "google" },
      { accountId: ACCOUNT, calendarId: "me@example.com", id: "g-4", kind: "google" },
    ]),
  ).toEqual([
    {
      account: "me@example.com",
      accountId: ACCOUNT,
      calendarId: "me@example.com",
      color: "#4285f4",
      enabled: true,
      id: "g-1",
      kind: "google",
      name: "Me",
      url: "",
    },
  ]);
});

test("lists Google accounts once each, in order", () => {
  const sources = normalizeCalendars([
    { account: "a@example.com", accountId: ACCOUNT, calendarId: "a", id: "g-1", kind: "google" },
    { id: "ics-1", url },
    { account: "b@example.com", accountId: "OtherAccount1234", calendarId: "b", id: "g-2", kind: "google" },
    { account: "a@example.com", accountId: ACCOUNT, calendarId: "c", id: "g-3", kind: "google" },
  ]);
  expect(googleAccounts(sources)).toEqual([
    { account: "a@example.com", accountId: ACCOUNT },
    { account: "b@example.com", accountId: "OtherAccount1234" },
  ]);
});
