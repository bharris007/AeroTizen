import type { RadarFrame } from "../../contracts/radarMap";

// Public RainViewer maps API: https://www.rainviewer.com/api.html
export const RAIN_VIEWER_MAPS_URL = "https://api.rainviewer.com/public/weather-maps.json";
export const RADAR_TILE_SIZE = 256;
// Scheme 2 is the blue-to-red scale from RainViewer's tile example, with smooth edges and snow.
export const RADAR_COLOR_SCHEME = 2;
export const RADAR_TILE_OPTIONS = "1_1";
// Radar tiles above zoom 7 are a "zoom not supported" placeholder. Both views stay at 7;
// the full screen is larger, so it shows more of the same map.
export const RADAR_CARD_ZOOM = 7;
export const RADAR_FULL_ZOOM = 7;
const ESRI_DARK_CANVAS =
  "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/";
export const RADAR_FRAME_LIMIT = 6;
const MAX_PROJECTED_LATITUDE = 85;
const HTTPS_HOST = /^https:\/\/[a-z0-9.-]+$/i;
// Live paths are hashes (`/v2/radar/13f17414a055`), not only the older timestamp form.
const RADAR_PATH = /^\/v2\/radar\/[A-Za-z0-9_-]+$/;

export interface MapPoint {
  readonly x: number;
  readonly y: number;
}

export interface RadarTile {
  readonly left: number;
  readonly top: number;
  readonly x: number;
  readonly y: number;
}

export interface RadarTileView {
  readonly originLeft: number;
  readonly originTop: number;
  readonly tiles: readonly RadarTile[];
}

const EMPTY_VIEW: RadarTileView = Object.freeze({
  originLeft: 0,
  originTop: 0,
  tiles: Object.freeze([]),
});

const finiteFrame = (value: unknown): RadarFrame | null => {
  if (!value || typeof value !== "object") {
    return null;
  }
  const frame = value as { path?: unknown; time?: unknown };
  if (typeof frame.time !== "number" || !Number.isFinite(frame.time)) {
    return null;
  }
  if (typeof frame.path !== "string" || !RADAR_PATH.test(frame.path)) {
    return null;
  }
  return Object.freeze({ path: frame.path, time: frame.time });
};

// Web Mercator, in tile units at this zoom. Latitude is clamped so the poles stay finite.
export const projectRadar = (latitude: number, longitude: number, zoom: number): MapPoint => {
  const scale = 2 ** zoom;
  const clamped = Math.max(-MAX_PROJECTED_LATITUDE, Math.min(MAX_PROJECTED_LATITUDE, latitude));
  const latitudeRadians = (clamped * Math.PI) / 180;
  const x = ((longitude + 180) / 360) * scale;
  const y = ((1 - Math.log(Math.tan(latitudeRadians) + 1 / Math.cos(latitudeRadians)) / Math.PI) / 2) * scale;
  return { x, y };
};

export const tilesForView = (
  latitude: number,
  longitude: number,
  zoom: number,
  width: number,
  height: number,
): RadarTileView => {
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    !Number.isInteger(zoom) ||
    zoom < 0 ||
    zoom > 12 ||
    width <= 0 ||
    height <= 0
  ) {
    return EMPTY_VIEW;
  }
  const point = projectRadar(latitude, longitude, zoom);
  const left = Math.round(point.x * RADAR_TILE_SIZE - width / 2);
  const top = Math.round(point.y * RADAR_TILE_SIZE - height / 2);
  const maxIndex = 2 ** zoom;
  const firstX = Math.floor(left / RADAR_TILE_SIZE);
  const lastX = Math.floor((left + width - 1) / RADAR_TILE_SIZE);
  const firstY = Math.floor(top / RADAR_TILE_SIZE);
  const lastY = Math.floor((top + height - 1) / RADAR_TILE_SIZE);
  const tiles: RadarTile[] = [];
  for (let y = firstY; y <= lastY; y += 1) {
    if (y < 0 || y >= maxIndex) {
      continue;
    }
    for (let x = firstX; x <= lastX; x += 1) {
      const wrapped = ((x % maxIndex) + maxIndex) % maxIndex;
      tiles.push({
        left: x * RADAR_TILE_SIZE - left,
        top: y * RADAR_TILE_SIZE - top,
        x: wrapped,
        y,
      });
    }
  }
  return { originLeft: left, originTop: top, tiles };
};

export const radarTileUrl = (host: string, path: string, zoom: number, tile: Pick<RadarTile, "x" | "y">) =>
  host +
  path +
  "/" +
  RADAR_TILE_SIZE +
  "/" +
  zoom +
  "/" +
  tile.x +
  "/" +
  tile.y +
  "/" +
  RADAR_COLOR_SCHEME +
  "/" +
  RADAR_TILE_OPTIONS +
  ".png";

// Esri's dark canvas is a public no-key basemap. Its tile order is z/y/x.
export const baseTileUrl = (zoom: number, tile: Pick<RadarTile, "x" | "y">) =>
  ESRI_DARK_CANVAS + zoom + "/" + tile.y + "/" + tile.x;

// Keeps the newest observed frames. Nowcast paths are forecasts, so they stay out of the live loop.
export const parseRainViewerMaps = (data: unknown): { frames: readonly RadarFrame[]; host: string } | null => {
  if (!data || typeof data !== "object") {
    return null;
  }
  const body = data as { host?: unknown; radar?: { past?: unknown } };
  const host = typeof body.host === "string" ? body.host.replace(/\/+$/, "") : "";
  if (!HTTPS_HOST.test(host)) {
    return null;
  }
  if (!Array.isArray(body.radar?.past)) {
    return null;
  }
  const frames = body.radar.past
    .map(finiteFrame)
    .filter((frame): frame is RadarFrame => frame !== null)
    .sort((first, second) => first.time - second.time)
    .slice(-RADAR_FRAME_LIMIT);
  if (frames.length === 0) {
    return null;
  }
  return { frames: Object.freeze(frames), host };
};
