import type { Store } from "../../shared/state/createStore";

import {
  boundedRadarCanvasSize,
  compositeRadarTiles,
  createRadarScratchBuffers,
  MAX_CACHED_RADAR_FRAMES,
  type RadarCompositeSource,
  type RadarDrawableTile,
  type RadarScratchBuffers,
  releaseRadarCanvas,
  releaseRadarScratchBuffers,
} from "./radarCompositor";
import { MAX_RADAR_TILES, type RadarTile } from "./rainViewer";
import { loadRadarTile, type RadarTilePriority } from "./tileLoadQueue";

export interface RadarPreloadTile {
  readonly src: string;
  readonly tile: RadarTile;
}

export interface RadarPreloadFrame {
  readonly id: string;
  readonly tiles: readonly RadarPreloadTile[];
}

export interface RadarPreloadRequest {
  readonly frames: readonly RadarPreloadFrame[];
  readonly height: number;
  readonly preloadAll: boolean;
  readonly priorityFrameId: string | null;
  readonly source: RadarCompositeSource;
  readonly viewKey: string;
  readonly width: number;
}

export interface RadarPreloadSnapshot {
  readonly canComposite: boolean;
  readonly loadedFrames: number;
  readonly ready: boolean;
  readonly readyIds: readonly string[];
  readonly totalFrames: number;
  readonly viewKey: string;
}

export interface RadarPreloader extends Store<RadarPreloadSnapshot> {
  cancelInFlight(): void;
  clear(): void;
  dispose(): void;
  getFrameCanvas(frameId: string): HTMLCanvasElement | null;
  sync(request: RadarPreloadRequest): void;
}

interface ActiveFrameLoad {
  readonly cancel: () => void;
  readonly priority: RadarTilePriority;
}

const EMPTY_IDS: readonly string[] = Object.freeze([]);

const defaultCreateCanvas = () => document.createElement("canvas");
const defaultCreateImage = () => new Image();

const detectCanvasSupport = (createCanvas: () => HTMLCanvasElement) => {
  try {
    const probe = createCanvas();
    probe.setAttribute("width", "1");
    probe.setAttribute("height", "1");
    const supported = probe.getContext("2d") !== null;
    releaseRadarCanvas(probe);
    return supported;
  } catch {
    return false;
  }
};

const emptySnapshot = (canComposite: boolean, viewKey = ""): RadarPreloadSnapshot =>
  Object.freeze({
    canComposite,
    loadedFrames: 0,
    ready: false,
    readyIds: EMPTY_IDS,
    totalFrames: 0,
    viewKey,
  });

const sameSnapshot = (first: RadarPreloadSnapshot, second: RadarPreloadSnapshot) =>
  first.canComposite === second.canComposite &&
  first.loadedFrames === second.loadedFrames &&
  first.ready === second.ready &&
  first.totalFrames === second.totalFrames &&
  first.viewKey === second.viewKey &&
  first.readyIds.length === second.readyIds.length &&
  first.readyIds.every((id, index) => id === second.readyIds[index]);

// Preloads and composites radar frames through the shared 4-slot tile queue.
// Priority frames ("Now" or actively scrubbed) load first; remaining frames fill in
// at low priority so playback stays gated until every frame is ready in memory.
export const createRadarPreloader = ({
  createCanvas = defaultCreateCanvas,
  createImage = defaultCreateImage,
}: {
  createCanvas?: () => HTMLCanvasElement;
  createImage?: () => HTMLImageElement;
} = {}): RadarPreloader => {
  const listeners = new Set<() => void>();
  const cachedCanvases = new Map<string, HTMLCanvasElement>();
  const readyFrames = new Set<string>();
  const inFlight = new Map<string, ActiveFrameLoad>();
  let canComposite = detectCanvasSupport(createCanvas);
  let scratch: RadarScratchBuffers | null = null;
  let disposed = false;
  let generation = 0;
  let currentViewKey = "";
  let currentFrameIds: readonly string[] = EMPTY_IDS;
  let snapshot = emptySnapshot(canComposite);

  const publish = () => {
    if (disposed) {
      return;
    }
    const readyIds = currentFrameIds.filter((id) => readyFrames.has(id));
    const totalFrames = currentFrameIds.length;
    const loadedFrames = readyIds.length;
    const next: RadarPreloadSnapshot = Object.freeze({
      canComposite,
      loadedFrames,
      ready: totalFrames > 0 && loadedFrames >= totalFrames,
      readyIds: Object.freeze(readyIds),
      totalFrames,
      viewKey: currentViewKey,
    });
    if (next.ready && inFlight.size === 0) {
      releaseRadarScratchBuffers(scratch);
      scratch = null;
    }
    if (sameSnapshot(snapshot, next)) {
      return;
    }
    snapshot = next;
    [...listeners].forEach((listener) => listener());
  };

  const cancelFrameLoad = (frameId: string) => {
    const active = inFlight.get(frameId);
    if (!active) {
      return;
    }
    inFlight.delete(frameId);
    active.cancel();
  };

  const cancelAllInFlight = () => {
    const jobs = [...inFlight.values()];
    inFlight.clear();
    jobs.forEach((job) => job.cancel());
  };

  const releaseAllCanvases = () => {
    cachedCanvases.forEach((canvas) => releaseRadarCanvas(canvas));
    cachedCanvases.clear();
    releaseRadarScratchBuffers(scratch);
    scratch = null;
  };

  const clear = () => {
    generation += 1;
    cancelAllInFlight();
    releaseAllCanvases();
    readyFrames.clear();
    currentViewKey = "";
    currentFrameIds = EMPTY_IDS;
    publish();
  };

  const ensureScratch = () => {
    if (!scratch) {
      scratch = createRadarScratchBuffers(createCanvas);
    }
    return scratch;
  };

  const evictExcessFrames = (keepIds: ReadonlySet<string>) => {
    if (cachedCanvases.size <= MAX_CACHED_RADAR_FRAMES) {
      return;
    }
    for (const [id, canvas] of [...cachedCanvases.entries()]) {
      if (cachedCanvases.size <= MAX_CACHED_RADAR_FRAMES) {
        break;
      }
      if (!keepIds.has(id)) {
        releaseRadarCanvas(canvas);
        cachedCanvases.delete(id);
        readyFrames.delete(id);
      }
    }
  };

  const startFrameLoad = (
    frame: RadarPreloadFrame,
    priority: RadarTilePriority,
    request: RadarPreloadRequest,
    version: number,
  ) => {
    const tiles = frame.tiles.slice(0, MAX_RADAR_TILES);
    const bounded = boundedRadarCanvasSize(request.width, request.height);
    if (tiles.length === 0 || bounded.width <= 0 || bounded.height <= 0) {
      readyFrames.add(frame.id);
      publish();
      return;
    }
    let cancelled = false;
    let settled = 0;
    const loadedTiles: RadarDrawableTile[] = [];
    const tileImages: HTMLImageElement[] = [];
    const cancels: (() => void)[] = [];

    const releaseTileImages = () => {
      tileImages.forEach((image) => image.removeAttribute("src"));
      tileImages.splice(0, tileImages.length);
    };

    const finishFrame = () => {
      if (cancelled || disposed || version !== generation) {
        releaseTileImages();
        return;
      }
      inFlight.delete(frame.id);
      if (canComposite) {
        const composed = compositeRadarTiles({
          createCanvas,
          height: bounded.height,
          scale: bounded.scale,
          scratch: ensureScratch(),
          source: request.source,
          tiles: loadedTiles,
          width: bounded.width,
        });
        if (composed) {
          const previous = cachedCanvases.get(frame.id);
          if (previous) {
            releaseRadarCanvas(previous);
          }
          cachedCanvases.set(frame.id, composed);
        } else if (loadedTiles.length > 0) {
          // Canvas compositing failed (e.g. CORS/context loss): fall back cleanly to DOM tiles.
          canComposite = false;
          releaseAllCanvases();
        }
      }
      releaseTileImages();
      readyFrames.add(frame.id);
      publish();
    };

    const cancel = () => {
      if (cancelled) {
        return;
      }
      cancelled = true;
      cancels.forEach((stop) => stop());
      cancels.splice(0, cancels.length);
      releaseTileImages();
    };

    inFlight.set(frame.id, { cancel, priority });

    tiles.forEach((entry) => {
      if (cancelled || disposed || version !== generation) {
        return;
      }
      const image = createImage();
      tileImages.push(image);
      const stop = loadRadarTile(image, entry.src, {
        crossOrigin: canComposite ? "anonymous" : undefined,
        onSettled(loaded) {
          if (cancelled || disposed || version !== generation) {
            return;
          }
          if (loaded) {
            loadedTiles.push({ image, tile: entry.tile });
          }
          settled += 1;
          if (settled >= tiles.length) {
            finishFrame();
          }
        },
        priority,
      });
      cancels.push(stop);
    });
  };

  return {
    cancelInFlight() {
      cancelAllInFlight();
    },
    clear,
    dispose() {
      if (disposed) {
        return;
      }
      disposed = true;
      generation += 1;
      cancelAllInFlight();
      releaseAllCanvases();
      readyFrames.clear();
      listeners.clear();
    },
    getFrameCanvas(frameId) {
      return cachedCanvases.get(frameId) ?? null;
    },
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
    sync(request) {
      if (disposed) {
        return;
      }
      const frames = request.frames.slice(0, MAX_CACHED_RADAR_FRAMES);
      if (!request.viewKey || request.width <= 0 || request.height <= 0 || frames.length === 0) {
        if (currentViewKey || currentFrameIds.length > 0 || inFlight.size > 0 || cachedCanvases.size > 0) {
          clear();
        }
        return;
      }
      if (request.viewKey !== currentViewKey) {
        generation += 1;
        cancelAllInFlight();
        releaseAllCanvases();
        readyFrames.clear();
        currentViewKey = request.viewKey;
      }
      const version = generation;
      currentFrameIds = Object.freeze(frames.map((frame) => frame.id));
      const frameIds = new Set(currentFrameIds);
      evictExcessFrames(frameIds);

      const priorityId =
        request.priorityFrameId && frameIds.has(request.priorityFrameId)
          ? request.priorityFrameId
          : frames[frames.length - 1].id;

      const wanted = new Map<string, { frame: RadarPreloadFrame; priority: RadarTilePriority }>();
      const priorityFrame = frames.find((frame) => frame.id === priorityId);
      if (priorityFrame) {
        wanted.set(priorityFrame.id, { frame: priorityFrame, priority: "high" });
      }
      if (request.preloadAll) {
        frames.forEach((frame) => {
          if (!wanted.has(frame.id)) {
            wanted.set(frame.id, { frame, priority: "low" });
          }
        });
      }

      // Cancel frames no longer needed (e.g. resting card) or promote priority frames.
      for (const [id, job] of [...inFlight.entries()]) {
        const target = wanted.get(id);
        if (!target || (target.priority === "high" && job.priority === "low")) {
          cancelFrameLoad(id);
        }
      }

      // Start priority frame first, then remaining frames.
      wanted.forEach(({ frame, priority }) => {
        if (readyFrames.has(frame.id) || inFlight.has(frame.id)) {
          return;
        }
        startFrameLoad(frame, priority, request, version);
      });

      publish();
    },
  };
};
