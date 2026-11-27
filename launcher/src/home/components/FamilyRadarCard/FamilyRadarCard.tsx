import { Minus, Move, Pause, Play, Plus } from "lucide-preact";
import { useCallback, useEffect, useRef, useState } from "preact/hooks";

import type { FamilyForecastSnapshot } from "../../../contracts/familyForecast";
import type { TimeFormat } from "../../../contracts/preferences";
import { acquireRadarMediaKeys } from "../../../platform/tizen/registerMediaKeys";
import {
  formatRadarShortTime,
  framePhase,
  RADAR_PLAY_END_HOLD_MS,
  RADAR_PLAY_STEP_MS,
  radarTimeline,
} from "../../../services/radar/radarTimeline";
import { radarViewport } from "../../../services/radar/radarView";
import { radarOverlay } from "../../../services/radar/rainViewer";
import { useStore, useStoreSelector } from "../../../shared/hooks/useStore";
import { useTranslation } from "../../../shared/i18n/useTranslation";
import { Icon } from "../../../shared/icons/Icon/Icon";
import type { HomeEnvironment } from "../../types";
import { FamilyRadarMap, type RadarPreloadProgress } from "../FamilyRadarMap/FamilyRadarMap";
import { HomeControl } from "../HomeControl/HomeControl";

import styles from "./FamilyRadarCard.module.css";

const PLAY_START_WRAP_MS = 120;
const INITIAL_PRELOAD: RadarPreloadProgress = { loadedFrames: 0, ready: false, timedOut: false, totalFrames: 0 };

// Weather card while live radar is shown. Never autoplays and never loads animation frames
// at rest; stays on 1 static basemap + 1 latest radar image until the user presses Play.
export const FamilyRadarCard = ({
  cardClass,
  enabled,
  env,
  forecast,
  registered,
  timeFormat,
}: {
  cardClass: string;
  enabled: boolean;
  env: HomeEnvironment;
  forecast: FamilyForecastSnapshot;
  registered: boolean;
  timeFormat: TimeFormat;
}) => {
  const { language, t } = useTranslation();
  const saved = useStoreSelector(env.settings, (settings) => settings.radarView);
  const focus = useStoreSelector(env.state, (state) => state.weatherFocus);
  const selectedKey = useStoreSelector(env.state, (state) => state.selected);
  const lite = useStoreSelector(env.state, (state) => state.radarLite);
  const panning = useStoreSelector(env.state, (state) => state.radarPanning);
  const playing = useStoreSelector(env.state, (state) => state.radarPlaying);
  const radarFrame = useStoreSelector(env.state, (state) => state.radarFrame);
  const map = useStore(env.runtime.radarMap);
  const [preload, setPreload] = useState<RadarPreloadProgress>(INITIAL_PRELOAD);
  const [animationRequested, setAnimationRequested] = useState(false);

  const viewport = radarViewport(saved, forecast);
  const overlay = radarOverlay(viewport.zoom, viewport.latitude, viewport.longitude);
  const timeline = radarTimeline(map.frames, 1, overlay.kind, Math.floor(Date.now() / 1000));
  const index =
    lite || radarFrame === null ? timeline.nowIndex : Math.max(0, Math.min(timeline.entries.length - 1, radarFrame));
  const selectedEntry = timeline.entries[index] ?? null;
  const nowTime = timeline.entries[timeline.nowIndex]?.time ?? 0;
  const phase = selectedEntry ? framePhase(selectedEntry, nowTime) : "now";
  const cardActive = enabled && selectedKey === "family-weather";

  const handlePreloadChange = useCallback((next: RadarPreloadProgress) => {
    setPreload(next);
  }, []);

  const handleLoadTimeout = useCallback(() => {
    setAnimationRequested(false);
    env.commandRadar({ lite: true, type: "setLite" });
  }, [env]);

  useEffect(() => {
    if (!enabled) {
      setAnimationRequested(false);
      setPreload(INITIAL_PRELOAD);
      return;
    }
    if (lite) {
      setAnimationRequested(false);
      setPreload(INITIAL_PRELOAD);
      return;
    }
    return acquireRadarMediaKeys();
  }, [enabled, lite]);

  // Begin sequentially loading the remaining <= 5 frames only after the user requests Play or Scrub.
  useEffect(() => {
    if (enabled && !lite && (playing || radarFrame !== null)) {
      setAnimationRequested(true);
    }
  }, [enabled, lite, playing, radarFrame]);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    env.commandRadar({ count: timeline.entries.length, nowIndex: timeline.nowIndex, type: "sync" });
  }, [enabled, env, timeline.entries.length, timeline.nowIndex]);

  const playbackReady = overlay.kind === "nexrad" || map.status === "ready";
  const allPreloaded =
    !lite && preload.ready && preload.totalFrames === timeline.entries.length && timeline.entries.length > 0;
  const buffering = enabled && !lite && playing && (!playbackReady || !allPreloaded);
  const activelyPlaying = enabled && !lite && playing && playbackReady && allPreloaded && timeline.entries.length >= 2;
  const wasActivelyPlayingRef = useRef(false);

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

  const title = t("family.radar") + ", " + forecast.locationLabel + ". " + t("family.openFullScreen");
  const zoom = (delta: number) => (event: Event) => {
    event.stopPropagation();
    env.zoomRadar(delta);
  };
  const activePercent = timeline.entries.length < 2 ? 0 : (index / (timeline.entries.length - 1)) * 100;
  const phaseLabel = (() => {
    if (phase === "forecast") {
      return t("family.radarForecast");
    }
    if (phase === "past") {
      return t("family.radarPast");
    }
    return t("family.now");
  })();

  return (
    <HomeControl env={env} controlKey="family-weather" className={cardClass} registered={registered} title={title}>
      <FamilyRadarMap
        chrome="card"
        enabled={enabled}
        entries={timeline.entries}
        env={env}
        frameIndex={index}
        label={forecast.locationLabel}
        latitude={viewport.latitude}
        lite={lite}
        loadAnimation={!lite && animationRequested}
        longitude={viewport.longitude}
        onLoadTimeout={handleLoadTimeout}
        onPreloadChange={handlePreloadChange}
        placeLatitude={forecast.latitude}
        placeLongitude={forecast.longitude}
        playing={enabled && !lite && playing && allPreloaded}
        zoom={viewport.zoom}
      />
      <div class={styles.tools} data-family-radar-panning={panning ? "true" : "false"}>
        <div class={styles.zoom} role="group" aria-label={t("family.radarZoom")} data-family-radar-zoom>
          <button
            type="button"
            class={styles.zoomButton}
            tabIndex={-1}
            aria-label={t("family.radarZoomIn")}
            data-family-radar-zoom="1"
            data-focused={cardActive && focus === "zoomIn" ? "true" : undefined}
            onClick={zoom(1)}
          >
            <Icon icon={Plus} size={24} />
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
            data-focused={cardActive && focus === "zoomOut" ? "true" : undefined}
            onClick={zoom(-1)}
          >
            <Icon icon={Minus} size={24} />
          </button>
        </div>
        <button
          type="button"
          class={styles.pan}
          tabIndex={-1}
          aria-label={t("family.radarPan")}
          aria-pressed={panning ? "true" : "false"}
          data-family-radar-pan
          data-focused={cardActive && focus === "pan" ? "true" : undefined}
          data-active={panning ? "true" : undefined}
          onClick={(event) => {
            event.stopPropagation();
            env.toggleRadarPanning();
          }}
        >
          <Icon icon={Move} size={20} />
          <span class={styles.panLabel}>{t(panning ? "family.radarPanOn" : "family.radarPan")}</span>
        </button>
      </div>
      {lite ? (
        <div class={styles.staticPill} data-family-radar-static-pill>
          <span class={styles.phase} data-radar-phase-badge="now">
            {t("family.radarStatic")}
          </span>
          <span class={styles.timeText} data-family-radar-when>
            {selectedEntry ? formatRadarShortTime(selectedEntry.time, forecast.timeZone, language, timeFormat) : ""}
          </span>
        </div>
      ) : (
        <div
          class={styles.playBar}
          data-family-radar-play-bar
          data-focused={cardActive && focus === "timeline" ? "true" : undefined}
          data-radar-playing={playing ? "true" : "false"}
          data-radar-buffering={buffering ? "true" : "false"}
          onClick={(event) => {
            event.stopPropagation();
            env.commandRadar({ type: "play" });
          }}
        >
          <button
            type="button"
            class={styles.playButton}
            tabIndex={-1}
            aria-label={t(playing ? "family.radarPause" : "family.radarPlay")}
            aria-pressed={playing ? "true" : "false"}
            data-family-radar-play
            data-focused={cardActive && focus === "timeline" ? "true" : undefined}
            onClick={(event) => {
              event.stopPropagation();
              env.commandRadar({ type: "play" });
            }}
          >
            <span class={playing ? styles.playGlyph : styles.playGlyphNudge}>
              <Icon icon={playing ? Pause : Play} size={18} />
            </span>
          </button>
          <div class={styles.playMeta}>
            <div class={styles.playText}>
              <span class={styles.phase} data-radar-phase-badge={phase}>
                {phaseLabel}
              </span>
              {buffering && preload.totalFrames > 0 ? (
                <span class={styles.bufferingText} data-family-radar-progress>
                  {t("family.radarPreparing", { loaded: preload.loadedFrames, total: preload.totalFrames })}
                </span>
              ) : (
                <span class={styles.timeText} data-family-radar-when>
                  {selectedEntry
                    ? formatRadarShortTime(selectedEntry.time, forecast.timeZone, language, timeFormat)
                    : ""}
                </span>
              )}
            </div>
            <div class={styles.miniRail} aria-hidden="true">
              <div class={styles.miniFill} style={{ width: activePercent.toFixed(1) + "%" }} />
            </div>
          </div>
        </div>
      )}
    </HomeControl>
  );
};
