import { expect, test } from "vitest";

import { FRANKLIN_LATITUDE, FRANKLIN_LONGITUDE } from "../family/familyLocation";

import {
  baseTileUrl,
  MAX_RADAR_TILES,
  nexradCovers,
  nexradTileUrl,
  parseRainViewerMaps,
  projectRadar,
  RADAR_CARD_ZOOM,
  RADAR_TILE_SIZE,
  radarMarkerPosition,
  radarOverlay,
  radarTileUrl,
  tilesForLimitedView,
  tilesForView,
  unprojectRadar,
} from "./rainViewer";

const frame = (time: number, path = "/v2/radar/" + time.toString(16)) => ({ path, time });

test("keeps every observed frame and any nowcast, and rejects a map that is not a RainViewer host", () => {
  const past = Array.from({ length: 13 }, (_, index) => frame(1_000 + index * 600));
  const parsed = parseRainViewerMaps({
    generated: 1_000 + 12 * 600,
    host: "https://tilecache.rainviewer.com/",
    radar: { nowcast: [frame(9_999, "/v2/radar/nowcast_1")], past },
  });
  expect(parsed?.host).toBe("https://tilecache.rainviewer.com");
  expect(parsed?.generated).toBe(1_000 + 12 * 600);
  expect(parsed?.frames.map((item) => item.kind + ":" + item.time)).toEqual([
    ...past.map((item) => "past:" + item.time),
    "forecast:9999",
  ]);

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
  const roundTrip = unprojectRadar(point.x, point.y, RADAR_CARD_ZOOM);
  expect(roundTrip.latitude).toBeCloseTo(FRANKLIN_LATITUDE, 4);
  expect(roundTrip.longitude).toBeCloseTo(FRANKLIN_LONGITUDE, 4);
});

test("zooms past RainViewer with NEXRAD in the US and scaled radar tiles elsewhere", () => {
  const unitedStates = radarOverlay(9, FRANKLIN_LATITUDE, FRANKLIN_LONGITUDE);
  expect(unitedStates).toEqual({ kind: "nexrad", tileSize: RADAR_TILE_SIZE, tileZoom: 9 });
  expect(nexradCovers(51.5, -0.1)).toBe(false);
  const london = radarOverlay(9, 51.5, -0.1);
  expect(london).toEqual({ kind: "rainviewer", tileSize: RADAR_TILE_SIZE * 4, tileZoom: 7 });
  const view = tilesForView(51.5, -0.1, 9, 800, 600, london.tileZoom);
  expect(view.tiles[0]?.size).toBe(RADAR_TILE_SIZE * 4);
  expect(nexradTileUrl("m20m", 9, { x: 132, y: 201 })).toBe(
    "https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/nexrad-n0q-900913-m20m/9/132/201.png",
  );
  expect(nexradTileUrl("now", 9, { x: 1, y: 2 })).toContain("/nexrad-n0q-900913/9/1/2.png");
});

test("caps a 4K viewport with coarser tiles so one layer stays under the TV-safe limit", () => {
  const uncapped = tilesForView(FRANKLIN_LATITUDE, FRANKLIN_LONGITUDE, RADAR_CARD_ZOOM, 3840, 2160);
  expect(uncapped.tiles.length).toBeGreaterThan(MAX_RADAR_TILES);
  const limited = tilesForLimitedView(FRANKLIN_LATITUDE, FRANKLIN_LONGITUDE, RADAR_CARD_ZOOM, 3840, 2160);
  expect(limited.tiles.length).toBeGreaterThan(0);
  expect(limited.tiles.length).toBeLessThanOrEqual(MAX_RADAR_TILES);
  expect(limited.tileZoom).toBeLessThan(RADAR_CARD_ZOOM);
  const modest = tilesForLimitedView(FRANKLIN_LATITUDE, FRANKLIN_LONGITUDE, RADAR_CARD_ZOOM, 800, 600);
  expect(modest.tiles.length).toBe(
    tilesForView(FRANKLIN_LATITUDE, FRANKLIN_LONGITUDE, RADAR_CARD_ZOOM, 800, 600).tiles.length,
  );
  expect(modest.tileZoom).toBe(RADAR_CARD_ZOOM);
  const centerX = 1920;
  const centerY = 1080;
  const covering = limited.tiles.filter(
    (tile) =>
      centerX >= tile.left && centerX < tile.left + tile.size && centerY >= tile.top && centerY < tile.top + tile.size,
  );
  expect(covering).toHaveLength(1);
});

test("projects the location dot to its true geographic position even after panning", () => {
  const centered = tilesForView(FRANKLIN_LATITUDE, FRANKLIN_LONGITUDE, RADAR_CARD_ZOOM, 800, 600);
  const atCenter = radarMarkerPosition(
    FRANKLIN_LATITUDE,
    FRANKLIN_LONGITUDE,
    RADAR_CARD_ZOOM,
    centered.originLeft,
    centered.originTop,
    800,
    600,
  );
  expect(atCenter.visible).toBe(true);
  expect(atCenter.left).toBeCloseTo(400, 0);
  expect(atCenter.top).toBeCloseTo(300, 0);

  // Panning east moves Franklin's dot to the left of center.
  const pannedEast = tilesForView(FRANKLIN_LATITUDE, FRANKLIN_LONGITUDE + 1.5, RADAR_CARD_ZOOM, 800, 600);
  const shifted = radarMarkerPosition(
    FRANKLIN_LATITUDE,
    FRANKLIN_LONGITUDE,
    RADAR_CARD_ZOOM,
    pannedEast.originLeft,
    pannedEast.originTop,
    800,
    600,
  );
  expect(shifted.visible).toBe(true);
  expect(shifted.left).toBeLessThan(400);

  // Panning far away hides the marker cleanly.
  const farAway = tilesForView(51.5, -0.1, RADAR_CARD_ZOOM, 800, 600);
  const hidden = radarMarkerPosition(
    FRANKLIN_LATITUDE,
    FRANKLIN_LONGITUDE,
    RADAR_CARD_ZOOM,
    farAway.originLeft,
    farAway.originTop,
    800,
    600,
  );
  expect(hidden.visible).toBe(false);
});
