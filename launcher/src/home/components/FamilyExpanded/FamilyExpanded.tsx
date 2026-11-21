import type { TemperatureUnit, TimeFormat } from "../../../contracts/preferences";
import { useStore, useStoreSelector } from "../../../shared/hooks/useStore";
import type { HomeEnvironment } from "../../types";
import { FamilyCalendarFull } from "../FamilyCalendarFull/FamilyCalendarFull";
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
  const expanded = useStoreSelector(env.state, (state) =>
    state.page === "family" && state.active ? state.expanded : null,
  );
  const forecast = useStore(env.runtime.familyForecast);
  const now = useStore(env.status.time);
  const { events } = useStore(env.runtime.familyCalendar);
  const span = useStoreSelector(env.state, (state) => state.calendarSpan);
  const start = useStoreSelector(env.state, (state) => state.calendarStart);
  const focus = useStoreSelector(env.state, (state) => state.calendarFocus);
  if (!expanded) {
    return null;
  }
  return (
    <div class={styles.overlay} data-family-overlay={expanded} role="dialog" aria-modal="true">
      {expanded === "weather" ? (
        <FamilyWeatherFull forecast={forecast} now={now} timeFormat={timeFormat} unit={unit} />
      ) : (
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
      )}
    </div>
  );
};
