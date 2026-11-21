import { expect, test } from "vitest";

import type { CalendarRequest, CalendarSource } from "../../contracts/familyCalendar";
import type { SettingsSnapshot } from "../../contracts/preferences";
import { createStore } from "../../shared/state/createStore";

import {
  CALENDAR_CACHE_KEY,
  CALENDAR_REMOVALS_KEY,
  CALENDAR_SECRET_KEY,
  createFamilyCalendar,
} from "./createFamilyCalendar";

const NOW = Date.UTC(2026, 10, 21, 15); // 9:00 AM in Chicago
const RELAY = "https://relay.test";
const FEED = "https://calendar.google.com/calendar/ical/family/private-abc/basic.ics";
const NONE = { account: "", accountId: "", calendarId: "" };
const family: CalendarSource = {
  ...NONE,
  color: "#33b679",
  enabled: true,
  id: "family",
  kind: "ics",
  name: "Family",
  url: FEED,
};
const ACCOUNT = "AccountAbc123456789xyz00";
const google = (id: string, calendarId: string, color: string): CalendarSource => ({
  account: "bryan@example.com",
  accountId: ACCOUNT,
  calendarId,
  color,
  enabled: true,
  id,
  kind: "google",
  name: id,
  url: "",
});
const ics = (summary: string) =>
  [
    "BEGIN:VCALENDAR",
    "BEGIN:VEVENT",
    "UID:1",
    "DTSTART:20261121T170000Z",
    "DTEND:20261121T180000Z",
    "SUMMARY:" + summary,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

const harness = (calendars: CalendarSource[] = [family], saved: Record<string, string> = {}) => {
  const storage = new Map(Object.entries(saved));
  const requests: { done: (status: number, text: string) => void; options: CalendarRequest }[] = [];
  const timeouts = new Map<number, () => void>();
  let nextTimer = 1;
  const settings = createStore({ calendars } as unknown as SettingsSnapshot);
  const service = createFamilyCalendar({
    now: () => NOW,
    platform: {
      request(options, done) {
        requests.push({ done, options });
        return () => undefined;
      },
    },
    random: (bytes) => bytes.fill(171),
    relayUrl: RELAY,
    settings: {
      getSnapshot: settings.getSnapshot,
      subscribe: settings.subscribe,
      update: (patch) => settings.set({ ...settings.getSnapshot(), ...patch } as SettingsSnapshot),
    },
    storage: { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
    timeZone: () => "America/Chicago",
    timers: {
      clearInterval: () => undefined,
      clearTimeout: (id?: number) => timeouts.delete(id ?? 0),
      setInterval: () => 0,
      setTimeout: (callback: () => void) => {
        const id = nextTimer++;
        timeouts.set(id, callback);
        return id;
      },
    },
  });
  const runTimers = () => {
    const pending = [...timeouts.values()];
    timeouts.clear();
    pending.forEach((callback) => callback());
  };
  const titles = () => service.getSnapshot().events.map((event) => event.title);
  return { requests, runTimers, service, settings, storage, titles };
};

test("falls back to the relay proxy when the TV cannot fetch the feed directly, and caches the result", () => {
  const h = harness();
  h.service.start();
  expect(h.requests[0].options).toEqual({ method: "GET", url: FEED });
  expect(h.service.getSnapshot().statuses.family.state).toBe("syncing");

  h.requests[0].done(0, "");
  expect(h.requests[1].options).toEqual({
    body: JSON.stringify({ url: FEED }),
    method: "POST",
    url: RELAY + "/api/ics",
  });
  h.requests[1].done(200, ics("Brunch"));

  expect(h.titles()).toEqual(["Brunch"]);
  expect(h.service.getSnapshot().statuses.family).toMatchObject({ lastSyncedAt: NOW, state: "ok" });
  expect(h.storage.get(CALENDAR_CACHE_KEY)).toContain(JSON.stringify(FEED));

  // Later syncs skip the blocked direct request.
  h.service.syncNow();
  expect(h.requests[2].options.url).toBe(RELAY + "/api/ics");
});

test("keeps cached events after a failed sync and reports the error", () => {
  const first = harness();
  first.service.start();
  first.requests[0].done(200, ics("Soccer"));
  const cached = first.storage.get(CALENDAR_CACHE_KEY) as string;

  const h = harness([family], { [CALENDAR_CACHE_KEY]: cached });
  h.service.start();
  expect(h.titles()).toEqual(["Soccer"]);
  h.requests[0].done(0, "");
  h.requests[1].done(502, JSON.stringify({ error: "upstream", status: 404 }));
  expect(h.titles()).toEqual(["Soccer"]);
  expect(h.service.getSnapshot().statuses.family).toMatchObject({
    error: "notFound",
    lastSyncedAt: NOW,
    state: "error",
  });
});

test("hides disabled calendars, recolours events and forgets removed calendars", () => {
  const h = harness();
  h.service.start();
  h.requests[0].done(200, ics("Swim"));
  h.settings.set({ calendars: [{ ...family, color: "#d50000" }] } as unknown as SettingsSnapshot);
  expect(h.service.getSnapshot().events[0].color).toBe("#d50000");
  h.settings.set({ calendars: [{ ...family, enabled: false }] } as unknown as SettingsSnapshot);
  expect(h.titles()).toEqual([]);
  h.settings.set({ calendars: [] } as unknown as SettingsSnapshot);
  expect(JSON.parse(h.storage.get(CALENDAR_CACHE_KEY) || "{}")).toEqual({});
});

test("pairs with a phone: shows a code, collects sent calendars and syncs them", () => {
  const h = harness([]);
  h.service.start();
  h.service.startPairing();
  expect(h.service.getSnapshot().pairing.state).toBe("starting");
  const secret = h.storage.get(CALENDAR_SECRET_KEY);
  expect(secret).toMatch(/^[a-f0-9]{32}$/);
  expect(h.requests[0].options).toEqual({
    body: JSON.stringify({ secret }),
    method: "POST",
    url: RELAY + "/api/session",
  });
  h.requests[0].done(200, JSON.stringify({ code: "K7P29QXM", expiresAt: NOW + 15 * 60 * 1000 }));
  expect(h.service.getSnapshot().pairing).toMatchObject({
    code: "K7P29QXM",
    state: "ready",
    url: RELAY + "/c/K7P29QXM",
  });

  h.runTimers();
  expect(h.requests[1].options.url).toBe(RELAY + "/api/session/K7P29QXM/claim");
  h.requests[1].done(200, JSON.stringify({ calendars: [{ color: "#8e24aa", name: "Kids", url: FEED }] }));
  const added = h.settings.getSnapshot().calendars;
  expect(added).toHaveLength(1);
  expect(added[0]).toMatchObject({ color: "#8e24aa", enabled: true, name: "Kids", url: FEED });
  expect(h.requests[2].options).toEqual({ method: "GET", url: FEED });

  // An expired code is replaced while pairing stays open; stopping ends polling.
  h.runTimers();
  h.requests[3].done(404, JSON.stringify({ error: "expired" }));
  expect(h.requests[4].options.url).toBe(RELAY + "/api/session");
  h.service.stopPairing();
  h.requests[4].done(200, JSON.stringify({ code: "AAAA2222", expiresAt: NOW + 60 * 60 * 1000 }));
  expect(h.service.getSnapshot().pairing.code).toBe("");
});

const DAY = 24 * 60 * 60 * 1000;
const named = (title: string) => title;
const timed = (id: string, start: number, end: number, title: string) => ({ allDay: false, end, id, start, title });
const googleReply = (calendars: Record<string, unknown>) => JSON.stringify({ calendars });

test("syncs a Google account's calendars in one relay request and recolours them", () => {
  const h = harness([
    family,
    google("home", "home@group.calendar.google.com", "#16a765"),
    google("me", "me", "#9fc6e7"),
  ]);
  h.service.start();
  const request = h.requests.find((item) => item.options.url === RELAY + "/api/events");
  expect(request).toBeDefined();
  const body = JSON.parse(request?.options.body || "{}") as Record<string, unknown>;
  expect(body).toEqual({
    accountId: ACCOUNT,
    calendarIds: ["home@group.calendar.google.com", "me"],
    from: NOW - 7 * DAY,
    secret: h.storage.get(CALENDAR_SECRET_KEY),
    to: NOW + 30 * DAY,
  });
  request?.done(
    200,
    googleReply({
      "home@group.calendar.google.com": {
        events: [
          timed("a", NOW + 3600000, NOW + 2 * 3600000, "Dentist"),
          { allDay: true, endDay: 20414, id: "b", startDay: 20413, title: named("Trip") },
          timed("bad", 5, 1, "Backwards"),
        ],
      },
      me: { error: "not-found" },
    }),
  );
  const events = h.service.getSnapshot().events;
  expect(events.map((event) => event.title)).toEqual(["Trip", "Dentist"]);
  expect(events[1]).toMatchObject({ calendarId: "home", color: "#16a765", id: "home:a" });
  expect(h.service.getSnapshot().statuses.home).toMatchObject({ eventCount: 2, state: "ok" });
  expect(h.service.getSnapshot().statuses.me).toMatchObject({ error: "notFound", state: "error" });
  expect(h.storage.get(CALENDAR_CACHE_KEY)).toContain("Dentist");
});

test("asks to reconnect on the phone when Google access was revoked", () => {
  const h = harness([google("home", "home", "#16a765")]);
  h.service.start();
  h.requests[0].done(401, JSON.stringify({ error: "reconnect" }));
  expect(h.service.getSnapshot().statuses.home).toMatchObject({ error: "reconnect", state: "error" });
});

test("adds a Google sign-in from the phone, replacing that account's earlier selection", () => {
  const h = harness([google("home", "home", "#16a765"), family]);
  h.service.start();
  h.service.startPairing();
  const session = h.requests.find((item) => item.options.url === RELAY + "/api/session");
  session?.done(200, JSON.stringify({ code: "K7P29QXM", expiresAt: NOW + 15 * 60 * 1000 }));
  h.runTimers();
  const claim = h.requests.find((item) => item.options.url.endsWith("/claim"));
  claim?.done(
    200,
    JSON.stringify({
      calendars: [
        {
          accountId: ACCOUNT,
          calendars: [
            { color: "#9fc6e7", id: "me", name: "Me" },
            { color: "#16a765", id: "home", name: "Home" },
          ],
          email: "bryan@example.com",
          type: "google",
        },
      ],
    }),
  );
  const calendars = h.settings.getSnapshot().calendars;
  expect(calendars.map((source) => [source.kind, source.calendarId, source.name])).toEqual([
    ["google", "me", "Me"],
    ["google", "home", "Home"],
    ["ics", "", "Family"],
  ]);
  expect(calendars[1].id).toBe("home");
});

test("removing a Google account deletes it on the relay and retries until it succeeds", () => {
  const h = harness([google("home", "home", "#16a765"), family]);
  h.service.start();
  h.service.removeAccount(ACCOUNT);
  expect(h.settings.getSnapshot().calendars.map((source) => source.id)).toEqual(["family"]);
  const removal = h.requests.filter((item) => item.options.url === RELAY + "/api/accounts/remove");
  expect(removal).toHaveLength(1);
  expect(JSON.parse(removal[0].options.body || "{}")).toEqual({
    accountId: ACCOUNT,
    secret: h.storage.get(CALENDAR_SECRET_KEY),
  });
  removal[0].done(0, "");
  expect(JSON.parse(h.storage.get(CALENDAR_REMOVALS_KEY) || "[]")).toEqual([ACCOUNT]);

  const later = harness([family], { [CALENDAR_REMOVALS_KEY]: JSON.stringify([ACCOUNT]) });
  later.service.start();
  const retry = later.requests.find((item) => item.options.url === RELAY + "/api/accounts/remove");
  retry?.done(200, JSON.stringify({ ok: true, removed: true }));
  expect(JSON.parse(later.storage.get(CALENDAR_REMOVALS_KEY) || "null")).toEqual([]);
});
