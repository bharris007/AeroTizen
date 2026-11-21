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
  parseEventsReply,
  parseSessionReply,
  relayClaimUrl,
  relayEventsUrl,
  relayPairingUrl,
  relayProxyUrl,
  relayRemoveAccountUrl,
  relaySessionUrl,
  validPairingSecret,
} from "./calendarRelay";
import { accountId as validAccountId, calendarKey, mergeIncomingCalendars, sameCalendars } from "./calendarSources";
import { DAY_MS } from "./icsTime";
import { parseCalendar } from "./parseCalendar";

export const CALENDAR_CACHE_KEY = "aerotizen.calendar.v1";
export const CALENDAR_SECRET_KEY = "aerotizen.calendar.pairing.v1";
// Google accounts removed on the TV whose relay sign-in still has to be deleted.
export const CALENDAR_REMOVALS_KEY = "aerotizen.calendar.removals.v1";
export const CALENDAR_REFRESH_INTERVAL_MS = 12 * 60 * 1000;
export const PAIRING_POLL_INTERVAL_MS = 3000;
const PAIRING_RETRY_MS = 15 * 1000;
// Start a new pairing code shortly before the current one expires.
const PAIRING_RENEW_MARGIN_MS = 60 * 1000;
// A week back and a month ahead, so the full-screen calendar can page through days.
// The relay accepts Google windows of up to 40 days.
const WINDOW_PAST_MS = 7 * DAY_MS;
const WINDOW_FUTURE_MS = 30 * DAY_MS;
const GOOGLE_WINDOW_PAST_MS = WINDOW_PAST_MS;
const GOOGLE_WINDOW_FUTURE_MS = WINDOW_FUTURE_MS;
const HTTP_UNAUTHORIZED = 401;
const HTTP_OK = 200;
const HTTP_FORBIDDEN = 403;
const HTTP_NOT_FOUND = 404;
const MISSING_FEED_STATUSES = [401, 403, 404, 410];

interface CachedCalendar {
  readonly at: number;
  readonly events: readonly CalendarEvent[];
  // The source's calendarKey: its iCal address, or its Google account and calendar.
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

const googleError = (error: string): CalendarSyncError => {
  if (error === "revoked") {
    return "reconnect";
  }
  return error === "not-found" ? "notFound" : "network";
};

const readRemovals = (raw: string | null): string[] => {
  try {
    const data = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(data) ? data.filter((item): item is string => Boolean(validAccountId(item))) : [];
  } catch {
    return [];
  }
};

const accountSyncKey = (accountId: string) => "account:" + accountId;

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
  const removals = new Map<string, () => void>();

  const enabledSources = () => sources.filter((source) => source.enabled);
  const build = (): FamilyCalendarSnapshot => {
    const events: CalendarEvent[] = [];
    enabledSources().forEach((source) => {
      const cached = cache[source.id];
      if (cached && cached.url === calendarKey(source)) {
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
        cache = { ...cache, [source.id]: { at, events, url: calendarKey(source) } };
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

  // One relay request reads every enabled calendar of a Google account.
  const syncAccount = (accountId: string) => {
    const key = accountSyncKey(accountId);
    const requested = enabledSources().filter((source) => source.kind === "google" && source.accountId === accountId);
    if (disposed || !requested.length) {
      return;
    }
    cancelSync(key);
    let finished = false;
    requested.forEach((source) => setStatus(source.id, { state: "syncing" }));
    const at = now();
    const abort = platform.request(
      {
        body: JSON.stringify({
          accountId,
          calendarIds: requested.map((source) => source.calendarId),
          from: at - GOOGLE_WINDOW_PAST_MS,
          secret: secret(),
          to: at + GOOGLE_WINDOW_FUTURE_MS,
        }),
        method: "POST",
        url: relayEventsUrl(relayUrl),
      },
      (status, text) => {
        if (finished || disposed) {
          return;
        }
        finished = true;
        syncs.delete(key);
        const replies = status === HTTP_OK ? parseEventsReply(text) : null;
        const signedOut = status === HTTP_UNAUTHORIZED || status === HTTP_NOT_FOUND;
        const done = now();
        let changed = false;
        requested.forEach((requestedSource) => {
          // The source may have changed or gone while the request was running.
          const source = sources.find((item) => item.id === requestedSource.id);
          if (!source || calendarKey(source) !== calendarKey(requestedSource)) {
            return;
          }
          const reply = replies ? replies[source.calendarId] : undefined;
          if (reply && "events" in reply) {
            const events = reply.events.map((event): CalendarEvent => ({
              ...event,
              calendarId: source.id,
              color: source.color,
              id: source.id + ":" + event.id,
            }));
            cache = { ...cache, [source.id]: { at: done, events, url: calendarKey(source) } };
            changed = true;
            setStatus(source.id, { error: "", eventCount: events.length, lastSyncedAt: done, state: "ok" });
            return;
          }
          let error: CalendarSyncError = "network";
          if (signedOut) {
            error = "reconnect";
          } else if (replies) {
            error = reply ? googleError(reply.error) : "notFound";
          }
          setStatus(source.id, { error, state: "error" });
        });
        if (changed) {
          persistCache();
        }
        publish();
      },
    );
    syncs.set(key, () => {
      finished = true;
      abort();
    });
    publish();
  };

  const syncSources = (list: readonly CalendarSource[]) => {
    const accounts: string[] = [];
    list.forEach((source) => {
      if (source.kind !== "google") {
        sync(source);
      } else if (!accounts.includes(source.accountId)) {
        accounts.push(source.accountId);
      }
    });
    accounts.forEach(syncAccount);
  };

  const saveRemovals = (list: readonly string[]) => {
    try {
      storage.setItem(CALENDAR_REMOVALS_KEY, JSON.stringify(list));
    } catch {
      // Retried while the TV stays on.
    }
  };
  let pendingRemovals: string[] = [];
  const dropRemoval = (accountId: string) => {
    if (pendingRemovals.includes(accountId)) {
      pendingRemovals = pendingRemovals.filter((item) => item !== accountId);
      saveRemovals(pendingRemovals);
    }
    removals.get(accountId)?.();
    removals.delete(accountId);
  };
  const flushRemovals = () => {
    pendingRemovals.forEach((accountId) => {
      if (disposed || removals.has(accountId)) {
        return;
      }
      const abort = platform.request(
        { body: JSON.stringify({ accountId, secret: secret() }), method: "POST", url: relayRemoveAccountUrl(relayUrl) },
        (status) => {
          removals.delete(accountId);
          if (status === HTTP_OK) {
            dropRemoval(accountId);
          }
        },
      );
      removals.set(accountId, abort);
    });
  };

  const syncAll = () => {
    flushRemovals();
    syncSources(enabledSources());
  };

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
      if (source.kind === "google" && !next.some((item) => item.accountId === source.accountId)) {
        cancelSync(accountSyncKey(source.accountId));
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
      syncSources(
        next.filter((source) => {
          const before = previous.find((item) => item.id === source.id);
          const cached = cache[source.id];
          return (
            source.enabled && (!before || !before.enabled || calendarKey(before) !== calendarKey(source) || !cached)
          );
        }),
      );
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
        // Signing in again restores an account that is still waiting to be deleted.
        incoming.forEach((item) => {
          if (item.type === "google" && typeof item.accountId === "string") {
            dropRemoval(item.accountId);
          }
        });
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
        if (source && cache[id].url === calendarKey(source)) {
          setStatus(id, { eventCount: cache[id].events.length, lastSyncedAt: cache[id].at, state: "ok" });
        }
      });
      pendingRemovals = readRemovals(storage.getItem(CALENDAR_REMOVALS_KEY));
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
    removeAccount(accountId) {
      if (disposed || !validAccountId(accountId)) {
        return;
      }
      const current = settings.getSnapshot().calendars;
      settings.update({
        calendars: current.filter((source) => source.kind !== "google" || source.accountId !== accountId),
      });
      if (!pendingRemovals.includes(accountId)) {
        pendingRemovals = [...pendingRemovals, accountId];
        saveRemovals(pendingRemovals);
      }
      flushRemovals();
    },
    dispose() {
      if (disposed) {
        return;
      }
      pairingRequested = false;
      clearPairingWork();
      [...syncs.keys()].forEach(cancelSync);
      [...removals.values()].forEach((abort) => abort());
      removals.clear();
      if (interval !== undefined) {
        timers.clearInterval(interval);
      }
      unsubscribe?.();
      disposed = true;
      listeners.clear();
    },
  };
};
