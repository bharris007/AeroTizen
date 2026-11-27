import type { Store } from "../../shared/state/createStore";

import { MAX_RADAR_FRAMES } from "./radarTimeline";

// Strictly one radar image request in flight globally so low-RAM Tizen TVs never stall or OOM.
export const MAX_CONCURRENT_RADAR_LOADS = 1;
// Total loading watchdog: aborts stalled loads and falls back to static latest frame or unavailable.
export const RADAR_LOAD_WATCHDOG_MS = 8_000;

interface ImageJob {
  readonly image: HTMLImageElement;
  readonly onSettled?: (loaded: boolean) => void;
  readonly src: string;
  start(): void;
}

export interface RadarSequenceFrame {
  readonly id: string;
  readonly src: string;
}

export interface RadarSequenceSnapshot {
  readonly attemptedFrames: number;
  readonly done: boolean;
  readonly loadedFrames: number;
  readonly ready: boolean;
  readonly readyIds: readonly string[];
  readonly timedOut: boolean;
  readonly totalFrames: number;
}

export interface RadarSequenceLoader extends Store<RadarSequenceSnapshot> {
  cancel(): void;
  dispose(): void;
  load(frames: readonly RadarSequenceFrame[]): void;
}

const EMPTY_IDS: readonly string[] = Object.freeze([]);

let activeLoad: ImageJob | null = null;
const pendingLoads: ImageJob[] = [];

// Abort any fetch and drop the decoded backing store from an <img> element.
export const releaseRadarImage = (image: HTMLImageElement | null | undefined) => {
  if (!image) {
    return;
  }
  image.setAttribute("src", "");
  image.removeAttribute("src");
};

const pump = () => {
  if (activeLoad || pendingLoads.length === 0) {
    return;
  }
  const next = pendingLoads.shift();
  if (!next) {
    return;
  }
  activeLoad = next;
  next.start();
};

export const activeRadarImageLoads = () => (activeLoad ? 1 : 0);
export const queuedRadarImageLoads = () => pendingLoads.length;

// Queue a single <img> load behind the global 1-in-flight cap. Returned cleanup aborts and frees the slot.
export const loadRadarImage = (
  image: HTMLImageElement,
  src: string,
  { onSettled }: { onSettled?: (loaded: boolean) => void } = {},
) => {
  let done = false;
  let onLoad: () => void = () => undefined;
  let onError: () => void = () => undefined;

  const detach = () => {
    image.removeEventListener("load", onLoad);
    image.removeEventListener("error", onError);
  };

  const finish = (loaded: boolean) => {
    if (done) {
      return;
    }
    done = true;
    detach();
    if (activeLoad === job) {
      activeLoad = null;
    }
    onSettled?.(loaded);
    pump();
  };

  const job: ImageJob = {
    image,
    onSettled,
    src,
    start() {
      if (done) {
        if (activeLoad === job) {
          activeLoad = null;
        }
        pump();
        return;
      }
      onLoad = () => finish(true);
      onError = () => finish(false);
      image.addEventListener("load", onLoad);
      image.addEventListener("error", onError);
      image.setAttribute("src", src);
    },
  };

  pendingLoads.push(job);
  pump();

  return () => {
    if (done) {
      return;
    }
    done = true;
    detach();
    const index = pendingLoads.indexOf(job);
    if (index >= 0) {
      pendingLoads.splice(index, 1);
    }
    if (activeLoad === job) {
      activeLoad = null;
    }
    releaseRadarImage(image);
    pump();
  };
};

export const resetRadarImageQueue = () => {
  if (activeLoad) {
    releaseRadarImage(activeLoad.image);
    activeLoad = null;
  }
  pendingLoads.splice(0, pendingLoads.length);
};

const emptySnapshot = (timedOut = false): RadarSequenceSnapshot =>
  Object.freeze({
    attemptedFrames: 0,
    done: false,
    loadedFrames: 0,
    ready: false,
    readyIds: EMPTY_IDS,
    timedOut,
    totalFrames: 0,
  });

const defaultCreateImage = () => new Image();

// Loads up to MAX_RADAR_FRAMES (6) radar images strictly one at a time using a single reusable
// loader Image, guarded by an 8-second total watchdog timer.
export const createRadarSequenceLoader = ({
  createImage = defaultCreateImage,
  timers = window,
}: {
  createImage?: () => HTMLImageElement;
  timers?: Pick<Window, "clearTimeout" | "setTimeout">;
} = {}): RadarSequenceLoader => {
  const listeners = new Set<() => void>();
  let snapshot = emptySnapshot();
  let disposed = false;
  let generation = 0;
  let cancelActive: (() => void) | null = null;
  let watchdog: number | undefined;
  let loaderImage: HTMLImageElement | null = null;

  const publish = (next: RadarSequenceSnapshot) => {
    if (disposed) {
      return;
    }
    snapshot = next;
    [...listeners].forEach((listener) => listener());
  };

  const clearWatchdog = () => {
    if (watchdog !== undefined) {
      timers.clearTimeout(watchdog);
      watchdog = undefined;
    }
  };

  const stopActive = () => {
    clearWatchdog();
    if (cancelActive) {
      const stop = cancelActive;
      cancelActive = null;
      stop();
    }
    releaseRadarImage(loaderImage);
    loaderImage = null;
  };

  const cancel = () => {
    generation += 1;
    stopActive();
    publish(emptySnapshot(false));
  };

  return {
    cancel,
    dispose() {
      if (disposed) {
        return;
      }
      disposed = true;
      generation += 1;
      stopActive();
      listeners.clear();
    },
    getSnapshot: () => snapshot,
    load(frames) {
      if (disposed) {
        return;
      }
      generation += 1;
      const version = generation;
      stopActive();
      const capped = frames.filter((frame) => Boolean(frame.src)).slice(0, MAX_RADAR_FRAMES);
      if (capped.length === 0) {
        publish(emptySnapshot(false));
        return;
      }
      const readyIds: string[] = [];
      let index = 0;
      const publishProgress = (timedOut: boolean) => {
        const loadedFrames = readyIds.length;
        const totalFrames = capped.length;
        const done = timedOut || index >= totalFrames;
        publish(
          Object.freeze({
            attemptedFrames: index,
            done,
            loadedFrames,
            ready: !timedOut && done && loadedFrames > 0,
            readyIds: Object.freeze([...readyIds]),
            timedOut,
            totalFrames,
          }),
        );
      };

      const step = () => {
        if (disposed || version !== generation) {
          return;
        }
        if (index >= capped.length) {
          clearWatchdog();
          releaseRadarImage(loaderImage);
          loaderImage = null;
          publishProgress(false);
          return;
        }
        const entry = capped[index];
        const image = loaderImage ?? createImage();
        loaderImage = image;
        cancelActive = loadRadarImage(image, entry.src, {
          onSettled(loaded) {
            if (disposed || version !== generation) {
              return;
            }
            cancelActive = null;
            releaseRadarImage(image);
            if (loaded) {
              readyIds.push(entry.id);
            }
            index += 1;
            publishProgress(false);
            step();
          },
        });
      };

      publishProgress(false);
      watchdog = timers.setTimeout(() => {
        if (disposed || version !== generation) {
          return;
        }
        generation += 1;
        stopActive();
        publishProgress(true);
      }, RADAR_LOAD_WATCHDOG_MS);
      step();
    },
    subscribe(listener) {
      if (disposed) {
        return () => undefined;
      }
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
};
