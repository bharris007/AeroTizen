import { Pause, Play } from "lucide-preact";
import { useEffect, useRef } from "preact/hooks";

import type { TimeFormat } from "../../../contracts/preferences";
import type { RadarPhase, RadarSpanChoice, TimelineEntry } from "../../../services/radar/radarTimeline";
import { useStoreSelector } from "../../../shared/hooks/useStore";
import type { Translate } from "../../../shared/i18n/createTranslations";
import { useTranslation } from "../../../shared/i18n/useTranslation";
import { Icon } from "../../../shared/icons/Icon/Icon";
import type { HomeEnvironment, WeatherFocus } from "../../types";

import styles from "./FamilyRadarTimeline.module.css";

const phaseText = (phase: RadarPhase, t: Translate) => {
  if (phase === "forecast") {
    return t("family.radarForecast");
  }
  if (phase === "past") {
    return t("family.radarPast");
  }
  return t("family.now");
};

const clockLabel = (time: number, timeZone: string, language: string, format: TimeFormat) => {
  const stamp = new Date(time * 1000);
  const weekday = new Intl.DateTimeFormat(language, { timeZone, weekday: "long" }).format(stamp);
  const clock = new Intl.DateTimeFormat(language, {
    hour: "numeric",
    hour12: format === "12",
    minute: "2-digit",
    timeZone,
  }).format(stamp);
  return weekday + " " + clock;
};

const shortLabel = (time: number, timeZone: string, language: string, format: TimeFormat) =>
  new Intl.DateTimeFormat(language, {
    hour: "numeric",
    hour12: format === "12",
    minute: "2-digit",
    timeZone,
  }).format(new Date(time * 1000));

const position = (index: number, total: number) => (total < 2 ? 0 : (index / (total - 1)) * 100);

export const FamilyRadarTimeline = ({
  choices,
  entries,
  env,
  focus,
  index,
  nowIndex,
  phase,
  playing,
  span,
  timeFormat,
  timeZone,
  updated,
}: {
  choices: readonly RadarSpanChoice[];
  entries: readonly TimelineEntry[];
  env: HomeEnvironment;
  focus: WeatherFocus;
  index: number;
  nowIndex: number;
  phase: RadarPhase;
  playing: boolean;
  span: 1 | 2;
  timeFormat: TimeFormat;
  timeZone: string;
  updated: string;
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
    if (focus === "view") {
      return t("family.radarViewHint");
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
  const labels = [0, nowIndex, Math.max(0, entries.length - 1)];
  return (
    <div
      class={styles.panel}
      data-family-radar-timeline
      data-focused={focus === "timeline" || focus === "span" ? "true" : undefined}
      data-radar-phase={phase}
      data-radar-playing={playing ? "true" : "false"}
    >
      <div class={styles.transport}>
        <button
          type="button"
          class={styles.play}
          tabIndex={-1}
          aria-label={t(playing ? "family.radarPause" : "family.radarPlay")}
          data-family-radar-play
          onClick={(event) => {
            event.stopPropagation();
            env.commandRadar({ type: "play" });
          }}
        >
          <Icon icon={playing ? Pause : Play} size={22} />
        </button>
        <div class={styles.label}>
          <div class={styles.phase}>{phaseText(phase, t)}</div>
          <div class={styles.when} data-family-radar-when>
            {selected ? clockLabel(selected.time, timeZone, language, timeFormat) : ""}
          </div>
          {updated ? (
            <div class={styles.updated} data-family-radar-updated>
              {updated}
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
        aria-valuemax={Math.max(0, entries.length - 1)}
        aria-valuenow={index}
        aria-label={t("family.radarTimeline")}
        data-family-radar-track
        onClick={seek}
      >
        <div class={styles.line} />
        {entries.map((entry, entryIndex) => (
          <span
            key={entry.id}
            class={styles.tick}
            data-radar-tick={entry.forecast ? "forecast" : "past"}
            style={{ left: position(entryIndex, entries.length) + "%" }}
          />
        ))}
        <span
          class={styles.thumb}
          data-family-radar-thumb
          data-wrap={wrapped ? "true" : undefined}
          style={{ left: position(index, entries.length) + "%" }}
        />
        <div class={styles.labels}>
          {entries.map((entry, entryIndex) =>
            labels.includes(entryIndex) ? (
              <span
                key={entry.id}
                class={styles.axisLabel}
                style={{ left: position(entryIndex, entries.length) + "%" }}
              >
                {entryIndex === nowIndex ? t("family.now") : shortLabel(entry.time, timeZone, language, timeFormat)}
              </span>
            ) : null,
          )}
        </div>
      </div>
      <p class={styles.hint}>{hint}</p>
    </div>
  );
};
