import type { RadarMapService, RadarMapSnapshot } from "../../contracts/radarMap";
import type { WeatherPlatform } from "../../contracts/status";

import { parseRainViewerMaps, RAIN_VIEWER_MAPS_URL } from "./rainViewer";

const REFRESH_INTERVAL_MS = 10 * 60 * 1000;
const EMPTY_FRAMES: RadarMapSnapshot["frames"] = Object.freeze([]);

const loadingSnapshot = (): RadarMapSnapshot =>
  Object.freeze({ frames: EMPTY_FRAMES, generated: 0, host: "", status: "loading" });

const sameMap = (current: RadarMapSnapshot, next: RadarMapSnapshot) => {
  if (
    current.status !== next.status ||
    current.host !== next.host ||
    current.generated !== next.generated ||
    current.frames.length !== next.frames.length
  ) {
    return false;
  }
  return current.frames.every(
    (frame, index) =>
      frame.time === next.frames[index]?.time &&
      frame.path === next.frames[index]?.path &&
      frame.kind === next.frames[index]?.kind,
  );
};

// RainViewer metadata for the live radar. Views subscribe with watch(); nothing is fetched until then.
export const createRadarMap = ({
  platform,
  timers,
}: {
  platform: WeatherPlatform;
  timers: Pick<Window, "clearInterval" | "setInterval">;
}): RadarMapService => {
  const listeners = new Set<() => void>();
  let disposed = false;
  let watchers = 0;
  let generation = 0;
  let interval: number | undefined;
  let cancelRequest = () => {};
  let snapshot = loadingSnapshot();
  const publish = (next: RadarMapSnapshot) => {
    if (disposed || sameMap(snapshot, next)) {
      return;
    }
    snapshot = next;
    [...listeners].forEach((listener) => listener());
  };
  const refresh = () => {
    if (disposed || watchers === 0) {
      return;
    }
    cancelRequest();
    generation += 1;
    const version = generation;
    let finished = false;
    const cancel = () => {
      if (!finished) {
        finished = true;
      }
    };
    const abort = platform.requestJSON(RAIN_VIEWER_MAPS_URL, (data) => {
      if (finished || disposed || version !== generation) {
        return;
      }
      finished = true;
      const parsed = parseRainViewerMaps(data);
      if (!parsed) {
        if (snapshot.frames.length === 0) {
          publish(Object.freeze({ frames: EMPTY_FRAMES, generated: 0, host: "", status: "unavailable" }));
        }
        return;
      }
      publish(
        Object.freeze({
          frames: parsed.frames,
          generated: parsed.generated,
          host: parsed.host,
          status: "ready",
        }),
      );
    });
    cancelRequest = () => {
      cancel();
      abort();
    };
    if (finished) {
      abort();
    }
  };
  const stop = () => {
    generation += 1;
    cancelRequest();
    cancelRequest = () => {};
    if (interval !== undefined) {
      timers.clearInterval(interval);
      interval = undefined;
    }
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
    watch() {
      if (disposed) {
        return () => undefined;
      }
      watchers += 1;
      if (watchers === 1) {
        refresh();
        interval = timers.setInterval(refresh, REFRESH_INTERVAL_MS);
      }
      let released = false;
      return () => {
        if (released || disposed) {
          return;
        }
        released = true;
        watchers = Math.max(0, watchers - 1);
        if (watchers === 0) {
          stop();
        }
      };
    },
    dispose() {
      if (disposed) {
        return;
      }
      disposed = true;
      watchers = 0;
      stop();
      listeners.clear();
    },
  };
};
