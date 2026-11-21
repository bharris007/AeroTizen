import type {
  FamilyConditions,
  FamilyDay,
  FamilyForecastService,
  FamilyForecastSnapshot,
  FamilyHour,
} from "../../contracts/familyForecast";
import type { SettingsStore, TemperatureUnit, WeatherLocation } from "../../contracts/preferences";
import type { WeatherPlatform } from "../../contracts/status";
import type { Store } from "../../shared/state/createStore";

import { familyForecastUrl, FRANKLIN_TIME_ZONE, resolveFamilyLocation } from "./familyLocation";
import { type FamilyForecastReading, familyForecastSignature, parseFamilyForecast } from "./parseFamilyForecast";

const REFRESH_INTERVAL_MS = 20 * 60 * 1000;
const EMPTY_HOURS: readonly FamilyHour[] = Object.freeze([]);
const EMPTY_DAYS: readonly FamilyDay[] = Object.freeze([]);
const NO_CONDITIONS: FamilyConditions = Object.freeze({ feelsLike: null, humidity: null, windSpeed: null });

const sourceKey = (location: WeatherLocation, unit: TemperatureUnit) =>
  JSON.stringify([location.latitude, location.longitude, location.name, location.timezone || "", unit]);

const emptyReading = (): FamilyForecastReading => ({
  code: null,
  conditions: NO_CONDITIONS,
  days: EMPTY_DAYS,
  high: null,
  hours: EMPTY_HOURS,
  low: null,
  sunriseMinute: null,
  sunsetMinute: null,
  temperature: null,
  timeZone: "",
});

export const createFamilyForecast = ({
  clock,
  now,
  platform,
  settings,
  timers,
}: {
  clock: Store<number>;
  now: () => number;
  platform: WeatherPlatform;
  settings: Pick<SettingsStore, "getSnapshot" | "subscribe">;
  timers: Pick<Window, "clearInterval" | "setInterval">;
}): FamilyForecastService => {
  const listeners = new Set<() => void>();
  const requests = new Set<() => void>();
  const unsubscribers: (() => void)[] = [];
  let disposed = false;
  let started = false;
  let generation = 0;
  let interval: number | undefined;
  let payload: unknown = null;
  let payloadSource = "";
  let reading = emptyReading();

  const place = () => resolveFamilyLocation(settings.getSnapshot().weatherLocation);
  const unit = (): TemperatureUnit => (settings.getSnapshot().tempUnit === "F" ? "F" : "C");
  const locationLabel = () => {
    const location = place();
    return location.label || location.name;
  };
  const build = (status: FamilyForecastSnapshot["status"]): FamilyForecastSnapshot => {
    const ready = status === "ready";
    const location = place();
    return Object.freeze({
      code: ready ? reading.code : null,
      conditions: ready ? reading.conditions : NO_CONDITIONS,
      days: ready ? reading.days : EMPTY_DAYS,
      high: ready ? reading.high : null,
      hours: ready ? reading.hours : EMPTY_HOURS,
      locationLabel: location.label || location.name,
      low: ready ? reading.low : null,
      status,
      sunriseMinute: ready ? reading.sunriseMinute : null,
      sunsetMinute: ready ? reading.sunsetMinute : null,
      temperature: ready ? reading.temperature : null,
      timeZone: reading.timeZone || location.timezone || FRANKLIN_TIME_ZONE,
    });
  };
  let snapshot = build("loading");
  let publishedSignature = familyForecastSignature("loading", locationLabel(), reading);
  const publish = (status: FamilyForecastSnapshot["status"]) => {
    if (disposed) {
      return;
    }
    const nextSignature = familyForecastSignature(status, locationLabel(), reading);
    if (snapshot && nextSignature === publishedSignature) {
      return;
    }
    publishedSignature = nextSignature;
    snapshot = build(status);
    [...listeners].forEach((listener) => listener());
  };
  const cancelInFlight = () => {
    [...requests].forEach((cancel) => cancel());
    requests.clear();
  };
  const project = () => {
    if (!payload) {
      return;
    }
    const parsed = parseFamilyForecast(payload, now(), place().timezone || FRANKLIN_TIME_ZONE);
    if (!parsed) {
      return;
    }
    reading = parsed;
    publish("ready");
  };
  const refresh = () => {
    if (disposed || !started) {
      return;
    }
    cancelInFlight();
    generation += 1;
    const version = generation;
    const location = place();
    const currentUnit = unit();
    const source = sourceKey(location, currentUnit);
    if (source !== payloadSource) {
      payload = null;
      payloadSource = "";
      reading = emptyReading();
      publish("loading");
    }
    const requestedZone = location.timezone || FRANKLIN_TIME_ZONE;
    let finished = false;
    let abort = () => {};
    const cancel = () => {
      if (!finished) {
        finished = true;
        requests.delete(cancel);
        abort();
      }
    };
    requests.add(cancel);
    abort = platform.requestJSON(familyForecastUrl(location, currentUnit), (data) => {
      if (finished || disposed) {
        return;
      }
      finished = true;
      requests.delete(cancel);
      if (version !== generation) {
        return;
      }
      const parsed = parseFamilyForecast(data, now(), requestedZone);
      if (!parsed) {
        if (!payload) {
          publish("unavailable");
        }
        return;
      }
      payload = data;
      payloadSource = source;
      reading = parsed;
      publish("ready");
    });
    if (finished) {
      abort();
    }
  };
  const reconcile = () => {
    if (disposed || !started) {
      return;
    }
    if (sourceKey(place(), unit()) !== payloadSource) {
      refresh();
      return;
    }
    publish(payload ? "ready" : "loading");
  };
  const getSnapshot = () => snapshot;
  return {
    getSnapshot,
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
      unsubscribers.push(settings.subscribe(reconcile), clock.subscribe(project));
      interval = timers.setInterval(refresh, REFRESH_INTERVAL_MS);
      reconcile();
    },
    dispose() {
      if (disposed) {
        return;
      }
      disposed = true;
      generation += 1;
      if (interval !== undefined) {
        timers.clearInterval(interval);
        interval = undefined;
      }
      cancelInFlight();
      unsubscribers.forEach((unsubscribe) => unsubscribe());
      listeners.clear();
    },
  };
};
