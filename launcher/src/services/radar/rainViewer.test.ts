import { expect, test } from "vitest";

import { FRANKLIN_LATITUDE, FRANKLIN_LONGITUDE } from "../family/familyLocation";

import {
  baseTileUrl,
  parseRainViewerMaps,
  projectRadar,
  RADAR_CARD_ZOOM,
  RADAR_FRAME_LIMIT,
  RADAR_TILE_SIZE,
  radarTileUrl,
  tilesForView,
} from "./rainViewer";

const frame = (time: number, path = "/v2/radar/" + time.toString(16)) => ({ path, time });

test("keeps the newest observed frames and rejects a map that is not a RainViewer host", () => {
  const past = Array.from({ length: RADAR_FRAME_LIMIT + 3 }, (_, index) => frame(1_000 + index));
  const parsed = parseRainViewerMaps({
    host: "https://tilecache.rainviewer.com/",
    radar: { nowcast: [frame(9_999, "/v2/radar/nowcast_1")], past },
  });
  expect(parsed?.host).toBe("https://tilecache.rainviewer.com");
  expect(parsed?.frames.map((item) => item.time)).toEqual(past.slice(-RADAR_FRAME_LIMIT).map((item) => item.time));
  expect(parsed?.frames.some((item) => item.path.includes("nowcast"))).toBe(false);

  expect(parseRainViewerMaps({ host: "http://tilecache.rainviewer.com", radar: { past } })).toBeNull();
  expect(parseRainViewerMaps({ host: "https://tilecache.rainviewer.com/extra", radar: { past } })).toBeNull();
  expect(
    parseRainViewerMaps({
      host: "https://tilecache.rainviewer.com",
      radar: { past: [{ path: "https://evil.example/tile", time: 1 }] },
    }),
  ).toBeNull();
  expect(parseRainViewerMaps(null)).toBeNull();
});

test("centers the configured location and builds base and radar tile urls", () => {
  const width = 800;
  const height = 600;
  const view = tilesForView(FRANKLIN_LATITUDE, FRANKLIN_LONGITUDE, RADAR_CARD_ZOOM, width, height);
  const point = projectRadar(FRANKLIN_LATITUDE, FRANKLIN_LONGITUDE, RADAR_CARD_ZOOM);
  expect(point.x * RADAR_TILE_SIZE - view.originLeft).toBeCloseTo(width / 2, 0);
  expect(point.y * RADAR_TILE_SIZE - view.originTop).toBeCloseTo(height / 2, 0);
  const centerX = width / 2;
  const centerY = height / 2;
  const covering = view.tiles.filter(
    (tile) =>
      centerX >= tile.left &&
      centerX < tile.left + RADAR_TILE_SIZE &&
      centerY >= tile.top &&
      centerY < tile.top + RADAR_TILE_SIZE,
  );
  expect(covering).toHaveLength(1);
  expect(view.tiles.length).toBeGreaterThan(0);
  expect(view.tiles.length).toBeLessThan(40);
  const tile = covering[0];
  expect(radarTileUrl("https://tilecache.rainviewer.com", "/v2/radar/13f17414a055", RADAR_CARD_ZOOM, tile)).toBe(
    "https://tilecache.rainviewer.com/v2/radar/13f17414a055/256/" +
      RADAR_CARD_ZOOM +
      "/" +
      tile.x +
      "/" +
      tile.y +
      "/2/1_1.png",
  );
  expect(baseTileUrl(RADAR_CARD_ZOOM, tile)).toBe(
    "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/" +
      RADAR_CARD_ZOOM +
      "/" +
      tile.y +
      "/" +
      tile.x,
  );
  expect(tilesForView(90, 0, 8, 0, 600)).toEqual({ originLeft: 0, originTop: 0, tiles: [] });
  expect(Number.isFinite(projectRadar(89, 179, 3).y)).toBe(true);
});
