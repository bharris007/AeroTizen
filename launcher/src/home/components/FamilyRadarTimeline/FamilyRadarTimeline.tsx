import { Pause, Play } from "lucide-preact";
import { useEffect, useRef } from "preact/hooks";

import type { TimeFormat } from "../../../contracts/preferences";
import {
  formatRadarShortTime,
  formatRadarTimestamp,
  type RadarPhase,
  type RadarSpanChoice,
  type TimelineEntry,
} from "../../../services/radar/radarTimeline";
import { useStoreSelector } from "../../../shared/hooks/useStore";
import type { Translate } from "../../../shared/i18n/createTranslations";
import { useTranslation } from "../../../shared/i18n/useTranslation";
import { Icon } from "../../../shared/icons/Icon/Icon";
import type { HomeEnvironment, WeatherFocus } from "../../types";

import styles from "./FamilyRadarTimeline.module.css";

const PROGRESS_RING_RADIUS = 21;
const PROGRESS_RING_CIRCUMFERENCE = 2 * Math.PI * PROGRESS_RING_RADIUS;

const phaseText = (phase: RadarPhase, t: Translate) => {
  if (phase === "forecast") {
    return t("family.radarForecast");
  }
  if (phase === "past") {
    return t("family.radarPast");
  }
  return t("family.now");
};

const ratioFor = (index: number, total: number) => (total < 2 ? 0 : Math.max(0, Math.min(1, index / (total - 1))));

export const FamilyRadarTimeline = ({
  buffering,
  choices,
  entries,
  env,
  focus,
  index,
  loadedFrames,
  nowIndex,
  phase,
  playing,
  preloadReady,
  span,
  timeFormat,
  timeZone,
  totalFrames,
}: {
  buffering: boolean;
  choices: readonly RadarSpanChoice[];
  entries: readonly TimelineEntry[];
  env: HomeEnvironment;
  focus: WeatherFocus;
  index: number;
  loadedFrames: number;
  nowIndex: number;
  phase: RadarPhase;
  playing: boolean;
  preloadReady: boolean;
  span: 1 | 2;
  timeFormat: TimeFormat;
  timeZone: string;
  totalFrames: number;
}) => {
  const { language, t } = useTranslation();
  const panning = useStoreSelector(env.state, (state) => state.radarPanning);
  const selected = entries[index] ?? null;
  const previousIndex = useRef(index);
  const wrapped =
    entries.length > 1 &&
    ((previousIndex.current === entries.length - 1 && index === 0) ||
      (previousIndex.current === 0 && index === entries.length - 1));
  useEffect(() => {
    previousIndex.current = index;
  }, [index]);

  const hint = (() => {
    if (panning) {
      return t("family.radarPanHint");
    }
    if (focus === "pan") {
      return t("family.radarPanSelectHint");
    }
    if (focus === "span") {
      return t("family.radarSpanHint");
    }
    if (focus === "timeline") {
      return t("family.radarTimelineHint");
    }
    if (focus === "zoomIn") {
      return t("family.radarZoomInHint");
    }
    if (focus === "zoomOut") {
      return t("family.radarZoomOutHint");
    }
    return t("family.closeHint");
  })();

  const seek = (event: MouseEvent) => {
    const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect();
    if (bounds.width <= 0 || entries.length < 2) {
      return;
    }
    const ratio = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width));
    env.commandRadar({ index: Math.round(ratio * (entries.length - 1)), type: "seek" });
  };

  const activeRatio = ratioFor(index, entries.length);
  const preloadRatio = totalFrames > 0 ? Math.max(0, Math.min(1, loadedFrames / totalFrames)) : 0;
  const ringOffset = PROGRESS_RING_CIRCUMFERENCE * (1 - preloadRatio);
  const showProgressRing = totalFrames > 0 && !preloadReady;
  const showPreparing = totalFrames > 0 && !preloadReady;
  const lastIndex = Math.max(0, entries.length - 1);
  const axisIndices = [0, nowIndex, lastIndex];
  const labelAlignment = (entryIndex: number) => {
    if (entryIndex === 0) {
      return "start";
    }
    if (entryIndex === lastIndex) {
      return "end";
    }
    return "center";
  };

  return (
    <div
      class={styles.panel}
      data-family-radar-timeline
      data-focused={focus === "timeline" || focus === "span" ? "true" : undefined}
      data-radar-phase={phase}
      data-radar-playing={playing ? "true" : "false"}
      data-radar-buffering={buffering ? "true" : "false"}
      data-radar-preload-ready={preloadReady ? "true" : "false"}
    >
      <div class={styles.transport}>
        <button
          type="button"
          class={styles.play}
          tabIndex={-1}
          aria-label={t(playing ? "family.radarPause" : "family.radarPlay")}
          aria-pressed={playing ? "true" : "false"}
          data-family-radar-play
          data-focused={focus === "timeline" ? "true" : undefined}
          data-buffering={buffering ? "true" : undefined}
          onClick={(event) => {
            event.stopPropagation();
            env.commandRadar({ type: "play" });
          }}
        >
          {showProgressRing ? (
            <svg class={styles.ring} viewBox="0 0 48 48" aria-hidden="true">
              <circle class={styles.ringTrack} cx="24" cy="24" r={PROGRESS_RING_RADIUS} />
              <circle
                class={styles.ringFill}
                cx="24"
                cy="24"
                r={PROGRESS_RING_RADIUS}
                stroke-dasharray={PROGRESS_RING_CIRCUMFERENCE}
                stroke-dashoffset={ringOffset}
              />
            </svg>
          ) : null}
          <span class={playing ? styles.playGlyph : styles.playGlyphNudge}>
            <Icon icon={playing ? Pause : Play} size={22} />
          </span>
        </button>
        <div class={styles.label}>
          <div class={styles.headline}>
            <span class={styles.phase} data-radar-phase-badge={phase}>
              {phase === "now" ? <span class={styles.liveDot} aria-hidden="true" /> : null}
              {phaseText(phase, t)}
            </span>
            <span class={styles.when} data-family-radar-when>
              {selected ? formatRadarTimestamp(selected.time, timeZone, language, timeFormat) : ""}
            </span>
          </div>
          {showPreparing ? (
            <div class={styles.progress} data-family-radar-progress>
              {t("family.radarPreparing", { loaded: loadedFrames, total: totalFrames })}
            </div>
          ) : null}
        </div>
        <div
          class={styles.spans}
          role="radiogroup"
          aria-label={t("family.radarRange")}
          data-family-radar-spans
          data-focused={focus === "span" ? "true" : undefined}
        >
          {choices.map((choice) => (
            <button
              key={choice.span}
              type="button"
              class={styles.span}
              tabIndex={-1}
              role="radio"
              aria-checked={choice.span === span}
              data-family-radar-span={choice.span}
              onClick={(event) => {
                event.stopPropagation();
                env.commandRadar({ span: choice.span, type: "span" });
              }}
            >
              {t("family.radarHours", { count: choice.hours })}
            </button>
          ))}
        </div>
      </div>
      <div
        class={styles.track}
        role="slider"
        aria-valuemin={0}
        aria-valuemax={lastIndex}
        aria-valuenow={index}
        aria-label={t("family.radarTimeline")}
        data-family-radar-track
        onClick={seek}
      >
        <div class={styles.rail}>
          <div
            class={styles.bufferFill}
            data-family-radar-buffer
            style={{ transform: "scaleX(" + preloadRatio + ") translateZ(0)" }}
          />
          <div
            class={styles.activeFill}
            data-wrap={wrapped ? "true" : undefined}
            style={{ transform: "scaleX(" + activeRatio + ") translateZ(0)" }}
          />
        </div>
        {entries.map((entry, entryIndex) => {
          const tickType = (() => {
            if (entryIndex === nowIndex) {
              return "now";
            }
            return entry.forecast ? "forecast" : "past";
          })();
          return (
            <span
              key={entry.id}
              class={styles.tick}
              data-radar-tick={tickType}
              style={{ left: ratioFor(entryIndex, entries.length) * 100 + "%" }}
            />
          );
        })}
        <div
          class={styles.thumbCarrier}
          data-wrap={wrapped ? "true" : undefined}
          style={{ transform: "translateX(" + activeRatio * 100 + "%) translateZ(0)" }}
        >
          <span class={styles.thumb} data-family-radar-thumb />
        </div>
        <div class={styles.labels}>
          {entries.map((entry, entryIndex) =>
            axisIndices.includes(entryIndex) ? (
              <span
                key={entry.id}
                class={styles.axisLabel}
                data-align={labelAlignment(entryIndex)}
                data-now={entryIndex === nowIndex ? "true" : undefined}
                style={{ left: ratioFor(entryIndex, entries.length) * 100 + "%" }}
              >
                {entryIndex === nowIndex
                  ? t("family.now")
                  : formatRadarShortTime(entry.time, timeZone, language, timeFormat)}
              </span>
            ) : null,
          )}
        </div>
      </div>
      <p class={styles.hint}>{hint}</p>
    </div>
  );
};
