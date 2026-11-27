import { expect, test, vi } from "vitest";

import { createRadarPreloader, type RadarPreloadFrame } from "./createRadarPreloader";
import { MAX_RADAR_TILES } from "./rainViewer";
import {
  activeRadarTileLoads,
  MAX_CONCURRENT_RADAR_TILES,
  queuedRadarTileLoads,
  resetRadarTileQueue,
} from "./tileLoadQueue";

interface FakeImage {
  readonly attrs: Record<string, string>;
  emit(type: "error" | "load"): void;
  src: string;
}

const createFakeImage = (): FakeImage & HTMLImageElement => {
  const listeners: Record<string, () => void> = {};
  const attrs: Record<string, string> = {};
  const img = {
    addEventListener(type: string, handler: () => void) {
      listeners[type] = handler;
    },
    attrs,
    emit(type: "error" | "load") {
      listeners[type]?.();
    },
    removeAttribute(name: string) {
      delete attrs[name];
      if (name === "src") {
        img.src = "";
      }
    },
    removeEventListener(type: string) {
      delete listeners[type];
    },
    setAttribute(name: string, value: string) {
      attrs[name] = value;
      if (name === "src") {
        img.src = value;
      }
    },
    src: "",
  };
  return img as unknown as FakeImage & HTMLImageElement;
};

const createFakeCanvas = (throwOnDraw = false) => {
  const ctx = {
    clearRect: vi.fn(),
    drawImage: vi.fn(() => {
      if (throwOnDraw) {
        throw new Error("CORS tainted");
      }
    }),
    globalAlpha: 1,
    imageSmoothingEnabled: false,
  };
  const canvas = {
    ctx,
    getContext: () => ctx,
    height: 0,
    setAttribute(name: string, value: string) {
      if (name === "width") {
        canvas.width = Number(value);
      }
      if (name === "height") {
        canvas.height = Number(value);
      }
    },
    width: 0,
  };
  return canvas as unknown as HTMLCanvasElement & { ctx: typeof ctx };
};

const makeFrames = (count: number, tilesPerFrame = 2): RadarPreloadFrame[] =>
  Array.from({ length: count }, (_, frameIndex) => ({
    id: "frame-" + frameIndex,
    tiles: Array.from({ length: tilesPerFrame }, (_, tileIndex) => ({
      src: "https://tilecache.rainviewer.com/frame-" + frameIndex + "/tile-" + tileIndex + ".png",
      tile: { left: tileIndex * 256, size: 256, top: 0, x: tileIndex, y: frameIndex },
    })),
  }));

test("preloads priority frame first, respects the 4-tile concurrency cap, and gates ready until all frames finish", () => {
  resetRadarTileQueue();
  const images: (FakeImage & HTMLImageElement)[] = [];
  const preloader = createRadarPreloader({
    createCanvas: () => createFakeCanvas(),
    createImage: () => {
      const next = createFakeImage();
      images.push(next);
      return next;
    },
  });

  const frames = makeFrames(3, 2);
  preloader.sync({
    frames,
    height: 1080,
    preloadAll: true,
    priorityFrameId: "frame-2",
    source: "rainviewer",
    viewKey: "view-a",
    width: 1920,
  });

  // Priority frame-2 starts first; total active never exceeds 4.
  expect(activeRadarTileLoads()).toBe(MAX_CONCURRENT_RADAR_TILES);
  expect(queuedRadarTileLoads()).toBe(2);
  expect(images[0].src).toContain("/frame-2/tile-0");
  expect(images[1].src).toContain("/frame-2/tile-1");
  expect(preloader.getSnapshot()).toMatchObject({
    canComposite: true,
    loadedFrames: 0,
    ready: false,
    totalFrames: 3,
  });

  // Finish priority frame-2 first.
  images[0].emit("load");
  images[1].emit("load");
  expect(preloader.getSnapshot()).toMatchObject({ loadedFrames: 1, ready: false, totalFrames: 3 });
  expect(preloader.getFrameCanvas("frame-2")).not.toBeNull();
  // Source tile images are released immediately after compositing.
  expect(images[0].src).toBe("");
  expect(images[1].src).toBe("");

  // Finish remaining frames (including one errored tile — frame still completes cleanly).
  images[2].emit("load");
  images[3].emit("error");
  expect(preloader.getSnapshot()).toMatchObject({ loadedFrames: 2, ready: false, totalFrames: 3 });

  images[4].emit("load");
  images[5].emit("load");
  expect(preloader.getSnapshot()).toMatchObject({ loadedFrames: 3, ready: true, totalFrames: 3 });
  expect(activeRadarTileLoads()).toBe(0);
  expect(queuedRadarTileLoads()).toBe(0);

  // Expanding the span on the same view reuses already-composited canvases.
  const priorFrame2Canvas = preloader.getFrameCanvas("frame-2");
  const priorImageCount = images.length;
  const expanded = makeFrames(4, 2);
  preloader.sync({
    frames: expanded,
    height: 1080,
    preloadAll: true,
    priorityFrameId: "frame-2",
    source: "rainviewer",
    viewKey: "view-a",
    width: 1920,
  });
  expect(preloader.getFrameCanvas("frame-2")).toBe(priorFrame2Canvas);
  expect(images.length - priorImageCount).toBe(2);
  expect(preloader.getSnapshot()).toMatchObject({ loadedFrames: 3, ready: false, totalFrames: 4 });

  preloader.dispose();
  expect(activeRadarTileLoads()).toBe(0);
  expect(queuedRadarTileLoads()).toBe(0);
  expect(priorFrame2Canvas?.width).toBe(0);
  expect(priorFrame2Canvas?.height).toBe(0);
  resetRadarTileQueue();
});

test("caps each frame at MAX_RADAR_TILES and cancels all in-flight work on clear or dispose", () => {
  resetRadarTileQueue();
  const images: (FakeImage & HTMLImageElement)[] = [];
  const preloader = createRadarPreloader({
    createCanvas: () => createFakeCanvas(),
    createImage: () => {
      const next = createFakeImage();
      images.push(next);
      return next;
    },
  });

  const oversized = makeFrames(1, MAX_RADAR_TILES + 12);
  preloader.sync({
    frames: oversized,
    height: 2160,
    preloadAll: true,
    priorityFrameId: "frame-0",
    source: "rainviewer",
    viewKey: "4k",
    width: 3840,
  });

  expect(images).toHaveLength(MAX_RADAR_TILES);
  expect(activeRadarTileLoads()).toBe(MAX_CONCURRENT_RADAR_TILES);
  expect(queuedRadarTileLoads()).toBe(MAX_RADAR_TILES - MAX_CONCURRENT_RADAR_TILES);

  // Clearing immediately cancels every queued and active image load.
  preloader.clear();
  expect(activeRadarTileLoads()).toBe(0);
  expect(queuedRadarTileLoads()).toBe(0);
  expect(images.every((img) => img.src === "")).toBe(true);
  preloader.dispose();
  resetRadarTileQueue();
});

test("falls back cleanly to DOM tile rendering when canvas compositing fails", () => {
  resetRadarTileQueue();
  const images: (FakeImage & HTMLImageElement)[] = [];
  let probeDone = false;
  const preloader = createRadarPreloader({
    createCanvas: () => {
      if (!probeDone) {
        probeDone = true;
        return createFakeCanvas(false);
      }
      return createFakeCanvas(true);
    },
    createImage: () => {
      const next = createFakeImage();
      images.push(next);
      return next;
    },
  });

  preloader.sync({
    frames: makeFrames(1, 1),
    height: 600,
    preloadAll: true,
    priorityFrameId: "frame-0",
    source: "rainviewer",
    viewKey: "cors-test",
    width: 800,
  });

  images[0].emit("load");
  expect(preloader.getSnapshot().canComposite).toBe(false);
  expect(preloader.getFrameCanvas("frame-0")).toBeNull();
  preloader.dispose();
  resetRadarTileQueue();
});
