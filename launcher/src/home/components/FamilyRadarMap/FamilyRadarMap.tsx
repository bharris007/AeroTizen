import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "preact/hooks";

import {
  createRadarSequenceLoader,
  loadRadarImage,
  RADAR_LOAD_WATCHDOG_MS,
  type RadarSequenceFrame,
  releaseRadarImage,
} from "../../../services/radar/radarImageLoader";
import { MAX_RADAR_FRAMES, type TimelineEntry } from "../../../services/radar/radarTimeline";
import {
  baseMapImageUrl,
  boundedRadarImageSize,
  nexradSingleImageUrl,
  RADAR_MAX_VIEWPORT_HEIGHT,
  RADAR_MAX_VIEWPORT_WIDTH,
  radarImagePlacement,
  radarMarkerPercent,
  radarOverlay,
  radarViewportBbox,
  rainViewerSingleImageUrl,
} from "../../../services/radar/rainViewer";
import { useStore, useStoreSelector } from "../../../shared/hooks/useStore";
import { useTranslation } from "../../../shared/i18n/useTranslation";
import text from "../../../shared/styles/text.module.css";
import type { HomeEnvironment } from "../../types";

import styles from "./FamilyRadarMap.module.css";

const MEASURE_ATTEMPTS = 2;

export interface RadarPreloadProgress {
  readonly loadedFrames: number;
  readonly ready: boolean;
  readonly timedOut: boolean;
  readonly totalFrames: number;
}

const prefersReducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;

const shortPlaceName = (label: string) => {
  const comma = label.indexOf(",");
  return comma > 0 ? label.slice(0, comma).trim() : label.trim();
};

// Lightweight single-image precipitation radar over one static muted basemap.
// Renders at most 1 basemap <img> + 1 visible radar <img> (2 alternating slots during playback),
// zero tile grids, zero <canvas>, sequential 1-in-flight loads, and an 8-second watchdog.
export const FamilyRadarMap = ({
  chrome = "card",
  enabled,
  entries,
  env,
  frameIndex,
  label,
  latitude,
  lite = false,
  loadAnimation = false,
  longitude,
  onLoadTimeout,
  onPreloadChange,
  placeLatitude,
  placeLongitude,
  playing = false,
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
  lite?: boolean;
  loadAnimation?: boolean;
  longitude: number;
  onLoadTimeout?: () => void;
  onPreloadChange?: (progress: RadarPreloadProgress) => void;
  placeLatitude?: number;
  placeLongitude?: number;
  playing?: boolean;
  updated?: string;
  zoom: number;
}) => {
  const { t } = useTranslation();
  const performanceMode = useStoreSelector(env.settings, (settings) => settings.performanceMode);
  const map = useStore(env.runtime.radarMap);
  const [reduceMotion] = useState(prefersReducedMotion);
  const [size, setSize] = useState({ height: 0, width: 0 });
  const [baseReady, setBaseReady] = useState(false);
  const [initialTimedOut, setInitialTimedOut] = useState(false);
  const [radarFailed, setRadarFailed] = useState(false);
  const [displaySlot, setDisplaySlot] = useState<{
    active: 0 | 1;
    frameId: string | null;
    ready: boolean;
    src: string;
  }>({ active: 0, frameId: null, ready: false, src: "" });

  const sequenceLoader = useMemo(() => createRadarSequenceLoader(), []);
  const sequence = useStore(sequenceLoader);

  const frameRef = useRef<HTMLDivElement>(null);
  const baseImgRef = useRef<HTMLImageElement>(null);
  const slot0Ref = useRef<HTMLImageElement>(null);
  const slot1Ref = useRef<HTMLImageElement>(null);
  const slotSrcRef = useRef<[string, string]>(["", ""]);
  const slotLoadedRef = useRef<[boolean, boolean]>([false, false]);
  const displaySlotRef = useRef(displaySlot);
  displaySlotRef.current = displaySlot;
  const timeoutNotifiedRef = useRef(false);

  const softFade = !lite && !performanceMode && !reduceMotion;

  useEffect(() => () => sequenceLoader.dispose(), [sequenceLoader]);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    return env.runtime.radarMap.watch();
  }, [enabled, env.runtime.radarMap]);

  useLayoutEffect(() => {
    const node = frameRef.current;
    if (!node || !enabled) {
      return;
    }
    let attempts = 0;
    let frameId = 0;
    const measure = () => {
      const width = Math.min(RADAR_MAX_VIEWPORT_WIDTH, node.clientWidth);
      const height = Math.min(RADAR_MAX_VIEWPORT_HEIGHT, node.clientHeight);
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

  const cappedEntries = useMemo(() => entries.slice(0, MAX_RADAR_FRAMES), [entries]);
  const overlay = radarOverlay(zoom, latitude, longitude);
  const nexrad = overlay.kind === "nexrad";
  const imageSize = useMemo(() => boundedRadarImageSize(size.width, size.height), [size.height, size.width]);
  const bbox = useMemo(
    () => (enabled ? radarViewportBbox(latitude, longitude, zoom, size.width, size.height) : null),
    [enabled, latitude, longitude, size.height, size.width, zoom],
  );
  const baseSrc = useMemo(() => {
    if (!enabled || !bbox || imageSize.width <= 0 || imageSize.height <= 0) {
      return "";
    }
    return baseMapImageUrl(bbox, imageSize);
  }, [bbox, enabled, imageSize]);

  const placement = useMemo(
    () =>
      bbox
        ? radarImagePlacement(overlay, bbox)
        : { heightPercent: 100, leftPercent: 0, topPercent: 0, widthPercent: 100 },
    [bbox, overlay],
  );

  const entrySrc = useCallback(
    (entry: TimelineEntry | null) => {
      if (!entry || !bbox || imageSize.width <= 0 || imageSize.height <= 0) {
        return "";
      }
      if (entry.nexrad) {
        return nexradSingleImageUrl(entry.nexrad, bbox, imageSize);
      }
      if (entry.path && map.host) {
        return rainViewerSingleImageUrl(map.host, entry.path, overlay.rvZoom, latitude, longitude);
      }
      return "";
    },
    [bbox, imageSize, latitude, longitude, map.host, overlay.rvZoom],
  );

  const clampedIndex = cappedEntries.length === 0 ? 0 : Math.max(0, Math.min(cappedEntries.length - 1, frameIndex));
  const activeEntry = cappedEntries[clampedIndex] ?? null;
  const activeSrc = enabled ? entrySrc(activeEntry) : "";
  const viewKey = [
    latitude.toFixed(4),
    longitude.toFixed(4),
    zoom,
    imageSize.width,
    imageSize.height,
    overlay.kind,
  ].join(":");

  const radarCancelRef = useRef<(() => void) | null>(null);

  const clearRadarSlots = useCallback(() => {
    if (radarCancelRef.current) {
      const stop = radarCancelRef.current;
      radarCancelRef.current = null;
      stop();
    }
    releaseRadarImage(slot0Ref.current);
    releaseRadarImage(slot1Ref.current);
    slotSrcRef.current = ["", ""];
    slotLoadedRef.current = [false, false];
  }, []);

  // Reset radar slots whenever disabled or the map viewport/zoom/overlay changes.
  // Never clear the basemap here: the basemap effect owns its own lifecycle when baseSrc changes.
  const previousViewRef = useRef(viewKey);
  useLayoutEffect(() => {
    const viewChanged = previousViewRef.current !== viewKey;
    previousViewRef.current = viewKey;
    if (!enabled || viewChanged) {
      clearRadarSlots();
      sequenceLoader.cancel();
      setInitialTimedOut(false);
      setRadarFailed(false);
      setDisplaySlot({ active: 0, frameId: null, ready: false, src: "" });
    }
  }, [clearRadarSlots, enabled, sequenceLoader, viewKey]);

  useEffect(
    () => () => {
      clearRadarSlots();
      releaseRadarImage(baseImgRef.current);
    },
    [clearRadarSlots],
  );

  // Drop the second radar slot immediately when entering Lite mode.
  useEffect(() => {
    if (!lite) {
      return;
    }
    sequenceLoader.cancel();
    releaseRadarImage(slot1Ref.current);
    slotSrcRef.current[1] = "";
    slotLoadedRef.current[1] = false;
  }, [lite, sequenceLoader]);

  // Load the single static basemap <img> through the 1-in-flight queue.
  useEffect(() => {
    const image = baseImgRef.current;
    if (!enabled || initialTimedOut || !baseSrc || !image) {
      setBaseReady(false);
      releaseRadarImage(image);
      return;
    }
    setBaseReady(false);
    let active = true;
    const cancel = loadRadarImage(image, baseSrc, {
      onSettled(loaded) {
        if (active) {
          setBaseReady(loaded);
        }
      },
    });
    return () => {
      active = false;
      cancel();
      releaseRadarImage(image);
    };
  }, [baseSrc, enabled, initialTimedOut]);

  // Load the active single radar frame into the visible (or inactive swap) <img> slot.
  useEffect(() => {
    if (!enabled || initialTimedOut || !activeEntry || !activeSrc) {
      return;
    }
    const current = displaySlotRef.current;
    if (current.ready && current.src === activeSrc) {
      return;
    }
    const targetSlot: 0 | 1 = !lite && current.ready && current.active === 0 ? 1 : 0;
    const targetImage = targetSlot === 0 ? slot0Ref.current : slot1Ref.current;
    if (!targetImage) {
      return;
    }
    if (slotSrcRef.current[targetSlot] === activeSrc && slotLoadedRef.current[targetSlot]) {
      setRadarFailed(false);
      setInitialTimedOut(false);
      setDisplaySlot({ active: targetSlot, frameId: activeEntry.id, ready: true, src: activeSrc });
      return;
    }
    if (slotSrcRef.current[targetSlot] === activeSrc) {
      releaseRadarImage(targetImage);
    }
    slotSrcRef.current[targetSlot] = activeSrc;
    slotLoadedRef.current[targetSlot] = false;
    let active = true;
    const cancel = loadRadarImage(targetImage, activeSrc, {
      onSettled(loaded) {
        if (radarCancelRef.current === cancel) {
          radarCancelRef.current = null;
        }
        if (!active) {
          return;
        }
        slotLoadedRef.current[targetSlot] = loaded;
        if (loaded) {
          setRadarFailed(false);
          setInitialTimedOut(false);
          setDisplaySlot({ active: targetSlot, frameId: activeEntry.id, ready: true, src: activeSrc });
        } else if (!displaySlotRef.current.ready) {
          setRadarFailed(true);
        }
      },
    });
    radarCancelRef.current = cancel;
    return () => {
      active = false;
      if (radarCancelRef.current === cancel) {
        radarCancelRef.current = null;
      }
      cancel();
    };
  }, [activeEntry, activeSrc, enabled, initialTimedOut, lite, viewKey]);

  // Initial 8-second watchdog: abort slow catalog or first-frame loads instead of hanging the TV.
  const waitingForInitial =
    enabled &&
    !displaySlot.ready &&
    !radarFailed &&
    !initialTimedOut &&
    (Boolean(activeSrc) || (!nexrad && map.frames.length === 0 && map.status === "loading"));

  useEffect(() => {
    if (!waitingForInitial) {
      return;
    }
    const timer = window.setTimeout(() => {
      clearRadarSlots();
      setInitialTimedOut(true);
    }, RADAR_LOAD_WATCHDOG_MS);
    return () => window.clearTimeout(timer);
  }, [clearRadarSlots, waitingForInitial]);

  // Sequentially warm the remaining <= 5 frames ONLY after the user asks to animate (never in Lite mode).
  const animationFrames = useMemo((): readonly RadarSequenceFrame[] => {
    if (!enabled || lite || !loadAnimation || cappedEntries.length < 2) {
      return [];
    }
    return cappedEntries.map((entry) => ({ id: entry.id, src: entrySrc(entry) })).filter((item) => Boolean(item.src));
  }, [cappedEntries, enabled, entrySrc, lite, loadAnimation]);

  const initialFrameIdRef = useRef<string | null>(null);
  const animationFramesRef = useRef(animationFrames);
  animationFramesRef.current = animationFrames;
  const animationPlanKey = animationFrames.map((item) => item.id + "=" + item.src).join("|");
  useEffect(() => {
    timeoutNotifiedRef.current = false;
    const planned = animationFramesRef.current;
    if (!enabled || lite || !loadAnimation || planned.length === 0) {
      initialFrameIdRef.current = null;
      sequenceLoader.cancel();
      return;
    }
    const alreadyReadyId = displaySlotRef.current.ready ? displaySlotRef.current.frameId : null;
    initialFrameIdRef.current = alreadyReadyId;
    const remaining = alreadyReadyId ? planned.filter((item) => item.id !== alreadyReadyId) : planned;
    if (remaining.length === 0) {
      sequenceLoader.cancel();
      return;
    }
    sequenceLoader.load(remaining);
    return () => sequenceLoader.cancel();
  }, [animationPlanKey, enabled, lite, loadAnimation, sequenceLoader]);

  // When the 8s sequence watchdog fires, fall back cleanly to static latest frame (Lite mode).
  useEffect(() => {
    if (!sequence.timedOut || timeoutNotifiedRef.current) {
      return;
    }
    timeoutNotifiedRef.current = true;
    onLoadTimeout?.();
  }, [onLoadTimeout, sequence.timedOut]);

  // Report sequence progress to parent playback controller.
  const totalFrames = enabled && !lite && loadAnimation && size.width > 0 && size.height > 0 ? cappedEntries.length : 0;
  const baseCount =
    totalFrames > 0 &&
    initialFrameIdRef.current &&
    cappedEntries.some((entry) => entry.id === initialFrameIdRef.current)
      ? 1
      : 0;
  const loadedFrames = totalFrames === 0 ? 0 : Math.min(totalFrames, baseCount + sequence.loadedFrames);
  const preloadReady =
    totalFrames > 0 && !sequence.timedOut && (sequence.totalFrames === 0 ? baseCount >= totalFrames : sequence.ready);

  const progressRef = useRef<RadarPreloadProgress>({
    loadedFrames: -1,
    ready: false,
    timedOut: false,
    totalFrames: -1,
  });
  useEffect(() => {
    if (!onPreloadChange) {
      return;
    }
    const previous = progressRef.current;
    if (
      previous.loadedFrames === loadedFrames &&
      previous.totalFrames === totalFrames &&
      previous.ready === preloadReady &&
      previous.timedOut === sequence.timedOut
    ) {
      return;
    }
    const next = { loadedFrames, ready: preloadReady, timedOut: sequence.timedOut, totalFrames };
    progressRef.current = next;
    onPreloadChange(next);
  }, [loadedFrames, onPreloadChange, preloadReady, sequence.timedOut, totalFrames]);

  const marker = useMemo(
    () => radarMarkerPercent(placeLatitude ?? latitude, placeLongitude ?? longitude, bbox),
    [bbox, latitude, longitude, placeLatitude, placeLongitude],
  );

  const statusText = (() => {
    if (displaySlot.ready) {
      return "";
    }
    if (initialTimedOut || radarFailed || (!nexrad && map.status === "unavailable")) {
      return t("family.radarUnavailable");
    }
    if (!nexrad && map.status === "loading") {
      return t("family.radarLoading");
    }
    return "";
  })();

  const catalogStatus = (() => {
    if (displaySlot.ready) {
      return "ready";
    }
    if (initialTimedOut || radarFailed) {
      return "unavailable";
    }
    if (nexrad || map.frames.length > 0) {
      return "ready";
    }
    return map.status;
  })();

  const transitionMode = (() => {
    if (!softFade) {
      return "none";
    }
    return playing ? "play" : "scrub";
  })();

  const placementStyle = {
    height: placement.heightPercent.toFixed(3) + "%",
    left: placement.leftPercent.toFixed(3) + "%",
    top: placement.topPercent.toFixed(3) + "%",
    width: placement.widthPercent.toFixed(3) + "%",
  };
  const markerChip = label ? shortPlaceName(label) : "";

  return (
    <div
      class={styles.map}
      ref={frameRef}
      data-family-radar-map
      data-radar-chrome={chrome}
      data-family-radar-status={catalogStatus}
      data-radar-frame={activeEntry?.time}
      data-radar-source={overlay.kind}
      data-radar-zoom={zoom}
      data-radar-renderer="single-image"
      data-radar-lite={lite ? "true" : "false"}
      data-radar-image-size={imageSize.width + "x" + imageSize.height}
      data-radar-preload-loaded={loadedFrames}
      data-radar-preload-total={totalFrames}
      data-radar-preload-ready={preloadReady ? "true" : "false"}
      data-radar-transition={transitionMode}
    >
      {enabled ? (
        <div class={styles.layers} aria-hidden="true">
          <div class={styles.basemap}>
            <img
              ref={baseImgRef}
              class={styles.basemapImage}
              alt=""
              draggable={false}
              decoding="async"
              data-radar-basemap
              data-visible={baseReady ? "true" : "false"}
            />
          </div>
          <div class={styles.atmosphere} />
          <div class={styles.radarStage}>
            <img
              ref={slot0Ref}
              class={styles.radarImage}
              style={placementStyle}
              alt=""
              draggable={false}
              decoding="async"
              data-radar-slot="0"
              data-visible={displaySlot.ready && displaySlot.active === 0 ? "true" : "false"}
            />
            {!lite ? (
              <img
                ref={slot1Ref}
                class={styles.radarImage}
                style={placementStyle}
                alt=""
                draggable={false}
                decoding="async"
                data-radar-slot="1"
                data-visible={displaySlot.ready && displaySlot.active === 1 ? "true" : "false"}
              />
            ) : null}
          </div>
          <div class={styles.vignette} />
          {bbox && marker.visible ? (
            <div
              class={styles.marker}
              data-family-radar-marker
              style={{ left: marker.leftPercent.toFixed(2) + "%", top: marker.topPercent.toFixed(2) + "%" }}
            >
              <span class={styles.markerHalo} />
              <span class={styles.markerDot} />
              {chrome === "full" && markerChip ? <span class={styles.markerLabel}>{markerChip}</span> : null}
            </div>
          ) : null}
        </div>
      ) : null}
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
