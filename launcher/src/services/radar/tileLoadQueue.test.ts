import { expect, test, vi } from "vitest";

import { loadRadarTile, MAX_CONCURRENT_RADAR_TILES, resetRadarTileQueue } from "./tileLoadQueue";

const image = () => {
  const listeners: Record<string, () => void> = {};
  return {
    addEventListener(type: string, handler: () => void) {
      listeners[type] = handler;
    },
    removeEventListener(type: string) {
      delete listeners[type];
    },
    removeAttribute(name: string) {
      if (name === "src") {
        this.src = "";
      }
    },
    setAttribute(name: string, value: string) {
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
