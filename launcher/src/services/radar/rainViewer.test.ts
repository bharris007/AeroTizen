import { expect, test } from "vitest";

import { FRANKLIN_LATITUDE, FRANKLIN_LONGITUDE } from "../family/familyLocation";

import {
  baseMapImageUrl,
  boundedRadarImageSize,
  MAX_RADAR_IMAGE_HEIGHT,
  MAX_RADAR_IMAGE_WIDTH,
  nexradCovers,
  nexradSingleImageUrl,
  parseRainViewerMaps,
  projectRadar,
  RADAR_CARD_ZOOM,
  radarImagePlacement,
  radarMarkerPercent,
  radarOverlay,
  radarViewportBbox,
  RAIN_VIEWER_SINGLE_SIZE,
  rainViewerSingleImageUrl,
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

test("builds single bounded basemap and RainViewer composite URLs aligned on Franklin", () => {
  const size = boundedRadarImageSize(1920, 1080);
  expect(size.width).toBeLessThanOrEqual(MAX_RADAR_IMAGE_WIDTH);
  expect(size.height).toBeLessThanOrEqual(MAX_RADAR_IMAGE_HEIGHT);
  expect(size).toEqual({ height: 450, width: 800 });

  // Even on a 4K screen, image requests remain capped well below 960x540.
  const fourK = boundedRadarImageSize(3840, 2160);
  expect(fourK.width).toBeLessThanOrEqual(MAX_RADAR_IMAGE_WIDTH);
  expect(fourK.height).toBeLessThanOrEqual(MAX_RADAR_IMAGE_HEIGHT);

  const bbox = radarViewportBbox(FRANKLIN_LATITUDE, FRANKLIN_LONGITUDE, RADAR_CARD_ZOOM, 1920, 1080);
  expect(bbox).not.toBeNull();
  const baseUrl = baseMapImageUrl(bbox!, size);
  expect(baseUrl).toContain("World_Dark_Gray_Base/MapServer/export");
  expect(baseUrl).toContain("size=800,450");
  expect(baseUrl).toContain("format=jpg&f=image");

  const overlay = radarOverlay(RADAR_CARD_ZOOM, FRANKLIN_LATITUDE, FRANKLIN_LONGITUDE);
  expect(overlay).toEqual({ kind: "rainviewer", rvZoom: 6 });
  const radarUrl = rainViewerSingleImageUrl(
    "https://tilecache.rainviewer.com",
    "/v2/radar/13f17414a055",
    overlay.rvZoom,
    FRANKLIN_LATITUDE,
    FRANKLIN_LONGITUDE,
  );
  expect(radarUrl).toBe(
    "https://tilecache.rainviewer.com/v2/radar/13f17414a055/" +
      RAIN_VIEWER_SINGLE_SIZE +
      "/6/" +
      FRANKLIN_LATITUDE.toFixed(4) +
      "/" +
      FRANKLIN_LONGITUDE.toFixed(4) +
      "/2/1_1.png",
  );

  // At UI zoom 7 (rvZoom 6) in 16:9, the square RainViewer image matches viewport width 100% and centers vertically.
  const placement = radarImagePlacement(overlay, bbox!);
  expect(placement.widthPercent).toBeCloseTo(100, 3);
  expect(placement.leftPercent).toBeCloseTo(0, 3);
  expect(placement.heightPercent).toBeCloseTo((16 / 9) * 100, 2);
  expect(placement.topPercent).toBeCloseTo((100 - placement.heightPercent) / 2, 2);

  // Round-trip projection helpers used by radarView pan steps remain accurate.
  const point = projectRadar(FRANKLIN_LATITUDE, FRANKLIN_LONGITUDE, RADAR_CARD_ZOOM);
  const roundTrip = unprojectRadar(point.x, point.y, RADAR_CARD_ZOOM);
  expect(roundTrip.latitude).toBeCloseTo(FRANKLIN_LATITUDE, 4);
  expect(roundTrip.longitude).toBeCloseTo(FRANKLIN_LONGITUDE, 4);
  expect(radarViewportBbox(90, 0, 8, 0, 600)).toBeNull();
});

test("uses single NEXRAD WMS PNGs above zoom 8 in the US and scaled RainViewer elsewhere", () => {
  const unitedStates = radarOverlay(9, FRANKLIN_LATITUDE, FRANKLIN_LONGITUDE);
  expect(unitedStates).toEqual({ kind: "nexrad", rvZoom: 7 });
  expect(nexradCovers(51.5, -0.1)).toBe(false);
  const london = radarOverlay(9, 51.5, -0.1);
  expect(london).toEqual({ kind: "rainviewer", rvZoom: 7 });

  const bbox = radarViewportBbox(FRANKLIN_LATITUDE, FRANKLIN_LONGITUDE, 9, 1920, 1080)!;
  const size = boundedRadarImageSize(1920, 1080);
  expect(radarImagePlacement(unitedStates, bbox)).toEqual({
    heightPercent: 100,
    leftPercent: 0,
    topPercent: 0,
    widthPercent: 100,
  });
  const m20 = nexradSingleImageUrl("m20m", bbox, size);
  expect(m20).toContain("LAYERS=nexrad-n0q-900913-m20m");
  expect(m20).toContain("WIDTH=800&HEIGHT=450");
  expect(nexradSingleImageUrl("now", bbox, size)).toContain("LAYERS=nexrad-n0q-900913&");
});

test("projects the location dot to its true geographic percentage even after panning", () => {
  const centered = radarViewportBbox(FRANKLIN_LATITUDE, FRANKLIN_LONGITUDE, RADAR_CARD_ZOOM, 800, 600);
  const atCenter = radarMarkerPercent(FRANKLIN_LATITUDE, FRANKLIN_LONGITUDE, centered);
  expect(atCenter.visible).toBe(true);
  expect(atCenter.leftPercent).toBeCloseTo(50, 2);
  expect(atCenter.topPercent).toBeCloseTo(50, 2);

  // Panning east moves Franklin's dot to the left of center.
  const pannedEast = radarViewportBbox(FRANKLIN_LATITUDE, FRANKLIN_LONGITUDE + 1.5, RADAR_CARD_ZOOM, 800, 600);
  const shifted = radarMarkerPercent(FRANKLIN_LATITUDE, FRANKLIN_LONGITUDE, pannedEast);
  expect(shifted.visible).toBe(true);
  expect(shifted.leftPercent).toBeLessThan(50);

  // Panning far away hides the marker cleanly.
  const farAway = radarViewportBbox(51.5, -0.1, RADAR_CARD_ZOOM, 800, 600);
  const hidden = radarMarkerPercent(FRANKLIN_LATITUDE, FRANKLIN_LONGITUDE, farAway);
  expect(hidden.visible).toBe(false);
});
