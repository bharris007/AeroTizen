import { afterEach, expect, test, vi } from "vitest";

import {
  activeRadarImageLoads,
  createRadarSequenceLoader,
  loadRadarImage,
  MAX_CONCURRENT_RADAR_LOADS,
  queuedRadarImageLoads,
  RADAR_LOAD_WATCHDOG_MS,
  releaseRadarImage,
  resetRadarImageQueue,
} from "./radarImageLoader";
import { MAX_RADAR_FRAMES } from "./radarTimeline";

afterEach(() => {
  vi.useRealTimers();
  resetRadarImageQueue();
});

test("enforces strictly one radar image load in flight at a time and cleans up on cancel", () => {
  expect(MAX_CONCURRENT_RADAR_LOADS).toBe(1);
  const images = Array.from({ length: 4 }, () => document.createElement("img"));
  const settled: number[] = [];
  const cancels = images.map((image, index) =>
    loadRadarImage(image, "https://example.test/radar-" + index + ".png", {
      onSettled: () => settled.push(index),
    }),
  );

  // Only the first image receives a src; the rest stay queued.
  expect(activeRadarImageLoads()).toBe(1);
  expect(queuedRadarImageLoads()).toBe(3);
  expect(images[0].getAttribute("src")).toBe("https://example.test/radar-0.png");
  expect(images[1].getAttribute("src")).toBeNull();
  expect(images[2].getAttribute("src")).toBeNull();

  // Settling the first starts the second, never exceeding 1 in flight.
  images[0].dispatchEvent(new Event("load"));
  expect(settled).toEqual([0]);
  expect(activeRadarImageLoads()).toBe(1);
  expect(queuedRadarImageLoads()).toBe(2);
  expect(images[1].getAttribute("src")).toBe("https://example.test/radar-1.png");
  expect(images[2].getAttribute("src")).toBeNull();

  // Cancelling all remaining loads releases src and drains both active and queued counts to 0.
  cancels.forEach((cancel) => cancel());
  expect(activeRadarImageLoads()).toBe(0);
  expect(queuedRadarImageLoads()).toBe(0);
  expect(images[1].getAttribute("src")).toBeNull();
});

test("sequence loader caps at MAX_RADAR_FRAMES (6) and loads strictly one frame at a time", () => {
  const created: HTMLImageElement[] = [];
  const loader = createRadarSequenceLoader({
    createImage: () => {
      const img = document.createElement("img");
      created.push(img);
      return img;
    },
  });

  const frames = Array.from({ length: 12 }, (_, index) => ({
    id: "f" + index,
    src: "https://example.test/frame-" + index + ".png",
  }));

  loader.load(frames);
  expect(loader.getSnapshot().totalFrames).toBe(MAX_RADAR_FRAMES);
  expect(activeRadarImageLoads()).toBe(1);
  expect(created).toHaveLength(1);

  for (let step = 0; step < MAX_RADAR_FRAMES; step += 1) {
    expect(activeRadarImageLoads()).toBe(1);
    expect(created[0].getAttribute("src")).toBe("https://example.test/frame-" + step + ".png");
    created[0].dispatchEvent(new Event("load"));
  }

  expect(loader.getSnapshot()).toMatchObject({
    done: true,
    loadedFrames: MAX_RADAR_FRAMES,
    ready: true,
    timedOut: false,
    totalFrames: MAX_RADAR_FRAMES,
  });
  expect(activeRadarImageLoads()).toBe(0);
  expect(created[0].getAttribute("src")).toBeNull();
  loader.dispose();
});

test("8-second watchdog aborts stalled sequence loads and releases the in-flight image", () => {
  vi.useFakeTimers();
  const created: HTMLImageElement[] = [];
  const loader = createRadarSequenceLoader({
    createImage: () => {
      const img = document.createElement("img");
      created.push(img);
      return img;
    },
  });

  loader.load([
    { id: "f0", src: "https://example.test/slow-0.png" },
    { id: "f1", src: "https://example.test/slow-1.png" },
  ]);
  expect(activeRadarImageLoads()).toBe(1);
  expect(created[0].getAttribute("src")).toBe("https://example.test/slow-0.png");

  vi.advanceTimersByTime(RADAR_LOAD_WATCHDOG_MS - 1);
  expect(loader.getSnapshot().timedOut).toBe(false);
  expect(activeRadarImageLoads()).toBe(1);

  vi.advanceTimersByTime(1);
  expect(loader.getSnapshot().timedOut).toBe(true);
  expect(loader.getSnapshot().ready).toBe(false);
  expect(activeRadarImageLoads()).toBe(0);
  expect(queuedRadarImageLoads()).toBe(0);
  expect(created[0].getAttribute("src")).toBeNull();
  loader.dispose();
});

test("releaseRadarImage strips src from an img element cleanly", () => {
  const img = document.createElement("img");
  img.setAttribute("src", "https://example.test/base.jpg");
  releaseRadarImage(img);
  expect(img.getAttribute("src")).toBeNull();
});
