import type { Store } from "../shared/state/createStore";

export type CalendarSourceKind = "ics" | "google";

// A calendar the user added from their phone: either a Google calendar from a signed-in
// account (the relay keeps the encrypted sign-in) or a pasted iCal address. iCal addresses
// are private links, so they stay in local preferences and are never shown on screen.
// Fields that do not apply to a kind are empty strings.
export interface CalendarSource {
  // Google: the account's email address, shown to group calendars.
  readonly account: string;
  // Google: the relay's account record for this TV and Google account.
  readonly accountId: string;
  // Google: the calendar's Google id.
  readonly calendarId: string;
  readonly color: string;
  readonly enabled: boolean;
  readonly id: string;
  readonly kind: CalendarSourceKind;
  readonly name: string;
  // iCal: the feed address.
  readonly url: string;
}

interface CalendarEventBase {
  readonly calendarId: string;
  readonly color: string;
  // Stable per instance, for list keys.
  readonly id: string;
  readonly title: string;
}

// All-day events use day numbers (days since 1970-01-01) for their calendar dates.
// `endDay` is exclusive.
export interface AllDayCalendarEvent extends CalendarEventBase {
  readonly allDay: true;
  readonly endDay: number;
  readonly startDay: number;
}

export interface TimedCalendarEvent extends CalendarEventBase {
  readonly allDay: false;
  readonly end: number;
  readonly start: number;
}

export type CalendarEvent = AllDayCalendarEvent | TimedCalendarEvent;

export type CalendarSyncState = "pending" | "syncing" | "ok" | "error";
// "reconnect": Google access was removed or expired; sign in again from the phone.
export type CalendarSyncError = "" | "network" | "invalid" | "notFound" | "reconnect";

export interface CalendarSyncStatus {
  readonly error: CalendarSyncError;
  readonly eventCount: number;
  readonly lastSyncedAt: number | null;
  readonly state: CalendarSyncState;
}

export type CalendarPairingState = "idle" | "starting" | "ready" | "offline";

export interface CalendarPairing {
  readonly code: string;
  readonly expiresAt: number;
  readonly state: CalendarPairingState;
  readonly url: string;
}

export interface FamilyCalendarSnapshot {
  readonly events: readonly CalendarEvent[];
  readonly pairing: CalendarPairing;
  readonly statuses: Readonly<Record<string, CalendarSyncStatus>>;
  readonly syncing: boolean;
}

export interface FamilyCalendarService extends Store<FamilyCalendarSnapshot> {
  dispose(): void;
  // Removes a Google account's calendars and deletes its sign-in from the relay.
  removeAccount(accountId: string): void;
  start(): void;
  // Shows a pairing code and collects calendars sent from a phone until stopped.
  startPairing(): void;
  stopPairing(): void;
  syncNow(): void;
}

export interface CalendarRequest {
  readonly body?: string;
  readonly method: "GET" | "POST";
  readonly url: string;
}

export interface CalendarPlatform {
  // Calls `done` once with the HTTP status (0 for a transport failure) and response text.
  request(options: CalendarRequest, done: (status: number, text: string) => void): () => void;
}
