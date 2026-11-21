import type {
  CalendarEvent,
  CalendarPairing,
  CalendarPlatform,
  CalendarSource,
  CalendarSyncError,
  CalendarSyncStatus,
  FamilyCalendarService,
  FamilyCalendarSnapshot,
} from "../../contracts/familyCalendar";
import type { SettingsStore } from "../../contracts/preferences";

import {
  createPairingSecret,
  type FillRandom,
  parseClaimReply,
  parseSessionReply,
  relayClaimUrl,
  relayPairingUrl,
  relayProxyUrl,
  relaySessionUrl,
  validPairingSecret,
} from "./calendarRelay";
import { mergeIncomingCalendars, sameCalendars } from "./calendarSources";
import { DAY_MS } from "./icsTime";
import { parseCalendar } from "./parseCalendar";

export const CALENDAR_CACHE_KEY = "aerotizen.calendar.v1";
export const CALENDAR_SECRET_KEY = "aerotizen.calendar.pairing.v1";
export const CALENDAR_REFRESH_INTERVAL_MS = 12 * 60 * 1000;
export const PAIRING_POLL_INTERVAL_MS = 3000;
const PAIRING_RETRY_MS = 15 * 1000;
// Start a new pairing code shortly before the current one expires.
const PAIRING_RENEW_MARGIN_MS = 60 * 1000;
const WINDOW_PAST_MS = 2 * DAY_MS;
const WINDOW_FUTURE_MS = 14 * DAY_MS;
const HTTP_OK = 200;
const HTTP_FORBIDDEN = 403;
const HTTP_NOT_FOUND = 404;
const MISSING_FEED_STATUSES = [401, 403, 404, 410];

interface CachedCalendar {
  readonly at: number;
  readonly events: readonly CalendarEvent[];
  readonly url: string;
}

const PENDING: CalendarSyncStatus = Object.freeze({ error: "", eventCount: 0, lastSyncedAt: null, state: "pending" });
const IDLE_PAIRING: CalendarPairing = Object.freeze({ code: "", expiresAt: 0, state: "idle", url: "" });

const readCache = (raw: string | null): Record<string, CachedCalendar> => {
  try {
    const data = raw ? (JSON.parse(raw) as Record<string, Partial<CachedCalendar>>) : {};
    const cache: Record<string, CachedCalendar> = {};
    Object.keys(data).forEach((id) => {
      const item = data[id];
      if (item && typeof item.at === "number" && typeof item.url === "string" && Array.isArray(item.events)) {
        cache[id] = { at: item.at, events: item.events, url: item.url };
      }
    });
    return cache;
  } catch {
    return {};
  }
};

// Relay proxy failures carry the calendar server's status.
const syncError = (status: number, text: string): CalendarSyncError => {
  if (status === HTTP_OK) {
    return "invalid";
  }
  if (MISSING_FEED_STATUSES.includes(status)) {
    return "notFound";
  }
  try {
    const upstream = (JSON.parse(text) as { status?: unknown }).status;
    if (typeof upstream === "number" && MISSING_FEED_STATUSES.includes(upstream)) {
      return "notFound";
    }
    return upstream === 415 ? "invalid" : "network";
  } catch {
    return "network";
  }
};

const eventStart = (event: CalendarEvent) => (event.allDay ? event.startDay * DAY_MS : event.start);

export const createFamilyCalendar = ({
  now,
  platform,
  random,
  relayUrl,
  settings,
  storage,
  timeZone,
  timers,
}: {
  now: () => number;
  platform: CalendarPlatform;
  random: FillRandom;
  relayUrl: string;
  settings: Pick<SettingsStore, "getSnapshot" | "subscribe" | "update">;
  storage: Pick<Storage, "getItem" | "setItem">;
  timeZone: () => string;
  timers: Pick<Window, "clearInterval" | "clearTimeout" | "setInterval" | "setTimeout">;
}): FamilyCalendarService => {
  const listeners = new Set<() => void>();
  const syncs = new Map<string, () => void>();
  let statuses: Record<string, CalendarSyncStatus> = {};
  let cache: Record<string, CachedCalendar> = {};
  let sources: readonly CalendarSource[] = [];
  let started = false;
  let disposed = false;
  let interval: number | undefined;
  let unsubscribe: (() => void) | undefined;
  // Set after a direct feed request fails without an HTTP status (blocked by CORS or
  // the network); later requests use the relay proxy.
  let directBlocked = false;
  let pairing = IDLE_PAIRING;
  let pairingRequested = false;
  let pairingTimer: number | undefined;
  let cancelPairingRequest: (() => void) | undefined;

  const enabledSources = () => sources.filter((source) => source.enabled);
  const build = (): FamilyCalendarSnapshot => {
    const events: CalendarEvent[] = [];
    enabledSources().forEach((source) => {
      const cached = cache[source.id];
      if (cached && cached.url === source.url) {
        cached.events.forEach((event) =>
          events.push(event.color === source.color ? event : { ...event, color: source.color }),
        );
      }
    });
    const visibleStatuses: Record<string, CalendarSyncStatus> = {};
    sources.forEach((source) => {
      visibleStatuses[source.id] = statuses[source.id] || PENDING;
    });
    return Object.freeze({
      events: Object.freeze(events.sort((a, b) => eventStart(a) - eventStart(b))),
      pairing,
      statuses: Object.freeze(visibleStatuses),
      syncing: syncs.size > 0,
    });
  };
  let snapshot = build();
  const publish = () => {
    if (disposed) {
      return;
    }
    snapshot = build();
    [...listeners].forEach((listener) => listener());
  };
  const setStatus = (id: string, patch: Partial<CalendarSyncStatus>) => {
    statuses = { ...statuses, [id]: Object.freeze({ ...(statuses[id] || PENDING), ...patch }) };
  };
  const persistCache = () => {
    try {
      storage.setItem(CALENDAR_CACHE_KEY, JSON.stringify(cache));
    } catch {
      // The last good events stay in memory when storage is full.
    }
  };

  const cancelSync = (id: string) => {
    syncs.get(id)?.();
    syncs.delete(id);
  };
  const sync = (source: CalendarSource) => {
    if (disposed) {
      return;
    }
    cancelSync(source.id);
    let abort = () => {};
    let finished = false;
    const cancel = () => {
      finished = true;
      abort();
    };
    syncs.set(source.id, cancel);
    setStatus(source.id, { state: "syncing" });
    const complete = (status: number, text: string) => {
      if (finished || disposed) {
        return;
      }
      finished = true;
      syncs.delete(source.id);
      const at = now();
      const events =
        status === HTTP_OK
          ? parseCalendar(
              text,
              { color: source.color, id: source.id },
              { from: at - WINDOW_PAST_MS, timeZone: timeZone(), to: at + WINDOW_FUTURE_MS },
            )
          : null;
      if (events) {
        cache = { ...cache, [source.id]: { at, events, url: source.url } };
        persistCache();
        setStatus(source.id, { error: "", eventCount: events.length, lastSyncedAt: at, state: "ok" });
      } else {
        setStatus(source.id, { error: syncError(status, text), state: "error" });
      }
      publish();
    };
    const viaRelay = () => {
      abort = platform.request(
        { body: JSON.stringify({ url: source.url }), method: "POST", url: relayProxyUrl(relayUrl) },
        complete,
      );
    };
    if (directBlocked) {
      viaRelay();
    } else {
      abort = platform.request({ method: "GET", url: source.url }, (status, text) => {
        if (finished) {
          return;
        }
        if (status === HTTP_OK && /BEGIN:VCALENDAR/i.test(text.slice(0, 4096))) {
          complete(status, text);
          return;
        }
        if (status === 0) {
          directBlocked = true;
        }
        viaRelay();
      });
    }
    publish();
  };
  const syncAll = () => enabledSources().forEach(sync);

  const reconcile = () => {
    const next = settings.getSnapshot().calendars;
    if (sameCalendars(sources, next)) {
      return;
    }
    const previous = sources;
    sources = next;
    const ids = new Set(next.map((source) => source.id));
    previous.forEach((source) => {
      if (!ids.has(source.id)) {
        cancelSync(source.id);
      }
    });
    const keptCache: Record<string, CachedCalendar> = {};
    Object.keys(cache).forEach((id) => {
      if (ids.has(id)) {
        keptCache[id] = cache[id];
      }
    });
    if (Object.keys(keptCache).length !== Object.keys(cache).length) {
      cache = keptCache;
      persistCache();
    }
    if (started) {
      next
        .filter((source) => {
          const before = previous.find((item) => item.id === source.id);
          const cached = cache[source.id];
          return source.enabled && (!before || !before.enabled || before.url !== source.url || !cached);
        })
        .forEach(sync);
    }
    publish();
  };

  const secret = () => {
    const saved = storage.getItem(CALENDAR_SECRET_KEY);
    if (validPairingSecret(saved)) {
      return saved;
    }
    const created = createPairingSecret(random);
    try {
      storage.setItem(CALENDAR_SECRET_KEY, created);
    } catch {
      // Pairing still works for this session.
    }
    return created;
  };
  const setPairing = (next: CalendarPairing) => {
    pairing = Object.freeze(next);
    publish();
  };
  const clearPairingWork = () => {
    if (pairingTimer !== undefined) {
      timers.clearTimeout(pairingTimer);
      pairingTimer = undefined;
    }
    cancelPairingRequest?.();
    cancelPairingRequest = undefined;
  };
  const schedulePairing = (step: () => void, delay: number) => {
    clearPairingWork();
    pairingTimer = timers.setTimeout(() => {
      pairingTimer = undefined;
      step();
    }, delay);
  };
  const pairingRequest = (url: string, done: (status: number, text: string) => void) => {
    let active = true;
    const abort = platform.request({ body: JSON.stringify({ secret: secret() }), method: "POST", url }, (s, t) => {
      if (active) {
        active = false;
        cancelPairingRequest = undefined;
        done(s, t);
      }
    });
    cancelPairingRequest = () => {
      active = false;
      abort();
    };
  };
  const createId = () => "cal-" + now().toString(36) + "-" + createPairingSecret(random).slice(0, 6);
  const claim = () => {
    if (!pairingRequested || disposed) {
      return;
    }
    if (pairing.expiresAt - now() <= PAIRING_RENEW_MARGIN_MS) {
      openSession();
      return;
    }
    pairingRequest(relayClaimUrl(relayUrl, pairing.code), (status, text) => {
      if (!pairingRequested || disposed) {
        return;
      }
      if (status === HTTP_NOT_FOUND || status === HTTP_FORBIDDEN) {
        // The relay forgot this code (expired) or it belongs to another secret.
        pairing = IDLE_PAIRING;
        openSession();
        return;
      }
      const incoming = status === HTTP_OK ? parseClaimReply(text) : null;
      if (incoming && incoming.length) {
        const current = settings.getSnapshot().calendars;
        settings.update({ calendars: mergeIncomingCalendars(current, incoming, createId) });
      }
      schedulePairing(claim, PAIRING_POLL_INTERVAL_MS);
    });
  };
  const openSession = () => {
    if (!pairingRequested || disposed) {
      return;
    }
    clearPairingWork();
    if (pairing.code && pairing.expiresAt - now() > PAIRING_RENEW_MARGIN_MS) {
      setPairing({ ...pairing, state: "ready" });
      claim();
      return;
    }
    setPairing({ ...IDLE_PAIRING, state: "starting" });
    pairingRequest(relaySessionUrl(relayUrl), (status, text) => {
      if (!pairingRequested || disposed) {
        return;
      }
      const reply = status === HTTP_OK ? parseSessionReply(text) : null;
      if (!reply) {
        setPairing({ ...IDLE_PAIRING, state: "offline" });
        schedulePairing(openSession, PAIRING_RETRY_MS);
        return;
      }
      setPairing({
        code: reply.code,
        expiresAt: reply.expiresAt,
        state: "ready",
        url: relayPairingUrl(relayUrl, reply.code),
      });
      schedulePairing(claim, PAIRING_POLL_INTERVAL_MS);
    });
  };

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      if (disposed) {
        return () => undefined;
      }
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    start() {
      if (disposed || started) {
        return;
      }
      started = true;
      cache = readCache(storage.getItem(CALENDAR_CACHE_KEY));
      sources = settings.getSnapshot().calendars;
      Object.keys(cache).forEach((id) => {
        const source = sources.find((item) => item.id === id);
        if (source && cache[id].url === source.url) {
          setStatus(id, { eventCount: cache[id].events.length, lastSyncedAt: cache[id].at, state: "ok" });
        }
      });
      unsubscribe = settings.subscribe(reconcile);
      interval = timers.setInterval(syncAll, CALENDAR_REFRESH_INTERVAL_MS);
      publish();
      syncAll();
    },
    syncNow() {
      if (started) {
        syncAll();
      }
    },
    startPairing() {
      if (disposed || pairingRequested) {
        return;
      }
      pairingRequested = true;
      openSession();
    },
    stopPairing() {
      pairingRequested = false;
      clearPairingWork();
    },
    dispose() {
      if (disposed) {
        return;
      }
      pairingRequested = false;
      clearPairingWork();
      [...syncs.keys()].forEach(cancelSync);
      if (interval !== undefined) {
        timers.clearInterval(interval);
      }
      unsubscribe?.();
      disposed = true;
      listeners.clear();
    },
  };
};
