import { expect, test } from "vitest";

import { FRANKLIN_LATITUDE, FRANKLIN_LONGITUDE } from "../family/familyLocation";

import { clampRadarZoom, moveRadarCenter, RADAR_DEFAULT_ZOOM, RADAR_MAX_ZOOM, radarViewport } from "./radarView";

const franklin = { latitude: FRANKLIN_LATITUDE, longitude: FRANKLIN_LONGITUDE };

test("starts on the weather place and restores a saved view only for that place", () => {
  expect(radarViewport(null, franklin)).toEqual({ ...franklin, zoom: RADAR_DEFAULT_ZOOM });
  const saved = {
    latitude: 36.2,
    longitude: -86.4,
    placeLatitude: FRANKLIN_LATITUDE,
    placeLongitude: FRANKLIN_LONGITUDE,
    zoom: 9,
  };
  expect(radarViewport(saved, franklin)).toEqual({ latitude: 36.2, longitude: -86.4, zoom: 9 });
  expect(radarViewport(saved, { latitude: 51.5, longitude: -0.12 })).toEqual({
    latitude: 51.5,
    longitude: -0.12,
    zoom: RADAR_DEFAULT_ZOOM,
  });
  expect(clampRadarZoom(99)).toBe(RADAR_MAX_ZOOM);
  expect(clampRadarZoom(1)).toBe(4);
});

test("pans east and north from the center", () => {
  const east = moveRadarCenter(FRANKLIN_LATITUDE, FRANKLIN_LONGITUDE, 7, 1, 0);
  const north = moveRadarCenter(FRANKLIN_LATITUDE, FRANKLIN_LONGITUDE, 7, 0, -1);
  expect(east.longitude).toBeGreaterThan(FRANKLIN_LONGITUDE);
  expect(north.latitude).toBeGreaterThan(FRANKLIN_LATITUDE);
  expect(east.latitude).toBeCloseTo(FRANKLIN_LATITUDE, 1);
});