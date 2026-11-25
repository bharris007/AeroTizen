import type { RadarFrame } from "../../contracts/radarMap";

// Public RainViewer maps API: https://www.rainviewer.com/api.html
export const RAIN_VIEWER_MAPS_URL = "https://api.rainviewer.com/public/weather-maps.json";
export const RADAR_TILE_SIZE = 256;
// Scheme 2 is the blue-to-red scale from RainViewer's tile example, with smooth edges and snow.
export const RADAR_COLOR_SCHEME = 2;
export const RADAR_TILE_OPTIONS = "1_1";
// RainViewer composite radar is a placeholder above this zoom.
export const RAIN_VIEWER_MAX_ZOOM = 7;
// Default view until the user zooms. The card and the full screen share a saved zoom.
export const RADAR_CARD_ZOOM = RAIN_VIEWER_MAX_ZOOM;
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
  readonly size: number;
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

export const unprojectRadar = (x: number, y: number, zoom: number): { latitude: number; longitude: number } => {
  const scale = 2 ** zoom;
  const longitude = (x / scale) * 360 - 180;
  const mercator = Math.PI - (2 * Math.PI * y) / scale;
  const latitude = (180 / Math.PI) * Math.atan(Math.sinh(mercator));
  return { latitude, longitude };
};

// tileZoom can be coarser than the view zoom. Those tiles are drawn larger so the map can
// zoom past a source that has no native tiles there.
export const tilesForView = (
  latitude: number,
  longitude: number,
  zoom: number,
  width: number,
  height: number,
  tileZoom = zoom,
): RadarTileView => {
  const sourceZoom = Number.isInteger(tileZoom) && tileZoom >= 0 && tileZoom <= zoom ? tileZoom : zoom;
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
  const tileSize = RADAR_TILE_SIZE * 2 ** (zoom - sourceZoom);
  const maxIndex = 2 ** sourceZoom;
  const firstX = Math.floor(left / tileSize);
  const lastX = Math.floor((left + width - 1) / tileSize);
  const firstY = Math.floor(top / tileSize);
  const lastY = Math.floor((top + height - 1) / tileSize);
  const tiles: RadarTile[] = [];
  for (let y = firstY; y <= lastY; y += 1) {
    if (y < 0 || y >= maxIndex) {
      continue;
    }
    for (let x = firstX; x <= lastX; x += 1) {
      const wrapped = ((x % maxIndex) + maxIndex) % maxIndex;
      tiles.push({
        left: x * tileSize - left,
        size: tileSize,
        top: y * tileSize - top,
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

// Continental US NEXRAD, including Alaska and Hawaii. Iowa State serves these tiles with no key.
const NEXRAD_MIN_LATITUDE = 17;
const NEXRAD_MAX_LATITUDE = 72;
const NEXRAD_MIN_LONGITUDE = -168;
const NEXRAD_MAX_LONGITUDE = -64;
const NEXRAD_TILE_ROOT = "https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/nexrad-n0q-900913";
// Oldest to newest. "now" is the live composite. Each step is about ten minutes.
export const NEXRAD_FRAMES = ["m50m", "m40m", "m30m", "m20m", "m10m", "now"] as const;

export interface RadarOverlay {
  readonly kind: "nexrad" | "rainviewer";
  readonly tileSize: number;
  readonly tileZoom: number;
}

export const nexradCovers = (latitude: number, longitude: number) =>
  latitude >= NEXRAD_MIN_LATITUDE &&
  latitude <= NEXRAD_MAX_LATITUDE &&
  longitude >= NEXRAD_MIN_LONGITUDE &&
  longitude <= NEXRAD_MAX_LONGITUDE;

// Above RainViewer's last real zoom, US views use NEXRAD tiles. Everywhere else the zoom-7
// radar is scaled up so the control still zooms, with a softer image.
export const radarOverlay = (zoom: number, latitude: number, longitude: number): RadarOverlay => {
  if (zoom > RAIN_VIEWER_MAX_ZOOM && nexradCovers(latitude, longitude)) {
    return { kind: "nexrad", tileSize: RADAR_TILE_SIZE, tileZoom: zoom };
  }
  const tileZoom = Math.max(0, Math.min(zoom, RAIN_VIEWER_MAX_ZOOM));
  return { kind: "rainviewer", tileSize: RADAR_TILE_SIZE * 2 ** (zoom - tileZoom), tileZoom };
};

export const nexradTileUrl = (
  frame: (typeof NEXRAD_FRAMES)[number],
  zoom: number,
  tile: Pick<RadarTile, "x" | "y">,
) => {
  const layer = frame === "now" ? NEXRAD_TILE_ROOT : NEXRAD_TILE_ROOT + "-" + frame;
  return layer + "/" + zoom + "/" + tile.x + "/" + tile.y + ".png";
};

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
