// Shared queue so every radar view on screen loads only a few images at a time.
// Tizen TVs stall the UI thread when dozens of tiles decode together.
export const MAX_CONCURRENT_RADAR_TILES = 4;

export type RadarTilePriority = "high" | "low";

export interface LoadRadarTileOptions {
  readonly crossOrigin?: "anonymous";
  readonly onSettled?: (loaded: boolean) => void;
  readonly priority?: RadarTilePriority;
}

type Pending = {
  cancelled: { value: boolean };
  priority: RadarTilePriority;
  start(): void;
};

const highQueue: Pending[] = [];
const lowQueue: Pending[] = [];
let active = 0;

const nextQueuedJob = () => (highQueue.length > 0 ? highQueue.shift() : lowQueue.shift());

const pump = () => {
  while (active < MAX_CONCURRENT_RADAR_TILES) {
    const job = nextQueuedJob();
    if (!job) {
      return;
    }
    if (job.cancelled.value) {
      continue;
    }
    active += 1;
    job.start();
  }
};

const releaseSlot = () => {
  active = Math.max(0, active - 1);
  pump();
};

const removePending = (job: Pending) => {
  const queue = job.priority === "high" ? highQueue : lowQueue;
  const index = queue.indexOf(job);
  if (index >= 0) {
    queue.splice(index, 1);
    return true;
  }
  return false;
};

// Assign src only when a slot is free. High-priority tiles (basemap + current frame)
// jump ahead of background preloads. The returned function cancels and clears src immediately.
export const loadRadarTile = (image: HTMLImageElement, src: string, options: LoadRadarTileOptions = {}) => {
  const priority = options.priority ?? "high";
  const onSettled = options.onSettled;
  const state = { value: false };
  let onLoad: () => void = () => undefined;
  let onError: () => void = () => undefined;
  const finish = (loaded: boolean) => {
    image.removeEventListener("load", onLoad);
    image.removeEventListener("error", onError);
    if (state.value) {
      return;
    }
    state.value = true;
    releaseSlot();
    onSettled?.(loaded);
  };
  const job: Pending = {
    cancelled: state,
    priority,
    start() {
      if (state.value) {
        releaseSlot();
        return;
      }
      onLoad = () => finish(true);
      onError = () => finish(false);
      image.addEventListener("load", onLoad);
      image.addEventListener("error", onError);
      if (options.crossOrigin) {
        image.setAttribute("crossorigin", options.crossOrigin);
      }
      image.setAttribute("src", src);
    },
  };
  if (priority === "high") {
    highQueue.push(job);
  } else {
    lowQueue.push(job);
  }
  pump();
  return () => {
    if (state.value) {
      return;
    }
    if (removePending(job)) {
      state.value = true;
      image.removeAttribute("src");
      return;
    }
    image.removeEventListener("load", onLoad);
    image.removeEventListener("error", onError);
    image.removeAttribute("src");
    state.value = true;
    releaseSlot();
  };
};

export const activeRadarTileLoads = () => active;
export const queuedRadarTileLoads = () => highQueue.length + lowQueue.length;

export const resetRadarTileQueue = () => {
  highQueue.splice(0, highQueue.length);
  lowQueue.splice(0, lowQueue.length);
  active = 0;
};
