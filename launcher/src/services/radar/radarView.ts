import type { RadarView } from "../../contracts/preferences";

import { projectRadar, RADAR_CARD_ZOOM, unprojectRadar } from "./rainViewer";

export const RADAR_MIN_ZOOM = 4;
export const RADAR_MAX_ZOOM = 10;
export const RADAR_DEFAULT_ZOOM = RADAR_CARD_ZOOM;
// One press moves about a fifth of the full-screen map.
const PAN_TILES = 1.5;
const MAX_LATITUDE = 85;
const SAME_PLACE_DEGREES = 0.0001;

export interface RadarPlace {
  readonly latitude: number;
  readonly longitude: number;
}

export interface RadarViewport {
  readonly latitude: number;
  readonly longitude: number;
  readonly zoom: number;
}

const wrapLongitude = (longitude: number) => ((((longitude + 180) % 360) + 360) % 360) - 180;
const roundCoordinate = (value: number) => Math.round(value * 1e5) / 1e5;

export const clampRadarZoom = (zoom: number) => Math.max(RADAR_MIN_ZOOM, Math.min(RADAR_MAX_ZOOM, Math.round(zoom)));

const samePlace = (saved: RadarView, place: RadarPlace) =>
  Math.abs(saved.placeLatitude - place.latitude) <= SAME_PLACE_DEGREES &&
  Math.abs(saved.placeLongitude - place.longitude) <= SAME_PLACE_DEGREES;

// A saved view belongs to the weather place it was made for. A different city starts centered again.
export const radarViewport = (saved: RadarView | null | undefined, place: RadarPlace): RadarViewport => {
  if (!saved || !samePlace(saved, place)) {
    return { latitude: place.latitude, longitude: place.longitude, zoom: RADAR_DEFAULT_ZOOM };
  }
  return {
    latitude: saved.latitude,
    longitude: saved.longitude,
    zoom: clampRadarZoom(saved.zoom),
  };
};

// x is -1 or 1 for west/east. y is -1 or 1 for north/south. Screen up is north.
export const moveRadarCenter = (
  latitude: number,
  longitude: number,
  zoom: number,
  x: number,
  y: number,
): RadarPlace => {
  const point = projectRadar(latitude, longitude, zoom);
  const next = unprojectRadar(point.x + x * PAN_TILES, point.y + y * PAN_TILES, zoom);
  return {
    latitude: roundCoordinate(Math.max(-MAX_LATITUDE, Math.min(MAX_LATITUDE, next.latitude))),
    longitude: roundCoordinate(wrapLongitude(next.longitude)),
  };
};
