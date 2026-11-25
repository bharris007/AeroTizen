import { ZoomIn, ZoomOut } from "lucide-preact";
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

const PLAY_INTERVAL_MS = 650;
const AGE_REFRESH_MS = 30 * 1000;

// Full-screen radar. Arrows pan. OK opens the timeline. Up reaches the range, then zoom.
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
      aria-label={t("family.radar") + ", " + forecast.locationLabel}
    >
      <FamilyRadarMap
        chrome="full"
        enabled
        env={env}
        label={forecast.locationLabel}
        latitude={viewport.latitude}
        longitude={viewport.longitude}
        playback={
          selected
            ? { nexrad: selected.nexrad, path: selected.path, time: selected.time }
            : null
        }
        zoom={viewport.zoom}
      />
      <div
        class={styles.zoom}
        role="group"
        aria-label={t("family.radarZoom")}
        data-family-radar-zoom
        data-focused={focus === "zoom" ? "true" : undefined}
      >
        <button
          type="button"
          class={styles.zoomButton}
          tabIndex={-1}
          aria-label={t("family.radarZoomIn")}
          data-family-radar-zoom="1"
          onClick={zoom(1)}
        >
          <Icon icon={ZoomIn} size={32} />
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
          onClick={zoom(-1)}
        >
          <Icon icon={ZoomOut} size={32} />
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
