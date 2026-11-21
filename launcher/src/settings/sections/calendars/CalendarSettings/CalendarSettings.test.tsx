import { fireEvent, screen } from "@testing-library/preact";
import { expect, test, vi } from "vitest";

import type { CalendarSource, FamilyCalendarSnapshot } from "../../../../contracts/familyCalendar";
import { createNavigation } from "../../../../shared/navigation/createNavigation";
import { createStore } from "../../../../shared/state/createStore";
import { renderWithEnglish } from "../../../../test/renderWithEnglish";
import type { Category } from "../../../layout/categories";

import { CalendarSettings } from "./CalendarSettings";

const navigation = createNavigation(() => undefined);
const drawer = createStore<{ category: Category; expanded: boolean }>({ category: "calendars", expanded: true });
const calendarStore = createStore<FamilyCalendarSnapshot>({
  events: [],
  pairing: { code: "", expiresAt: 0, state: "starting", url: "" },
  statuses: {},
  syncing: false,
});
const familyCalendar = {
  ...calendarStore,
  dispose: vi.fn(),
  start: vi.fn(),
  removeAccount: vi.fn(),
  startPairing: vi.fn(),
  stopPairing: vi.fn(),
  syncNow: vi.fn(),
};
const environment = { drawer, navigation, services: { familyCalendar } };
vi.mock("../../../hooks/useSettingsEnvironment", () => ({
  useSettingsEnvironment: () => environment,
}));

const SYNCED_AT = Date.UTC(2026, 10, 21, 13, 5); // 7:05 AM in Chicago
const NONE = { account: "", accountId: "", calendarId: "", kind: "ics" as const };
const ACCOUNT = "AccountAbc123456789xyz00";
const calendars: CalendarSource[] = [
  { ...NONE, color: "#33b679", enabled: true, id: "family", name: "Family", url: "https://calendar.google.com/a.ics" },
  { ...NONE, color: "#f4511e", enabled: true, id: "work", name: "Work", url: "https://calendar.google.com/b.ics" },
];
const googleCalendar = (id: string, name: string): CalendarSource => ({
  account: "bryan@example.com",
  accountId: ACCOUNT,
  calendarId: id + "@group.calendar.google.com",
  color: "#16a765",
  enabled: true,
  id,
  kind: "google",
  name,
  url: "",
});

test("pairs while shown, shows the QR code, sync status and removes after confirmation", () => {
  const actions = { removeCalendar: vi.fn(), setCalendarEnabled: vi.fn() };
  const settings = { calendars, timeFormat: "12" as const, weatherLocation: null };
  const { container, rerender } = renderWithEnglish(<CalendarSettings active actions={actions} settings={settings} />);
  expect(familyCalendar.startPairing).toHaveBeenCalledTimes(1);
  expect(screen.getByText("Getting a pairing code…")).toBeDefined();
  expect(container.querySelector("[data-calendar-qr]")).toBeNull();

  calendarStore.set({
    events: [],
    pairing: {
      code: "K7P29QXM",
      expiresAt: SYNCED_AT + 900000,
      state: "ready",
      url: "https://aerotizen-cal.vercel.app/c/K7P29QXM",
    },
    statuses: {
      family: { error: "", eventCount: 3, lastSyncedAt: SYNCED_AT, state: "ok" },
      work: { error: "network", eventCount: 0, lastSyncedAt: null, state: "error" },
    },
    syncing: false,
  });
  rerender(<CalendarSettings active actions={actions} settings={settings} />);
  expect(container.querySelector("[data-calendar-qr]")?.getAttribute("data-calendar-qr")).toBe(
    "HTTPS://AEROTIZEN-CAL.VERCEL.APP/C/K7P29QXM",
  );
  expect(container.querySelector("[data-calendar-qr] path")?.getAttribute("d")).toMatch(/^M\d/);
  expect(screen.getByText("K7P2-9QXM")).toBeDefined();
  expect(screen.getByText("Synced 7:05 AM")).toBeDefined();
  expect(screen.getByText("Couldn't sync. Showing saved events.")).toBeDefined();

  fireEvent.click(screen.getByRole("button", { name: "Sync now" }));
  expect(familyCalendar.syncNow).toHaveBeenCalledTimes(1);

  fireEvent.click(screen.getByRole("switch", { name: "Show Work" }));
  expect(actions.setCalendarEnabled).toHaveBeenCalledWith("work", false);

  const remove = container.querySelector("[data-key='calendar:family:remove']") as HTMLElement;
  fireEvent.click(remove);
  expect(actions.removeCalendar).not.toHaveBeenCalled();
  expect(screen.getByText("Press again to remove")).toBeDefined();
  fireEvent.click(remove);
  expect(actions.removeCalendar).toHaveBeenCalledWith("family");

  rerender(<CalendarSettings active={false} actions={actions} settings={settings} />);
  expect(familyCalendar.stopPairing).toHaveBeenCalledTimes(1);
});

test("explains how to start when no calendars are connected", () => {
  const actions = { removeCalendar: vi.fn(), setCalendarEnabled: vi.fn() };
  renderWithEnglish(
    <CalendarSettings active actions={actions} settings={{ calendars: [], timeFormat: "24", weatherLocation: null }} />,
  );
  expect(screen.getByText("No calendars yet. Scan the code to add one.")).toBeDefined();
  expect(screen.getByRole("button", { name: "Sync now" }).getAttribute("aria-disabled")).toBe("true");
});

test("groups Google calendars under their account with reconnect and account removal", () => {
  const actions = { removeCalendar: vi.fn(), setCalendarEnabled: vi.fn() };
  const settings = {
    calendars: [googleCalendar("home", "Home"), googleCalendar("kids", "Kids")],
    timeFormat: "12" as const,
    weatherLocation: null,
  };
  calendarStore.set({
    ...calendarStore.getSnapshot(),
    statuses: {
      home: { error: "reconnect", eventCount: 0, lastSyncedAt: null, state: "error" },
      kids: { error: "", eventCount: 1, lastSyncedAt: SYNCED_AT, state: "ok" },
    },
  });
  const { container } = renderWithEnglish(<CalendarSettings active actions={actions} settings={settings} />);
  expect(screen.getByText("bryan@example.com")).toBeDefined();
  expect(screen.getByText("Reconnect on phone: scan the code and sign in again.")).toBeDefined();
  expect(screen.getByText("Google sign-in expired. Reconnect on your phone.")).toBeDefined();
  expect(container.querySelector("[data-key='calendar:home:remove']")).toBeNull();

  fireEvent.click(screen.getByRole("switch", { name: "Show Kids" }));
  expect(actions.setCalendarEnabled).toHaveBeenCalledWith("kids", false);

  const remove = container.querySelector("[data-key='calendar-account:" + ACCOUNT + ":remove']") as HTMLElement;
  expect(remove.textContent).toBe("Remove account");
  fireEvent.click(remove);
  expect(familyCalendar.removeAccount).not.toHaveBeenCalled();
  fireEvent.click(remove);
  expect(familyCalendar.removeAccount).toHaveBeenCalledWith(ACCOUNT);
});
