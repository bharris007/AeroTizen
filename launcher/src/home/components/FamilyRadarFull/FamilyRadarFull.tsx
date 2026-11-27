import { Minus, Move, Plus } from "lucide-preact";
import { useCallback, useEffect, useRef, useState } from "preact/hooks";

import type { FamilyForecastSnapshot } from "../../../contracts/familyForecast";
import type { TimeFormat } from "../../../contracts/preferences";
import { acquireRadarMediaKeys } from "../../../platform/tizen/registerMediaKeys";
import {
  framePhase,
  RADAR_PLAY_END_HOLD_MS,
  RADAR_PLAY_STEP_MS,
  radarAgeMinutes,
  radarTimeline,
} from "../../../services/radar/radarTimeline";
import { radarViewport } from "../../../services/radar/radarView";
import { radarOverlay } from "../../../services/radar/rainViewer";
import { useStore, useStoreSelector } from "../../../shared/hooks/useStore";
import { useTranslation } from "../../../shared/i18n/useTranslation";
import { Icon } from "../../../shared/icons/Icon/Icon";
import type { HomeEnvironment, WeatherFocus } from "../../types";
import { FamilyRadarMap, type RadarPreloadProgress } from "../FamilyRadarMap/FamilyRadarMap";
import { FamilyRadarTimeline } from "../FamilyRadarTimeline/FamilyRadarTimeline";

import styles from "./FamilyRadarFull.module.css";

const AGE_REFRESH_MS = 30 * 1000;
const PLAY_START_WRAP_MS = 120;
const INITIAL_PRELOAD: RadarPreloadProgress = { loadedFrames: 0, ready: false, totalFrames: 0 };

// Full-screen radar. Opens paused on the newest frame, preloads all frames for the current view
// before starting smooth crossfade playback, and releases all tiles/canvases cleanly on Back.
export const FamilyRadarFull = ({
  env,
  focus,
  forecast,
  timeFormat,
}: {
  env: HomeEnvironment;
  focus: WeatherFocus;
  forecast: FamilyForecastSnapshot;
  timeFormat: TimeFormat;
}) => {
  const { t } = useTranslation();
  const saved = useStoreSelector(env.settings, (settings) => settings.radarView);
  const viewport = radarViewport(saved, forecast);
  const map = useStore(env.runtime.radarMap);
  const panning = useStoreSelector(env.state, (state) => state.radarPanning);
  const playing = useStoreSelector(env.state, (state) => state.radarPlaying);
  const radarFrame = useStoreSelector(env.state, (state) => state.radarFrame);
  const span = useStoreSelector(env.state, (state) => state.radarSpan);
  const [clock, setClock] = useState(() => Date.now());
  const [preload, setPreload] = useState<RadarPreloadProgress>(INITIAL_PRELOAD);

  const overlay = radarOverlay(viewport.zoom, viewport.latitude, viewport.longitude);
  const timeline = radarTimeline(map.frames, span, overlay.kind, Math.floor(clock / 1000));
  const index =
    radarFrame === null ? timeline.nowIndex : Math.max(0, Math.min(timeline.entries.length - 1, radarFrame));
  const selected = timeline.entries[index] ?? null;
  const nowTime = timeline.entries[timeline.nowIndex]?.time ?? 0;
  const age = radarAgeMinutes(map.generated, nowTime, clock);
  const updated = (() => {
    if (age === null) {
      return "";
    }
    if (age < 1) {
      return t("family.radarUpdatedNow");
    }
    return t("family.radarUpdated", { minutes: age });
  })();

  const handlePreloadChange = useCallback((next: RadarPreloadProgress) => {
    setPreload(next);
  }, []);

  useEffect(() => acquireRadarMediaKeys(), []);

  useEffect(() => {
    env.commandRadar({ count: timeline.entries.length, nowIndex: timeline.nowIndex, type: "sync" });
  }, [env, timeline.entries.length, timeline.nowIndex]);

  const playbackReady = overlay.kind === "nexrad" || map.status === "ready";
  const allPreloaded = preload.ready && preload.totalFrames === timeline.entries.length && timeline.entries.length > 0;
  const buffering = playing && (!playbackReady || !allPreloaded);
  const activelyPlaying = playing && playbackReady && allPreloaded && timeline.entries.length >= 2;
  const wasActivelyPlayingRef = useRef(false);

  // Never advance frames until every frame for the current view has been preloaded and composited.
  useEffect(() => {
    if (!activelyPlaying) {
      wasActivelyPlayingRef.current = false;
      return;
    }
    const justStarted = !wasActivelyPlayingRef.current;
    wasActivelyPlayingRef.current = true;
    const atEnd = index >= timeline.entries.length - 1;
    const delay = (() => {
      if (atEnd) {
        return justStarted ? PLAY_START_WRAP_MS : RADAR_PLAY_END_HOLD_MS;
      }
      return RADAR_PLAY_STEP_MS;
    })();
    const timer = window.setTimeout(() => env.commandRadar({ type: "tick" }), delay);
    return () => window.clearTimeout(timer);
  }, [activelyPlaying, env, index, timeline.entries.length]);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), AGE_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, []);

  const zoom = (delta: number) => (event: MouseEvent) => {
    event.stopPropagation();
    env.zoomRadar(delta);
  };

  return (
    <section
      class={styles.screen}
      data-family-expanded="radar"
      data-family-radar-panning={panning ? "true" : "false"}
      aria-label={t("family.radar") + ", " + forecast.locationLabel}
    >
      <FamilyRadarMap
        chrome="full"
        enabled
        entries={timeline.entries}
        env={env}
        frameIndex={index}
        label={forecast.locationLabel}
        latitude={viewport.latitude}
        longitude={viewport.longitude}
        onPreloadChange={handlePreloadChange}
        placeLatitude={forecast.latitude}
        placeLongitude={forecast.longitude}
        playing={playing && allPreloaded}
        preloadAll
        updated={updated}
        zoom={viewport.zoom}
      />
      <div class={styles.tools}>
        <div class={styles.zoom} role="group" aria-label={t("family.radarZoom")} data-family-radar-zoom>
          <button
            type="button"
            class={styles.zoomButton}
            tabIndex={-1}
            aria-label={t("family.radarZoomIn")}
            data-family-radar-zoom="1"
            data-focused={focus === "zoomIn" ? "true" : undefined}
            onClick={zoom(1)}
          >
            <Icon icon={Plus} size={32} />
          </button>
          <span class={styles.zoomLevel} data-family-radar-zoom-level>
            {viewport.zoom}
          </span>
          <button
            type="button"
            class={styles.zoomButton}
            tabIndex={-1}
            aria-label={t("family.radarZoomOut")}
            data-family-radar-zoom="-1"
            data-focused={focus === "zoomOut" ? "true" : undefined}
            onClick={zoom(-1)}
          >
            <Icon icon={Minus} size={32} />
          </button>
        </div>
        <button
          type="button"
          class={styles.pan}
          tabIndex={-1}
          aria-label={t("family.radarPan")}
          aria-pressed={panning ? "true" : "false"}
          data-family-radar-pan
          data-focused={focus === "pan" ? "true" : undefined}
          data-active={panning ? "true" : undefined}
          onClick={(event) => {
            event.stopPropagation();
            env.toggleRadarPanning();
          }}
        >
          <Icon icon={Move} size={28} />
          <span class={styles.panLabel}>{t(panning ? "family.radarPanOn" : "family.radarPan")}</span>
        </button>
      </div>
      <FamilyRadarTimeline
        buffering={buffering}
        choices={timeline.choices}
        entries={timeline.entries}
        env={env}
        focus={focus}
        index={index}
        loadedFrames={preload.loadedFrames}
        nowIndex={timeline.nowIndex}
        phase={selected ? framePhase(selected, nowTime) : "now"}
        playing={playing}
        preloadReady={allPreloaded}
        span={span}
        timeFormat={timeFormat}
        timeZone={forecast.timeZone}
        totalFrames={preload.totalFrames}
      />
    </section>
  );
};
