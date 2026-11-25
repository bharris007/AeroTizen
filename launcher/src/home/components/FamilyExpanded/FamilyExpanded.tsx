import { CloudSun, Radar } from "lucide-preact";

import type { TemperatureUnit, TimeFormat } from "../../../contracts/preferences";
import { useStore, useStoreSelector } from "../../../shared/hooks/useStore";
import { useTranslation } from "../../../shared/i18n/useTranslation";
import { Icon } from "../../../shared/icons/Icon/Icon";
import type { HomeEnvironment } from "../../types";
import { FamilyCalendarFull } from "../FamilyCalendarFull/FamilyCalendarFull";
import { FamilyRadarFull } from "../FamilyRadarFull/FamilyRadarFull";
import { FamilyWeatherFull } from "../FamilyWeatherFull/FamilyWeatherFull";

import styles from "./FamilyExpanded.module.css";

// The Family pane opened full screen over the whole launcher. Back closes it.
export const FamilyExpanded = ({
  env,
  timeFormat,
  unit,
}: {
  env: HomeEnvironment;
  timeFormat: TimeFormat;
  unit: TemperatureUnit;
}) => {
  const { t } = useTranslation();
  const expanded = useStoreSelector(env.state, (state) =>
    state.page === "family" && state.active ? state.expanded : null,
  );
  const forecast = useStore(env.runtime.familyForecast);
  const now = useStore(env.status.time);
  const { events } = useStore(env.runtime.familyCalendar);
  const span = useStoreSelector(env.state, (state) => state.calendarSpan);
  const start = useStoreSelector(env.state, (state) => state.calendarStart);
  const focus = useStoreSelector(env.state, (state) => state.calendarFocus);
  const weatherRadar = useStoreSelector(env.state, (state) => state.weatherRadar);
  const weatherFocus = useStoreSelector(env.state, (state) => state.weatherFocus);
  if (!expanded) {
    return null;
  }
  const weather = weatherRadar ? (
    <FamilyRadarFull env={env} forecast={forecast} />
  ) : (
    <FamilyWeatherFull forecast={forecast} now={now} timeFormat={timeFormat} unit={unit} />
  );
  return (
    <div class={styles.overlay} data-family-overlay={expanded} role="dialog" aria-modal="true">
      {expanded === "weather" ? weather : null}
      {expanded === "calendar" ? (
        <FamilyCalendarFull
          env={env}
          events={events}
          focus={focus}
          now={now}
          span={span}
          start={start}
          timeFormat={timeFormat}
          timeZone={forecast.timeZone}
        />
      ) : null}
      {expanded === "weather" ? (
        <button
          type="button"
          class={styles.radarToggle}
          tabIndex={-1}
          aria-label={t(weatherRadar ? "family.showForecast" : "family.showRadar")}
          data-family-radar-toggle={weatherRadar ? "forecast" : "radar"}
          data-focused={weatherFocus === "radar" ? "true" : undefined}
          onClick={() => env.toggleWeatherRadar()}
        >
          <Icon icon={weatherRadar ? CloudSun : Radar} size={36} />
        </button>
      ) : null}
    </div>
  );
};
