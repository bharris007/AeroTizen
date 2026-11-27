import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "preact/hooks";

import { createRadarPreloader, type RadarPreloadFrame } from "../../../services/radar/createRadarPreloader";
import { releaseRadarCanvas, resizeCanvasElement } from "../../../services/radar/radarCompositor";
import type { TimelineEntry } from "../../../services/radar/radarTimeline";
import {
  baseTileUrl,
  nexradTileUrl,
  radarMarkerPosition,
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

export const RADAR_CROSSFADE_MS = 680;
export const RADAR_SCRUB_FADE_MS = 180;
const CATALOG_TIMEOUT_MS = 8_000;
const MEASURE_ATTEMPTS = 2;
const NO_TILES: readonly RadarTile[] = Object.freeze([]);
const NO_READY_IDS: readonly string[] = Object.freeze([]);

export interface RadarPreloadProgress {
  readonly loadedFrames: number;
  readonly ready: boolean;
  readonly totalFrames: number;
}

const prefersReducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;

const shortPlaceName = (label: string) => {
  const comma = label.indexOf(",");
  return comma > 0 ? label.slice(0, comma).trim() : label.trim();
};

const drawCachedCanvas = (target: HTMLCanvasElement | null, source: HTMLCanvasElement) => {
  if (!target) {
    return false;
  }
  resizeCanvasElement(target, source.width, source.height);
  const ctx = target.getContext("2d");
  if (!ctx) {
    return false;
  }
  ctx.clearRect(0, 0, target.width, target.height);
  ctx.drawImage(source, 0, 0);
  return true;
};

// Live precipitation over a muted dark map. Uses pre-composited offscreen canvases for
// smooth GPU opacity crossfades with zero blocky tiles or layout thrash, and never autoplays.
export const FamilyRadarMap = ({
  chrome = "card",
  enabled,
  entries,
  env,
  frameIndex,
  label,
  latitude,
  longitude,
  onPreloadChange,
  placeLatitude,
  placeLongitude,
  playing = false,
  preloadAll = false,
  suspended = false,
  updated = "",
  zoom,
}: {
  chrome?: "card" | "full";
  enabled: boolean;
  entries: readonly TimelineEntry[];
  env: HomeEnvironment;
  frameIndex: number;
  label: string;
  latitude: number;
  longitude: number;
  onPreloadChange?: (progress: RadarPreloadProgress) => void;
  placeLatitude?: number;
  placeLongitude?: number;
  playing?: boolean;
  preloadAll?: boolean;
  suspended?: boolean;
  updated?: string;
  zoom: number;
}) => {
  const { t } = useTranslation();
  const performanceMode = useStoreSelector(env.settings, (settings) => settings.performanceMode);
  const map = useStore(env.runtime.radarMap);
  const [reduceMotion] = useState(prefersReducedMotion);
  const [size, setSize] = useState({ height: 0, width: 0 });
  const [catalogTimedOut, setCatalogTimedOut] = useState(false);

  const preloader = useMemo(() => createRadarPreloader(), []);
  const preloadSnapshot = useStore(preloader);
  const canComposite = preloadSnapshot.canComposite;

  const [displaySlot, setDisplaySlot] = useState<{
    active: 0 | 1;
    frameId: string | null;
    visible: boolean;
  }>({ active: 0, frameId: null, visible: false });

  // DOM tile fallback state (used only when 2D canvas compositing is unavailable).
  const [domStack, setDomStack] = useState<{
    incoming: TimelineEntry | null;
    outgoing: TimelineEntry | null;
    shown: boolean;
  }>({ incoming: null, outgoing: null, shown: true });
  const domSettledRef = useRef<Map<string, Set<number>>>(new Map());
  const [domReadyIds, setDomReadyIds] = useState<readonly string[]>(NO_READY_IDS);

  const frame = useRef<HTMLDivElement>(null);
  const slot0Ref = useRef<HTMLCanvasElement>(null);
  const slot1Ref = useRef<HTMLCanvasElement>(null);
  const softFade = !performanceMode && !reduceMotion;

  useEffect(() => () => preloader.dispose(), [preloader]);

  useEffect(() => {
    if (!enabled || suspended) {
      return;
    }
    return env.runtime.radarMap.watch();
  }, [enabled, env.runtime.radarMap, suspended]);

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

  const overlay = radarOverlay(zoom, latitude, longitude);
  const nexrad = overlay.kind === "nexrad";

  useEffect(() => {
    if (!enabled || nexrad || map.frames.length > 0 || map.status !== "loading") {
      setCatalogTimedOut(false);
      return;
    }
    const timer = window.setTimeout(() => setCatalogTimedOut(true), CATALOG_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [enabled, map.frames.length, map.status, nexrad]);

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

  const clampedIndex = entries.length === 0 ? 0 : Math.max(0, Math.min(entries.length - 1, frameIndex));
  const activeEntry = entries[clampedIndex] ?? null;
  const viewKey = [
    latitude,
    longitude,
    zoom,
    size.width,
    size.height,
    baseTileZoom,
    radarTileZoom,
    overlay.kind,
    map.host,
  ].join(":");

  const entryTileSrc = useCallback(
    (entry: TimelineEntry, tile: RadarTile) => {
      if (entry.nexrad) {
        return nexradTileUrl(entry.nexrad, radarTileZoom, tile);
      }
      if (entry.path && map.host) {
        return radarTileUrl(map.host, entry.path, radarTileZoom, tile);
      }
      return "";
    },
    [map.host, radarTileZoom],
  );

  const preloadFrames = useMemo((): readonly RadarPreloadFrame[] => {
    if (!enabled || radarTiles.length === 0 || entries.length === 0) {
      return [];
    }
    return entries.map((entry) => ({
      id: entry.id,
      tiles: radarTiles.map((tile) => ({ src: entryTileSrc(entry, tile), tile })).filter((item) => Boolean(item.src)),
    }));
  }, [enabled, entries, entryTileSrc, radarTiles]);

  // Clear canvases and fallback state whenever disabled or the viewport changes.
  const previousViewRef = useRef(viewKey);
  useLayoutEffect(() => {
    const viewChanged = previousViewRef.current !== viewKey;
    previousViewRef.current = viewKey;
    if (!enabled || viewChanged) {
      releaseRadarCanvas(slot0Ref.current);
      releaseRadarCanvas(slot1Ref.current);
      setDisplaySlot({ active: 0, frameId: null, visible: false });
      domSettledRef.current = new Map();
      setDomReadyIds(NO_READY_IDS);
      if (!enabled) {
        preloader.clear();
        setDomStack({ incoming: null, outgoing: null, shown: true });
      }
    }
  }, [enabled, preloader, viewKey]);

  // Release both display canvases on unmount to free GPU memory on Tizen immediately.
  useEffect(
    () => () => {
      releaseRadarCanvas(slot0Ref.current);
      releaseRadarCanvas(slot1Ref.current);
    },
    [],
  );

  // Drive offscreen canvas preloader in real browsers.
  useEffect(() => {
    if (!enabled || !canComposite) {
      return;
    }
    if (suspended) {
      preloader.cancelInFlight();
      return;
    }
    if (size.width <= 0 || size.height <= 0 || preloadFrames.length === 0) {
      preloader.clear();
      return;
    }
    preloader.sync({
      frames: preloadFrames,
      height: size.height,
      preloadAll,
      priorityFrameId: activeEntry?.id ?? null,
      source: overlay.kind,
      viewKey,
      width: size.width,
    });
  }, [
    activeEntry?.id,
    canComposite,
    enabled,
    overlay.kind,
    preloadAll,
    preloadFrames,
    preloader,
    size.height,
    size.width,
    suspended,
    viewKey,
  ]);

  // Blit the pre-composited canvas into the hidden display slot and crossfade via GPU opacity.
  const activeReadyInCanvas =
    canComposite &&
    Boolean(activeEntry) &&
    preloadSnapshot.viewKey === viewKey &&
    preloadSnapshot.readyIds.includes(activeEntry?.id ?? "");

  useLayoutEffect(() => {
    if (!enabled || !canComposite || !activeEntry || !activeReadyInCanvas) {
      return;
    }
    if (displaySlot.frameId === activeEntry.id) {
      return;
    }
    const cached = preloader.getFrameCanvas(activeEntry.id);
    if (!cached) {
      return;
    }
    if (!displaySlot.frameId) {
      if (drawCachedCanvas(slot0Ref.current, cached)) {
        setDisplaySlot({ active: 0, frameId: activeEntry.id, visible: !softFade });
      }
      return;
    }
    const nextSlot: 0 | 1 = displaySlot.active === 0 ? 1 : 0;
    const target = nextSlot === 0 ? slot0Ref.current : slot1Ref.current;
    if (drawCachedCanvas(target, cached)) {
      setDisplaySlot({ active: nextSlot, frameId: activeEntry.id, visible: true });
    }
  }, [
    activeEntry,
    activeReadyInCanvas,
    canComposite,
    displaySlot.active,
    displaySlot.frameId,
    enabled,
    preloader,
    softFade,
  ]);

  useEffect(() => {
    if (!canComposite || !displaySlot.frameId || displaySlot.visible) {
      return;
    }
    const frameId = window.requestAnimationFrame(() => {
      setDisplaySlot((current) => (current.visible ? current : { ...current, visible: true }));
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [canComposite, displaySlot.frameId, displaySlot.visible]);

  // DOM fallback layer transitions (used only when 2D canvas context is unavailable).
  useLayoutEffect(() => {
    if (!enabled || canComposite) {
      return;
    }
    if (!activeEntry) {
      setDomStack({ incoming: null, outgoing: null, shown: true });
      return;
    }
    setDomStack((current) => {
      if (!softFade || !current.incoming) {
        return { incoming: activeEntry, outgoing: null, shown: true };
      }
      if (current.incoming.id === activeEntry.id) {
        return current;
      }
      return { incoming: activeEntry, outgoing: current.incoming, shown: false };
    });
  }, [activeEntry, canComposite, enabled, softFade, viewKey]);

  useEffect(() => {
    if (canComposite || domStack.shown || !domStack.incoming) {
      return;
    }
    let second = 0;
    const first = window.requestAnimationFrame(() => {
      second = window.requestAnimationFrame(() => {
        setDomStack((current) => (current.shown ? current : { ...current, shown: true }));
      });
    });
    return () => {
      window.cancelAnimationFrame(first);
      window.cancelAnimationFrame(second);
    };
  }, [canComposite, domStack.incoming, domStack.shown]);

  useEffect(() => {
    if (canComposite || !domStack.outgoing || !domStack.shown) {
      return;
    }
    const timer = window.setTimeout(
      () => setDomStack((current) => ({ ...current, outgoing: null })),
      playing ? RADAR_CROSSFADE_MS : RADAR_SCRUB_FADE_MS,
    );
    return () => window.clearTimeout(timer);
  }, [canComposite, domStack.outgoing, domStack.shown, playing]);

  const markDomTileSettled = useCallback((entryId: string, tileIndex: number, expectedTotal: number) => {
    const settledMap = domSettledRef.current;
    let bucket = settledMap.get(entryId);
    if (!bucket) {
      bucket = new Set<number>();
      settledMap.set(entryId, bucket);
    }
    bucket.add(tileIndex);
    if (bucket.size >= expectedTotal) {
      setDomReadyIds((current) => (current.includes(entryId) ? current : [...current, entryId]));
    }
  }, []);

  // Compute unified preload progress across both canvas and DOM fallback renderers.
  const totalFrames = enabled && size.width > 0 && size.height > 0 ? entries.length : 0;
  const loadedFrames = (() => {
    if (totalFrames === 0) {
      return 0;
    }
    if (canComposite) {
      return preloadSnapshot.viewKey === viewKey ? preloadSnapshot.loadedFrames : 0;
    }
    return entries.filter((entry) => domReadyIds.includes(entry.id)).length;
  })();
  const preloadReady = totalFrames > 0 && loadedFrames >= totalFrames;

  const progressRef = useRef<RadarPreloadProgress>({ loadedFrames: -1, ready: false, totalFrames: -1 });
  useEffect(() => {
    if (!onPreloadChange) {
      return;
    }
    const previous = progressRef.current;
    if (
      previous.loadedFrames === loadedFrames &&
      previous.totalFrames === totalFrames &&
      previous.ready === preloadReady
    ) {
      return;
    }
    const next = { loadedFrames, ready: preloadReady, totalFrames };
    progressRef.current = next;
    onPreloadChange(next);
  }, [loadedFrames, onPreloadChange, preloadReady, totalFrames]);

  const domPreloadEntries = useMemo(() => {
    if (canComposite || !enabled || !preloadAll || radarTiles.length === 0) {
      return [] as readonly TimelineEntry[];
    }
    const mountedIds = new Set<string>();
    if (domStack.incoming) {
      mountedIds.add(domStack.incoming.id);
    }
    if (domStack.outgoing) {
      mountedIds.add(domStack.outgoing.id);
    }
    return entries.filter((entry) => !mountedIds.has(entry.id) && !domReadyIds.includes(entry.id));
  }, [
    canComposite,
    domReadyIds,
    domStack.incoming,
    domStack.outgoing,
    enabled,
    entries,
    preloadAll,
    radarTiles.length,
  ]);

  const marker = useMemo(() => {
    if (!baseView || size.width <= 0 || size.height <= 0) {
      return { left: 0, top: 0, visible: false };
    }
    return radarMarkerPosition(
      placeLatitude ?? latitude,
      placeLongitude ?? longitude,
      zoom,
      baseView.originLeft,
      baseView.originTop,
      size.width,
      size.height,
    );
  }, [baseView, latitude, longitude, placeLatitude, placeLongitude, size.height, size.width, zoom]);

  const statusText = (() => {
    if (nexrad || map.frames.length > 0) {
      return "";
    }
    if (map.status === "unavailable" || catalogTimedOut) {
      return t("family.radarUnavailable");
    }
    return map.status === "loading" ? t("family.radarLoading") : "";
  })();

  const catalogStatus = (() => {
    if (nexrad || map.frames.length > 0) {
      return "ready";
    }
    if (catalogTimedOut) {
      return "unavailable";
    }
    return map.status;
  })();

  const renderDomLayer = (entry: TimelineEntry, shown: boolean, priority: "high" | "low" = "high") => {
    const validTiles = radarTiles
      .map((tile) => ({ src: entryTileSrc(entry, tile), tile }))
      .filter((item) => Boolean(item.src));
    return (
      <div key={entry.id} class={styles.radarLayer} data-radar-layer={entry.id} data-shown={shown ? "true" : "false"}>
        {validTiles.map((item, tileIndex) => (
          <FamilyRadarTile
            key={"radar:" + item.tile.left + ":" + item.tile.top + ":" + item.tile.size}
            priority={priority}
            src={item.src}
            tile={item.tile}
            onSettled={() => markDomTileSettled(entry.id, tileIndex, validTiles.length)}
          />
        ))}
      </div>
    );
  };

  const transitionMode = (() => {
    if (!softFade) {
      return "none";
    }
    return playing ? "play" : "scrub";
  })();

  const mountedDomRadarTiles = canComposite
    ? 0
    : (domStack.incoming ? radarTiles.length : 0) + (domStack.outgoing ? radarTiles.length : 0);

  const markerChip = label ? shortPlaceName(label) : "";

  return (
    <div
      class={styles.map}
      ref={frame}
      data-family-radar-map
      data-radar-chrome={chrome}
      data-family-radar-status={catalogStatus}
      data-radar-frame={activeEntry?.time}
      data-radar-source={overlay.kind}
      data-radar-zoom={zoom}
      data-radar-renderer={canComposite ? "canvas" : "tiles"}
      data-radar-preload-loaded={loadedFrames}
      data-radar-preload-total={totalFrames}
      data-radar-preload-ready={preloadReady ? "true" : "false"}
      data-radar-crossfade={softFade ? "true" : "false"}
      data-radar-transition={transitionMode}
      data-radar-tiles={baseTiles.length + mountedDomRadarTiles}
      data-radar-layer-tiles={radarTiles.length}
    >
      <div class={styles.layers} aria-hidden="true">
        <div class={styles.basemap}>
          {baseTiles.map((tile) => (
            <FamilyRadarTile
              key={"base:" + tile.left + ":" + tile.top + ":" + baseTileZoom}
              priority="high"
              src={baseTileUrl(baseTileZoom, tile)}
              tile={tile}
            />
          ))}
        </div>
        <div class={styles.atmosphere} />
        <div class={styles.radarStage}>
          {canComposite ? (
            <>
              <canvas
                ref={slot0Ref}
                class={styles.radarCanvas}
                data-radar-slot="0"
                data-visible={displaySlot.visible && displaySlot.active === 0 ? "true" : "false"}
              />
              <canvas
                ref={slot1Ref}
                class={styles.radarCanvas}
                data-radar-slot="1"
                data-visible={displaySlot.visible && displaySlot.active === 1 ? "true" : "false"}
              />
            </>
          ) : (
            <>
              {domStack.outgoing ? renderDomLayer(domStack.outgoing, !domStack.shown) : null}
              {domStack.incoming ? renderDomLayer(domStack.incoming, domStack.shown) : null}
              {domPreloadEntries.length > 0 ? (
                <div class={styles.preloadBin} data-radar-preload-bin>
                  {domPreloadEntries.map((entry) => renderDomLayer(entry, false, "low"))}
                </div>
              ) : null}
            </>
          )}
        </div>
        <div class={styles.vignette} />
        {baseTiles.length > 0 && marker.visible ? (
          <div
            class={styles.marker}
            data-family-radar-marker
            style={{ left: marker.left + "px", top: marker.top + "px" }}
          >
            <span class={styles.markerHalo} />
            <span class={styles.markerDot} />
            {chrome === "full" && markerChip ? <span class={styles.markerLabel}>{markerChip}</span> : null}
          </div>
        ) : null}
      </div>
      <div class={styles.header}>
        {label ? <div class={styles.place + " " + text.truncate}>{label}</div> : null}
        {chrome === "full" && updated ? <div class={styles.headerMeta}>{updated}</div> : null}
        {chrome === "full" ? (
          <div
            class={styles.legend}
            role="img"
            aria-label={t("family.radarLegend")}
            data-family-radar-legend
            data-radar-palette={overlay.kind}
          >
            <div class={styles.legendBar} />
            <div class={styles.legendScale}>
              <span>{t("family.radarLight")}</span>
              <span>{t("family.radarModerate")}</span>
              <span>{t("family.radarHeavy")}</span>
            </div>
          </div>
        ) : null}
      </div>
      <p class={styles.credit}>{t(nexrad ? "family.radarCreditNexrad" : "family.radarCredit")}</p>
      {statusText ? (
        <div class={styles.statusWrap}>
          <p class={styles.status}>{statusText}</p>
        </div>
      ) : null}
    </div>
  );
};
