import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "preact/hooks";

import {
  baseTileUrl,
  NEXRAD_FRAMES,
  nexradTileUrl,
  radarOverlay,
  type RadarTile,
  radarTileUrl,
  tilesForLimitedView,
} from "../../../services/radar/rainViewer";
import { useStore, useStoreSelector } from "../../../shared/hooks/useStore";
import { useTranslation } from "../../../shared/i18n/useTranslation";
import text from "../../../shared/styles/text.module.css";
import type { HomeEnvironment } from "../../types";

import styles from "./FamilyRadarMap.module.css";
import { FamilyRadarTile } from "./FamilyRadarTile";

export const RADAR_FRAME_INTERVAL_MS = 900;
export const RADAR_CROSSFADE_MS = 560;
const MEASURE_ATTEMPTS = 2;
const NO_TILES: readonly RadarTile[] = Object.freeze([]);

const prefersReducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;

type RadarLayer = { key: string; nexrad: (typeof NEXRAD_FRAMES)[number] | null; path: string | null };

// Live precipitation over a dark map. Coordinates come from the family forecast, which
// uses the saved weather place or Franklin, Tennessee when that place is missing.
export const FamilyRadarMap = ({
  chrome = "card",
  enabled,
  env,
  label,
  latitude,
  longitude,
  playback,
  zoom,
}: {
  chrome?: "card" | "full";
  enabled: boolean;
  env: HomeEnvironment;
  label: string;
  latitude: number;
  longitude: number;
  // Set on the full-screen player. Undefined lets the card loop on its own.
  playback?: { nexrad: (typeof NEXRAD_FRAMES)[number] | null; path: string | null; time: number } | null;
  zoom: number;
}) => {
  const { t } = useTranslation();
  const performanceMode = useStoreSelector(env.settings, (settings) => settings.performanceMode);
  const map = useStore(env.runtime.radarMap);
  const [reduceMotion] = useState(prefersReducedMotion);
  const [index, setIndex] = useState(0);
  const [size, setSize] = useState({ height: 0, width: 0 });
  const [catalogTimedOut, setCatalogTimedOut] = useState(false);
  const [stack, setStack] = useState<{ incoming: RadarLayer | null; outgoing: RadarLayer | null; shown: boolean }>({
    incoming: null,
    outgoing: null,
    shown: true,
  });
  const frame = useRef<HTMLDivElement>(null);
  const frameKey = map.frames.map((item) => item.time).join(",");
  const softFade = !performanceMode && !reduceMotion;
  useEffect(() => {
    if (!enabled) {
      return;
    }
    return env.runtime.radarMap.watch();
  }, [enabled, env.runtime.radarMap]);
  useEffect(() => {
    if (!enabled) {
      setStack({ incoming: null, outgoing: null, shown: true });
    }
  }, [enabled]);
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
  const driven = playback !== undefined;
  const frameCount = nexrad ? NEXRAD_FRAMES.length : map.frames.length;
  const animate = !driven && enabled && !performanceMode && !reduceMotion && frameCount > 1 && map.status === "ready";
  useEffect(() => {
    if (!enabled || nexrad || map.frames.length > 0 || map.status !== "loading") {
      setCatalogTimedOut(false);
      return;
    }
    const timer = window.setTimeout(() => setCatalogTimedOut(true), 8_000);
    return () => window.clearTimeout(timer);
  }, [enabled, map.frames.length, map.status, nexrad]);
  useEffect(() => {
    if (!animate) {
      return;
    }
    const timer = window.setInterval(() => {
      setIndex((current) => current + 1);
    }, RADAR_FRAME_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [animate]);
  const baseView = useMemo(() => {
    if (!enabled || size.width <= 0 || size.height <= 0) {
      return null;
    }
    return tilesForLimitedView(latitude, longitude, zoom, size.width, size.height);
  }, [enabled, latitude, longitude, size.height, size.width, zoom]);
  const radarView = useMemo(() => {
    if (!enabled || size.width <= 0 || size.height <= 0) {
      return null;
    }
    return tilesForLimitedView(latitude, longitude, zoom, size.width, size.height, overlay.tileZoom);
  }, [enabled, latitude, longitude, overlay.tileZoom, size.height, size.width, zoom]);
  const baseTiles = baseView?.tiles ?? NO_TILES;
  const radarTiles = radarView?.tiles ?? NO_TILES;
  const baseTileZoom = baseView?.tileZoom ?? zoom;
  const radarTileZoom = radarView?.tileZoom ?? overlay.tileZoom;
  const restingIndex = (() => {
    if (nexrad) {
      return Math.max(0, NEXRAD_FRAMES.length - 1);
    }
    for (let frameIndex = map.frames.length - 1; frameIndex >= 0; frameIndex -= 1) {
      if (map.frames[frameIndex]?.kind !== "forecast") {
        return frameIndex;
      }
    }
    return 0;
  })();
  const shownIndex = (() => {
    if (frameCount === 0) {
      return 0;
    }
    if (!animate) {
      return Math.min(restingIndex, frameCount - 1);
    }
    return index % frameCount;
  })();
  const shownFrame = (() => {
    if (driven) {
      return playback?.path ? { kind: "past" as const, path: playback.path, time: playback.time } : null;
    }
    if (nexrad || map.frames.length === 0) {
      return null;
    }
    return map.frames[shownIndex] ?? null;
  })();
  const nexradFrame = (() => {
    if (driven) {
      return playback?.nexrad ?? null;
    }
    if (nexrad) {
      return NEXRAD_FRAMES[shownIndex] ?? null;
    }
    return null;
  })();
  const frameMarker = (() => {
    if (driven) {
      return playback?.time;
    }
    if (shownFrame) {
      return shownFrame.time;
    }
    return nexradFrame || undefined;
  })();
  const activeLayer = useMemo((): RadarLayer | null => {
    if (nexradFrame) {
      return { key: "n:" + nexradFrame, nexrad: nexradFrame, path: null };
    }
    if (shownFrame) {
      return { key: "r:" + shownFrame.path, nexrad: null, path: shownFrame.path };
    }
    return null;
  }, [nexradFrame, shownFrame]);
  const viewKey = [latitude, longitude, zoom, size.width, size.height, baseTileZoom, radarTileZoom].join(":");
  const viewRef = useRef(viewKey);
  useLayoutEffect(() => {
    const viewChanged = viewRef.current !== viewKey;
    viewRef.current = viewKey;
    if (!activeLayer) {
      setStack({ incoming: null, outgoing: null, shown: true });
      return;
    }
    setStack((current) => {
      if (!softFade || !current.incoming || viewChanged) {
        return { incoming: activeLayer, outgoing: null, shown: true };
      }
      if (current.incoming.key === activeLayer.key) {
        return current;
      }
      return { incoming: activeLayer, outgoing: current.incoming, shown: false };
    });
  }, [activeLayer, softFade, viewKey]);
  useEffect(() => {
    if (stack.shown || !stack.incoming) {
      return;
    }
    let second = 0;
    const first = window.requestAnimationFrame(() => {
      second = window.requestAnimationFrame(() => {
        setStack((current) => (current.shown ? current : { ...current, shown: true }));
      });
    });
    return () => {
      window.cancelAnimationFrame(first);
      window.cancelAnimationFrame(second);
    };
  }, [stack.incoming, stack.shown]);
  useEffect(() => {
    if (!stack.outgoing || !stack.shown) {
      return;
    }
    const timer = window.setTimeout(() => {
      setStack((current) => ({ ...current, outgoing: null }));
    }, RADAR_CROSSFADE_MS);
    return () => window.clearTimeout(timer);
  }, [stack.outgoing, stack.shown]);
  const statusText = (() => {
    if (nexrad || map.frames.length > 0) {
      return "";
    }
    if (map.status === "unavailable" || catalogTimedOut) {
      return t("family.radarUnavailable");
    }
    return map.status === "loading" ? t("family.radarLoading") : "";
  })();
  const layerSrc = (layer: RadarLayer, tile: RadarTile) => {
    if (layer.nexrad) {
      return nexradTileUrl(layer.nexrad, radarTileZoom, tile);
    }
    if (layer.path) {
      return radarTileUrl(map.host, layer.path, radarTileZoom, tile);
    }
    return "";
  };
  const renderLayer = (layer: RadarLayer, shown: boolean) => (
    <div key={layer.key} class={styles.radarLayer} data-radar-layer={layer.key} data-shown={shown ? "true" : "false"}>
      {radarTiles.map((tile) => {
        const src = layerSrc(layer, tile);
        return src ? (
          <FamilyRadarTile key={"radar:" + tile.left + ":" + tile.top + ":" + tile.size} src={src} tile={tile} />
        ) : null;
      })}
    </div>
  );
  const catalogStatus = (() => {
    if (nexrad || map.frames.length > 0) {
      return "ready";
    }
    if (catalogTimedOut) {
      return "unavailable";
    }
    return map.status;
  })();
  return (
    <div
      class={styles.map}
      ref={frame}
      data-family-radar-map
      data-radar-chrome={chrome}
      data-family-radar-status={catalogStatus}
      data-radar-frame={frameMarker}
      data-radar-source={overlay.kind}
      data-radar-zoom={zoom}
      data-radar-crossfade={softFade ? "true" : "false"}
      data-radar-tiles={
        baseTiles.length + (stack.incoming ? radarTiles.length : 0) + (stack.outgoing ? radarTiles.length : 0)
      }
    >
      <div class={styles.layers} aria-hidden="true">
        {baseTiles.map((tile) => (
          <FamilyRadarTile
            key={"base:" + tile.left + ":" + tile.top}
            src={baseTileUrl(baseTileZoom, tile)}
            tile={tile}
          />
        ))}
        {stack.outgoing ? renderLayer(stack.outgoing, !stack.shown) : null}
        {stack.incoming ? renderLayer(stack.incoming, stack.shown) : null}
        {baseTiles.length > 0 ? <div class={styles.marker} data-family-radar-marker /> : null}
      </div>
      {label ? <div class={styles.place + " " + text.truncate}>{label}</div> : null}
      <p class={styles.credit}>{t(nexrad ? "family.radarCreditNexrad" : "family.radarCredit")}</p>
      {statusText ? <p class={styles.status}>{statusText}</p> : null}
    </div>
  );
};
