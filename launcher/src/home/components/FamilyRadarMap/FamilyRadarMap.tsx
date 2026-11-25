import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "preact/hooks";

import {
  baseTileUrl,
  NEXRAD_FRAMES,
  nexradTileUrl,
  radarOverlay,
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
  const overlay = radarOverlay(zoom, latitude, longitude);
  const nexrad = overlay.kind === "nexrad";
  const frameCount = nexrad ? NEXRAD_FRAMES.length : map.frames.length;
  const animate = enabled && !performanceMode && !reduceMotion && frameCount > 1;
  useEffect(() => {
    if (!animate) {
      return;
    }
    const timer = window.setInterval(() => {
      setIndex((current) => current + 1);
    }, RADAR_FRAME_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [animate]);
  const baseTiles = useMemo(() => {
    if (!enabled || size.width <= 0 || size.height <= 0) {
      return NO_TILES;
    }
    return tilesForView(latitude, longitude, zoom, size.width, size.height).tiles;
  }, [enabled, latitude, longitude, size.height, size.width, zoom]);
  const radarTiles = useMemo(() => {
    if (!enabled || size.width <= 0 || size.height <= 0) {
      return NO_TILES;
    }
    return tilesForView(latitude, longitude, zoom, size.width, size.height, overlay.tileZoom).tiles;
  }, [enabled, latitude, longitude, overlay.tileZoom, size.height, size.width, zoom]);
  const shownIndex = (() => {
    if (frameCount === 0) {
      return 0;
    }
    if (!animate) {
      return frameCount - 1;
    }
    return index % frameCount;
  })();
  const shownFrame = nexrad || map.frames.length === 0 ? null : map.frames[shownIndex];
  const nexradFrame = nexrad ? NEXRAD_FRAMES[shownIndex] : null;
  useEffect(() => {
    if (!animate || radarTiles.length === 0) {
      return;
    }
    const nextIndex = (shownIndex + 1) % Math.max(frameCount, 1);
    const preloaded = radarTiles.map((tile) => {
      const image = new Image();
      if (nexrad) {
        image.src = nexradTileUrl(NEXRAD_FRAMES[nextIndex] ?? "now", overlay.tileZoom, tile);
      } else if (map.frames[nextIndex]) {
        image.src = radarTileUrl(map.host, map.frames[nextIndex].path, overlay.tileZoom, tile);
      }
      return image;
    });
    return () => {
      preloaded.splice(0, preloaded.length);
    };
  }, [animate, frameCount, map.frames, map.host, nexrad, overlay.tileZoom, radarTiles, shownIndex]);
  const statusText = (() => {
    if (nexrad || map.frames.length > 0) {
      return "";
    }
    if (map.status === "unavailable") {
      return t("family.radarUnavailable");
    }
    return map.status === "loading" ? t("family.radarLoading") : "";
  })();
  const radarSrc = (tile: RadarTile) => {
    if (nexradFrame) {
      return nexradTileUrl(nexradFrame, overlay.tileZoom, tile);
    }
    if (shownFrame) {
      return radarTileUrl(map.host, shownFrame.path, overlay.tileZoom, tile);
    }
    return "";
  };
  return (
    <div
      class={styles.map}
      ref={frame}
      data-family-radar-map
      data-family-radar-status={nexrad || map.frames.length > 0 ? "ready" : map.status}
      data-radar-frame={shownFrame ? shownFrame.time : nexradFrame || undefined}
      data-radar-source={overlay.kind}
      data-radar-zoom={zoom}
    >
      <div class={styles.layers} aria-hidden="true">
        {baseTiles.map((tile) => (
          <img
            key={"base:" + tile.left + ":" + tile.top}
            class={styles.image + " " + styles.tile}
            alt=""
            src={baseTileUrl(zoom, tile)}
            style={{ height: tile.size + "px", left: tile.left + "px", top: tile.top + "px", width: tile.size + "px" }}
          />
        ))}
        {radarTiles.map((tile) =>
          radarSrc(tile) ? (
            <img
              key={"radar:" + tile.left + ":" + tile.top + ":" + tile.size}
              class={styles.image + " " + styles.tile}
              alt=""
              src={radarSrc(tile)}
              style={{
                height: tile.size + "px",
                left: tile.left + "px",
                top: tile.top + "px",
                width: tile.size + "px",
              }}
            />
          ) : null,
        )}
        {baseTiles.length > 0 ? <div class={styles.marker} data-family-radar-marker /> : null}
      </div>
      {label ? <div class={styles.place + " " + text.truncate}>{label}</div> : null}
      <p class={styles.credit}>{t(nexrad ? "family.radarCreditNexrad" : "family.radarCredit")}</p>
      {statusText ? <p class={styles.status}>{statusText}</p> : null}
    </div>
  );
};
