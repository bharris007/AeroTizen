import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "preact/hooks";

import {
  baseTileUrl,
  RADAR_TILE_SIZE,
  type RadarTile,
  radarTileUrl,
  tilesForView,
} from "../../../services/radar/rainViewer";
import { useStore, useStoreSelector } from "../../../shared/hooks/useStore";
import { useTranslation } from "../../../shared/i18n/useTranslation";
import text from "../../../shared/styles/text.module.css";
import type { HomeEnvironment } from "../../types";

import styles from "./FamilyRadarMap.module.css";

const RADAR_FRAME_INTERVAL_MS = 700;
const MEASURE_ATTEMPTS = 2;
const NO_TILES: readonly RadarTile[] = Object.freeze([]);

const prefersReducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;

// Live precipitation over a dark map. Coordinates come from the family forecast, which
// uses the saved weather place or Franklin, Tennessee when that place is missing.
export const FamilyRadarMap = ({
  enabled,
  env,
  label,
  latitude,
  longitude,
  zoom,
}: {
  enabled: boolean;
  env: HomeEnvironment;
  label: string;
  latitude: number;
  longitude: number;
  zoom: number;
}) => {
  const { t } = useTranslation();
  const performanceMode = useStoreSelector(env.settings, (settings) => settings.performanceMode);
  const map = useStore(env.runtime.radarMap);
  const [reduceMotion] = useState(prefersReducedMotion);
  const [index, setIndex] = useState(0);
  const [size, setSize] = useState({ height: 0, width: 0 });
  const frame = useRef<HTMLDivElement>(null);
  const frameKey = map.frames.map((item) => item.time).join(",");
  useEffect(() => {
    if (!enabled) {
      return;
    }
    return env.runtime.radarMap.watch();
  }, [enabled, env.runtime.radarMap]);
  useLayoutEffect(() => {
    const node = frame.current;
    if (!node || !enabled) {
      return;
    }
    let attempts = 0;
    let frameId = 0;
    const measure = () => {
      const width = node.clientWidth;
      const height = node.clientHeight;
      setSize((current) => (current.width === width && current.height === height ? current : { height, width }));
      if ((width === 0 || height === 0) && attempts < MEASURE_ATTEMPTS) {
        attempts += 1;
        frameId = window.requestAnimationFrame(measure);
      }
    };
    measure();
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("resize", measure);
      window.cancelAnimationFrame(frameId);
    };
  }, [enabled, zoom]);
  useEffect(() => {
    setIndex(0);
  }, [frameKey]);
  const animate = enabled && !performanceMode && !reduceMotion && map.frames.length > 1;
  useEffect(() => {
    if (!animate) {
      return;
    }
    const timer = window.setInterval(() => {
      setIndex((current) => current + 1);
    }, RADAR_FRAME_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [animate]);
  const tiles = useMemo(() => {
    if (!enabled || size.width <= 0 || size.height <= 0) {
      return NO_TILES;
    }
    return tilesForView(latitude, longitude, zoom, size.width, size.height).tiles;
  }, [enabled, latitude, longitude, size.height, size.width, zoom]);
  const shownFrame = (() => {
    if (map.frames.length === 0) {
      return null;
    }
    if (!animate) {
      return map.frames[map.frames.length - 1];
    }
    return map.frames[index % map.frames.length];
  })();
  useEffect(() => {
    if (!animate || map.frames.length < 2 || tiles.length === 0) {
      return;
    }
    const next = map.frames[(index + 1) % map.frames.length];
    // Retain the images for this frame so the next loop step can use the cache.
    const preloaded = tiles.map((tile) => {
      const image = new Image();
      image.src = radarTileUrl(map.host, next.path, zoom, tile);
      return image;
    });
    return () => {
      preloaded.splice(0, preloaded.length);
    };
  }, [animate, index, map.frames, map.host, tiles, zoom]);
  const statusText = (() => {
    if (map.frames.length > 0) {
      return "";
    }
    if (map.status === "unavailable") {
      return t("family.radarUnavailable");
    }
    return map.status === "loading" ? t("family.radarLoading") : "";
  })();
  return (
    <div
      class={styles.map}
      ref={frame}
      data-family-radar-map
      data-family-radar-status={map.frames.length > 0 ? "ready" : map.status}
      data-radar-frame={shownFrame ? shownFrame.time : undefined}
      data-radar-zoom={zoom}
    >
      <div class={styles.layers} aria-hidden="true">
        {tiles.map((tile) => (
          <div
            class={styles.tile}
            key={tile.left + ":" + tile.top}
            style={{
              height: RADAR_TILE_SIZE + "px",
              left: tile.left + "px",
              top: tile.top + "px",
              width: RADAR_TILE_SIZE + "px",
            }}
          >
            <img class={styles.image} alt="" src={baseTileUrl(zoom, tile)} />
            {shownFrame ? (
              <img class={styles.image} alt="" src={radarTileUrl(map.host, shownFrame.path, zoom, tile)} />
            ) : null}
          </div>
        ))}
        {tiles.length > 0 ? <div class={styles.marker} data-family-radar-marker /> : null}
      </div>
      {label ? <div class={styles.place + " " + text.truncate}>{label}</div> : null}
      <p class={styles.credit}>{t("family.radarCredit")}</p>
      {statusText ? <p class={styles.status}>{statusText}</p> : null}
    </div>
  );
};
