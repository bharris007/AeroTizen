import { Minus, Move, Plus } from "lucide-preact";
import { useEffect, useState } from "preact/hooks";

import type { FamilyForecastSnapshot } from "../../../contracts/familyForecast";
import type { TimeFormat } from "../../../contracts/preferences";
import { framePhase, radarAgeMinutes, radarTimeline } from "../../../services/radar/radarTimeline";
import { radarViewport } from "../../../services/radar/radarView";
import { radarOverlay } from "../../../services/radar/rainViewer";
import { useStore, useStoreSelector } from "../../../shared/hooks/useStore";
import { useTranslation } from "../../../shared/i18n/useTranslation";
import { Icon } from "../../../shared/icons/Icon/Icon";
import type { HomeEnvironment, WeatherFocus } from "../../types";
import { FamilyRadarMap } from "../FamilyRadarMap/FamilyRadarMap";
import { FamilyRadarTimeline } from "../FamilyRadarTimeline/FamilyRadarTimeline";

import styles from "./FamilyRadarFull.module.css";

const PLAY_INTERVAL_MS = 900;
const AGE_REFRESH_MS = 30 * 1000;

// Full-screen radar. Arrows move between controls. The pan button arms map movement.
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
  useEffect(() => {
    env.commandRadar({ count: timeline.entries.length, nowIndex: timeline.nowIndex, type: "sync" });
  }, [env, timeline.entries.length, timeline.nowIndex]);
  useEffect(() => {
    if (!playing || timeline.entries.length < 2) {
      return;
    }
    const timer = window.setInterval(() => env.commandRadar({ type: "tick" }), PLAY_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [env, playing, timeline.entries.length]);
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
        env={env}
        label={forecast.locationLabel}
        latitude={viewport.latitude}
        longitude={viewport.longitude}
        playback={selected ? { nexrad: selected.nexrad, path: selected.path, time: selected.time } : null}
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
            <Icon icon={Plus} size={36} />
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
            <Icon icon={Minus} size={36} />
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
          <Icon icon={Move} size={32} />
          <span class={styles.panLabel}>{t(panning ? "family.radarPanOn" : "family.radarPan")}</span>
        </button>
      </div>
      <FamilyRadarTimeline
        choices={timeline.choices}
        entries={timeline.entries}
        env={env}
        focus={focus}
        index={index}
        nowIndex={timeline.nowIndex}
        phase={selected ? framePhase(selected, nowTime) : "now"}
        playing={playing}
        span={span}
        timeFormat={timeFormat}
        timeZone={forecast.timeZone}
        updated={updated}
      />
    </section>
  );
};
