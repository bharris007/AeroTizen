import type { Store } from "../shared/state/createStore";

// A calendar the user added from their phone. The iCal address is a private link, so it
// stays in local preferences and is never shown on screen.
export interface CalendarSource {
  readonly color: string;
  readonly enabled: boolean;
  readonly id: string;
  readonly name: string;
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
export type CalendarSyncError = "" | "network" | "invalid" | "notFound";

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
