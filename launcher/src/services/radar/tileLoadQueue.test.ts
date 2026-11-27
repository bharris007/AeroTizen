import { expect, test, vi } from "vitest";

import {
  activeRadarTileLoads,
  loadRadarTile,
  MAX_CONCURRENT_RADAR_TILES,
  queuedRadarTileLoads,
  resetRadarTileQueue,
} from "./tileLoadQueue";

const image = () => {
  const listeners: Record<string, () => void> = {};
  const attrs: Record<string, string> = {};
  return {
    addEventListener(type: string, handler: () => void) {
      listeners[type] = handler;
    },
    attrs,
    removeEventListener(type: string) {
      delete listeners[type];
    },
    removeAttribute(name: string) {
      delete attrs[name];
      if (name === "src") {
        this.src = "";
      }
    },
    setAttribute(name: string, value: string) {
      attrs[name] = value;
      if (name === "src") {
        this.src = value;
      }
    },
    src: "",
    emit(type: string) {
      listeners[type]?.();
    },
  };
};

test("starts at most four tile loads at once and starts the next when one finishes", () => {
  resetRadarTileQueue();
  const tiles = Array.from({ length: 6 }, () => image());
  const stops = tiles.map((tile, index) => loadRadarTile(tile as unknown as HTMLImageElement, "tile:" + index));
  expect(tiles.filter((tile) => tile.src.startsWith("tile:")).length).toBe(MAX_CONCURRENT_RADAR_TILES);
  expect(tiles[4].src).toBe("");
  tiles[0].emit("load");
  expect(tiles[4].src).toBe("tile:4");
  expect(tiles[5].src).toBe("");
  tiles[1].emit("error");
  expect(tiles[5].src).toBe("tile:5");
  stops.forEach((stop) => stop());
  resetRadarTileQueue();
});

test("a cancelled tile never starts and frees a running slot", () => {
  resetRadarTileQueue();
  const first = image();
  const second = image();
  const third = image();
  const stopFirst = loadRadarTile(first as unknown as HTMLImageElement, "a");
  loadRadarTile(second as unknown as HTMLImageElement, "b");
  const stopThird = loadRadarTile(third as unknown as HTMLImageElement, "c");
  stopThird();
  expect(third.src).toBe("");
  stopFirst();
  expect(first.src).toBe("");
  // The cancelled first load should have released its slot so later work can run.
  const fourth = image();
  loadRadarTile(fourth as unknown as HTMLImageElement, "d");
  expect(fourth.src).toBe("d");
  resetRadarTileQueue();
  vi.clearAllMocks();
});

test("high-priority tiles jump ahead of queued low-priority tiles and report settlement", () => {
  resetRadarTileQueue();
  const active = Array.from({ length: MAX_CONCURRENT_RADAR_TILES }, () => image());
  active.forEach((tile, index) => loadRadarTile(tile as unknown as HTMLImageElement, "run:" + index));
  const low = image();
  const high = image();
  const settledLow = vi.fn();
  const settledHigh = vi.fn();
  loadRadarTile(low as unknown as HTMLImageElement, "low:0", { onSettled: settledLow, priority: "low" });
  loadRadarTile(high as unknown as HTMLImageElement, "high:0", {
    crossOrigin: "anonymous",
    onSettled: settledHigh,
    priority: "high",
  });
  expect(activeRadarTileLoads()).toBe(MAX_CONCURRENT_RADAR_TILES);
  expect(queuedRadarTileLoads()).toBe(2);
  expect(high.src).toBe("");
  expect(low.src).toBe("");

  active[0].emit("load");
  expect(high.src).toBe("high:0");
  expect(high.attrs.crossorigin).toBe("anonymous");
  expect(low.src).toBe("");

  high.emit("load");
  expect(settledHigh).toHaveBeenCalledWith(true);
  expect(low.src).toBe("low:0");

  low.emit("error");
  expect(settledLow).toHaveBeenCalledWith(false);
  resetRadarTileQueue();
});
