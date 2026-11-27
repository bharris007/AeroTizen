import type { RadarFrame } from "../../contracts/radarMap";

// Public RainViewer maps API: https://www.rainviewer.com/api.html
export const RAIN_VIEWER_MAPS_URL = "https://api.rainviewer.com/public/weather-maps.json";
// Scheme 2 is RainViewer's blue-to-red scale with server-side smooth edges and snow.
export const RADAR_COLOR_SCHEME = 2;
export const RADAR_IMAGE_OPTIONS = "1_1";
// Single-image caps: keeps each decoded image ~1.0-1.44 MB RGBA so total radar RAM stays well under 20 MB on Tizen.
export const MAX_RADAR_IMAGE_WIDTH = 960;
export const MAX_RADAR_IMAGE_HEIGHT = 540;
export const RADAR_TARGET_IMAGE_WIDTH = 800;
export const RADAR_TARGET_IMAGE_HEIGHT = 450;
export const RAIN_VIEWER_SINGLE_SIZE = 512;
export const RADAR_MAX_VIEWPORT_WIDTH = 1920;
export const RADAR_MAX_VIEWPORT_HEIGHT = 1080;
// RainViewer single centered 512px images natively cover rvZoom 3..7 (UI zoom 4..8).
export const RAIN_VIEWER_MAX_ZOOM = 7;
export const RAIN_VIEWER_SINGLE_MAX_UI_ZOOM = 8;
export const RADAR_CARD_ZOOM = 7;

const EARTH_RADIUS_METERS = 6_378_137;
const WORLD_METERS = 2 * Math.PI * EARTH_RADIUS_METERS;
const ESRI_DARK_EXPORT =
  "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/export";
const IEM_NEXRAD_WMS = "https://mesonet.agron.iastate.edu/cgi-bin/wms/nexrad/n0q.cgi";
const MAX_PROJECTED_LATITUDE = 85;
const MARKER_EDGE_MARGIN_PERCENT = 4;
const HTTPS_HOST = /^https:\/\/[a-z0-9.-]+$/i;
const RADAR_PATH = /^\/v2\/radar\/[A-Za-z0-9_-]+$/;

// Continental US NEXRAD coverage, including Alaska and Hawaii. Iowa State serves single WMS PNGs with no key.
const NEXRAD_MIN_LATITUDE = 17;
const NEXRAD_MAX_LATITUDE = 72;
const NEXRAD_MIN_LONGITUDE = -168;
const NEXRAD_MAX_LONGITUDE = -64;

// Oldest to newest. "now" is the live composite; each step is 10 minutes (6 frames total).
export const NEXRAD_FRAMES = ["m50m", "m40m", "m30m", "m20m", "m10m", "now"] as const;

export interface MapPoint {
  readonly x: number;
  readonly y: number;
}

export interface RadarImageBox {
  readonly heightPercent: number;
  readonly leftPercent: number;
  readonly topPercent: number;
  readonly widthPercent: number;
}

export interface RadarImageSize {
  readonly height: number;
  readonly width: number;
}

export interface RadarMarkerPoint {
  readonly leftPercent: number;
  readonly topPercent: number;
  readonly visible: boolean;
}

export interface RadarOverlay {
  readonly kind: "nexrad" | "rainviewer";
  readonly rvZoom: number;
}

export interface RadarViewportBbox {
  readonly east: number;
  readonly north: number;
  readonly south: number;
  readonly spanMeters: number;
  readonly viewHeightMeters: number;
  readonly viewWidthMeters: number;
  readonly west: number;
}

const finiteFrame = (value: unknown): { path: string; time: number } | null => {
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

// Web Mercator in unit tile coordinates at this zoom (used by radarView pan steps).
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

// Web Mercator (EPSG:3857) coordinates in meters for exact single-image bbox alignment.
export const projectMercatorMeters = (latitude: number, longitude: number): MapPoint => {
  const clamped = Math.max(-MAX_PROJECTED_LATITUDE, Math.min(MAX_PROJECTED_LATITUDE, latitude));
  const latRad = (clamped * Math.PI) / 180;
  const lonRad = (longitude * Math.PI) / 180;
  return {
    x: lonRad * EARTH_RADIUS_METERS,
    y: Math.log(Math.tan(Math.PI / 4 + latRad / 2)) * EARTH_RADIUS_METERS,
  };
};

// Bounded single-image request size (<= 800x450 target, always <= 960x540) preserving container aspect ratio.
export const boundedRadarImageSize = (width: number, height: number): RadarImageSize => {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return { height: 0, width: 0 };
  }
  const safeWidth = Math.min(width, RADAR_MAX_VIEWPORT_WIDTH);
  const safeHeight = Math.min(height, RADAR_MAX_VIEWPORT_HEIGHT);
  const scale = Math.min(1, RADAR_TARGET_IMAGE_WIDTH / safeWidth, RADAR_TARGET_IMAGE_HEIGHT / safeHeight);
  return {
    height: Math.max(1, Math.min(MAX_RADAR_IMAGE_HEIGHT, Math.round(safeHeight * scale))),
    width: Math.max(1, Math.min(MAX_RADAR_IMAGE_WIDTH, Math.round(safeWidth * scale))),
  };
};

export const nexradCovers = (latitude: number, longitude: number) =>
  latitude >= NEXRAD_MIN_LATITUDE &&
  latitude <= NEXRAD_MAX_LATITUDE &&
  longitude >= NEXRAD_MIN_LONGITUDE &&
  longitude <= NEXRAD_MAX_LONGITUDE;

// UI zoom 4..8 maps to RainViewer single centered 512px images (rvZoom 3..7).
// Above zoom 8 in the US, use IEM NEXRAD single WMS PNGs; elsewhere scale rvZoom 7.
export const radarOverlay = (zoom: number, latitude: number, longitude: number): RadarOverlay => {
  const rvZoom = Math.max(3, Math.min(RAIN_VIEWER_MAX_ZOOM, Math.round(zoom) - 1));
  if (zoom > RAIN_VIEWER_SINGLE_MAX_UI_ZOOM && nexradCovers(latitude, longitude)) {
    return { kind: "nexrad", rvZoom };
  }
  return { kind: "rainviewer", rvZoom };
};

// Exact EPSG:3857 bounding box matching the viewport aspect ratio and centered on (latitude, longitude).
export const radarViewportBbox = (
  latitude: number,
  longitude: number,
  zoom: number,
  width: number,
  height: number,
): RadarViewportBbox | null => {
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    !Number.isFinite(zoom) ||
    width <= 0 ||
    height <= 0
  ) {
    return null;
  }
  const center = projectMercatorMeters(latitude, longitude);
  const spanMeters = WORLD_METERS / 2 ** Math.max(1, zoom - 1);
  const landscape = width >= height;
  const viewWidthMeters = landscape ? spanMeters : spanMeters * (width / height);
  const viewHeightMeters = landscape ? spanMeters * (height / width) : spanMeters;
  return {
    east: center.x + viewWidthMeters / 2,
    north: center.y + viewHeightMeters / 2,
    south: center.y - viewHeightMeters / 2,
    spanMeters,
    viewHeightMeters,
    viewWidthMeters,
    west: center.x - viewWidthMeters / 2,
  };
};

const formatBbox = (bbox: RadarViewportBbox) =>
  [bbox.west, bbox.south, bbox.east, bbox.north].map((value) => value.toFixed(1)).join(",");

// One single muted dark basemap JPEG (~20 KB) for the exact viewport bbox and bounded size.
export const baseMapImageUrl = (bbox: RadarViewportBbox, size: RadarImageSize) =>
  ESRI_DARK_EXPORT +
  "?bbox=" +
  formatBbox(bbox) +
  "&bboxSR=3857&imageSR=3857&size=" +
  size.width +
  "," +
  size.height +
  "&format=jpg&f=image";

// One single 512x512 smooth RainViewer composite PNG centered on (latitude, longitude).
export const rainViewerSingleImageUrl = (
  host: string,
  path: string,
  rvZoom: number,
  latitude: number,
  longitude: number,
) =>
  host +
  path +
  "/" +
  RAIN_VIEWER_SINGLE_SIZE +
  "/" +
  rvZoom +
  "/" +
  latitude.toFixed(4) +
  "/" +
  longitude.toFixed(4) +
  "/" +
  RADAR_COLOR_SCHEME +
  "/" +
  RADAR_IMAGE_OPTIONS +
  ".png";

// One single transparent NEXRAD composite PNG from Iowa State WMS matching the exact bbox and bounded size.
export const nexradSingleImageUrl = (
  frame: (typeof NEXRAD_FRAMES)[number],
  bbox: RadarViewportBbox,
  size: RadarImageSize,
) => {
  const layer = frame === "now" ? "nexrad-n0q-900913" : "nexrad-n0q-900913-" + frame;
  return (
    IEM_NEXRAD_WMS +
    "?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=" +
    layer +
    "&SRS=EPSG:3857&BBOX=" +
    formatBbox(bbox) +
    "&WIDTH=" +
    size.width +
    "&HEIGHT=" +
    size.height +
    "&FORMAT=image/png&TRANSPARENT=TRUE"
  );
};

// Pure percentage box aligning the single radar <img> pixel-for-pixel over the Esri basemap without CSS transforms.
export const radarImagePlacement = (overlay: RadarOverlay, bbox: RadarViewportBbox): RadarImageBox => {
  if (overlay.kind === "nexrad") {
    return { heightPercent: 100, leftPercent: 0, topPercent: 0, widthPercent: 100 };
  }
  const tileMeters = WORLD_METERS / 2 ** overlay.rvZoom;
  const widthPercent = (tileMeters / bbox.viewWidthMeters) * 100;
  const heightPercent = (tileMeters / bbox.viewHeightMeters) * 100;
  return {
    heightPercent,
    leftPercent: (100 - widthPercent) / 2,
    topPercent: (100 - heightPercent) / 2,
    widthPercent,
  };
};

// Geographic location marker as percentages inside the current bbox (stays accurate after panning).
export const radarMarkerPercent = (
  latitude: number,
  longitude: number,
  bbox: RadarViewportBbox | null,
): RadarMarkerPoint => {
  if (!bbox || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return { leftPercent: 0, topPercent: 0, visible: false };
  }
  const point = projectMercatorMeters(latitude, longitude);
  let dx = point.x - (bbox.west + bbox.viewWidthMeters / 2);
  while (dx > WORLD_METERS / 2) {
    dx -= WORLD_METERS;
  }
  while (dx < -WORLD_METERS / 2) {
    dx += WORLD_METERS;
  }
  const leftPercent = ((dx + bbox.viewWidthMeters / 2) / bbox.viewWidthMeters) * 100;
  const topPercent = ((bbox.north - point.y) / bbox.viewHeightMeters) * 100;
  const visible =
    leftPercent >= -MARKER_EDGE_MARGIN_PERCENT &&
    leftPercent <= 100 + MARKER_EDGE_MARGIN_PERCENT &&
    topPercent >= -MARKER_EDGE_MARGIN_PERCENT &&
    topPercent <= 100 + MARKER_EDGE_MARGIN_PERCENT;
  return { leftPercent, topPercent, visible };
};

const readFrames = (value: unknown, kind: RadarFrame["kind"]) => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map(finiteFrame)
    .filter((frame): frame is { path: string; time: number } => frame !== null)
    .map((frame) => ({ kind, path: frame.path, time: frame.time }));
};

// Observed frames, then any nowcast frames RainViewer included. The catalog sometimes has none.
export const parseRainViewerMaps = (
  data: unknown,
): { frames: readonly RadarFrame[]; generated: number; host: string } | null => {
  if (!data || typeof data !== "object") {
    return null;
  }
  const body = data as { generated?: unknown; host?: unknown; radar?: { nowcast?: unknown; past?: unknown } };
  const host = typeof body.host === "string" ? body.host.replace(/\/+$/, "") : "";
  if (!HTTPS_HOST.test(host)) {
    return null;
  }
  const past = readFrames(body.radar?.past, "past").sort((first, second) => first.time - second.time);
  if (past.length === 0) {
    return null;
  }
  const seen = new Set(past.map((frame) => frame.time));
  const forecast = readFrames(body.radar?.nowcast, "forecast")
    .filter((frame) => !seen.has(frame.time))
    .sort((first, second) => first.time - second.time);
  return {
    frames: Object.freeze([...past, ...forecast]),
    generated: typeof body.generated === "number" && Number.isFinite(body.generated) ? body.generated : 0,
    host,
  };
};
